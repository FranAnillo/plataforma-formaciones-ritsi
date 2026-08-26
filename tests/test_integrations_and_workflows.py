import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import backend.integrations as integrations
import backend.server as server
import backend.worker as worker


def actor(role=server.UserType.REPRESENTANTE, user_id="user-1"):
    return server.User(id=user_id, email=f"{user_id}@ritsi.org", name="Test", user_type=role)


def session_record():
    start = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    return {
        "id": "session-1", "content_id": "content-1", "title": "Sesion segura",
        "description": "Taller", "starts_at": start, "ends_at": start + timedelta(hours=1),
        "status": "scheduled", "updated_at": start,
    }


def test_calendar_exports_platform_access_but_never_private_meeting_url():
    session = {**session_record(), "meeting_url": "https://meet.google.com/private", "meeting_url_ciphertext": "secret"}
    calendar = integrations.render_ics([session], "https://formacion.ritsi.org")

    assert "BEGIN:VEVENT" in calendar
    assert "https://formacion.ritsi.org/dashboard?tab=sessions" in calendar
    assert "meet.google.com" not in calendar
    assert "secret" not in calendar
    assert "\r\n" in calendar


def test_google_calendar_payload_is_deterministic_and_contains_no_meeting_url():
    session = {**session_record(), "meeting_url": "https://meet.google.com/private"}
    payload = integrations.google_event_payload(session, "https://formacion.ritsi.org")

    assert payload["extendedProperties"]["private"]["ritsiSessionId"] == "session-1"
    assert "meet.google.com" not in str(payload)
    assert integrations.desired_event_hash(payload) == integrations.desired_event_hash(payload)


def test_google_calendar_treats_naive_bson_dates_as_utc():
    session = session_record()
    session["starts_at"] = session["starts_at"].replace(tzinfo=None)
    session["ends_at"] = session["ends_at"].replace(tzinfo=None)

    payload = integrations.google_event_payload(session, "https://formacion.ritsi.org")

    assert payload["start"]["dateTime"].endswith("+00:00")
    assert payload["end"]["dateTime"].endswith("+00:00")


def test_telegram_link_uses_one_time_token_without_using_username_as_identity():
    assert integrations.telegram_link("@ritsi_bot", "opaque-token") == "https://t.me/ritsi_bot?start=opaque-token"


def test_outbox_enqueue_is_idempotent_by_dedupe_key(monkeypatch):
    update = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(outbox_events=SimpleNamespace(update_one=update)))

    asyncio.run(server.enqueue_event("TrainingAssigned", "Assignment", "a-1", {"user_ids": ["u-1"]}, "assignment:a-1"))

    query, operation = update.await_args.args
    assert query == {"dedupe_key": "assignment:a-1"}
    assert operation["$setOnInsert"]["status"] == "pending"
    assert operation["$setOnInsert"]["payload"] == {"user_ids": ["u-1"]}
    assert update.await_args.kwargs["upsert"] is True


def test_notification_preferences_route_each_domain_event_to_its_channel_setting():
    assert worker.notification_preference_key("TrainingAssigned") == "assignment_notifications"
    assert worker.notification_preference_key("TrainingStarted") == "progress_notifications"
    assert worker.notification_preference_key("TrainingCompleted") == "progress_notifications"
    assert worker.notification_preference_key("SessionScheduled") == "session_notifications"


def test_existing_notification_preferences_receive_new_progress_default(monkeypatch):
    monkeypatch.setattr(server, "db", SimpleNamespace(
        notification_preferences=SimpleNamespace(find_one=AsyncMock(return_value={
            "user_id": "user-1", "assignment_notifications": False,
        })),
    ))

    preferences = asyncio.run(server.get_notification_preferences(actor()))

    assert preferences["assignment_notifications"] is False
    assert preferences["progress_notifications"] is True
    assert preferences["session_notifications"] is True


def test_session_reminders_are_scheduled_for_tomorrow_and_today_in_local_timezone():
    starts_at = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    now = datetime(2026, 8, 31, 10, 0, tzinfo=timezone.utc)

    reminders = worker.session_day_reminders(starts_at, "Europe/Madrid", now)

    assert [(item[0], item[1], item[3]) for item in reminders] == [
        (datetime(2026, 9, 1, 7, 0, tzinfo=timezone.utc), "Mañana tienes una sesión", "tomorrow"),
        (datetime(2026, 9, 2, 6, 0, tzinfo=timezone.utc), "Hoy tienes una sesión", "today"),
    ]


def test_session_created_on_same_day_sends_only_the_today_reminder_immediately():
    starts_at = datetime(2026, 9, 2, 10, 0, tzinfo=timezone.utc)
    now = datetime(2026, 9, 2, 7, 0, tzinfo=timezone.utc)

    reminders = worker.session_day_reminders(starts_at, "Europe/Madrid", now)

    assert len(reminders) == 1
    assert reminders[0][0] == now
    assert reminders[0][1] == "Hoy tienes una sesión"


@pytest.mark.parametrize(
    ("previous_status", "completed", "event_type"),
    [
        (server.EnrollmentStatus.ASSIGNED.value, False, "TrainingStarted"),
        (server.EnrollmentStatus.IN_PROGRESS.value, True, "TrainingCompleted"),
    ],
)
def test_progress_transition_emits_one_domain_event(monkeypatch, previous_status, completed, event_type):
    enqueue = AsyncMock()
    monkeypatch.setattr(server, "ensure_legacy_enrollments_for_user", AsyncMock())
    monkeypatch.setattr(server, "upsert_enrollment", AsyncMock(return_value={
        "id": "enrollment-1", "status": previous_status, "started_at": None,
    }))
    monkeypatch.setattr(server, "enqueue_event", enqueue)
    monkeypatch.setattr(server, "db", SimpleNamespace(
        enrollments=SimpleNamespace(update_one=AsyncMock()),
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value={"id": "content-1", "title": "Formación segura"})),
        certificates=SimpleNamespace(update_one=AsyncMock()),
    ))

    asyncio.run(server.update_enrollment_from_progress(actor(), "content-1", completed))

    assert enqueue.await_args.args[0] == event_type
    assert enqueue.await_args.args[3]["user_ids"] == ["user-1"]
    assert enqueue.await_args.args[3]["content_title"] == "Formación segura"


def test_repeated_progress_state_does_not_duplicate_notification_event(monkeypatch):
    enqueue = AsyncMock()
    monkeypatch.setattr(server, "ensure_legacy_enrollments_for_user", AsyncMock())
    monkeypatch.setattr(server, "upsert_enrollment", AsyncMock(return_value={
        "id": "enrollment-1", "status": server.EnrollmentStatus.IN_PROGRESS.value,
        "started_at": datetime.now(timezone.utc),
    }))
    monkeypatch.setattr(server, "enqueue_event", enqueue)
    monkeypatch.setattr(server, "db", SimpleNamespace(
        enrollments=SimpleNamespace(update_one=AsyncMock()),
        training_contents=SimpleNamespace(find_one=AsyncMock()),
        certificates=SimpleNamespace(update_one=AsyncMock()),
    ))

    asyncio.run(server.update_enrollment_from_progress(actor(), "content-1", False))

    enqueue.assert_not_awaited()


def test_webhook_rejects_missing_or_wrong_secret(monkeypatch):
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "expected")
    request = SimpleNamespace(headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"})

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.telegram_webhook(request))

    assert error.value.status_code == 401


def test_attendance_rejects_people_outside_the_session(monkeypatch):
    stored = {**session_record(), "participant_user_ids": ["allowed"], "created_by": "trainer"}
    monkeypatch.setattr(server, "db", SimpleNamespace(
        synchronous_sessions=SimpleNamespace(find_one=AsyncMock(return_value=stored)),
        session_attendance=SimpleNamespace(update_one=AsyncMock()),
    ))
    monkeypatch.setattr(server, "can_manage_session", AsyncMock(return_value=True))

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.save_session_attendance(
            "session-1",
            server.AttendanceRequest(entries=[server.AttendanceEntry(user_id="outsider", status="attended")]),
            actor(server.UserType.FORMADOR, "trainer"),
        ))

    assert error.value.status_code == 422


def test_password_reset_consumes_token_atomically_and_revokes_sessions(monkeypatch):
    consumed = {"user_id": "user-1"}
    tokens = SimpleNamespace(find_one_and_update=AsyncMock(return_value=consumed))
    users = SimpleNamespace(update_one=AsyncMock())
    sessions = SimpleNamespace(delete_many=AsyncMock())
    monkeypatch.setattr(server, "db", SimpleNamespace(password_reset_tokens=tokens, users=users, user_sessions=sessions))

    result = asyncio.run(server.reset_password(server.ResetPasswordRequest(token="x" * 30, password="new-password")))

    assert result == {"success": True}
    assert tokens.find_one_and_update.await_args.args[0]["token_hash"] == server.token_digest("x" * 30)
    sessions.delete_many.assert_awaited_once_with({"user_id": "user-1"})


def test_login_rate_limit_is_shared_and_rejects_the_eleventh_attempt(monkeypatch):
    limiter = SimpleNamespace(find_one_and_update=AsyncMock(return_value={"attempts": 11}))
    monkeypatch.setattr(server, "db", SimpleNamespace(auth_rate_limits=limiter))

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.enforce_login_rate_limit("user@ritsi.org", "127.0.0.1"))

    assert error.value.status_code == 429
    assert error.value.headers == {"Retry-After": "60"}


def test_learning_path_requires_every_content_item_to_be_published(monkeypatch):
    insert = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(count_documents=AsyncMock(return_value=1)),
        learning_paths=SimpleNamespace(insert_one=insert),
    ))
    request = server.LearningPathRequest(title="Itinerario", content_ids=["one", "two"])

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.create_learning_path(request, actor(server.UserType.ADMIN)))

    assert error.value.status_code == 422
    insert.assert_not_awaited()


def test_account_deletion_requires_governance_transfer(monkeypatch):
    password = "secure-password"
    stored = {"id": "board-1", "password_hash": server.password_hash(password)}
    monkeypatch.setattr(server, "db", SimpleNamespace(users=SimpleNamespace(find_one=AsyncMock(return_value=stored))))

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.request_account_deletion(
            server.AccountDeletionRequest(password=password),
            actor(server.UserType.JUNTA_DIRECTIVA, "board-1"),
        ))

    assert error.value.status_code == 409


def test_quiz_authoring_rejects_blank_options_and_out_of_range_answers():
    with pytest.raises(ValidationError):
        server.Question(
            question_text="Pregunta valida", question_type="multiple_choice",
            options=["Correcta", ""], correct_answers=[0],
        )
    with pytest.raises(ValidationError):
        server.Question(
            question_text="Pregunta valida", question_type="multiple_choice",
            options=["A", "B"], correct_answers=[2],
        )


def test_editor_contract_returns_answer_keys_only_to_authorized_author(monkeypatch):
    content = {
        "id": "content-1", "title": "Editorial", "created_by": "trainer-1",
        "status": "pending", "is_public": False, "files": [],
        "quizzes": [{"id": "quiz-1", "title": "Control", "passing_percentage": 70, "questions": [{
            "id": "q-1", "question_text": "Respuesta correcta", "question_type": "multiple_choice",
            "options": ["A", "B"], "correct_answers": [1],
        }]}],
    }
    monkeypatch.setattr(server, "db", SimpleNamespace(training_contents=SimpleNamespace(find_one=AsyncMock(return_value=content))))

    result = asyncio.run(server.get_content_editor("content-1", actor(server.UserType.FORMADOR, "trainer-1")))

    assert result.quizzes[0].questions[0].correct_answers == [1]


def test_editor_contract_denies_another_trainer(monkeypatch):
    content = {"id": "content-1", "title": "Editorial", "created_by": "trainer-1", "status": "pending", "files": [], "quizzes": []}
    monkeypatch.setattr(server, "db", SimpleNamespace(training_contents=SimpleNamespace(find_one=AsyncMock(return_value=content))))

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.get_content_editor("content-1", actor(server.UserType.FORMADOR, "trainer-2")))

    assert error.value.status_code == 403
