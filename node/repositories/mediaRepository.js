/*
 * mediaRepository - media_contents + media_emotions 테이블
 * - findByType : media_type('music'|'video')으로 콘텐츠 조회
 *                emotion 파라미터 있으면 감정별 필터링 추가
 */

const pool = require('../config/db');

async function findByType(media_type, emotion) {
  if (emotion) {
    // 감정별 필터 — media_emotions 테이블과 JOIN, 랜덤 3개 추천
    const [rows] = await pool.query(
      `SELECT mc.*
       FROM media_contents mc
       JOIN media_emotions me ON mc.media_id = me.media_id
       WHERE mc.media_type = ? AND me.emotion = ?
       ORDER BY RAND()
       LIMIT 3`,
      [media_type, emotion]
    );
    return rows;
  }

  // 감정 없으면 전체 목록 반환 (최신순)
  const [rows] = await pool.query(
    'SELECT * FROM media_contents WHERE media_type = ? ORDER BY created_at DESC',
    [media_type]
  );
  return rows;
}

module.exports = { findByType };
