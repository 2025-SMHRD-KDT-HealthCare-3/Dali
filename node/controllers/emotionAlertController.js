/*
 * emotionAlertController - 감정 주의 신호 (emotion_alerts)
 * - getEmotionAlerts : GET   /api/emotion-alerts              감정 주의 신호 목록 (페이지네이션)
 * - confirmAlert     : PATCH /api/emotion-alerts/:id/confirm  감정 주의 신호 확인 처리
 */

const emotionAlertRepo = require('../repositories/emotionAlertRepository');

// 감정 주의 신호 목록 조회 (페이지네이션)
// 5일 연속 동일 감정 감지 시 sessionController에서 자동 생성됨
async function getEmotionAlerts(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { total, rows } = await emotionAlertRepo.findByUserId(req.user.user_id, page, limit);
  res.json({
    alerts: rows,
    total,
    page,
    has_next: page * limit < total,
  });
}

// 감정 주의 신호 확인 처리 — 소유자 검증 후 is_confirmed 업데이트
async function confirmAlert(req, res) {
  const alert = await emotionAlertRepo.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '감정 주의 신호를 찾을 수 없습니다.' });
  }
  // 다른 사람 알림 확인 시도 차단 (IDOR 방어)
  if (alert.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  await emotionAlertRepo.confirmAlert(req.params.id, req.user.user_id);
  res.json({ message: '감정 주의 신호가 확인되었습니다.' });
}

module.exports = { getEmotionAlerts, confirmAlert };
