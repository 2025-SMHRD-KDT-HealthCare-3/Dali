/*
 * reportController - 감정 리포트
 * - getDailyReports   : GET /api/reports/daily?date=YYYY-MM-DD    일간 감정 리포트 조회
 * - getMonthlyReports : GET /api/reports/monthly?month=YYYY-MM    월간 감정 리포트 조회
 */

const reportRepo = require('../repositories/reportRepository');

// 일간 리포트 조회 — date 없으면 오늘 날짜 기준
async function getDailyReports(req, res) {
  const { date } = req.query;
  const reports = await reportRepo.findDailyReports(req.user.user_id, date || null);

  // is_same: 사용자가 선택한 감정과 실제 분석된 주요 감정이 일치하는지 여부
  const result = reports.map(r => ({
    ...r,
    is_same: r.selected_emotion === r.dominant_emotion,
  }));
  res.json({ reports: result });
}

// 월간 리포트 조회 — month 없으면 이번 달 기준
async function getMonthlyReports(req, res) {
  const { month } = req.query;
  const reports = await reportRepo.findMonthlyReports(req.user.user_id, month || null);

  const result = reports.map(r => ({
    ...r,
    is_same: r.selected_emotion === r.dominant_emotion,
  }));
  res.json({ reports: result });
}

module.exports = { getDailyReports, getMonthlyReports };
