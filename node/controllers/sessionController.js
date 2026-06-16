/*
 * sessionController - 대화 세션 관리
 * - startSession      : POST  /api/sessions              감정 선택 및 세션 시작
 * - endSession        : PATCH /api/sessions/:id/end      세션 종료
 * - getSessions       : GET   /api/sessions              내 세션 목록 조회 (페이지네이션)
 * - getSessionById    : GET   /api/sessions/:id          세션 상세 조회 (IDOR 차단)
 * - getSessionMessages: GET   /api/sessions/:id/messages 세션 대화 히스토리 조회
 */

const axios = require('axios');
const sessionRepo = require('../repositories/sessionRepository');
const emotionAlertRepo = require('../repositories/emotionAlertRepository');
const reportRepo = require('../repositories/reportRepository');
const summaryRepo = require('../repositories/summaryRepository');
const missionRepo = require('../repositories/missionRepository');

const ALERT_EMOTIONS = ['슬픔', '불안', '분노', '상처'];

async function startSession(req, res) {
  const { selected_emotion } = req.body;
  if (!selected_emotion) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '감정을 선택해주세요.' });
  }

  const sessionId = await sessionRepo.createSession({
    user_id: req.user.user_id,
    selected_emotion,
  });

  res.status(201).json({ session_id: sessionId });
}

async function endSession(req, res) {
  const { id } = req.params;
  const session = await sessionRepo.findSessionById(id);

  if (!session) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
  }
  if (session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  await sessionRepo.endSession(id);

  // FastAPI: 세션 분석/요약/미션 생성 요청
  let data;
  try {
    ({ data } = await axios.post(
      `${process.env.FASTAPI_URL}/sessions/${id}/analyze`,
      { user_id: req.user.user_id },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    ));
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '세션 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const {
    joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
    dominant_emotion, context_summary, one_line_review, missions,
  } = data;

  // session_analyses 저장 → reports 저장 → summaries 저장 → missions 저장
  const sessionAnalysisId = await reportRepo.createSessionAnalysis({
    session_id: id, user_id: req.user.user_id,
    joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score, dominant_emotion,
  });

  await Promise.all([
    reportRepo.createReport({ user_id: req.user.user_id, session_id: id, session_analysis_id: sessionAnalysisId, one_line_review }),
    summaryRepo.createSummary({ user_id: req.user.user_id, session_id: id, context_summary }),
    missionRepo.createMissions(req.user.user_id, id, missions),
  ]);

  // dominant_emotion이 5일 연속이면 감정 주의 신호 생성
  if (dominant_emotion && ALERT_EMOTIONS.includes(dominant_emotion)) {
    const isConsecutive = await sessionRepo.checkConsecutiveDays(req.user.user_id, dominant_emotion);
    if (isConsecutive) {
      await emotionAlertRepo.createAlert({
        user_id: req.user.user_id,
        alerts_emotion: dominant_emotion,
        alerts_reason: `${dominant_emotion} 5일 연속 분석`,
      });
    }
  }

  res.json({ message: '세션이 종료되었습니다.' });
}

async function getSessions(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { total, rows } = await sessionRepo.findSessionsByUser(req.user.user_id, page, limit);
  res.json({
    sessions: rows,
    total,
    page,
    has_next: page * limit < total,
  });
}

async function getSessionById(req, res) {
  const { id } = req.params;
  const session = await sessionRepo.findSessionById(id);

  if (!session) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
  }
  if (session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  res.json({ session });
}

async function getSessionMessages(req, res) {
  const { id } = req.params;
  const session = await sessionRepo.findSessionById(id);

  if (!session) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
  }
  if (session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  const messages = await sessionRepo.findMessagesBySession(id);
  res.json({ messages });
}

module.exports = { startSession, endSession, getSessions, getSessionById, getSessionMessages };
