# docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
from fastapi import FastAPI
app = FastAPI() 

@app.get("/health")
def health_check():
    return {"status": "ok"}