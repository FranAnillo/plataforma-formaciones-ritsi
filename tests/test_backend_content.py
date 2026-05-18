from backend import server
from tests.helpers import as_doc, assert_http, run


def content_doc(content_id, *, creator="creator", status="published", is_public=False, files=None, quizzes=None, category_ids=None):
    return {
        "id": content_id,
        "title": content_id.title(),
        "description": None,
        "status": status,
        "is_public": is_public,
        "files": files or [],
        "category_ids": category_ids or [],
        "quizzes": quizzes or [],
        "created_by": creator,
        "created_at": "2026-01-01T00:00:00+00:00",
    }


def test_content_visibility_rules_are_role_scoped(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    escuela = users("escuela", server.UserType.ESCUELA_FORMACION)
    rep = users("rep", server.UserType.REPRESENTANTE)
    external = users("external", server.UserType.COLABORACION_EXTERNA)
    formador = users("formador", server.UserType.FORMADOR)
    university = users("uni-user", server.UserType.UNIVERSIDAD)
    contents = [
        content_doc("public", is_public=True),
        content_doc("assigned"),
        content_doc("all"),
        content_doc("pending", status="pending"),
        content_doc("own", creator=formador.id, status="pending"),
    ]
    fake_db.training_contents.docs.extend(contents)
    fake_db.content_assignments.docs.extend([
        {"content_id": "assigned", "assigned_to_user_ids": [rep.id]},
        {"content_id": "all", "assigned_to_all_representatives": True},
    ])

    assert [item.id for item in run(server.get_training_content(rep))] == ["public", "assigned", "all"]
    assert [item.id for item in run(server.get_training_content(external))] == ["public", "all"]
    assert {item.id for item in run(server.get_training_content(formador))} == {"public", "assigned", "all", "own"}
    assert {item.id for item in run(server.get_training_content(university))} == {"public", "assigned", "all"}
    assert {item.id for item in run(server.get_training_content(admin))} == {"public", "assigned", "all", "pending", "own"}

    assert run(server.user_can_access_content(contents[3], admin)) is True
    assert run(server.user_can_access_content(contents[3], escuela)) is True
    assert run(server.user_can_access_content(contents[4], formador)) is True
    assert run(server.user_can_access_content(contents[0], university)) is True
    assert run(server.user_can_access_content(contents[3], rep)) is False
    assert run(server.user_can_access_content(contents[0], rep)) is True
    assert run(server.user_can_access_content(contents[1], rep)) is True


def test_content_crud_and_moderation(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    formador = users("formador", server.UserType.FORMADOR)
    rep = users("rep", server.UserType.REPRESENTANTE)
    category = server.Category(id="cat", name="Cat")
    fake_db.categories.docs.append(as_doc(category))
    request = server.TrainingContentCreate(
        title="Curso",
        is_public=True,
        category_ids=["cat"],
        files=[server.ContentFileCreate(file_type=server.FileType.PDF, google_drive_url="url", title="PDF")],
        quizzes=[server.QuizCreate(
            title="Quiz",
            questions=[server.QuestionCreate(
                question_text="Q",
                question_type=server.QuestionType.TRUE_FALSE,
                options=["Sí", "No"],
                correct_answers=[0],
            )],
        )],
    )
    with assert_http(403):
        run(server.create_training_content(request, rep))
    with assert_http(400):
        run(server.create_training_content(server.TrainingContentCreate(title="Bad", category_ids=["ghost"]), admin))
    pending = run(server.create_training_content(request, formador))
    published = run(server.create_training_content(request, admin))
    assert pending.status == server.ContentStatus.PENDING
    assert published.status == server.ContentStatus.PUBLISHED

    with assert_http(404):
        run(server.get_training_content_by_id("missing", admin))
    with assert_http(403):
        run(server.get_training_content_by_id(pending.id, rep))
    assert run(server.get_training_content_by_id(published.id, rep)).id == published.id

    with assert_http(403):
        run(server.approve_content(pending.id, rep))
    assert run(server.approve_content(pending.id, admin)).status == server.ContentStatus.PUBLISHED
    with assert_http(404):
        run(server.approve_content("missing", admin))

    with assert_http(403):
        run(server.delete_training_content(published.id, rep))
    with assert_http(404):
        run(server.delete_training_content("missing", admin))
    assert run(server.delete_training_content(published.id, admin))["message"]

    rejected = run(server.create_training_content(request, formador))
    with assert_http(403):
        run(server.reject_content(rejected.id, rep))
    assert "eliminado" in run(server.reject_content(rejected.id, admin))["message"]


def test_assignment_permissions_for_each_role(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    junta = users("junta", server.UserType.JUNTA_DIRECTIVA)
    university = users("uni-user", server.UserType.UNIVERSIDAD, university_id="u1")
    coordinator = users("coord", server.UserType.COORDINADOR_TEMATICO)
    rep = users("rep", server.UserType.REPRESENTANTE, university_id="u1")
    foreign = users("foreign", server.UserType.REPRESENTANTE, university_id="u2")
    inactive = users("inactive", server.UserType.REPRESENTANTE, university_id="u1", is_active=False)
    fake_db.users.docs.extend([as_doc(rep), as_doc(foreign), as_doc(inactive)])
    fake_db.training_contents.docs.extend([
        content_doc("published"),
        content_doc("pending", status="pending"),
    ])

    with assert_http(404):
        run(server.assign_content(server.AssignContentRequest(content_id="missing"), admin))
    with assert_http(400):
        run(server.assign_content(server.AssignContentRequest(content_id="pending"), university))
    assert run(server.assign_content(server.AssignContentRequest(content_id="published"), junta)).assigned_to_all_representatives is True

    with assert_http(400):
        run(server.assign_content(server.AssignContentRequest(content_id="published"), university))
    with assert_http(404):
        run(server.assign_content(server.AssignContentRequest(content_id="published", user_ids=["ghost"]), university))
    with assert_http(403):
        run(server.assign_content(server.AssignContentRequest(content_id="published", user_ids=[foreign.id]), university))
    assert run(server.assign_content(server.AssignContentRequest(content_id="published", user_ids=[rep.id]), university)).assigned_to_user_ids == [rep.id]

    with assert_http(400):
        run(server.assign_content(server.AssignContentRequest(content_id="published"), coordinator))
    with assert_http(404):
        run(server.assign_content(server.AssignContentRequest(content_id="published", user_ids=[inactive.id]), coordinator))
    assert run(server.assign_content(server.AssignContentRequest(content_id="published", user_ids=[rep.id]), coordinator)).assigned_to_user_ids == [rep.id]

    assert run(server.assign_content(server.AssignContentRequest(content_id="pending", user_ids=[rep.id]), admin)).assigned_to_user_ids == [rep.id]
    with assert_http(403):
        run(server.assign_content(server.AssignContentRequest(content_id="published"), rep))


def test_zone_assignment_listing_unassignment_and_representatives(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    rep = users("rep", server.UserType.REPRESENTANTE, university_id="u1")
    inactive = users("inactive", server.UserType.REPRESENTANTE, university_id="u1", is_active=False)
    foreign = users("foreign", server.UserType.REPRESENTANTE, university_id="u2")
    university = users("uni-user", server.UserType.UNIVERSIDAD, university_id="u1")
    fake_db.training_contents.docs.extend([content_doc("published"), content_doc("pending", status="pending")])

    with assert_http(403):
        run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="published", zone="I"), rep))
    with assert_http(404):
        run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="missing", zone="I"), admin))
    with assert_http(400):
        run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="pending", zone="I"), admin))
    with assert_http(404):
        run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="published", zone="I"), admin))

    fake_db.universities.docs.append(as_doc(server.University(id="u1", name="U1", zone="I")))
    assert "No hay representantes" in run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="published", zone="I"), admin))["message"]
    fake_db.users.docs.extend([as_doc(rep), as_doc(inactive), as_doc(foreign)])
    assert "1 representantes" in run(server.assign_content_to_zone(server.AssignContentToZoneRequest(content_id="published", zone="I"), admin))["message"]
    assert fake_db.content_assignments.docs[0]["assigned_to_user_ids"] == [rep.id]

    with assert_http(403):
        run(server.get_all_assignments(rep))
    assert len(run(server.get_all_assignments(admin))) == 1

    fake_db.user_progress.docs.append({"user_id": rep.id, "content_id": "published"})
    with assert_http(403):
        run(server.unassign_content(server.UnassignContentRequest(user_id=rep.id, content_id="published"), rep))
    run(server.unassign_content(server.UnassignContentRequest(user_id=rep.id, content_id="published"), admin))
    assert fake_db.content_assignments.docs[0]["assigned_to_user_ids"] == []
    assert fake_db.user_progress.docs == []

    assert [u.id for u in run(server.get_representatives(university))] == [rep.id, inactive.id]
    assert {u.id for u in run(server.get_representatives(admin))} == {rep.id, inactive.id, foreign.id}
    with assert_http(403):
        run(server.get_representatives(rep))


def test_progress_rejects_unauthorized_access_and_tracks_completion(fake_db, users):
    rep = users("rep", server.UserType.REPRESENTANTE)
    file = {"id": "file-1", "file_type": "pdf", "google_drive_url": "url", "title": "PDF"}
    quiz = {
        "id": "quiz-1",
        "title": "Quiz",
        "passing_percentage": 70,
        "questions": [
            {"id": "q1", "question_text": "Q1", "question_type": "true_false", "options": ["Sí", "No"], "correct_answers": [0]},
            {"id": "q2", "question_text": "Q2", "question_type": "multiple_choice", "options": ["A", "B"], "correct_answers": [1]},
        ],
    }
    fake_db.training_contents.docs.extend([
        content_doc("private", files=[file], quizzes=[quiz]),
        content_doc("public", is_public=True, files=[file], quizzes=[quiz]),
        content_doc("empty-quiz", is_public=True, quizzes=[{"id": "empty", "title": "Empty", "questions": [], "passing_percentage": 70}]),
    ])

    assert run(server.get_my_progress(rep)) == []
    with assert_http(404):
        run(server.mark_file_completed(server.MarkFileCompletedRequest(content_id="missing", file_id=file["id"]), rep))
    with assert_http(403):
        run(server.mark_file_completed(server.MarkFileCompletedRequest(content_id="private", file_id=file["id"]), rep))
    with assert_http(404):
        run(server.mark_file_completed(server.MarkFileCompletedRequest(content_id="public", file_id="ghost"), rep))
    progress = run(server.mark_file_completed(server.MarkFileCompletedRequest(content_id="public", file_id=file["id"]), rep))
    assert progress.files_completed == [file["id"]]
    duplicate = run(server.mark_file_completed(server.MarkFileCompletedRequest(content_id="public", file_id=file["id"]), rep))
    assert duplicate.files_completed == [file["id"]]

    with assert_http(404):
        run(server.submit_quiz(server.SubmitQuizRequest(content_id="missing", quiz_id="quiz-1", answers={}), rep))
    with assert_http(403):
        run(server.submit_quiz(server.SubmitQuizRequest(content_id="private", quiz_id="quiz-1", answers={}), rep))
    with assert_http(404):
        run(server.submit_quiz(server.SubmitQuizRequest(content_id="public", quiz_id="ghost", answers={}), rep))
    with assert_http(400):
        run(server.submit_quiz(server.SubmitQuizRequest(content_id="empty-quiz", quiz_id="empty", answers={}), rep))

    fresh = content_doc("fresh", is_public=True, quizzes=[quiz])
    fake_db.training_contents.docs.append(fresh)
    first_attempt = run(server.submit_quiz(server.SubmitQuizRequest(content_id="fresh", quiz_id="quiz-1", answers={"q1": [0], "q2": [1]}), rep))
    assert first_attempt["attempts"] == 1

    failed = run(server.submit_quiz(server.SubmitQuizRequest(content_id="public", quiz_id="quiz-1", answers={"q1": [1], "q2": [0]}), rep))
    assert failed == {"score": 0.0, "passed": False, "correct_answers": 0, "total_questions": 2, "attempts": 1}
    passed = run(server.submit_quiz(server.SubmitQuizRequest(content_id="public", quiz_id="quiz-1", answers={"q1": [0], "q2": [1]}), rep))
    assert passed["passed"] is True
    assert passed["attempts"] == 2
    stored = next(doc for doc in fake_db.user_progress.docs if doc["content_id"] == "public")
    assert stored["completed"] is True


def test_health_check(fake_db):
    assert run(server.health_check()) == {"status": "ok"}


def test_shutdown_closes_client(monkeypatch):
    closed = []

    class DummyClient:
        def close(self):
            closed.append(True)

    monkeypatch.setattr(server, "client", DummyClient())
    run(server.shutdown_db_client())
    assert closed == [True]
