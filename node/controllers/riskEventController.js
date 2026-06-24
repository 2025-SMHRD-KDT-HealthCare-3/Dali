/*
 * riskEventController - 고위험 신호 (risk_events)
 * - getRiskEvents : GET /api/risk-events(?session_id=X)  고위험 신호 목록
 *                   session_id 없으면 전체, 있으면 세션별 필터
 */

const riskEventRepo = require('../repositories/riskEventRepository');
const sessionRepo = require('../repositories/sessionRepository');

// 고위험 신호 목록 조회
// chatController에서 FastAPI 응답의 risk_level이 risk/critical일 때 자동 저장됨
async function getRiskEvents(req, res) {
  const { session_id } = req.query;

  if (session_id) {
    // 세션 존재 여부 + 소유자 검증
    const session = await sessionRepo.findSessionById(session_id);
    if (!session) return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
    if (session.user_id !== req.user.user_id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }
    const events = await riskEventRepo.findBySessionId(session_id, req.user.user_id);
    return res.json({ risk_events: events });
  }

  // session_id 없으면 내 전체 고위험 신호 반환
  const events = await riskEventRepo.findByUserId(req.user.user_id);
  res.json({ risk_events: events });
}

module.exports = { getRiskEvents };
