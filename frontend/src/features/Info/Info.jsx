import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './info.css'
import { useTheme } from '../../contexts/ThemeContext'
import ThemeToggle from '../Public/ThemeToggle'

const GENDER_OPTS = ['여성', '남성', '응답 안 함']

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

const TIME_OPTS = ['아침', '낮', '저녁', '밤']

const PERSONAS = [
  { id: 'calm',   emoji: '🌙', name: '차분한 상담사', desc: '조용하고 따뜻하게 감정을 들어드려요' },
  { id: 'friend', emoji: '✨', name: '활기찬 친구',   desc: '밝고 유쾌하게 함께 힘내요' },
  { id: 'mentor', emoji: '🌿', name: '지혜로운 멘토', desc: '통찰 있는 조언으로 방향을 잡아드려요' },
  { id: 'empath', emoji: '🩷', name: '따뜻한 공감자', desc: '당신의 감정에 깊이 공감해드려요' },
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

  const [nickname,  setNickname]  = useState('')
  const [gender,    setGender]    = useState('')
  const [birthdate, setBirthdate] = useState('')

  const [currPw,    setCurrPw]    = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurr,  setShowCurr]  = useState(false)
  const [showNew,   setShowNew]   = useState(false)
  const [showConf,  setShowConf]  = useState(false)

  const [energy,        setEnergy]        = useState('')
  const [topic,         setTopic]         = useState('')
  const [coachingStyle, setCoachingStyle] = useState('')
  const [checkinTime,   setCheckinTime]   = useState('')

  const [persona, setPersona] = useState('')

  const handleSave = () => {
    // TODO: API 연동
    navigate(-1)
  }

  const PW_FIELDS = [
    { label: '현재 비밀번호', val: currPw,    set: setCurrPw,    show: showCurr, setShow: setShowCurr,  ph: '현재 비밀번호를 입력해주세요' },
    { label: '새 비밀번호',   val: newPw,     set: setNewPw,     show: showNew,  setShow: setShowNew,   ph: '새 비밀번호를 입력해주세요' },
    { label: '비밀번호 확인', val: confirmPw, set: setConfirmPw, show: showConf, setShow: setShowConf,  ph: '새 비밀번호를 한 번 더 입력해주세요' },
  ]

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

        {/* ── 비밀번호 변경 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">비밀번호 변경</h2>

          {PW_FIELDS.map(({ label, val, set, show, setShow, ph }) => (
            <div key={label} className="info-field">
              <label className="info-label">{label}</label>
              <div className="info-pw-wrap">
                <input
                  className="info-input"
                  type={show ? 'text' : 'password'}
                  placeholder={ph}
                  value={val}
                  onChange={e => set(e.target.value)}
                />
                <button className="info-eye" type="button" onClick={() => setShow(s => !s)} aria-label="비밀번호 보기">
                  <EyeIcon show={show} />
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ── 온보딩 정보 ── */}
        <section className="info-section">
          <h2 className="info-sec-title">온보딩 정보</h2>

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

          <div className="info-field">
            <label className="info-label">체크인 시간대</label>
            <div className="info-chips">
              {TIME_OPTS.map(opt => (
                <button key={opt} className={`info-chip${checkinTime === opt ? ' active' : ''}`} onClick={() => setCheckinTime(opt)}>{opt}</button>
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

        {/* 저장 버튼 */}
        <button className="info-save-btn" onClick={handleSave}>
          저장하기
        </button>

      </div>
    </div>
  )
}

export default Info
