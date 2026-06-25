import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './info.css'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ThemeToggle from '../Public/ThemeToggle'
import StarBg     from '../Public/StarBg'
import { userApi } from '../../api/user'
import { authApi } from '../../api/auth'

const GENDER_OPTS = ['여성', '남성', '응답 안 함']
const GENDER_TO_DB = { '여성': 'F', '남성': 'M' }
const GENDER_FROM_DB = { F: '여성', M: '남성' }

// 백엔드 persona 값 기준
const PERSONAS = [
  { id: '공감형',     emoji: '🩷', name: '따뜻한 공감자', desc: '당신의 감정에 깊이 공감해드려요' },
  { id: '친구형',     emoji: '✨', name: '활기찬 친구',   desc: '밝고 유쾌하게 함께 힘내요' },
  { id: '분석형',     emoji: '🌿', name: '지혜로운 분석가', desc: '통찰 있는 조언으로 방향을 잡아드려요' },
  { id: '동기부여형', emoji: '🌙', name: '동기부여 코치', desc: '작은 것부터 다시 시작하도록 도와드려요' },
]


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

      setUser(prev => ({
        ...prev,
        nick_name:  nickname   || prev?.nick_name,
        gender:     genderVal  || prev?.gender,
        birth_date: cleanBirth || prev?.birth_date,
        persona:    persona    || prev?.persona,
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

      <StarBg bgClass="info-bg" starClass="info-star" positions={['is1','is2','is3','is4','is5']} />

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

        {/* ── 로그아웃 + 회원탈퇴 ── */}
        <section className="info-section info-section--withdraw">
          {!showWithdrawConfirm ? (
            <div className="info-account-actions">
              <button
                className="info-logout-btn"
                onClick={async () => { await logout(); navigate('/') }}
              >
                로그아웃
              </button>
              <button className="info-withdraw-btn" onClick={() => setShowWithdrawConfirm(true)}>
                회원탈퇴
              </button>
            </div>
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
