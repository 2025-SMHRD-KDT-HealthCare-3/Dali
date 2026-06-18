/*
 * authController - 인증 / 회원 관리
 * - checkEmail          : GET    /api/auth/check-email             이메일 중복확인
 * - signup              : POST   /api/auth/signup                  회원가입
 * - login               : POST   /api/auth/login                   로그인
 * - logout              : POST   /api/auth/logout                  로그아웃
 * - refresh             : POST   /api/auth/refresh                 액세스 토큰 재발급
 * - passwordResetRequest: POST   /api/auth/password/reset-request  비밀번호 재설정 요청
 * - passwordReset       : POST   /api/auth/password/reset          비밀번호 재설정
 * - kakaoLoginRedirect  : GET    /api/auth/kakao                   카카오 로그인 페이지로 리다이렉트
 * - kakaoAuth           : GET    /api/auth/kakao/callback          카카오 OAuth 콜백 처리
 * - naverLoginRedirect  : GET    /api/auth/naver                   네이버 로그인 페이지로 리다이렉트
 * - naverAuth           : GET    /api/auth/naver/callback          네이버 OAuth 콜백 처리
 * - googleAuth          : POST   /api/auth/google                  구글 로그인
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

// refresh_token 쿠키 설정값 — httpOnly로 JS에서 접근 불가, 7일 유지
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// 입력값 검증 정규식
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PWD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/; // 영문+숫자 포함 8~100자
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_GENDERS = ['M', 'F'];

// 이메일 유효성 검사 — 형식 오류 시 에러 메시지 반환, 정상이면 null
function validateEmail(email) {
  if (!email) return '이메일을 입력해주세요.';
  if (email.length > 255) return '이메일은 255자 이하로 입력해주세요.';
  if (!EMAIL_REGEX.test(email)) return '올바른 이메일 형식이 아닙니다.';
  return null;
}

// 비밀번호 유효성 검사
function validatePassword(pwd) {
  if (!pwd) return '비밀번호를 입력해주세요.';
  if (!PWD_REGEX.test(pwd)) return '비밀번호는 영문과 숫자를 포함한 8자 이상 100자 이하로 입력해주세요.';
  return null;
}

// 회원 기본정보 유효성 검사 (닉네임, 성별, 생년월일)
function validateUserFields({ nick_name, gender, birth_date }) {
  if (!nick_name || !gender || !birth_date) return '모든 항목을 입력해주세요.';
  if (nick_name.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!VALID_GENDERS.includes(gender)) return '성별은 M 또는 F로 입력해주세요.';
  if (!DATE_REGEX.test(birth_date)) return '생년월일은 YYYY-MM-DD 형식으로 입력해주세요.';
  return null;
}

// 로그인 실패 횟수 추적 (서버 메모리에 저장 — 재시작 시 초기화됨)
// Map 구조: email → { count: 실패횟수, lockedUntil: 잠금해제시각(ms) | null }
const loginFailures = new Map();
const MAX_LOGIN_FAILURES = 5;       // 5회 실패 시 잠금
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분 잠금

// 해당 이메일이 현재 잠금 상태인지 확인
function isAccountLocked(email) {
  const record = loginFailures.get(email);
  if (!record?.lockedUntil) return false;
  if (Date.now() < record.lockedUntil) return true;
  loginFailures.delete(email); // 잠금 시간이 지났으면 기록 삭제
  return false;
}

// 로그인 실패 1회 기록 — 5회 누적되면 15분 잠금
function recordLoginFailure(email) {
  const record = loginFailures.get(email) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
    record.count = 0; // 잠금 후 카운트 초기화
  }
  loginFailures.set(email, record);
}

// 로그인 성공 시 실패 기록 초기화
function clearLoginFailures(email) {
  loginFailures.delete(email);
}

// 액세스 토큰 생성 — 유효기간 15분, Authorization 헤더로 전달
function generateAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// 리프레시 토큰 생성 — 유효기간 7일, httpOnly 쿠키로 전달
function generateRefreshToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 두 토큰을 한 번에 발급 — 리프레시는 쿠키에 저장, 액세스는 반환
function issueTokens(res, user) {
  const access_token = generateAccessToken(user);
  const refresh_token = generateRefreshToken(user);
  res.cookie('refresh_token', refresh_token, REFRESH_COOKIE_OPTIONS);
  return access_token;
}

// 이메일 중복 확인
async function checkEmail(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ code: 'INVALID_REQUEST', message: '이메일을 입력해주세요.' });

  const existing = await userRepo.findByEmail(email);
  res.json({ is_duplicate: !!existing });
}

// 회원가입
async function signup(req, res) {
  const { email, pwd, nick_name, gender, birth_date } = req.body;

  // 입력값 유효성 검사
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: emailErr });

  const pwdErr = validatePassword(pwd);
  if (pwdErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: pwdErr });

  const fieldErr = validateUserFields({ nick_name, gender, birth_date });
  if (fieldErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: fieldErr });

  // 이메일 중복 확인
  const existingEmail = await userRepo.findByEmail(email);
  if (existingEmail) {
    return res.status(409).json({ code: 'DUPLICATE', message: '이미 사용중인 이메일입니다.' });
  }

  // 비밀번호 해시화 후 저장
  const hashed = await bcrypt.hash(pwd, 10);
  const userId = await userRepo.createUser({
    email, pwd: hashed, nick_name, gender, birth_date, provider: 'local',
  });

  // 생성된 유저 정보로 토큰 발급
  const user = await userRepo.findById(userId);
  const access_token = issueTokens(res, user);
  res.status(201).json({ access_token, user });
}

// 로그인
async function login(req, res) {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '이메일과 비밀번호를 입력해주세요.' });
  }

  // 계정 잠금 여부 먼저 확인
  if (isAccountLocked(email)) {
    return res.status(429).json({ code: 'ACCOUNT_LOCKED', message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' });
  }

  // 이메일로 유저 조회 — 소셜 로그인 유저는 일반 로그인 불가
  const user = await userRepo.findByEmail(email);
  if (!user || user.provider !== 'local') {
    return res.status(401).json({ code: 'LOGIN_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  // 비밀번호 일치 확인
  const isMatch = await bcrypt.compare(pwd, user.pwd);
  if (!isMatch) {
    recordLoginFailure(email); // 실패 횟수 증가
    return res.status(401).json({ code: 'LOGIN_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  clearLoginFailures(email); // 성공 시 실패 기록 초기화
  const { pwd: _, ...safeUser } = user; // 응답에서 pwd 필드 제거
  const access_token = issueTokens(res, safeUser);
  res.json({ access_token, user: safeUser });
}

// 로그아웃 — refresh_token 쿠키 삭제 (설정 시와 동일한 옵션으로 삭제해야 실제로 지워짐)
async function logout(req, res) {
  res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax' });
  res.json({ message: '로그아웃 되었습니다.' });
}

// 액세스 토큰 재발급 — 쿠키의 리프레시 토큰으로 검증 후 새 액세스 토큰 반환
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

  // 유저가 실제로 존재하는지 확인
  const user = await userRepo.findById(payload.user_id);
  if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '사용자를 찾을 수 없습니다.' });

  const access_token = generateAccessToken(user);
  // user 정보도 함께 반환 — 새로고침 후 프론트에서 유저 상태 복원에 사용
  res.json({ access_token, user });
}

// 비밀번호 재설정 이메일 요청
async function passwordResetRequest(req, res) {
  const { email } = req.body;

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ code: 'INVALID_REQUEST', message: emailErr });

  const user = await userRepo.findByEmail(email);

  // 보안상 이메일 존재 여부를 노출하지 않음 — 항상 동일한 응답 반환
  if (!user || user.provider !== 'local') {
    return res.json({ message: '비밀번호 재설정 이메일을 발송했습니다.' });
  }

  // 10분짜리 재설정 토큰 생성 (type 필드로 일반 액세스 토큰과 구분)
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

// 비밀번호 재설정 — 이메일로 받은 reset_token으로 검증 후 새 비밀번호 저장
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

  // type 확인 — 일반 액세스 토큰으로 비밀번호 변경 시도 차단
  if (payload.type !== 'password_reset') {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
  }

  const hashed = await bcrypt.hash(new_password, 10);
  await userRepo.updatePassword(payload.user_id, hashed);

  res.json({ message: '비밀번호가 변경되었습니다.' });
}

// 내 정보 조회
async function getMe(req, res) {
  const user = await userRepo.findById(req.user.user_id);
  if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
  res.json({ user }); // pwd 제외, onboarding_completed 포함 (userRepository에서 처리)
}

// 회원정보 수정 — 전달된 필드만 업데이트 (모두 optional)
async function updateMe(req, res) {
  const { nick_name, gender, birth_date } = req.body;

  // 전달된 필드만 검증
  if (nick_name !== undefined && nick_name.length > 20) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '닉네임은 20자 이하로 입력해주세요.' });
  }
  if (gender !== undefined && !VALID_GENDERS.includes(gender)) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '성별은 M 또는 F로 입력해주세요.' });
  }
  if (birth_date !== undefined && !DATE_REGEX.test(birth_date)) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: '생년월일은 YYYY-MM-DD 형식으로 입력해주세요.' });
  }

  await userRepo.updateUser(req.user.user_id, { nick_name, gender, birth_date });
  const updated = await userRepo.findById(req.user.user_id);
  res.json({ user: updated });
}

const VALID_PERSONAS = ['공감형', '친구형', '분석형', '동기부여형'];

// 페르소나 저장 — 온보딩에서 추천받은 페르소나를 사용자가 확정할 때 호출
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

// 회원탈퇴 — DB 삭제 + 쿠키 삭제
async function deleteMe(req, res) {
  await userRepo.deleteUser(req.user.user_id);
  res.clearCookie('refresh_token');
  res.json({ message: '회원탈퇴가 완료되었습니다.' });
}

// 소셜 로그인 공통 처리
// sns_id로 기존 유저 조회 → 있으면 바로 토큰 발급
// 신규 유저도 바로 생성 → 토큰 발급 → 챗봇 온보딩에서 닉네임/성별/생년월일 수집 후 PUT /users/me로 저장
// isRedirect: 카카오처럼 브라우저 리다이렉트로 오는 경우 true → 프론트 URL로 리다이렉트
async function handleSnsLogin(res, { provider, sns_id, email, nick_name, birth_date = null, gender = null, isRedirect = false }) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  let existing = await userRepo.findByProviderInfo(provider, sns_id);

  let userId;
  if (!existing) {
    // 신규 유저면 플랫폼에서 받아온 정보로 바로 생성
    userId = await userRepo.createUser({
      email, pwd: null, nick_name: nick_name || null, gender, birth_date, provider, sns_id,
    });
  } else {
    userId = existing.user_id;
  }

  // findById로 재조회 — onboarding_completed 파생 컬럼 포함
  const user = await userRepo.findById(userId);

  const { pwd: _, ...safeUser } = user;
  const access_token = issueTokens(res, safeUser);

  if (isRedirect) {
    // 브라우저 리다이렉트 방식 — access_token을 단기 쿠키에 담아 프론트로 이동
    res.cookie('sns_access_token', access_token, { maxAge: 30 * 1000, httpOnly: false });
    // onboarding_completed 여부에 따라 온보딩 or 메인으로 분기
    const destination = safeUser.onboarding_completed ? '/main' : '/onboarding';
    return res.redirect(`${FRONTEND_URL}${destination}`);
  }
  return res.json({ access_token, user: safeUser });
}

// 카카오 로그인 페이지로 리다이렉트 — 프론트에서 이 URL로 이동시키면 됨
function kakaoLoginRedirect(req, res) {
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${process.env.KAKAO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.KAKAO_REDIRECT_URI)}` +
    `&response_type=code`;
  res.redirect(kakaoAuthUrl);
}

// 카카오 로그인 콜백 — 카카오가 code를 가지고 이 주소로 리다이렉트해줌
async function kakaoAuth(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ code: 'INVALID_REQUEST', message: '인가 코드가 없습니다.' });

  // code → access_token 교환
  const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
    params: {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID,
      client_secret: process.env.KAKAO_CLIENT_SECRET,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    },
  });
  const kakaoAccessToken = tokenRes.data.access_token;

  // access_token으로 유저 정보 조회
  const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });

  const sns_id = String(data.id);
  const email = data.kakao_account?.email || null;
  const nick_name = data.kakao_account?.profile?.nickname || null;

  return handleSnsLogin(res, { provider: 'kakao', sns_id, email, nick_name, isRedirect: true });
}

// 네이버 로그인 페이지로 리다이렉트
function naverLoginRedirect(req, res) {
  const state = Math.random().toString(36).slice(2); // CSRF 방지용 랜덤 값
  const naverAuthUrl =
    `https://nid.naver.com/oauth2.0/authorize` +
    `?client_id=${process.env.NAVER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.NAVER_REDIRECT_URI)}` +
    `&response_type=code` +
    `&state=${state}`;
  res.redirect(naverAuthUrl);
}

// 네이버 로그인 콜백 — 네이버가 code를 가지고 이 주소로 리다이렉트해줌
async function naverAuth(req, res) {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ code: 'INVALID_REQUEST', message: '인가 코드가 없습니다.' });

  // code → access_token 교환
  const tokenRes = await axios.get('https://nid.naver.com/oauth2.0/token', {
    params: {
      grant_type: 'authorization_code',
      client_id: process.env.NAVER_CLIENT_ID,
      client_secret: process.env.NAVER_CLIENT_SECRET,
      redirect_uri: process.env.NAVER_REDIRECT_URI,
      code,
      state,
    },
  });
  const naverAccessToken = tokenRes.data.access_token;

  // access_token으로 유저 정보 조회
  const { data } = await axios.get('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${naverAccessToken}` },
  });

  const profile = data.response;
  const sns_id = profile.id;
  const email = profile.email || null;
  const nick_name = profile.nickname || profile.name || null;

  // 출생년도(YYYY) + 생일(MM-DD) 합쳐서 YYYY-MM-DD 형식으로 변환
  const birth_date = (profile.birthyear && profile.birthday)
    ? `${profile.birthyear}-${profile.birthday}`
    : null;

  // 네이버 성별: M/F → 우리 DB 형식과 동일
  const gender = profile.gender || null;

  return handleSnsLogin(res, { provider: 'naver', sns_id, email, nick_name, birth_date, gender, isRedirect: true });
}

// 구글 소셜 로그인
async function googleAuth(req, res) {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ code: 'INVALID_REQUEST', message: 'access_token이 필요합니다.' });

  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const sns_id = data.sub; // 구글은 sub 필드가 고유 ID
  const email = data.email || null;
  const nick_name = data.name || null;

  return handleSnsLogin(res, { provider: 'google', sns_id, email, nick_name });
}

module.exports = {
  checkEmail, signup, login, logout, refresh,
  passwordResetRequest, passwordReset,
  getMe, updateMe, updatePersona, deleteMe,
  kakaoLoginRedirect, kakaoAuth, naverLoginRedirect, naverAuth, googleAuth,
};
