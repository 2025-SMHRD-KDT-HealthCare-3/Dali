import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import './chat.css'
import chatBgDark     from '../../assets/dark/챗봇 배경.png'
import chatBgLight    from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme }   from '../../contexts/ThemeContext'
import ThemeToggle    from '../Public/ThemeToggle'
import MessageBubble  from '../Public/MessageBubble'
import TypingBubble   from '../Public/TypingBubble'

/* ── 온보딩 질문 명세 (emotion 은 Main에서 이미 선택) ── */
const OB_QUESTIONS = [
  { key: 'gender',        cond: true,  text: '먼저 성별을 알려주실 수 있어요?',                        type: 'qr',   opts: ['여성', '남성', '응답 안 함'] },
  { key: 'birthdate',     cond: true,  text: '생년월일은 언제예요?',                                 type: 'date', placeholder: '날짜를 선택해주세요' },
  { key: 'nickname',      cond: true,  text: '어떻게 불러드릴까요? 닉네임을 알려주세요 😊',             type: 'text', placeholder: '닉네임을 입력해주세요' },
  { key: 'energy',        cond: false, text: '요즘 하루 에너지 수준은 어떤가요?',                      type: 'qr',   opts: ['일상적인 일을 해낼 만큼 활력이 있어요', '생각이 많고 복잡해서 정신적인 에너지가 부족해요', '꼭 해야 할 일만 겨우 하거나 자꾸 미루게 돼요', '하루를 버티는 것도 힘들어요'] },
  { key: 'topic',         cond: false, text: '최근 가장 신경 쓰이는 영역은 무엇인가요?',               type: 'qr',   opts: ['학업 및 진로 방향', '직장 업무와 성과', '가족, 친구, 연인 등 대인관계', '나 자신에 대한 성격이나 자존감', '특별한 고민은 없어요'] },
  { key: 'coachingStyle', cond: false, text: '달리와 어떤 시간을 보내고 싶나요?',                     type: 'qr',   opts: ['친구처럼 편하게 이야기하고 싶어요', '복잡한 마음을 정리하고 싶어요', '작은 것부터 다시 시작하고 싶어요', '따뜻한 위로를 받고 싶어요'] },
  { key: 'checkinTime',   cond: false, text: '하루 중 달리와 마음을 나누기 좋은 시간대는 언제예요?',    type: 'qr',   opts: ['아침', '낮', '저녁', '밤'] },
]

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
  const bottomRef = useRef(null)

  const locState    = location.state || {}
  const startInOb   = !!locState.isOnboarding

  /* ── 온보딩 상태 ── */
  const [obMode,    setObMode]   = useState(startInOb)
  const [obStep,    setObStep]   = useState(-1)
  const [obAnswers, setObAnswers] = useState({ emotion: locState.emotion || null })
  const [obPhase,   setObPhase]  = useState(startInOb ? 'typing' : 'idle')

  const obQuestions = useMemo(() => {
    const prefill = { emotion: locState.emotion }
    return OB_QUESTIONS.filter(q => !q.cond || !prefill[q.key])
  }, []) // mount 시 한 번만 계산

  /* ── 메시지 / 입력 상태 ── */
  const [messages, setMessages] = useState(() =>
    startInOb ? [] : [{ id: 1, role: 'dali', text: '안녕, 오늘도 와줘서 고마워. ☁️✨', time: now() }]
  )
  const [isTyping, setIsTyping] = useState(startInOb)
  const [input,    setInput]    = useState('')

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: now() }])
  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user',  text, time: now(), read: false }])

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
        submitOnboarding(newAnswers)
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
    try {
      await axios.post('/onboarding', {
        emotion:       all.emotion,
        energy:        all.energy,
        topic:         all.topic,
        coachingStyle: all.coachingStyle,
        checkinTime:   all.checkinTime,
      })
    } catch (err) {
      console.error('[chat ob]', err)
    }
  }

  /* ── 일반 채팅 메시지 전송 ── */
  const sendMessage = (text) => {
    if (!text.trim()) return
    addUser(text.trim())
    setInput('')
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
