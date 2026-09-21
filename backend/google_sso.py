"""Google OpenID Connect exchange and signature verification (server side only)."""

import hmac
import os

import jwt
import requests


GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
google_keys = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", timeout=10)


class GoogleSSOError(Exception):
    pass


def configuration(public_api_url: str) -> dict:
    return {
        "client_id": os.getenv("GOOGLE_SSO_CLIENT_ID", "").strip(),
        "client_secret": os.getenv("GOOGLE_SSO_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.getenv("GOOGLE_SSO_REDIRECT_URI", "").strip()
        or f"{public_api_url.rstrip('/')}/api/auth/google/callback",
        "allowed_domain": os.getenv("GOOGLE_SSO_ALLOWED_DOMAIN", "").strip().lower(),
    }


def verify_id_token(encoded: str, client_id: str, nonce: str) -> dict:
    try:
        key = google_keys.get_signing_key_from_jwt(encoded).key
        claims = jwt.decode(
            encoded, key, algorithms=["RS256"], audience=client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["iss", "sub", "aud", "exp", "iat", "nonce", "email", "email_verified"]},
        )
        if (
            not isinstance(claims["nonce"], str)
            or not hmac.compare_digest(claims["nonce"].encode(), nonce.encode())
            or claims["email_verified"] is not True
            or not isinstance(claims["email"], str)
            or "@" not in claims["email"]
            or not claims["sub"]
            or ("azp" in claims and claims["azp"] != client_id)
        ):
            raise GoogleSSOError("invalid_identity")
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as error:
        raise GoogleSSOError("invalid_identity") from error


def exchange_code(code: str, config: dict, verifier: str, nonce: str) -> dict:
    try:
        response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "grant_type": "authorization_code", "code": code,
                "client_id": config["client_id"], "client_secret": config["client_secret"],
                "redirect_uri": config["redirect_uri"], "code_verifier": verifier,
            },
            timeout=15,
        )
        response.raise_for_status()
        encoded = response.json()["id_token"]
    except (requests.RequestException, ValueError, KeyError, TypeError) as error:
        # Never expose Google's response, authorization code or client secret.
        raise GoogleSSOError("exchange_failed") from error
    return verify_id_token(encoded, config["client_id"], nonce)


def google_controls_email(claims: dict) -> bool:
    # Google is not authoritative for third-party addresses outside Workspace.
    return claims["email"].lower().endswith("@gmail.com") or bool(claims.get("hd"))
