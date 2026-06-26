/*
 * userRepository - users 테이블
 * - findByEmail        : 이메일로 사용자 조회
 * - findById           : user_id로 사용자 조회 (pwd 제외, onboarding_completed 포함)
 * - findByProviderInfo : 소셜 로그인용 조회 (provider + sns_id)
 * - createUser         : 신규 사용자 생성
 * - updateUser         : 사용자 정보 수정 (nick_name, gender, birth_date)
 * - updatePersona      : 페르소나 업데이트
 * - updatePassword     : 비밀번호 업데이트
 * - deleteUser         : 사용자 삭제
 */

const pool = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

async function findById(userId) {
  const [rows] = await pool.query(
    `SELECT user_id, email, nick_name, gender, birth_date, provider, persona, p_checked_at, created_at,
            (persona IS NOT NULL) AS onboarding_completed
     FROM users WHERE user_id = ?`,
    [userId]
  );
  return rows[0];
}

async function createUser({ email, pwd = null, nick_name, gender, birth_date, provider, sns_id = null }) {
  const [result] = await pool.query(
    'INSERT INTO users (email, pwd, nick_name, gender, birth_date, provider, sns_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, pwd, nick_name, gender, birth_date, provider, sns_id]
  );
  return result.insertId;
}

// 전달된 필드만 업데이트 (undefined인 필드는 제외)
async function updateUser(userId, { nick_name, gender, birth_date }) {
  const fields = [];
  const values = [];

  if (nick_name !== undefined) { fields.push('nick_name = ?'); values.push(nick_name); }
  if (gender !== undefined)    { fields.push('gender = ?');    values.push(gender); }
  if (birth_date !== undefined){ fields.push('birth_date = ?');values.push(birth_date); }

  if (fields.length === 0) return;
  values.push(userId);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, values);
}

async function updatePersona(userId, persona) {
  await pool.query(
    'UPDATE users SET persona = ?, p_checked_at = NOW() WHERE user_id = ?',
    [persona, userId]
  );
}

async function updatePassword(userId, hashedPwd) {
  await pool.query('UPDATE users SET pwd = ? WHERE user_id = ?', [hashedPwd, userId]);
}

// 회원탈퇴 — 자식 데이터를 FK 순서대로 모두 삭제한 뒤 users 삭제 (트랜잭션)
// users를 참조하는 자식 테이블이 전부 ON DELETE RESTRICT라, 자식이 남아 있으면
// DELETE FROM users가 FK 제약 위반으로 실패한다. → 대화 이력이 있는 회원은
// 탈퇴가 불가능해지고, 민감 데이터(발화/감정/요약)도 파기되지 않는다.
// 삭제 순서는 sessionRepository.resetUserData와 동일 (검증된 FK 의존 순서).
async function deleteUser(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE ca FROM chat_analyses ca JOIN chat_logs cl ON ca.log_id = cl.log_id JOIN sessions s ON cl.session_id = s.session_id WHERE s.user_id = ?', [userId]);
    await conn.query('DELETE cl FROM chat_logs cl JOIN sessions s ON cl.session_id = s.session_id WHERE s.user_id = ?', [userId]);
    await conn.query('DELETE FROM reports WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM session_analyses WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM summaries WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM missions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM risk_events WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM onboardings WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM emotion_alerts WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM users WHERE user_id = ?', [userId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findByProviderInfo(provider, snsId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE provider = ? AND sns_id = ?',
    [provider, snsId]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, findByProviderInfo, createUser, updateUser, updatePersona, updatePassword, deleteUser };
