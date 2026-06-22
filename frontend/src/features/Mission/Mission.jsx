import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './mission.css'
import shellVideo    from '../../assets/public/조개1.mp4'
import pl1Dark  from '../../assets/dark/플레이리스트1.png'
import pl2Dark  from '../../assets/dark/플레이리스트2.png'
import pl1Light from '../../assets/light/플레이리스트1라이트.png'
import pl2Light from '../../assets/light/플레이리스트2라이트.png'
import dark1 from '../../assets/dark/조개달리다크1.mp4'
import dark2 from '../../assets/dark/조개달리다크2.mp4'
import dark3 from '../../assets/dark/조개달리다크3.mp4'
import light1 from '../../assets/light/조개달리라이트1.mp4'
import light2 from '../../assets/light/조개달리라이트2.mp4'
import light3 from '../../assets/light/조개달리라이트3.mp4'

const SHELL_VIDEOS = {
  dark:  [dark1, dark2, dark3],
  light: [light1, light2, light3],
}
import { useTheme }    from '../../contexts/ThemeContext'
import { useAuth }     from '../../contexts/AuthContext'
import ThemeToggle     from '../Public/ThemeToggle'
import StarBg         from '../Public/StarBg'
import { missionApi }  from '../../api/missions'
import { reportApi }   from '../../api/reports'
import Media           from './Media'

const SEQ_STYLE = [
  { emoji: '🌙', color: '#9B7EFF', bg: 'rgba(155,126,255,0.18)' },
  { emoji: '🧘', color: '#E8A87C', bg: 'rgba(232,168,124,0.18)' },
  { emoji: '💧', color: '#7BCCE8', bg: 'rgba(123,204,232,0.18)' },
]


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
  const [shellVideoSrc,  setShellVideoSrc]  = useState(null)
  const toastTimerRef     = useRef(null)
  const justAddedTimerRef = useRef(null)
  const shellVideoRef     = useRef(null)

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
      // mission_seq(1~3) 기준으로 조개탑 영상 선택
      const seqIdx = (mission.mission_seq ?? 1) - 1
      const theme  = isDark ? 'dark' : 'light'
      setShellVideoSrc(SHELL_VIDEOS[theme][seqIdx] ?? SHELL_VIDEOS[theme][0])
    } catch {
      setMissions(prev => prev.map(m => m.mission_id === mission_id ? { ...m, is_completed: 'N' } : m))
    }
  }

  const [topEmotion, setTopEmotion] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    reportApi.getDaily()
      .then(res => {
        // reports[0] = 오늘 가장 최근 세션, dominant_emotion = AI 분석 top1 감정
        const reports = res?.reports || []
        const counts  = {}
        reports.forEach(r => {
          if (r.dominant_emotion) counts[r.dominant_emotion] = (counts[r.dominant_emotion] || 0) + 1
        })
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        setTopEmotion(top)
      })
      .catch(() => {})
  }, [isAuthenticated])

  const today = new Date().toISOString().slice(0, 10)
  const behaviorMissions = missions.filter(m => m.mission_date?.slice(0, 10) === today && m.mission_seq <= 3)
  const behaviorDone     = behaviorMissions.filter(m => m.is_completed === 'Y').length
  const behaviorTotal    = behaviorMissions.length

  return (
    <div className="mission-screen">

      <StarBg bgClass="mission-bg" starClass="ms-star" positions={['st1','st2','st3','st4','st5','st6']} />

      <ThemeToggle className="mission-theme-toggle" />

      <div className="mission-inner">

        <div className="mission-header">
          <button className="mission-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="mission-hdr-title">마음 돌봄</h1>
          <div className="mission-header-end" />
        </div>

        <div className="behavior-title-row">
          <h2 className="behavior-title">
            오늘의 <span className="mission-title-accent">마음돌봄</span>
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

        <Media topEmotion={topEmotion} />

      </div>

      {/* 조개탑 영상 오버레이 — 미션 완료 시 해당 순번 영상 재생 */}
      {shellVideoSrc && (
        <div className="shell-video-overlay" onClick={() => setShellVideoSrc(null)}>
          <video
            ref={shellVideoRef}
            src={shellVideoSrc}
            className="shell-video-player"
            autoPlay
            playsInline
            onEnded={() => setShellVideoSrc(null)}
          />
          <button
            className="shell-video-close"
            onClick={() => setShellVideoSrc(null)}
            aria-label="닫기"
          >✕</button>
        </div>
      )}
    </div>
  )
}

export default Mission
