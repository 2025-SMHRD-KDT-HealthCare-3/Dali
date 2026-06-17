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

const QUICK_CHIPS = [
  { id: 'anxiety', label: '조금 불안해',         icon: '🐾' },
  { id: 'chat',    label: '그냥 이야기하고 싶어', icon: '💬' },
  { id: 'comfort', label: '위로가 필요해',        icon: '🩷' },
]

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
  const [sessionId, setSessionId] = useState(null)
  const sessionIdRef = useRef(null)

  const VALID_EMOTIONS = new Set(['기쁨', '슬픔', '불안', '분노', '상처', '당황'])

  const startSession = async (emotionId) => {
    if (!isAuthenticated) return
    const emotion = EMOTION_LABEL[emotionId] || emotionId
    if (!emotion || !VALID_EMOTIONS.has(emotion)) return
    try {
      const res = await sessionApi.startSession(emotion)
      setSessionId(res.session_id)
      sessionIdRef.current = res.session_id
    } catch (err) {
      console.error('[chat] 세션 시작 실패:', err)
    }
  }

  // 마운트 시 세션 시작
  useEffect(() => {
    startSession(locState.emotion)
  }, [])

  // 화면 떠날 때 세션 종료
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        sessionApi.endSession(sessionIdRef.current).catch(() => {})
      }
    }
  }, [])

  /* ── 메시지 / 입력 상태 ── */
  const [messages, setMessages] = useState([
    { id: 1, role: 'dali', text: '안녕, 오늘도 와줘서 고마워. ☁️✨', time: now() },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [input,    setInput]    = useState('')
  const [isRisk,   setIsRisk]   = useState(false)

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

  return (
    <div className="chat-screen">

      <img src={isDark ? chatBgDark : chatBgLight} alt="" className="chat-bg-img" aria-hidden="true" />

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

      {/* 퀵 감정 칩 */}
      <div className="chat-emotion-bar">
        <div className="chat-emotion-hdr">
          <span>⭐ 지금 내 감정은...</span>
          <span className="chat-emotion-spark">✦</span>
        </div>
        <div className="chat-emotion-chips">
          {QUICK_CHIPS.map(c => (
            <button key={c.id} className="chat-chip" onClick={() => sendMessage(`${c.icon} ${c.label}`)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

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
