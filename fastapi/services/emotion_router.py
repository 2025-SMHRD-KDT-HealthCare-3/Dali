"""
fastapi/services/emotion_router.py
=======================================================
Dali — 감정 분석 추론 API. 순수 추론 전용, DB 접근 없음.

전체 구조 (Node ↔ FastAPI 역할 분리):
  Node (controller/repository) → 텍스트(+이전발화) 전송
  FastAPI (이 파일)             → 추론만 수행, 점수 반환
  Node                          → 받은 점수를 자체 DB에 저장
                                   (logAnalysisRepository, sessionRepository 등)

FastAPI는 chat_logs/chat_analyses/session_analyses 테이블을
전혀 알 필요가 없다. Node가 이전발화 조회·DB 저장을 전부 책임진다.

파일 구성:
  [구간 1] 라우터 설정 / 컬럼명 매핑
  [구간 2] 요청·응답 스키마 (Pydantic)
  [구간 3] ① 발화 1개 추론 엔드포인트
  [구간 4] ② 세션 전체 집계 엔드포인트
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.emotion_model import predict_emotions, EMOTIONS
from services.session_aggregator import aggregate_session
from utils.intensity_scaler import scale_by_intensity


# ═══════════════════════════════════════════════
# [구간 1] 라우터 설정 / 컬럼명 매핑
# ═══════════════════════════════════════════════
router = APIRouter(prefix="/emotion", tags=["emotion"])

# emotion_model의 한글 라벨("기쁨" 등)을 chat_analyses/session_analyses
# 테이블의 실제 컬럼명(joy_score 등)으로 변환하는 매핑.
# Node의 repository가 응답을 그대로 INSERT에 꽂아 넣을 수 있게 하기 위함.
_COLUMN_MAP = {
    "기쁨": "joy_score", "슬픔": "sad_score", "불안": "anxiety_score",
    "분노": "anger_score", "상처": "hurt_score", "당황": "embarrass_score",
}


def _to_response(scores: dict[str, float]) -> dict[str, float]:
    """한글 라벨 딕셔너리 → 영문 컬럼명 딕셔너리 변환 (공용 헬퍼)."""
    return {_COLUMN_MAP[e]: scores[e] for e in EMOTIONS}


# ═══════════════════════════════════════════════
# [구간 2] 요청 · 응답 스키마
# ═══════════════════════════════════════════════

class UtteranceInput(BaseModel):
    """발화 1개 입력. prev_text는 Node가 turn_idx 기준으로 미리 조회해서 채워 보낸다."""
    text: str
    prev_text: str | None = None


class EmotionScores(BaseModel):
    """6감정 점수 — chat_analyses/session_analyses 컬럼명과 1:1 대응."""
    joy_score: float
    sad_score: float
    anxiety_score: float
    anger_score: float
    hurt_score: float
    embarrass_score: float


class SessionAnalyzeRequest(BaseModel):
    """세션 내 user 발화들을 turn_idx 순서대로, prev_text까지 채워서 보낸 형태."""
    utterances: list[UtteranceInput]


class SessionAnalyzeResponse(EmotionScores):
    """세션 집계 응답 = 6감정 점수 + 대표 감정(1위)."""
    dominant_emotion: str


# ═══════════════════════════════════════════════
# [구간 3] ① 발화 1개 추론
# ═══════════════════════════════════════════════

@router.post("/analyze", response_model=EmotionScores)
def analyze_utterance(payload: UtteranceInput):
    """
    발화 1개를 추론해서 6감정 점수를 반환한다.

    처리 순서:
      1) emotion_model로 KcELECTRA v8 추론 (raw_scores, 합=100)
      2) intensity_scaler로 강도 부사 후처리 (있으면 보정, 없으면 그대로)
      3) 한글 라벨 → DB 컬럼명으로 변환해서 응답

    DB 저장은 하지 않는다 — 호출자(Node)가 응답을 받아서 직접 저장.
    """
    raw_scores = predict_emotions(payload.text, payload.prev_text)
    result = scale_by_intensity(raw_scores, payload.text)
    return _to_response(result.scores_after)


# ═══════════════════════════════════════════════
# [구간 4] ② 세션 전체 집계
# ═══════════════════════════════════════════════

@router.post("/session", response_model=SessionAnalyzeResponse)
def analyze_session(payload: SessionAnalyzeRequest):
    """
    세션 내 user 발화 리스트(turn_idx 순서, prev_text 포함)를 받아
    발화별 추론 + 강도 후처리 + 세션 집계까지 한 번에 수행한다.

    처리 순서:
      1) 발화마다 순서대로 predict_emotions + scale_by_intensity 적용
      2) session_aggregator.aggregate_session()으로 위치별 가중치 적용해 집계
      3) 집계 결과 중 최댓값을 대표 감정(dominant_emotion)으로 결정
      4) 한글 라벨 → DB 컬럼명으로 변환해서 응답

    DB 저장은 하지 않는다 — 호출자(Node)가 응답을 받아서 직접 저장.
    """
    session_scores = []
    for utt in payload.utterances:
        raw = predict_emotions(utt.text, utt.prev_text)
        result = scale_by_intensity(raw, utt.text)
        session_scores.append(result.scores_after)

    final = aggregate_session(session_scores)
    dominant = max(final, key=final.get)

    return SessionAnalyzeResponse(dominant_emotion=dominant, **_to_response(final))
