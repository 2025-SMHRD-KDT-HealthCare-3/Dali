/*
 * onboardingController - 온보딩 초기 설문
 * - saveOnboarding   : POST /api/onboarding     초기 설문 저장 (upsert)
 * - getMyOnboarding  : GET  /api/onboarding/me  내 온보딩 답변 조회
 *   Q1(+2), Q2(+1), Q4(+3) 가중치로 페르소나 계산
 *   Q3는 페르소나 계산 제외, LLM 컨텍스트용
 *   Q4 제출 시 페르소나 확정 → users.persona 업데이트
 */

const axios = require('axios');
const onboardingRepo = require('../repositories/onboardingRepository');
const userRepo = require('../repositories/userRepository');

// 각 질문 번호별 답변 번호 → 페르소나 매핑
// Q1: 에너지 수준, Q2: 고민 영역, Q4: 원하는 코칭 스타일 (가중치 가장 높음)
const Q1_MAP = { 1: '분석형', 2: '공감형', 3: '동기부여형', 4: '친구형' };
const Q2_MAP = { 1: '친구형', 2: '분석형', 3: '동기부여형', 4: '공감형' };
const Q4_MAP = { 1: '친구형', 2: '분석형', 3: '동기부여형', 4: '공감형' };

// 페르소나 점수 계산 — Q1(+2), Q2(+1), Q4(+3) 가중치 합산 후 최고 점수 페르소나 반환
function calculatePersona(q1Answer, q2Answer, q4Answer) {
  const scores = { '공감형': 0, '친구형': 0, '분석형': 0, '동기부여형': 0 };

  if (Q1_MAP[q1Answer]) scores[Q1_MAP[q1Answer]] += 2;
  if (Q2_MAP[q2Answer]) scores[Q2_MAP[q2Answer]] += 1;
  if (Q4_MAP[q4Answer]) scores[Q4_MAP[q4Answer]] += 3;

  const maxScore = Math.max(...Object.values(scores));
  const topPersonas = Object.keys(scores).filter(p => scores[p] === maxScore);

  // 동점일 경우 가중치가 가장 높은 Q4 답변 페르소나 우선
  if (topPersonas.length > 1) {
    const q4Persona = Q4_MAP[q4Answer];
    if (topPersonas.includes(q4Persona)) return q4Persona;
  }

  return topPersonas[0];
}

async function saveOnboarding(req, res) {
  const { question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer } = req.body;

  if (!question_no || !question || !exp_1 || !exp_2 || !exp_3 || !exp_4 || user_answer == null) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '필수 항목이 누락되었습니다.' });
  }

  // 비회원은 DB 저장 없이 Q4에서만 페르소나 추천 반환
  if (!req.user) {
    if (question_no === 4) {
      const { q1_answer, q2_answer } = req.body;
      if (q1_answer && q2_answer) {
        const recommended_persona = calculatePersona(q1_answer, q2_answer, user_answer);
        return res.status(201).json({ onboarding_id: null, recommended_persona });
      }
    }
    return res.status(201).json({ onboarding_id: null, recommended_persona: null });
  }

  // 회원 — 답변을 onboarding 테이블에 저장 (재답변 시 UPDATE)
  const onboardingId = await onboardingRepo.upsertOnboarding({
    user_id: req.user.user_id,
    question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer,
  });

  // Q3 제출 시 FastAPI에 고민 영역 전달 — LLM이 대화 컨텍스트로 활용
  if (question_no === 3) {
    try {
      await axios.post(
        `${process.env.FASTAPI_URL}/onboarding/context`,
        { user_id: req.user?.user_id || null, q3_answer: user_answer },
        { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
      );
    } catch {
      return res.status(502).json({ code: 'BAD_GATEWAY', message: '컨텍스트 전달에 실패했습니다. 다시 시도해주세요.' });
    }
  }

  // Q4 제출 시 — 이전 Q1, Q2 답변을 DB에서 불러와 페르소나 계산
  // 계산 결과는 추천만 해주고, 실제 저장은 사용자가 선택 후 /users/me/persona로 따로 처리
  if (question_no === 4) {
    const answers = await onboardingRepo.findAnswersByUser(req.user.user_id);
    const getAnswer = (no) => answers.find(a => a.question_no === no)?.user_answer;

    const q1 = getAnswer(1);
    const q2 = getAnswer(2);

    if (q1 && q2) {
      const recommended_persona = calculatePersona(q1, q2, user_answer);
      return res.status(201).json({ onboarding_id: onboardingId, recommended_persona });
    }
  }

  res.status(201).json({ onboarding_id: onboardingId, recommended_persona: null });
}

// 내 온보딩 답변 조회 — 설정 페이지에서 기존 답변 불러올 때 사용
async function getMyOnboarding(req, res) {
  const answers = await onboardingRepo.findAllByUser(req.user.user_id);
  res.json({ onboarding: answers });
}

module.exports = { saveOnboarding, getMyOnboarding };
