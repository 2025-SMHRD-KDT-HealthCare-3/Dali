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

from services import emotion_router
from services.emotion_model import load_model, is_loaded


# ═══════════════════════════════════════════════
# [구간 2] lifespan — 컨테이너 기동 시 모델 1회 로드
# ═══════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 컨테이너 기동 시 v8 모델을 1회 로드해서 메모리에 올려둔다
    # (요청마다 다시 로드하지 않도록 — 로드에 수초 걸리므로 매 요청마다 하면 안 됨)
    load_model()
    yield
    # 종료 시 정리 작업 필요하면 yield 다음에 추가


# ═══════════════════════════════════════════════
# [구간 3] 앱 생성 / 라우터 등록
# ═══════════════════════════════════════════════
app = FastAPI(lifespan=lifespan)

app.include_router(emotion_router.router)   # /emotion/analyze, /emotion/session


# ═══════════════════════════════════════════════
# [구간 4] 헬스체크
# ═══════════════════════════════════════════════
@app.get("/health")
def health_check():
    # model_loaded까지 같이 보고 → 모델이 안 올라온 상태로
    # healthy 처리되는 것을 docker-compose가 구분할 수 있게 함
    return {"status": "ok", "model_loaded": is_loaded()}