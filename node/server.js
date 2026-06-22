const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: '../.env' });

const routes = require('./routes/index');
const { errorHandler } = require('./middleware/errorHandler');

// 모든 응답의 시각 필드를 한국 시간(KST, +09:00) ISO 8601로 직렬화
// res.json → JSON.stringify가 Date마다 toJSON을 호출하므로, 이 패치 하나로 전체 응답에 적용됨
// 예: 2026-06-22T09:00:00.000+09:00
Date.prototype.toJSON = function () {
  const kst = new Date(this.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('Z', '+09:00');
};

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
// 인증 미들웨어보다 위, 루트 경로(/api 밑이 아니라)에 둬야함
// JWT 인증에 막히면 헬스체크 실패
app.get('/health', (req, res) => res.sendStatus(200));

// 미디어 정적 서빙 — JWT 인증 라우트보다 앞에 등록 (audio/video 태그는 Authorization 헤더 불가)
app.use('/api/media', express.static('/app/media'));

app.use('/api', routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node 서버 실행중: http://localhost:${PORT}`);
});