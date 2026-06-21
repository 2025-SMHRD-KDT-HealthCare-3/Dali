"""
fastapi/middleware/auth.py
==================================
내부 API 키 검증 미들웨어.

Node 서버가 보낸 X-Internal-API-Key 헤더를 검사해
React/외부에서 FastAPI를 직접 호출하는 것을 차단한다.
"""

import os
import secrets

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

# 1. Fail-Fast: 서버 시작 시 환경변수 확인
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()

if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY가 .env에 설정되지 않았습니다.")

# 2. Swagger UI 전역 자물쇠 아이콘 생성용 객체
_api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False)


def require_internal_key(
    api_key: str | None = Depends(_api_key_header)
) -> None:
    """Node에서 전달한 내부 API 키를 검증.

    - Swagger UI 자물쇠 아이콘 지원
    - 키 미포함 또는 불일치 시 403 Forbidden
    - secrets.compare_digest로 타이밍 어택 방지
    """
    if not api_key or not secrets.compare_digest(
        api_key.strip(), 
        INTERNAL_API_KEY
    ):
        raise HTTPException(status_code=403, detail="Forbidden")