/*
 * riskEventController - 고위험 신호 (risk_events)
 * - getRiskEvents : GET /api/risk-events(?session_id=X)  고위험 신호 목록
 *                   session_id 없으면 전체, 있으면 세션별 필터
 */

const riskEventRepo = require('../repositories/riskEventRepository');
const sessionRepo = require('../repositories/sessionRepository');

async function getRiskEvents(req, res) {
  const { session_id } = req.query;

  if (session_id) {
    const session = await sessionRepo.findSessionById(session_id);
    if (!session) return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
    if (session.user_id !== req.user.user_id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }
    const events = await riskEventRepo.findBySessionId(session_id, req.user.user_id);
    return res.json({ risk_events: events });
  }

  const events = await riskEventRepo.findByUserId(req.user.user_id);
  res.json({ risk_events: events });
}

module.exports = { getRiskEvents };
