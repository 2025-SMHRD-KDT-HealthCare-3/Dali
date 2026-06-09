import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './chat.css'
import chatBgDark    from '../../assets/dark/챗봇 배경.png'
import chatBgLight   from '../../assets/light/챗봇 배경 라이트.png'
import daliProfileImg from '../../assets/public/달리 프로필.png'
import { useTheme }  from '../../contexts/ThemeContext'

const now = () => {
  const d = new Date()
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mm}`
}

const INIT_MESSAGES = [
  { id: 1, type: 'ai', text: '안녕, 오늘도 와줘서 고마워. ☁️✨', time: now() },
]

const QUICK_CHIPS = [
  { id: 'anxiety', label: '조금 불안해',         icon: '🐾' },
  { id: 'chat',    label: '그냥 이야기하고 싶어', icon: '💬' },
  { id: 'comfort', label: '위로가 필요해',        icon: '🩷' },
]

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)

const StarIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const Chat = () => {
  const navigate = useNavigate()
  const [messages, setMessages] = useState(INIT_MESSAGES)
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const { isDark } = useTheme()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (text) => {
    if (!text.trim()) return
    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: text.trim(), time: now(), read: false }])
    setInput('')
  }

  return (
    <div className="chat-screen">

      {/* 배경 이미지 */}
      <img src={isDark ? chatBgDark : chatBgLight} alt="" className="chat-bg-img" aria-hidden="true" />

      {/* 헤더 */}
      <header className="chat-header">
        <button className="chat-back" onClick={() => navigate('/main')} aria-label="뒤로">
          <BackIcon />
        </button>

        <div className="chat-hdr-center">
          <div className="chat-avatar-wrap">
            <img src={daliProfileImg} alt="달리" className="chat-avatar-img" />
          </div>
          <div className="chat-hdr-info">
            <span className="chat-hdr-name">Dali</span>
            <span className="chat-hdr-status">🌙 지금, 당신과 함께 있어요 <span className="chat-online" /></span>
          </div>
        </div>

        <button className="chat-fav" aria-label="즐겨찾기">
          <StarIcon />
        </button>
      </header>

      {/* 메시지 목록 */}
      <div className="chat-messages">
        <div className="chat-date-divider"><span>오늘</span></div>

        {messages.map(msg => (
          <div key={msg.id} className={`chat-row ${msg.type}`}>
            {msg.type === 'ai' && (
              <img src={daliProfileImg} alt="달리" className="chat-msg-avatar" />
            )}
            <div className="chat-bubble-col">
              <div className={`chat-bubble ${msg.type}`}>
                {msg.text.split('\n').map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </div>
              <div className="chat-meta">
                {msg.type === 'user' && msg.read && <span className="chat-read">✓✓</span>}
                <span className="chat-time">{msg.time}</span>
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* 빠른 감정 선택 */}
      <div className="chat-emotion-bar">
        <div className="chat-emotion-hdr">
          <span>⭐ 지금 내 감정은...</span>
          <span className="chat-emotion-spark">✦</span>
        </div>
        <div className="chat-emotion-chips">
          {QUICK_CHIPS.map(c => (
            <button
              key={c.id}
              className="chat-chip"
              onClick={() => sendMessage(`${c.icon} ${c.label}`)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 입력창 */}
      <div className="chat-input-bar">
        <input
          className="chat-input"
          placeholder="메시지를 입력해 주세요..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
        />
        <button className="chat-mic" aria-label="음성">
          <MicIcon />
        </button>
        <button className="chat-send" onClick={() => sendMessage(input)} aria-label="전송">
          <SendIcon />
        </button>
      </div>

    </div>
  )
}

export default Chat
