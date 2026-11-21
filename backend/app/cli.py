import argparse
import asyncio
import getpass
import sys
from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import session_factory
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import RegisterRequest
from app.services.auth_service import (
    AuthService,
    ConflictError,
    RoleConfigurationError,
)


class AdminInputError(ValueError):
    pass


def prompt_admin_credentials() -> tuple[str, str]:
    email = input("Admin email: ").strip()
    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm admin password: ")

    if password != confirmation:
        raise AdminInputError("Passwords do not match.")

    try:
        credentials = RegisterRequest(email=email, password=password)
    except ValidationError:
        raise AdminInputError(
            "Enter a valid email and a password between 12 and 128 characters."
        ) from None

    return str(credentials.email), credentials.password


async def create_admin(email: str, password: str) -> None:
    async with session_factory() as session:
        service = AuthService(AuthRepository(session))
        await service.create_admin(email, password)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser(
        "create-admin",
        help="Create a new Admin account using interactive prompts.",
    )
    args = parser.parse_args(argv)

    if args.command != "create-admin":
        parser.error("Unsupported command.")

    try:
        email, password = prompt_admin_credentials()
        asyncio.run(create_admin(email, password))
    except AdminInputError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except ConflictError:
        print(
            "An account with that email already exists; no changes were made.",
            file=sys.stderr,
        )
        return 1
    except RoleConfigurationError:
        print(
            "The Admin role is not configured. Run Alembic migrations first.",
            file=sys.stderr,
        )
        return 1
    except SQLAlchemyError:
        print(
            "The database operation failed. Verify the database "
            "configuration and migrations.",
            file=sys.stderr,
        )
        return 1

    print("Admin account created.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
