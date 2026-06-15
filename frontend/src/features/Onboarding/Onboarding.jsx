import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './onboarding.css'
import chatBgDark  from '../../assets/dark/챗봇 배경.png'
import chatBgLight from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme } from '../../contexts/ThemeContext'
import MessageBubble from '../Public/MessageBubble'
import TypingBubble  from '../Public/TypingBubble'

/* ── 질문 명세 ── */
const QUESTIONS = [
  {
    key: 'gender',
    conditional: true,
    text: '먼저, 성별을 알려주실 수 있어요?',
    type: 'quickreply',
    options: ['여성', '남성', '응답 안 함'],
  },
  {
    key: 'birthdate',
    conditional: true,
    text: '생년월일은 언제예요?',
    type: 'date',
  },
  {
    key: 'nickname',
    conditional: true,
    text: '어떻게 불러드릴까요? 닉네임을 알려주세요 😊',
    type: 'text',
    placeholder: '닉네임을 입력해주세요',
  },
  {
    key: 'emotion',
    conditional: false,
    text: '요즘 당신의 마음은 어떤가요?',
    type: 'quickreply',
    options: [
      '생각이 많고 복잡해요',
      '마음이 조금 지쳐있어요',
      '아무것도 하기 싫어요',
      '편하게 이야기하고 싶어요',
    ],
  },
  {
    key: 'energy',
    conditional: false,
    text: '요즘 하루 에너지 수준은 어떤가요?',
    type: 'quickreply',
    options: [
      '일상적인 일을 해낼 만큼 활력이 있어요',
      '생각이 많고 복잡해서 정신적인 에너지가 부족해요',
      '꼭 해야 할 일만 겨우 하거나 자꾸 미루게 돼요',
      '하루를 버티는 것도 힘들어요',
    ],
  },
  {
    key: 'topic',
    conditional: false,
    text: '최근 가장 신경 쓰이는 영역은 무엇인가요?',
    type: 'quickreply',
    options: [
      '학업 및 진로 방향',
      '직장 업무와 성과',
      '가족, 친구, 연인 등 대인관계',
      '나 자신에 대한 성격이나 자존감',
      '특별한 고민은 없어요',
    ],
  },
  {
    key: 'coachingStyle',
    conditional: false,
    text: '달리와 어떤 시간을 보내고 싶나요?',
    type: 'quickreply',
    options: [
      '친구처럼 편하게 이야기하고 싶어요',
      '복잡한 마음을 정리하고 싶어요',
      '작은 것부터 다시 시작하고 싶어요',
      '따뜻한 위로를 받고 싶어요',
    ],
  },
  {
    key: 'checkinTime',
    conditional: false,
    text: '하루 중 달리와 마음을 나누기 좋은 시간대는 언제예요?',
    type: 'quickreply',
    options: ['아침', '낮', '저녁', '밤'],
  },
]

const GREETING = '안녕하세요! 저는 달리예요 🌙\n처음 만나서 반가워요! 잠깐 몇 가지 여쭤봐도 될까요?'

const nowStr = () => {
  const d = new Date()
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mm}`
}

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

/* ── 컴포넌트 ── */
const Onboarding = ({ prefill = null, registerToken = null }) => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const bottomRef = useRef(null)

  const activeQuestions = useMemo(
    () => QUESTIONS.filter(q => !q.conditional || !prefill?.[q.key]),
    [prefill]
  )

  const [messages, setMessages]   = useState([])
  const [isTyping, setIsTyping]   = useState(true)
  const [step, setStep]           = useState(-1)
  const [answers, setAnswers]     = useState({})
  const [phase, setPhase]         = useState('typing')   // 'typing' | 'waiting' | 'submitting'
  const [inputValue, setInputValue] = useState('')

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: nowStr() }])

  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text, time: nowStr() }])

  /* 첫 인사 */
  useEffect(() => {
    const t1 = setTimeout(() => {
      addDali(GREETING)
      setIsTyping(false)
      const t2 = setTimeout(() => {
        setIsTyping(true)
        const t3 = setTimeout(() => setStep(0), 1200)
        return () => clearTimeout(t3)
      }, 700)
      return () => clearTimeout(t2)
    }, 1200)
    return () => clearTimeout(t1)
  }, [])

  /* step 변경 시 질문 노출 */
  useEffect(() => {
    if (step < 0 || step >= activeQuestions.length) return
    addDali(activeQuestions[step].text)
    setIsTyping(false)
    setPhase('waiting')
    setInputValue('')
  }, [step])

  /* 자동 스크롤 */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleAnswer = (value) => {
    const q = activeQuestions[step]
    addUser(value)
    const newAnswers = { ...answers, [q.key]: value }
    setAnswers(newAnswers)
    setPhase('typing')
    setIsTyping(true)

    const nextStep = step + 1
    if (nextStep >= activeQuestions.length) {
      setTimeout(() => {
        addDali('고마워요! 이제 달리와 함께할 준비가 됐어요 ✨')
        setIsTyping(false)
        setPhase('submitting')
        submitAll(newAnswers)
      }, 1200)
    } else {
      setTimeout(() => setStep(nextStep), 1200)
    }
  }

  const submitAll = async (allAnswers) => {
    const demographic = {
      nickname:  allAnswers.nickname  || prefill?.nickname,
      gender:    allAnswers.gender    || prefill?.gender,
      birthdate: allAnswers.birthdate || prefill?.birthdate,
    }

    let accessToken = null
    try {
      if (registerToken) {
        const res = await axios.post('/auth/sns/register', demographic, {
          headers: { Authorization: `Bearer ${registerToken}` },
          withCredentials: true,
        })
        accessToken = res.data?.access_token ?? null
      }
    } catch (err) {
      console.error('[onboarding] register failed:', err)
    }

    try {
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      await axios.post('/onboarding', {
        emotion:       allAnswers.emotion,
        energy:        allAnswers.energy,
        topic:         allAnswers.topic,
        coachingStyle: allAnswers.coachingStyle,
        checkinTime:   allAnswers.checkinTime,
      }, { headers })
    } catch (err) {
      console.error('[onboarding] onboarding failed:', err)
    }

    navigate('/main')
  }

  const currentQ = step >= 0 && step < activeQuestions.length ? activeQuestions[step] : null

  return (
    <div className="ob-screen">
      <img
        src={isDark ? chatBgDark : chatBgLight}
        alt=""
        className="ob-bg-img"
        aria-hidden="true"
      />

      {/* 헤더 */}
      <header className="ob-header">
        <div className="ob-avatar-wrap">
          <img src={daliProfileImg} alt="달리" className="ob-avatar-img" />
        </div>
        <div className="ob-hdr-info">
          <span className="ob-hdr-name">Dali</span>
          <span className="ob-hdr-sub">처음 만나요! 👋</span>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="ob-messages">
        <div className="ob-date-divider"><span>오늘</span></div>

        {messages.map(msg => (
          <MessageBubble key={msg.id} role={msg.role} text={msg.text} time={msg.time} />
        ))}

        {isTyping && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      {phase === 'waiting' && currentQ && (
        <div className="ob-input-area">
          {currentQ.type === 'quickreply' && (
            <div className="ob-chips">
              {currentQ.options.map(opt => (
                <button key={opt} className="ob-chip" onClick={() => handleAnswer(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'text' && (
            <div className="ob-text-row">
              <input
                className="ob-text-input"
                placeholder={currentQ.placeholder || '입력해주세요'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && inputValue.trim() && handleAnswer(inputValue.trim())}
                autoFocus
              />
              <button
                className="ob-send-btn"
                onClick={() => inputValue.trim() && handleAnswer(inputValue.trim())}
                aria-label="전송"
              >
                <SendIcon />
              </button>
            </div>
          )}

          {currentQ.type === 'date' && (
            <div className="ob-text-row">
              <input
                type="date"
                className="ob-text-input ob-date-input"
                max={new Date().toISOString().split('T')[0]}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
              <button
                className="ob-send-btn"
                onClick={() => inputValue && handleAnswer(inputValue)}
                aria-label="확인"
              >
                <SendIcon />
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'submitting' && (
        <div className="ob-input-area ob-loading">
          <span>달리와 함께하는 공간을 준비하고 있어요…</span>
        </div>
      )}
    </div>
  )
}

export default Onboarding
