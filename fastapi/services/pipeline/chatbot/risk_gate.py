"""
fastapi/services/pipeline/chatbot/risk_gate.py
==================================
위험 감지 파이프라인 (2단계)

1단계: Node의 riskKeywords.js 1차 감지 결과 수신 (has_risk_keyword)
       FastAPI 내부 키워드 목록은 Node가 누락했을 때의 폴백용
2단계: 키워드 감지 시 LLM 문맥 판단 — 비유/과장 vs 실제 위험 구분

반환 risk_level:
  none     — 위험 아님, 일반 공감 대화
  watch    — 힘듦이 크거나 모호한 표현, 서비스상 일반 공감 대화로 처리
  risk     — 자해/자살/폭력 의도 비교적 명확, 구체적 계획/방법/시점 없음
  critical — 의도 + 현재성 + 구체적 방법/계획/시점 중 1개 이상 동시 감지

저장 대상 (Node → risk_events):
  risk_level, matched_category, judge_factors (JSON)
  judge_factors = {intent, current, plan, method, timeframe, access_or_alone, metaphor_or_past, reason}
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
당신은 감정 회복 챗봇의 위기 신호 판단 보조 AI입니다.
아래 사용자 발화와 최근 대화 맥락을 보고 실제 자살·자해·폭력 위험 수준을 판단하세요.

중요:
- 당신의 판단은 사용자를 바로 차단하기 위한 것이 아니라, 서비스가 안전하게 반응하기 위한 참고 신호입니다.
- 비유, 과장, 농담, 감탄사, 가사 인용, 과거 회상은 실제 현재 위험으로 과대 판단하지 마세요.
- 단, 현재 자해/자살/폭력 의도와 함께 구체적 방법·시점·계획·실행 가능성이 나타나면 critical로 판단하세요.

판단 기준 (모든 항목은 현재 발화 기준):
- intent: 죽고 싶다/다치고 싶다/해치고 싶다는 실제 의도가 있는가?
- current: 지금 이 순간 그런 상태인가? (과거·가정이 아닌 현재)
- plan: 구체적인 계획이 언급되었는가?
- method: 방법이나 수단이 언급되었는가?
- timeframe: 오늘, 지금, 곧 등 시점이 언급되었는가?
- access_or_alone: 혼자 있음, 수단 접근 가능성 등 실행 환경이 언급되었는가?
- metaphor_or_past: 비유·과장·농담·가사·과거 회상에 가까운가?

risk_level 기준:
- none: 위험 아님. 비유·농담·가사 인용·과거 회상·일반 스트레스 표현
- watch: 힘듦이 크거나 모호한 위험 표현이 있으나 실제 의도는 불명확함
- risk: 자해/자살/폭력 의도가 비교적 명확하지만 구체적 계획·방법·시점은 없음
- critical: intent + current에 더해 plan·method·timeframe·access_or_alone 중 1개 이상이 함께 나타남

[사용자 발화]
{utterance}

[최근 대화 맥락]
{context}

반드시 아래 JSON 형식으로만 반환하세요. 다른 텍스트는 출력하지 마세요.
{{
  "risk_level": "none|watch|risk|critical",
  "matched_category": "suicide|self_harm|violence|farewell|unknown",
  "intent": false,
  "current": false,
  "plan": false,
  "method": false,
  "timeframe": false,
  "access_or_alone": false,
  "metaphor_or_past": false,
  "reason": "한 줄 판단 이유"
}}"""

_FACTOR_KEYS = (
    "intent", "current", "plan", "method",
    "timeframe", "access_or_alone", "metaphor_or_past", "reason",
)


async def detect_risk_with_context(
    utterance: str,
    history: list[dict],
    has_risk_keyword: bool = False,
    matched_category: str | None = None,
) -> dict:
    """2단계 위험 감지.

    Args:
        utterance:         현재 사용자 발화
        history:           최근 대화 이력 [{"role": ..., "content": ...}]
        has_risk_keyword:  Node riskKeywords.js 1차 감지 결과
        matched_category:  Node가 감지한 카테고리 (has_risk_keyword=True 시 활용)

    Returns:
        {
            risk_level, matched_category,
            intent, current, plan, method,
            timeframe, access_or_alone, metaphor_or_past, reason
        }
        - none/watch: matched_category=None, 판단 요소 포함하지 않음
        - risk/critical: matched_category 포함, 판단 요소 반환 (Node가 judge_factors로 저장)
    """
    # 1단계: 키워드 확인 (Node가 이미 감지했으면 스캔 생략)
    if not has_risk_keyword:
        for category, keywords in _RISK_KEYWORDS.items():
            if any(kw in utterance for kw in keywords):
                matched_category = category
                has_risk_keyword = True
                break

    if not has_risk_keyword:
        return _no_risk_result()

    # 2단계: LLM 문맥 판단
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
        # LLM 실패 시 보수적으로 watch 처리 (차단하지 않되, 일반 응답도 아님)
        parsed = {
            "risk_level": "watch",
            "matched_category": matched_category,
            "intent": False, "current": False, "plan": False, "method": False,
            "timeframe": False, "access_or_alone": False, "metaphor_or_past": False,
            "reason": "LLM 판단 실패 — 보수적 처리",
        }

    level = parsed.get("risk_level", "watch")
    category = parsed.get("matched_category") or matched_category

    return {
        "risk_level": level,
        # none/watch: matched_category 미반환 (risk_events 저장 대상 아님)
        "matched_category": category if level in ("risk", "critical") else None,
        **{k: parsed.get(k, False) for k in _FACTOR_KEYS if k != "reason"},
        "reason": parsed.get("reason"),
    }


def _no_risk_result() -> dict:
    return {
        "risk_level": "none",
        "matched_category": None,
        "intent": False, "current": False, "plan": False, "method": False,
        "timeframe": False, "access_or_alone": False, "metaphor_or_past": False,
        "reason": None,
    }
