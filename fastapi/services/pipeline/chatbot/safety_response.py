"""
fastapi/services/pipeline/chatbot/safety_response.py
==================================
위험 수준별 고정 안전 응답

risk_level watch/risk/critical 에 해당하는 고정 텍스트를 반환한다.
LLM 자유 응답 대신 이 텍스트를 우선 반환해 일관성을 보장한다.
"""

_RESPONSES: dict[str, str] = {
    "watch": (
        "그렇게 느껴질 만큼 많이 지쳐 있었구나.\n"
        "혹시 지금 스스로를 다치게 하고 싶은 생각까지 들고 있는지 확인해도 될까?"
    ),
    "risk": (
        "지금 이 이야기는 혼자 견디기에는 너무 무거울 수 있어요.\n"
        "달리는 전문 상담사가 아니지만, 지금은 안전을 먼저 확인하는 게 중요해요.\n"
        "가능하다면 가까운 사람에게 바로 연락하거나, "
        "자살예방상담전화 1393 또는 정신건강위기상담전화 1577-0199에 연락해 주세요."
    ),
    "critical": (
        "지금은 혼자 있지 않는 게 중요해요.\n"
        "가능하다면 바로 주변 사람에게 연락해 주세요.\n"
        "지금 당장 위험하다고 느껴진다면 자살예방상담전화 1393 또는 "
        "정신건강위기상담전화 1577-0199로 바로 연락해 주세요."
    ),
}


def get_safety_response(risk_level: str) -> str:
    """risk_level에 해당하는 고정 안전 응답 텍스트 반환."""
    return _RESPONSES.get(risk_level, _RESPONSES["watch"])
