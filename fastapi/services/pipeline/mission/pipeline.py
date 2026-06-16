"""달리 회복 미션 생성 파이프라인.

generate_missions : 감정 + 대화 요약 → LLM 호출 → 미션 3개 반환
save_missions     : 미션 리스트 → MySQL missions 테이블에 INSERT
"""

import json
import re

from common.llm_client import call_llm  # call_llm(messages, temperature, model) → str
from .prompts import MISSION_SYSTEM_PROMPT

# 앱에서 정의한 감정 enum
VALID_EMOTIONS = {"기쁨", "슬픔", "분노", "불안", "상처", "당황"}


def generate_missions(emotion: str, conversation: str) -> list[dict]:
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

    raw = call_llm(messages, temperature=0.4)

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


def save_missions(user_id: int, session_id: int, mission_date: str, missions: list[dict]) -> None:
    """파싱된 미션 리스트를 missions 테이블에 한 건씩 INSERT.

    Args:
        user_id: 사용자 ID
        session_id: 대화 세션 ID
        mission_date: 미션 일자 (YYYY-MM-DD)
        missions: generate_missions()가 반환한 dict 리스트 (3개)

    Note:
        get_connection()은 DB 연결 모듈 완성 후 아래 import 교체.
        from common.db import get_connection

    테이블 스키마 → Dali.sql의 missions 테이블 참고.
    mission_content에는 "제목 / 설명 / 카테고리 / 예상N분" 형식으로 합쳐서 저장.
    (테이블이 단일 content 컬럼 구조이기 때문)
    """
    conn = get_connection()  # noqa: F821 — DB 모듈 연결 후 import 추가 예정
    try:
        with conn.cursor() as cursor:
            sql = """
                INSERT INTO missions
                    (user_id, session_id, mission_date, mission_seq, mission_content)
                VALUES
                    (%s, %s, %s, %s, %s)
            """
            for seq, m in enumerate(missions, start=1):
                cursor.execute(sql, (user_id, session_id, mission_date, seq, m["title"]))
        conn.commit()
    finally:
        conn.close()
