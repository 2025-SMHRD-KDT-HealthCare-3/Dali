import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './NotificationSettings.css'
import ThemeToggle from '../Public/ThemeToggle'
import StarBg     from '../Public/StarBg'

const STORAGE_KEY = 'dali_notification_settings'

const DEFAULT_SETTINGS = {
  dailyReminder:   true,
  missionReminder: true,
  emotionAlert:    true,
}

const NOTIFICATION_ITEMS = [
  {
    key: 'dailyReminder',
    emoji: '🌙',
    label: '매일 체크인 알림',
    desc: '달리와 대화할 시간을 알려드려요',
  },
  {
    key: 'missionReminder',
    emoji: '🎯',
    label: '미션 리마인더',
    desc: '완료하지 않은 회복 미션을 알려드려요',
  },
  {
    key: 'emotionAlert',
    emoji: '💜',
    label: '감정 주의 신호 알림',
    desc: '같은 부정 감정이 5일 연속 감지될 때 알려드려요',
  },
]

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

const NotificationSettings = () => {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(loadSettings)

  const toggle = (key) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <div className="ns-screen">

      <StarBg bgClass="ns-bg" starClass="ns-star" positions={['nss1','nss2','nss3','nss4']} />

      <ThemeToggle className="ns-theme-toggle" />

      <div className="ns-inner">

        {/* 헤더 */}
        <div className="ns-header">
          <button className="ns-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="ns-title">알림 설정</h1>
          <div className="ns-header-end" />
        </div>

        {/* 안내 */}
        <p className="ns-desc">받고 싶은 알림을 선택해주세요</p>

        {/* 토글 목록 */}
        <div className="ns-list">
          {NOTIFICATION_ITEMS.map(item => (
            <div key={item.key} className="ns-item">
              <span className="ns-emoji">{item.emoji}</span>
              <div className="ns-item-text">
                <span className="ns-item-label">{item.label}</span>
                <span className="ns-item-desc">{item.desc}</span>
              </div>
              <button
                className={`ns-toggle${settings[item.key] ? ' is-on' : ''}`}
                onClick={() => toggle(item.key)}
                aria-label={settings[item.key] ? '알림 끄기' : '알림 켜기'}
              >
                <div className="ns-tog-thumb" />
              </button>
            </div>
          ))}
        </div>

        <p className="ns-notice">
          * 실제 알림은 앱 업데이트 후 제공될 예정이에요
        </p>

      </div>
    </div>
  )
}

export default NotificationSettings
