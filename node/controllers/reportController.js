/*
 * reportController - 감정 리포트
 * - getDailyReports   : GET /api/reports/daily?date=YYYY-MM-DD    일간 감정 리포트 조회
 * - getMonthlyReports : GET /api/reports/monthly?month=YYYY-MM    월간 감정 리포트 조회
 */

const reportRepo = require('../repositories/reportRepository');

async function getDailyReports(req, res) {
  const { date } = req.query;
  const reports = await reportRepo.findDailyReports(req.user.user_id, date || null);
  const result = reports.map(r => ({
    ...r,
    is_same: r.selected_emotion === r.dominant_emotion,
  }));
  res.json({ reports: result });
}

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
