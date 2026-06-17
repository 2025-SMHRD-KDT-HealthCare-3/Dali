"""OpenAI 비동기 LLM 클라이언트 — 프로젝트 전체에서 공통으로 사용."""

import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


async def call_llm(
    messages: list[dict],
    *,
    temperature: float = 0.7,
    model: str = "gpt-4o-mini",
) -> str:
    """OpenAI Chat Completions 호출 후 assistant 메시지 텍스트를 반환.

    Args:
        messages: OpenAI 형식 메시지 리스트 [{"role": ..., "content": ...}, ...]
        temperature: 생성 다양성 (0 ~ 2)
        model: 사용할 OpenAI 모델 ID

    Returns:
        LLM이 생성한 텍스트 (choices[0].message.content)
    """
    response = await _get_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content
