/*
 * onboardingController - 온보딩 초기 설문
 * - saveOnboarding : POST /api/onboarding  초기 설문 저장
 *   Q1(+2), Q2(+1), Q4(+3) 가중치로 페르소나 계산
 *   Q3는 페르소나 계산 제외, LLM 컨텍스트용
 *   Q4 제출 시 페르소나 확정 → users.persona 업데이트
 */

const axios = require('axios');
const onboardingRepo = require('../repositories/onboardingRepository');
const userRepo = require('../repositories/userRepository');

const Q1_MAP = { 1: '분석형', 2: '공감형', 3: '동기부여형', 4: '친구형' };
const Q2_MAP = { 1: '친구형', 2: '분석형', 3: '동기부여형', 4: '공감형' };
const Q4_MAP = { 1: '친구형', 2: '분석형', 3: '동기부여형', 4: '공감형' };

function calculatePersona(q1Answer, q2Answer, q4Answer) {
  const scores = { '공감형': 0, '친구형': 0, '분석형': 0, '동기부여형': 0 };

  if (Q1_MAP[q1Answer]) scores[Q1_MAP[q1Answer]] += 2;
  if (Q2_MAP[q2Answer]) scores[Q2_MAP[q2Answer]] += 1;
  if (Q4_MAP[q4Answer]) scores[Q4_MAP[q4Answer]] += 3;

  const maxScore = Math.max(...Object.values(scores));
  const topPersonas = Object.keys(scores).filter(p => scores[p] === maxScore);

  // 동점 시 Q4(가중치 최고) 기준으로 결정
  if (topPersonas.length > 1) {
    const q4Persona = Q4_MAP[q4Answer];
    if (topPersonas.includes(q4Persona)) return q4Persona;
  }

  return topPersonas[0];
}

async function saveOnboarding(req, res) {
  const { question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer } = req.body;

  if (!question_no || !question || !exp_1 || !exp_2 || !exp_3 || !exp_4 || user_answer == null) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  // 비회원은 DB 저장 없이 Q4면 페르소나 추천만 반환
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

  const onboardingId = await onboardingRepo.createOnboarding({
    user_id: req.user.user_id,
    question_no, question, exp_1, exp_2, exp_3, exp_4, exp_5, user_answer,
  });

  // Q3 제출 시 FastAPI로 고민 영역 전달 (회원/비회원 모두)
  if (question_no === 3) {
    try {
      await axios.post(
        `${process.env.FASTAPI_URL}/onboarding/context`,
        { user_id: req.user?.user_id || null, q3_answer: user_answer },
        { headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } }
      );
    } catch {
      return res.status(502).json({ message: '컨텍스트 전달에 실패했습니다. 다시 시도해주세요.' });
    }
  }

  // Q4 제출 시 페르소나 추천 계산 (DB 저장은 사용자 선택 후 별도 처리)
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

module.exports = { saveOnboarding };
