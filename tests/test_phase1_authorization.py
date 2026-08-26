import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import backend.server as server


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, _length):
        return self.items


def user(user_type, *, user_id="actor-1", university_id=None):
    return server.User(
        id=user_id,
        email=f"{user_id}@ritsi.org",
        name=user_id,
        user_type=user_type,
        university_id=university_id,
    )


def published_content(*, public=False):
    return {
        "id": "content-1",
        "title": "Formacion",
        "status": server.ContentStatus.PUBLISHED.value,
        "is_public": public,
        "created_by": "trainer-1",
        "files": [
            {
                "id": "file-1",
                "title": "Guia",
                "url": "https://example.test/guide.pdf",
                "file_type": server.FileType.PDF.value,
            }
        ],
        "quizzes": [],
    }


def test_global_assignment_is_visible_only_to_representatives():
    representative_query = server.assignment_access_query(user(server.UserType.REPRESENTANTE))
    university_query = server.assignment_access_query(user(server.UserType.UNIVERSIDAD, university_id="uni-1"))

    assert {"assigned_to_all_representatives": True} in representative_query["$or"]
    assert university_query == {"$or": [{"assigned_to_user_ids": "actor-1"}]}


def test_university_cannot_create_a_global_assignment(monkeypatch):
    database = SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content())),
        users=SimpleNamespace(count_documents=AsyncMock()),
        content_assignments=SimpleNamespace(insert_one=AsyncMock()),
    )
    monkeypatch.setattr(server, "db", database)

    request = server.AssignContentRequest(
        content_id="content-1",
        assign_to_all_representatives=True,
    )
    university = user(server.UserType.UNIVERSIDAD, university_id="uni-1")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.assign_content(request, university))

    assert error.value.status_code == 403
    assert "globales" in error.value.detail
    database.content_assignments.insert_one.assert_not_awaited()


def test_university_cannot_assign_a_user_outside_its_scope(monkeypatch):
    database = SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content())),
        users=SimpleNamespace(count_documents=AsyncMock(return_value=1)),
        content_assignments=SimpleNamespace(insert_one=AsyncMock()),
    )
    monkeypatch.setattr(server, "db", database)

    request = server.AssignContentRequest(
        content_id="content-1",
        user_ids=["inside-user", "outside-user"],
    )
    university = user(server.UserType.UNIVERSIDAD, university_id="uni-1")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.assign_content(request, university))

    assert error.value.status_code == 403
    assert "tu universidad" in error.value.detail
    database.users.count_documents.assert_awaited_once_with({
        "id": {"$in": ["inside-user", "outside-user"]},
        "is_active": True,
        "user_type": {"$ne": server.UserType.ADMIN.value},
        "university_id": "uni-1",
    })
    database.content_assignments.insert_one.assert_not_awaited()


def test_university_eligible_user_roster_is_scoped_to_its_university(monkeypatch):
    users_find = MagicMock(return_value=FakeCursor([]))
    monkeypatch.setattr(server, "db", SimpleNamespace(
        users=SimpleNamespace(find=users_find),
    ))

    result = asyncio.run(server.assignment_eligible_users(
        user(server.UserType.UNIVERSIDAD, university_id="uni-1"),
    ))

    assert result == []
    users_find.assert_called_once_with({
        "is_active": True,
        "university_id": "uni-1",
        "user_type": {"$ne": server.UserType.ADMIN.value},
    }, {"_id": 0, "password_hash": 0})


def test_content_endpoint_returns_the_learner_safe_contract(monkeypatch):
    content = published_content(public=True)
    content["quizzes"] = [
        {
            "id": "quiz-1",
            "title": "Evaluacion",
            "passing_percentage": 70,
            "questions": [
                {
                    "id": "question-1",
                    "question_text": "Respuesta",
                    "question_type": server.QuestionType.MULTIPLE_CHOICE.value,
                    "options": ["A", "B"],
                    "correct_answers": [1],
                }
            ],
        }
    ]
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=content)),
    ))

    view = asyncio.run(server.get_content_item(
        "content-1", user(server.UserType.REPRESENTANTE, user_id="learner-1"),
    ))

    assert isinstance(view, server.TrainingContentView)
    assert "correct_answers" not in view.model_dump_json()


def test_progress_endpoint_always_filters_by_the_authenticated_user(monkeypatch):
    progress_find = MagicMock(return_value=FakeCursor([
        {"user_id": "learner-1", "content_id": "content-1", "completed": False},
    ]))
    monkeypatch.setattr(server, "db", SimpleNamespace(
        user_progress=SimpleNamespace(find=progress_find),
    ))

    result = asyncio.run(server.get_progress(user(server.UserType.ADMIN, user_id="learner-1")))

    assert result == [{"user_id": "learner-1", "content_id": "content-1", "completed": False}]
    progress_find.assert_called_once_with({"user_id": "learner-1"}, {"_id": 0})


def test_global_progress_requires_admin_or_board(monkeypatch):
    progress_find = MagicMock(return_value=FakeCursor([]))
    monkeypatch.setattr(server, "db", SimpleNamespace(
        user_progress=SimpleNamespace(find=progress_find),
    ))

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.get_all_progress(user(server.UserType.REPRESENTANTE)))

    assert error.value.status_code == 403
    progress_find.assert_not_called()


def test_marking_progress_requires_access_to_the_content(monkeypatch):
    progress_write = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content(public=False))),
        enrollments=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        content_assignments=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        user_progress=SimpleNamespace(find_one_and_update=progress_write),
    ))
    request = server.MarkFileCompletedRequest(content_id="content-1", file_id="file-1")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.mark_file_completed(request, user(server.UserType.REPRESENTANTE)))

    assert error.value.status_code == 403
    progress_write.assert_not_awaited()


def test_marking_progress_requires_a_resource_from_that_content(monkeypatch):
    progress_write = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content(public=True))),
        user_progress=SimpleNamespace(find_one_and_update=progress_write),
    ))
    request = server.MarkFileCompletedRequest(content_id="content-1", file_id="another-file")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.mark_file_completed(request, user(server.UserType.REPRESENTANTE)))

    assert error.value.status_code == 404
    assert "no pertenece" in error.value.detail
    progress_write.assert_not_awaited()


def test_progress_write_is_scoped_to_the_authenticated_user(monkeypatch):
    stored_progress = {
        "_id": "mongo-progress-1",
        "id": "progress-1",
        "user_id": "learner-1",
        "content_id": "content-1",
        "files_completed": ["file-1"],
        "quizzes_completed": {},
        "completed": False,
    }
    find_one_and_update = AsyncMock(return_value=stored_progress)
    progress_update = AsyncMock()
    update_enrollment = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content(public=True))),
        user_progress=SimpleNamespace(
            find_one_and_update=find_one_and_update,
            update_one=progress_update,
        ),
    ))
    monkeypatch.setattr(server, "update_enrollment_from_progress", update_enrollment)

    result = asyncio.run(server.mark_file_completed(
        server.MarkFileCompletedRequest(content_id="content-1", file_id="file-1"),
        user(server.UserType.REPRESENTANTE, user_id="learner-1"),
    ))

    assert find_one_and_update.await_args.args[0] == {
        "user_id": "learner-1",
        "content_id": "content-1",
    }
    assert result["progress"]["user_id"] == "learner-1"
    assert result["progress"]["completed"] is True
    update_enrollment.assert_awaited_once()


def test_account_deactivation_revokes_sessions_and_audits_only_public_fields(monkeypatch):
    stored = {
        "id": "learner-1",
        "email": "learner-1@ritsi.org",
        "name": "Learner",
        "user_type": server.UserType.REPRESENTANTE.value,
        "is_active": True,
        "vocalia_ids": [],
        "password_hash": "secret-hash",
        "created_at": datetime.now(timezone.utc),
    }
    updated = {**stored, "is_active": False, "password_hash": "secret-hash"}
    users_find = AsyncMock(side_effect=[stored, updated])
    user_sessions_delete = AsyncMock()
    activity_insert = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        users=SimpleNamespace(find_one=users_find, update_one=AsyncMock()),
        user_sessions=SimpleNamespace(delete_many=user_sessions_delete),
        activity_logs=SimpleNamespace(insert_one=activity_insert),
    ))

    result = asyncio.run(server.update_user(
        "learner-1",
        server.UpdateUserRequest(is_active=False),
        user(server.UserType.ADMIN, user_id="admin-1"),
    ))

    assert result.id == "learner-1"
    user_sessions_delete.assert_awaited_once_with({"user_id": "learner-1"})
    audit_payload = activity_insert.await_args.args[0]
    assert audit_payload["details"] == {
        "changed_fields": ["is_active"],
    }
    assert "password_hash" not in str(audit_payload)


def synchronous_session(*, participant_ids=None, starts_at=None, meeting_fields=None):
    start = starts_at or datetime.now(timezone.utc) + timedelta(minutes=5)
    return {
        "_id": "mongo-session-1",
        "id": "session-1",
        "content_id": "content-1",
        "title": "Sesion de formacion",
        "starts_at": start,
        "ends_at": start + timedelta(hours=1),
        "timezone": "Europe/Madrid",
        "status": server.SynchronousSessionStatus.SCHEDULED.value,
        "participant_user_ids": participant_ids or [],
        "join_window_minutes": 15,
        "created_by": "trainer-1",
        "created_at": start - timedelta(days=1),
        "updated_at": start - timedelta(days=1),
        **(meeting_fields or {}),
    }


def test_join_rejects_a_user_outside_the_session_roster(monkeypatch):
    session = synchronous_session(
        participant_ids=["another-learner"],
        meeting_fields={"meeting_url": "https://meet.google.com/abc-defg-hij"},
    )
    monkeypatch.setattr(server, "db", SimpleNamespace(
        synchronous_sessions=SimpleNamespace(find_one=AsyncMock(return_value=session)),
    ))
    monkeypatch.setattr(server, "ensure_legacy_enrollments_for_user", AsyncMock())

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.join_synchronous_session(
            "session-1", user(server.UserType.REPRESENTANTE, user_id="learner-1"),
        ))

    assert error.value.status_code == 403
    assert "acceso" in error.value.detail


def test_join_rejects_an_authorized_user_before_the_window(monkeypatch):
    session = synchronous_session(
        participant_ids=["learner-1"],
        starts_at=datetime.now(timezone.utc) + timedelta(hours=2),
        meeting_fields={"meeting_url": "https://meet.google.com/abc-defg-hij"},
    )
    monkeypatch.setattr(server, "db", SimpleNamespace(
        synchronous_sessions=SimpleNamespace(find_one=AsyncMock(return_value=session)),
    ))
    monkeypatch.setattr(server, "ensure_legacy_enrollments_for_user", AsyncMock())

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.join_synchronous_session(
            "session-1", user(server.UserType.REPRESENTANTE, user_id="learner-1"),
        ))

    assert error.value.status_code == 403
    assert "todavia" in error.value.detail


def test_join_redirects_during_the_window_without_cache_or_referrer(monkeypatch):
    monkeypatch.setattr(server, "MEETING_URL_ENCRYPTION_KEY", "test-only-key-material")
    meeting_url = "https://meet.google.com/abc-defg-hij"
    session = synchronous_session(
        participant_ids=["learner-1"],
        meeting_fields=server.meeting_url_storage_fields(meeting_url),
    )
    activity_insert = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        synchronous_sessions=SimpleNamespace(find_one=AsyncMock(return_value=session)),
        activity_logs=SimpleNamespace(insert_one=activity_insert),
    ))
    monkeypatch.setattr(server, "ensure_legacy_enrollments_for_user", AsyncMock())

    response = asyncio.run(server.join_synchronous_session(
        "session-1", user(server.UserType.REPRESENTANTE, user_id="learner-1"),
    ))

    assert response.status_code == 303
    assert response.headers["location"] == meeting_url
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    activity_insert.assert_awaited_once()


def test_session_view_never_serializes_the_meeting_url(monkeypatch):
    monkeypatch.setattr(server, "MEETING_URL_ENCRYPTION_KEY", "test-only-key-material")
    session = synchronous_session(
        participant_ids=["learner-1"],
        meeting_fields=server.meeting_url_storage_fields(
            "https://meet.google.com/abc-defg-hij"
        ),
    )

    view = asyncio.run(server.build_session_view(
        session, user(server.UserType.REPRESENTANTE, user_id="learner-1"),
    ))

    serialized = view.model_dump_json()
    assert "meet.google.com" not in serialized
    assert "meeting_url" not in serialized
    assert "participant_user_ids" not in serialized
    assert view.participant_count == 1
    assert view.can_join is True


def test_session_with_meeting_requires_an_encryption_key(monkeypatch):
    monkeypatch.setattr(server, "MEETING_URL_ENCRYPTION_KEY", None)
    session_insert = AsyncMock()
    monkeypatch.setattr(server, "db", SimpleNamespace(
        training_contents=SimpleNamespace(find_one=AsyncMock(return_value=published_content())),
        synchronous_sessions=SimpleNamespace(insert_one=session_insert),
    ))
    now = datetime.now(timezone.utc)
    request = server.SessionCreateRequest(
        content_id="content-1",
        title="Sesion segura",
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
        meeting_url="https://meet.google.com/abc-defg-hij",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.create_synchronous_session(
            request, user(server.UserType.ADMIN, user_id="admin-1"),
        ))

    assert error.value.status_code == 503
    assert "MEETING_URL_ENCRYPTION_KEY" in error.value.detail
    session_insert.assert_not_awaited()
