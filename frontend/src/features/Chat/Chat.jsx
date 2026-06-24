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
import { SendIcon }   from '../Public/Icons'
import { formatTime } from '../Public/timeUtils'

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


const Chat = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isDark } = useTheme()
  const { user, isAuthenticated, authLoading } = useAuth()
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

  /* ── 텍스트 입력 버퍼 / 유휴 플러시 ──
     Enter로 줄을 버퍼에 모으고(화면엔 즉시 표시), 타이핑이 완전히
     멈추면(유휴) 버퍼를 합쳐 AI를 한 번만 호출한다.                 */
  const [isUserTyping, setIsUserTyping] = useState(false)
  const bufferRef                        = useRef([])    // Enter로 모은 발화 줄
  const idleRef                          = useRef(null)  // 유휴 플러시 타이머
  const IDLE_MS = 1500                                    // 멈춤 판정 시간

  /* ── 응답 대기 중 메시지 큐 ── */
  const pendingQueueRef = useRef([])
  const isTypingRef     = useRef(false)
  const messagesRef     = useRef([])

  /* ── 음성 녹음 ── */
  const [isRecording, setIsRecording]   = useState(false)
  const mediaRecorderRef                 = useRef(null)
  const audioChunksRef                   = useRef([])

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
        setMessages([{ id: Date.now(), role: 'dali', text: greetText, time: formatTime() }])
      }
    } catch (err) {
      console.error('[chat] 세션 시작 실패:', err)
    }
  }

  // 마운트 시 세션 복원 or 신규 시작 (authLoading 끝난 뒤 실행)
  useEffect(() => {
    if (authLoading) return

    // 비회원: dali_guest_profile이 없거나 만료됐으면 온보딩으로 이동
    if (!isAuthenticated) {
      const guestRaw = sessionStorage.getItem('dali_guest_profile')
      let guestValid = false
      if (guestRaw) {
        try {
          const p = JSON.parse(guestRaw)
          if (!p.expires || Date.now() < p.expires) {
            guestValid = true
          } else {
            sessionStorage.removeItem('dali_guest_profile')
          }
        } catch {
          sessionStorage.removeItem('dali_guest_profile')
        }
      }
      if (!guestValid) {
        navigate('/onboarding', { replace: true, state: { returnEmotion: locState.emotion } })
        return
      }
      setGreetingType('first_visit')
      setMessages([{ id: Date.now(), role: 'dali', text: GREETING_MESSAGES.first_visit, time: formatTime() }])
      return
    }

    // 온보딩 미완료 회원은 Effect 1이 /onboarding으로 이동시키므로 여기서 중단
    if (user && !user.onboarding_completed) return

    // 회원: DB에서 오늘 활성 세션 복원 or 신규 세션 시작
    const restoreOrStart = async () => {
      try {
        const { sessions } = await sessionApi.getLatestSession()
        const latest = sessions?.[0]
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
        const isToday  = latest?.created_at?.slice(0, 10) === todayStr
        const isActive = !latest?.ended_at

        if (latest && isToday && isActive) {
          // 오늘 진행 중인 세션 복원
          setSessionId(latest.session_id)
          sessionIdRef.current = latest.session_id
          const { messages: dbMessages } = await sessionApi.getMessages(latest.session_id)
          if (dbMessages?.length) {
            setMessages(dbMessages.map(m => ({
              id:   m.log_id,
              role: m.role === 'assistant' ? 'dali' : 'user',
              text: m.content,
              time: formatTime(m.created_at),
              read: true,
            })))
            setHasSentFirst(true)
          } else {
            const greetText = GREETING_MESSAGES.today_first
            setMessages([{ id: Date.now(), role: 'dali', text: greetText, time: formatTime() }])
          }
          return
        }
      } catch {}
      // 활성 세션 없음 → 새 세션 시작
      startSession(locState.emotion)
    }
    restoreOrStart()
  }, [authLoading])

  /* ── 메시지 / 입력 상태 ── */
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [input,    setInput]    = useState('')
  const [isRisk,   setIsRisk]   = useState(false)

  // messagesRef 동기화 — sendBatch 파라미터 이름 충돌 회피용
  useEffect(() => { messagesRef.current = messages }, [messages])

  /* ── 세션 종료 핸들러 ── */
  const handleEndSession = async () => {
    if (isEnding) return
    setIsEnding(true)
    if (sessionId) {
      try { await sessionApi.endSession(sessionId) } catch {}
    }
    sessionIdRef.current = null
    setSessionId(null)
    setIsEnding(false)
    navigate('/', { replace: true })
  }

  /* ── 감정 주의 카드 핸들러 ── */
  const handleAlertContinue = () => {
    setShowAlertCard(false)
    const greetText = GREETING_MESSAGES.emotion_alert.replace('{감정}', alertContext?.alert_emotion ?? '')
    setMessages([{ id: Date.now(), role: 'dali', text: greetText, time: formatTime() }])
  }

  const handleAlertDismiss = () => {
    setShowAlertCard(false)
    navigate(-1)
  }

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: formatTime() }])
  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text, time: formatTime(), read: false }])

  /* ── 자동 스크롤 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* ── 채팅 메시지 전송 ── */
  // 실제 API 호출 — messages 배열을 하나로 묶어서 전송, 완료 후 큐 소진
  const sendBatch = async (messages) => {
    isTypingRef.current = true
    setIsTyping(true)

    const utterance = messages.join('\n')
    try {
      const body = { utterance }
      if (isAuthenticated && sessionIdRef.current) body.session_id = sessionIdRef.current
      if (!isAuthenticated) {
        const guest = JSON.parse(sessionStorage.getItem('dali_guest_profile') || '{}')
        if (guest.persona) body.persona = guest.persona
        body.history = messagesRef.current
          .filter(m => m.role === 'user' || m.role === 'dali')
          .slice(-12)
          .map(m => ({ role: m.role === 'dali' ? 'assistant' : 'user', content: m.text }))
      }

      const res = await chatApi.sendMessage(body)

      if (res.should_block_chat) {
        setIsRisk(true)
        setSessionId(null)
        sessionIdRef.current = null
        pendingQueueRef.current = []
        addDali('지금 많이 힘드신 것 같아요. 혼자 버티지 않아도 돼요.\n\n📞 자살예방상담전화: 1393\n📞 정신건강위기상담전화: 1577-0199\n\n언제든 다시 찾아와 주세요 🌙')
      } else {
        addDali(res.reply || '...')
      }
    } catch {
      addDali('죄송해요, 잠시 연결이 끊겼어요. 다시 시도해주세요.')
    } finally {
      isTypingRef.current = false
      setIsTyping(false)

      // 대기 중에 쌓인 메시지가 있으면 한 번에 묶어 재전송
      if (pendingQueueRef.current.length > 0) {
        const queued = [...pendingQueueRef.current]
        pendingQueueRef.current = []
        sendBatch(queued)
      }
    }
  }

  // 한 줄을 화면에 표시하고 버퍼에 적재 (AI 호출은 아직 안 함)
  const commitLine = (text) => {
    const trimmed = text.trim()
    if (!trimmed || isRisk) return false
    if (!hasSentFirst) setHasSentFirst(true)
    addUser(trimmed)
    bufferRef.current.push(trimmed)
    return true
  }

  // 버퍼를 합쳐 AI 호출 (응답 중이면 큐에 쌓아 끝나면 묶어 재전송)
  const flushBuffer = () => {
    clearTimeout(idleRef.current)
    if (bufferRef.current.length === 0) return
    const lines = [...bufferRef.current]
    bufferRef.current = []
    if (isTypingRef.current) {
      pendingQueueRef.current.push(...lines)
      return
    }
    sendBatch(lines)
  }

  // Enter — 줄을 버퍼에 모으고 화면 표시, 멈춤 감지 타이머 재시작
  const handleEnter = () => {
    if (commitLine(input)) {
      setInput('')
      setIsUserTyping(false)
    }
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(flushBuffer, IDLE_MS)
  }

  // 전송 버튼 / 빠른 선택지 — 현재 입력 + 버퍼를 즉시 합쳐 호출
  const handleSend = () => {
    clearTimeout(idleRef.current)
    commitLine(input)
    setInput('')
    setIsUserTyping(false)
    flushBuffer()
  }

  const sendNow = (text) => {
    clearTimeout(idleRef.current)
    commitLine(text)
    flushBuffer()
  }

  // 입력 변경 — 타이핑 중엔 자동 전송 없음(시간제한 0), 대기 중 플러시는 취소
  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    setIsUserTyping(val.trim().length > 0)
    clearTimeout(idleRef.current)
  }

  /* ── 음성 전송 (2단계 분리) ── */
  // 1단계: STT만 호출 → utterance 말풍선 즉시 표시
  // 2단계: 일반 sendBatch로 챗봇 파이프라인 위임
  const sendAudio = async (blob) => {
    if (isRisk) return
    if (!hasSentFirst) setHasSentFirst(true)

    const placeholderId = Date.now() + Math.random()
    setMessages(prev => [...prev, { id: placeholderId, role: 'user', text: '🎤 음성 인식 중...', time: formatTime(), read: false }])

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const { utterance } = await chatApi.sendAudioStt(formData)

      if (!utterance) {
        setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: '🎤 (인식 실패)' } : m))
        addDali('음성을 인식하지 못했어요. 다시 시도해주세요.')
        return
      }

      // STT 완료 — 말풍선 텍스트 즉시 교체 (사용자가 뭐라고 말했는지 바로 확인)
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: utterance } : m))

      // 일반 채팅 파이프라인으로 전달 (달리가 응답 중이면 큐에 적재)
      if (isTypingRef.current) {
        pendingQueueRef.current.push(utterance)
      } else {
        sendBatch([utterance])
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: '🎤 (전송 실패)' } : m))
      addDali('죄송해요, 음성 인식에 실패했어요. 다시 시도해주세요.')
    }
  }

  /* ── 마이크 버튼 클릭 ── */
  const handleMicClick = async () => {
    if (isRisk) return

    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        sendAudio(blob)
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch {
      addDali('마이크 접근 권한이 필요해요. 브라우저 설정에서 허용해주세요.')
    }
  }

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
          disabled={isEnding}
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

        {isUserTyping && (
          <div className="chat-user-typing">
            <span />
            <span />
            <span />
          </div>
        )}
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
              <button key={label} className="chat-chip" onClick={() => sendNow(label)}>
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
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
        />
        <button
          className={`chat-mic${isRecording ? ' chat-mic--recording' : ''}`}
          onClick={handleMicClick}
          aria-label={isRecording ? '녹음 중지' : '음성 입력'}
          disabled={isRisk}
        >
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
