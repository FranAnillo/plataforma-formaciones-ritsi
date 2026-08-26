from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Iterable

import requests


def telegram_link(username: str, token: str) -> str:
    return f"https://t.me/{username.lstrip('@')}?start={token}"


def send_telegram_message(bot_token: str, chat_id: int, text: str) -> dict[str, Any]:
    response = requests.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
        timeout=15,
    )
    if response.status_code == 429:
        retry_after = response.json().get("parameters", {}).get("retry_after", 60)
        raise RuntimeError(f"telegram_rate_limit:{int(retry_after)}")
    if 400 <= response.status_code < 500:
        raise RuntimeError("telegram_permanent_error")
    response.raise_for_status()
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError("telegram_provider_error")
    return payload.get("result", {})


def ics_escape(value: Any) -> str:
    return str(value or "").replace("\\", "\\\\").replace("\r", "").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def _ics_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def render_ics(events: Iterable[dict[str, Any]], public_app_url: str) -> str:
    now = _ics_datetime(datetime.now(timezone.utc))
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RITSI//Plataforma Formativa//ES",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Formacion RITSI",
    ]
    for event in events:
        session_url = f"{public_app_url.rstrip('/')}/dashboard?tab=sessions"
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{ics_escape(event['id'])}@formacion.ritsi.org",
            f"DTSTAMP:{now}",
            f"DTSTART:{_ics_datetime(event['starts_at'])}",
            f"DTEND:{_ics_datetime(event['ends_at'])}",
            f"SUMMARY:{ics_escape(event['title'])}",
            f"DESCRIPTION:{ics_escape((event.get('description') or '') + ' Acceso: ' + session_url)}",
            f"URL:{ics_escape(session_url)}",
            f"STATUS:{'CANCELLED' if event.get('status') == 'cancelled' else 'CONFIRMED'}",
            f"LAST-MODIFIED:{_ics_datetime(event.get('updated_at') or event['starts_at'])}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    folded: list[str] = []
    for line in lines:
        folded.append(line[:73])
        for index in range(73, len(line), 72):
            folded.append(" " + line[index:index + 72])
    # RFC 5545 requires CRLF and continuation whitespace for folded lines.
    return "\r\n".join(folded) + "\r\n"


def google_event_payload(session: dict[str, Any], public_app_url: str) -> dict[str, Any]:
    session_url = f"{public_app_url.rstrip('/')}/dashboard?tab=sessions"
    starts_at = session["starts_at"]
    ends_at = session["ends_at"]
    if starts_at.tzinfo is None or starts_at.utcoffset() is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    if ends_at.tzinfo is None or ends_at.utcoffset() is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    return {
        "summary": session["title"],
        "description": f"{session.get('description') or ''}\n\nAcceso seguro desde la plataforma: {session_url}".strip(),
        "start": {"dateTime": starts_at.astimezone(timezone.utc).isoformat()},
        "end": {"dateTime": ends_at.astimezone(timezone.utc).isoformat()},
        "status": "cancelled" if session.get("status") == "cancelled" else "confirmed",
        "extendedProperties": {"private": {"ritsiSessionId": session["id"]}},
    }


def desired_event_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def google_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def upsert_google_event(calendar_id: str, event_id: str | None, payload: dict[str, Any], access_token: str) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    base = f"https://www.googleapis.com/calendar/v3/calendars/{requests.utils.quote(calendar_id, safe='')}/events"
    if event_id:
        response = requests.patch(f"{base}/{event_id}", headers=headers, json=payload, timeout=20)
        if response.status_code == 404:
            event_id = None
    if not event_id:
        response = requests.post(base, headers=headers, json=payload, timeout=20)
    response.raise_for_status()
    return response.json()
