from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["billing", "technical", "account", "other"]
Priority = Literal["low", "medium", "high"]
ErrorCode = Literal["rate_limited", "provider_error", "timeout", "invalid_output"]

class ClassifyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)

class ClassificationResult(BaseModel):
    category: Category
    priority: Priority
    summary: str = Field(min_length=1, max_length=300)

class ErrorEvent(BaseModel):
    code: ErrorCode
    message: str
    retryable: bool