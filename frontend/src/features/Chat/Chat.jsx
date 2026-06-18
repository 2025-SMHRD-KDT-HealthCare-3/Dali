import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './chat.css'
import { sessionApi } from '../../api/sessions'
import { chatApi } from '../../api/chat'
import { useAuth } from '../../contexts/AuthContext'
import chatBgDark     from '../../assets/dark/챗봇 배경.png'
import chatBgLight    from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme }   from '../../contexts/ThemeContext'
import ThemeToggle    from '../Public/ThemeToggle'
import MessageBubble  from '../Public/MessageBubble'
import TypingBubble   from '../Public/TypingBubble'

// Main.jsx 감정 ID → 한국어 이름 (세션 selected_emotion으로 전달)
const EMOTION_LABEL = {
  joy: '기쁨', sad: '슬픔', anxiety: '불안',
  anger: '분노', confused: '당황', hurt: '상처',
}

// greeting_type별 달리 초기 멘트
const GREETING_MESSAGES = {
  first_visit:      '안녕, 나는 달리야. 오늘 네 마음을 천천히 들어볼게. 지금 가장 가까운 감정을 골라줄래? 🌙',
  today_first:      '안녕, 오늘도 와줘서 고마워. ☁️✨',
  same_day_return:  '다시 왔구나. 아까 이야기 이어서 해볼까?',
  long_time_return: '오랜만이야. 그동안 마음이 어땠는지 천천히 들려줘도 괜찮아.',
  emotion_alert:    '최근 며칠 동안 {감정}이 자주 나타나고 있어요.\n\n이건 진단이 아니라, 달리가 감정 흐름을 보고 보내는 작은 신호예요. 원하면 지금 마음을 조금만 더 이야기해볼 수 있어요.',
}

// 상황별 빠른 선택지 목록
const QUICK_REPLIES = {
  default:      ['조금 불안해', '그냥 이야기하고 싶어', '위로가 필요해', '마음이 복잡해', '오늘은 괜찮아', '이유 없이 지쳐'],
  first_visit:  ['처음이라 가볍게 시작할래', '내 마음을 정리하고 싶어', '무슨 말을 해야 할지 모르겠어', '그냥 들어줬으면 좋겠어'],
  return_visit: ['어제보다 나아졌어', '오늘은 더 힘들어', '비슷한 마음이 계속돼', '조금 달라진 것 같아'],
  불안: ['조금 불안해', '걱정이 계속돼', '마음이 진정이 안 돼'],
  슬픔: ['마음이 가라앉아', '울컥하는 기분이야', '그냥 조용히 있고 싶어'],
  분노: ['너무 화가 나', '억울한 마음이 커', '누가 내 마음을 몰라줘'],
  상처: ['마음이 다친 것 같아', '서운함이 남아 있어', '쉽게 잊히지 않아'],
  당황: ['어떻게 해야 할지 모르겠어', '머릿속이 복잡해', '갑자기 멈춘 느낌이야'],
  기쁨: ['좋은 일이 있었어', '이 기분을 나누고 싶어', '오늘은 조금 괜찮아'],
}

function getQuickReplies({ greetingType, selectedEmotion, alertContext }) {
  if (greetingType === 'first_visit') return QUICK_REPLIES.first_visit
  if (greetingType === 'emotion_alert' && alertContext?.alert_emotion)
    return QUICK_REPLIES[alertContext.alert_emotion] ?? QUICK_REPLIES.default
  if (selectedEmotion) return QUICK_REPLIES[selectedEmotion] ?? QUICK_REPLIES.default
  if (greetingType === 'same_day_return' || greetingType === 'long_time_return')
    return QUICK_REPLIES.return_visit
  return QUICK_REPLIES.default
}

const now = () => {
  const d = new Date()
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mm}`
}

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)
const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const STORAGE_KEY = 'dali_chat_session'

const Chat = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isDark } = useTheme()
  const { user, isAuthenticated } = useAuth()
  const bottomRef = useRef(null)

  const locState = location.state || {}

  // 온보딩 미완료 회원은 /onboarding으로 리다이렉트 (선택한 감정 보존)
  useEffect(() => {
    if (isAuthenticated && user && !user.onboarding_completed) {
      navigate('/onboarding', { replace: true, state: { returnEmotion: locState.emotion } })
    }
  }, [isAuthenticated, user?.onboarding_completed])

  /* ── 세션 상태 ── */
  const [sessionId, setSessionId]   = useState(null)
  const sessionIdRef                 = useRef(null)
  const [isEnding, setIsEnding]     = useState(false)

  /* ── 인사 / 알림 상태 ── */
  const [greetingType, setGreetingType]   = useState('today_first')
  const [alertContext, setAlertContext]   = useState(null)
  const [showAlertCard, setShowAlertCard] = useState(false)

  /* ── 첫 메시지 전송 여부 (빠른 선택지 숨김 트리거) ── */
  const [hasSentFirst, setHasSentFirst] = useState(false)

  const VALID_EMOTIONS = new Set(['기쁨', '슬픔', '불안', '분노', '상처', '당황'])

  const startSession = async (emotionId) => {
    if (!isAuthenticated) return
    const emotion = EMOTION_LABEL[emotionId] || emotionId
    if (!emotion || !VALID_EMOTIONS.has(emotion)) return
    try {
      const res = await sessionApi.startSession(emotion)
      setSessionId(res.session_id)
      sessionIdRef.current = res.session_id

      // Node가 greeting_type을 아직 반환하지 않으면 기본값 사용
      const type  = res.greeting_type ?? 'today_first'
      const alert = res.alert_context ?? null
      setGreetingType(type)
      setAlertContext(alert)

      if (type === 'emotion_alert' && alert) {
        setShowAlertCard(true)
      } else {
        const greetText = GREETING_MESSAGES[type] ?? GREETING_MESSAGES.today_first
        setMessages([{ id: Date.now(), role: 'dali', text: greetText, time: now() }])
      }
    } catch (err) {
      console.error('[chat] 세션 시작 실패:', err)
    }
  }

  // 마운트 시 세션 복원 or 신규 시작
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.sessionId) {
          setSessionId(parsed.sessionId)
          sessionIdRef.current = parsed.sessionId
          if (parsed.messages?.length) setMessages(parsed.messages)
          if (parsed.greetingType)     setGreetingType(parsed.greetingType)
          if (parsed.alertContext)     setAlertContext(parsed.alertContext)
          setHasSentFirst(true)
          return
        }
      } catch {}
    }
    startSession(locState.emotion)
  }, [])

  /* ── 메시지 / 입력 상태 ── */
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [input,    setInput]    = useState('')
  const [isRisk,   setIsRisk]   = useState(false)

  // sessionStorage 동기화 — sessionId·messages·greetingType·alertContext 저장
  useEffect(() => {
    if (!sessionId) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages, greetingType, alertContext }))
  }, [sessionId, messages, greetingType, alertContext])

  /* ── 세션 종료 핸들러 ── */
  const handleEndSession = async () => {
    if (!sessionId || isEnding) return
    setIsEnding(true)
    try {
      await sessionApi.endSession(sessionId)
    } catch {}
    sessionStorage.removeItem(STORAGE_KEY)
    sessionIdRef.current = null
    setSessionId(null)
    setIsEnding(false)
    navigate('/', { replace: true })
  }

  /* ── 감정 주의 카드 핸들러 ── */
  const handleAlertContinue = () => {
    setShowAlertCard(false)
    const greetText = GREETING_MESSAGES.emotion_alert.replace('{감정}', alertContext?.alert_emotion ?? '')
    setMessages([{ id: Date.now(), role: 'dali', text: greetText, time: now() }])
  }

  const handleAlertDismiss = () => {
    setShowAlertCard(false)
    navigate(-1)
  }

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: now() }])
  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text, time: now(), read: false }])

  /* ── 자동 스크롤 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* ── 채팅 메시지 전송 ── */
  const sendMessage = async (text) => {
    if (!text.trim() || isRisk) return
    const trimmed = text.trim()
    if (!hasSentFirst) setHasSentFirst(true)
    addUser(trimmed)
    setInput('')
    setIsTyping(true)

    try {
      const body = { message: trimmed }
      if (isAuthenticated && sessionIdRef.current) body.session_id = sessionIdRef.current

      const res = await chatApi.sendMessage(body)

      if (res.is_risk) {
        setIsRisk(true)
        setSessionId(null)
        sessionIdRef.current = null
        addDali('지금 많이 힘드신 것 같아요. 혼자 버티지 않아도 돼요.\n\n📞 자살예방상담전화: 1393\n📞 정신건강위기상담전화: 1577-0199\n\n언제든 다시 찾아와 주세요 🌙')
      } else {
        addDali(res.reply || '...')
      }
    } catch {
      addDali('죄송해요, 잠시 연결이 끊겼어요. 다시 시도해주세요.')
    } finally {
      setIsTyping(false)
    }
  }

  const handleSend = () => sendMessage(input)

  // 현재 상황에 맞는 빠른 선택지
  const currentQuickReplies = getQuickReplies({
    greetingType,
    selectedEmotion: EMOTION_LABEL[locState.emotion],
    alertContext,
  })

  return (
    <div className="chat-screen">

      <img src={isDark ? chatBgDark : chatBgLight} alt="" className="chat-bg-img" aria-hidden="true" />

      {/* 감정 주의 신호 카드 오버레이 */}
      {showAlertCard && alertContext && (
        <div className="chat-alert-overlay">
          <div className="chat-alert-card">
            <p className="chat-alert-label">{alertContext.alert_emotion} 감정 주의 신호</p>
            <p className="chat-alert-body">
              최근 며칠 동안 <strong>{alertContext.alert_emotion}</strong> 감정이 자주 나타나고 있어요.
              <br /><br />
              이건 진단이 아니라, 달리가 감정 흐름을 보고 보내는 작은 신호예요.
              오늘은 무리해서 해결하려 하기보다, 잠깐 쉬어가는 시간을 가져도 괜찮아요.
            </p>
            {alertContext.alert_reason && (
              <p className="chat-alert-reason">{alertContext.alert_reason}</p>
            )}
            <div className="chat-alert-btns">
              <button className="chat-alert-continue" onClick={handleAlertContinue}>
                이야기 계속하기
              </button>
              <button className="chat-alert-dismiss" onClick={handleAlertDismiss}>
                나중에 할게
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="chat-header">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="뒤로">
          <BackIcon />
        </button>
        <div className="chat-hdr-center">
          <div className="chat-avatar-wrap">
            <img src={daliProfileImg} alt="달리" className="chat-avatar-img" />
          </div>
          <div className="chat-hdr-info">
            <span className="chat-hdr-name">Dali</span>
            <span className="chat-hdr-status">
              🌙 지금, 당신과 함께 있어요
              <span className="chat-online" />
            </span>
          </div>
        </div>
        <ThemeToggle className="chat-theme-toggle" />
        <button
          className="chat-end-btn"
          onClick={handleEndSession}
          disabled={isEnding || !sessionId}
        >
          {isEnding ? '종료 중' : '종료하기'}
        </button>
      </header>

      {/* 메시지 영역 */}
      <div className="chat-messages">
        <div className="chat-date-divider"><span>오늘</span></div>

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            text={msg.text}
            time={msg.time}
            read={msg.read}
          />
        ))}

        {isTyping && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 선택지 — 첫 메시지 전송 전, 알림 카드 닫힌 후에만 표시 */}
      {!hasSentFirst && !showAlertCard && (
        <div className="chat-emotion-bar">
          <div className="chat-emotion-hdr">
            <span>⭐ 지금 내 감정은...</span>
            <span className="chat-emotion-spark">✦</span>
          </div>
          <div className="chat-emotion-chips">
            {currentQuickReplies.map((label) => (
              <button key={label} className="chat-chip" onClick={() => sendMessage(label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 바 */}
      <div className="chat-input-bar">
        <input
          className="chat-input"
          type="text"
          placeholder="메시지를 입력해 주세요..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="chat-mic" aria-label="음성">
          <MicIcon />
        </button>
        <button className="chat-send" onClick={handleSend} aria-label="전송">
          <SendIcon />
        </button>
      </div>


    </div>
  )
}

export default Chat
