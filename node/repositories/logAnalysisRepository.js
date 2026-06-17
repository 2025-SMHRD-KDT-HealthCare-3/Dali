/*
 * logAnalysisRepository - chat_analyses 테이블
 * - createLogAnalysis : 발화별 감정 분석 저장
 * - findBySessionId   : 세션에 속한 발화들의 감정 분석 목록 조회 (페이지네이션)
 */

const pool = require('../config/db');

async function findBySessionId(session_id, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM chat_analyses ca
     JOIN chat_logs cl ON ca.log_id = cl.log_id
     WHERE cl.session_id = ?`,
    [session_id]
  );
  const [rows] = await pool.query(
    `SELECT ca.*
     FROM chat_analyses ca
     JOIN chat_logs cl ON ca.log_id = cl.log_id
     WHERE cl.session_id = ?
     ORDER BY ca.analyzed_at ASC
     LIMIT ? OFFSET ?`,
    [session_id, limit, offset]
  );
  return { total, rows };
}

async function createLogAnalysis({ log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score }) {
  await pool.query(
    `INSERT INTO chat_analyses (log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score]
  );
}

module.exports = { createLogAnalysis, findBySessionId };
