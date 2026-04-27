from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.chatbot import Chatbot

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    language: Literal["en", "hi"] = "en"
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    quick_replies: list[str] = []
    meta: dict[str, Any] = {}


app = FastAPI(title="Women Farmer AI Health Assistant", version="0.1.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

chatbot = Chatbot()


@app.middleware("http")
async def no_store_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    session_id = payload.session_id or uuid.uuid4().hex
    result = chatbot.reply(message=message, language=payload.language, session_id=session_id)

    return ChatResponse(
        session_id=session_id,
        reply=result["reply"],
        quick_replies=result.get("quick_replies", []),
        meta=result.get("meta", {}),
    )


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "index.html"))
