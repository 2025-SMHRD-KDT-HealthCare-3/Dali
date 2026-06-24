"""
fastapi/services/pipeline/chatbot/pipeline.py
==================================
달리 챗봇 대화 파이프라인

build_chat_reply : 페르소나 로드 → 메시지 조립 → LLM 호출 → 응답 반환
"""

import json
import random
from pathlib import Path

from services.pipeline.common.llm_client import call_llm
from services.pipeline.common.llm_models import CHATBOT_MODEL

ASSET_DIR = Path(__file__).parent / "assets"
DEFAULT_PERSONA = "공감형"

VALID_PERSONAS = {"공감형", "동기부여형", "분석형", "친구형"}

MAX_HISTORY_TURNS = 6


def _load_persona(persona: str) -> dict:
    name = persona if persona in VALID_PERSONAS else DEFAULT_PERSONA
    path = ASSET_DIR / "persona" / f"{name}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _build_system_message(persona_data: dict) -> str:
    rules_text = "\n".join(f"- {r}" for r in persona_data.get("rules", []))
    tone = persona_data.get("tone", "")
    return f"{persona_data['system']}\n\n말투: {tone}\n\n지침:\n{rules_text}"


def _fewshot_messages(persona_data: dict, emotion: str | None) -> list[dict]:
    """페르소나 JSON의 fewshot에서 현재 감정에 맞는 예시를 우선 선택."""
    examples: list[dict] = persona_data.get("fewshot", [])
    if not examples:
        return []

    matched = [e for e in examples if e.get("감정") == emotion]
    others = [e for e in examples if e.get("감정") != emotion]
    random.shuffle(others)
    selected = (matched + others)[:2]

    messages: list[dict] = []
    for ex in selected:
        messages.append({"role": "user", "content": ex["사용자 발화"]})
        messages.append({"role": "assistant", "content": ex["코치 응답"]})
    return messages


async def build_chat_reply(
    utterance: str,
    *,
    persona: str = DEFAULT_PERSONA,
    emotion: str | None = None,
    history: list[dict] | None = None,
    current_emotion_analysis: dict | None = None,
    alert_context: list[dict] | None = None,
    recent_summaries: list[str] | None = None,
    q3_answer: str | None = None,
    cautious_mode: bool = False,
) -> str:
    """LLM에 메시지를 조립하고 응답 텍스트를 반환.

    Args:
        utterance:                현재 사용자 발화
        persona:                  페르소나 코드 (공감형 | 동기부여형 | 분석형 | 친구형)
        emotion:                  세션 시작 시 선택한 감정 (few-shot 선택에 활용)
        history:                  이전 대화 [{"role": ..., "content": ...}]
        current_emotion_analysis: 현재 발화 감정 분석 결과 (톤 조절용 참고값)
        alert_context:            감정주의신호 맥락 (페르소나 응답 강도 조절용)
        recent_summaries:         최근 세션 요약 목록 (대화 맥락 보강용)
        q3_answer:                온보딩 q3(신경 쓰이는 영역) — 대화 맥락 보강용
        cautious_mode:            True 시 신중 모드 지침 주입 (risk 1~2회 감지 시)
    """
    persona_data = _load_persona(persona)

    messages: list[dict] = []

    system_content = _build_system_message(persona_data)
    system_content += _build_context_block(
        emotion, current_emotion_analysis, alert_context, recent_summaries, q3_answer,
        cautious_mode=cautious_mode,
    )
    print(f"[pipeline] persona={persona!r}  system_prompt_preview={system_content[:120]!r}", flush=True)
    messages.append({"role": "system", "content": system_content})

    messages.extend(_fewshot_messages(persona_data, emotion))

    if history:
        trimmed = history[-(MAX_HISTORY_TURNS * 2):]
        messages.extend(trimmed)

    messages.append({"role": "user", "content": utterance})

    return await call_llm(messages, temperature=0.7, model=CHATBOT_MODEL)


def _build_context_block(
    emotion: str | None,
    current_emotion_analysis: dict | None,
    alert_context: list[dict] | None,
    recent_summaries: list[str] | None,
    q3_answer: str | None = None,
    cautious_mode: bool = False,
) -> str:
    """시스템 메시지에 추가할 동적 컨텍스트 블록."""
    from services.pipeline.chatbot.safety_response import CAUTIOUS_MODE_PROMPT

    parts: list[str] = []

    # 신중 모드 지침을 가장 먼저 주입해 LLM이 최우선으로 읽도록 함
    if cautious_mode:
        parts.append(CAUTIOUS_MODE_PROMPT)

    if q3_answer:
        parts.append(
            f"\n\n[사용자 관심 영역 — 온보딩 답변, 대화 맥락 참고용]\n"
            f"신경 쓰이는 영역: {q3_answer}\n"
            "이 내용을 직접 언급하지 말고, 공감 방향을 잡는 데만 활용할 것."
        )

    if emotion:
        parts.append(f"\n\n[오늘 선택 감정]\n{emotion}")

    if current_emotion_analysis:
        dominant = current_emotion_analysis.get("dominant_emotion", "")
        scores = current_emotion_analysis.get("emotion_scores", {})
        score_str = " / ".join(f"{k} {v}" for k, v in scores.items()) if scores else ""
        parts.append(
            f"\n\n[현재 발화 감정 분석 — 톤 조절 참고용, 직접 언급 금지]\n"
            f"대표 감정: {dominant}\n"
            f"감정 점수: {score_str}"
        )

    if alert_context:
        detected = [a for a in alert_context if a.get("alert_detected")]
        if detected:
            emotions = ", ".join(
                a["alert_emotion"] for a in detected if a.get("alert_emotion")
            )
            reasons = "\n".join(
                f"- {a['alert_reason']}" for a in detected if a.get("alert_reason")
            )
            parts.append(
                f"\n\n[감정주의신호 — 기본 페르소나 유지, 응답 강도만 조절]\n"
                f"반복 감정: {emotions}\n"
                f"상황:\n{reasons}\n"
                "안정감을 강화하고, 감정을 가볍게 넘기지 말 것. 진단하듯 표현하지 말 것."
            )

    if recent_summaries:
        summaries_str = "\n".join(f"- {s}" for s in recent_summaries)
        parts.append(f"\n\n[최근 세션 요약 — 대화 맥락 참고]\n{summaries_str}")

    return "".join(parts)