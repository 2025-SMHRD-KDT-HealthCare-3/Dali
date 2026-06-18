"""달리 FastAPI 서버.

엔드포인트:
  GET  /health                    — 헬스체크 (docker-compose healthcheck)
  POST /internal/chat             — Node → 챗봇 대화 (LLM 응답 + 감정 점수)
  POST /internal/stt              — Node → 음성 파일 → 텍스트 변환 (Whisper)
  POST /onboarding/context        — Node → 온보딩 q3 자유 답변 수신
  POST /sessions/{id}/analyze     — Node → 세션 종료 후 전체 분석
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import aiomysql
from fastapi import Depends, FastAPI, File, HTTPException, Path, UploadFile
from pydantic import BaseModel

import common.db as db
from middleware.auth import require_internal_key
from services.pipeline.chatbot.pipeline import build_chat_reply, detect_risk
from services.pipeline.report.pipeline import analyze_session


# ── 앱 수명주기 ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.create_pool()
    yield
    await db.close_pool()


app = FastAPI(title="Dali LLM API", lifespan=lifespan)


# ── 헬스체크 ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── 요청 스키마 ────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    log_id:     int | None = None
    session_id: int | None = None
    user_id:    int | None = None
    utterance:  str


class OnboardingContextRequest(BaseModel):
    user_id:   int
    q3_answer: str


class SessionAnalyzeRequest(BaseModel):
    user_id: int


# ── 내부 DB 헬퍼 ───────────────────────────────────────────────────────────────

async def _fetch_user_persona(user_id: int) -> str:
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT persona FROM users WHERE user_id = %s",
                (user_id,),
            )
            row = await cur.fetchone()
            return row[0] if row and row[0] else "공감형"


async def _fetch_chat_history(session_id: int, limit: int = 20) -> list[dict]:
    """최근 대화를 [{"role": ..., "content": ...}] 형식으로 반환."""
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT speaker, utterance
                FROM chat_logs
                WHERE session_id = %s
                ORDER BY turn_idx DESC
                LIMIT %s
                """,
                (session_id, limit),
            )
            rows = await cur.fetchall()
    rows = list(reversed(rows))
    return [
        {"role": "user" if r[0] == "user" else "assistant", "content": r[1] or ""}
        for r in rows
    ]


async def _fetch_session_logs(session_id: int) -> list[dict]:
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT speaker, utterance FROM chat_logs WHERE session_id = %s ORDER BY turn_idx ASC",
                (session_id,),
            )
            rows = await cur.fetchall()
    return [{"speaker": r[0], "utterance": r[1]} for r in rows]


async def _fetch_score_rows(session_id: int) -> list[dict]:
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT la.joy_score, la.sad_score, la.anxiety_score,
                       la.anger_score, la.hurt_score, la.embarrass_score
                FROM chat_analyses la
                JOIN chat_logs cl ON la.log_id = cl.log_id
                WHERE cl.session_id = %s AND cl.speaker = 'user'
                """,
                (session_id,),
            )
            rows = await cur.fetchall()
    cols = ["joy_score", "sad_score", "anxiety_score", "anger_score", "hurt_score", "embarrass_score"]
    return [dict(zip(cols, r)) for r in rows]


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────

@app.post("/internal/chat", dependencies=[Depends(require_internal_key)])
async def internal_chat(req: ChatRequest):
    """Node.js에서 사용자 발화를 받아 LLM 응답과 감정 점수를 반환.

    감정 분석(KoELECTRA)은 에스라 파트에서 구현 예정.
    현재는 세션 선택 감정 기준 stub 점수를 반환.
    """
    utterance = req.utterance or ""

    # 위기 키워드 검사
    risk = detect_risk(utterance)
    if risk["detected"]:
        return {
            "reply": None,
            "risk": {"detected": True, "action": risk["category"]},
            "joy_score": 0.1, "sad_score": 0.1, "anxiety_score": 0.1,
            "anger_score": 0.1, "hurt_score": 0.1, "embarrass_score": 0.1,
        }

    # 세션·유저 정보 조회
    persona = "공감형"
    emotion = None
    history: list[dict] = []

    if req.session_id:
        try:
            pool = db.get_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT selected_emotion FROM sessions WHERE session_id = %s",
                        (req.session_id,),
                    )
                    row = await cur.fetchone()
                    if row:
                        emotion = row[0]
        except Exception:
            pass

        try:
            history = await _fetch_chat_history(req.session_id)
            # 방금 저장된 현재 발화가 history 말미에 있으면 제거 (중복 방지)
            if history and history[-1]["role"] == "user" and history[-1]["content"] == utterance:
                history = history[:-1]
        except Exception:
            pass

    if req.user_id:
        try:
            persona = await _fetch_user_persona(req.user_id)
        except Exception:
            pass

    # LLM 응답 생성
    try:
        reply = await build_chat_reply(
            utterance,
            persona=persona,
            emotion=emotion,
            history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {e}")

    # 감정 점수 stub (KoELECTRA 연동 전 — 선택 감정에 높은 점수 부여)
    _EMOTION_TO_FIELD = {
        "기쁨": "joy_score", "슬픔": "sad_score", "불안": "anxiety_score",
        "분노": "anger_score", "상처": "hurt_score", "당황": "embarrass_score",
    }
    scores = {f: 0.1 for f in _EMOTION_TO_FIELD.values()}
    if emotion and emotion in _EMOTION_TO_FIELD:
        scores[_EMOTION_TO_FIELD[emotion]] = 0.5

    return {"reply": reply, "risk": {"detected": False, "action": None}, **scores}


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


@app.post("/onboarding/context", dependencies=[Depends(require_internal_key)])
async def onboarding_context(req: OnboardingContextRequest):
    """온보딩 자유 답변(q3)을 수신. 현재는 수신 확인만 반환."""
    return {"ok": True}


@app.post("/sessions/{session_id}/analyze", dependencies=[Depends(require_internal_key)])
async def analyze_session_endpoint(
    session_id: int = Path(...),
    req: SessionAnalyzeRequest = ...,
):
    """세션 종료 후 전체 대화를 분석해 감정 점수·요약·리뷰·미션을 반환."""
    try:
        chat_logs = await _fetch_session_logs(session_id)
        score_rows = await _fetch_score_rows(session_id)

        selected_emotion = "슬픔"
        try:
            pool = db.get_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT selected_emotion FROM sessions WHERE session_id = %s",
                        (session_id,),
                    )
                    row = await cur.fetchone()
                    if row and row[0]:
                        selected_emotion = row[0]
        except Exception:
            pass

        result = await analyze_session(chat_logs, score_rows, selected_emotion)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 분석 실패: {e}")

    return result
