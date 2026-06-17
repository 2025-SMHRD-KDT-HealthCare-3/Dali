import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './chat.css'
import { onboardingApi } from '../../api/onboarding'
import { sessionApi } from '../../api/sessions'
import { chatApi } from '../../api/chat'
import { userApi } from '../../api/user'
import { useAuth } from '../../contexts/AuthContext'
import chatBgDark     from '../../assets/dark/챗봇 배경.png'
import chatBgLight    from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme }   from '../../contexts/ThemeContext'
import ThemeToggle    from '../Public/ThemeToggle'
import MessageBubble  from '../Public/MessageBubble'
import TypingBubble   from '../Public/TypingBubble'

/* ── 온보딩 질문 명세 (emotion 은 Main에서 이미 선택 → question_no:1로 별도 제출) ── */
const OB_QUESTIONS = [
  { key: 'gender',        cond: true,  text: '먼저 성별을 알려주실 수 있어요?',                        type: 'qr',   opts: ['여성', '남성', '응답 안 함'] },
  { key: 'birthdate',     cond: true,  text: '생년월일은 언제예요?',                                 type: 'date', placeholder: '날짜를 선택해주세요' },
  { key: 'nickname',      cond: true,  text: '어떻게 불러드릴까요? 닉네임을 알려주세요 😊',             type: 'text', placeholder: '닉네임을 입력해주세요' },
  { key: 'energy',        cond: false, question_no: 2, text: '요즘 하루 에너지 수준은 어떤가요?',      type: 'qr',   opts: ['일상적인 일을 해낼 만큼 활력이 있어요', '생각이 많고 복잡해서 정신적인 에너지가 부족해요', '꼭 해야 할 일만 겨우 하거나 자꾸 미루게 돼요', '하루를 버티는 것도 힘들어요'] },
  { key: 'topic',         cond: false, question_no: 3, text: '최근 가장 신경 쓰이는 영역은 무엇인가요?', type: 'qr',  opts: ['학업 및 진로 방향', '직장 업무와 성과', '가족, 친구, 연인 등 대인관계', '나 자신에 대한 성격이나 자존감', '특별한 고민은 없어요'] },
  { key: 'coachingStyle', cond: false, question_no: 4, text: '달리와 어떤 시간을 보내고 싶나요?',      type: 'qr',   opts: ['친구처럼 편하게 이야기하고 싶어요', '복잡한 마음을 정리하고 싶어요', '작은 것부터 다시 시작하고 싶어요', '따뜻한 위로를 받고 싶어요'] },
]

// Onboarding Q1 선택지
const EMOTION_OPTS = ['생각이 많고 복잡해요', '마음이 조금 지쳐있어요', '아무것도 하기 싫어요', '편하게 이야기하고 싶어요']

// Q4 답변 → 페르소나 직접 매핑 (onboarding_completed 설정용)
const Q4_TO_PERSONA = {
  '친구처럼 편하게 이야기하고 싶어요': '친구형',
  '복잡한 마음을 정리하고 싶어요':     '분석형',
  '작은 것부터 다시 시작하고 싶어요':  '동기부여형',
  '따뜻한 위로를 받고 싶어요':         '공감형',
}

// Main.jsx 감정 ID → 한국어 이름 (세션 selected_emotion으로 전달)
const EMOTION_LABEL = {
  joy: '기쁨', sad: '슬픔', anxiety: '불안',
  anger: '분노', confused: '당황', hurt: '상처',
}

// Main.jsx 감정 아이콘 ID → Q1 user_answer 인덱스 매핑
const EMOTION_ID_TO_IDX = {
  anxiety:  1,  // 불안 → 생각이 많고 복잡해요
  confused: 1,  // 당황 → 생각이 많고 복잡해요
  sad:      2,  // 슬픔 → 마음이 조금 지쳐있어요
  hurt:     2,  // 상처 → 마음이 조금 지쳐있어요
  anger:    3,  // 분노 → 아무것도 하기 싫어요
  joy:      4,  // 기쁨 → 편하게 이야기하고 싶어요
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
  const { user, isAuthenticated, setUser } = useAuth()
  const bottomRef = useRef(null)

  const locState    = location.state || {}
  // 온보딩 완료한 회원은 채팅 재진입 시 온보딩 질문 스킵
  const startInOb   = !!locState.isOnboarding && !(isAuthenticated && user?.onboarding_completed)

  /* ── 온보딩 상태 ── */
  const [obMode,    setObMode]   = useState(startInOb)
  const [obStep,    setObStep]   = useState(-1)
  const [obAnswers, setObAnswers] = useState({ emotion: locState.emotion || null })
  const [obPhase,   setObPhase]  = useState(startInOb ? 'typing' : 'idle')

  const obQuestions = useMemo(() => {
    const prefill = { emotion: locState.emotion }

    if (isAuthenticated && user) {
      if (user.gender)     prefill.gender    = user.gender
      if (user.birth_date) prefill.birthdate = user.birth_date
      if (user.nick_name)  prefill.nickname  = user.nick_name
    } else {
      try {
        const stored = sessionStorage.getItem('dali_guest_profile')
        if (stored) {
          const p = JSON.parse(stored)
          if (!p.expires || Date.now() < p.expires) {
            if (p.gender)     prefill.gender    = p.gender
            if (p.birth_date) prefill.birthdate = p.birth_date
            if (p.nick_name)  prefill.nickname  = p.nick_name
          }
        }
      } catch {}
    }

    return OB_QUESTIONS.filter(q => !q.cond || !prefill[q.key])
  }, [isAuthenticated, user])

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

  // 화면 떠날 때 세션 종료
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        sessionApi.endSession(sessionIdRef.current).catch(() => {})
      }
    }
  }, [])

  /* ── 메시지 / 입력 상태 ── */
  const [messages, setMessages] = useState(() =>
    startInOb ? [] : [{ id: 1, role: 'dali', text: '안녕, 오늘도 와줘서 고마워. ☁️✨', time: now() }]
  )
  const [isTyping, setIsTyping] = useState(startInOb)
  const [input,    setInput]    = useState('')
  const [isRisk,   setIsRisk]   = useState(false)

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: now() }])
  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user',  text, time: now(), read: false }])

  /* ── 온보딩 없이 바로 채팅 진입 시 세션 시작 ── */
  useEffect(() => {
    if (!startInOb) {
      startSession(locState.emotion)
    }
  }, [])

  /* ── 온보딩 시작 인사 ── */
  useEffect(() => {
    if (!startInOb) return
    const t1 = setTimeout(() => {
      addDali('안녕하세요! 저는 달리예요 🌙\n잠깐 몇 가지 여쭤봐도 될까요?')
      setIsTyping(false)
      const t2 = setTimeout(() => {
        setIsTyping(true)
        const t3 = setTimeout(() => setObStep(0), 1200)
        return () => clearTimeout(t3)
      }, 700)
      return () => clearTimeout(t2)
    }, 1200)
    return () => clearTimeout(t1)
  }, [])

  /* ── step 변경 시 질문 노출 ── */
  useEffect(() => {
    if (!obMode || obStep < 0 || obStep >= obQuestions.length) return
    addDali(obQuestions[obStep].text)
    setIsTyping(false)
    setObPhase('waiting')
    setInput('')
  }, [obStep])

  /* ── 자동 스크롤 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* ── 온보딩 답변 처리 ── */
  const handleObAnswer = (value) => {
    const q = obQuestions[obStep]
    addUser(value)
    const newAnswers = { ...obAnswers, [q.key]: value }
    setObAnswers(newAnswers)
    setIsTyping(true)
    setObPhase('typing')

    const next = obStep + 1
    if (next >= obQuestions.length) {
      setTimeout(() => {
        addDali('다 물어봤어요! 이제 함께 이야기해요 🌙✨')
        setIsTyping(false)
        if (isAuthenticated) {
          setUser(prev => ({ ...prev, onboarding_completed: true }))
        }
        submitOnboarding(newAnswers)
        startSession(newAnswers.emotion || locState.emotion)
        setTimeout(() => {
          setObMode(false)
          setObPhase('idle')
        }, 1000)
      }, 1200)
    } else {
      setTimeout(() => setObStep(next), 1200)
    }
  }

  const submitOnboarding = async (all) => {
    const questionsToSubmit = [
      { question_no: 1, text: '요즘 당신의 마음은 어떤가요?', opts: EMOTION_OPTS, key: 'emotion' },
      ...OB_QUESTIONS.filter(q => q.question_no),
    ]

    for (const q of questionsToSubmit) {
      let optionIdx
      if (q.key === 'emotion') {
        optionIdx = EMOTION_ID_TO_IDX[all.emotion] || 0
      } else {
        const textAnswer = all[q.key]
        if (!textAnswer) continue
        optionIdx = q.opts.indexOf(textAnswer) + 1
      }
      if (!optionIdx) continue
      try {
        await onboardingApi.saveAnswer({
          question_no: q.question_no,
          question:    q.text,
          exp_1: q.opts[0],
          exp_2: q.opts[1],
          exp_3: q.opts[2],
          exp_4: q.opts[3],
          exp_5: q.opts[4] || null,
          user_answer: optionIdx,
        })
      } catch (err) {
        console.error(`[chat ob] Q${q.question_no} 저장 실패:`, err)
      }
    }

    // Q4 답변 → 페르소나 자동저장 → onboarding_completed = true
    if (isAuthenticated) {
      const derivedPersona = Q4_TO_PERSONA[all.coachingStyle] || null
      if (derivedPersona) {
        try {
          await userApi.updatePersona(derivedPersona)
          setUser(prev => ({ ...prev, persona: derivedPersona, onboarding_completed: true }))
        } catch (err) {
          console.error('[chat ob] updatePersona failed:', err)
        }
      }
    }
  }

  /* ── 일반 채팅 메시지 전송 ── */
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

  /* ── 전송 버튼 통합 핸들러 ── */
  const handleSend = () => {
    if (obMode && obPhase === 'waiting') {
      const q = obQuestions[obStep]
      if ((q.type === 'text' || q.type === 'date') && input.trim()) {
        handleObAnswer(input.trim())
      }
    } else if (!obMode) {
      sendMessage(input)
    }
  }

  const curQ = obMode && obStep >= 0 && obStep < obQuestions.length ? obQuestions[obStep] : null
  const inputDisabled = obMode && (obPhase !== 'waiting' || curQ?.type === 'qr')

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
              🌙 {obMode ? '처음 만나요! 반가워요 👋' : '지금, 당신과 함께 있어요'}
              {!obMode && <span className="chat-online" />}
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

      {/* 퀵 선택 영역 — 온보딩 칩 or 감정 칩 */}
      {obMode && obPhase === 'waiting' && curQ?.type === 'qr' ? (
        <div className="chat-emotion-bar">
          <div className="chat-emotion-hdr">
            <span>✦ 답변을 선택해주세요</span>
          </div>
          <div className="chat-ob-chips">
            {curQ.opts.map(opt => (
              <button key={opt} className="chat-ob-chip" onClick={() => handleObAnswer(opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : !obMode ? (
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
      ) : null}

      {/* 입력 바 */}
      <div className="chat-input-bar">
        <input
          className={`chat-input${inputDisabled ? ' chat-input--disabled' : ''}`}
          type={obMode && curQ?.type === 'date' ? 'date' : 'text'}
          max={obMode && curQ?.type === 'date' ? new Date().toISOString().split('T')[0] : undefined}
          placeholder={
            obMode && curQ?.type === 'qr'   ? '위에서 선택해주세요' :
            obMode && curQ?.type === 'text'  ? (curQ.placeholder || '입력해주세요') :
            obMode && curQ?.type === 'date'  ? '' :
            obMode ? '' :
            '메시지를 입력해 주세요...'
          }
          disabled={inputDisabled}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !inputDisabled && handleSend()}
        />
        {!obMode && (
          <button className="chat-mic" aria-label="음성">
            <MicIcon />
          </button>
        )}
        <button
          className="chat-send"
          onClick={handleSend}
          disabled={inputDisabled}
          aria-label="전송"
        >
          <SendIcon />
        </button>
      </div>

    </div>
  )
}

export default Chat
