const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // mysql2가 DATETIME ↔ JS Date를 변환할 때 KST(+09:00) 기준으로 해석
  timezone: '+09:00',
});

// 모든 커넥션 세션을 KST(+09:00)로 고정
// 원격 공용 DB의 기본 타임존과 무관하게 NOW()/CURDATE()가 항상 한국 시간으로 동작하도록 보장
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+09:00'", () => {});
});

module.exports = pool;
