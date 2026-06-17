"""Node ↔ FastAPI 내부 통신용 API 키 검증."""

import os
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

_api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False)


async def require_internal_key(key: str = Depends(_api_key_header)) -> str:
    expected = os.getenv("INTERNAL_API_KEY", "")
    if not key or key != expected:
        raise HTTPException(status_code=403, detail="Forbidden")
    return key
