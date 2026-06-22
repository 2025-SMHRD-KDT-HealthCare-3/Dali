/*
 * API 라우터 - 전체 엔드포인트 목록
 *
 * [인증]
 * - GET    /api/auth/check-email?email=X          이메일 중복확인
 * - POST   /api/auth/signup                       회원가입
 * - POST   /api/auth/login                        로그인
 * - POST   /api/auth/logout                       로그아웃
 * - POST   /api/auth/refresh                      액세스 토큰 재발급 (리프레시 쿠키 사용)
 * - POST   /api/auth/password/reset-request       비밀번호 재설정 요청 (이메일 발송)
 * - POST   /api/auth/password/reset               비밀번호 재설정
 * - GET    /api/auth/kakao                        카카오 로그인 리다이렉트 (브라우저 이동)
 * - GET    /api/auth/kakao/callback               카카오 OAuth 콜백 처리
 * - GET    /api/auth/naver                        네이버 로그인 리다이렉트 (브라우저 이동)
 * - GET    /api/auth/naver/callback               네이버 OAuth 콜백 처리
 *
 * [회원]
 * - GET    /api/users/me                          회원정보 조회 (onboarding_completed 포함)
 * - PUT    /api/users/me                          회원정보 수정
 * - PATCH  /api/users/me/persona                  페르소나 저장
 * - DELETE /api/users/me                          회원탈퇴
 *
 * [온보딩]
 * - POST   /api/onboarding                        초기 설문 저장/수정 (upsert)
 * - GET    /api/onboarding/me                     내 온보딩 답변 조회
 *
 * [세션]
 * - POST   /api/sessions                          감정 선택 및 세션 시작
 * - GET    /api/sessions                          내 세션 목록 조회
 * - DELETE /api/sessions                          데이터 초기화 (개인정보 제외 전체 삭제)
 * - GET    /api/sessions/:id                      세션 상세 조회 (소유자 검증)
 * - PATCH  /api/sessions/:id/end                  세션 종료
 * - GET    /api/sessions/:id/messages             세션 대화 히스토리 조회
 *
 * [챗봇]
 * - POST   /api/chat/respond                      텍스트 발화 전송 → FastAPI 호출 → AI 응답 생성 (디바운스 후 프론트에서 합쳐서 전송)
 * - POST   /api/chat/audio                        음성 파일 → STT 변환 → AI 응답 생성
 *
 * [발화별 감정 분석]
 * - GET    /api/log-analyses?session_id=X         세션의 발화별 분석 목록
 *
 * [대화 요약]
 * - GET    /api/summaries                         내 대화 요약 전체 목록
 * - GET    /api/summaries/:id                     요약 상세 조회
 *
 * [리포트]
 * - GET    /api/reports/dates?month=YYYY-MM        리포트 있는 날짜 목록 조회
 * - GET    /api/reports/daily?date=YYYY-MM-DD     일간 감정 리포트 조회
 * - GET    /api/reports/monthly?month=YYYY-MM     월간 감정 리포트 조회
 *
 * [회복 미션]
 * - GET    /api/missions                          회복 미션 조회
 * - PATCH  /api/missions/:id                      미션 완료 처리
 *
 * [미디어]
 * - GET    /api/media/music                       음악 콘텐츠 조회
 * - GET    /api/media/video?emotion=X             영상 콘텐츠 조회
 *
 * [감정 주의 신호]
 * - GET    /api/emotion-alerts                    감정 주의 신호 목록
 * - PATCH  /api/emotion-alerts/:id/confirm        감정 주의 신호 확인 처리
 *
 * [고위험 신호]
 * - GET    /api/risk-events(?session_id=X)        고위험 신호 목록 (세션별 필터 가능)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireLogin, optionalLogin } = require('../middleware/auth');

// 무차별 대입 방어 — login, signup, password reset에 적용
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10,                   // 최대 10회
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  },
});

const authCtrl = require('../controllers/authController');
const sessionCtrl = require('../controllers/sessionController');
const chatCtrl = require('../controllers/chatController');
const reportCtrl = require('../controllers/reportController');
const missionCtrl = require('../controllers/missionController');
const mediaCtrl = require('../controllers/mediaController');
const onboardingCtrl = require('../controllers/onboardingController');
const logAnalysisCtrl = require('../controllers/logAnalysisController');
const summaryCtrl = require('../controllers/summaryController');
const emotionAlertCtrl = require('../controllers/emotionAlertController');
const riskEventCtrl = require('../controllers/riskEventController');

// 인증
router.get('/auth/check-email', authCtrl.checkEmail);
router.post('/auth/signup', authLimiter, authCtrl.signup);
router.post('/auth/login', authLimiter, authCtrl.login);
router.post('/auth/logout', requireLogin, authCtrl.logout);
router.post('/auth/refresh', authCtrl.refresh);
router.post('/auth/password/reset-request', authLimiter, authCtrl.passwordResetRequest);
router.post('/auth/password/reset', authLimiter, authCtrl.passwordReset);

router.get('/auth/kakao', authCtrl.kakaoLoginRedirect);           // 카카오 로그인 페이지로 리다이렉트
router.get('/auth/kakao/callback', authCtrl.kakaoAuth);            // 카카오 인가 코드 수신 후 처리
router.get('/auth/naver', authCtrl.naverLoginRedirect);            // 네이버 로그인 페이지로 리다이렉트
router.get('/auth/naver/callback', authCtrl.naverAuth);            // 네이버 인가 코드 수신 후 처리
router.post('/auth/google', authCtrl.googleAuth);

// 회원
router.get('/users/me', requireLogin, authCtrl.getMe);
router.put('/users/me', requireLogin, authCtrl.updateMe);
router.patch('/users/me/persona', requireLogin, authCtrl.updatePersona);
router.delete('/users/me', requireLogin, authCtrl.deleteMe);

// 온보딩
router.get('/onboarding/me', requireLogin, onboardingCtrl.getMyOnboarding);
router.post('/onboarding', optionalLogin, onboardingCtrl.saveOnboarding);

// 세션 (감정 선택) - 회원 전용
router.post('/sessions', requireLogin, sessionCtrl.startSession);
router.get('/sessions', requireLogin, sessionCtrl.getSessions);
router.delete('/sessions', requireLogin, sessionCtrl.resetSessions);
router.get('/sessions/:id', requireLogin, sessionCtrl.getSessionById);
router.patch('/sessions/:id/end', requireLogin, sessionCtrl.endSession);
router.get('/sessions/:id/messages', requireLogin, sessionCtrl.getSessionMessages);

// 챗봇 대화
// /chat/respond: 프론트에서 디바운스 후 합쳐서 전송 → FastAPI 호출 → 응답 후 DB 저장
// /chat/audio: 음성은 녹음 종료가 곧 발화의 끝이므로 STT 완료 즉시 FastAPI 호출
router.post('/chat/respond', requireLogin, chatCtrl.chatRespond);
router.post('/chat/audio', optionalLogin, chatCtrl.upload.single('audio'), chatCtrl.chatAudio);

// 발화별 감정 분석
router.get('/log-analyses', requireLogin, logAnalysisCtrl.getLogAnalysesBySession);

// 대화 요약
router.get('/summaries', requireLogin, summaryCtrl.getSummaries);
router.get('/summaries/:id', requireLogin, summaryCtrl.getSummaryById);

// 리포트
router.get('/reports/dates', requireLogin, reportCtrl.getReportDates);
router.get('/reports/daily', requireLogin, reportCtrl.getDailyReports);
router.get('/reports/monthly', requireLogin, reportCtrl.getMonthlyReports);

// 회복 미션
router.get('/missions', requireLogin, missionCtrl.getMissions);
router.patch('/missions/:id', requireLogin, missionCtrl.completeMission);

// 미디어 콘텐츠
router.get('/media/music', requireLogin, mediaCtrl.getMusicMedia);
router.get('/media/video', requireLogin, mediaCtrl.getVideoMedia);

// 감정 주의 신호
router.get('/emotion-alerts', requireLogin, emotionAlertCtrl.getEmotionAlerts);
router.patch('/emotion-alerts/:id/confirm', requireLogin, emotionAlertCtrl.confirmAlert);

// 고위험 신호 (조회) — session_id 쿼리로 세션별 필터 가능
router.get('/risk-events', requireLogin, riskEventCtrl.getRiskEvents);


module.exports = router;
