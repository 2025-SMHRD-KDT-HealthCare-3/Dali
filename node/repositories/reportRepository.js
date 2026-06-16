/*
 * reportRepository - reports + session_analyses 테이블
 * - findDailyReports   : 특정 날짜(기본 오늘) 리포트 목록 조회
 * - findMonthlyReports : 특정 월(기본 이번달) 리포트 목록 조회
 */

const pool = require('../config/db');

const BASE_SELECT = `
  SELECT r.*, sa.joy_score, sa.sad_score, sa.anxiety_score, sa.anger_score,
         sa.hurt_score, sa.embarrass_score, sa.dominant_emotion,
         s.selected_emotion
  FROM reports r
  JOIN session_analyses sa ON r.session_analysis_id = sa.session_analysis_id
  JOIN sessions s ON r.session_id = s.session_id`;

async function findDailyReports(user_id, date) {
  if (date) {
    const [rows] = await pool.query(
      `${BASE_SELECT} WHERE r.user_id = ? AND DATE(r.created_at) = ? ORDER BY r.created_at DESC`,
      [user_id, date]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE r.user_id = ? AND DATE(r.created_at) = CURDATE() ORDER BY r.created_at DESC`,
    [user_id]
  );
  return rows;
}

async function findMonthlyReports(user_id, month) {
  if (month) {
    const [rows] = await pool.query(
      `${BASE_SELECT} WHERE r.user_id = ? AND DATE_FORMAT(r.created_at, '%Y-%m') = ? ORDER BY r.created_at DESC`,
      [user_id, month]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `${BASE_SELECT}
     WHERE r.user_id = ? AND YEAR(r.created_at) = YEAR(CURDATE()) AND MONTH(r.created_at) = MONTH(CURDATE())
     ORDER BY r.created_at DESC`,
    [user_id]
  );
  return rows;
}

async function createSessionAnalysis({ session_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score, dominant_emotion }) {
  const [result] = await pool.query(
    `INSERT INTO session_analyses
     (session_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score, dominant_emotion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session_id, user_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score, dominant_emotion]
  );
  return result.insertId;
}

async function createReport({ user_id, session_id, session_analysis_id, one_line_review }) {
  const [result] = await pool.query(
    'INSERT INTO reports (user_id, session_id, session_analysis_id, one_line_review) VALUES (?, ?, ?, ?)',
    [user_id, session_id, session_analysis_id, one_line_review ?? null]
  );
  return result.insertId;
}

module.exports = { findDailyReports, findMonthlyReports, createSessionAnalysis, createReport };
