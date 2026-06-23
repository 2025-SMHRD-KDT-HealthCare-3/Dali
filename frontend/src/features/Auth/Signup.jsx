import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Signup.css'
import { authApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'
import googleImg from '../../assets/public/구글.png'
import naverImg  from '../../assets/public/네이버.png'
import kakaoImg  from '../../assets/public/카카오.png'
import { MailIcon, LockIcon, EyeIcon, CheckIcon } from '../Public/Icons'

// 소셜 로그인은 Vite proxy 우회해서 백엔드 직접 호출 (Docker/로컬 모두 localhost:3000)
const SOCIAL_BASE = import.meta.env.VITE_SOCIAL_BASE || import.meta.env.VITE_API_URL || ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const Signup = ({ onTabChange }) => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPw, setShowPw]             = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [emailChecked, setEmailChecked] = useState(false)
  const [agreed, setAgreed]             = useState(false)
  const [form, setForm] = useState({
    nickname: '', birthDay: '', birthMonth: '', birthYear: '',
    gender: '', email: '', password: '', confirm: '',
  })
  const [errors,       setErrors]       = useState({})
  const [loading,      setLoading]      = useState(false)
  const [signupDone,   setSignupDone]   = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value
    if (name === 'birthDay')   v = value.replace(/\D/g, '').slice(0, 2)
    if (name === 'birthMonth') v = value.replace(/\D/g, '').slice(0, 2)
    if (name === 'birthYear')  v = value.replace(/\D/g, '').slice(0, 4)
    if (name === 'email') setEmailChecked(false)
    setForm(f => ({ ...f, [name]: v }))
    setErrors(err => ({ ...err, [name]: '' }))
  }

  const handleEmailCheck = async () => {
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
      setErrors(err => ({ ...err, email: '올바른 이메일을 입력해주세요.' }))
      return
    }
    try {
      const res = await authApi.checkEmail(form.email)
      if (res.is_duplicate) {
        setErrors(err => ({ ...err, email: '이미 사용중인 이메일입니다.' }))
      } else {
        setEmailChecked(true)
        setErrors(err => ({ ...err, email: '' }))
      }
    } catch {
      setErrors(err => ({ ...err, email: '중복 확인 중 오류가 발생했습니다.' }))
    }
  }

  const validate = () => {
    const e = {}
    if (!form.nickname)                                        e.nickname = '닉네임을 입력해주세요.'
    if (!form.birthDay || !form.birthMonth || !form.birthYear) e.birth    = '생년월일을 입력해주세요.'
    if (!form.gender)                                          e.gender   = '성별을 선택해주세요.'
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email))      e.email    = '올바른 이메일을 입력해주세요.'
    else if (!emailChecked)                                    e.email    = '이메일 중복확인을 해주세요.'
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/.test(form.password)) e.password = '비밀번호는 영문과 숫자를 포함한 8자 이상이어야 합니다.'
    if (form.password !== form.confirm)                        e.confirm  = '비밀번호가 일치하지 않습니다.'
    if (!agreed)                                               e.agreed   = '이용약관에 동의해주세요.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const birth_date = `${form.birthYear}-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}`

    setLoading(true)
    try {
      await authApi.signup({
        email: form.email,
        pwd: form.password,
        nick_name: form.nickname,
        gender: form.gender,
        birth_date,
        terms_agreed: true,
      })
      setSignupDone(true)
      setTimeout(() => onTabChange?.('login'), 1800)
    } catch (err) {
      setErrors(e => ({ ...e, submit: err.message || '회원가입에 실패했습니다.' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>

      {/* 닉네임 */}
      <div className="input-row">
        <span className="input-icon"><UserIcon /></span>
        <input type="text" name="nickname" className="field-input"
          placeholder="닉네임을 입력하세요"
          value={form.nickname} onChange={handleChange} autoComplete="nickname" />
      </div>
      {errors.nickname && <p className="form-error">{errors.nickname}</p>}

      {/* 생년월일 */}
      <div className="field-group-label">
        <span className="input-icon"><CalendarIcon /></span>
        <span className="field-group-text">생년월일</span>
      </div>
      <div className="birth-row">
        <div className="input-row birth-input birth-year">
          <input type="text" name="birthYear" className="field-input text-center"
            placeholder="YYYY" value={form.birthYear} onChange={handleChange} inputMode="numeric" />
        </div>
        <div className="input-row birth-input">
          <input type="text" name="birthMonth" className="field-input text-center"
            placeholder="MM" value={form.birthMonth} onChange={handleChange} inputMode="numeric" />
        </div>
        <div className="input-row birth-input">
          <input type="text" name="birthDay" className="field-input text-center"
            placeholder="DD" value={form.birthDay} onChange={handleChange} inputMode="numeric" />
        </div>
      </div>
      {errors.birth && <p className="form-error">{errors.birth}</p>}

      {/* 성별 */}
      <div className="gender-row">
        <label className="gender-option">
          <input type="radio" name="gender" value="M"
            checked={form.gender === 'M'} onChange={handleChange} />
          <span className="gender-radio" />
          남
        </label>
        <label className="gender-option">
          <input type="radio" name="gender" value="F"
            checked={form.gender === 'F'} onChange={handleChange} />
          <span className="gender-radio" />
          여
        </label>
      </div>
      {errors.gender && <p className="form-error">{errors.gender}</p>}

      {/* 이메일 + 중복확인 */}
      <div className={`input-row ${emailChecked ? 'input-valid' : ''}`}>
        <span className="input-icon"><MailIcon /></span>
        <input type="email" name="email" className="field-input"
          placeholder="이메일을 입력하세요"
          value={form.email} onChange={handleChange} autoComplete="email" />
        <button type="button"
          className={`btn-inline ${emailChecked ? 'btn-inline-done' : ''}`}
          onClick={handleEmailCheck}>
          {emailChecked ? '확인됨' : '중복확인'}
        </button>
      </div>
      {errors.email && <p className="form-error">{errors.email}</p>}
      {emailChecked && <p className="form-success">사용 가능한 이메일입니다.</p>}

      {/* 비밀번호 */}
      <div className="input-row">
        <span className="input-icon"><LockIcon /></span>
        <input type={showPw ? 'text' : 'password'} name="password" className="field-input"
          placeholder="비밀번호 (8자 이상)"
          value={form.password} onChange={handleChange} autoComplete="new-password" />
        <button type="button" className="eye-btn" onClick={() => setShowPw(!showPw)}>
          <EyeIcon show={showPw} />
        </button>
      </div>
      {errors.password && <p className="form-error">{errors.password}</p>}

      {/* 비밀번호 확인 */}
      <div className="input-row">
        <span className="input-icon"><LockIcon /></span>
        <input type={showConfirm ? 'text' : 'password'} name="confirm" className="field-input"
          placeholder="비밀번호 확인"
          value={form.confirm} onChange={handleChange} autoComplete="new-password" />
        <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
          <EyeIcon show={showConfirm} />
        </button>
      </div>
      {errors.confirm && <p className="form-error">{errors.confirm}</p>}

      {/* 이용약관 */}
      <label className="terms-row" onClick={() => { setAgreed(!agreed); setErrors(err => ({ ...err, agreed: '' })) }}>
        <div className={`terms-check ${agreed ? 'checked' : ''}`}>
          {agreed && <CheckIcon size={12} strokeColor="white" />}
        </div>
        <span>
          <a href="#" onClick={e => e.stopPropagation()}>이용약관</a> 및{' '}
          <a href="#" onClick={e => e.stopPropagation()}>개인정보 처리방침</a>에 동의합니다
        </span>
      </label>
      {errors.agreed && <p className="form-error">{errors.agreed}</p>}
      {errors.submit && <p className="form-error">{errors.submit}</p>}
      {signupDone && <p className="form-success">가입이 완료됐어요! 로그인해주세요 🌙</p>}

      {/* 회원가입 버튼 */}
      <button type="submit" className="btn-cta" disabled={loading || signupDone}>
        <span className="sparkle">✦</span>
        {loading ? '가입 중...' : '회원가입'}
        <span className="sparkle">✦</span>
      </button>

      {/* 소셜 */}
      <div className="auth-divider"><span>또는</span></div>
      <div className="social-list">
        <button type="button" className="btn-social" onClick={() => {
          window.location.href = `${SOCIAL_BASE}/api/auth/naver`
        }}>
          <span className="social-badge"><img src={naverImg} alt="Naver" /></span>
          <span className="social-label">Naver로 시작하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {
          window.location.href = `${SOCIAL_BASE}/api/auth/kakao`
        }}>
          <span className="social-badge"><img src={kakaoImg} alt="Kakao" /></span>
          <span className="social-label">Kakao로 시작하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {
          if (!GOOGLE_CLIENT_ID || !window.google) {
            setErrors(e => ({ ...e, submit: 'Google 로그인을 사용할 수 없습니다.' }))
            return
          }
          window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: async (tokenResponse) => {
              if (!tokenResponse.access_token) return
              setLoading(true)
              try {
                const res = await authApi.googleLogin({ access_token: tokenResponse.access_token })
                login(res.access_token, res.user)
                navigate(res.user?.onboarding_completed ? '/main' : '/onboarding')
              } catch (err) {
                setErrors(e => ({ ...e, submit: err.message || 'Google 로그인에 실패했습니다.' }))
              } finally {
                setLoading(false)
              }
            },
          }).requestAccessToken()
        }}>
          <span className="social-badge google-badge"><img src={googleImg} alt="Google" /></span>
          <span className="social-label">Google로 시작하기</span>
        </button>
      </div>

    </form>
  )
}

export default Signup
