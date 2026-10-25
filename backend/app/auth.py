import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import ApiKey, now

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass
class Identity:
    name: str
    scope: str
    admin: bool = False


def create_session():
    return jwt.encode(
        {
            "sub": settings.admin_username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        },
        settings.secret_key,
        algorithm="HS256",
    )


def identity(
    request: Request,
    token: str | None = Depends(api_key_header),
    db: Session = Depends(get_db),
):
    if token:
        key = db.scalar(
            select(ApiKey).where(
                ApiKey.token_hash == hashlib.sha256(token.encode()).hexdigest(),
                ApiKey.revoked.is_(False),
            )
        )
        if not key:
            raise HTTPException(401, "API 密钥无效或已撤销")
        key.last_used_at = now()
        db.commit()
        return Identity(name=f"agent:{key.name}", scope=key.scope)
    cookie = request.cookies.get("partsbox_session")
    if cookie:
        try:
            payload = jwt.decode(
                cookie,
                settings.secret_key,
                algorithms=["HS256"],
                options={"require": ["sub", "exp"]},
            )
            if payload["sub"] == settings.admin_username:
                if request.method not in ("GET", "HEAD", "OPTIONS"):
                    origin = request.headers.get("origin")
                    allowed = {
                        str(request.base_url).rstrip("/"),
                        *settings.trusted_origins,
                    }
                    if origin and origin not in allowed:
                        raise HTTPException(403, "请求来源不被允许")
                return Identity(name=payload["sub"], scope="write", admin=True)
        except jwt.PyJWTError:
            pass
    raise HTTPException(401, "请先登录")


def writer(user: Identity = Depends(identity)):
    if user.scope != "write":
        raise HTTPException(403, "此密钥只有读取权限")
    return user


def administrator(user: Identity = Depends(identity)):
    if not user.admin:
        raise HTTPException(403, "此操作仅限管理员")
    return user


def check_password(username: str, password: str):
    # Fixed-length comparison also works for non-ASCII usernames and passwords.
    return secrets.compare_digest(
        hashlib.sha256(username.encode()).digest(),
        hashlib.sha256(settings.admin_username.encode()).digest(),
    ) and secrets.compare_digest(
        hashlib.sha256(password.encode()).digest(),
        hashlib.sha256(settings.admin_password.encode()).digest(),
    )
