from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Drug Candidates API"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: SecretStr | None = None
    database_host: str = Field(default="127.0.0.1", min_length=1)
    database_port: int = Field(default=5432, ge=1, le=65535)
    database_name: str = Field(default="drug_candidates", min_length=1)
    database_username: str = Field(default="postgres", min_length=1)
    database_password: SecretStr | None = None
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    log_level: str = "INFO"
    jwt_secret_key: str = ""
    jwt_access_lifetime_seconds: int = 900
    jwt_refresh_lifetime_seconds: int = 604800
    auth_cookie_secure: bool = False
    cache_enabled: bool = False
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 60
    redis_socket_timeout_seconds: float = Field(
        default=0.2,
        gt=0,
        le=1.0,
    )

    @model_validator(mode="after")
    def validate_startup_configuration(self) -> "Settings":
        test_environment = self.environment.strip().lower() in {
            "test",
            "testing",
        }
        if not test_environment:
            secret = self.jwt_secret_key.strip()
            if not secret:
                raise ValueError(
                    "JWT_SECRET_KEY must be configured in non-test environments."
                )
            if len(secret) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must contain at least 32 characters "
                    "in non-test environments."
                )

            legacy_url = (
                self.database_url.get_secret_value().strip()
                if self.database_url is not None
                else ""
            )
            database_password = (
                self.database_password.get_secret_value().strip()
                if self.database_password is not None
                else ""
            )
            if not legacy_url and not database_password:
                raise ValueError(
                    "Database configuration is incomplete: set DATABASE_PASSWORD "
                    "or provide DATABASE_URL."
                )
        return self

    @property
    def sqlalchemy_database_url(self) -> URL:
        legacy_url = (
            self.database_url.get_secret_value().strip()
            if self.database_url is not None
            else ""
        )
        if legacy_url:
            parsed_url = make_url(legacy_url)
            return URL.create(
                drivername=parsed_url.drivername,
                username=parsed_url.username,
                password=parsed_url.password,
                host=parsed_url.host,
                port=parsed_url.port,
                database=parsed_url.database,
                query=parsed_url.query,
            )

        database_password = self.database_password
        if database_password is None or not database_password.get_secret_value():
            raise ValueError("Set DATABASE_PASSWORD or provide a DATABASE_URL.")

        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.database_username,
            password=database_password.get_secret_value(),
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
        )

    @property
    def secure_auth_cookies(self) -> bool:
        environment = self.environment.strip().lower()
        return self.auth_cookie_secure or environment not in {
            "development",
            "dev",
            "test",
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
