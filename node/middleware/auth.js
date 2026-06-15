/*
 * auth - JWT 인증 미들웨어 (쿠키 방식)
 * - 쿠키에서 토큰을 꺼내서 검증
 * - 검증 성공 시 req.user에 디코딩된 유저 정보 저장
 * - 에러는 res에 직접 반여하지 않고 next(err)로 전달
 */

const jwt = require('jsonwebtoken');
const { ValidationError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const requireLogin = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new ValidationError('로그인이 필요합니다.', 401));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { user_id, email }
    next();
  } catch (err) {
    return next(new ValidationError('유효하지 않거나 만료된 토큰입니다.', 401));
  }
};

// 비회원도 허용 — 토큰 있으면 req.user 설정, 없으면 req.user = null로 통과
const optionalLogin = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    req.user = null;
    next();
  }
};

module.exports = { requireLogin, optionalLogin };
