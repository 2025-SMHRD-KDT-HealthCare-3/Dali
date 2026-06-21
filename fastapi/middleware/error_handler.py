"""
fastapi/middleware/error_handler.py
==================================
공통 에러 핸들러.

FastAPI 전역에서 발생하는 예외를 한 곳에서 처리해,
모든 엔드포인트가 동일한 에러 응답 형식과 로그를 따르도록 한다.
응답 형식은 FastAPI 기본과 동일한 {"detail": "..."} 로 통일한다.

- 403  Forbidden             내부 키 누락·불일치 (auth.require_internal_key)
- 422  Unprocessable Entity  요청 바디 검증 실패 (Pydantic)
- 500  Internal Server Error 처리되지 않은 내부 오류 (LLM 호출 실패 등)

main.py 에서 register_error_handlers(app) 를 호출해 등록한다.
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("dali")


# ── 422: 요청 바디 검증 실패 (Pydantic) ──────────────────────────────
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic 검증 실패를 422 + {"detail"} 로 변환.

    기본 응답은 detail 이 필드별 오류 배열이라 장황하므로,
    첫 번째 오류만 간결한 문자열로 담아 반환한다.
    """
    errors = exc.errors()
    first = errors[0] if errors else {}
    # loc 예: ("body", "selected_emotion") → "selected_emotion"
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = first.get("msg", "요청 형식이 올바르지 않습니다.")
    detail = f"{field}: {message}" if field else message

    logger.warning("[422] %s → %s", request.url.path, detail)
    return JSONResponse(status_code=422, content={"detail": detail})


# ── 4xx: 명시적으로 발생시킨 HTTPException (예: 인증 403) ─────────────
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTPException 을 로그로 남기고 {"detail"} 형식 그대로 반환."""
    logger.warning("[%s] %s → %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# ── 500: 예상하지 못한 모든 예외 ─────────────────────────────────────
async def global_exception_handler(request: Request, exc: Exception):
    """처리되지 않은 예외를 500 으로 변환.

    스택 등 내부 정보는 노출하지 않고 일반 문구만 반환하며,
    상세 내용은 서버 로그(logger.exception)에만 남긴다.
    """
    logger.exception("[500] %s → %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "서버 내부 오류가 발생했습니다."},
    )


# ── 등록 헬퍼 ────────────────────────────────────────────────────────
def register_error_handlers(app: FastAPI) -> None:
    """위 핸들러들을 일괄 등록한다. main.py 에서 1회 호출."""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)