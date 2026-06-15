/*
 * missionController - 회복 미션
 * - getMissions      : GET   /api/missions      회복 미션 조회
 * - completeMission  : PATCH /api/missions/:id  미션 완료 처리
 */

const missionRepo = require('../repositories/missionRepository');

async function getMissions(req, res) {
  const missions = await missionRepo.findMissionsByUser(req.user.user_id);
  res.json({ missions });
}

async function completeMission(req, res) {
  await missionRepo.completeMission(req.params.id, req.user.user_id);
  res.json({ message: '미션을 완료했습니다.' });
}

module.exports = { getMissions, completeMission };
