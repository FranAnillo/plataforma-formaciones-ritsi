from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

try:
    from .integrations import (
        desired_event_hash, google_access_token, google_event_payload,
        send_telegram_message, upsert_google_event,
    )
except ImportError:
    from integrations import (
        desired_event_hash, google_access_token, google_event_payload,
        send_telegram_message, upsert_google_event,
    )

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("ritsi.worker")
client = AsyncIOMotorClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.getenv("DB_NAME", "plataforma_formativa_ritsi")]
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "http://localhost:3000")


def stored_utc_datetime(value: datetime) -> datetime:
    """Motor decodes BSON datetimes as naive values even though BSON stores UTC."""
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def notification_preference_key(event_type: str) -> str:
    if event_type == "TrainingAssigned":
        return "assignment_notifications"
    if event_type in {"TrainingStarted", "TrainingCompleted"}:
        return "progress_notifications"
    return "session_notifications"


def notification_action_url(event: dict) -> str:
    payload = event.get("payload", {})
    if event.get("event_type", "").startswith("Session"):
        return "/dashboard?tab=sessions"
    if payload.get("content_id"):
        return f"/content/{payload['content_id']}"
    return "/dashboard?tab=my-learning"


def session_day_reminders(
    starts_at: datetime, timezone_name: str, now: datetime,
) -> list[tuple[datetime, str, str, str]]:
    """Return tomorrow/today reminders at useful local times, never after start."""
    starts_utc = stored_utc_datetime(starts_at)
    now_utc = stored_utc_datetime(now)
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        zone = timezone.utc
    local_start = starts_utc.astimezone(zone)
    local_now = now_utc.astimezone(zone)
    if local_now >= local_start:
        return []

    previous_date = local_start.date() - timedelta(days=1)
    tomorrow_due = datetime.combine(previous_date, time(hour=9), tzinfo=zone)
    today_due = datetime.combine(local_start.date(), time(hour=8), tzinfo=zone)
    if today_due >= local_start:
        today_due = max(
            datetime.combine(local_start.date(), time.min, tzinfo=zone),
            local_start - timedelta(hours=1),
        )

    reminders: list[tuple[datetime, str, str, str]] = []
    if local_now.date() <= previous_date:
        due = max(tomorrow_due.astimezone(timezone.utc), now_utc)
        reminders.append((due, "Mañana tienes una sesión", "Consulta el horario y prepara el acceso desde la plataforma.", "tomorrow"))
    due = max(today_due.astimezone(timezone.utc), now_utc)
    reminders.append((due, "Hoy tienes una sesión", "Revisa el horario. El acceso estará disponible desde la plataforma.", "today"))
    return reminders


async def notification_recipients(event: dict) -> list[str]:
    payload = event.get("payload", {})
    if payload.get("user_ids"):
        return list(dict.fromkeys(payload["user_ids"]))
    if payload.get("all_representatives"):
        users = await db.users.find({"is_active": True, "user_type": "representante"}, {"id": 1}).to_list(10000)
        return [item["id"] for item in users]
    session = await db.synchronous_sessions.find_one({"id": payload.get("session_id")})
    if not session:
        return []
    if session.get("participant_user_ids"):
        return session["participant_user_ids"]
    enrollments = await db.enrollments.find({"content_id": session["content_id"], "status": {"$ne": "cancelled"}}, {"user_id": 1}).to_list(10000)
    return [item["user_id"] for item in enrollments]


async def create_notification(event: dict, user_id: str, title: str, body: str, scheduled_at: datetime, suffix: str) -> None:
    preference = await db.notification_preferences.find_one({"user_id": user_id}) or {}
    event_enabled = preference.get(notification_preference_key(event["event_type"]), True)
    in_app_visible = preference.get("in_app_enabled", True) and event_enabled
    telegram_enabled = preference.get("telegram_enabled", True) and event_enabled
    if not in_app_visible and not telegram_enabled:
        return
    dedupe_key = f"{event['id']}:{user_id}:{suffix}"
    await db.notifications.update_one(
        {"dedupe_key": dedupe_key},
        {"$setOnInsert": {
            "id": dedupe_key, "dedupe_key": dedupe_key, "user_id": user_id,
            "aggregate_id": event.get("aggregate_id"),
            "type": event["event_type"], "title": title, "body": body,
            "action_url": notification_action_url(event),
            "in_app_visible": in_app_visible,
            "status": "scheduled" if scheduled_at > datetime.now(timezone.utc) else "pending",
            "scheduled_at": scheduled_at, "created_at": datetime.now(timezone.utc), "read_at": None,
            "telegram_status": "pending", "telegram_attempts": 0,
        }}, upsert=True,
    )
    if telegram_enabled:
        await db.notification_deliveries.update_one(
            {"dedupe_key": f"{dedupe_key}:telegram"},
            {"$setOnInsert": {
                "id": f"{dedupe_key}:telegram", "dedupe_key": f"{dedupe_key}:telegram",
                "notification_id": dedupe_key, "user_id": user_id, "channel": "telegram",
                "status": "pending", "attempts": 0, "next_attempt_at": scheduled_at,
                "created_at": datetime.now(timezone.utc),
            }}, upsert=True,
        )


async def sync_google_calendar(session_id: str) -> None:
    config = [os.getenv(name) for name in ("GOOGLE_CALENDAR_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN")]
    if not all(config):
        return
    session = await db.synchronous_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return
    session["starts_at"] = stored_utc_datetime(session["starts_at"])
    session["ends_at"] = stored_utc_datetime(session["ends_at"])
    calendar_id, client_id, client_secret, refresh_token = config
    payload = google_event_payload(session, PUBLIC_APP_URL)
    desired_hash = desired_event_hash(payload)
    link = await db.calendar_event_links.find_one({"session_id": session_id, "calendar_id": calendar_id})
    if session.get("status") == "cancelled" and not link:
        await db.calendar_event_links.update_one(
            {"session_id": session_id, "calendar_id": calendar_id},
            {"$set": {"desired_hash": desired_hash, "status": "cancelled", "updated_at": datetime.now(timezone.utc)}}, upsert=True,
        )
        return
    if link and link.get("desired_hash") == desired_hash and link.get("status") == "synced":
        return
    token = await asyncio.to_thread(google_access_token, client_id, client_secret, refresh_token)
    result = await asyncio.to_thread(upsert_google_event, calendar_id, link.get("event_id") if link else None, payload, token)
    await db.calendar_event_links.update_one(
        {"session_id": session_id, "calendar_id": calendar_id},
        {"$set": {"event_id": result["id"], "etag": result.get("etag"), "desired_hash": desired_hash,
                  "status": "synced", "last_error": None, "updated_at": datetime.now(timezone.utc)}}, upsert=True,
    )


async def process_event(event: dict) -> None:
    recipients = await notification_recipients(event)
    payload = event.get("payload", {})
    event_type = event["event_type"]
    now = datetime.now(timezone.utc)
    if event_type == "TrainingAssigned":
        title, body = "Nueva formación asignada", payload.get("content_title", "Tienes una nueva formación disponible.")
        for user_id in recipients:
            await create_notification(event, user_id, title, body, now, "assigned")
    elif event_type in {"TrainingStarted", "TrainingCompleted"}:
        content_title = payload.get("content_title", "la formación")
        if event_type == "TrainingStarted":
            title = "Formación en proceso"
            body = f"Has comenzado «{content_title}». Puedes continuar desde donde lo dejaste."
            suffix = "started"
        else:
            title = "Formación finalizada"
            body = f"Has completado «{content_title}». Ya puedes consultar tus logros y certificado."
            suffix = "completed"
        for user_id in recipients:
            await create_notification(event, user_id, title, body, now, suffix)
    elif event_type in {"SessionScheduled", "SessionRescheduled", "SessionCancelled", "SessionUpdated", "SessionParticipantsUpdated"}:
        if event_type in {"SessionRescheduled", "SessionCancelled", "SessionParticipantsUpdated"}:
            await db.notifications.update_many(
                {"aggregate_id": payload.get("session_id"), "status": "scheduled"},
                {"$set": {"status": "cancelled", "cancelled_at": now}},
            )
        labels = {
            "SessionScheduled": ("Nueva sesión programada", "Consulta la fecha y accede desde la plataforma."),
            "SessionRescheduled": ("Sesión reprogramada", "Se ha actualizado la fecha de una sesión."),
            "SessionCancelled": ("Sesión cancelada", "La sesión ha sido cancelada."),
            "SessionUpdated": ("Sesión actualizada", "Se han actualizado los datos de una sesión."),
            "SessionParticipantsUpdated": ("Convocatoria de sesión actualizada", "Consulta los datos y recordatorios de la sesión."),
        }
        title, body = labels[event_type]
        for user_id in recipients:
            if event_type != "SessionUpdated":
                await create_notification(event, user_id, title, body, now, "change")
                starts_at = payload.get("starts_at")
                if event_type != "SessionCancelled" and isinstance(starts_at, datetime):
                    for due, reminder_title, reminder_body, suffix in session_day_reminders(
                        starts_at, payload.get("timezone", "Europe/Madrid"), now,
                    ):
                        await create_notification(event, user_id, reminder_title, reminder_body, due, suffix)
        await sync_google_calendar(payload["session_id"])


async def claim_event() -> dict | None:
    now = datetime.now(timezone.utc)
    return await db.outbox_events.find_one_and_update(
        {"available_at": {"$lte": now}, "$or": [{"status": "pending"}, {"status": "processing", "locked_at": {"$lt": now - timedelta(minutes=10)}}]},
        {"$set": {"status": "processing", "locked_at": now}, "$inc": {"attempts": 1}},
        sort=[("occurred_at", 1)], return_document=ReturnDocument.AFTER,
    )


async def process_outbox_once() -> bool:
    event = await claim_event()
    if not event:
        return False
    try:
        await process_event(event)
        await db.outbox_events.update_one({"_id": event["_id"]}, {"$set": {"status": "processed", "processed_at": datetime.now(timezone.utc), "last_error": None}})
    except Exception as error:
        delay = min(3600, 2 ** min(event.get("attempts", 1), 10))
        status = "failed" if event.get("attempts", 1) >= 10 else "pending"
        await db.outbox_events.update_one({"_id": event["_id"]}, {"$set": {"status": status, "available_at": datetime.now(timezone.utc) + timedelta(seconds=delay), "last_error": type(error).__name__}})
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID")
        session_id = event.get("payload", {}).get("session_id")
        if calendar_id and session_id and event.get("event_type", "").startswith("Session"):
            await db.calendar_event_links.update_one(
                {"session_id": session_id, "calendar_id": calendar_id},
                {"$set": {"status": "failed", "last_error": type(error).__name__, "updated_at": datetime.now(timezone.utc)}}, upsert=True,
            )
        logger.exception("Fallo procesando evento %s", event.get("id"))
    return True


async def deliver_notifications_once() -> int:
    now = datetime.now(timezone.utc)
    notifications = await db.notifications.find({"scheduled_at": {"$lte": now}, "status": {"$in": ["scheduled", "pending"]}}).limit(50).to_list(50)
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    delivered = 0
    for item in notifications:
        await db.notifications.update_one({"_id": item["_id"]}, {"$set": {"status": "sent"}})
        preference = await db.notification_preferences.find_one({"user_id": item["user_id"]}) or {}
        binding = await db.telegram_bindings.find_one({"user_id": item["user_id"], "active": True})
        event_enabled = preference.get(notification_preference_key(item["type"]), True)
        if not bot_token or not binding or preference.get("telegram_enabled", True) is False or not event_enabled:
            reason = "channel_not_configured" if not bot_token else "account_not_linked" if not binding else "disabled_by_user"
            await db.notification_deliveries.update_one(
                {"notification_id": item["id"], "channel": "telegram", "status": "pending"},
                {"$set": {"status": "skipped", "last_error": reason, "updated_at": now}},
            )
            continue
        try:
            text = f"{item['title']}\n{item['body']}\n{PUBLIC_APP_URL.rstrip('/')}{item['action_url']}"
            result = await asyncio.to_thread(send_telegram_message, bot_token, int(binding["chat_id"]), text)
            await db.notifications.update_one({"_id": item["_id"]}, {"$set": {"telegram_status": "sent", "telegram_provider_message_id": str(result.get("message_id", ""))}})
            await db.notification_deliveries.update_one(
                {"notification_id": item["id"], "channel": "telegram"},
                {"$set": {"status": "sent", "provider_message_id": str(result.get("message_id", "")), "sent_at": now, "last_error": None}, "$inc": {"attempts": 1}},
            )
            delivered += 1
        except Exception as error:
            attempts = item.get("telegram_attempts", 0) + 1
            if str(error) == "telegram_permanent_error":
                await db.telegram_bindings.update_one({"_id": binding["_id"]}, {"$set": {"active": False, "unlinked_at": now, "disabled_reason": "provider_rejected"}})
                await db.notifications.update_one({"_id": item["_id"]}, {"$set": {"status": "sent", "telegram_status": "abandoned", "telegram_last_error": "provider_rejected"}, "$inc": {"telegram_attempts": 1}})
                await db.notification_deliveries.update_one(
                    {"notification_id": item["id"], "channel": "telegram"},
                    {"$set": {"status": "abandoned", "last_error": "provider_rejected", "updated_at": now}, "$inc": {"attempts": 1}},
                )
                continue
            retry_after = 60
            if str(error).startswith("telegram_rate_limit:"):
                retry_after = int(str(error).split(":", 1)[1])
            await db.notifications.update_one({"_id": item["_id"]}, {"$set": {"telegram_status": "failed", "telegram_last_error": type(error).__name__, "status": "pending", "scheduled_at": now + timedelta(seconds=retry_after)}, "$inc": {"telegram_attempts": 1}})
            await db.notification_deliveries.update_one(
                {"notification_id": item["id"], "channel": "telegram"},
                {"$set": {"status": "failed", "last_error": type(error).__name__, "next_attempt_at": now + timedelta(seconds=retry_after), "updated_at": now}, "$inc": {"attempts": 1}},
            )
            if attempts >= 8:
                await db.notifications.update_one({"_id": item["_id"]}, {"$set": {"status": "sent", "telegram_status": "abandoned"}})
                await db.notification_deliveries.update_one({"notification_id": item["id"], "channel": "telegram"}, {"$set": {"status": "abandoned", "updated_at": now}})
    return delivered


async def reconcile_session_states_once() -> int:
    """Persists time-derived states and emits idempotent lifecycle events."""
    now = datetime.now(timezone.utc)
    transitions = [
        ({"status": "scheduled", "starts_at": {"$lte": now}, "ends_at": {"$gt": now}}, "live", "SessionStarted"),
        ({"status": {"$in": ["scheduled", "live"]}, "ends_at": {"$lte": now}}, "ended", "SessionEnded"),
    ]
    changed = 0
    for query, next_status, event_type in transitions:
        sessions = await db.synchronous_sessions.find(query, {"id": 1, "starts_at": 1}).limit(100).to_list(100)
        for session in sessions:
            result = await db.synchronous_sessions.update_one({"id": session["id"], **query}, {"$set": {"status": next_status, "updated_at": now}})
            if not result.modified_count:
                continue
            await db.outbox_events.update_one(
                {"dedupe_key": f"session:{session['id']}:{next_status}"},
                {"$setOnInsert": {"id": f"session-{session['id']}-{next_status}", "event_type": event_type, "aggregate_type": "SynchronousSession", "aggregate_id": session["id"], "payload": {"session_id": session["id"], "starts_at": session["starts_at"]}, "dedupe_key": f"session:{session['id']}:{next_status}", "status": "pending", "attempts": 0, "occurred_at": now, "available_at": now}}, upsert=True,
            )
            changed += 1
    return changed


async def run() -> None:
    logger.info("Worker de notificaciones iniciado")
    next_reconciliation = datetime.now(timezone.utc)
    while True:
        worked = await process_outbox_once()
        await deliver_notifications_once()
        now = datetime.now(timezone.utc)
        if now >= next_reconciliation:
            await reconcile_session_states_once()
            next_reconciliation = now + timedelta(seconds=30)
        if not worked:
            await asyncio.sleep(float(os.getenv("WORKER_POLL_SECONDS", "2")))


if __name__ == "__main__":
    try:
        asyncio.run(run())
    finally:
        client.close()
