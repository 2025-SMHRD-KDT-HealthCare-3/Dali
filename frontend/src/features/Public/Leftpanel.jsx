import React from 'react'
import './leftpanel.css'
import daliDarkImg  from '../../assets/dark/시작화면3다크.png'
import daliLightImg from '../../assets/light/시작화면3화이트.png'
import { useTheme } from '../../contexts/ThemeContext'

const FloatingOrbs = () => (
  <div className="lp-orbs" aria-hidden="true">
    <span className="lp-orb lp-orb-1" />
    <span className="lp-orb lp-orb-2" />
    <span className="lp-orb lp-orb-3" />
    <span className="lp-orb lp-orb-4" />
    <span className="lp-orb lp-orb-5" />
    <span className="lp-orb lp-orb-6" />
    <span className="lp-orb lp-orb-7" />
    <span className="lp-orb lp-orb-8" />
    <span className="lp-orb lp-orb-9" />
    <span className="lp-orb lp-orb-10" />
    <span className="lp-orb lp-orb-11" />
    <span className="lp-orb lp-orb-12" />
  </div>
)

const Leftpanel = () => {
  const { isDark } = useTheme()
  return (
    <aside className="lp-panel">
      <img src={isDark ? daliDarkImg : daliLightImg} alt="Dali" className="lp-img" />
      <FloatingOrbs />
      <div className="lp-blend" aria-hidden="true" />
    </aside>
  )
}

export default Leftpanel
