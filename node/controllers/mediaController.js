/*
 * mediaController - 미디어 콘텐츠
 * - getMusicMedia : GET /api/media/music?emotion=   음악 콘텐츠 조회
 * - getVideoMedia : GET /api/media/video?emotion=X  영상 콘텐츠 조회
 */

const mediaRepo = require('../repositories/mediaRepository');

// 음악 콘텐츠 조회 — emotion 없으면 전체 조회, 있으면 해당 감정 필터
async function getMusicMedia(req, res) {
  const { emotion } = req.query;
  const media = await mediaRepo.findByType('music', emotion || null);
  res.json({ media });
}

// 영상 콘텐츠 조회 — emotion 필수
async function getVideoMedia(req, res) {
  const { emotion } = req.query;
  if (!emotion) return res.status(400).json({ code: 'INVALID_REQUEST', message: 'emotion 파라미터를 입력해주세요.' });
  const media = await mediaRepo.findByType('video', emotion);
  res.json({ media });
}

module.exports = { getMusicMedia, getVideoMedia };
