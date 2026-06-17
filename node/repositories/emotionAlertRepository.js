/*
 * emotionAlertRepository - emotion_alerts 테이블
 * - findById     : 단건 조회 (소유자 검증용)
 * - findByUserId : 사용자의 감정 주의 신호 목록 조회 (페이지네이션)
 * - confirmAlert : 감정 주의 신호 확인 처리 (is_confirmed = 'Y', resolved_at 업데이트)
 * - createAlert  : 감정 주의 신호 생성
 */

const pool = require('../config/db');

async function findById(e_alert_id) {
  const [rows] = await pool.query('SELECT * FROM emotion_alerts WHERE e_alert_id = ?', [e_alert_id]);
  return rows[0];
}

async function findByUserId(user_id, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM emotion_alerts WHERE user_id = ?',
    [user_id]
  );
  const [rows] = await pool.query(
    'SELECT * FROM emotion_alerts WHERE user_id = ? ORDER BY alerted_at DESC LIMIT ? OFFSET ?',
    [user_id, limit, offset]
  );
  return { total, rows };
}

async function confirmAlert(e_alert_id, user_id) {
  await pool.query(
    "UPDATE emotion_alerts SET is_confirmed = 'Y', resolved_at = NOW() WHERE e_alert_id = ? AND user_id = ?",
    [e_alert_id, user_id]
  );
}

async function createAlert({ user_id, alerted_emotion, alert_reason }) {
  const [result] = await pool.query(
    'INSERT INTO emotion_alerts (user_id, alerted_emotion, alert_reason) VALUES (?, ?, ?)',
    [user_id, alerted_emotion, alert_reason]
  );
  return result.insertId;
}

module.exports = { findById, findByUserId, confirmAlert, createAlert };
