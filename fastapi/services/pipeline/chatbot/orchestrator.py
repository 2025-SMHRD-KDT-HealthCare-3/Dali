"""
fastapi/services/pipeline/chatbot/orchestrator.py
==================================
챗봇 요청 오케스트레이션

처리 순서 (병렬 최적화):
  0) 감정분석 — 항상 수행 (Node의 chat_analyses DB 저장용)
  1) is_in_safety_mode=True → 즉시 안전모드 응답 (LLM/위험감지 스킵)
  2) risk_gate + LLM 병렬 실행 (none/watch가 대부분 → risk_gate 대기 시간 제거)
  3) _derive_service_state — 파생 상태 계산 (DB 저장 없음)
  4) fixed_safety → 낙관 LLM 취소, 고정 안전 응답 반환
  5) cautious → 낙관 LLM 취소, cautious_mode=True로 재호출
  6) normal → 낙관 LLM 결과 그대로 사용 (추가 대기 없음)

파생 상태값 (DB 저장 안 함, 매 요청마다 계산):
  service_action, response_mode, safety_mode, should_block_chat, show_hotline

Node가 DB에 저장하는 값 (risk/critical 시에만):
  risk_events.risk_level, .matched_category, .judge_factors (JSON)
"""

import asyncio

from fastapi import HTTPException

from schemas import ChatRequest
from emotions import KR_TO_FIELD
from model_inference.emotion_model import EMOTIONS, predict_emotions
from model_inference.intensity_scaler import scale_by_intensity
from services.pipeline.chatbot.pipeline import build_chat_reply
from services.pipeline.chatbot.risk_gate import detect_risk_with_context
from services.pipeline.chatbot.safety_response import get_safety_response

_JUDGE_FACTOR_KEYS = (
    "intent", "current", "plan", "method",
    "timeframe", "access_or_alone", "metaphor_or_past", "reason",
)


def _get_scores(utterance: str, history: list[dict]) -> dict:
    prev_text = next(
        (m.get("content") for m in reversed(history) if m.get("role") == "user"),
        None,
    )
    raw = predict_emotions(utterance, prev_text)
    scores = scale_by_intensity(raw, utterance).scores_after
    return {KR_TO_FIELD[e]: scores[e] for e in EMOTIONS}


def _derive_service_state(
    risk_level: str,
    prior_risk_count: int,
    matched_category: str | None = None,
) -> dict:
    """risk_level + matched_category + 세션 내 기존 risk 횟수 → 서비스 상태 계산.

    반환값은 모두 파생 상태값으로 DB에 저장하지 않는다.

    Args:
        risk_level:       GPT Judge 판단 결과 (none|watch|risk|critical)
        prior_risk_count: 이번 요청 이전 세션 내 risk 레벨 이벤트 수
        matched_category: 감지된 위험 카테고리 (suicide|self_harm|violence|farewell|unknown)
    """
    # 폭력 의도 확인 → 누적 횟수 무관, 즉시 안전모드 (자해·자살 정책과 독립)
    if matched_category == "violence":
        return {
            "service_action": "urgent_safety_mode",
            "response_mode": "fixed_safety",
            "safety_mode": True,
            "should_block_chat": True,
            "show_hotline": True,
        }

    if risk_level in ("none", "watch"):
        return {
            "service_action": "normal_empathy",
            "response_mode": "normal",
            "safety_mode": False,
            "should_block_chat": False,
            "show_hotline": False,
        }

    if risk_level == "critical":
        return {
            "service_action": "urgent_safety_mode",
            "response_mode": "fixed_safety",
            "safety_mode": True,
            "should_block_chat": True,
            "show_hotline": True,
        }

    # risk 레벨 — 이번 포함 누적 횟수로 분기
    if prior_risk_count + 1 < 3:
        return {
            "service_action": "offer_support_choice",
            "response_mode": "cautious",
            "safety_mode": False,
            "should_block_chat": False,
            "show_hotline": True,
        }

    return {
        "service_action": "enter_safety_mode",
        "response_mode": "fixed_safety",
        "safety_mode": True,
        "should_block_chat": True,
        "show_hotline": True,
    }


async def _cancel(task: asyncio.Task) -> None:
    """Task를 취소하고 CancelledError를 소비해 경고 로그를 억제한다."""
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass


async def run_chat(req: ChatRequest) -> dict:
    utterance = req.utterance or ""
    print(f"[run_chat] persona={req.persona!r}  user_id={req.user_id}  history_len={len(req.history)}", flush=True)

    # 0) 감정분석 — 안전모드 분기에서도 Node의 chat_analyses 저장을 위해 항상 수행
    col_scores = _get_scores(utterance, req.history)

    # 1) 이미 안전모드인 세션 → LLM/위험감지 없이 즉시 반환
    if req.is_in_safety_mode:
        return {
            "reply": get_safety_response("enter_safety_mode"),
            "risk_level": "safety_mode_active",
            "matched_category": None,
            "service_action": "enter_safety_mode",
            "response_mode": "fixed_safety",
            "safety_mode": True,
            "should_block_chat": True,
            "show_hotline": True,
            "safety_mode_triggered": False,
            "judge_factors": None,
            **col_scores,
        }

    # LLM 공통 파라미터 미리 준비
    emotion_analysis = (
        req.current_emotion_analysis.model_dump() if req.current_emotion_analysis else None
    )
    alert_ctx = (
        [a.model_dump() for a in req.alert_context] if req.alert_context else None
    )
    summaries = [
        s if isinstance(s, str) else s.get("context_summary", "")
        for s in (req.recent_summaries or [])
        if s
    ]
    llm_kwargs = dict(
        persona=req.persona,
        emotion=req.selected_emotion,
        history=req.history,
        current_emotion_analysis=emotion_analysis,
        alert_context=alert_ctx,
        recent_summaries=summaries or None,
        q3_answer=req.q3_answer,
    )

    # 2) risk_gate + LLM 병렬 실행
    # none/watch(대부분)는 LLM 결과를 그대로 사용 → risk_gate 대기 시간 제거
    risk_task = asyncio.create_task(
        detect_risk_with_context(
            utterance,
            req.history,
            has_risk_keyword=req.has_risk_keyword,
            matched_category=req.matched_category,
        )
    )
    llm_task = asyncio.create_task(
        build_chat_reply(utterance, cautious_mode=False, **llm_kwargs)
    )

    risk = await risk_task
    risk_level       = risk["risk_level"]
    matched_category = risk.get("matched_category")

    # 3) 서비스 상태 계산
    service_state = _derive_service_state(risk_level, req.prior_risk_count, matched_category)
    print(
        f"[pipeline] risk_level={risk_level!r}  matched_category={matched_category!r}  "
        f"service_action={service_state['service_action']!r}  "
        f"response_mode={service_state['response_mode']!r}  "
        f"should_block_chat={service_state['should_block_chat']}",
        flush=True,
    )

    judge_factors = (
        {k: risk.get(k) for k in _JUDGE_FACTOR_KEYS}
        if risk_level in ("risk", "critical")
        else None
    )
    base = {
        "risk_level": risk_level,
        "matched_category": matched_category,
        **service_state,
        "safety_mode_triggered": service_state["should_block_chat"],
        "judge_factors": judge_factors,
        **col_scores,
    }

    # 4) fixed_safety → 낙관 LLM 취소, 고정 응답 반환
    if service_state["response_mode"] == "fixed_safety":
        await _cancel(llm_task)
        response_key = (
            "violence_urgent_safety_mode"
            if matched_category == "violence"
            else service_state["service_action"]
        )
        return {"reply": get_safety_response(response_key), **base}

    # 5) cautious → 낙관 LLM 취소, cautious_mode=True로 재호출
    if service_state["response_mode"] == "cautious":
        await _cancel(llm_task)
        try:
            reply = await build_chat_reply(utterance, cautious_mode=True, **llm_kwargs)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {e}")
        return {"reply": reply, **base}

    # 6) normal → 낙관 LLM 결과 그대로 사용 (추가 대기 없음)
    try:
        reply = await llm_task
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {e}")

    return {"reply": reply, **base}
