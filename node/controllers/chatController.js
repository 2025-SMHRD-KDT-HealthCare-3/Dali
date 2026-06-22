/*
 * chatController - 챗봇 대화
 *
 * [텍스트 흐름 - B안]
 * 프론트에서 사용자가 타이핑을 멈추면 그동안 입력한 내용을 합쳐서 한 번에 전송
 * → Node가 FastAPI 먼저 호출 → 응답 받은 후 DB 저장
 * → DB 저장을 FastAPI 호출 후로 미루는 이유: chat_logs(log_id)와 chat_analyses(감정점수)가
 *   FK로 묶여 있어서 먼저 저장하면 감정점수를 어떤 log_id에 연결할지 불명확해짐
 *   FastAPI 응답 후 한꺼번에 저장하면 log_id 1개 : 감정점수 1세트로 깔끔하게 매핑 가능
 *
 * [음성 흐름 - 기존 유지]
 * 녹음 종료 시점이 이미 발화의 끝 → 디바운스 불필요 → STT 완료 즉시 FastAPI 호출
 *
 * [FastAPI 응답 형식]
 * { reply, risk: { detected, risk_level, matched_category }, joy_score, sad_score, ... }
 * - risk.detected: true → 위기 감지 (reply에 안전 응답 포함)
 * - risk.detected: false → 일반 응답 (reply에 LLM 응답 포함)
 * - 감정점수는 위기/일반 모두 개별 필드로 반환
 *
 * [위기 감지 처리]
 * Node 1차 키워드 감지 → FastAPI LLM 최종 판단 (risk.detected)
 * 세션 내 누적 1~2회 → feedback / 3회 → hotline(1577-0199) + 세션 종료
 */

const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const pool = require('../config/db');
const sessionRepo = require('../repositories/sessionRepository');
const riskEventRepo = require('../repositories/riskEventRepository');
const userRepo = require('../repositories/userRepository');
const emotionAlertRepo = require('../repositories/emotionAlertRepository');
const summaryRepo = require('../repositories/summaryRepository');
const onboardingRepo = require('../repositories/onboardingRepository');
const RISK_KEYWORDS = require('../assets/riskKeywords');

// 음성 파일을 메모리에 올려두고 FastAPI STT로 전달하기 위해 메모리 스토리지 사용
const upload = multer({ storage: multer.memoryStorage() });


/*
 * buildEmotionAnalysis - 직전 발화의 감정분석을 FastAPI current_emotion_analysis 형식으로 변환
 * - chat_analyses 최근 1건(가장 최근 user 발화의 점수)을 LLM 프롬프트 참고용으로 전달
 * - messages는 turn_idx ASC 정렬 → 뒤에서부터 점수가 있는 user 발화를 찾음
 * - 분석 이력이 없으면(첫 발화 등) null 반환 (명세상 허용)
 * - 점수 컬럼은 DECIMAL(4,1)이라 mysql2가 문자열로 반환 → Number로 변환 후 전송
 */
function buildEmotionAnalysis(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user' && m.joy_score !== null);
  if (!last) return null;

  const emotion_scores = {
    기쁨: Number(last.joy_score),
    슬픔: Number(last.sad_score),
    불안: Number(last.anxiety_score),
    분노: Number(last.anger_score),
    상처: Number(last.hurt_score),
    당황: Number(last.embarrass_score),
  };
  const dominant_emotion = Object.keys(emotion_scores).reduce((a, b) =>
    emotion_scores[a] >= emotion_scores[b] ? a : b
  );
  return { dominant_emotion, emotion_scores };
}


// 위기 이벤트 저장 + 3회 시 세션 종료 — 응답은 호출부에서 처리
async function saveRiskEvent({ user_id, session_id, matched_category }) {
  const prevCount = await riskEventRepo.countBySessionId(session_id, user_id);
  const totalCount = prevCount + 1;
  const action = totalCount === 3 ? 'hotline' : 'feedback';
  await riskEventRepo.createRiskEvent({ user_id, session_id, matched_category, action_taken: action });
  if (action === 'hotline' && session_id) await sessionRepo.endSession(session_id);
  return action;
}

/*
 * handleRisk - 고위험 신호 감지 시 공통 처리 (저장 + 응답)
 * - 1~2회: 세션 유지, feedback 응답
 * - 3회: 세션 종료, hotline 응답
 * - response_text: LLM이 생성한 응답 텍스트 (없으면 null)
 */
async function handleRisk({ user_id, session_id, matched_category, response_text, res }) {
  const action = await saveRiskEvent({ user_id, session_id, matched_category });

  if (action === 'hotline') {
    return res.json({
      is_risk: true,
      action: 'hotline',
      reply: response_text,
      hotline: { name: '정신건강 위기상담 전화', phone: '1577-0199' },
    });
  }
  return res.json({ is_risk: true, action: 'feedback', reply: response_text });
}

/*
 * chatRespond - 텍스트 입력 처리 (POST /api/chat/respond)
 *
 * 왜 이 방식을 쓰나 (B안):
 * 사용자가 끊어서 여러 메시지를 보낼 경우, 메시지마다 즉시 FastAPI를 호출하면
 * 중간에 AI가 답변해 대화가 부자연스러워지고 API 호출 비용도 증가함
 * → 프론트에서 타이핑이 멈추면 그동안 입력한 내용을 합쳐서 한 번에 전송
 * → Node는 FastAPI를 한 번만 호출하고, 응답 받은 후 DB에 저장
 *
 * DB 저장을 FastAPI 호출 후로 미루는 이유:
 * chat_analyses(감정점수)가 chat_logs(log_id)를 FK로 참조하는 구조
 * 먼저 저장하면 메시지 여러 개에 log_id가 각각 생기는데 감정점수는 1세트만 와서
 * 어떤 log_id에 연결해야 할지 불명확해짐
 * FastAPI 응답 후 저장하면 log_id 1개 : 감정점수 1세트로 깔끔하게 1:1 매핑 가능
 *
 * 처리 순서:
 * 1. 이전 대화 내역 DB에서 조회 (LLM 문맥 파악용)
 * 2. FastAPI 호출 (utterance + 이전 대화 전달)
 *    - utterance → 감정 분석 모델 (사용자 발화만)
 *    - messages → LLM (user/assistant 전체 + 감정 분석 결과)
 * 3. 위기 감지 여부 확인
 * 4. DB 저장: 사용자 발화 → chat_logs / AI 답변 → chat_logs
 *    (감정점수는 감정 분석 모델 연동 후 저장)
 */
async function chatRespond(req, res) {
  const { utterance, session_id } = req.body;

  if (!utterance) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'utterance를 입력해주세요.' });
  }
  if (!session_id) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'session_id를 입력해주세요.' });
  }

  // FastAPI에 전달할 데이터 병렬 조회
  // - messages   : 이전 대화 내역 (history 구성용)
  // - user        : 페르소나 조회
  // - session     : 선택 감정 조회
  // - alerts      : 미확인 감정 주의 신호 (alert_context)
  // - summaries   : 최근 대화 요약 1-2개 (recent_summaries)
  const [messages, user, session, alerts, summaries, onboarding] = await Promise.all([
    sessionRepo.findMessagesBySession(session_id),
    userRepo.findById(req.user.user_id),
    sessionRepo.findSessionById(session_id),
    emotionAlertRepo.findUnconfirmedByUserId(req.user.user_id),
    summaryRepo.findRecentByUserId(req.user.user_id, 2),
    onboardingRepo.findAllByUser(req.user.user_id),  // q3(신경 쓰이는 영역) 조회용
  ]);

  // 세션 존재 여부 + 소유자 검증 (IDOR 방어)
  if (!session || session.user_id !== req.user.user_id) {
    return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }

  // 1차 키워드 감지 (Node) → has_risk_keyword로 FastAPI에 전달 → risk_gate가 2차 LLM 문맥 판단
  // true면 FastAPI가 자체 스캔 생략하고 바로 LLM 판단 / false여도 FastAPI가 자체 목록으로 폴백 스캔
  // 공백 제거 후 매칭 — "죽고 싶어" → "죽고싶어" 로 정규화해서 띄어쓰기 변형 대응
  const normalized = utterance.replace(/\s/g, '');
  const hasRiskKeyword = RISK_KEYWORDS.some(keyword => normalized.includes(keyword));

  let fastapiRes;
  try {
    fastapiRes = await axios.post(
      `${process.env.FASTAPI_URL}/internal/chat`,
      {
        session_id,
        user_id:              req.user.user_id,
        utterance,
        has_risk_keyword:     hasRiskKeyword,
        // persona는 FastAPI 스키마상 str(필수, null 불가) → 미설정 시 명세 기본값 '공감형' 전달
        persona:              user?.persona || '공감형',
        selected_emotion:     session?.selected_emotion || null,
        // history: role/content 형식으로 변환해서 전달
        history:              messages.map(m => ({ role: m.role, content: m.content })),
        // current_emotion_analysis: 직전 발화의 감정분석(chat_analyses 최근 1건) — LLM 프롬프트 참고용
        current_emotion_analysis: buildEmotionAnalysis(messages),
        alert_context:        alerts.slice(0, 2).map(a => ({
          alert_detected: true,
          alert_emotion:  a.alerted_emotion,
          alert_reason:   a.alert_reason,
          alert_message:  `최근 며칠 동안 ${a.alerted_emotion} 감정이 자주 나타나고 있어요.`,
        })),
        // FastAPI는 recent_summaries를 문자열 배열로 받음 → context_summary만 추출
        recent_summaries:     summaries.map(s => s.context_summary),
        // q3_answer: 온보딩 3번(신경 쓰이는 영역) 답변 — LLM 대화 맥락 보강용
        q3_answer:            onboarding.find(r => r.question_no === 3)?.user_answer ?? null,
      },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    // 키워드 감지 상태에서 LLM 통신 장애 → 카운트만 올리고 오류 반환
    if (hasRiskKeyword && session_id) {
      await saveRiskEvent({ user_id: req.user.user_id, session_id, matched_category: '통신오류' });
    }
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { reply, risk, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;

  // FastAPI 응답 후 DB 저장 — 위기 여부와 관계없이 동일하게 저장
  // 사용자 발화를 먼저 저장해 log_id를 확보한 뒤, 그 log_id로 감정점수를 연결
  const [[{ turn_idx }]] = await pool.query(
    'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM chat_logs WHERE session_id = ?',
    [session_id]
  );

  // 사용자 발화 저장 — req.body에서 온 데이터이므로 speaker는 항상 'user'
  const [userLogResult] = await pool.query(
    'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
    [req.user.user_id, session_id, 'user', utterance, turn_idx]
  );

  // 감정점수 저장 — FastAPI가 개별 필드로 반환 (위기/일반 모두 포함)
  await pool.query(
    'INSERT INTO chat_analyses (user_id, log_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.user_id, userLogResult.insertId, joy_score ?? 0, sad_score ?? 0, anxiety_score ?? 0, anger_score ?? 0, hurt_score ?? 0, embarrass_score ?? 0]
  );

  // AI 답변 저장 — 위기/일반 모두 reply 필드 사용
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

  // FastAPI가 위기 감지 시 위기 처리 (DB 저장 후 호출)
  if (risk?.detected) {
    return handleRisk({
      user_id: req.user.user_id,
      session_id,
      matched_category: risk.matched_category || '위기감지',
      response_text: reply,
      res,
    });
  }

  return res.json({ reply, is_risk: false });
}

/*
 * chatAudio - 음성 입력 처리 (POST /api/chat/audio)
 *
 * 왜 텍스트와 다르게 즉시 FastAPI를 호출하나:
 * 음성은 녹음 종료 시점이 곧 발화의 끝을 의미함
 * 텍스트처럼 끊어서 보내는 경우가 없으므로 디바운스 불필요
 * → STT 완료 즉시 FastAPI 호출 후 DB 저장 (텍스트와 동일한 B안 저장 순서 적용)
 *
 * 처리 순서:
 * 1. 음성 파일 → FastAPI STT → 텍스트 변환
 * 2. 변환된 텍스트로 FastAPI 챗봇 호출
 * 3. DB 저장 (chatRespond와 동일한 순서)
 */
async function chatAudio(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '음성 파일을 첨부해주세요.' });
  }

  const { session_id } = req.body;

  // multer가 메모리에 올려둔 음성 파일을 FormData로 감싸서 FastAPI STT 엔드포인트로 전송
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

  // STT 결과가 비어있으면 음성 인식 실패로 처리
  const utterance = sttRes.data.text;
  if (!utterance) {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '음성을 텍스트로 변환하지 못했습니다.' });
  }

  // 회원 + 세션이 있을 때만 FastAPI 페이로드용 데이터 조회
  let messages = [], user = null, session = null, alerts = [], summaries = [], onboarding = [];
  if (req.user && session_id) {
    [messages, user, session, alerts, summaries, onboarding] = await Promise.all([
      sessionRepo.findMessagesBySession(session_id),
      userRepo.findById(req.user.user_id),
      sessionRepo.findSessionById(session_id),
      emotionAlertRepo.findUnconfirmedByUserId(req.user.user_id),
      summaryRepo.findRecentByUserId(req.user.user_id, 2),
      onboardingRepo.findAllByUser(req.user.user_id),  // q3(신경 쓰이는 영역) 조회용
    ]);

    // 세션 존재 여부 + 소유자 검증 (IDOR 방어)
    if (!session || session.user_id !== req.user.user_id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }
  }

  const normalized = utterance.replace(/\s/g, '');
  const hasRiskKeyword = RISK_KEYWORDS.some(keyword => normalized.includes(keyword));

  let fastapiRes;
  try {
    fastapiRes = await axios.post(
      `${process.env.FASTAPI_URL}/internal/chat`,
      {
        session_id:           session_id || null,
        user_id:              req.user?.user_id || null,
        utterance,
        has_risk_keyword:     hasRiskKeyword,
        // persona는 FastAPI 스키마상 str(필수, null 불가) → 미설정 시 명세 기본값 '공감형' 전달
        persona:              user?.persona || '공감형',
        selected_emotion:     session?.selected_emotion || null,
        history:              messages.map(m => ({ role: m.role, content: m.content })),
        current_emotion_analysis: buildEmotionAnalysis(messages),
        alert_context:        alerts.slice(0, 2).map(a => ({
          alert_detected: true,
          alert_emotion:  a.alerted_emotion,
          alert_reason:   a.alert_reason,
          alert_message:  `최근 며칠 동안 ${a.alerted_emotion} 감정이 자주 나타나고 있어요.`,
        })),
        // FastAPI는 recent_summaries를 문자열 배열로 받음 → context_summary만 추출
        recent_summaries:     summaries.map(s => s.context_summary),
        // q3_answer: 온보딩 3번(신경 쓰이는 영역) 답변 — 비회원은 온보딩 미저장이라 null
        q3_answer:            onboarding.find(r => r.question_no === 3)?.user_answer ?? null,
      },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    // 키워드 감지 상태에서 LLM 통신 장애 → 카운트만 올리고 오류 반환
    if (hasRiskKeyword && req.user && session_id) {
      await saveRiskEvent({ user_id: req.user.user_id, session_id, matched_category: '통신오류' });
    }
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { reply, risk, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;

  // 회원 + 세션이 있을 때만 DB 저장 — 위기 여부와 관계없이 동일하게 저장
  if (req.user && session_id) {
    const [[{ turn_idx }]] = await pool.query(
      'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM chat_logs WHERE session_id = ?',
      [session_id]
    );

    // STT로 변환된 텍스트 저장 — 음성 파일 자체는 저장하지 않음
    const [userLogResult] = await pool.query(
      'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, session_id, 'user', utterance, turn_idx]
    );

    // 감정점수 저장 — FastAPI가 개별 필드로 반환 (위기/일반 모두 포함)
    await pool.query(
      'INSERT INTO chat_analyses (user_id, log_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, userLogResult.insertId, joy_score ?? 0, sad_score ?? 0, anxiety_score ?? 0, anger_score ?? 0, hurt_score ?? 0, embarrass_score ?? 0]
    );

    // AI 답변 저장 — 위기/일반 모두 reply 필드 사용
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
  }

  // FastAPI가 위기 감지 시 위기 처리 (DB 저장 후 호출)
  if (req.user && session_id && risk?.detected) {
    return handleRisk({
      user_id: req.user.user_id,
      session_id,
      matched_category: risk.matched_category || '위기감지',
      response_text: reply,
      res,
    });
  }

  return res.json({ reply, utterance, is_risk: false });
}

module.exports = { chatRespond, chatAudio, upload };
