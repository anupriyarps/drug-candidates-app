import pytest

from app.core.config import Settings


def test_missing_jwt_secret_is_rejected_outside_test_environment() -> None:
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings.model_validate({
            "environment": "development",
            "jwt_secret_key": "",
            "database_password": "test-database-password",
        })


def test_weak_jwt_secret_is_rejected_outside_test_environment() -> None:
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings.model_validate({
            "environment": "production",
            "jwt_secret_key": "too-short",
            "database_password": "test-database-password",
        })


@pytest.mark.parametrize("environment", ["test", "testing"])
def test_test_environments_allow_test_configuration(environment: str) -> None:
    settings = Settings.model_validate({
        "environment": environment,
        "jwt_secret_key": "",
        "database_password": "",
    })

    assert settings.environment == environment
