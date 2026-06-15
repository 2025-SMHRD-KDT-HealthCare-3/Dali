// 인증 관련 API 호출 — 회원가입/로그인/로그아웃/소셜 로그인/비밀번호 재설정

import { api } from './client'

export const authApi = {
  // 회원가입
  signup: (data) =>
    api.post('/auth/signup', data, { auth: false }),

  // 로그인
  login: (data) =>
    api.post('/auth/login', data, { auth: false }),

  // 로그아웃 (인증 필요)
  logout: () =>
    api.post('/auth/logout'),

  // 액세스 토큰 재발급 (httpOnly 쿠키의 리프레시 토큰으로 검증)
  refresh: () =>
    api.post('/auth/refresh', undefined, { auth: false }),

  // 카카오 소셜 로그인
  kakaoLogin: (data) =>
    api.post('/auth/kakao', data, { auth: false }),

  // 네이버 소셜 로그인
  naverLogin: (data) =>
    api.post('/auth/naver', data, { auth: false }),

  // 구글 소셜 로그인
  googleLogin: (data) =>
    api.post('/auth/google', data, { auth: false }),

  // SNS 신규 유저 추가 정보 등록 (임시 토큰으로 검증, 인증 헤더 불필요)
  snsRegister: (data) =>
    api.post('/auth/sns/register', data, { auth: false }),

  // 이메일 중복 확인 (쿼리 파라미터 인코딩 필수)
  checkEmail: (email) =>
    api.get(`/auth/check-email?email=${encodeURIComponent(email)}`, { auth: false }),

  // 비밀번호 재설정 메일 요청
  requestPasswordReset: (email) =>
    api.post('/auth/password/reset-request', { email }, { auth: false }),

  // 비밀번호 재설정 (재설정 토큰 포함)
  resetPassword: (data) =>
    api.post('/auth/password/reset', data, { auth: false }),
}
