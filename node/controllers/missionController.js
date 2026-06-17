/*
 * missionController - 회복 미션
 * - getMissions      : GET   /api/missions      회복 미션 조회
 * - completeMission  : PATCH /api/missions/:id  미션 완료 처리
 */

const missionRepo = require('../repositories/missionRepository');

// 내 미션 목록 조회 (날짜 내림차순, 순번 오름차순)
async function getMissions(req, res) {
  const missions = await missionRepo.findMissionsByUser(req.user.user_id);
  res.json({ missions });
}

// 미션 완료 처리 — 소유자 검증 후 is_completed = 'Y', completed_at 업데이트
async function completeMission(req, res) {
  const mission = await missionRepo.findById(req.params.id);

  if (!mission) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '미션을 찾을 수 없습니다.' });
  }
  // 다른 사람 미션 완료 시도 차단 (IDOR 방어)
  if (mission.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  await missionRepo.completeMission(req.params.id, req.user.user_id);
  res.json({ message: '미션을 완료했습니다.' });
}

module.exports = { getMissions, completeMission };
