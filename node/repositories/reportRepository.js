/*
 * reportRepository - reports + session_analyses 테이블
 * - findDailyReports   : 특정 날짜(기본 오늘) 리포트 목록 조회
 * - findMonthlyRaw      : 특정 월(기본 이번달) 세션 단위 raw 데이터 조회 (월간 집계용)
 */

const pool = require('../config/db');

const BASE_SELECT = `
  SELECT r.*, sa.joy_score, sa.sad_score, sa.anxiety_score, sa.anger_score,
         sa.hurt_score, sa.embarrass_score, sa.dominant_emotion,
         s.selected_emotion, s.started_at
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

// 월간 집계용 — 세션 단위 raw 데이터 (created_at ASC → 날짜별 마지막 세션이 덮어씀)
async function findMonthlyRaw(user_id, month) {
  const yearMonth = month || new Date().toISOString().slice(0, 7);
  const [rows] = await pool.query(
    `SELECT DATE(r.created_at)  AS date,
            DAY(r.created_at)   AS day_of_month,
            sa.joy_score, sa.sad_score, sa.anxiety_score,
            sa.anger_score, sa.hurt_score, sa.embarrass_score,
            sa.dominant_emotion,
            s.selected_emotion
     FROM reports r
     JOIN session_analyses sa ON r.session_analysis_id = sa.session_analysis_id
     JOIN sessions s          ON r.session_id = s.session_id
     WHERE r.user_id = ? AND DATE_FORMAT(r.created_at, '%Y-%m') = ?
     ORDER BY r.created_at ASC`,
    [user_id, yearMonth]
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

// 리포트가 존재하는 날짜 목록 조회 — month 없으면 이번 달 기준
async function findReportDates(user_id, month) {
  if (month) {
    const [rows] = await pool.query(
      `SELECT DISTINCT DATE(r.created_at) AS report_date
       FROM reports r
       WHERE r.user_id = ? AND DATE_FORMAT(r.created_at, '%Y-%m') = ?
       ORDER BY report_date ASC`,
      [user_id, month]
    );
    return rows.map(r => r.report_date);
  }
  const [rows] = await pool.query(
    `SELECT DISTINCT DATE(r.created_at) AS report_date
     FROM reports r
     WHERE r.user_id = ? AND YEAR(r.created_at) = YEAR(CURDATE()) AND MONTH(r.created_at) = MONTH(CURDATE())
     ORDER BY report_date ASC`,
    [user_id]
  );
  return rows.map(r => r.report_date);
}

module.exports = { findDailyReports, findMonthlyRaw, findReportDates, createSessionAnalysis, createReport };
