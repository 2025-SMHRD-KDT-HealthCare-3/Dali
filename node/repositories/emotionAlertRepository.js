/*
 * emotionAlertRepository - emotion_alerts 테이블
 * - findByUserId  : 사용자의 감정 주의 신호 목록 조회
 * - confirmAlert  : 감정 주의 신호 확인 처리 (is_confirmed = 'Y', resolved_at 업데이트)
 */

const pool = require('../config/db');

async function findByUserId(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM emotion_alerts WHERE user_id = ? ORDER BY alerts_at DESC',
    [user_id]
  );
  return rows;
}

async function confirmAlert(e_alert_id, user_id) {
  await pool.query(
    "UPDATE emotion_alerts SET is_confirmed = 'Y', resolved_at = NOW() WHERE e_alert_id = ? AND user_id = ?",
    [e_alert_id, user_id]
  );
}

async function createAlert({ user_id, alerts_emotion, alerts_reason }) {
  const [result] = await pool.query(
    'INSERT INTO emotion_alerts (user_id, alerts_emotion, alerts_reason) VALUES (?, ?, ?)',
    [user_id, alerts_emotion, alerts_reason]
  );
  return result.insertId;
}

module.exports = { findByUserId, confirmAlert, createAlert };
