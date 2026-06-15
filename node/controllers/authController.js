/*
 * authController - 인증 / 회원 관리
 * - signup      : POST   /api/auth/signup        회원가입
 * - login       : POST   /api/auth/login         로그인
 * - logout      : POST   /api/auth/logout        로그아웃
 * - getMe       : GET    /api/users/me           회원정보 조회
 * - updateMe    : PUT    /api/users/me           회원정보 수정
 * - updatePersona: PATCH /api/users/me/persona   페르소나 저장
 * - deleteMe    : DELETE /api/users/me           회원탈퇴
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const userRepo = require('../repositories/userRepository');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
};

function generateToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function checkEmail(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: '이메일을 입력해주세요.' });

  const existing = await userRepo.findByEmail(email);
  res.json({ is_duplicate: !!existing });
}

async function signup(req, res) {
  const { email, pwd, nick_name, gender, birth_date } = req.body;
  if (!email || !pwd || !nick_name || !gender || !birth_date) {
    return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
  }

  const existingEmail = await userRepo.findByEmail(email);
  if (existingEmail) {
    return res.status(409).json({ message: '이미 사용중인 이메일입니다.' });
  }

  const hashed = await bcrypt.hash(pwd, 10);
  const userId = await userRepo.createUser({
    email, pwd: hashed, nick_name, gender, birth_date, provider: 'local'
  });

  const user = await userRepo.findById(userId);
  const token = generateToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user });
}

async function login(req, res) {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
  }

  const user = await userRepo.findByEmail(email);
  if (!user || user.provider !== 'local') {
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const isMatch = await bcrypt.compare(pwd, user.pwd);
  if (!isMatch) {
    return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const { pwd: _, ...safeUser } = user;
  const token = generateToken(safeUser);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ user: safeUser });
}

async function logout(req, res) {
  res.clearCookie('token');
  res.json({ message: '로그아웃 되었습니다.' });
}

async function getMe(req, res) {
  const user = await userRepo.findById(req.user.user_id);
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  res.json({ user });
}

async function updateMe(req, res) {
  const { nick_name, gender, birth_date } = req.body;
  if (!nick_name || !gender || !birth_date) {
    return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
  }

  await userRepo.updateUser(req.user.user_id, { nick_name, gender, birth_date });
  const updated = await userRepo.findById(req.user.user_id);
  res.json({ user: updated });
}

const VALID_PERSONAS = ['공감형', '친구형', '분석형', '동기부여형'];

async function updatePersona(req, res) {
  const { persona } = req.body;
  if (!persona) {
    return res.status(400).json({ message: '페르소나를 선택해주세요.' });
  }
  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({ message: '유효하지 않은 페르소나입니다.' });
  }

  await userRepo.updatePersona(req.user.user_id, persona);
  res.json({ persona });
}

async function deleteMe(req, res) {
  await userRepo.deleteUser(req.user.user_id);
  res.json({ message: '회원탈퇴가 완료되었습니다.' });
}

// SNS 로그인 공통 처리: sns_id로 기존 유저 조회 → 있으면 JWT, 없으면 임시 토큰 반환
async function handleSnsLogin(res, { provider, sns_id, email, nick_name }) {
  const existingUser = await userRepo.findByProviderInfo(provider, sns_id);

  if (existingUser) {
    const { pwd: _, ...safeUser } = existingUser;
    const token = generateToken(safeUser);
    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json({ user: safeUser });
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
  if (!access_token) return res.status(400).json({ message: 'access_token이 필요합니다.' });

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
  if (!access_token) return res.status(400).json({ message: 'access_token이 필요합니다.' });

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
  if (!access_token) return res.status(400).json({ message: 'access_token이 필요합니다.' });

  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const sns_id = data.sub;
  const email = data.email || null;
  const nick_name = data.name || null;

  return handleSnsLogin(res, { provider: 'google', sns_id, email, nick_name });
}

// 신규 SNS 유저 추가 정보 등록
async function snsRegister(req, res) {
  const { temp_token, nick_name, gender, birth_date } = req.body;
  if (!temp_token || !nick_name || !gender || !birth_date) {
    return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
  }

  let payload;
  try {
    payload = jwt.verify(temp_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: '유효하지 않거나 만료된 인증 정보입니다.' });
  }

  if (!payload.is_temp) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  const { provider, sns_id, email } = payload;

  const existing = await userRepo.findByProviderInfo(provider, sns_id);
  if (existing) {
    const { pwd: _, ...safeUser } = existing;
    const token = generateToken(safeUser);
    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json({ user: safeUser });
  }

  const userId = await userRepo.createUser({
    email, pwd: null, nick_name, gender, birth_date, provider, sns_id,
  });
  const user = await userRepo.findById(userId);
  const token = generateToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user });
}

module.exports = { checkEmail, signup, login, logout, getMe, updateMe, updatePersona, deleteMe, kakaoAuth, naverAuth, googleAuth, snsRegister };
