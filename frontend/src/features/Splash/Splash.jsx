import React from 'react'
import { useNavigate } from 'react-router-dom'
import './splash.css'
import moonImg from '../../assets/public/달.png'
import { useTheme } from '../../contexts/ThemeContext'
import ThemeToggle from '../Public/ThemeToggle'
import StarBg     from '../Public/StarBg'

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const LockIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const Splash = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  return (
    <div className="splash-screen">

      <ThemeToggle className="splash-theme-toggle" />

      {/* 배경 장식 */}
      <StarBg bgClass="splash-bg" starClass="splash-star" positions={['ss1','ss2','ss3','ss4','ss5','ss6']}>
        <img src={moonImg} alt="" className="splash-moon" />
      </StarBg>

      <div className="splash-inner">
        <div className="splash-content">
          <div className="splash-badge">✦ Dali 시작하기 ✦</div>

          <h1 className="splash-heading">
            오늘의 감정을<br />
            <span className="splash-accent">Dali</span>에게 말해볼까요?
          </h1>

          <p className="splash-sub">
            로그인 없이도 바로 대화를 시작할 수 있어요.<br />
            기록을 저장하고 싶다면 로그인 후 이용해 주세요.
          </p>

          <div className="splash-actions">
            <button className="splash-btn-primary" onClick={() => navigate('/main')}>
              <ChatIcon />
              바로 대화 시작하기
            </button>

            <button className="splash-btn-secondary" onClick={() => navigate('/auth')}>
              <LockIcon />
              로그인하고 기록 저장하기
            </button>
          </div>

          <div className="splash-footer">
            <button className="splash-signup-link" onClick={() => navigate('/auth?tab=signup')}>
              회원가입 &gt;
            </button>
            <p className="splash-info">
              <span className="splash-info-icon">ⓘ</span>
              비회원 체험 후에도 로그인하여 감정 기록을 저장할 수 있어요.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Splash
