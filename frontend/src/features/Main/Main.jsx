import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './main.css'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ThemeToggle  from '../Public/ThemeToggle'

import logoDarkImg  from '../../assets/dark/달리로고.png'
import logoLightImg from '../../assets/light/달리라이트로고.png'
import daliBasicImg from '../../assets/public/구름달리.png'
import joyImg       from '../../assets/public/dali_joy_yellow.png'
import sadImg       from '../../assets/public/dali_sad_blue.png'
import anxietyImg   from '../../assets/public/dali_anxiety_purple.png'
import angerImg     from '../../assets/public/dali_angry_red.png'
import confusedImg  from '../../assets/public/dali_embarrassed_green.png'
import hurtImg      from '../../assets/public/dali_hurt_gray.png'

const EMOTIONS = [
  { id: 'joy',      label: '기쁨',  img: joyImg,      pos: 'pos-joy'      },
  { id: 'sad',      label: '슬픔',  img: sadImg,      pos: 'pos-sad'      },
  { id: 'anxiety',  label: '불안',  img: anxietyImg,  pos: 'pos-anxiety'  },
  { id: 'anger',    label: '분노',  img: angerImg,    pos: 'pos-anger'    },
  { id: 'confused', label: '당황',  img: confusedImg, pos: 'pos-confused' },
  { id: 'hurt',     label: '상처',  img: hurtImg,     pos: 'pos-hurt'     },
]

const Main = () => {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const { isDark } = useTheme()
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="main-screen">

      {/* 배경 장식 — main-screen 전체 기준 */}
      <div className="main-bg" aria-hidden="true">
        <span className="bg-star s1">✦</span>
        <span className="bg-star s2">✦</span>
        <span className="bg-star s3">✦</span>
        <span className="bg-star s4">✦</span>
        <span className="bg-star s5">✦</span>
        <span className="bg-star s6">✦</span>
        <span className="bg-star s7">✦</span>
        <div className="bg-cloud bc1" />
        <div className="bg-cloud bc2" />
        <div className="bg-cloud bc3" />
      </div>

      <ThemeToggle className="main-theme-toggle" />

      <div className="main-inner">

        {!isAuthenticated && (
          <button className="main-back-btn" onClick={() => navigate('/')} aria-label="뒤로가기">‹</button>
        )}

        {/* 로고 배너 */}
        <img src={isDark ? logoDarkImg : logoLightImg} alt="" className="main-logo" />

        {/* 헤더 */}
        <div className="main-header">
          <div className="main-hdr-sparks" aria-hidden="true">
            <span className="hsp-lg">✦</span>
            <span className="hsp-sm">✦</span>
          </div>
          <h1 className="main-title">오늘의 감정</h1>
        </div>
        <p className="main-subtitle">오늘은 어떤 마음이 가장 가까운가요?</p>

        {/* 오비트 영역 */}
        <div className="main-orbit-section">
          <div className="main-orbit-wrap">

            {/* 궤도선 SVG */}
            <svg
              className="orbit-svg"
              viewBox="0 0 320 400"
              xmlns="http://www.w3.org/2000/svg"
            >
              <ellipse
                cx="160" cy="204"
                rx="130" ry="128"
                fill="none"
                stroke="rgba(255,255,255,0.13)"
                strokeWidth="1.5"
                strokeDasharray="7 5"
              />
              <circle cx="160" cy="76"  r="3.5" fill="rgba(200,185,255,0.38)" />
              <circle cx="160" cy="332" r="3.5" fill="rgba(200,185,255,0.32)" />
              <circle cx="30"  cy="204" r="2.5" fill="rgba(255,255,255,0.24)" />
              <circle cx="290" cy="204" r="2.5" fill="rgba(255,255,255,0.24)" />
            </svg>

            {/* 중앙 달리 마스코트 */}
            <div className="main-mascot">
              <img src={daliBasicImg} alt="달리" className="mascot-img" />
            </div>


            {/* 감정 버튼 6개 */}
            {EMOTIONS.map(em => {
              const isSel = selected === em.id
              return (
                <button
                  key={em.id}
                  className={`em-btn ${em.pos}${isSel ? ' is-sel' : ''}`}
                  onClick={() => setSelected(prev => prev === em.id ? null : em.id)}
                >
                  <div className="em-wrap">
                    {isSel && <div className="em-halo" />}
                    <div className="em-circle">
                      <img src={em.img} alt={em.label} className="em-img" />
                    </div>
                    {isSel && <span className="em-check">✓</span>}
                  </div>
                  <span className={`em-label${isSel ? ' is-sel' : ''}`}>{em.label}</span>
                </button>
              )
            })}

          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="main-actions">
          <button
            className={`main-btn-next${!selected ? ' is-disabled' : ''}`}
            onClick={() => selected && navigate('/chat', { state: { isOnboarding: !user?.onboarding_completed, emotion: selected } })}
          >
            {selected ? '다음' : '감정을 선택해주세요'} <span className="btn-arrow">›</span>
          </button>
          <div className="main-footer-links">
            <button className="main-skip" onClick={() => navigate('/chat', { state: { isOnboarding: !user?.onboarding_completed, emotion: 'anxiety' } })}>잘 모르겠어요</button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Main
