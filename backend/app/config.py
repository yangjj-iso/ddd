from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    admin_username: str = "admin"
    admin_password: str
    cookie_secure: bool = False
    trusted_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).resolve().parents[2] / ".env"), ".env"),
        extra="ignore",
    )


settings = Settings()
if len(settings.secret_key) < 32 or len(settings.admin_password) < 10:
    raise RuntimeError(
        "SECRET_KEY must have at least 32 characters; ADMIN_PASSWORD at least 10."
    )
if not settings.database_url.startswith("mysql+pymysql://"):
    raise RuntimeError("PartsBox requires MySQL via mysql+pymysql://.")
