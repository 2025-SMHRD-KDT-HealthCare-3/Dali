/*
 * sessionRepository - sessions 테이블
 * - createSession         : 세션 생성 (감정 선택)
 * - endSession            : 세션 종료 (ended_at 업데이트)
 * - findSessionsByUser    : 사용자의 세션 목록 조회 (페이지네이션)
 * - findSessionById       : 세션 단건 조회
 * - findMessagesBySession : 세션의 대화 히스토리 조회 (chat_logs + chat_analyses JOIN)
 * - resetUserData         : 데이터 초기화 (개인정보 제외 전체 삭제)
 * - checkConsecutiveDays  : 특정 감정이 N일 연속인지 확인
 * - getTodaySessionCount  : 오늘 세션 수 조회 (greeting_type 판단용)
 * - getLastSessionDate    : 마지막 세션 날짜 조회 (방금 만든 세션 제외, greeting_type 판단용)
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

async function findSessionsByUser(user_id, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?',
    [user_id]
  );
  const [rows] = await pool.query(
    'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [user_id, limit, offset]
  );
  return { total, rows };
}

async function findSessionById(session_id) {
  const [rows] = await pool.query('SELECT * FROM sessions WHERE session_id = ?', [session_id]);
  return rows[0];
}

// chat_logs(발화)와 chat_analyses(감정 점수)를 JOIN해서 대화 히스토리 반환
async function findMessagesBySession(session_id) {
  const [rows] = await pool.query(
    `SELECT cl.log_id, cl.speaker AS role, cl.utterance AS content, cl.turn_idx, cl.spoken_at,
            ca.joy_score, ca.sad_score, ca.anxiety_score, ca.anger_score, ca.hurt_score, ca.embarrass_score
     FROM chat_logs cl
     LEFT JOIN chat_analyses ca ON cl.log_id = ca.log_id
     WHERE cl.session_id = ?
     ORDER BY cl.turn_idx ASC`,
    [session_id]
  );
  return rows;
}

// 오늘 포함 최근 N일간 dominant_emotion이 동일한 날이 N일 이상인지 확인
// 5일 연속 같은 감정이면 감정 주의 신호 생성 트리거
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

// 사용자 데이터 초기화 — 개인정보 제외한 모든 활동 데이터 삭제 (트랜잭션)
async function resetUserData(user_id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FK 의존 순서대로 삭제
    await conn.query('DELETE ca FROM chat_analyses ca JOIN chat_logs cl ON ca.log_id = cl.log_id JOIN sessions s ON cl.session_id = s.session_id WHERE s.user_id = ?', [user_id]);
    await conn.query('DELETE cl FROM chat_logs cl JOIN sessions s ON cl.session_id = s.session_id WHERE s.user_id = ?', [user_id]);
    await conn.query('DELETE FROM reports WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM session_analyses WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM summaries WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM missions WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM risk_events WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM sessions WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM onboardings WHERE user_id = ?', [user_id]);
    await conn.query('DELETE FROM emotion_alerts WHERE user_id = ?', [user_id]);
    await conn.query('UPDATE users SET persona = NULL, p_checked_at = NULL WHERE user_id = ?', [user_id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// 오늘 세션 수 조회 — 방금 만든 세션 포함, greeting_type 판단용
async function getTodaySessionCount(user_id) {
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM sessions
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [user_id]
  );
  return cnt;
}

// 마지막 세션 날짜 조회 — 방금 만든 세션 제외, greeting_type 판단용
async function getLastSessionDate(user_id, currentSessionId) {
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS last_date FROM sessions
     WHERE user_id = ? AND session_id != ?
     ORDER BY created_at DESC LIMIT 1`,
    [user_id, currentSessionId]
  );
  return rows[0]?.last_date ?? null;
}

module.exports = { createSession, endSession, findSessionsByUser, findSessionById, findMessagesBySession, checkConsecutiveDays, resetUserData, getTodaySessionCount, getLastSessionDate };
