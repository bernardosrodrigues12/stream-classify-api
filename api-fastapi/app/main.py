from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.routes.classify import router as classify_router
from app.routes.health import router as health_router

app = FastAPI(title="Stream Classify API", version="0.3.0")

app.include_router(health_router)
app.include_router(classify_router)