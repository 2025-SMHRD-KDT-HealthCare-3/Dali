/*
 * chatController - 챗봇 대화
 * - chat : POST /api/chat  사용자 메시지 전송 및 AI 응답 생성
 *          고위험 감지는 FastAPI(LLM)가 전담 → is_risk: true 반환 시 처리
 *          고위험 감지 시 세션 종료 + risk_events 저장 + 프론트에 위험 응답 반환
 */

const axios = require('axios');
const pool = require('../config/db');
const logAnalysisRepo = require('../repositories/logAnalysisRepository');
const sessionRepo = require('../repositories/sessionRepository');
const riskEventRepo = require('../repositories/riskEventRepository');

async function handleRisk({ user_id, session_id, matched_category, res }) {
  if (session_id) await sessionRepo.endSession(session_id);
  await riskEventRepo.createRiskEvent({ user_id, session_id, matched_category, action_taken: 'hotline' });
  return res.json({ is_risk: true, action: 'hotline' });
}

async function chat(req, res) {
  const { session_id, message } = req.body;
  if (!message) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'message를 입력해주세요.' });
  }

  let log_id = null;

  // 회원인 경우에만 DB 저장
  if (req.user) {
    if (!session_id) {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'session_id를 입력해주세요.' });
    }

    const [[{ turn_idx }]] = await pool.query(
      'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM emotion_logs WHERE session_id = ?',
      [session_id]
    );

    const [logResult] = await pool.query(
      'INSERT INTO emotion_logs (user_id, session_id, utterance, turn_idx) VALUES (?, ?, ?, ?)',
      [req.user.user_id, session_id, message, turn_idx]
    );
    log_id = logResult.insertId;
  }

  // FastAPI로 메시지 전달 (회원/비회원 모두)
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

  // 고위험 감지 — FastAPI(LLM)가 감지한 경우
  if (req.user && session_id && fastapiRes.data.is_risk) {
    return handleRisk({
      user_id: req.user.user_id,
      session_id,
      matched_category: fastapiRes.data.matched_category || '기타',
      res,
    });
  }

  // 회원이면 발화별 감정 분석 저장
  if (req.user && log_id) {
    const { joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;
    await logAnalysisRepo.createLogAnalysis({
      log_id, user_id: req.user.user_id,
      joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
    });
  }

  res.json(fastapiRes.data);
}

module.exports = { chat };
