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

async function updateUser(userId, { nick_name, gender, birth_date }) {
  await pool.query(
    'UPDATE users SET nick_name = ?, gender = ?, birth_date = ? WHERE user_id = ?',
    [nick_name, gender, birth_date, userId]
  );
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

async function deleteUser(userId) {
  await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
}

async function findByProviderInfo(provider, snsId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE provider = ? AND sns_id = ?',
    [provider, snsId]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, findByProviderInfo, createUser, updateUser, updatePersona, updatePassword, deleteUser };
