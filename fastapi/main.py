"""
fastapi/main.py
=================
달리 FastAPI 서버

엔드포인트:
  GET  /health                    — 헬스체크 (docker-compose healthcheck)
  POST /internal/chat             — Node → 챗봇 대화 (2단계 위험 감지 + LLM 응답)
  POST /internal/stt              — Node → 음성 파일 → 텍스트 변환 (Whisper)
  POST /sessions/{id}/analyze     — Node → 세션 종료 후 전체 분석

FastAPI는 DB를 직접 조회하지 않는다.
모든 컨텍스트(history, persona, score_rows 등)는 Node가 전달한다.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, File, HTTPException, Path, UploadFile

from middleware.auth import require_internal_key
from middleware.error_handler import register_error_handlers
from schemas import ChatRequest, SessionAnalyzeRequest
from model_inference.emotion_model import is_loaded, load_model
from services.pipeline.chatbot.orchestrator import run_chat
from services.pipeline.session.pipeline import analyze_session


# ── 앱 생성 ────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Dali LLM API", lifespan=lifespan)
register_error_handlers(app)


# ── 헬스체크 ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": is_loaded()}


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────

@app.post("/internal/chat", dependencies=[Depends(require_internal_key)])
async def internal_chat(req: ChatRequest):
    return await run_chat(req)


@app.post("/internal/stt", dependencies=[Depends(require_internal_key)])
async def internal_stt(audio: UploadFile = File(...)):
    """음성 파일을 받아 OpenAI Whisper로 텍스트를 변환."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    audio_bytes = await audio.read()
    try:
        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm"),
            language="ko",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT 변환 실패: {e}")

    return {"text": transcript.text}


@app.post("/sessions/{session_id}/analyze", dependencies=[Depends(require_internal_key)])
async def analyze_session_endpoint(
    session_id: int = Path(...),
    req: SessionAnalyzeRequest = ...,
):
    """세션 종료 후 전체 대화를 분석해 요약·한줄평·미션을 반환."""
    try:
        score_rows_dicts = [r.model_dump() for r in req.score_rows]
        result = await analyze_session(
            chat_logs=req.chat_logs,
            score_rows=score_rows_dicts,
            selected_emotion=req.selected_emotion,
            generate_missions_flag=req.generate_missions,
            recent_missions=req.recent_missions,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 분석 실패: {e}")

    return result