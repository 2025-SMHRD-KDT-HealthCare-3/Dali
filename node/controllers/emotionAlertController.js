/*
 * emotionAlertController - 감정 주의 신호 (emotion_alerts)
 * - getEmotionAlerts : GET   /api/emotion-alerts              감정 주의 신호 목록
 * - confirmAlert     : PATCH /api/emotion-alerts/:id/confirm  감정 주의 신호 확인 처리
 */

const emotionAlertRepo = require('../repositories/emotionAlertRepository');

async function getEmotionAlerts(req, res) {
  const alerts = await emotionAlertRepo.findByUserId(req.user.user_id);
  res.json({ alerts });
}

async function confirmAlert(req, res) {
  await emotionAlertRepo.confirmAlert(req.params.id, req.user.user_id);
  res.json({ message: '감정 주의 신호가 확인되었습니다.' });
}

module.exports = { getEmotionAlerts, confirmAlert };
