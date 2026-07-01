import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './splash.css'
import moonImg        from '../../assets/public/달.png'
import darkIntroVideo  from '../../assets/dark/인트로영상 다크모드.mp4'
import lightIntroVideo from '../../assets/light/인트로영상 라이트모드.mp4'
import posterDark      from '../../assets/dark/시작화면3다크.png'
import posterLight     from '../../assets/light/시작화면3화이트.png'
import { useTheme }    from '../../contexts/ThemeContext'
import ThemeToggle     from '../Public/ThemeToggle'
import StarBg          from '../Public/StarBg'
import { LockIcon }    from '../Public/Icons'

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const Splash = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  // 'intro' | 'exiting' | 'done'
  const [phase, setPhase]               = useState('intro')
  const [contentReady, setContentReady] = useState(false)
  const [cardStyle, setCardStyle]       = useState({})

  const videoRef = useRef(null)
  const cardRef  = useRef(null)
  const timerRef = useRef(null)

  const introVideo = isDark ? darkIntroVideo : lightIntroVideo
  const poster     = isDark ? posterDark : posterLight

  const startTransition = useCallback(() => {
    if (phase !== 'intro') return

    const panelEl = document.querySelector('.lp-panel')
    const isMobile = !panelEl || getComputedStyle(panelEl).display === 'none'

    if (!isMobile && cardRef.current && panelEl) {
      const cardRect  = cardRef.current.getBoundingClientRect()
      const panelRect = panelEl.getBoundingClientRect()

      const tx    = panelRect.left + panelRect.width  / 2 - (cardRect.left + cardRect.width  / 2)
      const ty    = panelRect.top  + panelRect.height / 2 - (cardRect.top  + cardRect.height / 2)
      const scale = panelRect.height / cardRect.height

      setCardStyle({ transform: `translate(${tx}px, ${ty}px) scale(${scale})` })
    }

    setPhase('exiting')

    const contentDelay = isMobile ? 50  : 500
    const doneDelay    = isMobile ? 600 : 2200

    timerRef.current = setTimeout(() => setContentReady(true), contentDelay)
    timerRef.current = setTimeout(() => setPhase('done'), doneDelay)
  }, [phase])

  const handleSkip = useCallback(() => {
    if (phase === 'done') return
    if (videoRef.current) videoRef.current.pause()
    clearTimeout(timerRef.current)
    setContentReady(true)
    setPhase('done')
  }, [phase])

  // 키보드 skip (Escape / Enter / Space)
  useEffect(() => {
    if (phase !== 'intro') return
    const onKey = (e) => {
      if (['Escape', 'Enter', ' '].includes(e.key)) handleSkip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handleSkip])

  // 영상 미로드 / 재생 실패 대비 최대 대기 8초
  useEffect(() => {
    if (phase !== 'intro') return
    const fallback = setTimeout(startTransition, 8000)
    return () => clearTimeout(fallback)
  }, [phase, startTransition])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div className="splash-screen">

      <ThemeToggle className="splash-theme-toggle" />

      <StarBg bgClass="splash-bg" starClass="splash-star" positions={['ss1','ss2','ss3','ss4','ss5','ss6']}>
        <img src={moonImg} alt="" className="splash-moon" />
      </StarBg>

      {/* 오른쪽 시작화면 — 전환 중 fade-in */}
      <div className={`splash-inner${contentReady || phase === 'done' ? ' sp-content-visible' : ''}`}>
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

      {/* 인트로 오버레이 */}
      {phase !== 'done' && (
        <div className={`splash-intro-overlay${phase === 'exiting' ? ' is-exiting' : ''}`}>

          <div
            ref={cardRef}
            className="splash-intro-card-wrap"
            style={cardStyle}
          >
            <div className="splash-intro-card">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onEnded={startTransition}
                poster={poster}
              >
                <source src={introVideo} type="video/mp4" />
              </video>
            </div>
          </div>

          <button className="splash-skip-btn" onClick={handleSkip}>
            건너뛰기
          </button>

        </div>
      )}

    </div>
  )
}

export default Splash
