/*
 * summaryRepository - summaries 테이블
 * - createSummary : 대화 요약 저장 (LLM 맥락 참고용 — FastAPI에서 직접 DB 조회)
 */

const pool = require('../config/db');

async function createSummary({ user_id, session_id, context_summary }) {
  const [result] = await pool.query(
    'INSERT INTO summaries (user_id, session_id, context_summary) VALUES (?, ?, ?)',
    [user_id, session_id, context_summary]
  );
  return result.insertId;
}

module.exports = { createSummary };
