"""달리 FastAPI 서버.

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
from pydantic import BaseModel

from middleware.auth import require_internal_key
from services.pipeline.chatbot.pipeline import build_chat_reply
from services.pipeline.chatbot.risk_gate import detect_risk_with_context
from services.pipeline.chatbot.safety_response import get_safety_response
from services.pipeline.report.pipeline import analyze_session


app = FastAPI(title="Dali LLM API")


# ── 헬스체크 ───────────────────────────────────────────────────────────────────
# docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
#
# 파일 구성:
#   [구간 1] import
#   [구간 2] lifespan — 컨테이너 기동 시 모델 1회 로드
#   [구간 3] 앱 생성 / 라우터 등록
#   [구간 4] 헬스체크 엔드포인트

# ═══════════════════════════════════════════════
# [구간 1] import
# ═══════════════════════════════════════════════
from contextlib import asynccontextmanager

from fastapi import FastAPI

from routers import internal
from services.emotion_model import load_model, is_loaded


# ═══════════════════════════════════════════════
# [구간 2] lifespan — 컨테이너 기동 시 모델 1회 로드
# ═══════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


# ═══════════════════════════════════════════════
# [구간 3] 앱 생성 / 라우터 등록
# ═══════════════════════════════════════════════
app = FastAPI(lifespan=lifespan)

app.include_router(internal.router)   # /internal/chat, /internal/stt


# ═══════════════════════════════════════════════
# [구간 4] 헬스체크
# ═══════════════════════════════════════════════
@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── 요청 스키마 ────────────────────────────────────────────────────────────────

class EmotionScores(BaseModel):
    기쁨:  float = 0.0
    슬픔:  float = 0.0
    불안:  float = 0.0
    분노:  float = 0.0
    상처:  float = 0.0
    당황:  float = 0.0


class EmotionAnalysis(BaseModel):
    dominant_emotion: str | None = None
    emotion_scores:   EmotionScores | None = None


class AlertContext(BaseModel):
    alert_id:       int | None = None
    alert_detected: bool = False
    alert_emotion:  str | None = None
    alert_reason:   str | None = None
    alert_message:  str | None = None


class ChatRequest(BaseModel):
    utterance:                str
    user_id:                  int | None = None
    session_id:               int | None = None
    log_id:                   int | None = None
    persona:                  str = "공감형"
    persona_source:           str | None = None
    selected_emotion:         str | None = None
    history:                  list[dict] = []
    current_emotion_analysis: EmotionAnalysis | None = None
    alert_context:            list[AlertContext] | None = None
    recent_summaries:         list[str] | None = None


class ScoreRow(BaseModel):
    joy_score:       float = 0.0
    sad_score:       float = 0.0
    anxiety_score:   float = 0.0
    anger_score:     float = 0.0
    hurt_score:      float = 0.0
    embarrass_score: float = 0.0


class SessionAnalyzeRequest(BaseModel):
    user_id:          int
    selected_emotion: str = "슬픔"
    chat_logs:        list[dict] = []   # [{speaker, utterance}]
    score_rows:       list[ScoreRow] = []


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────

@app.post("/internal/chat", dependencies=[Depends(require_internal_key)])
async def internal_chat(req: ChatRequest):
    """Node.js에서 사용자 발화를 받아 LLM 응답을 반환.

    처리 순서:
      1) risk_gate — 2단계 위험 감지 (키워드 → LLM 문맥 판단)
      2) risk/critical → 고정 안전 응답 반환
      3) watch → 안전 확인 질문 반환
      4) none → 페르소나 + 감정 분석 + alert 컨텍스트 기반 LLM 응답 생성
    """
    utterance = req.utterance or ""

    # ── 위험 감지 ──────────────────────────────────────────────────────────────
    risk = await detect_risk_with_context(utterance, req.history)
    risk_level = risk["risk_level"]

    if risk_level in ("risk", "critical"):
        return {
            "reply": get_safety_response(risk_level),
            "risk": {
                "detected": True,
                "risk_level": risk_level,
                "action": risk["matched_category"],
                "matched_category": risk["matched_category"],
            },
        }

    if risk_level == "watch":
        return {
            "reply": get_safety_response("watch"),
            "risk": {
                "detected": False,
                "risk_level": "watch",
                "action": None,
                "matched_category": risk["matched_category"],
            },
        }

    # ── LLM 응답 생성 ──────────────────────────────────────────────────────────
    emotion_analysis = (
        req.current_emotion_analysis.model_dump() if req.current_emotion_analysis else None
    )
    alert_ctx = (
        [a.model_dump() for a in req.alert_context] if req.alert_context else None
    )

    try:
        reply = await build_chat_reply(
            utterance,
            persona=req.persona,
            emotion=req.selected_emotion,
            history=req.history,
            current_emotion_analysis=emotion_analysis,
            alert_context=alert_ctx,
            recent_summaries=req.recent_summaries,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {e}")

    # 감정 점수 — Node 감정 모델 연동 전까지 0.0 유지 (chat_analyses NOT NULL 대응)
    _STUB = {"joy_score": 0.0, "sad_score": 0.0, "anxiety_score": 0.0,
             "anger_score": 0.0, "hurt_score": 0.0, "embarrass_score": 0.0}

    return {
        "reply": reply,
        "risk": {
            "detected": False,
            "risk_level": "none",
            "action": None,
            "matched_category": None,
        },
        **_STUB,
    }


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
    """세션 종료 후 전체 대화를 분석해 요약·리뷰·미션을 반환.

    Node가 chat_logs, score_rows, selected_emotion을 전달한다.
    """
    try:
        score_rows_dicts = [r.model_dump() for r in req.score_rows]
        result = await analyze_session(req.chat_logs, score_rows_dicts, req.selected_emotion)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 분석 실패: {e}")

    return result

    # model_loaded까지 같이 보고 → 모델이 안 올라온 상태로
    # healthy 처리되는 것을 docker-compose가 구분할 수 있게 함

    return {"status": "ok", "model_loaded": is_loaded()}
