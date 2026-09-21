import asyncio
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from urllib.parse import parse_qs, urlparse

import jwt
import pytest
import requests
from cryptography.hazmat.primitives.asymmetric import rsa
from pymongo.errors import DuplicateKeyError

import backend.google_sso as sso
import backend.server as server


@pytest.fixture
def config(monkeypatch):
    monkeypatch.setenv("GOOGLE_SSO_CLIENT_ID", "test-client")
    monkeypatch.setenv("GOOGLE_SSO_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("GOOGLE_SSO_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    monkeypatch.setenv("GOOGLE_SSO_ALLOWED_DOMAIN", "")
    return sso.configuration("http://localhost:8000")


@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def identity():
    now = int(datetime.now(timezone.utc).timestamp())
    return {
        "iss": "https://accounts.google.com", "sub": "google-123", "aud": "test-client",
        "iat": now, "exp": now + 3600, "nonce": "expected-nonce",
        "email": "member@ritsi.org", "email_verified": True, "hd": "ritsi.org",
    }


def signed(claims, key):
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


def test_signed_identity_verifies_with_google_key(monkeypatch, identity, signing_key):
    monkeypatch.setattr(sso.google_keys, "get_signing_key_from_jwt", Mock(return_value=SimpleNamespace(key=signing_key.public_key())))
    assert sso.verify_id_token(signed(identity, signing_key), "test-client", "expected-nonce") == identity


@pytest.mark.parametrize("changes", [
    {"iss": "https://attacker.example"}, {"aud": "another-client"},
    {"exp": 1}, {"iat": 9999999999}, {"nonce": "wrong"},
    {"email_verified": False}, {"email_verified": "true"},
    {"azp": "another-client"}, {"sub": ""}, {"email": None},
])
def test_invalid_signed_claims_are_rejected(monkeypatch, identity, signing_key, changes):
    monkeypatch.setattr(sso.google_keys, "get_signing_key_from_jwt", Mock(return_value=SimpleNamespace(key=signing_key.public_key())))
    with pytest.raises(sso.GoogleSSOError):
        sso.verify_id_token(signed({**identity, **changes}, signing_key), "test-client", "expected-nonce")


@pytest.mark.parametrize("missing", ["nonce", "exp", "email_verified", "sub"])
def test_required_claims_cannot_be_omitted(monkeypatch, identity, signing_key, missing):
    monkeypatch.setattr(sso.google_keys, "get_signing_key_from_jwt", Mock(return_value=SimpleNamespace(key=signing_key.public_key())))
    identity.pop(missing)
    with pytest.raises(sso.GoogleSSOError):
        sso.verify_id_token(signed(identity, signing_key), "test-client", "expected-nonce")


def test_forged_signature_and_unsigned_token_are_rejected(monkeypatch, identity, signing_key):
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(sso.google_keys, "get_signing_key_from_jwt", Mock(return_value=SimpleNamespace(key=other_key.public_key())))
    for token in (signed(identity, signing_key), jwt.encode(identity, "", algorithm="none")):
        with pytest.raises(sso.GoogleSSOError):
            sso.verify_id_token(token, "test-client", "expected-nonce")


def test_code_exchange_uses_configured_callback_and_pkce(monkeypatch, config, identity, signing_key):
    response = Mock()
    response.json.return_value = {"id_token": signed(identity, signing_key)}
    post = Mock(return_value=response)
    monkeypatch.setattr(sso.requests, "post", post)
    monkeypatch.setattr(sso.google_keys, "get_signing_key_from_jwt", Mock(return_value=SimpleNamespace(key=signing_key.public_key())))
    assert sso.exchange_code("one-use-code", config, "pkce-verifier", "expected-nonce") == identity
    sent = post.call_args.kwargs["data"]
    assert sent["code_verifier"] == "pkce-verifier"
    assert sent["client_secret"] == "test-secret"
    assert sent["redirect_uri"] == config["redirect_uri"]
    assert post.call_args.kwargs["timeout"] == 15


@pytest.mark.parametrize("failure", [requests.Timeout("secret"), requests.HTTPError("secret"), ValueError("secret"), KeyError("id_token")])
def test_provider_failure_does_not_expose_secrets(monkeypatch, config, failure):
    monkeypatch.setattr(sso.requests, "post", Mock(side_effect=failure))
    with pytest.raises(sso.GoogleSSOError, match="^exchange_failed$"):
        sso.exchange_code("private-code", config, "verifier", "nonce")


@pytest.fixture
def flow(monkeypatch, config, identity):
    user = {"id": "member-1", "email": "member@ritsi.org", "name": "Member", "is_active": True,
            "user_type": "admin", "university_id": "university-1", "password_hash": "private"}
    transaction = {"nonce": "expected-nonce", "verifier": "pkce-verifier"}
    database = SimpleNamespace(
        google_oauth_states=SimpleNamespace(insert_one=AsyncMock(), find_one_and_delete=AsyncMock(return_value=transaction)),
        users=SimpleNamespace(find_one=AsyncMock(side_effect=[None, user]), find_one_and_update=AsyncMock(return_value=user)),
    )
    exchange = Mock(return_value=identity)
    create_session = AsyncMock(return_value="local-session-token")
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(sso, "exchange_code", exchange)
    monkeypatch.setattr(server, "create_session", create_session)
    monkeypatch.setattr(server, "enforce_login_rate_limit", AsyncMock())
    monkeypatch.setattr(server, "COOKIE_SECURE", False)
    monkeypatch.setattr(server, "PUBLIC_APP_URL", "http://localhost:3000")
    request = SimpleNamespace(cookies={server.GOOGLE_STATE_COOKIE: "browser-token"}, client=SimpleNamespace(host="127.0.0.1"))
    return SimpleNamespace(db=database, exchange=exchange, session=create_session, request=request, user=user)


def callback(flow, **kwargs):
    return asyncio.run(server.google_callback(flow.request, **{"state": "state-token", "code": "code", **kwargs}))


def error_code(response):
    return parse_qs(urlparse(response.headers["location"]).query)["google_error"][0]


def test_disabled_provider_does_not_start_flow(monkeypatch, flow):
    monkeypatch.setenv("GOOGLE_SSO_CLIENT_SECRET", "")
    assert asyncio.run(server.auth_providers()) == {"google": False}
    assert error_code(asyncio.run(server.google_login(flow.request))) == "not_configured"
    assert error_code(callback(flow)) == "not_configured"
    flow.db.google_oauth_states.insert_one.assert_not_awaited()
    flow.exchange.assert_not_called()


def test_start_binds_browser_and_uses_nonce_pkce_and_short_expiry(flow, config):
    assert asyncio.run(server.auth_providers()) == {"google": True}
    response = asyncio.run(server.google_login(flow.request))
    url = urlparse(response.headers["location"])
    params = parse_qs(url.query)
    record = flow.db.google_oauth_states.insert_one.await_args.args[0]
    cookie = SimpleCookie(response.headers["set-cookie"])[server.GOOGLE_STATE_COOKIE]
    assert url.netloc == "accounts.google.com"
    assert params["scope"] == ["openid email"]
    assert params["redirect_uri"] == [config["redirect_uri"]]
    assert params["nonce"] == [record["nonce"]]
    assert record["state_hash"] == server.token_digest(params["state"][0])
    assert record["browser_hash"] == server.token_digest(cookie.value)
    assert cookie["httponly"] and cookie["samesite"] == "lax"
    assert cookie["path"] == server.GOOGLE_COOKIE_PATH
    assert cookie["max-age"] == "600"
    assert datetime.now(timezone.utc) < record["expires_at"] <= datetime.now(timezone.utc) + timedelta(minutes=10)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(record["verifier"].encode()).digest()).rstrip(b"=").decode()
    assert params["code_challenge"] == [challenge]
    assert params["code_challenge_method"] == ["S256"]
    assert "test-secret" not in response.headers["location"]
    assert "pkce-verifier" not in response.headers["location"]


@pytest.mark.parametrize("cookies,state", [({}, "state-token"), ({server.GOOGLE_STATE_COOKIE: "browser"}, "")])
def test_callback_requires_browser_cookie_and_state(flow, cookies, state):
    flow.request.cookies = cookies
    assert error_code(callback(flow, state=state)) == "invalid_state"
    flow.db.google_oauth_states.find_one_and_delete.assert_not_awaited()
    flow.exchange.assert_not_called()
    flow.session.assert_not_awaited()


def test_wrong_browser_expired_and_replayed_state_cannot_create_session(flow):
    flow.db.google_oauth_states.find_one_and_delete.return_value = None
    assert error_code(callback(flow)) == "invalid_state"
    query = flow.db.google_oauth_states.find_one_and_delete.await_args.args[0]
    assert query["state_hash"] == server.token_digest("state-token")
    assert query["browser_hash"] == server.token_digest("browser-token")
    assert abs((query["expires_at"]["$gt"] - datetime.now(timezone.utc)).total_seconds()) < 2
    flow.exchange.assert_not_called()
    flow.session.assert_not_awaited()


def test_success_preserves_permissions_and_issues_only_local_session(flow):
    response = callback(flow)
    assert response.status_code == 303
    assert response.headers["location"] == "http://localhost:3000/dashboard"
    user = flow.session.await_args.args[0]
    assert user.user_type == server.UserType.ADMIN and user.university_id == "university-1"
    assert user.id == "member-1"
    query, update = flow.db.users.find_one_and_update.await_args.args
    assert query["is_active"] == {"$ne": False}
    assert update == {"$set": {"google_sub": "google-123"}}
    cookies = response.headers.getlist("set-cookie")
    assert any("session_token=local-session-token" in item and "HttpOnly" in item for item in cookies)
    assert any("Max-Age=0" in item and server.GOOGLE_STATE_COOKIE in item for item in cookies)
    assert response.headers["cache-control"] == "no-store"
    flow.exchange.assert_called_once()


def test_bound_subject_remains_identity_after_google_email_changes(flow, identity):
    identity["email"] = "renamed@ritsi.org"
    flow.db.users.find_one.side_effect = None
    flow.db.users.find_one.return_value = {**flow.user, "google_sub": identity["sub"]}
    assert callback(flow).headers["location"].endswith("/dashboard")
    flow.db.users.find_one.assert_awaited_once_with({"google_sub": identity["sub"]})


@pytest.mark.parametrize("case,expected", [
    ("missing", "account_required"), ("disabled", "account_disabled"),
    ("third_party", "email_not_authoritative"), ("domain", "domain_not_allowed"),
    ("conflict", "account_conflict"), ("race", "account_conflict"),
    ("exchange", "failed"), ("cancelled", "cancelled"),
])
def test_failed_login_never_creates_session(monkeypatch, flow, identity, case, expected):
    kwargs = {}
    if case == "missing":
        flow.db.users.find_one.side_effect = [None, None]
    elif case == "disabled":
        flow.user["is_active"] = False
    elif case == "third_party":
        identity.pop("hd")
    elif case == "domain":
        monkeypatch.setenv("GOOGLE_SSO_ALLOWED_DOMAIN", "other.org")
    elif case == "conflict":
        flow.db.users.find_one_and_update.return_value = None
    elif case == "race":
        flow.db.users.find_one_and_update.side_effect = DuplicateKeyError("duplicate")
    elif case == "exchange":
        flow.exchange.side_effect = sso.GoogleSSOError("invalid_identity")
    elif case == "cancelled":
        kwargs = {"code": "", "error": "access_denied"}
    assert error_code(callback(flow, **kwargs)) == expected
    flow.session.assert_not_awaited()


def test_gmail_can_bind_without_workspace_domain(flow, identity):
    identity.pop("hd")
    identity["email"] = "member@gmail.com"
    assert callback(flow).headers["location"].endswith("/dashboard")


def test_workspace_restriction_uses_hd_not_email_suffix(monkeypatch, flow, identity):
    monkeypatch.setenv("GOOGLE_SSO_ALLOWED_DOMAIN", "ritsi.org")
    identity.pop("hd")
    assert error_code(callback(flow)) == "domain_not_allowed"
    flow.session.assert_not_awaited()


def test_production_sets_secure_session_cookie(monkeypatch, flow):
    monkeypatch.setattr(server, "COOKIE_SECURE", True)
    assert all("Secure" in item for item in callback(flow).headers.getlist("set-cookie"))
