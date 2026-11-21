import builtins
import getpass

import pytest

import app.cli as cli


def test_create_admin_cli_uses_hidden_password_prompts(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    password = "a-strong-admin-password"
    password_prompts: list[str] = []
    created_credentials: list[tuple[str, str]] = []

    monkeypatch.setattr(
        builtins,
        "input",
        lambda _prompt: "admin@example.com",
    )

    def hidden_password(_prompt: str) -> str:
        password_prompts.append(_prompt)
        return password

    async def create_admin(email: str, received_password: str) -> None:
        created_credentials.append((email, received_password))

    monkeypatch.setattr(getpass, "getpass", hidden_password)
    monkeypatch.setattr(cli, "create_admin", create_admin)

    assert cli.main(["create-admin"]) == 0

    captured = capsys.readouterr()
    assert password_prompts == ["Admin password: ", "Confirm admin password: "]
    assert created_credentials == [("admin@example.com", password)]
    assert captured.out == "Admin account created.\n"
    assert password not in captured.out
    assert password not in captured.err


def test_create_admin_cli_rejects_invalid_email_without_database_access(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(builtins, "input", lambda _prompt: "not-an-email")
    monkeypatch.setattr(
        getpass,
        "getpass",
        lambda _prompt: "a-strong-admin-password",
    )
    monkeypatch.setattr(
        cli,
        "create_admin",
        lambda _email, _password: (_ for _ in ()).throw(
            AssertionError("Invalid input must not access the database.")
        ),
    )

    assert cli.main(["create-admin"]) == 2

    captured = capsys.readouterr()
    assert "valid email" in captured.err
    assert "a-strong-admin-password" not in captured.out + captured.err


def test_create_admin_cli_rejects_mismatched_passwords(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    passwords = iter(("a-strong-admin-password", "a-different-admin-password"))
    monkeypatch.setattr(builtins, "input", lambda _prompt: "admin@example.com")
    monkeypatch.setattr(getpass, "getpass", lambda _prompt: next(passwords))
    monkeypatch.setattr(
        cli,
        "create_admin",
        lambda _email, _password: (_ for _ in ()).throw(
            AssertionError("Mismatched passwords must not access the database.")
        ),
    )

    assert cli.main(["create-admin"]) == 2

    captured = capsys.readouterr()
    assert "Passwords do not match." in captured.err
    assert "a-strong-admin-password" not in captured.out + captured.err
    assert "a-different-admin-password" not in captured.out + captured.err
