from backend import server
from tests.helpers import as_doc, assert_http, run


def test_registration_users_activity_and_legacy_routes(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    rep = users("rep", server.UserType.REPRESENTANTE)
    other = users("other", server.UserType.REPRESENTANTE)
    fake_db.users.docs.extend([as_doc(admin), as_doc(rep), as_doc(other)])
    fake_db.universities.docs.append(as_doc(server.University(id="uni", name="Uni")))

    with assert_http(404, "Universidad no encontrada"):
        run(server.register_user(server.RegisterRequest(email=rep.email, name="Rep", university_id="missing"), rep))
    registered = run(server.register_user(server.RegisterRequest(email=rep.email, name="Rep Nueva", university_id="uni"), rep))
    assert registered.university_id == "uni"
    assert registered.name == "Rep Nueva"

    with assert_http(403):
        run(server.get_all_users(rep))
    assert len(run(server.get_all_users(admin))) == 3

    with assert_http(403):
        run(server.update_user_role(rep.id, server.UpdateUserRoleRequest(user_type=server.UserType.ADMIN), rep))
    with assert_http(404):
        run(server.update_user_role("missing", server.UpdateUserRoleRequest(user_type=server.UserType.ADMIN), admin))
    unchanged = run(server.update_user_role(rep.id, server.UpdateUserRoleRequest(user_type=server.UserType.REPRESENTANTE), admin))
    assert unchanged.user_type == server.UserType.REPRESENTANTE
    changed = run(server.update_user_role(rep.id, server.UpdateUserRoleRequest(user_type=server.UserType.FORMADOR), admin))
    assert changed.user_type == server.UserType.FORMADOR
    assert fake_db.activity_logs.docs[-1]["action"] == "Cambio de rol"

    with assert_http(403):
        run(server.update_user_status(other.id, server.UpdateUserStatusRequest(is_active=False), rep))
    with assert_http(400, "No puedes cambiar tu propio estado"):
        run(server.update_user_status(admin.id, server.UpdateUserStatusRequest(is_active=False), admin))
    with assert_http(404):
        run(server.update_user_status("missing", server.UpdateUserStatusRequest(is_active=False), admin))
    disabled = run(server.update_user_status(other.id, server.UpdateUserStatusRequest(is_active=False), admin))
    assert disabled.is_active is False

    with assert_http(410):
        run(server.update_user_commissions(rep.id, server.UpdateUserCommissionsRequest(), admin))
    with assert_http(403):
        run(server.get_activity_log(rep))
    assert len(run(server.get_activity_log(admin))) == 2


def test_import_and_delete_user_security(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    rep = users("rep", server.UserType.REPRESENTANTE)
    victim = users("victim", server.UserType.REPRESENTANTE)
    fake_db.users.docs.extend([as_doc(admin), as_doc(rep), as_doc(victim)])
    fake_db.universities.docs.append(as_doc(server.University(id="uni", name="Uni")))

    request = server.UserImportRequest(users=[
        server.UserImport(email=rep.email, name="Duplicado", user_type=server.UserType.FORMADOR),
        server.UserImport(email="missing-uni@example.com", name="Sin Uni", user_type=server.UserType.REPRESENTANTE),
        server.UserImport(email="bad-uni@example.com", name="Mala Uni", user_type=server.UserType.UNIVERSIDAD, university_id="ghost"),
        server.UserImport(email="ok@example.com", name="Ok", user_type=server.UserType.REPRESENTANTE, university_id="uni"),
    ])
    with assert_http(403):
        run(server.import_users(request, rep))
    result = run(server.import_users(request, admin))
    assert result["created"] == 1
    assert result["skipped"] == 1
    assert len(result["errors"]) == 2

    async def broken_insert(_doc):
        raise RuntimeError("boom")

    fake_db.users.insert_one = broken_insert
    broken = run(server.import_users(server.UserImportRequest(users=[
        server.UserImport(email="boom@example.com", name="Boom", user_type=server.UserType.FORMADOR)
    ]), admin))
    assert "Error inesperado - boom" in broken["errors"][0]

    fake_db.user_sessions.docs.append({"user_id": victim.id, "session_token": "victim"})
    fake_db.user_progress.docs.append({"user_id": victim.id, "content_id": "content"})
    fake_db.content_assignments.docs.append({"assigned_to_user_ids": [victim.id, rep.id]})
    with assert_http(403):
        run(server.delete_user(victim.id, rep))
    with assert_http(400):
        run(server.delete_user(admin.id, admin))
    with assert_http(404):
        run(server.delete_user("ghost", admin))
    run(server.delete_user(victim.id, admin))
    assert all(doc.get("id") != victim.id for doc in fake_db.users.docs)
    assert fake_db.user_sessions.docs == []
    assert fake_db.user_progress.docs == []
    assert fake_db.content_assignments.docs[0]["assigned_to_user_ids"] == [rep.id]


def test_university_crud_permissions_and_integrity(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    escuela = users("escuela", server.UserType.ESCUELA_FORMACION)
    rep = users("rep", server.UserType.REPRESENTANTE, university_id="uni")

    assert run(server.get_universities()) == []
    with assert_http(403):
        run(server.create_university(server.UniversityCreate(name="No"), rep))
    created = run(server.create_university(server.UniversityCreate(name="Uni", zone="I"), escuela))
    assert created.zone == "I"

    with assert_http(403):
        run(server.update_university(created.id, server.UniversityCreate(name="No"), rep))
    with assert_http(404):
        run(server.update_university("missing", server.UniversityCreate(name="No"), admin))
    updated = run(server.update_university(created.id, server.UniversityCreate(name="Renombrada", zone="II"), admin))
    assert updated.name == "Renombrada"

    with assert_http(403):
        run(server.update_university_status(created.id, server.UpdateUniversityStatusRequest(is_active=False), escuela))
    with assert_http(404):
        run(server.update_university_status("missing", server.UpdateUniversityStatusRequest(is_active=False), admin))
    assert run(server.update_university_status(created.id, server.UpdateUniversityStatusRequest(is_active=False), admin)).is_active is False

    fake_db.users.docs.append(as_doc(rep))
    with assert_http(403):
        run(server.delete_university(created.id, rep))
    with assert_http(400):
        run(server.delete_university("uni", admin))
    fake_db.users.docs.clear()
    run(server.delete_university(created.id, admin))
    assert fake_db.universities.docs == []


def test_vocalias_crud_and_validation(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    rep = users("rep", server.UserType.REPRESENTANTE)
    coord = users("coord", server.UserType.COORDINADOR_TEMATICO)
    fake_db.users.docs.extend([as_doc(rep), as_doc(coord)])

    with assert_http(403):
        run(server.create_thematic_commission(server.ThematicCommissionCreate(name="Docencia"), rep))
    with assert_http(404):
        run(server.create_thematic_commission(server.ThematicCommissionCreate(name="Docencia", coordinator_id="ghost"), admin))
    with assert_http(400):
        run(server.create_thematic_commission(server.ThematicCommissionCreate(name="Docencia", coordinator_id=rep.id), admin))
    created = run(server.create_thematic_commission(server.ThematicCommissionCreate(name="Docencia", coordinator_id=coord.id), admin))
    assert created.coordinator_id == coord.id
    with assert_http(400):
        run(server.create_thematic_commission(server.ThematicCommissionCreate(name="docencia"), admin))
    assert len(run(server.get_thematic_commissions(admin))) == 1

    with assert_http(403):
        run(server.update_thematic_commission(created.id, server.ThematicCommissionCreate(name="Otra"), rep))
    with assert_http(404):
        run(server.update_thematic_commission("missing", server.ThematicCommissionCreate(name="Otra"), admin))
    with assert_http(404):
        run(server.update_thematic_commission(created.id, server.ThematicCommissionCreate(name="Otra", coordinator_id="ghost"), admin))
    with assert_http(400):
        run(server.update_thematic_commission(created.id, server.ThematicCommissionCreate(name="Otra", coordinator_id=rep.id), admin))
    updated = run(server.update_thematic_commission(created.id, server.ThematicCommissionCreate(name="Otra", coordinator_id=coord.id), admin))
    assert updated.name == "Otra"

    fake_db.users.docs[0]["thematic_commission_ids"] = [created.id]
    with assert_http(403):
        run(server.delete_thematic_commission(created.id, rep))
    with assert_http(404):
        run(server.delete_thematic_commission("ghost", admin))
    result = run(server.delete_thematic_commission(created.id, admin))
    assert "eliminada" in result["message"]
    assert fake_db.users.docs[0]["thematic_commission_ids"] == []
    with assert_http(410):
        run(server.assign_users_to_commission("x", server.AssignUsersToCommissionRequest(user_ids=[]), admin))


def test_categories_crud_and_uniqueness(fake_db, users):
    admin = users("admin", server.UserType.ADMIN)
    rep = users("rep", server.UserType.REPRESENTANTE)
    assert run(server.get_categories()) == []
    with assert_http(403):
        run(server.create_category(server.CategoryCreate(name="Seguridad"), rep))
    first = run(server.create_category(server.CategoryCreate(name="Seguridad"), admin))
    second = run(server.create_category(server.CategoryCreate(name="Redes"), admin))
    with assert_http(400):
        run(server.create_category(server.CategoryCreate(name="seguridad"), admin))

    with assert_http(403):
        run(server.update_category(first.id, server.CategoryCreate(name="Otra"), rep))
    with assert_http(400):
        run(server.update_category(first.id, server.CategoryCreate(name="redes"), admin))
    with assert_http(404):
        run(server.update_category("missing", server.CategoryCreate(name="Otra"), admin))
    assert run(server.update_category(first.id, server.CategoryCreate(name="Otra"), admin)).name == "Otra"

    fake_db.training_contents.docs.append({"category_ids": [first.id, second.id]})
    with assert_http(403):
        run(server.delete_category(first.id, rep))
    with assert_http(404):
        run(server.delete_category("missing", admin))
    run(server.delete_category(first.id, admin))
    assert fake_db.training_contents.docs[0]["category_ids"] == [second.id]
