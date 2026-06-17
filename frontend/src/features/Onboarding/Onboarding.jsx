import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './onboarding.css'
import chatBgDark  from '../../assets/dark/챗봇 배경.png'
import chatBgLight from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { userApi } from '../../api/user'
import { onboardingApi } from '../../api/onboarding'
import MessageBubble from '../Public/MessageBubble'
import TypingBubble  from '../Public/TypingBubble'

/*
 * QUESTIONS 배열 구조
 *  conditional: true  → 회원이 이미 해당 정보를 가진 경우 스킵
 *  question_no        → 온보딩 API에 전달할 번호 (페르소나 질문만 존재)
 *  personaWeight      → 페르소나 계산에 사용 여부 표시 (참고용)
 */
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
    question_no: 1,
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
    question_no: 2,
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
    question_no: 3,
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
    question_no: 4,
    text: '달리와 어떤 시간을 보내고 싶나요?\n추천을 그대로 하셔도 되고, 원하는 스타일로 바꾸셔도 돼요 😊',
    type: 'quickreply',
    options: [
      '친구처럼 편하게 이야기하고 싶어요',
      '복잡한 마음을 정리하고 싶어요',
      '작은 것부터 다시 시작하고 싶어요',
      '따뜻한 위로를 받고 싶어요',
    ],
  },
]


const Q4_TO_PERSONA = {
  '친구처럼 편하게 이야기하고 싶어요': '친구형',
  '복잡한 마음을 정리하고 싶어요':     '분석형',
  '작은 것부터 다시 시작하고 싶어요':  '동기부여형',
  '따뜻한 위로를 받고 싶어요':         '공감형',
}

const PERSONA_EMOJI = { '공감형': '🩷', '친구형': '✨', '분석형': '🌿', '동기부여형': '🌙' }

// Q1 감정 답변 → 예비 추천 페르소나 (Q4 전 표시용)
const EMOTION_TO_PERSONA = {
  '생각이 많고 복잡해요':    '분석형',
  '마음이 조금 지쳐있어요':  '공감형',
  '아무것도 하기 싫어요':    '동기부여형',
  '편하게 이야기하고 싶어요': '친구형',
}

// 페르소나 → Q4 옵션 텍스트 (추천 칩 강조용)
const PERSONA_TO_Q4_OPT = {
  '친구형':     '친구처럼 편하게 이야기하고 싶어요',
  '분석형':     '복잡한 마음을 정리하고 싶어요',
  '동기부여형': '작은 것부터 다시 시작하고 싶어요',
  '공감형':     '따뜻한 위로를 받고 싶어요',
}

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
const Onboarding = ({ registerToken = null }) => {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { isDark } = useTheme()
  const { isAuthenticated, user, setUser } = useAuth()
  const bottomRef  = useRef(null)

  // Chat에서 리다이렉트될 때 감정 ID 보존
  const returnEmotion = location.state?.returnEmotion || null

  // 이미 온보딩 완료한 회원은 리다이렉트 (제출 중에는 스킵)
  const [phase, setPhase] = useState('typing')

  useEffect(() => {
    if (isAuthenticated && user?.onboarding_completed && phase !== 'submitting') {
      navigate(returnEmotion ? '/chat' : '/main', {
        replace: true,
        state: returnEmotion ? { emotion: returnEmotion } : undefined,
      })
    }
  }, [isAuthenticated, user?.onboarding_completed, phase])

  // 회원의 기존 프로필 또는 비회원 sessionStorage에서 prefill 계산 → conditional 질문 스킵
  const prefill = useMemo(() => {
    if (isAuthenticated && user) {
      return {
        nickname:  user.nick_name  || null,
        gender:    user.gender     || null,
        birthdate: user.birth_date ? user.birth_date.split('T')[0] : null,
      }
    }
    try {
      const stored = sessionStorage.getItem('dali_guest_profile')
      if (stored) {
        const p = JSON.parse(stored)
        if (!p.expires || Date.now() < p.expires) {
          return {
            nickname:  p.nick_name  || null,
            gender:    p.gender     || null,
            birthdate: p.birth_date || null,
          }
        }
        sessionStorage.removeItem('dali_guest_profile')
      }
    } catch {}
    return null
  }, [isAuthenticated, user])

  const activeQuestions = useMemo(
    () => QUESTIONS.filter(q => !q.conditional || !prefill?.[q.key]),
    [prefill]
  )

  const [messages,      setMessages]     = useState([])
  const [isTyping,      setIsTyping]     = useState(true)
  const [step,          setStep]         = useState(-1)
  const [answers,       setAnswers]      = useState({})
  const [inputValue,    setInputValue]   = useState('')
  const [recommendedOpt, setRecommendedOpt] = useState(null)

  const addDali = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'dali', text, time: nowStr() }])
  const addUser = (text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text, time: nowStr() }])

  // 첫 인사
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

  // step 변경 시 질문 노출
  useEffect(() => {
    if (step < 0 || step >= activeQuestions.length) return
    addDali(activeQuestions[step].text)
    setIsTyping(false)
    setPhase('waiting')
    setInputValue('')
  }, [step])

  // 자동 스크롤
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
      // Q4 (마지막) 답변 완료 → 저장 + 최종 메시지
      setTimeout(() => {
        addDali('고마워요! 이제 달리와 함께할 준비가 됐어요 ✨')
        setIsTyping(false)
        setPhase('submitting')
        submitAll(newAnswers)
      }, 1200)
    } else {
      const nextQ = activeQuestions[nextStep]
      if (nextQ?.key === 'coachingStyle') {
        // Q3 → Q4 직전: Q1 기반 예비 추천 페르소나 먼저 안내
        const preRecommended = EMOTION_TO_PERSONA[newAnswers.emotion] || '공감형'
        const preEmoji = PERSONA_EMOJI[preRecommended] || '✨'
        setRecommendedOpt(PERSONA_TO_Q4_OPT[preRecommended] || null)
        setTimeout(() => {
          addDali(`달리가 분석해보니,\n${preEmoji} ${preRecommended} 스타일이 잘 맞을 것 같아요!\n아래에서 원하시는 스타일을 직접 골라보실 수 있어요 🌙`)
          setIsTyping(false)
          setTimeout(() => {
            setIsTyping(true)
            setTimeout(() => setStep(nextStep), 1200)
          }, 1500)
        }, 1200)
      } else {
        setTimeout(() => setStep(nextStep), 1200)
      }
    }
  }

  const submitAll = async (allAnswers) => {
    const genderMap = { '여성': 'F', '남성': 'M' }

    // 1. 기본 정보 업데이트 — 값 있는 필드만 전송
    if (isAuthenticated) {
      const payload = {}
      if (allAnswers.nickname) payload.nick_name = allAnswers.nickname
      const gVal = genderMap[allAnswers.gender] || null
      if (gVal) payload.gender = gVal
      const bVal = allAnswers.birthdate ? allAnswers.birthdate.split('T')[0] : null
      if (bVal) payload.birth_date = bVal

      if (Object.keys(payload).length > 0) {
        try { await userApi.updateMe(payload) }
        catch (err) { console.error('[onboarding] updateMe failed:', err) }
      }
    } else {
      sessionStorage.setItem('dali_guest_profile', JSON.stringify({
        nick_name:  allAnswers.nickname  || null,
        gender:     genderMap[allAnswers.gender] ?? null,
        birth_date: allAnswers.birthdate || null,
        expires:    Date.now() + 3 * 60 * 60 * 1000,
      }))
    }

    // 2. Q1~Q4 한 번에 저장 → recommended_persona 반환
    const qDefs = {
      1: QUESTIONS.find(q => q.question_no === 1),
      2: QUESTIONS.find(q => q.question_no === 2),
      3: QUESTIONS.find(q => q.question_no === 3),
      4: QUESTIONS.find(q => q.question_no === 4),
    }
    const q1 = qDefs[1] ? qDefs[1].options.indexOf(allAnswers.emotion)       + 1 : 0
    const q2 = qDefs[2] ? qDefs[2].options.indexOf(allAnswers.energy)        + 1 : 0
    const q3 = qDefs[3] ? qDefs[3].options.indexOf(allAnswers.topic)         + 1 : 0
    const q4 = qDefs[4] ? qDefs[4].options.indexOf(allAnswers.coachingStyle) + 1 : 0

    let recommended = null
    if (q1 && q2 && q3 && q4) {
      try {
        const res = await onboardingApi.saveAll({ q1, q2, q3, q4 })
        recommended = res?.recommended_persona || null
      } catch (err) {
        console.error('[onboarding] saveAll 실패:', err)
      }
    }

    // 4. 페르소나 자동 설정 — Q4 답변 기반 또는 API 추천
    const personaToSave = recommended || Q4_TO_PERSONA[allAnswers.coachingStyle] || '공감형'
    const emoji = PERSONA_EMOJI[personaToSave] || '✨'

    setIsTyping(true)
    setTimeout(() => {
      addDali(
        recommended
          ? `달리가 분석한 결과,\n${emoji} ${recommended} 스타일이 잘 맞을 것 같아요!\n설정에서 언제든지 변경할 수 있어요 🌙`
          : `${emoji} ${personaToSave} 스타일로 달리를 설정했어요!\n설정에서 언제든지 변경할 수 있어요 🌙`
      )
      setIsTyping(false)
      setTimeout(() => {
        if (isAuthenticated) {
          setUser(prev => ({ ...prev, persona: personaToSave, onboarding_completed: true }))
          userApi.updatePersona(personaToSave).catch(err =>
            console.error('[onboarding] updatePersona failed:', err)
          )
        }
        if (returnEmotion) {
          navigate('/chat', { state: { emotion: returnEmotion } })
        } else {
          navigate('/main')
        }
      }, 2000)
    }, 800)
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
                <button
                  key={opt}
                  className={`ob-chip${opt === recommendedOpt ? ' ob-chip--recommended' : ''}`}
                  onClick={() => handleAnswer(opt)}
                >
                  {opt}
                  {opt === recommendedOpt && <span className="ob-chip-badge">추천</span>}
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
