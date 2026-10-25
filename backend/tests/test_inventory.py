from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.main import app
from app.models import ApiKey, Movement, Part


def test_authentication_and_csrf(client):
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/v1/parts").status_code == 401
        assert (
            anonymous.post(
                "/api/auth/login", json={"username": "admin", "password": "incorrect"}
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/v1/parts",
            json={"sku": "X", "name": "X", "category": "电阻"},
            headers={"Origin": "https://untrusted.example"},
        ).status_code
        == 403
    )
    assert client.get("/openapi.json").status_code == 200


def test_part_search_filters_and_money(client, part):
    result = client.get("/api/v1/parts", params={"q": "72MHz"}).json()
    assert result["total"] == 1
    assert result["items"][0]["unit_price"] == "1.2345"
    assert client.get("/api/v1/parts", params={"q": "%"}).json()["total"] == 0
    assert client.get("/api/v1/parts", params={"category": "电阻"}).json()["total"] == 0
    assert client.get("/api/v1/parts", params={"page_size": 1000}).status_code == 422
    assert client.get("/api/v1/summary").json()["total_value"] == 12.345
    body = {
        k: v
        for k, v in part.items()
        if k not in ("id", "location", "created_at", "updated_at", "is_demo")
    }
    body["quantity"] = 999  # Never permit changing stock by editing metadata.
    body["name"] = "更新后的型号"
    assert client.put(f"/api/v1/parts/{part['id']}", json=body).json()["quantity"] == 10


def test_stock_is_atomic_and_idempotent(client, part, test_engine):
    url = f"/api/v1/parts/{part['id']}/stock"
    payload = {"kind": "out", "quantity": 7, "reason": "项目领料"}
    headers = {"Idempotency-Key": "unique-business-operation"}
    first = client.post(url, json=payload, headers=headers)
    assert first.status_code == 200
    second = client.post(url, json=payload, headers=headers)
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert client.get(f"/api/v1/parts/{part['id']}").json()["quantity"] == 3
    assert (
        client.post(url, json={**payload, "quantity": 8}, headers=headers).status_code
        == 409
    )
    assert client.post(url, json={**payload, "quantity": 4}).status_code == 409
    assert client.post(url, json={**payload, "quantity": -1}).status_code == 422
    with Session(test_engine) as db:
        assert (
            db.scalar(select(func.count(Movement.id))) == 2
        )  # Initial inventory + one successful withdrawal.
        assert db.scalar(select(Part.quantity)) == 3
    assert client.get("/api/v1/summary").json()["low_stock"] == 1


def test_concurrent_withdrawals_cannot_overdraw(client, part):
    token = client.post(
        "/api/v1/keys", json={"name": "concurrency", "scope": "write"}
    ).json()["token"]

    def withdraw(_):
        with TestClient(app) as agent:
            return agent.post(
                f"/api/v1/parts/{part['id']}/stock",
                json={"kind": "out", "quantity": 7, "reason": "并发领料"},
                headers={"X-API-Key": token},
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(withdraw, range(2)))
    assert sorted(outcomes) == [200, 409]
    assert client.get(f"/api/v1/parts/{part['id']}").json()["quantity"] == 3


def test_concurrent_retries_apply_once(client, part):
    token = client.post(
        "/api/v1/keys", json={"name": "retry", "scope": "write"}
    ).json()["token"]

    def retry(_):
        with TestClient(app) as agent:
            response = agent.post(
                f"/api/v1/parts/{part['id']}/stock",
                json={"kind": "out", "quantity": 2, "reason": "幂等并发"},
                headers={"X-API-Key": token, "Idempotency-Key": "retry-same-operation"},
            )
            assert response.status_code == 200, response.text
            return response.json()["id"]

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(retry, range(4)))
    assert len(set(results)) == 1
    assert client.get(f"/api/v1/parts/{part['id']}").json()["quantity"] == 8


def test_readonly_keys_revocation_and_digest(client, part, test_engine):
    key = client.post("/api/v1/keys", json={"name": "只读助手", "scope": "read"}).json()
    with TestClient(app) as agent:
        agent.headers["X-API-Key"] = key["token"]
        assert agent.get("/api/v1/parts").status_code == 200
        assert agent.get("/api/v1/keys").status_code == 403
        assert agent.get("/api/v1/backup").status_code == 403
        assert (
            agent.post(
                f"/api/v1/parts/{part['id']}/stock",
                json={"kind": "in", "quantity": 1, "reason": "禁止写入"},
            ).status_code
            == 403
        )
        assert client.delete(f"/api/v1/keys/{key['id']}").status_code == 204
        assert agent.get("/api/v1/parts").status_code == 401
    with Session(test_engine) as db:
        stored = db.get(ApiKey, key["id"])
        assert stored.token_hash != key["token"] and len(stored.token_hash) == 64
        assert stored.last_used_at is not None


def test_csv_import_all_or_nothing(client, part):
    csv = "sku,name,category,quantity,unit_price\nNEW-001,新电阻,电阻,20,0.012\nTEST-001,重复编号,电容,5,0.1\n"
    failed = client.post(
        "/api/v1/parts/import",
        files={"file": ("parts.csv", csv.encode("utf-8-sig"), "text/csv")},
    )
    assert failed.status_code == 422
    assert client.get("/api/v1/parts").json()["total"] == 1
    valid = "sku,name,category,quantity,unit_price\nNEW-001,新电阻,电阻,20,0.012\nNEW-002,新电容,电容,5,0.1\n"
    assert (
        client.post(
            "/api/v1/parts/import",
            files={"file": ("parts.csv", valid.encode("utf-8-sig"), "text/csv")},
        ).json()["imported"]
        == 2
    )
    assert client.get("/api/v1/parts").json()["total"] == 3
    assert client.get("/api/v1/movements").json()["total"] == 3


def test_product_type_csv_roundtrip(client):
    import csv
    import io

    content = "sku,name,category,product_type,quantity,unit_price\nCRYSTAL-001,16MHz 晶振,其他,无源晶振,5,0.5138\n"
    response = client.post(
        "/api/v1/parts/import",
        files={"file": ("parts.csv", content.encode("utf-8-sig"), "text/csv")},
    )
    assert response.status_code == 200, response.text
    result = client.get("/api/v1/parts", params={"q": "无源晶振"}).json()
    assert result["total"] == 1
    assert result["items"][0]["specs"]["商品类型"] == "无源晶振"
    assert result["items"][0]["quantity"] == 5
    exported = client.get("/api/v1/parts/export").text.lstrip("\ufeff")
    rows = list(csv.DictReader(io.StringIO(exported)))
    assert rows[0]["product_type"] == "无源晶振"
    assert rows[0]["sku"] == "CRYSTAL-001"


def test_location_and_history_cannot_be_accidentally_deleted(client, part):
    location = client.post(
        "/api/v1/locations", json={"code": "A-01", "name": "收纳盒", "capacity": 20}
    ).json()
    part["location_id"] = location["id"]
    assert client.put(f"/api/v1/parts/{part['id']}", json=part).status_code == 200
    assert client.delete(f"/api/v1/locations/{location['id']}").status_code == 409
    assert client.delete(f"/api/v1/parts/{part['id']}").status_code == 409
    assert client.get("/api/v1/locations").json()[0]["quantity"] == 10


def test_bom_shortage_math_and_duplicate_lines(client, part):
    line = {"part_id": part["id"], "quantity": 3, "designator": "U1,U2,U3"}
    data = {"name": "温控器", "build_quantity": 4, "lines": [line]}
    result = client.post("/api/v1/projects", json=data)
    assert result.status_code == 201
    project = result.json()
    assert project["lines"][0]["required"] == 12
    assert project["lines"][0]["missing"] == 2
    assert project["ready"] is False
    assert client.get(f"/api/v1/parts/{part['id']}").json()["quantity"] == 10
    assert (
        client.post(
            "/api/v1/projects", json={**data, "lines": [line, line]}
        ).status_code
        == 422
    )
    assert client.delete(f"/api/v1/projects/{project['id']}").status_code == 204


def test_export_excludes_credentials_and_escapes_formulas(client):
    client.post(
        "/api/v1/parts",
        json={"sku": "FORMULA", "name": "=HYPERLINK(test)", "category": "其他"},
    )
    export = client.get("/api/v1/parts/export")
    assert "'=HYPERLINK(test)" in export.text
    backup = client.get("/api/v1/backup").json()
    assert backup["format"] == "partsbox-export-v1"
    assert "api_keys" not in backup and "token_hash" not in str(backup)


def test_demo_lifecycle_and_real_activity_protection(client):
    assert client.post("/api/v1/demo").status_code == 200
    assert client.get("/api/v1/parts").json()["total"] == 24
    summary = client.get("/api/v1/summary").json()
    assert summary["low_stock"] == 3
    assert summary["demo_parts"] == 24
    assert summary["out_of_stock"] == 1
    assert client.post("/api/v1/demo").status_code == 409
    assert client.delete("/api/v1/demo").json()["deleted"] == 24
    assert client.get("/api/v1/locations").json() == []
    assert client.post("/api/v1/demo").status_code == 200
    part = client.get("/api/v1/parts").json()["items"][0]
    assert (
        client.post(
            f"/api/v1/parts/{part['id']}/stock",
            json={"kind": "in", "quantity": 1, "reason": "真实采购"},
        ).status_code
        == 200
    )
    assert client.delete("/api/v1/demo").status_code == 409
    assert client.get("/api/v1/parts").json()["total"] == 24
