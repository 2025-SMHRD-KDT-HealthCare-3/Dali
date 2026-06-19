# docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
#
# 파일 구성:
#   [구간 1] import
#   [구간 2] lifespan — 컨테이너 기동 시 모델 1회 로드
#   [구간 3] 앱 생성 / 라우터 등록
#   [구간 4] 헬스체크 엔드포인트

# ═══════════════════════════════════════════════
# [구간 1] import
# ═══════════════════════════════════════════════
from contextlib import asynccontextmanager

from fastapi import FastAPI

from routers import internal
from services.emotion_model import load_model, is_loaded


# ═══════════════════════════════════════════════
# [구간 2] lifespan — 컨테이너 기동 시 모델 1회 로드
# ═══════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


# ═══════════════════════════════════════════════
# [구간 3] 앱 생성 / 라우터 등록
# ═══════════════════════════════════════════════
app = FastAPI(lifespan=lifespan)

app.include_router(internal.router)   # /internal/chat, /internal/stt


# ═══════════════════════════════════════════════
# [구간 4] 헬스체크
# ═══════════════════════════════════════════════
@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": is_loaded()}
