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
 * { reply, risk_level, matched_category, judge_factors, safety_mode_triggered,
 *   should_block_chat, show_hotline, joy_score, sad_score, ... }
 * - risk_level: none|watch|risk|critical|safety_mode_active
 * - risk/critical → risk_events 저장 / should_block_chat=true → 세션 종료(안전모드 전환)
 * - 감정점수는 모든 경우 개별 필드로 반환
 *
 * [위기 감지 처리]
 * Node 1차 키워드 감지 → FastAPI 2차 LLM 판단(risk_level) + 서비스 상태 계산
 * Node는 호출 전 prior_risk_count/is_in_safety_mode를 전달하고, 응답의 risk_level이
 * risk/critical이면 risk_events에 저장, should_block_chat이면 세션을 종료한다.
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


/*
 * getQ3Answer - 온보딩 q3(신경 쓰이는 영역) 답변 "텍스트" 추출
 * - user_answer는 TINYINT(선택 번호)라 그대로 보내면 FastAPI(str 기대)가 422
 * - 번호(user_answer)로 보기 컬럼(exp_1~exp_5)을 찾아 실제 텍스트를 반환
 * - 온보딩 없으면(비회원 등) null
 */
function getQ3Answer(onboarding) {
  const q3 = onboarding.find(r => r.question_no === 3);
  return q3 ? (q3[`exp_${q3.user_answer}`] ?? null) : null;
}


/*
 * saveRiskEventIfNeeded - FastAPI 응답의 risk_level이 risk/critical이면 risk_events에 저장
 * - judge_factors: FastAPI가 risk/critical일 때만 객체로 반환 → JSON 문자열로 변환해 저장
 * - safety_mode_triggered: 이 이벤트가 안전모드를 처음 발동시켰는지 → 'Y'/'N'
 */
async function saveRiskEventIfNeeded({ user_id, session_id, risk_level, matched_category, judge_factors, safety_mode_triggered }) {
  if (risk_level !== 'risk' && risk_level !== 'critical') return;
  await riskEventRepo.createRiskEvent({
    user_id,
    session_id,
    risk_level,
    // matched_category가 NOT NULL이라 None 방어 — risk_gate 체계의 'unknown'으로 폴백
    // (정상 흐름에선 risk/critical 시 FastAPI가 suicide/self_harm/violence 등을 반환)
    matched_category: matched_category || 'unknown',
    judge_factors: judge_factors ? JSON.stringify(judge_factors) : null,
    safety_mode_triggered: safety_mode_triggered ? 'Y' : 'N',
  });
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

  // session_id가 있는데 req.user가 없으면 = 회원 대화 중 액세스 토큰이 만료된 것.
  // optionalLogin은 만료 토큰을 조용히 비회원으로 통과시켜 발화가 저장되지 않으므로,
  // 401을 반환해 프론트(client.js)의 자동 토큰 갱신 → 재요청을 유도한다. (게스트는 session_id가 없어 영향 없음)
  if (session_id && !req.user) {
    return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '인증이 만료되었습니다. 다시 시도해주세요.' });
  }

  // 회원 + 세션이 있을 때만 FastAPI 페이로드용 데이터 조회 (비회원은 DB 없이 LLM 응답만)
  // - messages   : 이전 대화 내역 (history 구성용)
  // - user        : 페르소나 조회
  // - session     : 선택 감정 조회
  // - alerts      : 미확인 감정 주의 신호 (alert_context)
  // - summaries   : 최근 대화 요약 1-2개 (recent_summaries)
  let messages = [], user = null, session = null, alerts = [], summaries = [], onboarding = [];
  let prior_risk_count = 0, is_in_safety_mode = false;  // 비회원/세션 없음 시 기본값
  if (req.user && session_id) {
    [messages, user, session, alerts, summaries, onboarding, prior_risk_count, is_in_safety_mode] = await Promise.all([
      sessionRepo.findMessagesBySession(session_id),
      userRepo.findById(req.user.user_id),
      sessionRepo.findSessionById(session_id),
      emotionAlertRepo.findUnconfirmedByUserId(req.user.user_id),
      summaryRepo.findRecentByUserId(req.user.user_id, 2),
      onboardingRepo.findAllByUser(req.user.user_id),  // q3(신경 쓰이는 영역) 조회용
      riskEventRepo.countRiskInSession(session_id),     // FastAPI prior_risk_count
      riskEventRepo.hasSafetyModeTriggered(session_id), // FastAPI is_in_safety_mode
    ]);

    // 세션 존재 여부 + 소유자 검증 (IDOR 방어)
    if (!session || session.user_id !== req.user.user_id) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
    }
  }

  // 1차 키워드 감지 (Node) → has_risk_keyword로 FastAPI에 전달 → risk_gate가 GPT로 2차 문맥 판단
  // true면 FastAPI가 moderation 호출 생략(이미 감지) / false면 omni-moderation으로 의미 기반 재탐지
  // 공백 제거 후 매칭 — "죽고 싶어" → "죽고싶어" 로 정규화해서 띄어쓰기 변형 대응
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
        // persona는 FastAPI 스키마상 str(필수, null 불가)
        // 회원: DB users.persona / 비회원: req.body.persona(프론트 게스트 온보딩값) / 둘 다 없으면 명세 기본값 '공감형'
        persona:              user?.persona || req.body.persona || '공감형',
        selected_emotion:     session?.selected_emotion || null,
        // history: 회원은 DB 발화내역(role/content 변환), 비회원은 프론트가 보낸 브라우저 보관분으로 대화 맥락 유지
        // (비회원은 DB 세션이 없어 messages가 비므로 req.body.history를 그대로 전달 — 형식은 [{role, content}])
        history:              (req.user && session_id)
                                ? messages.map(m => ({ role: m.role, content: m.content }))
                                : (Array.isArray(req.body.history) ? req.body.history : []),
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
        q3_answer:            getQ3Answer(onboarding),
        // 위험 감지 서비스 상태 — risk_events 조회 결과 (FastAPI가 안전모드 누적 판정에 사용)
        prior_risk_count,
        is_in_safety_mode,
      },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { reply, risk_level, matched_category, judge_factors, safety_mode_triggered, should_block_chat, show_hotline,
          joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;

  // 회원 + 세션이 있을 때만 DB 저장 — 위기 여부와 관계없이 동일하게 저장 (비회원은 저장 안 함)
  if (req.user && session_id) {
    // 발화 + 감정점수 + AI답변을 하나의 트랜잭션으로 저장 (NFR-DE-005 원자성)
    // → 중간에 실패하면 전체 롤백해 "발화만 있고 점수는 없는" 반쪽 데이터를 방지
    // FastAPI 호출은 위에서 이미 끝났으므로 트랜잭션 안에 네트워크 대기가 없음(커넥션 점유 최소화)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 사용자 발화를 먼저 저장해 log_id를 확보한 뒤, 그 log_id로 감정점수를 연결
      const [[{ turn_idx }]] = await conn.query(
        'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM chat_logs WHERE session_id = ?',
        [session_id]
      );

      // 사용자 발화 저장 — req.body에서 온 데이터이므로 speaker는 항상 'user'
      const [userLogResult] = await conn.query(
        'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
        [req.user.user_id, session_id, 'user', utterance, turn_idx]
      );

      // 감정점수 저장 — FastAPI가 개별 필드로 반환 (위기/일반 모두 포함)
      await conn.query(
        'INSERT INTO chat_analyses (user_id, log_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.user_id, userLogResult.insertId, joy_score ?? 0, sad_score ?? 0, anxiety_score ?? 0, anger_score ?? 0, hurt_score ?? 0, embarrass_score ?? 0]
      );

      // AI 답변 저장 — 위기/일반 모두 reply 필드 사용
      if (reply) {
        const [[{ ai_turn_idx }]] = await conn.query(
          'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS ai_turn_idx FROM chat_logs WHERE session_id = ?',
          [session_id]
        );
        await conn.query(
          'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
          [req.user.user_id, session_id, 'assistant', reply, ai_turn_idx]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // risk_events 저장 / 세션 종료는 위 트랜잭션과 분리 (NFR-DE-005: 위기 이력은 별도 단위)
    // → 발화 저장이 롤백돼도 위기 기록까지 함께 사라지지 않도록 트랜잭션 밖에 둔다
    await saveRiskEventIfNeeded({
      user_id: req.user.user_id,
      session_id, risk_level, matched_category, judge_factors, safety_mode_triggered,
    });
    if (should_block_chat) {
      await sessionRepo.endSession(session_id);
    }
  }

  return res.json({ reply, risk_level, should_block_chat, show_hotline });
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

  // session_id가 있는데 req.user가 없으면 = 회원 대화 중 액세스 토큰이 만료된 것.
  // 401을 반환해 프론트의 자동 토큰 갱신 → 재요청을 유도한다. (chatRespond와 동일, STT 호출 전에 차단)
  if (session_id && !req.user) {
    return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '인증이 만료되었습니다. 다시 시도해주세요.' });
  }

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
  let prior_risk_count = 0, is_in_safety_mode = false;  // 비회원/세션 없음 시 기본값
  if (req.user && session_id) {
    [messages, user, session, alerts, summaries, onboarding, prior_risk_count, is_in_safety_mode] = await Promise.all([
      sessionRepo.findMessagesBySession(session_id),
      userRepo.findById(req.user.user_id),
      sessionRepo.findSessionById(session_id),
      emotionAlertRepo.findUnconfirmedByUserId(req.user.user_id),
      summaryRepo.findRecentByUserId(req.user.user_id, 2),
      onboardingRepo.findAllByUser(req.user.user_id),  // q3(신경 쓰이는 영역) 조회용
      riskEventRepo.countRiskInSession(session_id),     // FastAPI prior_risk_count
      riskEventRepo.hasSafetyModeTriggered(session_id), // FastAPI is_in_safety_mode
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
        // persona는 FastAPI 스키마상 str(필수, null 불가)
        // 회원: DB users.persona / 비회원: req.body.persona(프론트 게스트 온보딩값) / 둘 다 없으면 명세 기본값 '공감형'
        persona:              user?.persona || req.body.persona || '공감형',
        selected_emotion:     session?.selected_emotion || null,
        // history: 회원은 DB 발화내역, 비회원은 프론트가 보낸 브라우저 보관분으로 대화 맥락 유지 (형식 [{role, content}])
        history:              (req.user && session_id)
                                ? messages.map(m => ({ role: m.role, content: m.content }))
                                : (Array.isArray(req.body.history) ? req.body.history : []),
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
        q3_answer:            getQ3Answer(onboarding),
        // 위험 감지 서비스 상태 — risk_events 조회 결과 (비회원/세션 없음은 0/false)
        prior_risk_count,
        is_in_safety_mode,
      },
      { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'AI 응답에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  const { reply, risk_level, matched_category, judge_factors, safety_mode_triggered, should_block_chat, show_hotline,
          joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score } = fastapiRes.data;

  // 회원 + 세션이 있을 때만 DB 저장 — 위기 여부와 관계없이 동일하게 저장
  // 발화 + 감정점수 + AI답변을 하나의 트랜잭션으로 (NFR-DE-005 원자성, chatRespond와 동일)
  if (req.user && session_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[{ turn_idx }]] = await conn.query(
        'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS turn_idx FROM chat_logs WHERE session_id = ?',
        [session_id]
      );

      // STT로 변환된 텍스트 저장 — 음성 파일 자체는 저장하지 않음
      const [userLogResult] = await conn.query(
        'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
        [req.user.user_id, session_id, 'user', utterance, turn_idx]
      );

      // 감정점수 저장 — FastAPI가 개별 필드로 반환 (위기/일반 모두 포함)
      await conn.query(
        'INSERT INTO chat_analyses (user_id, log_id, joy_score, sad_score, anxiety_score, anger_score, hurt_score, embarrass_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.user_id, userLogResult.insertId, joy_score ?? 0, sad_score ?? 0, anxiety_score ?? 0, anger_score ?? 0, hurt_score ?? 0, embarrass_score ?? 0]
      );

      // AI 답변 저장 — 위기/일반 모두 reply 필드 사용
      if (reply) {
        const [[{ ai_turn_idx }]] = await conn.query(
          'SELECT COALESCE(MAX(turn_idx), 0) + 1 AS ai_turn_idx FROM chat_logs WHERE session_id = ?',
          [session_id]
        );
        await conn.query(
          'INSERT INTO chat_logs (user_id, session_id, speaker, utterance, turn_idx) VALUES (?, ?, ?, ?, ?)',
          [req.user.user_id, session_id, 'assistant', reply, ai_turn_idx]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // 회원 + 세션 있을 때만 위기 저장/세션 종료 (비회원은 risk_events 저장 대상 아님)
  if (req.user && session_id) {
    await saveRiskEventIfNeeded({
      user_id: req.user.user_id,
      session_id, risk_level, matched_category, judge_factors, safety_mode_triggered,
    });
    if (should_block_chat) {
      await sessionRepo.endSession(session_id);
    }
  }

  return res.json({ reply, utterance, risk_level, should_block_chat, show_hotline });
}

/*
 * chatStt - 음성 → 텍스트 변환만 수행 (POST /api/chat/audio/stt)
 *
 * 음성 입력 응답 지연 개선: 기존 chatAudio는 STT + 챗봇을 한 요청에서 직렬로 처리(FastAPI 2회 호출)해
 * 느렸음. 프론트가 ① 이 엔드포인트로 텍스트를 먼저 받아 화면에 표시하고, ② 그 텍스트를
 * /chat/respond로 보내 답변을 받는 2단계로 분리 → 체감 지연 감소.
 * STT만 담당하며 DB 저장은 하지 않는다.
 */
async function chatStt(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '음성 파일을 첨부해주세요.' });
  }

  const form = new FormData();
  form.append('audio', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

  try {
    const sttRes = await axios.post(
      `${process.env.FASTAPI_URL}/internal/stt`,
      form,
      { headers: { ...form.getHeaders(), 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
    );
    return res.json({ utterance: sttRes.data.text || '' });
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: 'STT 변환에 실패했습니다.' });
  }
}

module.exports = { chatRespond, chatAudio, chatStt, upload };
