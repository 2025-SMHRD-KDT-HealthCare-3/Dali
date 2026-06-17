import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './DataManagement.css'
import { useTheme } from '../../contexts/ThemeContext'
import ThemeToggle from '../Public/ThemeToggle'
import { sessionApi } from '../../api/sessions'

const DATA_ITEMS = [
  { emoji: '💬', label: '대화 기록', desc: '달리와 나눈 모든 채팅 메시지' },
  { emoji: '📊', label: '감정 분석 결과', desc: '세션별 감정 점수 및 분석 데이터' },
  { emoji: '📝', label: 'AI 요약', desc: '대화 종료 후 생성된 요약 내용' },
  { emoji: '🎯', label: '회복 미션 기록', desc: '세션에서 생성된 미션 이력' },
]

const DataManagement = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const [step,     setStep]     = useState('idle')   // 'idle' | 'confirm' | 'loading' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const handleDelete = async () => {
    setStep('loading')
    setErrorMsg('')
    try {
      await sessionApi.deleteAllSessions()
      setStep('done')
    } catch (err) {
      setErrorMsg(err.message || '삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setStep('error')
    }
  }

  return (
    <div className="dm-screen">

      <div className="dm-bg" aria-hidden="true">
        <span className="dm-star ds1">✦</span>
        <span className="dm-star ds2">✦</span>
        <span className="dm-star ds3">✦</span>
        <span className="dm-star ds4">✦</span>
      </div>

      <ThemeToggle className="dm-theme-toggle" />

      <div className="dm-inner">

        {/* 헤더 */}
        <div className="dm-header">
          <button className="dm-back" onClick={() => navigate(-1)} aria-label="뒤로가기">‹</button>
          <h1 className="dm-title">데이터 보관 설정</h1>
          <div className="dm-header-end" />
        </div>

        {/* 안내 카드 */}
        <div className="dm-info-card">
          <span className="dm-info-emoji">🗂️</span>
          <p className="dm-info-text">
            대화 기록을 삭제하면 달리와 나눈 모든 세션 데이터가 영구적으로 삭제됩니다.
            삭제된 데이터는 복구할 수 없어요.
          </p>
        </div>

        {/* 삭제 대상 목록 */}
        <p className="dm-section-title">삭제되는 데이터</p>
        <div className="dm-data-list">
          {DATA_ITEMS.map(item => (
            <div key={item.label} className="dm-data-item">
              <span className="dm-data-emoji">{item.emoji}</span>
              <div className="dm-data-text">
                <span className="dm-data-label">{item.label}</span>
                <span className="dm-data-desc">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 상태별 UI */}
        {step === 'idle' && (
          <button className="dm-delete-btn" onClick={() => setStep('confirm')}>
            대화 기록 전체 삭제
          </button>
        )}

        {step === 'confirm' && (
          <div className="dm-confirm-box">
            <p className="dm-confirm-msg">
              정말 삭제하시겠어요?<br />
              <span className="dm-confirm-warn">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="dm-confirm-btns">
              <button className="dm-cancel-btn" onClick={() => setStep('idle')}>취소</button>
              <button className="dm-confirm-del-btn" onClick={handleDelete}>삭제 확인</button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="dm-status">
            <span className="dm-spinner" />
            <p className="dm-status-text">삭제 중...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="dm-status dm-status--done">
            <span className="dm-done-icon">✓</span>
            <p className="dm-status-text">대화 기록이 모두 삭제되었습니다.</p>
            <button className="dm-back-btn" onClick={() => navigate(-1)}>확인</button>
          </div>
        )}

        {step === 'error' && (
          <div className="dm-status dm-status--error">
            <p className="dm-error-text">{errorMsg}</p>
            <button className="dm-delete-btn" onClick={() => setStep('idle')}>다시 시도</button>
          </div>
        )}

      </div>
    </div>
  )
}

export default DataManagement
