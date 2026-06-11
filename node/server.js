const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 헬스체크 (docker-compose 서비스 상태 확인용)
app.get('/health', (req, res) => res.sendStatus(200));

// 서버 실행
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Node server running on port ${PORT}`);
});