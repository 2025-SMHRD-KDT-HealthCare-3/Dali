import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Signup.css'
import { authApi } from '../../api/auth'
import { setAccessToken } from '../../api/client'
import googleImg from '../../assets/public/구글.png'
import naverImg  from '../../assets/public/네이버.png'
import kakaoImg  from '../../assets/public/카카오.png'

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
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" /><polyline points="2,4 12,13 22,4" />
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const EyeIcon = ({ visible }) => visible ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const Signup = () => {
  const navigate = useNavigate()
  const [showPw, setShowPw]             = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [emailChecked, setEmailChecked] = useState(false)
  const [agreed, setAgreed]             = useState(false)
  const [form, setForm] = useState({
    nickname: '', birthDay: '', birthMonth: '', birthYear: '',
    gender: '', email: '', password: '', confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

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
    if (form.password.length < 8)                              e.password = '비밀번호는 8자 이상이어야 합니다.'
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
      const res = await authApi.signup({
        email: form.email,
        pwd: form.password,
        nick_name: form.nickname,
        gender: form.gender,
        birth_date,
        terms_agreed: true,
      })
      if (res.access_token) setAccessToken(res.access_token)
      navigate('/login')
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
          <EyeIcon visible={showPw} />
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
          <EyeIcon visible={showConfirm} />
        </button>
      </div>
      {errors.confirm && <p className="form-error">{errors.confirm}</p>}

      {/* 이용약관 */}
      <label className="terms-row" onClick={() => { setAgreed(!agreed); setErrors(err => ({ ...err, agreed: '' })) }}>
        <div className={`terms-check ${agreed ? 'checked' : ''}`}>
          {agreed && <CheckIcon />}
        </div>
        <span>
          <a href="#" onClick={e => e.stopPropagation()}>이용약관</a> 및{' '}
          <a href="#" onClick={e => e.stopPropagation()}>개인정보 처리방침</a>에 동의합니다
        </span>
      </label>
      {errors.agreed && <p className="form-error">{errors.agreed}</p>}
      {errors.submit && <p className="form-error">{errors.submit}</p>}

      {/* 회원가입 버튼 */}
      <button type="submit" className="btn-cta" disabled={loading}>
        <span className="sparkle">✦</span>
        {loading ? '가입 중...' : '회원가입'}
        <span className="sparkle">✦</span>
      </button>

      {/* 소셜 */}
      <div className="auth-divider"><span>또는</span></div>
      <div className="social-list">
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge google-badge"><img src={googleImg} alt="Google" /></span>
          <span className="social-label">Google로 시작하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge"><img src={naverImg} alt="Naver" /></span>
          <span className="social-label">Naver로 시작하기</span>
        </button>
        <button type="button" className="btn-social" onClick={() => {}}>
          <span className="social-badge"><img src={kakaoImg} alt="Kakao" /></span>
          <span className="social-label">Kakao로 시작하기</span>
        </button>
      </div>

    </form>
  )
}

export default Signup
