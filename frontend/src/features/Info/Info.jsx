import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './info.css'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ThemeToggle from '../Public/ThemeToggle'
import { userApi } from '../../api/user'
import { onboardingApi } from '../../api/onboarding'
import { authApi } from '../../api/auth'

const GENDER_OPTS = ['여성', '남성', '응답 안 함']
const GENDER_TO_DB = { '여성': 'F', '남성': 'M' }
const GENDER_FROM_DB = { F: '여성', M: '남성' }

const ENERGY_OPTS = [
  '일상적인 일을 해낼 만큼 활력이 있어요',
  '생각이 많고 복잡해서 정신적인 에너지가 부족해요',
  '꼭 해야 할 일만 겨우 하거나 자꾸 미루게 돼요',
  '하루를 버티는 것도 힘들어요',
]

const TOPIC_OPTS = [
  '학업 및 진로 방향',
  '직장 업무와 성과',
  '가족, 친구, 연인 등 대인관계',
  '나 자신에 대한 성격이나 자존감',
  '특별한 고민은 없어요',
]

const COACHING_OPTS = [
  '친구처럼 편하게 이야기하고 싶어요',
  '복잡한 마음을 정리하고 싶어요',
  '작은 것부터 다시 시작하고 싶어요',
  '따뜻한 위로를 받고 싶어요',
]

const EMOTION_STATE_OPTS = [
  '생각이 많고 복잡해요',
  '마음이 조금 지쳐있어요',
  '아무것도 하기 싫어요',
  '편하게 이야기하고 싶어요',
]

// 백엔드 persona 값 기준
const PERSONAS = [
  { id: '공감형',     emoji: '🩷', name: '따뜻한 공감자', desc: '당신의 감정에 깊이 공감해드려요' },
  { id: '친구형',     emoji: '✨', name: '활기찬 친구',   desc: '밝고 유쾌하게 함께 힘내요' },
  { id: '분석형',     emoji: '🌿', name: '지혜로운 분석가', desc: '통찰 있는 조언으로 방향을 잡아드려요' },
  { id: '동기부여형', emoji: '🌙', name: '동기부여 코치', desc: '작은 것부터 다시 시작하도록 도와드려요' },
]

// 온보딩 질문 정의 (백엔드 전송용)
const OB_DEFS = [
  { question_no: 1, question: '요즘 당신의 마음은 어떤가요?',             key: 'emotionState',  opts: EMOTION_STATE_OPTS },
  { question_no: 2, question: '요즘 하루 에너지 수준은 어떤가요?',         key: 'energy',        opts: ENERGY_OPTS },
  { question_no: 3, question: '최근 가장 신경 쓰이는 영역은 무엇인가요?',  key: 'topic',         opts: TOPIC_OPTS },
  { question_no: 4, question: '달리와 어떤 시간을 보내고 싶나요?',         key: 'coachingStyle', opts: COACHING_OPTS },
]

const EyeIcon = ({ show }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {show ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
)

const Info = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user, setUser, logout } = useAuth()

  const [pageLoading, setPageLoading] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // 기본 정보
  const [nickname,  setNickname]  = useState('')
  const [gender,    setGender]    = useState('')
  const [birthdate, setBirthdate] = useState('')

  // 비밀번호 재설정
  const [pwSending, setPwSending] = useState(false)
  const [pwMsg,     setPwMsg]     = useState('')

  // 온보딩 정보
  const [emotionState,  setEmotionState]  = useState('')
  const [energy,        setEnergy]        = useState('')
  const [topic,         setTopic]         = useState('')
  const [coachingStyle, setCoachingStyle] = useState('')

  // 페르소나
  const [persona, setPersona] = useState('')

  // 회원탈퇴
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [withdrawing,         setWithdrawing]         = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await userApi.getMe()
        if (meRes.user) {
          const u = meRes.user
          setNickname(u.nick_name  || '')
          setGender(GENDER_FROM_DB[u.gender] || '')
          setBirthdate(u.birth_date ? u.birth_date.split('T')[0] : '')
          setPersona(u.persona     || '')
        }
      } catch {
        setError('사용자 정보를 불러오는 데 실패했습니다.')
      }

      // 온보딩 답변 로드
      try {
        const obRes = await onboardingApi.getAnswers()
        const list = Array.isArray(obRes?.onboarding) ? obRes.onboarding : []
        list.forEach(({ question_no, user_answer }) => {
          const idx = user_answer - 1
          if (question_no === 1 && EMOTION_STATE_OPTS[idx]) setEmotionState(EMOTION_STATE_OPTS[idx])
          if (question_no === 2 && ENERGY_OPTS[idx])        setEnergy(ENERGY_OPTS[idx])
          if (question_no === 3 && TOPIC_OPTS[idx])         setTopic(TOPIC_OPTS[idx])
          if (question_no === 4 && COACHING_OPTS[idx])      setCoachingStyle(COACHING_OPTS[idx])
        })
      } catch {}

      setPageLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // 기본 정보 저장 — 값이 있는 필드만 전송 (빈 문자열은 백엔드 validation 실패)
      const genderVal = GENDER_TO_DB[gender] || user?.gender || null
      const updatePayload = {}
      if (nickname  || user?.nick_name)  updatePayload.nick_name  = nickname  || user.nick_name
      if (genderVal) updatePayload.gender = genderVal
      const cleanBirth = birthdate
        ? birthdate.split('T')[0]
        : user?.birth_date ? user.birth_date.split('T')[0] : null
      if (cleanBirth) updatePayload.birth_date = cleanBirth
      if (Object.keys(updatePayload).length > 0) {
        await userApi.updateMe(updatePayload)
      }

      // 페르소나 저장
      if (persona && persona !== user?.persona) {
        await userApi.updatePersona(persona)
      }

      // 온보딩 답변 저장 (백엔드 B-3 upsert 구현 후 정상 동작)
      const obValues = { emotionState, energy, topic, coachingStyle }
      for (const def of OB_DEFS) {
        const val = obValues[def.key]
        if (!val) continue
        const optionIdx = def.opts.indexOf(val) + 1
        if (!optionIdx) continue
        try {
          await onboardingApi.saveAnswer({
            question_no: def.question_no,
            question:    def.question,
            exp_1: def.opts[0],
            exp_2: def.opts[1],
            exp_3: def.opts[2],
            exp_4: def.opts[3],
            exp_5: def.opts[4] || null,
            user_answer: optionIdx,
          })
        } catch {}
      }

      // AuthContext user 동기화
      setUser(prev => ({
        ...prev,
        nick_name:  nickname  || prev?.nick_name,
        gender:     genderVal || prev?.gender,
        birth_date: cleanBirth || prev?.birth_date,
        persona:    persona   || prev?.persona,
      }))

      setSuccess('저장되었습니다.')
      setTimeout(() => navigate(-1), 800)
    } catch (err) {
      setError(err.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!user?.email) return
    setPwSending(true)
    setPwMsg('')
    try {
      await authApi.requestPasswordReset(user.email)
      setPwMsg(`${user.email}로 재설정 링크를 발송했습니다.`)
    } catch {
      setPwMsg('발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setPwSending(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    try {
      await userApi.deleteMe()
      await logout()
      navigate('/')
    } catch {
      setError('회원탈퇴에 실패했습니다.')
      setWithdrawing(false)
      setShowWithdrawConfirm(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="info-screen">
        <div className="info-loading">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="info-screen">

      <div className="info-bg" aria-hidden="true">
        <span className="info-star is1">✦</span>
        <span className="info-star is2">✦</span>
        <span className="info-star is3">✦</span>
        <span className="info-star is4">✦</span>
        <span className="info-star is5">✦</span>
      </div>

      <ThemeToggle className="info-theme-toggle" />

      <div className="info-inner">

        {/* 헤더 */}
        <div className="info-header">
          <button className="info-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="info-hdr-title">개인정보 수정</h1>
          <div className="info-header-end" />
        </div>

        {/* ── 기본 정보 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">기본 정보</h2>

          <div className="info-field">
            <label className="info-label">닉네임</label>
            <input
              className="info-input"
              type="text"
              placeholder="닉네임을 입력해주세요"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
            />
          </div>

          <div className="info-field">
            <label className="info-label">성별</label>
            <div className="info-chips">
              {GENDER_OPTS.map(opt => (
                <button
                  key={opt}
                  className={`info-chip${gender === opt ? ' active' : ''}`}
                  onClick={() => setGender(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="info-field">
            <label className="info-label">생년월일</label>
            <input
              className="info-input"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={birthdate}
              onChange={e => setBirthdate(e.target.value)}
            />
          </div>
        </section>

        {/* ── 비밀번호 재설정 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">비밀번호 변경</h2>
          <p className="info-sec-desc">가입한 이메일({user?.email})로 재설정 링크를 보내드립니다.</p>
          <button
            className="info-pw-reset-btn"
            onClick={handlePasswordReset}
            disabled={pwSending}
          >
            {pwSending ? '발송 중...' : '비밀번호 재설정 이메일 받기'}
          </button>
          {pwMsg && <p className="info-pw-msg">{pwMsg}</p>}
        </section>

        {/* ── 온보딩 정보 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">온보딩 정보</h2>

          <div className="info-field">
            <label className="info-label">요즘 당신의 마음</label>
            <div className="info-chips info-chips--col">
              {EMOTION_STATE_OPTS.map(opt => (
                <button key={opt} className={`info-chip${emotionState === opt ? ' active' : ''}`} onClick={() => setEmotionState(opt)}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="info-field">
            <label className="info-label">하루 에너지 수준</label>
            <div className="info-chips info-chips--col">
              {ENERGY_OPTS.map(opt => (
                <button key={opt} className={`info-chip${energy === opt ? ' active' : ''}`} onClick={() => setEnergy(opt)}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="info-field">
            <label className="info-label">최근 신경 쓰이는 영역</label>
            <div className="info-chips info-chips--col">
              {TOPIC_OPTS.map(opt => (
                <button key={opt} className={`info-chip${topic === opt ? ' active' : ''}`} onClick={() => setTopic(opt)}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="info-field">
            <label className="info-label">달리와 보내고 싶은 시간</label>
            <div className="info-chips info-chips--col">
              {COACHING_OPTS.map(opt => (
                <button key={opt} className={`info-chip${coachingStyle === opt ? ' active' : ''}`} onClick={() => setCoachingStyle(opt)}>{opt}</button>
              ))}
            </div>
          </div>

        </section>

        {/* ── 달리 페르소나 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">달리 페르소나</h2>
          <p className="info-sec-desc">달리가 나와 대화하는 방식을 선택해주세요</p>
          <div className="info-personas">
            {PERSONAS.map(p => (
              <button
                key={p.id}
                className={`info-persona${persona === p.id ? ' active' : ''}`}
                onClick={() => setPersona(p.id)}
              >
                <span className="info-persona-emoji">{p.emoji}</span>
                <div className="info-persona-text">
                  <span className="info-persona-name">{p.name}</span>
                  <span className="info-persona-desc">{p.desc}</span>
                </div>
                {persona === p.id && <span className="info-persona-check">✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* 피드백 메시지 */}
        {error   && <p className="info-error">{error}</p>}
        {success && <p className="info-success">{success}</p>}

        {/* 저장 버튼 */}
        <button className="info-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장하기'}
        </button>

        {/* ── 로그아웃 ── */}
        <section className="info-section info-section--withdraw">
          <button
            className="info-logout-btn"
            onClick={async () => { await logout(); navigate('/') }}
          >
            로그아웃
          </button>
        </section>

        {/* ── 회원탈퇴 ── */}
        <section className="info-section info-section--withdraw">
          {!showWithdrawConfirm ? (
            <button className="info-withdraw-btn" onClick={() => setShowWithdrawConfirm(true)}>
              회원탈퇴
            </button>
          ) : (
            <div className="info-withdraw-confirm">
              <p className="info-withdraw-msg">정말 탈퇴하시겠어요? 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
              <div className="info-withdraw-actions">
                <button
                  className="info-withdraw-cancel"
                  onClick={() => setShowWithdrawConfirm(false)}
                  disabled={withdrawing}
                >
                  취소
                </button>
                <button
                  className="info-withdraw-confirm-btn"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                >
                  {withdrawing ? '처리 중...' : '탈퇴 확인'}
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

export default Info
