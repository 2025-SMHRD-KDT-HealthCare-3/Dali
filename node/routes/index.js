/*
 * API 라우터 - 전체 엔드포인트 목록
 *
 * [인증]
 * - GET    /api/auth/check-email?email=X          이메일 중복확인
 * - POST   /api/auth/signup                     회원가입
 * - POST   /api/auth/login                      로그인
 * - POST   /api/auth/logout                     로그아웃
 * - POST   /api/auth/kakao                      카카오 소셜 로그인
 * - POST   /api/auth/naver                      네이버 소셜 로그인
 * - POST   /api/auth/google                     구글 소셜 로그인
 * - POST   /api/auth/sns/register               SNS 신규 유저 추가 정보 등록
 *
 * [회원]
 * - GET    /api/users/me                        회원정보 조회
 * - PUT    /api/users/me                        회원정보 수정
 * - DELETE /api/users/me                        회원탈퇴
 *
 * [온보딩]
 * - POST   /api/onboarding                      초기 설문 진행
 *
 * [세션]
 * - POST   /api/sessions                        감정 선택 및 세션 시작
 * - PATCH  /api/sessions/:id/end                세션 종료
 * - GET    /api/sessions                        내 세션 목록 조회
 *
 * [챗봇]
 * - POST   /api/chat                            사용자 메시지 전송 및 AI 응답 생성
 *
 * [발화별 감정 분석]
 * - GET    /api/log-analyses?session_id=X       세션의 발화별 감정 분석 목록
 *
 * [대화 요약]
 *
 * [리포트]
 * - GET    /api/reports/daily                   일간 감정 리포트 조회
 * - GET    /api/reports/monthly                 월간 감정 리포트 조회
 *
 * [미션]
 * - GET    /api/missions                        회복 미션 조회
 * - PATCH  /api/missions/:id                    미션 완료 처리
 *
 * [미디어]
 * - GET    /api/media/music(?emotion=X)         음악 콘텐츠 조회
 * - GET    /api/media/video(?emotion=X)         영상 콘텐츠 조회
 *
 * [감정 주의 신호]
 * - GET    /api/emotion-alerts                  감정 주의 신호 목록
 * - PATCH  /api/emotion-alerts/:id/confirm      감정 주의 신호 확인 처리
 *
 */

const express = require('express');
const router = express.Router();
const { requireLogin, optionalLogin } = require('../middleware/auth');

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

// 인증
router.get('/auth/check-email', authCtrl.checkEmail);
router.post('/auth/signup', authCtrl.signup);
router.post('/auth/login', authCtrl.login);
router.post('/auth/logout', requireLogin, authCtrl.logout);

router.post('/auth/kakao', authCtrl.kakaoAuth);
router.post('/auth/naver', authCtrl.naverAuth);
router.post('/auth/google', authCtrl.googleAuth);
router.post('/auth/sns/register', authCtrl.snsRegister);

// 회원
router.get('/users/me', requireLogin, authCtrl.getMe);
router.put('/users/me', requireLogin, authCtrl.updateMe);
router.patch('/users/me/persona', requireLogin, authCtrl.updatePersona);
router.delete('/users/me', requireLogin, authCtrl.deleteMe);

// 온보딩 (비회원 허용 — 비회원은 DB 저장 안 함)
router.post('/onboarding', optionalLogin, onboardingCtrl.saveOnboarding);

// 세션 (감정 선택) - 회원 전용
router.post('/sessions', requireLogin, sessionCtrl.startSession);
router.patch('/sessions/:id/end', requireLogin, sessionCtrl.endSession);
router.get('/sessions', requireLogin, sessionCtrl.getSessions);

// 챗봇 대화 (비회원 허용 — 비회원은 DB 저장 안 함)
router.post('/chat', optionalLogin, chatCtrl.chat);

// 발화별 감정 분석 (log_analyses)
router.get('/log-analyses', requireLogin, logAnalysisCtrl.getLogAnalysesBySession);       // ?session_id=X


// 리포트
router.get('/reports/daily', requireLogin, reportCtrl.getDailyReports);
router.get('/reports/monthly', requireLogin, reportCtrl.getMonthlyReports);

// 회복 미션
router.get('/missions', requireLogin, missionCtrl.getMissions);
router.patch('/missions/:id', requireLogin, missionCtrl.completeMission);

// 미디어 콘텐츠
router.get('/media/music', requireLogin, mediaCtrl.getMusicMedia);                         // ?emotion=X (선택)
router.get('/media/video', requireLogin, mediaCtrl.getVideoMedia);                         // ?emotion=X (선택)

// 감정 주의 신호 (emotion_alerts)
router.get('/emotion-alerts', requireLogin, emotionAlertCtrl.getEmotionAlerts);
router.patch('/emotion-alerts/:id/confirm', requireLogin, emotionAlertCtrl.confirmAlert);

module.exports = router;
