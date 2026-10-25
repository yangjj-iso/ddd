import csv
import hashlib
import io
import json
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated
from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import ValidationError
from . import models as m
from .auth import (
    Identity,
    administrator,
    check_password,
    create_session,
    identity,
    writer,
)
from .config import settings
from .db import get_db
from .schemas import (
    CATEGORIES,
    KeyInput,
    LocationInput,
    Login,
    PartCreate,
    PartInput,
    ProjectInput,
    StockInput,
)
from .schemas import (
    AuthOut,
    PartOut,
    MovementOut,
    Page,
    SummaryOut,
    LocationOut,
    KeyOut,
    CreatedKeyOut,
    ProjectOut,
)
from .services import (
    create_part,
    get_part,
    movement_data,
    part_data,
    project_data,
    validate_location,
    validate_project,
)

app = FastAPI(
    title="PartsBox API",
    version="1.0.0",
    description="电子元器件物料管理 API。使用网页会话或 X-API-Key。read 密钥仅读取，write 密钥可维护物料和出入库；密钥管理仅限管理员。所有时间为 UTC，金额为人民币。",
    openapi_tags=[
        {"name": "物料", "description": "物料档案与参数搜索"},
        {"name": "库存", "description": "事务化出入库，支持 Idempotency-Key"},
        {"name": "接入", "description": "智能体 API 密钥管理"},
    ],
)
DB = Annotated[Session, Depends(get_db)]
Reader = Annotated[Identity, Depends(identity)]
Writer = Annotated[Identity, Depends(writer)]
Admin = Annotated[Identity, Depends(administrator)]


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=409,
        content={"detail": "编号已存在，或该记录仍被其他数据引用，请检查后重试。"},
    )


@app.get("/api/health", tags=["系统"])
def health(db: DB):
    db.execute(text("SELECT 1"))
    return {
        "service": "partsbox",
        "status": "ok",
        "database": "MySQL",
        "version": "1.0.0",
    }


login_attempts: dict[str, deque] = defaultdict(deque)
login_lock = threading.Lock()


@app.post("/api/auth/login", tags=["身份"], response_model=AuthOut)
def login(data: Login, request: Request, response: Response):
    address = request.client.host if request.client else "unknown"
    with login_lock:
        for key in list(login_attempts):
            while (
                login_attempts[key] and login_attempts[key][0] < time.monotonic() - 300
            ):
                login_attempts[key].popleft()
            if not login_attempts[key]:
                del login_attempts[key]
        attempts = login_attempts[address]
        if len(attempts) >= 10:
            raise HTTPException(429, "登录尝试过多，请 5 分钟后重试")
        attempts.append(time.monotonic())
    if not check_password(data.username, data.password):
        raise HTTPException(401, "用户名或密码错误")
    with login_lock:
        login_attempts.pop(address, None)
    response.set_cookie(
        "partsbox_session",
        create_session(),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=86400,
    )
    return {"name": settings.admin_username, "scope": "write", "admin": True}


@app.get("/api/auth/me", tags=["身份"], response_model=AuthOut)
def me(user: Reader):
    return user


@app.post("/api/auth/logout", tags=["身份"])
def logout(response: Response, user: Reader):
    response.delete_cookie(
        "partsbox_session", secure=settings.cookie_secure, samesite="strict"
    )
    return {"ok": True}


@app.get("/api/v1/categories", tags=["物料"])
def categories(user: Reader):
    return CATEGORIES


def part_filters(q="", category="", location_id=None, stock="", package=""):
    conditions = []
    if q:
        query = (
            "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        )
        conditions.append(
            or_(
                *[
                    col.like(query, escape="\\")
                    for col in (
                        m.Part.name,
                        m.Part.sku,
                        m.Part.manufacturer,
                        m.Part.description,
                        m.Part.package,
                    )
                ],
                func.cast(m.Part.specs, m.Text).like(query, escape="\\"),
            )
        )
    if category:
        conditions.append(m.Part.category == category)
    if location_id:
        conditions.append(m.Part.location_id == location_id)
    if package:
        conditions.append(m.Part.package == package)
    if stock == "low":
        conditions.append(m.Part.quantity <= m.Part.min_quantity)
    elif stock == "out":
        conditions.append(m.Part.quantity == 0)
    elif stock == "normal":
        conditions.append(m.Part.quantity > m.Part.min_quantity)
    return conditions


@app.get("/api/v1/parts", tags=["物料"], response_model=Page[PartOut])
def parts(
    db: DB,
    user: Reader,
    q: str = Query("", max_length=100),
    category: str = "",
    location_id: int | None = None,
    stock: str = "",
    package: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: str = "newest",
):
    filters = part_filters(q, category, location_id, stock, package)
    order = {
        "name": m.Part.name.asc(),
        "quantity": m.Part.quantity.asc(),
        "newest": m.Part.created_at.desc(),
    }.get(sort, m.Part.created_at.desc())
    total = db.scalar(select(func.count(m.Part.id)).where(*filters))
    rows = db.scalars(
        select(m.Part)
        .where(*filters)
        .order_by(order, m.Part.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [part_data(p) for p in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


CSV_COLUMNS = [
    "sku",
    "name",
    "category",
    "product_type",
    "manufacturer",
    "package",
    "description",
    "quantity",
    "min_quantity",
    "unit_price",
    "location_code",
    "datasheet_url",
    "notes",
]


@app.get("/api/v1/parts/export", tags=["物料"])
def export_parts(
    db: DB,
    user: Reader,
    q: str = "",
    category: str = "",
    stock: str = "",
    location_id: int | None = None,
    package: str = "",
):
    stream = io.StringIO()
    stream.write("\ufeff")
    csv_writer = csv.DictWriter(stream, fieldnames=CSV_COLUMNS)
    csv_writer.writeheader()
    rows = db.scalars(
        select(m.Part)
        .where(*part_filters(q, category, location_id, stock, package))
        .order_by(m.Part.id)
    )
    for part in rows:
        data = part_data(part)
        data["product_type"] = part.specs.get("商品类型", "") or part.specs.get(
            "器件类型", ""
        )
        data["location_code"] = part.location.code if part.location else ""
        row = {key: data.get(key, "") for key in CSV_COLUMNS}
        for key, value in row.items():
            if isinstance(value, str) and value.lstrip().startswith(
                ("=", "+", "-", "@", "\t", "\r")
            ):
                row[key] = "'" + value
        csv_writer.writerow(row)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="partsbox-inventory.csv"'
        },
    )


@app.post("/api/v1/parts/import", tags=["物料"])
async def import_parts(db: DB, user: Writer, file: UploadFile = File(...)):
    raw = await file.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, "CSV 文件不能超过 2 MB")
    try:
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    except (UnicodeDecodeError, csv.Error):
        raise HTTPException(422, "请上传 UTF-8 编码的 CSV 文件")
    if not rows or len(rows) > 1000:
        raise HTTPException(422, "每次导入需要 1–1000 行物料")
    locations = {l.code: l.id for l in db.scalars(select(m.Location))}
    existing = set(db.scalars(select(m.Part.sku)))
    parsed = []
    errors = []
    for index, row in enumerate(rows, 2):
        try:
            values = {
                k: v.strip() if isinstance(v, str) else v
                for k, v in row.items()
                if k in CSV_COLUMNS
            }
            code = values.pop("location_code", "")
            product_type = values.pop("product_type", "")
            if product_type:
                values["specs"] = {"商品类型": product_type}
            if code and code not in locations:
                raise ValueError(f"库位 {code} 不存在，请先创建")
            values["location_id"] = locations.get(code)
            for field in ("quantity", "min_quantity", "unit_price"):
                if values.get(field) == "":
                    del values[field]
            part = PartCreate(**values)
            if part.sku in existing:
                raise ValueError(f"物料编号 {part.sku} 重复")
            existing.add(part.sku)
            parsed.append(part)
        except (ValueError, ValidationError) as exc:
            errors.append(f"第 {index} 行：{exc}")
    if errors:
        raise HTTPException(422, "\n".join(errors[:20]))
    for data in parsed:
        create_part(db, data, user.name)
    db.commit()
    return {"imported": len(parsed)}


@app.get("/api/v1/parts/{part_id}", tags=["物料"], response_model=PartOut)
def part_detail(part_id: int, db: DB, user: Reader):
    return part_data(get_part(db, part_id))


@app.post("/api/v1/parts", status_code=201, tags=["物料"], response_model=PartOut)
def add_part(data: PartCreate, db: DB, user: Writer):
    part = create_part(db, data, user.name)
    db.commit()
    db.refresh(part)
    return part_data(part)


@app.put("/api/v1/parts/{part_id}", tags=["物料"], response_model=PartOut)
def edit_part(part_id: int, data: PartInput, db: DB, user: Writer):
    part = get_part(db, part_id, lock=True)
    validate_location(db, data.location_id)
    for field, value in data.model_dump().items():
        setattr(part, field, value)
    db.commit()
    db.refresh(part)
    return part_data(part)


@app.delete("/api/v1/parts/{part_id}", status_code=204, tags=["物料"])
def delete_part(part_id: int, db: DB, user: Writer):
    part = get_part(db, part_id, lock=True)
    if part.quantity or db.scalar(
        select(func.count(m.Movement.id)).where(m.Movement.part_id == part_id)
    ):
        raise HTTPException(409, "有库存或出入库记录的物料不能删除，以保留追溯记录")
    db.delete(part)
    db.commit()


@app.post("/api/v1/parts/{part_id}/stock", tags=["库存"], response_model=MovementOut)
def change_stock(
    part_id: int,
    data: StockInput,
    db: DB,
    user: Writer,
    idempotency_key: str | None = Header(None, max_length=120),
):
    part = get_part(db, part_id, lock=True)
    if idempotency_key:
        existing = db.scalar(
            select(m.Movement).where(m.Movement.idempotency_key == idempotency_key)
        )
        if existing:
            if (
                existing.part_id,
                existing.kind,
                existing.quantity,
                existing.reason,
                existing.actor,
            ) != (part_id, data.kind, data.quantity, data.reason, user.name):
                raise HTTPException(409, "此 Idempotency-Key 已用于另一笔操作")
            return movement_data(existing)
    new_quantity = part.quantity + (
        data.quantity if data.kind == "in" else -data.quantity
    )
    if new_quantity < 0:
        raise HTTPException(409, f"库存不足，当前仅剩 {part.quantity} 件")
    if new_quantity > 1000000000:
        raise HTTPException(422, "库存数量超过上限")
    part.quantity = new_quantity
    movement = m.Movement(
        part_id=part.id,
        kind=data.kind,
        quantity=data.quantity,
        balance=new_quantity,
        reason=data.reason,
        actor=user.name,
        idempotency_key=idempotency_key,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement_data(movement)


@app.get("/api/v1/movements", tags=["库存"], response_model=Page[MovementOut])
def movements(
    db: DB,
    user: Reader,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    part_id: int | None = None,
    kind: str = "",
    q: str = "",
):
    filters = []
    if part_id:
        filters.append(m.Movement.part_id == part_id)
    if kind:
        filters.append(m.Movement.kind == kind)
    if q:
        filters.append(
            or_(
                m.Part.name.contains(q, autoescape=True),
                m.Part.sku.contains(q, autoescape=True),
                m.Movement.reason.contains(q, autoescape=True),
            )
        )
    stmt = (
        select(m.Movement).join(m.Part, m.Movement.part_id == m.Part.id).where(*filters)
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.order_by(m.Movement.created_at.desc(), m.Movement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {
        "items": [movement_data(v) for v in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/v1/summary", tags=["库存"], response_model=SummaryOut)
def summary(db: DB, user: Reader):
    row = db.execute(
        select(
            func.count(m.Part.id),
            func.coalesce(func.sum(m.Part.quantity), 0),
            func.coalesce(func.sum(m.Part.quantity * m.Part.unit_price), 0),
            func.coalesce(
                func.sum(case((m.Part.quantity <= m.Part.min_quantity, 1), else_=0)), 0
            ),
            func.coalesce(func.sum(case((m.Part.quantity == 0, 1), else_=0)), 0),
            func.coalesce(func.sum(case((m.Part.is_demo.is_(True), 1), else_=0)), 0),
        )
    ).one()
    cats = db.execute(
        select(m.Part.category, func.count(m.Part.id), func.sum(m.Part.quantity))
        .group_by(m.Part.category)
        .order_by(func.count(m.Part.id).desc())
    ).all()
    recent = db.scalars(
        select(m.Movement)
        .order_by(m.Movement.created_at.desc(), m.Movement.id.desc())
        .limit(5)
    )
    today = datetime.now(timezone.utc).date()
    trend = {
        str(today - timedelta(days=13 - i)): {
            "date": str(today - timedelta(days=13 - i)),
            "in": 0,
            "out": 0,
        }
        for i in range(14)
    }
    history = db.execute(
        select(
            func.date(m.Movement.created_at),
            m.Movement.kind,
            func.sum(m.Movement.quantity),
        )
        .where(m.Movement.created_at >= today - timedelta(days=13))
        .group_by(func.date(m.Movement.created_at), m.Movement.kind)
    )
    for day, kind, count in history:
        if str(day) in trend:
            trend[str(day)][kind] = int(count)
    return {
        "total_parts": row[0],
        "total_quantity": int(row[1]),
        "total_value": float(row[2]),
        "low_stock": int(row[3]),
        "out_of_stock": int(row[4]),
        "demo_parts": int(row[5]),
        "location_count": db.scalar(select(func.count(m.Location.id))),
        "categories": [
            {"name": name, "count": count, "quantity": int(qty)}
            for name, count, qty in cats
        ],
        "recent_movements": [movement_data(v) for v in recent],
        "trend": list(trend.values()),
    }


@app.get("/api/v1/locations", tags=["库位"], response_model=list[LocationOut])
def locations(db: DB, user: Reader):
    rows = db.execute(
        select(
            m.Location,
            func.count(m.Part.id),
            func.coalesce(func.sum(m.Part.quantity), 0),
        )
        .outerjoin(m.Part, m.Part.location_id == m.Location.id)
        .group_by(m.Location.id)
        .order_by(m.Location.code)
    )
    return [
        {
            "id": l.id,
            "code": l.code,
            "name": l.name,
            "description": l.description,
            "capacity": l.capacity,
            "part_count": count,
            "quantity": int(qty),
        }
        for l, count, qty in rows
    ]


@app.post("/api/v1/locations", status_code=201, tags=["库位"])
def add_location(data: LocationInput, db: DB, user: Writer):
    location = m.Location(**data.model_dump())
    db.add(location)
    db.commit()
    return {"id": location.id}


@app.put("/api/v1/locations/{location_id}", tags=["库位"])
def edit_location(location_id: int, data: LocationInput, db: DB, user: Writer):
    location = db.get(m.Location, location_id)
    if not location:
        raise HTTPException(404, "库位不存在")
    for key, value in data.model_dump().items():
        setattr(location, key, value)
    db.commit()
    return {"id": location.id}


@app.delete("/api/v1/locations/{location_id}", status_code=204, tags=["库位"])
def delete_location(location_id: int, db: DB, user: Writer):
    location = db.get(m.Location, location_id)
    if not location:
        raise HTTPException(404, "库位不存在")
    if db.scalar(
        select(func.count(m.Part.id)).where(m.Part.location_id == location_id)
    ):
        raise HTTPException(409, "库位内仍有物料，请先移动到其他库位")
    db.delete(location)
    db.commit()


@app.get("/api/v1/keys", tags=["接入"], response_model=list[KeyOut])
def keys(db: DB, user: Admin):
    return [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.prefix,
            "scope": k.scope,
            "created_at": k.created_at.isoformat() + "Z",
            "last_used_at": k.last_used_at.isoformat() + "Z"
            if k.last_used_at
            else None,
            "revoked": k.revoked,
        }
        for k in db.scalars(select(m.ApiKey).order_by(m.ApiKey.id.desc()))
    ]


@app.post("/api/v1/keys", status_code=201, tags=["接入"], response_model=CreatedKeyOut)
def create_key(data: KeyInput, db: DB, user: Admin):
    token = "pb_" + secrets.token_urlsafe(32)
    key = m.ApiKey(
        name=data.name,
        scope=data.scope,
        prefix=token[:11],
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
    )
    db.add(key)
    db.commit()
    return {"id": key.id, "token": token, "name": key.name, "scope": key.scope}


@app.delete("/api/v1/keys/{key_id}", status_code=204, tags=["接入"])
def revoke_key(key_id: int, db: DB, user: Admin):
    key = db.get(m.ApiKey, key_id)
    if not key:
        raise HTTPException(404, "密钥不存在")
    key.revoked = True
    db.commit()


@app.get("/api/v1/projects", tags=["BOM"], response_model=list[ProjectOut])
def projects(db: DB, user: Reader):
    return [
        project_data(v)
        for v in db.scalars(select(m.Project).order_by(m.Project.id.desc()))
    ]


@app.post("/api/v1/projects", status_code=201, tags=["BOM"], response_model=ProjectOut)
def add_project(data: ProjectInput, db: DB, user: Writer):
    validate_project(db, data)
    project = m.Project(**data.model_dump(exclude={"lines"}))
    project.lines = [m.BomLine(**line.model_dump()) for line in data.lines]
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_data(project)


@app.put("/api/v1/projects/{project_id}", tags=["BOM"], response_model=ProjectOut)
def edit_project(project_id: int, data: ProjectInput, db: DB, user: Writer):
    project = db.get(m.Project, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    validate_project(db, data)
    for key, value in data.model_dump(exclude={"lines"}).items():
        setattr(project, key, value)
    project.lines = [m.BomLine(**line.model_dump()) for line in data.lines]
    db.commit()
    db.refresh(project)
    return project_data(project)


@app.delete("/api/v1/projects/{project_id}", status_code=204, tags=["BOM"])
def delete_project(project_id: int, db: DB, user: Writer):
    project = db.get(m.Project, project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    db.delete(project)
    db.commit()


@app.get("/api/v1/system", tags=["系统"])
def system_info(db: DB, user: Admin):
    return {
        "database": "MySQL",
        "database_version": db.scalar(text("SELECT VERSION()")),
        "app_version": "1.0.0",
        "timezone": "UTC / Asia-Shanghai display",
        "storage": "InnoDB · utf8mb4",
        "framework": "FastAPI · SQLAlchemy · React",
    }


@app.get("/api/v1/backup", tags=["系统"])
def backup(db: DB, user: Admin):
    # Repeatable-read transaction gives a consistent logical snapshot. Secrets are excluded.
    payload = {
        "format": "partsbox-export-v1",
        "created_at": m.now().isoformat() + "Z",
        "parts": [part_data(v) for v in db.scalars(select(m.Part))],
        "locations": [
            {
                "id": v.id,
                "code": v.code,
                "name": v.name,
                "capacity": v.capacity,
                "description": v.description,
            }
            for v in db.scalars(select(m.Location))
        ],
        "movements": [
            movement_data(v)
            for v in db.scalars(select(m.Movement).order_by(m.Movement.id))
        ],
        "projects": [project_data(v) for v in db.scalars(select(m.Project))],
    }
    return StreamingResponse(
        iter([json.dumps(payload, ensure_ascii=False, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="partsbox-data.json"'},
    )


@app.post("/api/v1/demo", tags=["系统"])
def seed_demo(db: DB, user: Admin):
    from .seed import seed

    if (
        db.scalar(select(func.count(m.Part.id)))
        or db.scalar(select(func.count(m.Location.id)))
        or db.scalar(select(func.count(m.Project.id)))
    ):
        raise HTTPException(409, "演示数据仅可导入空白物料库")
    seed(db)
    return {"ok": True}


@app.delete("/api/v1/demo", tags=["系统"])
def clear_demo(db: DB, user: Admin):
    demo_ids = list(db.scalars(select(m.Part.id).where(m.Part.is_demo.is_(True))))
    if not demo_ids:
        return {"deleted": 0}
    changed = db.scalar(
        select(func.count(m.Movement.id)).where(
            m.Movement.part_id.in_(demo_ids), m.Movement.is_demo.is_(False)
        )
    )
    referenced = db.scalar(
        select(func.count(m.BomLine.id)).where(m.BomLine.part_id.in_(demo_ids))
    )
    if changed or referenced:
        raise HTTPException(
            409,
            "演示物料已有新流水或被 BOM 引用，不能清除；请先移除 BOM 引用。新流水需保留追溯。",
        )
    from sqlalchemy import delete

    db.execute(delete(m.Movement).where(m.Movement.part_id.in_(demo_ids)))
    db.execute(delete(m.Part).where(m.Part.id.in_(demo_ids)))
    used = select(m.Part.location_id).where(m.Part.location_id.is_not(None))
    db.execute(
        delete(m.Location).where(
            m.Location.is_demo.is_(True), m.Location.id.not_in(used)
        )
    )
    db.commit()
    return {"deleted": len(demo_ids)}


static = Path(__file__).resolve().parents[1] / "static"
if static.exists():
    app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith(("api/", "docs/")):
            raise HTTPException(404, "接口不存在")
        file = static / path
        if path == "favicon.svg":
            return FileResponse(file)
        return FileResponse(static / "index.html")
