"""
FastAPI 내부 전용 API 라우터 (/internal/*)

Node.js 전용. X-Internal-API-Key 헤더로만 인증된다.

엔드포인트:
  POST /internal/chat  — 감정 분석 + 위기 판정 + LLM 공감 답변 생성
  POST /internal/stt   — 음성 파일 → Whisper → 텍스트 반환
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from openai import OpenAI
from pydantic import BaseModel

from middleware.internal_auth import verify_internal_key
from services.chat_service import generate_reply
from services.emotion_model import EMOTIONS, predict_emotions
from services.risk_detector import detect_risk
from utils.intensity_scaler import scale_by_intensity

router = APIRouter(prefix="/internal", tags=["internal"])
_openai = OpenAI()

_COLUMN_MAP = {
    "기쁨": "joy_score",   "슬픔": "sad_score",   "불안": "anxiety_score",
    "분노": "anger_score", "상처": "hurt_score",   "당황": "embarrass_score",
}


# ── 스키마 ────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    log_id: Optional[int] = None
    session_id: Optional[int] = None
    user_id: Optional[int] = None
    utterance: str
    history: list[HistoryMessage] = []
    persona: Optional[str] = None


class RiskResponse(BaseModel):
    detected: bool
    action: Optional[str] = None


class ChatResponse(BaseModel):
    reply: Optional[str]
    risk: RiskResponse
    joy_score: float
    sad_score: float
    anxiety_score: float
    anger_score: float
    hurt_score: float
    embarrass_score: float


# ── 엔드포인트 ────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def internal_chat(payload: ChatRequest, _=Depends(verify_internal_key)):
    # ① 위기 판정
    risk = detect_risk(payload.utterance)

    # ② 감정 추론 — history의 마지막 user 발화를 prev_text로 사용
    prev_text = next(
        (m.content for m in reversed(payload.history) if m.role == "user"),
        None,
    )
    raw = predict_emotions(payload.utterance, prev_text)
    scores = scale_by_intensity(raw, payload.utterance).scores_after
    col_scores = {_COLUMN_MAP[e]: scores[e] for e in EMOTIONS}

    # ③ LLM 응답 (위기 감지 시 건너뜀)
    reply = None
    if not risk.detected:
        history_dicts = [{"role": m.role, "content": m.content} for m in payload.history]
        reply = generate_reply(payload.utterance, history_dicts, payload.persona)

    return ChatResponse(
        reply=reply,
        risk=RiskResponse(detected=risk.detected, action=risk.action),
        **col_scores,
    )


@router.post("/stt")
async def internal_stt(audio: UploadFile = File(...), _=Depends(verify_internal_key)):
    data = await audio.read()
    transcript = _openai.audio.transcriptions.create(
        model="whisper-1",
        file=(audio.filename, data, audio.content_type),
        language="ko",
    )
    return {"text": transcript.text}
