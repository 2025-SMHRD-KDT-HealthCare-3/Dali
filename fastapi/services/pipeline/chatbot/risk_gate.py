"""
fastapi/services/pipeline/chatbot/risk_gate.py
==================================
위험 감지 파이프라인 (2단계)

1단계: omni-moderation-latest — 의미 기반 위험 탐지 (키워드 매칭 대체)
       Node has_risk_keyword=True 이면 스킵 (Node가 이미 감지한 경우)
2단계: 1단계 통과 시 GPT Judge — 비유/과장 vs 실제 위험 문맥 판단

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

from services.pipeline.common.llm_client import call_llm, _get_client
from services.pipeline.common.llm_models import RISK_MODEL

# omni-moderation-latest 카테고리 → 내부 카테고리 매핑
# 우선순위 순서 (높은 위험도부터)
_MODERATION_CATEGORY_MAP: list[tuple[str, str]] = [
    ("self_harm_intent",        "suicide"),
    ("self_harm",               "self_harm"),
    ("self_harm_instructions",  "self_harm"),
    ("violence",                "violence"),
    ("violence_graphic",        "violence"),
]

# 이 점수 이상이면 GPT Judge 호출 (높은 recall 우선 — 오탐은 Judge가 걸러냄)
_MODERATION_THRESHOLD = 0.3

_JUDGE_PROMPT = """\
당신은 감정 회복 챗봇의 위기 신호 판단 보조 AI입니다.
아래 사용자 발화와 최근 대화 맥락을 보고 실제 자살·자해·폭력 위험 수준을 판단하세요.

중요:
- 당신의 역할은 risk_level, matched_category, judge_factors만 반환하는 것입니다.
- 서비스 행동(service_action 등)은 Rule Engine이 별도로 결정합니다.
- 비유, 과장, 농담, 감탄사, 가사 인용은 실제 현재 위험으로 과대 판단하지 마세요.
- 과거 회상은 두 가지로 구분합니다:
  (A) 단순 과거 회상 — 현재 안전하다고 명시되거나 감정이 현재로 이어지지 않음 → none
  (B) 과거 경험이 현재 감정으로 이어지는 경우 — "요즘도 가끔", "다시 떠올라서 무섭다",
      "그때 감정이 다시 올라온다" 등 현재 영향이 감지됨 → watch

판단 기준 (모든 항목은 현재 발화 기준):
- intent: 자신을 죽이거나 다치게 하려는 실제 의도, 또는 타인을 실제로 해치려는 의도가 있는가?
- current: 지금 이 순간 그런 상태인가? (과거·가정이 아닌 현재)
- plan: 구체적인 계획이 언급되었는가?
- method: 방법이나 수단이 언급되었는가?
- timeframe: 오늘, 지금, 곧 등 시점이 언급되었는가?
- access_or_alone: 혼자 있음, 수단 접근 가능성 등 실행 환경이 언급되었는가?
- metaphor_or_past: 비유·과장·농담·가사·단순 과거 회상(현재 감정으로 이어지지 않음)에 가까운가?

matched_category 기준:
- suicide: 자살 의도가 주된 경우
- self_harm: 자해 행위에 초점이 맞춰진 경우
- violence: 타인을 실제로 해치려는 의도가 명확한 경우
  ※ 단순 분노·짜증 표현은 violence가 아님
    예(violence 아님): "진짜 너무 화난다", "짜증나서 미치겠다", "한 대 치고 싶을 만큼 화난다"
  ※ 실제 가해 의도가 확인되는 경우만 violence로 분류
    예(violence): "그 사람 찾아가서 해치고 싶다", "칼로 찌르고 싶다", "죽여버리고 싶어"
- farewell: 마지막 인사·유서·작별 등 이별 신호
- unknown: 위험 신호는 있으나 카테고리를 특정하기 어려운 경우

risk_level 기준:
- none: 위험 아님. 비유·농담·가사 인용·일반 스트레스·단순 분노 표현·단순 과거 회상
        (현재 안전하다고 명시되거나 과거 사건이 현재 감정으로 이어지지 않는 경우)
- watch: 다음 중 하나에 해당하는 경우
  (1) 힘듦이 크거나 모호한 위험 표현이 있으나 실제 의도는 불명확함
  (2) 과거 위험 경험이 현재 감정에 영향을 주고 있음
      예: "요즘도 가끔 그런 생각이 나", "다시 떠올라서 무섭다", "그때 감정이 다시 올라온다"
- risk: 자해·자살 의도가 비교적 명확하지만 구체적 계획·방법·시점은 없음
        ※ violence는 risk로 분류하지 않음
- critical: 다음 중 하나에 해당하는 경우
  (1) 자해·자살: intent + current에 더해 plan·method·timeframe·access_or_alone 중 1개 이상
  (2) 타인 가해(violence): matched_category = "violence"이면 risk_level은 반드시 "critical"

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


async def _check_moderation(text: str) -> dict | None:
    """omni-moderation-latest 호출.

    임계치(_MODERATION_THRESHOLD) 이상인 위험 카테고리가 있으면
    {"category": <내부 카테고리>} 반환, 없으면 None.
    """
    try:
        client = _get_client()
        result = await client.moderations.create(
            input=text,
            model="omni-moderation-latest",
        )
        scores: dict = result.results[0].category_scores.model_dump()
        for field, internal_cat in _MODERATION_CATEGORY_MAP:
            if (scores.get(field) or 0.0) >= _MODERATION_THRESHOLD:
                return {"category": internal_cat}
    except Exception:
        pass
    return None


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
    # 1단계: omni-moderation-latest 의미 기반 탐지 (Node가 이미 감지했으면 생략)
    if not has_risk_keyword:
        mod = await _check_moderation(utterance)
        if mod:
            has_risk_keyword = True
            matched_category = matched_category or mod["category"]

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
