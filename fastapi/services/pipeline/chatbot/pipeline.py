"""달리 챗봇 대화 파이프라인.

build_chat_reply: 페르소나 로드 → 메시지 조립 → LLM 호출 → 응답 반환
detect_risk:      발화에서 위기 키워드 감지 → {detected, category}
"""

import json
import random
from pathlib import Path

from common.llm_client import call_llm

ASSET_DIR = Path(__file__).parent.parent.parent / "asset"
DEFAULT_PERSONA = "공감형"

# 지원하는 페르소나 목록
VALID_PERSONAS = {"공감형", "동기부여형", "분석형", "친구형"}

# 위기 키워드 목록 (by category)
_RISK_KEYWORDS: dict[str, list[str]] = {
    "자살/자해": [
        "죽고 싶", "자살", "자해", "목숨 끊", "사라지고 싶", "안 살고 싶",
        "살기 싫", "죽어버리", "죽어야", "스스로 목",
    ],
    "폭력": [
        "죽이고 싶", "때리고 싶", "칼로", "폭력",
    ],
}

# 히스토리에서 LLM에 넘길 최대 턴 수 (user+assistant 각 N개)
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

    # 현재 감정 예시 우선, 부족하면 랜덤으로 채움
    matched = [e for e in examples if e.get("감정") == emotion]
    others = [e for e in examples if e.get("감정") != emotion]
    random.shuffle(others)
    selected = (matched + others)[:2]  # 최대 2쌍

    messages: list[dict] = []
    for ex in selected:
        messages.append({"role": "user", "content": ex["사용자 발화"]})
        messages.append({"role": "assistant", "content": ex["코치 응답"]})
    return messages


def detect_risk(utterance: str) -> dict:
    """발화에서 위기 키워드를 검사한다.

    Returns:
        {"detected": bool, "category": str | None}
    """
    for category, keywords in _RISK_KEYWORDS.items():
        if any(kw in utterance for kw in keywords):
            return {"detected": True, "category": category}
    return {"detected": False, "category": None}


async def build_chat_reply(
    utterance: str,
    *,
    persona: str = DEFAULT_PERSONA,
    emotion: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """LLM에 메시지를 조립하고 응답 텍스트를 반환.

    Args:
        utterance: 현재 사용자 발화
        persona:   유저의 페르소나 코드 (공감형 | 동기부여형 | 분석형 | 친구형)
        emotion:   세션 시작 시 선택한 감정 (few-shot 선택에 활용)
        history:   이전 대화 [{"role": "user"|"assistant", "content": ...}, ...]

    Returns:
        LLM이 생성한 응답 텍스트
    """
    persona_data = _load_persona(persona)

    messages: list[dict] = []

    # 1) 시스템 메시지
    messages.append({
        "role": "system",
        "content": _build_system_message(persona_data),
    })

    # 2) 감정별 few-shot 예시 (대화 히스토리 앞에 배치)
    messages.extend(_fewshot_messages(persona_data, emotion))

    # 3) 최근 대화 히스토리 (최대 N 턴)
    if history:
        trimmed = history[-(MAX_HISTORY_TURNS * 2):]
        messages.extend(trimmed)

    # 4) 현재 발화
    messages.append({"role": "user", "content": utterance})

    return await call_llm(messages, temperature=0.7)
