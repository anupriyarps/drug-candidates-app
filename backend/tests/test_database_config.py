import pytest
from sqlalchemy.engine import make_url

from app.core.config import Settings


def test_database_url_preserves_reserved_password_characters() -> None:
    passwords = (
        "at@sign",
        "colon:value",
        "slash/value",
        "hash#value",
        "percent%value",
        "space value",
    )

    for password in passwords:
        settings = Settings.model_validate({
            "environment": "test",
            "database_url": "",
            "database_host": "postgres.internal",
            "database_port": 6432,
            "database_name": "candidates",
            "database_username": "drug user",
            "database_password": password,
        })

        url = settings.sqlalchemy_database_url
        parsed_url = make_url(url.render_as_string(hide_password=False))

        assert parsed_url.host == "postgres.internal"
        assert parsed_url.port == 6432
        assert parsed_url.database == "candidates"
        assert parsed_url.username == "drug user"
        assert parsed_url.password == password
        assert password not in repr(settings)


def test_legacy_database_url_remains_supported() -> None:
    settings = Settings.model_validate({
        "environment": "test",
        "database_url": (
            "postgresql+asyncpg://legacy:pw%40ss%3A%2F%23%25%20ok"
            "@legacy-db:5433/legacy_candidates"
        ),
    })

    url = settings.sqlalchemy_database_url

    assert url.host == "legacy-db"
    assert url.port == 5433
    assert url.database == "legacy_candidates"
    assert url.username == "legacy"
    assert url.password == "pw@ss:/#% ok"


def test_database_url_requires_explicit_password_configuration() -> None:
    settings = Settings.model_validate({
        "environment": "test",
        "database_url": "",
        "database_password": "",
    })

    with pytest.raises(ValueError, match="DATABASE_PASSWORD"):
        _ = settings.sqlalchemy_database_url


def test_missing_database_configuration_is_clear_in_development() -> None:
    with pytest.raises(ValueError, match="Database configuration is incomplete"):
        Settings.model_validate({
            "environment": "development",
            "jwt_secret_key": "test-only-signing-secret-with-32-bytes",
            "database_url": "",
            "database_password": "",
        })
