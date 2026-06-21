"""
fastapi/services/pipeline/common/llm_models.py
==================================================
파이프라인별 OpenAI 모델 ID 상수.

모델명이 자주 바뀌므로 호출부에 직접 박지 않고 여기 한 곳에 모아둔다.
교체 시 이 파일만 수정.

temperature는 프롬프트별 생성 성향(창의성 vs 일관성) 튜닝값이라
각 파이프라인 파일에서 직접 관리한다.
"""

CHATBOT_MODEL = "gpt-5"         # 일반 챗봇 대화 (chatbot/pipeline.py)
RISK_MODEL    = "gpt-5-mini"    # 고위험 감지 (chatbot/risk_gate.py)
SUMMARY_MODEL = "gpt-5-mini"    # 대화 요약 (summary/pipeline.py)
REPORT_MODEL  = "gpt-5-mini"    # 한줄평 (report/pipeline.py)
MISSION_MODEL = "gpt-4.1-mini"  # 회복 미션 (mission/pipeline.py)