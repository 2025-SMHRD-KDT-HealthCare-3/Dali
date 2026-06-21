"""
fastapi/services/pipeline/summary/pipeline.py
================================================
달리 대화 요약 파이프라인.

- generate_summary : 세션 전체 대화(chat_logs) → LLM 호출 → context_summary 반환
- 용도 : 챗봇 최근 7일 메모리 전용 (사용자에게 직접 노출되지 않음)
"""

from services.pipeline.common.llm_client import call_llm
from services.pipeline.common.llm_models import SUMMARY_MODEL
from services.pipeline.summary.prompts import SUMMARY_SYSTEM_PROMPT


async def generate_summary(conversation: str) -> str:
    """세션 전체 대화 텍스트를 받아 2~5문장 요약을 생성.

    Args:
        conversation: "화자: 발화" 형식으로 합친 전체 대화 텍스트. 빈 문자열이
            들어오지 않는다고 가정(호출부인 session/pipeline.py에서 사전 필터링).

    Returns:
        2~5문장(상한 5), 소프트가드 약 500자 이내 요약 문자열.
    """
    messages = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": f"오늘 대화:\n{conversation}"},
    ]
    summary = await call_llm(messages, temperature=0.5, model=SUMMARY_MODEL)
    return summary.strip()