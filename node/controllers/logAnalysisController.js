/*
 * logAnalysisController - 발화별 감정 분석 (chat_analyses)
 * - getLogAnalysesBySession : GET /api/log-analyses?session_id=X  세션의 발화별 감정 분석 목록 (페이지네이션)
 */

const logAnalysisRepo = require('../repositories/logAnalysisRepository');
const sessionRepo = require('../repositories/sessionRepository');

// 세션별 발화 감정 분석 목록 조회
// chatController에서 FastAPI 응답의 감정 점수를 저장한 결과를 조회
async function getLogAnalysesBySession(req, res) {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'session_id 쿼리 파라미터를 입력해주세요.' });
  }

  // 세션 존재 여부 + 소유자 검증
  const session = await sessionRepo.findSessionById(session_id);
  if (!session) return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
  if (session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { total, rows } = await logAnalysisRepo.findBySessionId(session_id, page, limit);
  res.json({
    analyses: rows,
    total,
    page,
    has_next: page * limit < total,
  });
}

module.exports = { getLogAnalysesBySession };
