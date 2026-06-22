"""
fastapi/services/pipeline/chatbot/safety_response.py
==================================
service_action별 고정 안전 응답 및 신중 모드 프롬프트

service_action:
  normal_empathy      — none/watch: LLM 일반 공감 응답 (이 파일 미사용)
  offer_support_choice — risk 1~2회: LLM 신중 응답 + 핫라인 정보
  enter_safety_mode    — risk 3회↑: 세션 차단 안전모드 전환
  urgent_safety_mode   — critical 1회: 즉시 세션 차단 안전모드 전환
"""

_RESPONSES: dict[str, str] = {
    "offer_support_choice": (
        "지금 이 이야기를 꺼내줘서 고마워요.\n"
        "혼자 견디기엔 너무 무거운 감정일 수 있어요.\n\n"
        "조금 더 이야기 나눌 수도 있고, 외부의 도움을 받아보는 것도 좋아요.\n"
        "📞 자살예방상담전화 109\n"
        "📞 정신건강위기상담전화 1577-0199"
    ),
    "enter_safety_mode": (
        "지금 많이 힘드셨겠어요. 이 이야기를 달리에게 해줘서 고마워요.\n\n"
        "지금은 달리가 직접 도움을 드리기 어려운 상황이에요.\n"
        "혼자 있지 않는 게 중요해요. 아래 기관에 연락해 주세요.\n\n"
        "📞 자살예방상담전화 109\n"
        "📞 정신건강위기상담전화 1577-0199"
    ),
    "urgent_safety_mode": (
        "지금 바로 안전을 확인하는 게 중요해요.\n"
        "혼자 있지 마세요. 주변 사람에게 연락하거나, 아래 기관에 바로 전화해 주세요.\n\n"
        "📞 자살예방상담전화 109\n"
        "📞 정신건강위기상담전화 1577-0199"
    ),
}

# offer_support_choice(cautious) 모드에서 build_chat_reply 시스템 메시지에 주입할 블록
CAUTIOUS_MODE_PROMPT = (
    "\n\n[신중 응답 모드 — 위험 신호 감지]\n"
    "사용자 발화에서 자해·자살·폭력 관련 표현이 감지되었습니다.\n"
    "단정적 조언·해결책 제시를 삼가고, 짧고 조심스러운 공감 응답을 작성하세요.\n"
    "혼자 견디지 않아도 된다는 메시지를 자연스럽게 포함하세요.\n"
    "외부 상담 연결(109, 1577-0199)을 부드럽게 언급하세요."
)


def get_safety_response(service_action: str) -> str:
    """service_action에 해당하는 고정 안전 응답 텍스트 반환."""
    return _RESPONSES.get(service_action, _RESPONSES["enter_safety_mode"])
