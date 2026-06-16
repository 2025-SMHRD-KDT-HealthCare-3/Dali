/*
 * summaryController - 대화 요약 (summaries)
 * - getSummaries  : GET /api/summaries       내 대화 요약 전체 목록 (페이지네이션)
 * - getSummaryById: GET /api/summaries/:id   요약 상세 조회 (소유자 검증)
 */

const summaryRepo = require('../repositories/summaryRepository');

async function getSummaries(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { total, rows } = await summaryRepo.findSummariesByUser(req.user.user_id, page, limit);
  res.json({
    summaries: rows,
    total,
    page,
    has_next: page * limit < total,
  });
}

async function getSummaryById(req, res) {
  const { id } = req.params;
  const summary = await summaryRepo.findSummaryById(id);

  if (!summary) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '요약을 찾을 수 없습니다.' });
  }
  if (summary.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  res.json({ summary });
}

module.exports = { getSummaries, getSummaryById };
