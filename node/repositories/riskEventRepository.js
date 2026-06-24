/*
 * riskEventRepository - risk_events 테이블
 * - findByUserId           : 사용자의 전체 고위험 신호 목록 조회
 * - findBySessionId        : 특정 세션의 고위험 신호 목록 조회
 * - countRiskInSession     : 세션 내 risk 레벨 이벤트 수 (FastAPI prior_risk_count로 전달)
 * - hasSafetyModeTriggered : 세션 내 안전모드 발동 이력 존재 여부 (FastAPI is_in_safety_mode로 전달)
 * - createRiskEvent        : 고위험 신호 저장 (risk/critical만)
 */

const pool = require('../config/db');

async function findByUserId(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM risk_events WHERE user_id = ? ORDER BY detected_at DESC',
    [user_id]
  );
  return rows;
}

async function findBySessionId(session_id, user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM risk_events WHERE session_id = ? AND user_id = ? ORDER BY detected_at ASC',
    [session_id, user_id]
  );
  return rows;
}

// 세션 내 risk 레벨 이벤트 수 — FastAPI prior_risk_count로 전달(안전모드 누적 판정 기준)
// FastAPI orchestrator가 "risk 3회↑ → 안전모드" 계산에 사용하므로 risk_level='risk'만 집계
async function countRiskInSession(session_id) {
  const [[{ cnt }]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM risk_events WHERE session_id = ? AND risk_level = 'risk'",
    [session_id]
  );
  return cnt;
}

// 세션 내 안전모드 발동 이력 존재 여부 — FastAPI is_in_safety_mode로 전달
async function hasSafetyModeTriggered(session_id) {
  const [[{ hit }]] = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM risk_events WHERE session_id = ? AND safety_mode_triggered = 'Y') AS hit",
    [session_id]
  );
  return hit === 1;
}

// 고위험 신호 저장 — risk_level이 'risk' 또는 'critical'일 때만 호출
// judge_factors는 호출부에서 JSON.stringify된 문자열(또는 null)을 받아 JSON 컬럼에 저장
// safety_mode_triggered는 'Y'/'N' (이 이벤트가 안전모드를 처음 발동시켰는지)
async function createRiskEvent({ user_id, session_id, risk_level, matched_category, judge_factors, safety_mode_triggered }) {
  const [result] = await pool.query(
    `INSERT INTO risk_events (user_id, session_id, risk_level, matched_category, judge_factors, safety_mode_triggered)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, session_id, risk_level, matched_category, judge_factors ?? null, safety_mode_triggered]
  );
  return result.insertId;
}

module.exports = { findByUserId, findBySessionId, countRiskInSession, hasSafetyModeTriggered, createRiskEvent };
