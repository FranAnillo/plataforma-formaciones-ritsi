from datetime import datetime, timedelta, timezone

from backend import server
from tests.helpers import as_doc, assert_http, run


def test_get_current_user_rejects_missing_expired_unknown_and_inactive_sessions(fake_db, users):
    active = users("active", server.UserType.REPRESENTANTE)
    inactive = users("inactive", server.UserType.REPRESENTANTE, is_active=False)
    fake_db.users.docs.extend([as_doc(active), as_doc(inactive)])

    with assert_http(401, "No autorizado"):
        run(server.get_current_user(None))

    with assert_http(401, "Sesión inválida o expirada"):
        run(server.get_current_user("missing"))

    fake_db.user_sessions.docs.append({
        "user_id": active.id,
        "session_token": "expired",
        "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    })
    with assert_http(401, "Sesión inválida o expirada"):
        run(server.get_current_user("expired"))

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    fake_db.user_sessions.docs.extend([
        {"user_id": "ghost", "session_token": "ghost", "expires_at": future},
        {"user_id": inactive.id, "session_token": "inactive", "expires_at": future},
        {"user_id": active.id, "session_token": "active", "expires_at": future},
    ])
    with assert_http(404, "Usuario no encontrado"):
        run(server.get_current_user("ghost"))
    with assert_http(403, "La cuenta de usuario está desactivada"):
        run(server.get_current_user("inactive"))

    assert run(server.get_current_user("active")).id == active.id


def test_google_profile_validation_and_account_linking(fake_db, users):
    with assert_http(401, "Google no devolvió un identificador de usuario válido"):
        run(server.create_local_session_from_google_profile({"email": "a@example.com", "email_verified": True}))
    with assert_http(401, "Google no ha verificado el correo del usuario"):
        run(server.create_local_session_from_google_profile({"sub": "g-1", "email": "a@example.com"}))

    user_doc, token = run(server.create_local_session_from_google_profile({
        "sub": "g-1",
        "email": "new@example.com",
        "email_verified": True,
        "name": "Nueva",
        "picture": "https://example.com/avatar.png",
    }))
    assert user_doc["google_sub"] == "g-1"
    assert token
    assert fake_db.user_sessions.docs[-1]["user_id"] == user_doc["id"]

    legacy = users("legacy", server.UserType.REPRESENTANTE, email="legacy@example.com")
    fake_db.users.docs.append(as_doc(legacy))
    linked, _ = run(server.create_local_session_from_google_profile({
        "sub": "g-legacy",
        "email": legacy.email,
        "email_verified": True,
    }))
    assert linked["id"] == legacy.id
    assert linked["google_sub"] == "g-legacy"

    existing, _ = run(server.create_local_session_from_google_profile({
        "sub": "g-legacy",
        "email": "changed@example.com",
        "email_verified": True,
    }))
    assert existing["id"] == legacy.id


def test_auth_config_dev_login_and_google_login_are_safely_gated(fake_db, monkeypatch):
    monkeypatch.setattr(server, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(server, "GOOGLE_CLIENT_SECRET", "")
    monkeypatch.setattr(server, "GOOGLE_REDIRECT_URI", "")
    monkeypatch.setattr(server, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(server, "COOKIE_SECURE", True)

    config = run(server.get_auth_config())
    assert config == {"google_login_enabled": False, "dev_login_enabled": False}
    with assert_http(500):
        server.ensure_google_oauth_config()
    with assert_http(404, "No encontrado"):
        run(server.start_dev_login())

    monkeypatch.setattr(server, "COOKIE_SECURE", False)
    monkeypatch.setattr(server, "DEV_LOGIN_ROLE", "rol-invalido")
    with assert_http(500, "DEV_LOGIN_ROLE inválido: rol-invalido"):
        run(server.start_dev_login())

    monkeypatch.setattr(server, "DEV_LOGIN_ROLE", "admin")
    response = run(server.start_dev_login())
    assert response.status_code == 303
    assert response.headers["location"] == f"{server.FRONTEND_URL}/"
    assert "session_token=" in response.headers["set-cookie"]

    monkeypatch.setattr(server, "GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr(server, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(server, "GOOGLE_REDIRECT_URI", "http://localhost/callback")
    config = run(server.get_auth_config())
    assert config == {"google_login_enabled": True, "dev_login_enabled": True}
    response = run(server.start_google_login())
    assert response.status_code == 307
    assert "accounts.google.com" in response.headers["location"]
    assert "client_id=client" in response.headers["location"]
    assert f"{server.GOOGLE_OAUTH_STATE_COOKIE}=" in response.headers["set-cookie"]


def test_dev_login_updates_existing_user(fake_db, monkeypatch, users):
    monkeypatch.setattr(server, "ENABLE_DEV_LOGIN", True)
    monkeypatch.setattr(server, "COOKIE_SECURE", False)
    monkeypatch.setattr(server, "DEV_LOGIN_EMAIL", "dev@example.com")
    monkeypatch.setattr(server, "DEV_LOGIN_NAME", "Dev Actualizado")
    monkeypatch.setattr(server, "DEV_LOGIN_ROLE", "admin")
    monkeypatch.setattr(server, "DEV_LOGIN_UNIVERSITY_ID", "dev-local")
    existing = users("dev", server.UserType.REPRESENTANTE, email="dev@example.com", is_active=False)
    fake_db.users.docs.append(as_doc(existing))

    run(server.start_dev_login())
    stored = fake_db.users.docs[0]
    assert stored["name"] == "Dev Actualizado"
    assert stored["user_type"] == "admin"
    assert stored["is_active"] is True


def test_google_callback_handles_all_security_failures_and_success(fake_db, monkeypatch):
    monkeypatch.setattr(server, "GOOGLE_CLIENT_ID", "client")
    monkeypatch.setattr(server, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(server, "GOOGLE_REDIRECT_URI", "http://localhost/callback")

    with assert_http(401, "Google OAuth rechazó el inicio de sesión: access_denied"):
        run(server.finish_google_login(error="access_denied"))
    with assert_http(400, "Estado OAuth inválido"):
        run(server.finish_google_login(code="code", state="a", stored_state="b"))

    class TokenResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self.payload = payload

        def json(self):
            return self.payload

    monkeypatch.setattr(server.requests, "post", lambda *args, **kwargs: TokenResponse(401, {}))
    with assert_http(401, "No se pudo validar la autorización con Google"):
        run(server.finish_google_login(code="code", state="same", stored_state="same"))

    monkeypatch.setattr(server.requests, "post", lambda *args, **kwargs: TokenResponse(200, {}))
    with assert_http(401, "Google no devolvió un token de identidad"):
        run(server.finish_google_login(code="code", state="same", stored_state="same"))

    monkeypatch.setattr(server.requests, "post", lambda *args, **kwargs: TokenResponse(200, {"id_token": "raw"}))
    monkeypatch.setattr(server.id_token, "verify_oauth2_token", lambda *args, **kwargs: (_ for _ in ()).throw(ValueError()))
    with assert_http(401, "Token de Google inválido"):
        run(server.finish_google_login(code="code", state="same", stored_state="same"))

    monkeypatch.setattr(server.id_token, "verify_oauth2_token", lambda *args, **kwargs: {
        "sub": "google-user",
        "email": "google@example.com",
        "email_verified": True,
        "name": "Google User",
    })
    response = run(server.finish_google_login(code="code", state="same", stored_state="same"))
    assert response.status_code == 303
    assert "session_token=" in response.headers["set-cookie"]
    assert fake_db.users.docs[0]["email"] == "google@example.com"


def test_logout_clears_session(fake_db):
    fake_db.user_sessions.docs.append({"session_token": "token", "user_id": "u"})
    response = run(server.logout("token"))
    assert response.body == b'{"success":true}'
    assert fake_db.user_sessions.docs == []


def test_get_me_returns_dependency_user(users):
    user = users("me", server.UserType.ADMIN)
    assert run(server.get_me(user)) == user
