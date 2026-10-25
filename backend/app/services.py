from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import Part, Location, Movement, Project
from .schemas import PartCreate, ProjectInput


def part_data(p: Part):
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category,
        "manufacturer": p.manufacturer,
        "package": p.package,
        "description": p.description,
        "quantity": p.quantity,
        "min_quantity": p.min_quantity,
        "unit_price": str(p.unit_price),
        "location_id": p.location_id,
        "location": {
            "id": p.location.id,
            "code": p.location.code,
            "name": p.location.name,
        }
        if p.location
        else None,
        "specs": p.specs,
        "datasheet_url": p.datasheet_url,
        "notes": p.notes,
        "is_demo": p.is_demo,
        "created_at": p.created_at.isoformat() + "Z",
        "updated_at": p.updated_at.isoformat() + "Z",
    }


def movement_data(m: Movement):
    return {
        "id": m.id,
        "part_id": m.part_id,
        "part_name": m.part.name,
        "part_sku": m.part.sku,
        "category": m.part.category,
        "kind": m.kind,
        "quantity": m.quantity,
        "balance": m.balance,
        "reason": m.reason,
        "actor": m.actor,
        "created_at": m.created_at.isoformat() + "Z",
    }


def get_part(db: Session, part_id: int, lock=False):
    stmt = select(Part).where(Part.id == part_id)
    if lock:
        stmt = stmt.with_for_update()
    part = db.scalar(stmt)
    if not part:
        raise HTTPException(404, "物料不存在")
    return part


def validate_location(db: Session, location_id: int | None):
    if location_id and not db.get(Location, location_id):
        raise HTTPException(422, "所选库位不存在")


def create_part(db: Session, data: PartCreate, actor: str):
    validate_location(db, data.location_id)
    p = Part(**data.model_dump())
    db.add(p)
    db.flush()
    if p.quantity:
        db.add(
            Movement(
                part_id=p.id,
                kind="in",
                quantity=p.quantity,
                balance=p.quantity,
                reason="初始库存",
                actor=actor,
            )
        )
    return p


def project_data(p: Project):
    lines = [
        {
            "part_id": l.part_id,
            "quantity": l.quantity,
            "designator": l.designator,
            "part_name": l.part.name,
            "part_sku": l.part.sku,
            "stock": l.part.quantity,
            "required": l.quantity * p.build_quantity,
            "missing": max(0, l.quantity * p.build_quantity - l.part.quantity),
        }
        for l in p.lines
    ]
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "build_quantity": p.build_quantity,
        "lines": lines,
        "ready": bool(lines) and all(l["missing"] == 0 for l in lines),
        "cost": float(
            sum(
                (l.part.unit_price * l.quantity * p.build_quantity for l in p.lines),
                Decimal(0),
            )
        ),
    }


def validate_project(db: Session, data: ProjectInput):
    ids = [line.part_id for line in data.lines]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "同一物料只能添加一行，请合并数量")
    if ids and len(list(db.scalars(select(Part.id).where(Part.id.in_(ids))))) != len(
        ids
    ):
        raise HTTPException(422, "BOM 包含不存在的物料")
