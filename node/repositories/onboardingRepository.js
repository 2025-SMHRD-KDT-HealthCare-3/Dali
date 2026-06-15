/*
 * onboardingRepository - onboardings 테이블
 * - createOnboarding : 온보딩 설문 저장 (질문별 1건, UNIQUE user_id+question_no)
 */

const pool = require('../config/db');

async function createOnboarding({ user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer }) {
  const [result] = await pool.query(
    'INSERT INTO onboardings (user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5 || null, user_answer]
  );
  return result.insertId;
}

async function findAnswersByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT question_no, user_answer FROM onboardings WHERE user_id = ? ORDER BY question_no ASC',
    [user_id]
  );
  return rows;
}

module.exports = { createOnboarding, findAnswersByUser };
