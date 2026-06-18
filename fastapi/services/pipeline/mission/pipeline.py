"""달리 회복 미션 생성 파이프라인.

generate_missions : 감정 + 대화 요약 → LLM 호출 → 미션 3개 반환
"""

import json
import re

from common.llm_client import call_llm  # call_llm(messages, temperature, model) → str
from .prompts import MISSION_SYSTEM_PROMPT

# 앱에서 정의한 감정 enum
VALID_EMOTIONS = {"기쁨", "슬픔", "분노", "불안", "상처", "당황"}


async def generate_missions(emotion: str, conversation: str) -> list[dict]:
    """감정 점수·대화 요약을 받아 회복 미션 3개를 생성하고 dict 리스트로 반환.

    Args:
        emotion: 사용자 감정 (VALID_EMOTIONS 중 하나)
        conversation: 세션 대화 요약 텍스트

    Returns:
        [{"title": ..., "description": ..., "category": ..., "estimated_minutes": ...}, ...]
    """
    if emotion not in VALID_EMOTIONS:
        raise ValueError(f"지원하지 않는 감정: '{emotion}'. 허용값: {VALID_EMOTIONS}")

    messages = [
        {"role": "system", "content": MISSION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"현재 감정: {emotion}\n대화 요약: {conversation}",
        },
    ]

    raw = await call_llm(messages, temperature=0.4)

    # LLM이 ```json ... ``` 블록으로 감싸는 경우 방어
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"LLM 응답을 JSON으로 파싱할 수 없습니다.\n원인: {e}\n원본 응답:\n{raw}"
        ) from e

    missions = parsed.get("missions")
    if not isinstance(missions, list) or len(missions) != 3:
        raise ValueError(
            f"missions 배열이 정확히 3개여야 합니다. 실제 응답: {parsed}"
        )

    return missions
