"""
fastapi/schemas.py
====================
FastAPI 공용 Pydantic 스키마.
"""

from pydantic import BaseModel


class EmotionScores(BaseModel):
    기쁨:  float = 0.0
    슬픔:  float = 0.0
    불안:  float = 0.0
    분노:  float = 0.0
    상처:  float = 0.0
    당황:  float = 0.0


class EmotionAnalysis(BaseModel):
    dominant_emotion: str | None = None
    emotion_scores:   EmotionScores | None = None


class AlertContext(BaseModel):
    alert_id:       int | None = None
    alert_detected: bool = False
    alert_emotion:  str | None = None
    alert_reason:   str | None = None
    alert_message:  str | None = None


class ChatRequest(BaseModel):
    utterance:                str
    user_id:                  int | None = None
    session_id:               int | None = None
    log_id:                   int | None = None
    persona:                  str = "공감형"
    persona_source:           str | None = None
    selected_emotion:         str | None = None
    history:                  list[dict] = []
    current_emotion_analysis: EmotionAnalysis | None = None
    alert_context:            list[AlertContext] | None = None
    recent_summaries:         list[str] | None = None
    # 온보딩 q3 — Node가 DB에서 읽어 매 요청마다 전달 (FastAPI는 상태 미보유)
    q3_answer:                str | None = None
    # 위험 키워드 1차 감지 — Node의 riskKeywords.js 결과, FastAPI는 2차 LLM 판단만 담당
    has_risk_keyword:         bool = False
    matched_category:         str | None = None


class ScoreRow(BaseModel):
    joy_score:       float = 0.0
    sad_score:       float = 0.0
    anxiety_score:   float = 0.0
    anger_score:     float = 0.0
    hurt_score:      float = 0.0
    embarrass_score: float = 0.0


class SessionAnalyzeRequest(BaseModel):
    user_id:           int
    selected_emotion:  str = "슬픔"
    chat_logs:         list[dict] = []
    score_rows:        list[ScoreRow] = []
    generate_missions: bool = False
    recent_missions:   list[str] = []