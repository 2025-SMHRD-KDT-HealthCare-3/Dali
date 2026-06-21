"""
fastapi/services/pipeline/report/pipeline.py
================================================
달리 한줄평(리포트) 생성 파이프라인.

- generate_review : selected_emotion(주관) + dominant_emotion(분석) + 6감정 점수
→ LLM 호출 → 한 줄(≤255자) 코멘트 반환.

- chat_logs는 사용하지 않는다 (요약,미션과 분리된 입력).
"""

from services.pipeline.common.llm_client import call_llm
from services.pipeline.common.llm_models import REPORT_MODEL
from services.pipeline.report.prompts import REPORT_SYSTEM_PROMPT
from emotions import FIELD_TO_KR


async def generate_review(
    selected_emotion: str,
    dominant_emotion: str,
    scores: dict[str, float],
) -> str:
    """선택 감정·분석 감정·6점수를 받아 한 줄 코멘트를 생성.

    Args:
        selected_emotion: 세션 시작 시 사용자가 고른 주관 감정.
        dominant_emotion: 가중 집계로 산출된 대표(분석) 감정.
        scores: 6감정 점수 dict (joy_score, sad_score, anxiety_score,
            anger_score, hurt_score, embarrass_score).

    Returns:
        255자 이내 한 줄 텍스트.
    """
    is_same = selected_emotion == dominant_emotion
    score_lines = "\n".join(
        f"- {FIELD_TO_KR.get(k, k)}: {v}" for k, v in scores.items()
    )

    user_content = (
        f"사용자가 고른 감정(selected_emotion): {selected_emotion}\n"
        f"분석된 대표 감정(dominant_emotion): {dominant_emotion}\n"
        f"주관-분석 일치 여부(is_same): {is_same}\n"
        f"6감정 점수:\n{score_lines}"
    )

    messages = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    review = await call_llm(messages, temperature=0.6, model=REPORT_MODEL)
    return review.strip()[:255]