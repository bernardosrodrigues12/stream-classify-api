from functools import lru_cache

from app.services.gemini_client import GeminiClient
from app.services.model_client import ModelClient

@lru_cache
def get_model_client() -> ModelClient:
    return GeminiClient()