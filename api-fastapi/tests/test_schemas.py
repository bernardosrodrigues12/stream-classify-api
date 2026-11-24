import pytest
from pydantic import ValidationError

from app.schemas.classification import (
    ClassificationResult,
    ClassifyRequest,
    ErrorEvent    
)


def test_request_accepts_valid_test():
    request = ClassifyRequest.model_validate({"text": "Meu pedido não chegou"})
    assert request.text == "Meu pedido não chegou"


def test_request_rejects_empty_text():
    with pytest.raises(ValidationError):
        ClassifyRequest.model_validate({"text": ""})


def test_request_rejects_text_above_the_limit():
    with pytest.raises(ValidationError):
        ClassificationResult.model_validate({"text": "a" * 5001})


def test_result_accepts_valid_output():
    result = ClassificationResult.model_validate(
        {"category": "billing", "priority": "high", "summary": "Pedido atrasado"}
    )
    assert result.category == "billing"


def test_result_rejects_category_out_of_enum():
    with pytest.raises(ValidationError):
        ClassificationResult.model_validate(
            {"category": "none", "priority": "high", "summary": "Pedido atrasado"}
        )


def test_result_rejects_absent_field():
    with pytest.raises(ValidationError):
        ClassificationResult.model_validate({"category": "billing", "priority": "high"})


def test_error_event_accepts_valid_event():
    event = ErrorEvent.model_validate(
        {"code": "rate_limited", "message": "Limite atingido", "retryable": True}    
    )
    assert event.retryable is True


def test_error_event_rejects_unknown_code():
    with pytest.raises(ValidationError):
        ErrorEvent.model_validate(
            {"code": "erro_qualquer", "message": "x", "retryable": False}    
        )