/*
 * reportController - 감정 리포트
 * - getDailyReports   : GET /api/reports/daily?date=YYYY-MM-DD    일간 감정 리포트 조회
 * - getMonthlyReports : GET /api/reports/monthly?month=YYYY-MM    월간 집계 리포트 조회
 * - getReportDates    : GET /api/reports/dates?month=YYYY-MM      리포트 있는 날짜 목록
 */

const reportRepo = require('../repositories/reportRepository');

// 감정 점수 6개를 점수 높은 순으로 반환 (합이 100이므로 각 점수 = 비율%)
function getEmotionRatio(r) {
  const emotions = [
    { emotion: '기쁨',  score: r.joy_score },
    { emotion: '슬픔',  score: r.sad_score },
    { emotion: '불안',  score: r.anxiety_score },
    { emotion: '분노',  score: r.anger_score },
    { emotion: '상처',  score: r.hurt_score },
    { emotion: '당황',  score: r.embarrass_score },
  ];

  return emotions.sort((a, b) => b.score - a.score);
}

// 일간 리포트 조회 — date 없으면 오늘 날짜 기준
async function getDailyReports(req, res) {
  const { date } = req.query;
  const reports = await reportRepo.findDailyReports(req.user.user_id, date || null);

  // one_line_review: 가장 최근 세션 기준 1개만 상단에 노출 (reports는 created_at DESC 정렬)
  const one_line_review = reports[0]?.one_line_review ?? null;

  // is_same: 사용자가 선택한 감정과 실제 분석된 주요 감정이 일치하는지 여부
  const result = reports.map(({ one_line_review: _, ...r }) => ({
    ...r,
    is_same: r.selected_emotion === r.dominant_emotion,
    emotion_ratio: getEmotionRatio(r),
  }));
  res.json({ one_line_review, reports: result });
}

const EMOTION_LABEL = {
  joy_score: '기쁨', sad_score: '슬픔', anxiety_score: '불안',
  anger_score: '분노', hurt_score: '상처', embarrass_score: '당황',
};
const SCORE_FIELDS = Object.keys(EMOTION_LABEL);

// 월간 리포트 조회 — month 없으면 이번 달 기준
async function getMonthlyReports(req, res) {
  const { month } = req.query;
  const rows = await reportRepo.findMonthlyRaw(req.user.user_id, month || null);

  if (!rows.length) {
    return res.json({
      summary: { total_sessions: 0, top_emotion: null, active_days: 0 },
      emotion_distribution: [],
      daily_emotions: [],
      emotion_trend: [],
      weekly_sessions: [1, 2, 3, 4].map(week => ({ week, count: 0 })),
    });
  }

  // summary
  const total_sessions = rows.length;
  const active_days = new Set(rows.map(r => String(r.date))).size;
  const emotionCount = {};
  rows.forEach(r => { emotionCount[r.dominant_emotion] = (emotionCount[r.dominant_emotion] || 0) + 1; });
  const top_emotion = Object.entries(emotionCount).sort((a, b) => b[1] - a[1])[0][0];

  // 감정 분포 — 전체 평균, 내림차순
  const totals = Object.fromEntries(SCORE_FIELDS.map(f => [f, 0]));
  rows.forEach(r => SCORE_FIELDS.forEach(f => { totals[f] += Number(r[f]); }));
  const emotion_distribution = SCORE_FIELDS
    .map(f => ({ emotion: EMOTION_LABEL[f], score: Math.round(totals[f] / total_sessions) }))
    .sort((a, b) => b.score - a.score);

  // 달력 이모지 — 날짜별 마지막 세션의 selected_emotion (ASC 정렬이므로 덮어쓰면 마지막)
  const dailyMap = {};
  rows.forEach(r => { dailyMap[String(r.date)] = r.selected_emotion; });
  const daily_emotions = Object.entries(dailyMap).map(([date, selected_emotion]) => ({ date, selected_emotion }));

  // 월간 감정 변화 — 날짜별 평균 점수
  const trendMap = {};
  rows.forEach(r => {
    const d = String(r.date);
    if (!trendMap[d]) trendMap[d] = { count: 0, joy: 0, sad: 0, anxiety: 0, anger: 0, hurt: 0, embarrass: 0 };
    trendMap[d].count++;
    trendMap[d].joy     += Number(r.joy_score);
    trendMap[d].sad     += Number(r.sad_score);
    trendMap[d].anxiety += Number(r.anxiety_score);
    trendMap[d].anger   += Number(r.anger_score);
    trendMap[d].hurt    += Number(r.hurt_score);
    trendMap[d].embarrass += Number(r.embarrass_score);
  });
  const emotion_trend = Object.entries(trendMap).map(([date, d]) => ({
    date,
    joy:      Math.round(d.joy      / d.count),
    sad:      Math.round(d.sad      / d.count),
    anxiety:  Math.round(d.anxiety  / d.count),
    anger:    Math.round(d.anger    / d.count),
    hurt:     Math.round(d.hurt     / d.count),
    embarrass: Math.round(d.embarrass / d.count),
  }));

  // 주차별 세션 수 — 1~4주 (29일 이후는 4주로 합산)
  const weekCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
  rows.forEach(r => { weekCount[Math.min(Math.ceil(r.day_of_month / 7), 4)]++; });
  const weekly_sessions = [1, 2, 3, 4].map(week => ({ week, count: weekCount[week] }));

  res.json({ summary: { total_sessions, top_emotion, active_days }, emotion_distribution, daily_emotions, emotion_trend, weekly_sessions });
}

// 리포트가 존재하는 날짜 목록 조회 — month 없으면 이번 달 기준
async function getReportDates(req, res) {
  const { month } = req.query;
  const dates = await reportRepo.findReportDates(req.user.user_id, month || null);
  res.json({ dates });
}

module.exports = { getDailyReports, getMonthlyReports, getReportDates };
