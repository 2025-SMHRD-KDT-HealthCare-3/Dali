import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './Auth.css'
import Login from './Login'
import Signup from './Signup'
import daliLogoDark  from '../../assets/dark/달리로고.png'
import daliLogoLight from '../../assets/light/달리라이트로고.png'
import { useTheme } from '../../contexts/ThemeContext'
import ThemeToggle  from '../Public/ThemeToggle'
import StarBg       from '../Public/StarBg'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const Auth = () => {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  )
  const { isDark } = useTheme()

  return (
    <div className="auth-form-panel">

      <ThemeToggle className="auth-theme-toggle" />

      {/* 배경 장식 */}
      <StarBg bgClass="auth-bg" starClass="auth-star" positions={['as1','as2','as3','as4','as5','as6']} />

      <div className="auth-inner">

        <div className="auth-banner">
          <img src={isDark ? daliLogoDark : daliLogoLight} alt="Dali" className="auth-banner-img" />
          <button className="auth-back-btn" onClick={() => window.history.back()}>
            <BackIcon />
          </button>
        </div>

        <div className="auth-content">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              로그인
            </button>
            <button
              className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => setActiveTab('signup')}
            >
              회원가입
            </button>
          </div>

          {activeTab === 'login'
            ? <Login onTabChange={setActiveTab} />
            : <Signup onTabChange={setActiveTab} />
          }
        </div>

      </div>
    </div>
  )
}

export default Auth
