"""달리 세션 분석 파이프라인.

analyze_session: 세션 대화 로그 + 감정 점수 → 요약·리뷰·미션 생성 → 분석 결과 반환
"""

from common.llm_client import call_llm
from services.pipeline.mission.pipeline import generate_missions

# DB에 저장된 감정 컬럼명 → 표시 감정명 매핑
_SCORE_TO_EMOTION = {
    "joy_score":       "기쁨",
    "sad_score":       "슬픔",
    "anxiety_score":   "불안",
    "anger_score":     "분노",
    "hurt_score":      "상처",
    "embarrass_score": "당황",
}

_SCORE_FIELDS = list(_SCORE_TO_EMOTION.keys())

_SUMMARY_SYSTEM = """\
당신은 달리(Dali)야. 사용자의 대화 세션을 분석해서 짧은 요약을 제공해.
지침:
- 핵심 감정과 주요 주제를 2~3문장으로 요약해.
- 사용자를 평가하거나 판단하지 말고, 따뜻하고 공감하는 말투로 써.
- 한국어로 작성해.
- 요약 외 다른 텍스트 없이 요약만 출력해.
"""

_REVIEW_SYSTEM = """\
당신은 달리(Dali)야. 사용자의 대화를 보고 한 줄 응원 메시지를 써줘.
지침:
- 오늘 대화를 통해 사용자가 얻은 것 / 수고한 것을 따뜻하게 한 줄로 표현해.
- 과도한 약속이나 단언은 금지 ("반드시", "분명히" 등).
- 한국어 한 문장으로만 출력해.
"""


def _compute_avg_scores(score_rows: list[dict]) -> dict[str, float]:
    """chat_log_analyses 행 리스트에서 감정 점수 평균을 계산."""
    if not score_rows:
        return {f: 0.0 for f in _SCORE_FIELDS}

    totals = {f: 0.0 for f in _SCORE_FIELDS}
    for row in score_rows:
        for f in _SCORE_FIELDS:
            totals[f] += float(row.get(f) or 0)

    n = len(score_rows)
    return {f: round(totals[f] / n, 4) for f in _SCORE_FIELDS}


def _dominant_emotion(avg_scores: dict[str, float]) -> str:
    best_field = max(avg_scores, key=avg_scores.__getitem__)
    return _SCORE_TO_EMOTION[best_field]


async def _generate_summary(conversation: str) -> str:
    messages = [
        {"role": "system", "content": _SUMMARY_SYSTEM},
        {"role": "user", "content": f"오늘 대화:\n{conversation}"},
    ]
    return await call_llm(messages, temperature=0.5)


async def _generate_review(conversation: str) -> str:
    messages = [
        {"role": "system", "content": _REVIEW_SYSTEM},
        {"role": "user", "content": f"오늘 대화:\n{conversation}"},
    ]
    return await call_llm(messages, temperature=0.6)


def _build_conversation_text(chat_logs: list[dict]) -> str:
    """chat_logs 행 리스트를 대화 텍스트로 변환."""
    lines = []
    for row in chat_logs:
        speaker = "사용자" if row.get("speaker") == "user" else "달리"
        utterance = (row.get("utterance") or "").strip()
        if utterance:
            lines.append(f"{speaker}: {utterance}")
    return "\n".join(lines)


async def analyze_session(
    chat_logs: list[dict],
    score_rows: list[dict],
    selected_emotion: str,
) -> dict:
    """세션 대화 데이터를 분석하고 결과를 반환.

    Args:
        chat_logs:       sessions 대화 로그 행 리스트 (speaker, utterance)
        score_rows:      chat_log_analyses 행 리스트 (감정 점수들)
        selected_emotion: 세션 시작 시 사용자가 선택한 감정

    Returns:
        {
            joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
            dominant_emotion, context_summary, one_line_review,
            missions: [{"title", "description", "category", "estimated_minutes"}, ...]
        }
    """
    avg_scores = _compute_avg_scores(score_rows)
    dominant = _dominant_emotion(avg_scores)
    conversation_text = _build_conversation_text(chat_logs)

    # 대화가 없으면 기본 값으로 반환
    if not conversation_text.strip():
        return {
            **avg_scores,
            "dominant_emotion": dominant,
            "context_summary": "대화 내용이 없습니다.",
            "one_line_review": "오늘도 달리와 함께해줘서 고마워요.",
            "missions": [],
        }

    # LLM 호출 3개 병렬로 (asyncio.gather)
    import asyncio
    summary, review, missions = await asyncio.gather(
        _generate_summary(conversation_text),
        _generate_review(conversation_text),
        generate_missions(dominant, conversation_text),
    )

    return {
        **avg_scores,
        "dominant_emotion": dominant,
        "context_summary": summary.strip(),
        "one_line_review": review.strip(),
        "missions": missions,
    }
