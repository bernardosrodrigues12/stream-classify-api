from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.dependencies import get_model_client
from app.schemas.classification import ClassificationResult, ClassifyRequest, ErrorEvent
from app.services.model_client import ModelClient
from app.sse.events import format_sse

router = APIRouter(prefix="/api")

async def classify_events(text: str, client: ModelClient) -> AsyncIterator[str]:
    chunks: list[str] = []
    stream = client.stream_classification(text)

    try: 
        async for token in client.stream_classification(text):
            chunks.append(token)
            yield format_sse("token", {"text": token})
    except Exception:
        error = ErrorEvent(
            code="provider_error",
            message="Falha ao consultar o modelo.",
            retryable=True,
        )
        yield format_sse("error", error.model_dump())
        return

    try:
        result = ClassificationResult.model_validate_json("".join(chunks))
    except ValidationError:
        error = ErrorEvent(
            code="invalid_output",
            message="A resposta do modelo não passou na validação.",
            retryable=False,    
        )
        yield format_sse("error", error.model_dump())
        return

    yield format_sse("result", result.model_dump())


@router.post("/classify")
async def classify(
    request: ClassifyRequest,
    client: Annotated[ModelClient, Depends(get_model_client)],
) -> StreamingResponse:
    return StreamingResponse(
        classify_events(request.text, client),
        media_type="text/event-stream",
        headers={"Cahce-Control": "no-cache"}    
    )