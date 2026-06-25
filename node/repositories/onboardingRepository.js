/*
 * onboardingRepository - onboardings 테이블
 * - upsertOnboarding   : 온보딩 설문 저장 (같은 question_no 재답변 시 UPDATE)
 * - findAllByUser      : 유저의 온보딩 답변 전체 조회 (채팅 q3 컨텍스트용)
 */

const pool = require('../config/db');

async function upsertOnboarding({ user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer }) {
  const [result] = await pool.query(
    `INSERT INTO onboardings (user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_answer = VALUES(user_answer)`,
    [user_id, question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5 || null, user_answer]
  );
  return result.insertId || result.affectedRows;
}

async function findAllByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM onboardings WHERE user_id = ? ORDER BY question_no ASC',
    [user_id]
  );
  return rows;
}

module.exports = { upsertOnboarding, findAllByUser };
