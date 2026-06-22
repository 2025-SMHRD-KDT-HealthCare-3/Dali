"""
fastapi/services/pipeline/chatbot/orchestrator.py
==================================
챗봇 요청 오케스트레이션

처리 순서:
  0) 감정분석 — risk/watch/none 모든 분기에서 공통으로 필요하므로 가장 먼저 계산
  1) risk_gate — 2단계 위험 감지 (키워드 → LLM 문맥 판단)
  2) risk/critical → 고정 안전 응답 반환
  3) watch → 안전 확인 질문 반환
  4) none → 페르소나 + 감정 분석 + alert 컨텍스트 기반 LLM 응답 생성
"""

from fastapi import HTTPException

from schemas import ChatRequest
from emotions import KR_TO_FIELD
from model_inference.emotion_model import EMOTIONS, predict_emotions
from model_inference.intensity_scaler import scale_by_intensity
from services.pipeline.chatbot.pipeline import build_chat_reply
from services.pipeline.chatbot.risk_gate import detect_risk_with_context
from services.pipeline.chatbot.safety_response import get_safety_response


def _get_scores(utterance: str, history: list[dict]) -> dict:
    """발화 1개 감정분석 — risk/watch/none 모든 분기에서 공통으로 필요."""
    prev_text = next(
        (m.get("content") for m in reversed(history) if m.get("role") == "user"),
        None,
    )
    raw = predict_emotions(utterance, prev_text)
    scores = scale_by_intensity(raw, utterance).scores_after
    return {KR_TO_FIELD[e]: scores[e] for e in EMOTIONS}


async def run_chat(req: ChatRequest) -> dict:
    utterance = req.utterance or ""

    col_scores = _get_scores(utterance, req.history)

    risk = await detect_risk_with_context(
        utterance,
        req.history,
        has_risk_keyword=req.has_risk_keyword,
        matched_category=req.matched_category,
    )
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
            **col_scores,
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
            **col_scores,
        }

    emotion_analysis = (
        req.current_emotion_analysis.model_dump() if req.current_emotion_analysis else None
    )
    alert_ctx = (
        [a.model_dump() for a in req.alert_context] if req.alert_context else None
    )

    # recent_summaries: Node가 { context_summary, created_at } 객체 배열로 전달할 수 있어 str 변환
    raw_summaries = req.recent_summaries or []
    summaries = [
        s if isinstance(s, str) else s.get("context_summary", "")
        for s in raw_summaries
        if s
    ]

    try:
        reply = await build_chat_reply(
            utterance,
            persona=req.persona,
            emotion=req.selected_emotion,
            history=req.history,
            current_emotion_analysis=emotion_analysis,
            alert_context=alert_ctx,
            recent_summaries=summaries or None,
            q3_answer=req.q3_answer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {e}")

    return {
        "reply": reply,
        "risk": {
            "detected": False,
            "risk_level": "none",
            "action": None,
            "matched_category": None,
        },
        **col_scores,
    }