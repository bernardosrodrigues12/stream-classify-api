import os 

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_model_client
from app.main import app


class FakeModelClient:


    def __init__(
            self,
            chunks: list[str] | None = None,
            error: Exception | None = None,    
        ) -> None:
            self._chunks = chunks or []
            self._error = error


    async def stream_classification(self, texxt: str):
        for chunk in self._chunks:
            yield chunk
        if self._error is not None:
            raise self._error


VALID_CHUNKS = [
    '{"category": "billing", ',
    '"priority": "high", ',
    '"summary": "Pedido atrasado"}'
]


@pytest.fixture(autouse=True)
def block_real_provider(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-tests")


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def use_model():
    def _use(fake_client: FakeModelClient) -> None:
        app.dependency_overrides[get_model_client] = lambda: fake_client

    return _use


def parse_sse_events(body: str) -> list[tuple[str, dict]]:
    import json

    events = []
    for block in body.split("\n\n"):
        if not block.strip():
            continue
        lines = block.splitlines()
        name = lines[0].removeprefix("event: ")
        data = json.loads(lines[1].removeprefix("data: "))
        events.append((name, data))
    return events