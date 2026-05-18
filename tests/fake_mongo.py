from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any


def _plain(value: Any) -> Any:
    return value.value if isinstance(value, Enum) else value


def _get_nested(doc: dict[str, Any], key: str, default: Any = None) -> Any:
    current: Any = doc
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def _set_nested(doc: dict[str, Any], key: str, value: Any) -> None:
    current = doc
    parts = key.split(".")
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = _plain(value)


def _matches(doc: dict[str, Any], query: dict[str, Any] | None) -> bool:
    if not query:
        return True

    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, branch) for branch in expected):
                return False
            continue

        actual = _get_nested(doc, key)

        if isinstance(expected, dict):
            for operator, value in expected.items():
                value = _plain(value)
                if operator == "$options":
                    continue
                if operator == "$gt":
                    if actual is None or not actual > value:
                        return False
                elif operator == "$in":
                    values = [_plain(item) for item in value]
                    if isinstance(actual, list):
                        if not any(item in values for item in actual):
                            return False
                    elif actual not in values:
                        return False
                elif operator == "$ne":
                    if actual == value:
                        return False
                elif operator == "$regex":
                    flags = re.IGNORECASE if expected.get("$options") == "i" else 0
                    if not re.search(value, str(actual or ""), flags):
                        return False
                else:
                    raise NotImplementedError(f"Operador no soportado en fake mongo: {operator}")
            continue

        expected = _plain(expected)
        if isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False

    return True


def _project(doc: dict[str, Any], projection: dict[str, int] | None) -> dict[str, Any]:
    cloned = copy.deepcopy(doc)
    if not projection:
        return cloned

    included = {key for key, value in projection.items() if value and key != "_id"}
    if included:
        return {key: copy.deepcopy(_get_nested(cloned, key)) for key in included if _get_nested(cloned, key) is not None}

    for key, value in projection.items():
        if value == 0:
            cloned.pop(key, None)
    return cloned


@dataclass
class FakeResult:
    matched_count: int = 0
    modified_count: int = 0
    deleted_count: int = 0


class FakeCursor:
    def __init__(self, docs: list[dict[str, Any]], projection: dict[str, int] | None = None):
        self.docs = [_project(doc, projection) for doc in docs]

    def sort(self, key: str, direction: int):
        self.docs.sort(key=lambda doc: _get_nested(doc, key, ""), reverse=direction < 0)
        return self

    async def to_list(self, length: int | None):
        docs = self.docs if length is None else self.docs[:length]
        return copy.deepcopy(docs)


class FakeCollection:
    def __init__(self):
        self.docs: list[dict[str, Any]] = []

    async def find_one(self, query: dict[str, Any], projection: dict[str, int] | None = None):
        for doc in self.docs:
            if _matches(doc, query):
                return _project(doc, projection)
        return None

    def find(self, query: dict[str, Any] | None = None, projection: dict[str, int] | None = None):
        return FakeCursor([doc for doc in self.docs if _matches(doc, query)], projection)

    async def insert_one(self, doc: dict[str, Any]):
        self.docs.append(copy.deepcopy(doc))
        return FakeResult(matched_count=1, modified_count=1)

    async def count_documents(self, query: dict[str, Any]):
        return sum(1 for doc in self.docs if _matches(doc, query))

    async def update_one(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False):
        for doc in self.docs:
            if _matches(doc, query):
                self._apply_update(doc, update, inserting=False)
                return FakeResult(matched_count=1, modified_count=1)

        if upsert:
            new_doc = {key: _plain(value) for key, value in query.items() if not key.startswith("$") and not isinstance(value, dict)}
            self._apply_update(new_doc, update, inserting=True)
            self.docs.append(new_doc)
            return FakeResult(matched_count=0, modified_count=1)

        return FakeResult()

    async def update_many(self, query: dict[str, Any], update: dict[str, Any]):
        matched = 0
        for doc in self.docs:
            if _matches(doc, query):
                self._apply_update(doc, update, inserting=False)
                matched += 1
        return FakeResult(matched_count=matched, modified_count=matched)

    async def delete_one(self, query: dict[str, Any]):
        for index, doc in enumerate(self.docs):
            if _matches(doc, query):
                del self.docs[index]
                return FakeResult(deleted_count=1)
        return FakeResult()

    async def delete_many(self, query: dict[str, Any]):
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if not _matches(doc, query)]
        return FakeResult(deleted_count=before - len(self.docs))

    @staticmethod
    def _apply_update(doc: dict[str, Any], update: dict[str, Any], inserting: bool) -> None:
        for operator, values in update.items():
            if operator == "$set":
                for key, value in values.items():
                    _set_nested(doc, key, value)
            elif operator == "$push":
                for key, value in values.items():
                    doc.setdefault(key, []).append(_plain(value))
            elif operator == "$pull":
                for key, value in values.items():
                    doc[key] = [item for item in doc.get(key, []) if item != _plain(value)]
            elif operator == "$addToSet":
                for key, value in values.items():
                    target = doc.setdefault(key, [])
                    additions = value.get("$each", []) if isinstance(value, dict) else [value]
                    for addition in additions:
                        addition = _plain(addition)
                        if addition not in target:
                            target.append(addition)
            elif operator == "$setOnInsert":
                if inserting:
                    for key, value in values.items():
                        _set_nested(doc, key, value)
            else:
                raise NotImplementedError(f"Actualización no soportada en fake mongo: {operator}")


class FakeDatabase:
    collections = (
        "users",
        "user_sessions",
        "user_progress",
        "content_assignments",
        "activity_logs",
        "universities",
        "thematic_commissions",
        "categories",
        "training_contents",
    )

    def __init__(self):
        for name in self.collections:
            setattr(self, name, FakeCollection())

    async def command(self, name: str):
        if name != "ping":
            raise ValueError(name)
        return {"ok": 1}
