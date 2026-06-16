/*
 * authController - 인증 / 회원 관리
 * - checkEmail          : GET    /api/auth/check-email             이메일 중복확인
 * - signup              : POST   /api/auth/signup                  회원가입
 * - login               : POST   /api/auth/login                   로그인
 * - logout              : POST   /api/auth/logout                  로그아웃
 * - refresh             : POST   /api/auth/refresh                 액세스 토큰 재발급
 * - passwordResetRequest: POST   /api/auth/password/reset-request  비밀번호 재설정 요청
 * - passwordReset       : POST   /api/auth/password/reset          비밀번호 재설정
 * - kakaoAuth           : POST   /api/auth/kakao                   카카오 로그인
 * - naverAuth           : POST   /api/auth/naver                   네이버 로그인
 * - googleAuth          : POST   /api/auth/google                  구글 로그인
 * - snsRegister         : POST   /api/auth/sns/register            SNS 신규 유저 추가 정보 등록
 * - getMe               : GET    /api/users/me                     회원정보 조회
 * - updateMe            : PUT    /api/users/me                     회원정보 수정
 * - updatePersona       : PATCH  /api/users/me/persona             페르소나 저장
 * - deleteMe            : DELETE /api/users/me                     회원탈퇴
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const userRepo = require('../repositories/userRepository');
const { sendPasswordResetEmail } = require('../config/mailer');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// 입력 검증 패턴
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PWD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/; // 8~100자, 영문+숫자 포함
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_GENDERS = ['M', 'F'];

function validateEmail(email) {
  if (!email) return '이메일을 입력해주세요.';
  if (email.length > 255) return '이메일은 255자 이하로 입력해주세요.';
  if (!EMAIL_REGEX.test(email)) return '올바른 이메일 형식이 아닙니다.';
  return null;
}

function validatePassword(pwd) {
  if (!pwd) return '비밀번호를 입력해주세요.';
  if (!PWD_REGEX.test(pwd)) return '비밀번호는 영문과 숫자를 포함한 8자 이상 100자 이하로 입력해주세요.';
  return null;
}

function validateUserFields({ nick_name, gender, birth_date }) {
  if (!nick_name || !gender || !birth_date) return '모든 항목을 입력해주세요.';
  if (nick_name.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!VALID_GENDERS.includes(gender)) return '성별은 M 또는 F로 입력해주세요.';
  if (!DATE_REGEX.test(birth_date)) return '생년월일은 YYYY-MM-DD 형식으로 입력해주세요.';
  return null;
}

// 로그인 실패 횟수 추적 (서버 메모리, 재시작 시 초기화)
// email → { count: number, lockedUntil: timestamp | null }
const loginFailures = new Map();
const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분

function isAccountLocked(email) {
  const record = loginFailures.get(email);
  if (!record?.lockedUntil) return false;
  if (Date.now() < record.lockedUntil) return true;
  loginFailures.delete(email); // 잠금 시간 지나면 해제
  return false;
}

function recordLoginFailure(email) {
  const record = loginFailures.get(email) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
    record.count = 0;
  }
  loginFailures.set(email, record);
}

function clearLoginFailures(email) {
  loginFailures.delete(email);
}

function generateAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function issueTokens(res, user) {
  const access_token = generateAccessToken(user);
  const refresh_token = generateRefreshToken(user);
  res.cookie('refresh_token', refresh_token, REFRESH_COOKIE_OPTIONS);
  return access_token;
}

async function checkEmail(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ code: 'INVALID_REQUEST', message: '이메일을 입력해주세요.' });

  const existing = await userRepo.findByEmail(email);
  res.json({ is_duplicate: !!existing });
}

async function signup(req, res) {
  const { email, pwd, nick_name, gender, birth_date } = req.body;

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: emailErr });

  const pwdErr = validatePassword(pwd);
  if (pwdErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: pwdErr });

  const fieldErr = validateUserFields({ nick_name, gender, birth_date });
  if (fieldErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: fieldErr });

  const existingEmail = await userRepo.findByEmail(email);
  if (existingEmail) {
    return res.status(409).json({ code: 'DUPLICATE', message: '이미 사용중인 이메일입니다.' });
  }

  const hashed = await bcrypt.hash(pwd, 10);
  const userId = await userRepo.createUser({
    email, pwd: hashed, nick_name, gender, birth_date, provider: 'local',
  });

  const user = await userRepo.findById(userId);
  const access_token = issueTokens(res, user);
  res.status(201).json({ access_token, user });
}

async function login(req, res) {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '이메일과 비밀번호를 입력해주세요.' });
  }

  // 계정 잠금 여부 확인
  if (isAccountLocked(email)) {
    return res.status(429).json({ code: 'ACCOUNT_LOCKED', message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' });
  }

  const user = await userRepo.findByEmail(email);
  if (!user || user.provider !== 'local') {
    return res.status(401).json({ code: 'LOGIN_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const isMatch = await bcrypt.compare(pwd, user.pwd);
  if (!isMatch) {
    recordLoginFailure(email); // 비밀번호 틀리면 실패 횟수 증가
    return res.status(401).json({ code: 'LOGIN_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  clearLoginFailures(email); // 로그인 성공 시 실패 횟수 초기화
  const { pwd: _, ...safeUser } = user;
  const access_token = issueTokens(res, safeUser);
  res.json({ access_token, user: safeUser });
}

async function logout(req, res) {
  res.clearCookie('refresh_token');
  res.json({ message: '로그아웃 되었습니다.' });
}

async function refresh(req, res) {
  const token = req.cookies?.refresh_token;
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '리프레시 토큰이 없습니다.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않거나 만료된 리프레시 토큰입니다.' });
  }

  const user = await userRepo.findById(payload.user_id);
  if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '사용자를 찾을 수 없습니다.' });

  const access_token = generateAccessToken(user);
  res.json({ access_token });
}

async function passwordResetRequest(req, res) {
  const { email } = req.body;

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: emailErr });

  const user = await userRepo.findByEmail(email);

  // 이메일 존재 여부 노출 방지 — 항상 동일 응답
  if (!user || user.provider !== 'local') {
    return res.json({ message: '비밀번호 재설정 이메일을 발송했습니다.' });
  }

  const resetToken = jwt.sign(
    { user_id: user.user_id, email: user.email, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  try {
    await sendPasswordResetEmail(email, resetToken);
  } catch {
    return res.status(502).json({ code: 'BAD_GATEWAY', message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  res.json({ message: '비밀번호 재설정 이메일을 발송했습니다.' });
}

async function passwordReset(req, res) {
  const { reset_token, new_password } = req.body;
  if (!reset_token || !new_password) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '필수 항목이 누락되었습니다.' });
  }

  const pwdErr = validatePassword(new_password);
  if (pwdErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: pwdErr });

  let payload;
  try {
    payload = jwt.verify(reset_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않거나 만료된 토큰입니다.' });
  }

  if (payload.type !== 'password_reset') {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
  }

  const hashed = await bcrypt.hash(new_password, 10);
  await userRepo.updatePassword(payload.user_id, hashed);

  res.json({ message: '비밀번호가 변경되었습니다.' });
}

async function getMe(req, res) {
  const user = await userRepo.findById(req.user.user_id);
  if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
  res.json({ user });
}

async function updateMe(req, res) {
  const { nick_name, gender, birth_date } = req.body;

  const fieldErr = validateUserFields({ nick_name, gender, birth_date });
  if (fieldErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: fieldErr });

  await userRepo.updateUser(req.user.user_id, { nick_name, gender, birth_date });
  const updated = await userRepo.findById(req.user.user_id);
  res.json({ user: updated });
}

const VALID_PERSONAS = ['공감형', '친구형', '분석형', '동기부여형'];

async function updatePersona(req, res) {
  const { persona } = req.body;
  if (!persona) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '페르소나를 선택해주세요.' });
  }
  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '유효하지 않은 페르소나입니다.' });
  }

  await userRepo.updatePersona(req.user.user_id, persona);
  res.json({ persona });
}

async function deleteMe(req, res) {
  await userRepo.deleteUser(req.user.user_id);
  res.clearCookie('refresh_token');
  res.json({ message: '회원탈퇴가 완료되었습니다.' });
}

// SNS 로그인 공통 처리: sns_id로 기존 유저 조회 → 있으면 토큰 발급, 없으면 임시 토큰 반환
async function handleSnsLogin(res, { provider, sns_id, email, nick_name }) {
  const existingUser = await userRepo.findByProviderInfo(provider, sns_id);

  if (existingUser) {
    const { pwd: _, ...safeUser } = existingUser;
    const access_token = issueTokens(res, safeUser);
    return res.json({ access_token, user: safeUser });
  }

  // 신규 유저 — 추가 정보 입력 필요 (nick_name, gender, birth_date)
  const tempToken = jwt.sign(
    { sns_id, provider, email, nick_name, is_temp: true },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  return res.status(200).json({ needs_register: true, temp_token: tempToken, email, nick_name });
}

async function kakaoAuth(req, res) {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ code: 'INVALID_REQUEST', message: 'access_token이 필요합니다.' });

  const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const sns_id = String(data.id);
  const email = data.kakao_account?.email || null;
  const nick_name = data.kakao_account?.profile?.nickname || null;

  return handleSnsLogin(res, { provider: 'kakao', sns_id, email, nick_name });
}

async function naverAuth(req, res) {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ code: 'INVALID_REQUEST', message: 'access_token이 필요합니다.' });

  const { data } = await axios.get('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const profile = data.response;
  const sns_id = profile.id;
  const email = profile.email || null;
  const nick_name = profile.name || null;

  return handleSnsLogin(res, { provider: 'naver', sns_id, email, nick_name });
}

async function googleAuth(req, res) {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ code: 'INVALID_REQUEST', message: 'access_token이 필요합니다.' });

  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const sns_id = data.sub;
  const email = data.email || null;
  const nick_name = data.name || null;

  return handleSnsLogin(res, { provider: 'google', sns_id, email, nick_name });
}

async function snsRegister(req, res) {
  const { temp_token, nick_name, gender, birth_date } = req.body;
  if (!temp_token) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '모든 항목을 입력해주세요.' });
  }

  const fieldErr = validateUserFields({ nick_name, gender, birth_date });
  if (fieldErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: fieldErr });

  let payload;
  try {
    payload = jwt.verify(temp_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않거나 만료된 인증 정보입니다.' });
  }

  if (!payload.is_temp) {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
  }

  const { provider, sns_id, email } = payload;

  const existing = await userRepo.findByProviderInfo(provider, sns_id);
  if (existing) {
    const { pwd: _, ...safeUser } = existing;
    const access_token = issueTokens(res, safeUser);
    return res.json({ access_token, user: safeUser });
  }

  const userId = await userRepo.createUser({
    email, pwd: null, nick_name, gender, birth_date, provider, sns_id,
  });
  const user = await userRepo.findById(userId);
  const access_token = issueTokens(res, user);
  res.status(201).json({ access_token, user });
}

module.exports = {
  checkEmail, signup, login, logout, refresh,
  passwordResetRequest, passwordReset,
  getMe, updateMe, updatePersona, deleteMe,
  kakaoAuth, naverAuth, googleAuth, snsRegister,
};
