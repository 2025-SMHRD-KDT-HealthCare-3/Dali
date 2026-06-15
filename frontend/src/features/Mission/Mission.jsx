import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './mission.css'
import daliImg      from '../../assets/public/조개탑쌓기.png'
import daliNightImg from '../../assets/dark/달리 이미지 (2).png'
import pl1Dark  from '../../assets/dark/플레이리스트1.png'
import pl2Dark  from '../../assets/dark/플레이리스트2.png'
import pl1Light from '../../assets/light/플레이리스트1라이트.png'
import pl2Light from '../../assets/light/플레이리스트2라이트.png'
import { useTheme }  from '../../contexts/ThemeContext'
import ThemeToggle   from '../Public/ThemeToggle'

const BEHAVIOR_MISSIONS_INIT = [
  { id: 1, emoji: '🌙', color: '#9B7EFF', bg: 'rgba(155,126,255,0.18)', title: '8시간 숙면하기',        sub: '어젯밤 11:30 취침 완료',  done: true  },
  { id: 2, emoji: '🧘', color: '#E8A87C', bg: 'rgba(232,168,124,0.18)', title: '명상 10분 즐기기',       sub: '평온한 호흡에 집중해요',  done: true  },
  { id: 3, emoji: '💧', color: '#7BCCE8', bg: 'rgba(123,204,232,0.18)', title: '물 한 잔 천천히 마시기', sub: '현재 1.2L 섭취 중',      done: false },
]

const MUSIC_MISSIONS_INIT = [
  { id: 4, title: '잔잔한 명상 음악 듣기',     sub: '마음을 차분하게 가라앉혀요', done: false },
  { id: 5, title: '달리가 추천하는 힐링 영상', sub: '오늘 하루 수고했어요',       done: false },
]

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const Mission = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [behaviorMissions, setBehaviorMissions] = useState(BEHAVIOR_MISSIONS_INIT)
  const [musicMissions,    setMusicMissions]    = useState(MUSIC_MISSIONS_INIT)
  const [justAdded,        setJustAdded]        = useState(null)
  const [toastVisible,     setToastVisible]     = useState(false)
  const toastTimerRef   = useRef(null)
  const justAddedTimerRef = useRef(null)

  const showToast = () => {
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2500)
  }

  const toggleBehavior = (id) => {
    const mission = behaviorMissions.find(m => m.id === id)
    if (!mission.done) {
      const currentDone = behaviorMissions.filter(m => m.done).length
      setJustAdded(currentDone)
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current)
      justAddedTimerRef.current = setTimeout(() => setJustAdded(null), 700)
      showToast()
    }
    setBehaviorMissions(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m))
  }

  const toggleMusic = (id) =>
    setMusicMissions(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m))

  const behaviorDone  = behaviorMissions.filter(m => m.done).length
  const behaviorTotal = behaviorMissions.length
  const musicDone     = musicMissions.filter(m => m.done).length
  const musicTotal    = musicMissions.length

  const plImgs = isDark ? [pl1Dark, pl2Dark] : [pl1Light, pl2Light]

  return (
    <div className="mission-screen">

      <div className="mission-bg" aria-hidden="true">
        <span className="ms-star st1">✦</span>
        <span className="ms-star st2">✦</span>
        <span className="ms-star st3">✦</span>
        <span className="ms-star st4">✦</span>
        <span className="ms-star st5">✦</span>
        <span className="ms-star st6">✦</span>
      </div>

      <ThemeToggle className="mission-theme-toggle" />

      <div className="mission-inner">

        {/* 헤더 */}
        <div className="mission-header">
          <button className="mission-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="mission-hdr-title">미션</h1>
          <div className="mission-header-end" />
        </div>

        {/* ─── 기본 행동 미션 ─── */}

        {/* 제목 + 진행률 */}
        <div className="behavior-title-row">
          <h2 className="behavior-title">
            오늘의 <span className="mission-title-accent">회복 미션</span>
            <span className="mission-title-spark"> ✦</span>
          </h2>
          <span className="behavior-count">{behaviorDone} / {behaviorTotal} 완료</span>
        </div>

        {/* 조개탑 스테이지 */}
        <div className="shell-stage">
          <span className="shell-bg-star sbs1">✦</span>
          <span className="shell-bg-star sbs2">✦</span>
          <span className="shell-bg-star sbs3">✦</span>

          <div className="shell-tower-wrap">
            <div className="shell-tower">
              {[...Array(behaviorDone)].map((_, i) => (
                <span
                  key={i}
                  className={`shell-item${i === justAdded ? ' just-added' : ''}`}
                >
                  🐚
                </span>
              ))}
            </div>
            {behaviorDone === 0 && (
              <p className="shell-empty-hint">미션을 완료하면<br />조개가 쌓여요</p>
            )}
          </div>

          <img src={daliImg} alt="달리" className="stage-dali-img" />
        </div>

        {/* 토스트 */}
        {toastVisible && (
          <div className="shell-toast">🐚 작은 회복 하나가 쌓였어요</div>
        )}

        {/* 미션 목록 */}
        <div className="mission-list">
          {behaviorMissions.map(m => (
            <div key={m.id} className={`mission-item${m.done ? ' is-done' : ''}`}>
              <div className="mission-icon-wrap" style={{ background: m.bg }}>
                <span className="mission-emoji">{m.emoji}</span>
              </div>
              <div className="mission-item-text">
                <span className="mission-item-title">{m.title}</span>
                <span className="mission-item-sub">{m.sub}</span>
              </div>
              <button
                className={`mission-check${m.done ? ' is-done' : ''}`}
                onClick={() => toggleBehavior(m.id)}
                aria-label={m.done ? '완료 취소' : '완료'}
              >
                {m.done && <CheckIcon />}
              </button>
            </div>
          ))}
        </div>

        {/* ─── 음악 / 영상 ─── */}

        <div className="mission-music-banner">
          <img src={isDark ? pl2Dark : pl2Light} alt="" className="mission-music-banner-img" />
          <div className="mission-music-badge">❤️ {musicDone} / {musicTotal}</div>
        </div>

        <p className="mission-section-hdr">추천 플레이리스트 및 영상</p>

        <div className="mission-music-list">
          {musicMissions.map((m, i) => (
            <div key={m.id} className={`mission-music-item${m.done ? ' is-done' : ''}`}>
              <div className="mission-music-thumb">
                <img src={plImgs[i]} alt="" className="mission-music-thumb-img" />
              </div>
              <div className="mission-item-text">
                <span className="mission-item-title">{m.title}</span>
                <span className="mission-item-sub">{m.sub}</span>
              </div>
              <button
                className={`mission-play-btn${m.done ? ' is-done' : ''}`}
                onClick={() => toggleMusic(m.id)}
                aria-label="재생"
              >
                <PlayIcon />
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

export default Mission
