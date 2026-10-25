import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.db import Base, get_db
from app.main import app


@pytest.fixture()
def test_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip(
            "Set TEST_DATABASE_URL to an isolated MySQL database ending in _test"
        )
    parsed = make_url(url)
    if (
        parsed.drivername != "mysql+pymysql"
        or not parsed.database
        or not parsed.database.endswith("_test")
    ):
        pytest.fail(
            "Tests only run on mysql+pymysql databases whose names end in _test"
        )
    engine = create_engine(url, pool_pre_ping=True, pool_size=8, max_overflow=8)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def test_db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    yield engine
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(test_engine):
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={
                "username": settings.admin_username,
                "password": settings.admin_password,
            },
        )
        assert response.status_code == 200
        yield client


@pytest.fixture()
def part(client):
    response = client.post(
        "/api/v1/parts",
        json={
            "sku": "TEST-001",
            "name": "STM32 测试芯片",
            "category": "集成电路",
            "quantity": 10,
            "min_quantity": 5,
            "unit_price": "1.2345",
            "specs": {"主频": "72MHz"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
