/*
 * riskEventRepository - risk_events 테이블
 * - findByUserId    : 사용자의 전체 고위험 신호 목록 조회
 * - findBySessionId : 특정 세션의 고위험 신호 목록 조회
 * - createRiskEvent : 고위험 신호 저장
 */

const pool = require('../config/db');

async function findByUserId(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM risk_events WHERE user_id = ? ORDER BY detected_at DESC',
    [user_id]
  );
  return rows;
}

async function findBySessionId(session_id, user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM risk_events WHERE session_id = ? AND user_id = ? ORDER BY detected_at ASC',
    [session_id, user_id]
  );
  return rows;
}

async function createRiskEvent({ user_id, session_id, matched_category, action_taken }) {
  const [result] = await pool.query(
    'INSERT INTO risk_events (user_id, session_id, matched_category, action_taken) VALUES (?, ?, ?, ?)',
    [user_id, session_id, matched_category, action_taken]
  );
  return result.insertId;
}

module.exports = { findByUserId, findBySessionId, createRiskEvent };
