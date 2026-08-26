from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

import backend.server as server


def published_content_with_quiz() -> server.TrainingContent:
    return server.TrainingContent(
        id="content-1",
        title="Seguridad para representantes",
        status=server.ContentStatus.PUBLISHED,
        is_public=False,
        created_by="trainer-1",
        files=[
            server.ContentFile(
                id="file-1",
                title="Guia",
                file_type=server.FileType.PDF,
                url="https://example.test/guide.pdf",
            )
        ],
        quizzes=[
            server.Quiz(
                id="quiz-1",
                title="Evaluacion",
                passing_percentage=70,
                questions=[
                    server.Question(
                        id="question-1",
                        question_text="Selecciona la opcion correcta",
                        question_type=server.QuestionType.MULTIPLE_CHOICE,
                        options=["A", "B"],
                        correct_answers=[1],
                    )
                ],
            )
        ],
    )


def test_learner_content_contract_never_contains_answer_keys():
    view = server.TrainingContentView.model_validate(published_content_with_quiz().model_dump())
    payload = view.model_dump(mode="json")

    assert payload["quizzes"][0]["questions"][0] == {
        "id": "question-1",
        "question_text": "Selecciona la opcion correcta",
        "question_type": "multiple_choice",
        "options": ["A", "B"],
    }
    assert "correct_answers" not in view.model_dump_json()


def test_completion_requires_every_file_and_a_pass_for_every_quiz():
    content = published_content_with_quiz().model_dump(mode="json")

    assert not server.calculate_progress_completion(content, {})
    assert not server.calculate_progress_completion(content, {"files_completed": ["file-1"]})
    assert not server.calculate_progress_completion(
        content,
        {"files_completed": ["file-1"], "quizzes_completed": {"quiz-1": {"passed": False}}},
    )
    assert server.calculate_progress_completion(
        content,
        {"files_completed": ["file-1"], "quizzes_completed": {"quiz-1": {"passed": True}}},
    )


def test_empty_content_is_not_completed_implicitly():
    assert not server.calculate_progress_completion({"files": [], "quizzes": []}, {})


@pytest.mark.parametrize(
    ("offset", "status", "allowed"),
    [
        (timedelta(minutes=-16), server.SynchronousSessionStatus.SCHEDULED, False),
        (timedelta(minutes=-15), server.SynchronousSessionStatus.SCHEDULED, True),
        (timedelta(), server.SynchronousSessionStatus.SCHEDULED, True),
        (timedelta(minutes=59, seconds=59), server.SynchronousSessionStatus.LIVE, True),
        (timedelta(hours=1), server.SynchronousSessionStatus.LIVE, False),
        (timedelta(), server.SynchronousSessionStatus.CANCELLED, False),
        (timedelta(), server.SynchronousSessionStatus.DRAFT, False),
        (timedelta(), server.SynchronousSessionStatus.ENDED, False),
    ],
)
def test_session_join_window_is_server_side_and_has_exact_boundaries(offset, status, allowed):
    starts_at = datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc)
    session = {
        "starts_at": starts_at,
        "ends_at": starts_at + timedelta(hours=1),
        "join_window_minutes": 15,
        "status": status.value,
    }

    can_join, reason = server.session_join_state(session, starts_at + offset)

    assert can_join is allowed
    assert (reason is None) is allowed


def test_session_schedule_requires_iana_zone_aware_datetimes_and_positive_duration():
    start = datetime(2026, 3, 29, 8, 0, tzinfo=timezone.utc)
    assert server.validate_session_schedule(start, start + timedelta(hours=1), "Europe/Madrid") == (
        start,
        start + timedelta(hours=1),
    )

    with pytest.raises(ValueError, match="zona horaria"):
        server.validate_session_schedule(start.replace(tzinfo=None), start + timedelta(hours=1), "Europe/Madrid")
    with pytest.raises(ValueError, match="Zona horaria"):
        server.validate_session_schedule(start, start + timedelta(hours=1), "Europe/Nowhere")
    with pytest.raises(ValueError, match="terminar"):
        server.validate_session_schedule(start, start, "Europe/Madrid")


def test_persisted_mongo_datetimes_are_interpreted_as_utc_without_relaxing_input_validation():
    mongo_value = datetime(2026, 8, 25, 12, 30)

    assert server.parse_stored_utc_datetime(mongo_value) == mongo_value.replace(tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="zona horaria"):
        server.parse_utc_datetime(mongo_value)


def test_session_join_window_accepts_naive_bson_dates_from_mongo():
    starts_at = datetime(2026, 8, 25, 12, 30)
    session = {
        "starts_at": starts_at,
        "ends_at": starts_at + timedelta(hours=1),
        "join_window_minutes": 15,
        "status": server.SynchronousSessionStatus.SCHEDULED.value,
    }

    allowed, reason = server.session_join_state(
        session, starts_at.replace(tzinfo=timezone.utc) - timedelta(minutes=5)
    )

    assert allowed is True
    assert reason is None


def test_meeting_url_is_encrypted_at_rest_and_can_be_recovered(monkeypatch):
    monkeypatch.setattr(server, "MEETING_URL_ENCRYPTION_KEY", "test-only-key-material")
    meeting_url = "https://meet.google.com/abc-defg-hij"

    stored = server.meeting_url_storage_fields(meeting_url)

    assert meeting_url not in stored["meeting_url_ciphertext"]
    assert stored["meeting_url_hash"] == server.token_digest(meeting_url)
    assert server.read_meeting_url(stored) == meeting_url


def test_meeting_url_must_use_https():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        server.SessionCreateRequest(
            content_id="content-1",
            title="Sesion segura",
            starts_at=now,
            ends_at=now + timedelta(hours=1),
            meeting_url="http://meet.example.test/insecure",
        )


def test_cookie_authenticated_mutations_reject_untrusted_browser_origins(monkeypatch):
    monkeypatch.setattr(server, "ALLOWED_ORIGINS", {"https://formacion.ritsi.org"})

    assert server.browser_mutation_origin_is_trusted("https://formacion.ritsi.org", "same-site")
    assert not server.browser_mutation_origin_is_trusted("https://attacker.example", "cross-site")
    assert not server.browser_mutation_origin_is_trusted(None, "cross-site")
    assert server.browser_mutation_origin_is_trusted(None, "same-origin")
