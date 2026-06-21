"""
fastapi/services/pipeline/mission/pipeline.py
================================================
달리 회복 미션 생성 파이프라인.

- generate_missions : 사용자 발화 + 대표 감정 + 최근 미션 이력
→ LLM 호출 → 미션 3개(mission_seq 1~3) 반환.

- 요약(summary)을 기다리지 않고, chat_logs(user 발화)를 직접 입력으로 사용해
session/pipeline.py의 asyncio.gather 병렬성을 유지한다.
"""

import json
import re

from services.pipeline.common.llm_client import call_llm
from services.pipeline.common.llm_models import MISSION_MODEL
from services.pipeline.mission.prompts import MISSION_SYSTEM_PROMPT
from emotions import VALID_EMOTIONS

_MAX_CONTENT_LEN = 255  # missions.mission_content VARCHAR(255)


async def generate_missions(
    dominant_emotion: str,
    user_utterances: str,
    recent_missions: list[str] | None = None,
) -> list[dict]:
    """대표 감정·사용자 발화·최근 미션 이력을 받아 회복 미션 3개를 생성.

    Args:
        dominant_emotion: 가중 집계로 산출된 대표 감정 (VALID_EMOTIONS 중 하나).
        user_utterances: chat_logs 중 speaker='user' 발화만 합친 텍스트
            (토큰 절감, 안전·적절성 판단용).
        recent_missions: 최근 5일치 mission_content 문자열 리스트.
            중복 회피용, 없으면 빈 리스트로 취급.

    Returns:
        [{"mission_seq": 1, "mission_content": "..."},
         {"mission_seq": 2, "mission_content": "..."},
         {"mission_seq": 3, "mission_content": "..."}]
    """
    if dominant_emotion not in VALID_EMOTIONS:
        raise ValueError(
            f"지원하지 않는 감정: '{dominant_emotion}'. 허용값: {VALID_EMOTIONS}"
        )

    recent_missions = recent_missions or []
    recent_block = "\n".join(f"- {m}" for m in recent_missions) or "(없음)"

    messages = [
        {"role": "system", "content": MISSION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"대표 감정: {dominant_emotion}\n"
                f"사용자 발화:\n{user_utterances or '(발화 없음)'}\n\n"
                f"최근 5일 추천 미션(중복 피하기):\n{recent_block}"
            ),
        },
    ]

    raw = await call_llm(messages, temperature=0.4, model=MISSION_MODEL)

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

    result = []
    for i, content in enumerate(missions, start=1):
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"mission_content가 비어 있습니다: {missions}")
        result.append({
            "mission_seq": i,
            "mission_content": content.strip()[:_MAX_CONTENT_LEN],
        })

    return result