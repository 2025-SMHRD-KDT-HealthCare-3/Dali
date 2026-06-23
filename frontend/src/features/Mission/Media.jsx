import React, { useState, useRef, useEffect } from 'react'
import './media.css'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { mediaApi } from '../../api/media'
import { reportApi } from '../../api/reports'
import musicDark  from '../../assets/dark/음악달리다크.png'
import musicLight from '../../assets/light/음악달리라이트.png'
import videoDark  from '../../assets/dark/영상달리다크.png'
import videoLight from '../../assets/light/영상달리라이트.png'


const fmt = (sec) => {
  const s = Math.floor(sec || 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const MusicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
)
const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="15" height="10" rx="2" />
    <path d="M17 9l5-3v12l-5-3V9z" />
  </svg>
)
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
)
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const Media = ({ topEmotion }) => {
  const { isDark } = useTheme()
  const { isAuthenticated } = useAuth()

  const [music,        setMusic]        = useState(null)
  const [video,        setVideo]        = useState(null)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicTime,    setMusicTime]    = useState(0)
  const [musicDur,     setMusicDur]     = useState(0)
  const [showModal,    setShowModal]    = useState(false)

  const audioRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const emotion = topEmotion || null

    mediaApi.getMusic(emotion)
      .then(res => setMusic((res.media || [])[0] ?? null))
      .catch(() => {})

    if (emotion) {
      mediaApi.getVideo(emotion)
        .then(res => setVideo((res.media || [])[0] ?? null))
        .catch(() => {})
    }
  }, [isAuthenticated, topEmotion])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (musicPlaying) { audio.pause(); setMusicPlaying(false) }
    else              { audio.play();  setMusicPlaying(true)  }
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !musicDur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * musicDur
  }

  const musicThumb = isDark ? musicDark  : musicLight
  const videoThumb = isDark ? videoDark  : videoLight
  const musicSrc   = music?.file_url || null
  const videoSrc   = video?.file_url || null

  return (
    <div className="media-section">
      <h2 className="media-section-hdr">달리가 고른 쉼 콘텐츠 ♥</h2>

      {/* ── 음악 카드 ── */}
      <div className="media-card">
        <div className="media-thumb-wrap">
          <img src={musicThumb} alt="음악" className="media-thumb-img" />
        </div>

        <div className="media-info">
          <div className="media-info-top">
            <div className="media-type-icon"><MusicIcon /></div>
            <span className="media-type-badge">♪ 음악</span>
          </div>

          <p className="media-title">{music?.title || '잔잔한 명상 음악 듣기'}</p>
          <p className="media-sub">마음을 차분하게 가라앉혀요</p>

          <div className="media-player">
            <button
              className="media-play-btn"
              onClick={togglePlay}
              disabled={!musicSrc}
              aria-label={musicPlaying ? '일시정지' : '재생'}
            >
              {musicPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="media-time">{fmt(musicTime)}</span>
            <div className="media-bar" onClick={handleSeek} role="slider">
              <div
                className="media-bar-fill"
                style={{ width: musicDur ? `${(musicTime / musicDur) * 100}%` : '0%' }}
              />
              <div
                className="media-bar-dot"
                style={{ left: musicDur ? `${(musicTime / musicDur) * 100}%` : '0%' }}
              />
            </div>
            <span className="media-time">{fmt(musicDur)}</span>
          </div>
        </div>

        {musicSrc && (
          <audio
            ref={audioRef}
            src={musicSrc}
            onTimeUpdate={() => setMusicTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setMusicDur(audioRef.current?.duration || 0)}
            onEnded={() => setMusicPlaying(false)}
          />
        )}
      </div>

      {/* ── 영상 카드 ── */}
      <div className="media-card">
        <div className="media-thumb-wrap">
          <img src={videoThumb} alt="영상" className="media-thumb-img" />
          <div className="media-thumb-play-overlay">
            <div className="media-thumb-play-circle"><PlayIcon /></div>
          </div>
        </div>

        <div className="media-info">
          <div className="media-info-top">
            <div className="media-type-icon media-type-icon--video"><VideoIcon /></div>
            <span className="media-type-badge">□ 영상</span>
          </div>

          <p className="media-title">{video?.title || '짧은 호흡 영상 보기'}</p>
          <p className="media-sub">
            {topEmotion === '불안' ? '불안한 마음을 천천히 정리해요'
            : topEmotion === '슬픔' ? '슬픔을 함께 흘려보내요'
            : topEmotion === '분노' ? '화난 마음을 잠시 내려놓아요'
            : '오늘 하루 수고했어요'}
          </p>

          <button
            className="media-video-btn"
            onClick={() => videoSrc && setShowModal(true)}
            disabled={!videoSrc}
          >
            <PlayIcon /> 영상 보기
          </button>
          <p className="media-video-hint">↗ 화면에서 바로 시청돼요</p>
        </div>
      </div>

      {/* ── 영상 모달 ── */}
      {showModal && videoSrc && (
        <div className="media-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="media-modal-box" onClick={e => e.stopPropagation()}>
            <button className="media-modal-close" onClick={() => setShowModal(false)} aria-label="닫기">
              <CloseIcon />
            </button>
            <video
              src={videoSrc}
              className="media-modal-video"
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Media
