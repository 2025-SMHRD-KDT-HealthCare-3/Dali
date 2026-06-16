import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import { authApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'
import googleImg from '../../assets/public/구글.png'
import naverImg  from '../../assets/public/네이버.png'
import kakaoImg  from '../../assets/public/카카오.png'

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <polyline points="2,4 12,13 22,4" />
  </svg>
)

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const EyeIcon = ({ visible }) => visible ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login({ email: form.email, pwd: form.password })
      if (res.access_token) login(res.access_token, res.user)
      navigate(res.user?.onboarding_completed ? '/main' : '/onboarding')
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>

      <div className="input-row">
        <span className="input-icon"><MailIcon /></span>
        <input type="email" name="email" className="field-input"
          placeholder="이메일을 입력하세요"
          value={form.email} onChange={handleChange} autoComplete="email" />
      </div>

      <div className="input-row">
        <span className="input-icon"><LockIcon /></span>
        <input type={showPw ? 'text' : 'password'} name="password" className="field-input"
          placeholder="비밀번호를 입력하세요"
          value={form.password} onChange={handleChange} autoComplete="current-password" />
        <button type="button" className="eye-btn" onClick={() => setShowPw(!showPw)}>
          <EyeIcon visible={showPw} />
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="forgot-pw">
        <a href="#">비밀번호를 잊으셨나요?</a>
      </div>

      <button type="submit" className="btn-cta" disabled={loading}>
        <span className="sparkle">✦</span>
        {loading ? '로그인 중...' : '로그인'}
        <span className="sparkle">✦</span>
      </button>

      <div className="auth-divider"><span>또는</span></div>

      <div className="social-list">
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge google-badge">
            <img src={googleImg} alt="Google" />
          </span>
          <span className="social-label">Google로 계속하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge">
            <img src={naverImg} alt="Naver" />
          </span>
          <span className="social-label">Naver로 계속하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge">
            <img src={kakaoImg} alt="Kakao" />
          </span>
          <span className="social-label">Kakao로 계속하기</span>
        </button>
      </div>

    </form>
  )
}

export default Login
