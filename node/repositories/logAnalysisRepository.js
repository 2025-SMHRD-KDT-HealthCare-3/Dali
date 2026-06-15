/*
 * logAnalysisRepository - log_analyses 테이블
 * - createLogAnalysis : 발화별 감정 분석 저장
 * - findBySessionId   : 세션에 속한 발화들의 감정 분석 목록 조회
 */

const pool = require('../config/db');

async function findBySessionId(session_id) {
  const [rows] = await pool.query(
    `SELECT la.*
     FROM log_analyses la
     JOIN emotion_logs el ON la.log_id = el.log_id
     WHERE el.session_id = ?
     ORDER BY la.analyzed_at ASC`,
    [session_id]
  );
  return rows;
}

async function createLogAnalysis({ log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score }) {
  await pool.query(
    `INSERT INTO log_analyses (log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [log_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score]
  );
}

module.exports = { createLogAnalysis, findBySessionId };
