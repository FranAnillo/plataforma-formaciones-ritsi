import os

import pytest

from tests.fake_mongo import FakeDatabase


os.environ.setdefault("MONGO_URL", "mongodb://unused-for-tests:27017")
os.environ.setdefault("DB_NAME", "tests")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

from backend import server  # noqa: E402


@pytest.fixture
def fake_db(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(server, "db", database)
    return database


@pytest.fixture
def users():
    def make_user(
        user_id: str,
        user_type: server.UserType,
        *,
        email: str | None = None,
        university_id: str | None = None,
        is_active: bool = True,
    ):
        return server.User(
            id=user_id,
            email=email or f"{user_id}@example.com",
            name=user_id.replace("-", " ").title(),
            user_type=user_type,
            university_id=university_id,
            is_active=is_active,
        )

    return make_user
