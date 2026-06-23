/*
 * missionRepository - missions 테이블
 * - findById           : 미션 단건 조회 (소유자 검증용)
 * - findMissionsByUser : 사용자의 미션 목록 조회 (날짜 내림차순, 순번 오름차순)
 * - setMissionCompleted: 미션 완료 상태 토글 (Y=완료/시각기록, N=취소/시각NULL)
 * - createMissions     : 미션 3개 일괄 저장 (세션 종료 시 FastAPI 결과 저장)
 * - hasMissionsToday   : 오늘 미션 생성 여부 확인 (하루 1회 생성 중복 방지)
 * - findTodayMissions  : 오늘 미션 목록 조회 (세션 종료 후 프론트 반환용)
 * - findRecentContents : 최근 N일 미션 내용 조회 (FastAPI 중복 회피용 recent_missions)
 */

const pool = require('../config/db');

async function findById(mission_id) {
  const [rows] = await pool.query('SELECT * FROM missions WHERE mission_id = ?', [mission_id]);
  return rows[0];
}

async function findMissionsByUser(user_id) {
  const [rows] = await pool.query(
    'SELECT * FROM missions WHERE user_id = ? ORDER BY mission_date DESC, mission_seq ASC',
    [user_id]
  );
  return rows;
}

// 완료 상태 토글 — state='Y'면 완료(시각 기록), 'N'이면 취소(시각 NULL)
// completed_at은 MySQL NOW()(KST, db.js의 SET time_zone='+09:00')로 기록 — JS-UTC Date 사용 금지
async function setMissionCompleted(mission_id, user_id, state) {
  await pool.query(
    "UPDATE missions SET is_completed = ?, completed_at = IF(? = 'Y', NOW(), NULL) WHERE mission_id = ? AND user_id = ?",
    [state, state, mission_id, user_id]
  );
}

// missions: [{ mission_seq, mission_content }] 배열 (3개)
// mission_date는 MySQL CURDATE()로 생성 — hasMissionsToday/findRecentContents의 CURDATE()와
// 동일한 DB 시계를 써야 "하루 1회" 판정이 어긋나지 않음 (JS-UTC 날짜 사용 금지)
async function createMissions(user_id, session_id, missions) {
  const placeholders = missions.map(() => '(?, ?, CURDATE(), ?, ?)').join(', ');
  const params = missions.flatMap(({ mission_seq, mission_content }) => [
    user_id, session_id, mission_seq, mission_content,
  ]);
  await pool.query(
    `INSERT INTO missions (user_id, session_id, mission_date, mission_seq, mission_content) VALUES ${placeholders}`,
    params
  );
}

async function hasMissionsToday(user_id) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM missions WHERE user_id = ? AND mission_date = CURDATE()',
    [user_id]
  );
  return count > 0;
}

// 오늘 미션 조회 — 세션 종료 후 프론트에 반환 (신규 생성/기존 무관하게 그날 미션)
async function findTodayMissions(user_id) {
  const [rows] = await pool.query(
    `SELECT mission_id, mission_seq, mission_content, is_completed
     FROM missions
     WHERE user_id = ? AND mission_date = CURDATE()
     ORDER BY mission_seq ASC`,
    [user_id]
  );
  return rows;
}

// 최근 N일치 미션 내용 조회 — FastAPI 미션 생성 시 중복 회피용(recent_missions)
async function findRecentContents(user_id, days = 5) {
  const [rows] = await pool.query(
    `SELECT mission_content FROM missions
     WHERE user_id = ? AND mission_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY mission_date DESC, mission_seq ASC`,
    [user_id, days]
  );
  return rows.map(r => r.mission_content);
}

module.exports = { findById, createMissions, findMissionsByUser, setMissionCompleted, hasMissionsToday, findTodayMissions, findRecentContents };
