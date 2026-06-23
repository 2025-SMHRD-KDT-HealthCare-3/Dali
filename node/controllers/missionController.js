/*
 * missionController - 회복 미션
 * - getMissions         : GET   /api/missions      회복 미션 조회
 * - updateMissionStatus : PATCH /api/missions/:id  미션 완료/취소 처리 (body의 is_completed 적용)
 */

const missionRepo = require('../repositories/missionRepository');

// 내 미션 목록 조회 (날짜 내림차순, 순번 오름차순)
async function getMissions(req, res) {
  const missions = await missionRepo.findMissionsByUser(req.user.user_id);
  res.json({ missions });
}

// 미션 완료/취소 처리 — body의 is_completed('Y'=완료, 'N'=취소) 값을 그대로 적용
async function updateMissionStatus(req, res) {
  const { is_completed } = req.body;
  if (is_completed !== 'Y' && is_completed !== 'N') {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: "is_completed는 'Y' 또는 'N'이어야 합니다." });
  }

  const mission = await missionRepo.findById(req.params.id);
  if (!mission) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '미션을 찾을 수 없습니다.' });
  }
  // 다른 사람 미션 조작 시도 차단 (IDOR 방어)
  if (mission.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  await missionRepo.setMissionCompleted(req.params.id, req.user.user_id, is_completed);
  res.json({ is_completed });
}

module.exports = { getMissions, updateMissionStatus };
