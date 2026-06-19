/*
 * missionRepository - missions 테이블
 * - findById           : 미션 단건 조회 (소유자 검증용)
 * - findMissionsByUser : 사용자의 미션 목록 조회 (날짜 내림차순, 순번 오름차순)
 * - completeMission    : 미션 완료 처리 (is_completed = 'Y', completed_at 업데이트)
 * - createMissions     : 미션 3개 일괄 저장 (세션 종료 시 FastAPI 결과 저장)
 * - hasMissionsToday   : 오늘 미션 생성 여부 확인 (하루 1회 생성 중복 방지)
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

async function completeMission(mission_id, user_id) {
  await pool.query(
    "UPDATE missions SET is_completed = 'Y', completed_at = NOW() WHERE mission_id = ? AND user_id = ?",
    [mission_id, user_id]
  );
}

// missions: [{ mission_seq, mission_content }] 배열 (3개)
async function createMissions(user_id, session_id, missions) {
  const today = new Date().toISOString().slice(0, 10);
  const values = missions.map(({ mission_seq, mission_content }) => [
    user_id, session_id, today, mission_seq, mission_content,
  ]);
  await pool.query(
    'INSERT INTO missions (user_id, session_id, mission_date, mission_seq, mission_content) VALUES ?',
    [values]
  );
}

async function hasMissionsToday(user_id) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM missions WHERE user_id = ? AND mission_date = CURDATE()',
    [user_id]
  );
  return count > 0;
}

module.exports = { findById, createMissions, findMissionsByUser, completeMission, hasMissionsToday };
