/*
 * chatController - 챗봇 대화
 * - chat : POST /api/chat  사용자 메시지 전송 및 AI 응답 생성
 *          고위험 감지는 FastAPI(LLM)가 전담 → is_risk: true 반환 시 처리
 *          고위험 감지 시 세션 종료 + risk_events 저장 + 프론트에 위험 응답 반환
 *          누적 횟수 1~2회: feedback, 3회 이상: hotline(1577-0199)
 */

const axios = require('axios');
const pool = require('../config/db');
const logAnalysisRepo = require('../repositories/logAnalysisRepository');
const sessionRepo = require('../repositories/sessionRepository');
const riskEventRepo = require('../repositories/riskEventRepository');

// 고위험 신호 감지 시 처리 — 세션 종료 + 누적 횟수에 따라 응답 분기
async function handleRisk({ user_id, session_id, matched_category, res }) {
  // 세션 종료 (ended_at 업데이트)
  if (session_id) await sessionRepo.endSession(session_id);

  // 저장 전 기존 누적 횟수 조회 → 이번 포함 횟수로 분기
  const prevCount = await riskEventRepo.countByUserId(user_id);
  const totalCount = prevCount + 1;
  const action = totalCount >= 3 ? 'hotline' : 'feedback';

  // risk_events 테이블에 이번 위기 신호 저장
  await riskEventRepo.createRiskEvent({ user_id, session_id, matched_category, action_taken: action });

  // 3회 이상이면 핫라인 번호 포함해서 응답
  if (action === 'hotline') {
    return res.json({
      is_risk: true,
      action: 'hotline',
      hotline: { name: '정신건강 위기상담 전화', phone: '1577-0199' },
    });
  }
  // 1~2회는 피드백만
  return res.json({ is_risk: true, action: 'feedback' });
}

async function chat(req, res) {
  const { session_id, message } = req.body;
  if (!message) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'message를 입력해주세요.' });
  }

  let log_id = null;

  // 회원인 경우에만 발화를 emotion_logs 테이블에 저장
  if (req.user) {
    if (!session_id) {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'session_id를 입력해주세요.' });
    }

    // 현재 세션에서 몇 번째 발화인지 계산 (1부터 시작)
    const [[{ turn_idx }]] = await pool.query(
      'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM emotion_logs WHERE session_id = ?',
      [session_id]
    );

    // 발화 저장 — 나중에 감정 분석 결과와 연결하기 위해 log_id 보관
    const [logResult] = await pool.query(
      'INSERT INTO emotion_logs (user_id, session_id, utterance, turn_idx) VALUES (?, ?, ?, ?)',
      [req.user.user_id, session_id, message, turn_idx]
    );
    log_id = logResult.insertId;
  }

  // FastAPI에 메시지 전달 — 회원/비회원 모두 AI 응답 받음
  // FastAPI가 LLM으로 답변 생성 + 감정 점수 + 고위험 여부 반환
  let fastapiRes;
  try {
    fastapiRes = await axios.post(
      `${process.env.FASTAPI_URL}/chat`,
      { log_id, session_id: session_id || null, user_id: req.user?.user_id || null, message },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  // FastAPI가 고위험 신호를 감지한 경우 (회원 + 세션 있을 때만 처리)
  if (req.user && session_id && fastapiRes.data.is_risk) {
    return handleRisk({
      user_id: req.user.user_id,
      session_id,
      matched_category: fastapiRes.data.matched_category || '기타',
      res,
    });
  }

  // 회원이면 FastAPI가 반환한 발화별 감정 점수를 log_analyses에 저장
  if (req.user && log_id) {
    const { joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;
    await logAnalysisRepo.createLogAnalysis({
      log_id, user_id: req.user.user_id,
      joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
    });
  }

  // FastAPI 응답을 그대로 프론트에 전달
  res.json(fastapiRes.data);
}

module.exports = { chat };
