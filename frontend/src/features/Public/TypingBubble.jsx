import './MessageBubble.css'
import daliProfileImg from '../../assets/public/달리 프로필.png'

const TypingBubble = () => (
  <div className="mb-row dali">
    <img src={daliProfileImg} alt="달리" className="mb-avatar" />
    <div className="mb-col">
      <div className="mb-bubble dali mb-typing">
        <span className="mb-dot" />
        <span className="mb-dot" />
        <span className="mb-dot" />
      </div>
    </div>
  </div>
)

export default TypingBubble
