"""
fastapi/emotions.py
=====================
달리 6감정 공용 상수.

model_inference · services/pipeline(LLM 파이프라인) 양쪽에서
공통으로 쓰는 DB 컬럼명 ↔ 한국어 감정명 매핑 + 유효 감정 집합.
어느 한쪽 레이어에 종속되지 않도록 fastapi/ 최상위에 생성.
"""

# DB 컬럼명 → 한국어 감정명 (DB 컬럼 정의 순서, session_aggregator의
# 기존 EMOTIONS 리스트 순서와 동일하게 유지 — 가중 연산이 순서에 의존함)
FIELD_TO_KR = {
    "joy_score":       "기쁨",
    "sad_score":       "슬픔",
    "anxiety_score":   "불안",
    "anger_score":     "분노",
    "hurt_score":      "상처",
    "embarrass_score": "당황",
}

# 한국어 감정명 → DB 컬럼명 (역방향)
KR_TO_FIELD = {kr: field for field, kr in FIELD_TO_KR.items()}

# 순서 보장 한국어 감정명 리스트 (벡터 연산 등 순서 의존 코드용)
EMOTIONS = list(FIELD_TO_KR.values())

# 유효 감정 집합 (순서 상관없는 유효값 검사용)
VALID_EMOTIONS = set(EMOTIONS)