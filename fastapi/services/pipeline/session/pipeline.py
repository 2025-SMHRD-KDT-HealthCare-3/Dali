"""
fastapi/services/pipeline/session/pipeline.py
================================================
달리 세션 분석 오케스트레이터.

analyze_session: 세션 종료 시 Node가 호출하는 단일 진입점.
6감정 가중 집계(model_inference.session_aggregator) → dominant_emotion 확정
→ asyncio.gather로 요약·한줄평·미션(조건부) 병렬 생성 → 결과 조합 반환.

FastAPI는 DB 미접근. chat_logs·score_rows 등 모든 컨텍스트는 Node가 전달한다.
"""

import asyncio

from model_inference.session_aggregator import aggregate_session
from services.pipeline.summary.pipeline import generate_summary
from services.pipeline.report.pipeline import generate_review
from services.pipeline.mission.pipeline import generate_missions
from emotions import FIELD_TO_KR, KR_TO_FIELD

_NO_CONTENT_SUMMARY = "대화 내용이 없습니다."
_NO_CONTENT_REVIEW = "오늘도 달리와 함께해줘서 고마워요."
_ZERO_SCORES = {field: 0.0 for field in FIELD_TO_KR}


def _to_kr_scores(score_rows: list[dict]) -> list[dict]:
    """DB 컬럼명 키 score_rows → aggregate_session 입력 형식(한국어 키)으로 변환."""
    return [
        {kr: float(row.get(field) or 0.0) for field, kr in FIELD_TO_KR.items()}
        for row in score_rows
    ]


def _to_field_scores(kr_scores: dict[str, float]) -> dict[str, float]:
    """aggregate_session 출력(한국어 키) → DB 컬럼명 키로 변환."""
    return {KR_TO_FIELD[kr]: v for kr, v in kr_scores.items()}


def _build_full_conversation(chat_logs: list[dict]) -> str:
    """chat_logs 전체를 '화자: 발화' 텍스트로 변환 (요약용)."""
    lines = []
    for row in chat_logs:
        utterance = (row.get("utterance") or "").strip()
        if utterance:
            speaker = "사용자" if row.get("speaker") == "user" else "달리"
            lines.append(f"{speaker}: {utterance}")
    return "\n".join(lines)


def _build_user_only(chat_logs: list[dict]) -> str:
    """chat_logs 중 speaker='user' 발화만 추출 (미션 생성용, 토큰 절감)."""
    lines = [
        (row.get("utterance") or "").strip()
        for row in chat_logs
        if row.get("speaker") == "user" and (row.get("utterance") or "").strip()
    ]
    return "\n".join(lines)


async def analyze_session(
    chat_logs: list[dict],
    score_rows: list[dict],
    selected_emotion: str,
    generate_missions_flag: bool,
    recent_missions: list[str] | None = None,
) -> dict:
    """세션 종료 후 전체 분석 결과를 반환.

    Args:
        chat_logs: 세션 발화 로그 (speaker, utterance), turn_idx 순서.
        score_rows: 말풍선별 6감정 점수 행 리스트 (DB 컬럼명 키: joy_score 등).
            turn_idx 순서 필수(위치 기반 가중 집계가 리스트 순서에 의존).
            aggregate_session 호출 전 한국어 키로 변환된다.
        selected_emotion: 세션 시작 시 사용자가 선택한 주관 감정.
        generate_missions_flag: Node가 판단해 넘기는 미션 생성 여부
            (당일 최초 세션만 True).
        recent_missions: 최근 5일 mission_content 문자열 리스트(중복 회피용).
            generate_missions_flag=False면 무시됨.

    Returns:
        {
            joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
            dominant_emotion, context_summary, one_line_review,
            missions: [{"mission_seq": int, "mission_content": str}, ...] | None
        }
    """
    recent_missions = recent_missions or []

    full_conversation = _build_full_conversation(chat_logs)
    user_only = _build_user_only(chat_logs)

    # 대화·점수가 비어 있으면 LLM·집계 호출 없이 기본값 반환.
    # aggregate_session은 빈 리스트에 ValueError를 던지므로 호출 전에 막아야 함.
    if not score_rows or not full_conversation.strip():
        return {
            **_ZERO_SCORES,
            "dominant_emotion": selected_emotion,
            "context_summary": _NO_CONTENT_SUMMARY,
            "one_line_review": _NO_CONTENT_REVIEW,
            "missions": None,
        }

    # 1) 가중 집계 (동기, 산식은 model_inference 담당 영역)
    kr_avg = aggregate_session(_to_kr_scores(score_rows))
    avg_scores = _to_field_scores(kr_avg)
    dominant = max(kr_avg, key=kr_avg.get)

    # 2) 요약 · 한줄평 · (조건부) 미션 병렬 생성
    #    미션은 요약 완성을 기다리지 않음 — chat_logs(user 발화)를 직접 사용.
    tasks = [
        generate_summary(full_conversation),
        generate_review(selected_emotion, dominant, avg_scores),
    ]
    if generate_missions_flag:
        tasks.append(generate_missions(dominant, user_only, recent_missions))

    results = await asyncio.gather(*tasks)
    summary, review = results[0], results[1]
    missions = results[2] if generate_missions_flag else None

    return {
        **avg_scores,
        "dominant_emotion": dominant,
        "context_summary": summary,
        "one_line_review": review,
        "missions": missions,
    }