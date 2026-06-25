/*
 * onboardingController - 온보딩 초기 설문
 * - saveOnboarding   : POST /api/onboarding     전체 답변 한꺼번에 저장 + 페르소나 추천 반환
 *
 * question_no 매핑: 1=마음상태, 2=에너지, 3=신경쓰이는영역(LLM 컨텍스트), 4=코칭스타일
 * 페르소나 계산: q1(+2), q2(+1), q4(+3) 가중치 합산 / 동점 시 q4 우선
 */

const onboardingRepo = require('../repositories/onboardingRepository');

// 질문 텍스트 + 보기 — 설정 페이지에서 이전 온보딩 답변 재표시용
const QUESTION_META = {
  1: {
    question: '요즘 당신의 마음은 어떤가요?',
    exp_1: '생각이 많고 복잡해요',
    exp_2: '마음이 조금 지쳐있어요',
    exp_3: '아무것도 하기 싫어요',
    exp_4: '편하게 이야기하고 싶어요',
    exp_5: null,
  },
  2: {
    question: '요즘 하루 에너지 수준은 어떤가요?',
    exp_1: '일상적인 일을 해낼 만큼 활력이 있어요',
    exp_2: '생각이 많고 복잡해서 정신적인 에너지가 부족해요',
    exp_3: '꼭 해야 할 일만 겨우 하거나 자꾸 미루게 돼요',
    exp_4: '하루를 버티는 것도 힘들어요',
    exp_5: null,
  },
  3: {
    question: '최근 가장 신경 쓰이는 영역은 무엇인가요?',
    exp_1: '학업 및 진로 방향',
    exp_2: '직장 업무와 성과',
    exp_3: '가족, 친구, 연인 등 대인관계',
    exp_4: '나 자신에 대한 성격이나 자존감',
    exp_5: '특별한 고민은 없어요',
  },
  4: {
    question: '달리와 어떤 시간을 보내고 싶나요?',
    exp_1: '친구처럼 편하게 이야기하고 싶어요',
    exp_2: '복잡한 마음을 정리하고 싶어요',
    exp_3: '작은 것부터 다시 시작하고 싶어요',
    exp_4: '따뜻한 위로를 받고 싶어요',
    exp_5: null,
  },
};

// q1(+2), q2(+1), q4(+3) 가중치로 페르소나 계산
const PERSONA_MAP = {
  q1: { 1: '분석형', 2: '공감형', 3: '동기부여형', 4: '친구형' },
  q2: { 1: '분석형', 2: '공감형', 3: '동기부여형', 4: '친구형' },
  q4: { 1: '친구형', 2: '분석형', 3: '동기부여형', 4: '공감형' },
};

function calculatePersona(q1, q2, q4) {
  const scores = { '공감형': 0, '친구형': 0, '분석형': 0, '동기부여형': 0 };

  if (PERSONA_MAP.q1[q1]) scores[PERSONA_MAP.q1[q1]] += 2;
  if (PERSONA_MAP.q2[q2]) scores[PERSONA_MAP.q2[q2]] += 1;
  if (PERSONA_MAP.q4[q4]) scores[PERSONA_MAP.q4[q4]] += 3;

  const maxScore = Math.max(...Object.values(scores));
  const topPersonas = Object.keys(scores).filter(p => scores[p] === maxScore);

  if (topPersonas.length > 1) {
    const preferred = PERSONA_MAP.q4[q4];
    if (preferred && topPersonas.includes(preferred)) return preferred;
  }

  return topPersonas[0];
}

async function saveOnboarding(req, res) {
  const { q1, q2, q3, q4 } = req.body;

  if (!q1 || !q2 || !q3 || !q4) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '모든 온보딩 항목을 입력해주세요.' });
  }

  // 비회원은 DB 저장 없이 페르소나 추천만 반환
  if (!req.user) {
    const recommended_persona = calculatePersona(q1, q2, q4);
    return res.status(201).json({ recommended_persona });
  }

  const rows = [
    { question_no: 1, user_answer: q1, ...QUESTION_META[1] },
    { question_no: 2, user_answer: q2, ...QUESTION_META[2] },
    { question_no: 3, user_answer: q3, ...QUESTION_META[3] },
    { question_no: 4, user_answer: q4, ...QUESTION_META[4] },
  ];

  await Promise.all(
    rows.map(r => onboardingRepo.upsertOnboarding({ user_id: req.user.user_id, ...r }))
  );

  // q3(신경쓰이는 영역)는 별도 호출 없이, 채팅 시 chatController가 DB에서 읽어 FastAPI에 전달함
  const recommended_persona = calculatePersona(q1, q2, q4);
  res.status(201).json({ recommended_persona });
}

module.exports = { saveOnboarding };
