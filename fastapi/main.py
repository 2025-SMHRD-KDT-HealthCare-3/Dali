# docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
@app.get("/health")
def health():
    return {"status": "ok"}