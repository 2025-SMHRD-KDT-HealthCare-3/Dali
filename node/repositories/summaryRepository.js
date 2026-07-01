/*
 * summaryRepository - summaries 테이블
 * - createSummary        : 대화 요약 저장 (세션 종료 시 FastAPI context_summary 결과 저장)
 * - findSummariesByUser  : 사용자의 전체 요약 목록 조회 (페이지네이션)
 * - findSummaryById      : 요약 단건 조회
 * - findRecentByUserId   : 최근 N개 요약 조회 (FastAPI recent_summaries용)
 */

const pool = require('../config/db');

async function createSummary({ user_id, session_id, context_summary }) {
  const [result] = await pool.query(
    'INSERT INTO summaries (user_id, session_id, context_summary) VALUES (?, ?, ?)',
    [user_id, session_id, context_summary]
  );
  return result.insertId;
}

async function findSummariesByUser(user_id, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM summaries WHERE user_id = ?',
    [user_id]
  );
  const [rows] = await pool.query(
    'SELECT summary_id, session_id, created_at FROM summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [user_id, limit, offset]
  );
  return { total, rows };
}

async function findSummaryById(summary_id) {
  const [rows] = await pool.query('SELECT * FROM summaries WHERE summary_id = ?', [summary_id]);
  return rows[0];
}

// FastAPI에 전달할 recent_summaries 구성용 — 가장 최근 N개 요약 반환
async function findRecentByUserId(user_id, limit = 5) {
  const [rows] = await pool.query(
    'SELECT context_summary, created_at FROM summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [user_id, limit]
  );
  return rows;
}

module.exports = { createSummary, findSummariesByUser, findSummaryById, findRecentByUserId };
