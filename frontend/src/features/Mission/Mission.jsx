import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './mission.css'
import pl2Dark  from '../../assets/dark/플레이리스트2.png'
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

  const [missions,        setMissions]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [topEmotion,      setTopEmotion]      = useState(null)
  const [stageShouldPlay, setStageShouldPlay] = useState(false)
  const stageVideoRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    missionApi.getMissions()
      .then(res => setMissions(res.missions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    reportApi.getDaily()
      .then(res => {
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

  const toggleMission = async (mission_id) => {
    const mission = missions.find(m => m.mission_id === mission_id)
    if (!mission) return

    const completing = mission.is_completed !== 'Y'
    const newState   = completing ? 'Y' : 'N'

    setMissions(prev => prev.map(m => m.mission_id === mission_id ? { ...m, is_completed: newState } : m))
    setStageShouldPlay(completing)

    try {
      if (completing) {
        await missionApi.completeMission(mission_id)
      } else {
        await missionApi.uncompleteMission(mission_id)
      }
    } catch {
      // 실패 시 원복
      setMissions(prev => prev.map(m => m.mission_id === mission_id ? { ...m, is_completed: mission.is_completed } : m))
      setStageShouldPlay(!completing)
    }
  }

  const today          = new Date().toISOString().slice(0, 10)
  const behaviorMissions = missions.filter(m => m.mission_date?.slice(0, 10) === today && m.mission_seq <= 3)
  const behaviorDone   = behaviorMissions.filter(m => m.is_completed === 'Y').length
  const behaviorTotal  = behaviorMissions.length

  const theme         = isDark ? 'dark' : 'light'
  const stageVideoSrc = SHELL_VIDEOS[theme][Math.max(0, behaviorDone - 1)]

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

        {/* 게이미피케이션 영상 — 미션 완료 수에 따라 인라인 재생, 1회 후 마지막 프레임 정지 */}
        <div className="mission-stage">
          <video
            key={behaviorDone}
            ref={stageVideoRef}
            src={stageVideoSrc}
            className="mission-stage-video"
            autoPlay={stageShouldPlay}
            muted
            playsInline
            preload="metadata"
            onEnded={() => {
              const v = stageVideoRef.current
              if (!v) return
              v.currentTime = v.duration - 0.001
              v.pause()
            }}
          />
        </div>

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
            <p style={{ textAlign: 'center', opacity: 0.5, padding: '16px 0' }}>달리와 대화를 마치면 미션이 생겨요 🌙</p>
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
                    aria-label={done ? '완료 취소' : '완료'}
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
    </div>
  )
}

export default Mission
