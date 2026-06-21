"""
fastapi/services/pipeline/chatbot/risk_gate.py
==================================
위험 감지 파이프라인 (2단계)

1단계: 키워드/패턴 매칭 (빠른 선별)
2단계: 키워드 감지 시 LLM 문맥 판단 (비유·과장 vs 실제 위험 구분)

반환 risk_level:
  none     — 위험 아님, 일반 응답
  watch    — 모호함, 짧은 공감 + 안전 확인 질문
  risk     — 명확한 위험 신호, 안전 응답 우선
  critical — 즉각 위험 가능성, 고정 안전 스크립트
"""

import json
import re

from services.pipeline.common.llm_client import call_llm
from services.pipeline.common.llm_models import RISK_MODEL

_RISK_KEYWORDS: dict[str, list[str]] = {
    "suicide": [
        "죽고 싶", "자살", "목숨 끊", "사라지고 싶", "안 살고 싶",
        "살기 싫", "죽어버리", "죽어야", "스스로 목",
    ],
    "self_harm": [
        "자해", "긋고 싶", "베고 싶", "다치고 싶",
    ],
    "violence": [
        "죽이고 싶", "때리고 싶", "칼로 찌르", "폭력",
    ],
    "farewell": [
        "마지막 인사", "유서", "작별", "이제 안녕",
    ],
}

_JUDGE_PROMPT = """\
당신은 위기 상담 보조 AI입니다.
아래 사용자 발화가 실제 자살·자해·폭력 위험 상황인지 판단하세요.

비유적 표현("배고파 죽겠다", "창피해 죽겠어"), 가사 인용, 일반 감탄사, 과거 회상은 'none'으로 판단하세요.
구체적 계획·방법·시점이 언급되면 'critical'로 판단하세요.

[사용자 발화]
{utterance}

[최근 대화 맥락]
{context}

JSON만 반환하세요 (다른 텍스트 없이):
{{"risk_level": "none|watch|risk|critical", "matched_category": "suicide|self_harm|violence|farewell|unknown", "reason": "한 줄 판단 이유"}}"""


async def detect_risk_with_context(utterance: str, history: list[dict]) -> dict:
    """2단계 위험 감지.

    Args:
        utterance: 현재 사용자 발화
        history:   최근 대화 이력 [{"role": ..., "content": ...}]

    Returns:
        {risk_detected, risk_level, matched_category, reason}
    """
    matched_category: str | None = None
    for category, keywords in _RISK_KEYWORDS.items():
        if any(kw in utterance for kw in keywords):
            matched_category = category
            break

    if not matched_category:
        return {
            "risk_detected": False,
            "risk_level": "none",
            "matched_category": None,
            "reason": None,
        }

    context_lines = [
        f"{'사용자' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
        for m in history[-6:]
    ]
    context = "\n".join(context_lines) if context_lines else "(이전 대화 없음)"

    prompt = _JUDGE_PROMPT.format(utterance=utterance, context=context)
    try:
        raw = await call_llm(
            [{"role": "user", "content": prompt}],
            temperature=0.0,
            model=RISK_MODEL,
        )
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        parsed = json.loads(cleaned)
    except Exception:
        parsed = {
            "risk_level": "watch",
            "matched_category": matched_category,
            "reason": "LLM 판단 실패 — 보수적 처리",
        }

    level = parsed.get("risk_level", "watch")
    category = parsed.get("matched_category", matched_category)
    return {
        "risk_detected": level != "none",
        "risk_level": level,
        "matched_category": category if level != "none" else None,
        "reason": parsed.get("reason"),
    }