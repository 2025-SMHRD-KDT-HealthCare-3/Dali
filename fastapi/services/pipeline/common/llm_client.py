"""
fastapi/services/pipeline/common/llm_client.py
=================================================
OpenAI 비동기 LLM 클라이언트 — LLM 파이프라인 공용.

services/pipeline/ 하위의 요약·한줄평·미션 및 챗봇 모듈이
공통으로 사용하는 OpenAI Chat Completions 호출 래퍼.

- AsyncOpenAI 클라이언트를 모듈 단위 싱글톤으로 1회만 생성(지연 초기화).
- 호출 실패 시 예외를 그대로 올려보내며,
  상위 엔드포인트의 공통 에러 핸들러가 500 으로 변환한다.
"""

import os

from openai import AsyncOpenAI

# 모듈 전역 싱글톤. 최초 호출 시 1회 생성해 재사용한다.
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """AsyncOpenAI 클라이언트를 지연 생성(lazy)해 반환."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


async def call_llm(
    messages: list[dict],
    *,
    model: str,
    temperature: float = 0.7,
) -> str:
    """OpenAI Chat Completions 를 호출하고 assistant 응답 텍스트를 반환.

    Args:
        messages: OpenAI 형식 메시지 리스트 [{"role": ..., "content": ...}, ...]
        model: 사용할 OpenAI 모델 ID. 기본값 없음 — 호출부에서 반드시 명시적으로
            전달해야 함 (빠뜨리면 TypeError로 즉시 드러남).
            파이프라인별 실제 값은 services/pipeline/common/llm_models.py 참고.
            (모델명은 자주 바뀌므로 연동 시 현재 ID 확인 필요.)
        temperature: 생성 다양성 (0 ~ 2). 파이프라인마다 값이 달라서 호출부에서 직접 지정.

    Returns:
        LLM이 생성한 텍스트. content 가 비어 있으면 빈 문자열.
    """
    response = await _get_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content or ""