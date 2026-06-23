/*
 * auth - JWT 인증 미들웨어 (Bearer 토큰 방식)
 * - Authorization: Bearer <access_token> 헤더에서 토큰 추출
 * - 검증 성공 시 req.user에 디코딩된 유저 정보 저장
 */

const jwt = require('jsonwebtoken');
const { ValidationError } = require('./errorHandler');
const { isReplaced } = require('../utils/sessionStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const requireLogin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ValidationError('로그인이 필요합니다.', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 다른 기기에서 새로 로그인해 세션이 교체되었으면 차단 (중복 로그인 방지)
    if (isReplaced(decoded.user_id, decoded.sid)) {
      return next(new ValidationError('다른 기기에서 로그인되어 로그아웃되었습니다.', 401, 'SESSION_REPLACED'));
    }
    req.user = decoded;
    next();
  } catch {
    return next(new ValidationError('유효하지 않거나 만료된 토큰입니다.', 401, 'INVALID_TOKEN'));
  }
};

// 비회원도 허용 — 토큰 있으면 req.user 설정, 없으면 req.user = null로 통과
// (세션이 교체된 토큰도 비회원으로 강등 처리)
const optionalLogin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = isReplaced(decoded.user_id, decoded.sid) ? null : decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
};

module.exports = { requireLogin, optionalLogin };
