import './MessageBubble.css'
import daliProfileImg from '../../assets/public/달리 프로필.png'

const MessageBubble = ({ role, text, time, read }) => {
  const isDali = role === 'dali'
  return (
    <div className={`mb-row ${isDali ? 'dali' : 'user'}`}>
      {isDali && (
        <img src={daliProfileImg} alt="달리" className="mb-avatar" />
      )}
      <div className={`mb-col ${isDali ? '' : 'user'}`}>
        <div className={`mb-bubble ${isDali ? 'dali' : 'user'}`}>
          {text.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        {time && (
          <div className="mb-meta">
            {!isDali && read && <span className="mb-read">✓✓</span>}
            <span className="mb-time">{time}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
