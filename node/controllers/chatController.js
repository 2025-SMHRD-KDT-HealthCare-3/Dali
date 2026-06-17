/*
 * chatController - 챗봇 대화
 * - chat      : POST /api/chat        텍스트 메시지 전송 및 AI 응답 생성
 * - chatAudio : POST /api/chat/audio  음성 파일 → STT 변환 → 챗봇 연결
 *
 * FastAPI 응답 형식: { reply, risk: { detected, action }, joy_score, ... }
 * 위기 감지 시 Node에서 누적 횟수 집계 → 프론트 응답: { is_risk, action, hotline? }
 * 누적 1~2회: feedback / 3회 이상: hotline(1577-0199), reply를 위기 안내로 대체
 */

const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const pool = require('../config/db');
const logAnalysisRepo = require('../repositories/logAnalysisRepository');
const sessionRepo = require('../repositories/sessionRepository');
const riskEventRepo = require('../repositories/riskEventRepository');

const upload = multer({ storage: multer.memoryStorage() });

const HOTLINE_REPLY = '지금 많이 힘드시군요. 전문 상담사와 이야기 나눠보시는 것을 권해드립니다. 정신건강 위기상담 전화 1577-0199로 연락해보세요. 24시간 운영됩니다.';

// 고위험 신호 감지 시 처리 — 세션 종료 + 누적 횟수에 따라 응답 분기
async function handleRisk({ user_id, session_id, matched_category, fastapiReply, res }) {
  if (session_id) await sessionRepo.endSession(session_id);

  const prevCount = await riskEventRepo.countByUserId(user_id);
  const totalCount = prevCount + 1;
  const action = totalCount >= 3 ? 'hotline' : 'feedback';

  await riskEventRepo.createRiskEvent({ user_id, session_id, matched_category, action_taken: action });

  if (action === 'hotline') {
    return res.json({
      is_risk: true,
      action: 'hotline',
      hotline: { name: '정신건강 위기상담 전화', phone: '1577-0199' },
    });
  }
  return res.json({ is_risk: true, action: 'feedback' });
}

// 텍스트 메시지 처리 공통 로직
async function processChat(req, res, message) {
  const { session_id } = req.body;

  let log_id = null;

  if (req.user) {
    if (!session_id) {
      return res.status(400).json({ code: 'INVALID_REQUEST', message: 'session_id를 입력해주세요.' });
    }

    const [[{ turn_idx }]] = await pool.query(
      'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM chat_logs WHERE session_id = ?',
      [session_id]
    );

    const [logResult] = await pool.query(
      'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, session_id, 'user', message, turn_idx]
    );
    log_id = logResult.insertId;
  }

  let fastapiRes;
  try {
    fastapiRes = await axios.post(
      `${process.env.FASTAPI_URL}/internal/chat`,
      { log_id, session_id: session_id || null, user_id: req.user?.user_id || null, utterance: message },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { reply, risk, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;

  // 위기 감지 시 (회원 + 세션 있을 때만)
  if (req.user && session_id && risk?.detected) {
    return handleRisk({
      user_id: req.user.user_id,
      session_id,
      matched_category: risk.action || '기타',
      fastapiReply: reply,
      res,
    });
  }

  // 회원이면 AI 응답 저장 + 감정 점수 저장
  if (req.user && log_id) {
    if (reply) {
      const [[{ ai_turn_idx }]] = await pool.query(
        'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS ai_turn_idx FROM chat_logs WHERE session_id = ?',
        [session_id]
      );
      await pool.query(
        'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
        [req.user.user_id, session_id, 'assistant', reply, ai_turn_idx]
      );
    }

    await logAnalysisRepo.createLogAnalysis({
      log_id, user_id: req.user.user_id,
      joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score,
    });
  }

  res.json({ reply, is_risk: false });
}

async function chat(req, res) {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'message를 입력해주세요.' });
  }
  return processChat(req, res, message);
}

// 음성 파일 → FastAPI STT → 텍스트 변환 → 챗봇 연결
async function chatAudio(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '음성 파일을 첨부해주세요.' });
  }

  const form = new FormData();
  form.append('audio', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

  let sttRes;
  try {
    sttRes = await axios.post(
      `${process.env.FASTAPI_URL}/internal/stt`,
      form,
      { headers: { ...form.getHeaders(), 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'STT 변환에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const message = sttRes.data.text;
  if (!message) {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '음성을 텍스트로 변환하지 못했습니다.' });
  }

  req.body.message = message;
  return processChat(req, res, message);
}

module.exports = { chat, chatAudio, upload };
