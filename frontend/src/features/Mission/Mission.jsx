import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './mission.css'
import daliImg      from '../../assets/public/조개탑쌓기.png'
import shellVideo   from '../../assets/public/조개1.mp4'
import pl1Dark  from '../../assets/dark/플레이리스트1.png'
import pl2Dark  from '../../assets/dark/플레이리스트2.png'
import pl1Light from '../../assets/light/플레이리스트1라이트.png'
import pl2Light from '../../assets/light/플레이리스트2라이트.png'
import musicDark  from '../../assets/dark/음악달리다크.png'
import videoDark  from '../../assets/dark/영상달리다크.png'
import musicLight from '../../assets/light/음악달리라이트.png'
import videoLight from '../../assets/light/영상달리라이트.png'
import { useTheme }    from '../../contexts/ThemeContext'
import { useAuth }     from '../../contexts/AuthContext'
import ThemeToggle     from '../Public/ThemeToggle'
import StarBg         from '../Public/StarBg'
import { missionApi }  from '../../api/missions'

const SEQ_STYLE = [
  { emoji: '🌙', color: '#9B7EFF', bg: 'rgba(155,126,255,0.18)' },
  { emoji: '🧘', color: '#E8A87C', bg: 'rgba(232,168,124,0.18)' },
  { emoji: '💧', color: '#7BCCE8', bg: 'rgba(123,204,232,0.18)' },
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

const Mission = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAuthenticated } = useAuth()

  const [missions,       setMissions]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [justAdded,      setJustAdded]      = useState(null)
  const [toastVisible,   setToastVisible]   = useState(false)
  const toastTimerRef     = useRef(null)
  const justAddedTimerRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    missionApi.getMissions()
      .then(res => setMissions(res.missions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const showToast = () => {
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2500)
  }

  const toggleMission = async (mission_id) => {
    const mission = missions.find(m => m.mission_id === mission_id)
    if (!mission || mission.is_completed === 'Y') return

    const doneBefore = missions.filter(m => m.is_completed === 'Y').length
    setJustAdded(doneBefore)
    if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current)
    justAddedTimerRef.current = setTimeout(() => setJustAdded(null), 700)
    showToast()

    setMissions(prev => prev.map(m => m.mission_id === mission_id ? { ...m, is_completed: 'Y' } : m))
    try {
      await missionApi.completeMission(mission_id)
    } catch {
      setMissions(prev => prev.map(m => m.mission_id === mission_id ? { ...m, is_completed: 'N' } : m))
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const behaviorMissions = missions.filter(m => m.mission_date?.slice(0, 10) === today && m.mission_seq <= 3)
  const behaviorDone     = behaviorMissions.filter(m => m.is_completed === 'Y').length
  const behaviorTotal    = behaviorMissions.length
  const plImgs           = isDark ? [musicDark, videoDark] : [musicLight, videoLight]

  return (
    <div className="mission-screen">

      <StarBg bgClass="mission-bg" starClass="ms-star" positions={['st1','st2','st3','st4','st5','st6']} />

      <ThemeToggle className="mission-theme-toggle" />

      <div className="mission-inner">

        <div className="mission-header">
          <button className="mission-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="mission-hdr-title">미션</h1>
          <div className="mission-header-end" />
        </div>

        <div className="behavior-title-row">
          <h2 className="behavior-title">
            오늘의 <span className="mission-title-accent">회복 미션</span>
            <span className="mission-title-spark"> ✦</span>
          </h2>
          {!loading && <span className="behavior-count">{behaviorDone} / {behaviorTotal} 완료</span>}
        </div>

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
            {behaviorDone === 0 && !loading && (
              <p className="shell-empty-hint">미션을 완료하면<br />조개가 쌓여요</p>
            )}
          </div>

          <video
            src={shellVideo}
            className="stage-dali-img"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        {toastVisible && (
          <div className="shell-toast">🐚 작은 회복 하나가 쌓였어요</div>
        )}

        {loading ? (
          <div className="mission-list">
            <p style={{ textAlign: 'center', opacity: 0.5, padding: '24px 0' }}>불러오는 중...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="mission-list">
            <p style={{ textAlign: 'center', opacity: 0.5, padding: '24px 0' }}>로그인 후 미션을 확인할 수 있어요</p>
          </div>
        ) : missions.length === 0 ? (
          <div className="mission-list">
            <p style={{ textAlign: 'center', opacity: 0.5, padding: '24px 0' }}>달리와 대화를 마치면 미션이 생겨요 🌙</p>
          </div>
        ) : (
          <div className="mission-list">
            {behaviorMissions.map((m) => {
              const style = SEQ_STYLE[(m.mission_seq - 1) % SEQ_STYLE.length] || SEQ_STYLE[0]
              const done  = m.is_completed === 'Y'
              return (
                <div key={m.mission_id} className={`mission-item${done ? ' is-done' : ''}`}>
                  <div className="mission-icon-wrap" style={{ background: style.bg }}>
                    <span className="mission-emoji">{style.emoji}</span>
                  </div>
                  <div className="mission-item-text">
                    <span className="mission-item-title">{m.mission_content}</span>
                  </div>
                  <button
                    className={`mission-check${done ? ' is-done' : ''}`}
                    onClick={() => toggleMission(m.mission_id)}
                    aria-label={done ? '완료됨' : '완료'}
                    disabled={done}
                  >
                    {done && <CheckIcon />}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mission-music-banner">
          <img src={isDark ? pl2Dark : pl2Light} alt="" className="mission-music-banner-img" />
        </div>

        <p className="mission-section-hdr">추천 플레이리스트 및 영상</p>

        <div className="mission-music-list">
          {plImgs.map((img, i) => (
            <div key={i} className="mission-music-item">
              <div className="mission-music-thumb">
                <img src={img} alt="" className="mission-music-thumb-img" />
              </div>
              <div className="mission-item-text">
                <span className="mission-item-title">{i === 0 ? '잔잔한 명상 음악 듣기' : '달리가 추천하는 힐링 영상'}</span>
                <span className="mission-item-sub">{i === 0 ? '마음을 차분하게 가라앉혀요' : '오늘 하루 수고했어요'}</span>
              </div>
              <button className="mission-play-btn" aria-label="재생">
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
