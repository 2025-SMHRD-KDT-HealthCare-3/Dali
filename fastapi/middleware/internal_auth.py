"""X-Internal-API-Key 인증 의존성.

FastAPI의 /internal/* 엔드포인트에서 Depends()로 주입한다.
Node.js만 호출 가능하도록 강제한다.
"""
import os

from fastapi import Header, HTTPException


def verify_internal_key(x_internal_api_key: str = Header(...)):
    if x_internal_api_key != os.environ.get("INTERNAL_API_KEY", ""):
        raise HTTPException(status_code=401, detail="Unauthorized")
