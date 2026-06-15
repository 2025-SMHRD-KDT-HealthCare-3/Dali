/*
 * sessionRepository - sessions 테이블
 * - createSession       : 세션 생성 (감정 선택)
 * - endSession          : 세션 종료 (ended_at 업데이트)
 * - findSessionsByUser  : 사용자의 전체 세션 목록 조회
 * - findSessionById     : 세션 단건 조회
 */

const pool = require('../config/db');

async function createSession({ user_id, selected_emotion }) {
  const [result] = await pool.query(
    'INSERT INTO sessions (user_id, selected_emotion) VALUES (?, ?)',
    [user_id, selected_emotion]
  );
  return result.insertId;
}

async function endSession(session_id) {
  await pool.query(
    'UPDATE sessions SET ended_at = NOW() WHERE session_id = ?',
    [session_id]
  );
}

async function findSessionsByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
    [user_id]
  );
  return rows;
}

async function findSessionById(session_id) {
  const [rows] = await pool.query('SELECT * FROM sessions WHERE session_id = ?', [session_id]);
  return rows[0];
}

// 오늘 포함 최근 5일간 session_analyses.dominant_emotion이 동일한지 확인
async function checkConsecutiveDays(user_id, emotion, days = 5) {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT DATE(sa.created_at)) AS cnt
     FROM session_analyses sa
     JOIN sessions s ON sa.session_id = s.session_id
     WHERE s.user_id = ?
       AND sa.dominant_emotion = ?
       AND DATE(sa.created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [user_id, emotion, days - 1]
  );
  return rows[0].cnt >= days;
}

module.exports = { createSession, endSession, findSessionsByUser, findSessionById, checkConsecutiveDays };
