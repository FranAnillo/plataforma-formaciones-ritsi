from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import pytest
from fastapi import HTTPException


def run(awaitable):
    return asyncio.run(awaitable)


def as_doc(model: Any) -> dict[str, Any]:
    data = model.model_dump()
    for key, value in list(data.items()):
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


@contextmanager
def assert_http(status_code: int, detail: str | None = None):
    with pytest.raises(HTTPException) as exc_info:
        yield
    assert exc_info.value.status_code == status_code
    if detail is not None:
        assert exc_info.value.detail == detail
