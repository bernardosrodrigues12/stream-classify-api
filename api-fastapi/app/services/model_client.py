from collections.abc import AsyncIterator
from typing import Protocol


class ModelClient(Protocol):
    def stream_classification(self, text: str) -> AsyncIterator[str]:
        ... 