import { useTheme } from '../../contexts/ThemeContext'
import './ThemeToggle.css'

const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      className={`theme-toggle-btn${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}

export default ThemeToggle
