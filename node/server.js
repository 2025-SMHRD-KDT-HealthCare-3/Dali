const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: '../.env' });

const routes = require('./routes/index');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// docker-compose.yml -> service_healthy 체크용 엔드포인트 추가
// 인증 미들웨어보다 위, 루트 경로(/api 밑이 아니라)에 둬야함
// JWT 인증에 막히면 헬스체크 실패
app.get('/health', (req, res) => res.sendStatus(200));

app.use('/api', routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node 서버 실행중: http://localhost:${PORT}`);
});