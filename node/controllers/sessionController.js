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

// 날짜 차이 계산 — greeting_type 판단용 (long_time_return 기준: 7일 이상)
function daysDiff(dateStr) {
  const now  = new Date();
  const past = new Date(dateStr);
  return Math.floor((now - past) / (1000 * 60 * 60 * 24));
}

// 감정 주의 신호를 발생시킬 감정 목록
const ALERT_EMOTIONS = ['슬픔', '불안', '분노', '상처'];

// 세션 시작 — 감정 선택 후 호출, session_id + greeting_type 반환
async function startSession(req, res) {
  const { selected_emotion } = req.body;
  if (!selected_emotion) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '감정을 선택해주세요.' });
  }

  const user_id = req.user.user_id;
  const sessionId = await sessionRepo.createSession({ user_id, selected_emotion });

  // greeting_type 판단에 필요한 데이터 병렬 조회
  const [totalCount, lastDate, latestAlert] = await Promise.all([
    sessionRepo.getTodaySessionCount(user_id),       // 방금 만든 세션 포함
    sessionRepo.getLastSessionDate(user_id, sessionId), // 방금 만든 세션 제외
    emotionAlertRepo.findLatestUnconfirmed(user_id),
  ]);

  // greeting_type 판단 — 우선순위: emotion_alert > first_visit > long_time_return > same_day_return > today_first
  const isFirstVisit     = !lastDate && totalCount === 1;
  const isLongTimeReturn = lastDate && daysDiff(lastDate) >= 7;
  const isSameDayReturn  = totalCount > 1;

  const greeting_type =
    latestAlert        ? 'emotion_alert'     :
    isFirstVisit       ? 'first_visit'       :
    isLongTimeReturn   ? 'long_time_return'  :
    isSameDayReturn    ? 'same_day_return'   :
    'today_first';

  res.status(201).json({
    session_id:          sessionId,
    greeting_type,
    today_session_count: totalCount - 1,  // 방금 만든 세션 제외한 오늘 세션 수
    last_session_date:   lastDate ? lastDate.toISOString().split('T')[0] : null,
    has_emotion_alert:   !!latestAlert,
    alert_context: latestAlert ? {
      alert_id:      latestAlert.e_alert_id,
      alert_emotion: latestAlert.alerted_emotion,
      alert_reason:  latestAlert.alert_reason,
      alert_message: `최근 며칠 동안 ${latestAlert.alerted_emotion} 감정이 자주 나타나고 있어요.`,
    } : null,
  });
}

// 세션 종료 — FastAPI에 분석 요청 후 결과를 여러 테이블에 저장
async function endSession(req, res) {
  const { id } = req.params;
  const session = await sessionRepo.findSessionById(id);

  if (!session) {
    return res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다.' });
  }
  // 다른 사람의 세션 종료 시도 차단 (IDOR 방어)
  if (session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  // DB에서 세션 ended_at 업데이트
  await sessionRepo.endSession(id);

  // FastAPI 페이로드 구성 — 대화 내역과 감정 점수를 직접 조회해서 전달
  // FastAPI가 DB를 직접 조회하지 않고 Node에서 넘겨주는 방식
  const messages = await sessionRepo.findMessagesBySession(id);
  // chat_logs: role/content 형식으로 변환
  const chat_logs = messages.map(m => ({ role: m.role, content: m.content }));
  // score_rows: 사용자 발화 중 감정 점수가 있는 것만 추출
  const score_rows = messages
    .filter(m => m.role === 'user' && m.joy_score !== null)
    .map(m => ({
      joy_score: m.joy_score, sad_score: m.sad_score, anxiety_score: m.anxiety_score,
      anger_score: m.anger_score, hurt_score: m.hurt_score, embarrass_score: m.embarrass_score,
    }));

  // FastAPI에 세션 분석 요청
  // 반환값: 감정 점수들, 주요 감정, 대화 요약, 한줄 리뷰, 미션 3개
  let data;
  try {
    ({ data } = await axios.post(
      `${process.env.FASTAPI_URL}/sessions/${id}/analyze`,
      {
        user_id:          req.user.user_id,
        selected_emotion: session.selected_emotion,
        chat_logs,
        score_rows,
      },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    ));
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '세션 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const {
    joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
    dominant_emotion, context_summary, one_line_review, missions,
  } = data;

  // session_analyses 저장 (감정 점수 + 주요 감정)
  const sessionAnalysisId = await reportRepo.createSessionAnalysis({
    session_id: id, user_id: req.user.user_id,
    joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score, dominant_emotion,
  });

  // reports / summaries / missions 동시에 저장
  await Promise.all([
    reportRepo.createReport({ user_id: req.user.user_id, session_id: id, session_analysis_id: sessionAnalysisId, one_line_review }),
    summaryRepo.createSummary({ user_id: req.user.user_id, session_id: id, context_summary }),
    missionRepo.createMissions(req.user.user_id, id, missions.map((m, i) => ({
      mission_seq: i + 1,
      mission_content: m.title,
    }))),
  ]);

  // 주요 감정이 ALERT 목록에 있고 5일 연속이면 감정 주의 신호 자동 생성
  if (dominant_emotion && ALERT_EMOTIONS.includes(dominant_emotion)) {
    const isConsecutive = await sessionRepo.checkConsecutiveDays(req.user.user_id, dominant_emotion);
    if (isConsecutive) {
      await emotionAlertRepo.createAlert({
        user_id: req.user.user_id,
        alerted_emotion: dominant_emotion,
        alert_reason: `${dominant_emotion} 5일 연속 분석`,
      });
    }
  }

  res.json({ message: '세션이 종료되었습니다.' });
}

// 내 세션 목록 조회 (페이지네이션)
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

// 세션 단건 조회 — 다른 사람 세션 조회 차단 (IDOR 방어)
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

// 세션 대화 히스토리 조회 — 발화(chat_logs)와 감정분석(chat_analyses) JOIN해서 반환
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

// 데이터 초기화 — 개인정보 제외한 모든 활동 데이터 삭제
async function resetSessions(req, res) {
  await sessionRepo.resetUserData(req.user.user_id);
  res.json({ message: '데이터가 초기화되었습니다.' });
}

module.exports = { startSession, endSession, getSessions, getSessionById, getSessionMessages, resetSessions };
