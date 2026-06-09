import React from 'react'
import { useNavigate } from 'react-router-dom'
import './settings.css'
import { useTheme } from '../../contexts/ThemeContext'

import avatarImg       from '../../assets/public/설정 달리 아바타.png'
import icProfileDark   from '../../assets/dark/다크개인정보.png'
import icDarkModeDark  from '../../assets/dark/다크다크모드.png'
import icLightModeDark from '../../assets/dark/다크라이트모드.png'
import icSecurityDark  from '../../assets/dark/다크보안.png'
import icAlarmDark     from '../../assets/dark/다크알림.png'
import icDataDark      from '../../assets/dark/다크데이터보관.png'

import icProfileLight   from '../../assets/light/개인정보.png'
import icLightModeLight from '../../assets/light/라이트모드.png'
import icDarkModeLight  from '../../assets/light/다크모드.png'
import icSecurityLight  from '../../assets/light/보안.png'
import icAlarmLight     from '../../assets/light/알림.png'
import icDataLight      from '../../assets/light/데이터보관.png'

const Settings = () => {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const MENU_ITEMS = [
    { id: 'profile',  img: isDark ? icProfileDark  : icProfileLight,   label: '개인정보 수정',      type: 'arrow'  },
    { id: 'theme',    img: isDark ? icDarkModeDark : icLightModeLight,  label: '라이트 / 다크 모드', type: 'toggle' },
    { id: 'security', img: isDark ? icSecurityDark : icSecurityLight,   label: '권한 관리',          type: 'arrow'  },
    { id: 'alarm',    img: isDark ? icAlarmDark    : icAlarmLight,      label: '알림설정',           type: 'arrow'  },
    { id: 'data',     img: isDark ? icDataDark     : icDataLight,       label: '데이터 보관 설정',   type: 'arrow'  },
  ]

  return (
    <div className="settings-screen">

      {/* 배경 장식 */}
      <div className="settings-bg" aria-hidden="true">
        <span className="set-star st1">✦</span>
        <span className="set-star st2">✦</span>
        <span className="set-star st3">✦</span>
        <span className="set-star st4">✦</span>
        <span className="set-star st5">✦</span>
        <span className="set-star st6">✦</span>
      </div>

      <div className="settings-inner">

        {/* 헤더 */}
        <div className="settings-header">
          <button
            className="settings-back"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
          >‹</button>
          <h1 className="settings-title">설정</h1>
          <div className="settings-header-end" />
        </div>

        {/* 프로필 */}
        <div className="settings-profile">
          <div className="settings-avatar-ring">
            <img src={avatarImg} alt="달리 아바타" className="settings-avatar" />
          </div>
          <div className="settings-profile-text">
            <div className="settings-profile-name">Dali 🌙✨</div>
            <div className="settings-profile-sub">나에게 맞는 환경으로 조정해보세요.</div>
          </div>
        </div>

        {/* 메뉴 목록 */}
        <div className="settings-list">
          {MENU_ITEMS.map(item => (
            <div key={item.id} className="settings-item">
              <div className="settings-icon-wrap">
                <img src={item.img} alt={item.label} className="set-icon-img" />
              </div>
              <span className="settings-label">{item.label}</span>

              {item.type === 'arrow' ? (
                <span className="settings-arrow">›</span>
              ) : (
                <button
                  className={`settings-toggle${isDark ? ' is-dark' : ''}`}
                  onClick={toggleTheme}
                  aria-label="다크/라이트 모드 전환"
                >
                  <span className="tog-sun">☀️</span>
                  <span className="tog-moon">🌙</span>
                  <div className="tog-thumb" />
                  <span className="tog-sparkle">✦</span>
                </button>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* 하단 구름 장식 */}
      <div className="settings-clouds" aria-hidden="true">
        <div className="set-cloud sc1" />
        <div className="set-cloud sc2" />
        <div className="set-cloud sc3" />
      </div>

    </div>
  )
}

export default Settings
