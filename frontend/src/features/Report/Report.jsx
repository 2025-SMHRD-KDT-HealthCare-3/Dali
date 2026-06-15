import React, { useState, useMemo } from 'react'
import ThemeToggle from '../Public/ThemeToggle'
import { useTheme } from '../../contexts/ThemeContext'
import './report.css'

/* ── 감정 팔레트 ── */
const EMOTIONS = {
  '행복': { color: '#5BC479', bg: 'rgba(91,196,121,0.18)',   emoji: '😊' },
  '평온': { color: '#9B7EFF', bg: 'rgba(155,126,255,0.18)',  emoji: '😌' },
  '불안': { color: '#E8A87C', bg: 'rgba(232,168,124,0.18)',  emoji: '😰' },
  '슬픔': { color: '#7BCCE8', bg: 'rgba(123,204,232,0.18)',  emoji: '😢' },
  '화남': { color: '#E85C5C', bg: 'rgba(232,92,92,0.18)',    emoji: '😠' },
  '피곤': { color: '#A0A0B8', bg: 'rgba(160,160,184,0.18)',  emoji: '😴' },
  '설렘': { color: '#F6C85B', bg: 'rgba(246,200,91,0.18)',   emoji: '🤩' },
}

const formatDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ── 일간 mock 데이터 (오늘 날짜에 붙임) ── */
const TODAY = new Date()
const DAILY_DATA = {
  [formatDate(TODAY)]: [
    {
      id: 1,
      time: '오전 9:23',
      duration: '32분',
      userEmotion: '불안',
      modelEmotion: '불안',
      score: 42,
      prevScore: 55,
      ratios: [
        { label: '불안', pct: 45 },
        { label: '슬픔', pct: 30 },
        { label: '평온', pct: 25 },
      ],
      missionRate: 67,
    },
    {
      id: 2,
      time: '오후 8:15',
      duration: '18분',
      userEmotion: '평온',
      modelEmotion: '행복',
      score: 68,
      prevScore: 42,
      ratios: [
        { label: '평온', pct: 55 },
        { label: '행복', pct: 35 },
        { label: '설렘', pct: 10 },
      ],
      missionRate: 100,
    },
  ],
}

/* ── 월간 mock 데이터 (6월 기준, 오늘까지만) ── */
const MONTHLY_DATA = {
  1: '행복', 2: '평온', 3: '불안', 4: '슬픔',  5: '행복',
  6: '행복', 7: '평온', 8: '피곤', 9: '불안',  10: '행복',
  11: '슬픔', 12: '화남', 13: '평온', 14: '행복', 15: '불안',
}

const WEEKLY_TRENDS = [
  { week: '1주', score: 58 },
  { week: '2주', score: 64 },
  { week: '3주', score: 52 },
  { week: '4주', score: 71 },
]

/* ── 감정 주의 신호 mock 데이터 ── */
const EMOTION_ALERTS = [
  {
    id: 1,
    emotion: '슬픔',
    reason: '슬픔 5일 연속 분석',
    date: '2026. 06. 12',
    confirmed: true,
  },
  {
    id: 2,
    emotion: '불안',
    reason: '불안 5일 연속 분석',
    date: '2026. 06. 05',
    confirmed: false,
  },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/* ── 아이콘 ── */
const ChevLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)
const ChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

const ScoreBadge = ({ score, prev }) => {
  const diff = score - prev
  const cls = Math.abs(diff) < 3 ? 'neutral' : diff > 0 ? 'up' : 'down'
  const arrow = cls === 'neutral' ? '—' : cls === 'up' ? '▲' : '▼'
  return <span className={`rp-score-badge ${cls}`}>{arrow} {score}점</span>
}

/* ════════════════════════════════════════════ */
const Report = () => {
  const { isDark } = useTheme()

  /* 탭 */
  const [activeTab, setActiveTab] = useState('daily')

  /* 일간 */
  const [currentDate, setCurrentDate] = useState(new Date())
  const dateKey = formatDate(currentDate)
  const sessions = DAILY_DATA[dateKey] || []

  const prevDay = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    setCurrentDate(d)
  }
  const nextDay = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    if (d <= TODAY) setCurrentDate(d)
  }

  const dateLabel = (() => {
    const d = currentDate
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${weekdays[d.getDay()]})`
  })()

  /* 월간 */
  const [currentMonth, setCurrentMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))

  const prevMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    setCurrentMonth(d)
  }
  const nextMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    setCurrentMonth(d)
  }

  const calCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [currentMonth])

  const isFutureDay = (day) => {
    if (!day) return false
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const todayMidnight = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())
    return d > todayMidnight
  }

  const isToday = (day) => {
    if (!day) return false
    return (
      currentMonth.getFullYear() === TODAY.getFullYear() &&
      currentMonth.getMonth() === TODAY.getMonth() &&
      day === TODAY.getDate()
    )
  }

  /* 월간 감정 분포 계산 */
  const emotionSummary = useMemo(() => {
    const counts = {}
    Object.values(MONTHLY_DATA).forEach(e => { counts[e] = (counts[e] || 0) + 1 })
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, pct: Math.round(count / total * 100) }))
  }, [])

  const topEmotion = emotionSummary[0]

  /* ── 렌더 ── */
  return (
    <div className="report-screen">

      <div className="rp-bg" aria-hidden="true">
        <span className="rp-star rs1">✦</span>
        <span className="rp-star rs2">✦</span>
        <span className="rp-star rs3">✦</span>
        <span className="rp-star rs4">✦</span>
      </div>

      <ThemeToggle className="report-theme-toggle" />

      <div className="rp-inner">

        {/* 헤더 */}
        <div className="rp-header">
          <h1 className="rp-title">리포트</h1>
        </div>

        {/* 탭 */}
        <div className="rp-tabs">
          <button className={`rp-tab${activeTab === 'daily' ? ' active' : ''}`} onClick={() => setActiveTab('daily')}>일간</button>
          <button className={`rp-tab${activeTab === 'monthly' ? ' active' : ''}`} onClick={() => setActiveTab('monthly')}>월간</button>
        </div>

        {/* ═══ 일간 ═══ */}
        {activeTab === 'daily' && (
          <>
            {/* 날짜 네비 */}
            <div className="rp-date-nav">
              <button className="rp-nav-btn" onClick={prevDay}><ChevLeft /></button>
              <span className="rp-date-label">{dateLabel}</span>
              <button className="rp-nav-btn" onClick={nextDay} disabled={formatDate(currentDate) === formatDate(TODAY)}><ChevRight /></button>
            </div>

            {sessions.length === 0 ? (
              <div className="rp-empty">
                <span className="rp-empty-emoji">🌙</span>
                <p>이 날의 대화 기록이 없어요</p>
              </div>
            ) : sessions.map((s, idx) => {
              const ue = EMOTIONS[s.userEmotion]
              const me = EMOTIONS[s.modelEmotion]
              return (
                <div key={s.id} className="rp-session-card">

                  {/* 세션 헤더 */}
                  <div className="rp-session-hdr">
                    <span className="rp-session-num">세션 {idx + 1}</span>
                    <span className="rp-session-time">{s.time}</span>
                    <span className="rp-session-dur">{s.duration}</span>
                    <ScoreBadge score={s.score} prev={s.prevScore} />
                  </div>

                  {/* 감정 비교 */}
                  <div className="rp-emotion-row">
                    <div className="rp-emotion-badge" style={{ background: ue.bg, borderColor: ue.color + '60' }}>
                      <span className="rp-badge-lbl">내가 선택</span>
                      <span className="rp-badge-emoji">{ue.emoji}</span>
                      <span className="rp-badge-name" style={{ color: ue.color }}>{s.userEmotion}</span>
                    </div>
                    <span className="rp-vs">vs</span>
                    <div className="rp-emotion-badge" style={{ background: me.bg, borderColor: me.color + '60' }}>
                      <span className="rp-badge-lbl">AI 분석</span>
                      <span className="rp-badge-emoji">{me.emoji}</span>
                      <span className="rp-badge-name" style={{ color: me.color }}>{s.modelEmotion}</span>
                    </div>
                  </div>

                  {/* 감정 비율 바 */}
                  <div className="rp-bar-section">
                    <span className="rp-bar-label">감정 비율</span>
                    <div className="rp-bar">
                      {s.ratios.map(r => (
                        <div key={r.label} className="rp-bar-seg" style={{ width: `${r.pct}%`, background: EMOTIONS[r.label]?.color }} />
                      ))}
                    </div>
                    <div className="rp-legend">
                      {s.ratios.map(r => (
                        <span key={r.label} className="rp-legend-item">
                          <span className="rp-dot" style={{ background: EMOTIONS[r.label]?.color }} />{r.label} {r.pct}%
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 미션 수행률 */}
                  <div className="rp-bar-section">
                    <div className="rp-mission-hdr">
                      <span className="rp-bar-label">미션 수행률</span>
                      <span className="rp-mission-pct" style={{ color: s.missionRate === 100 ? '#5BC479' : '#B39BFF' }}>
                        {s.missionRate}%
                      </span>
                    </div>
                    <div className="rp-bar rp-bar--track">
                      <div
                        className="rp-bar-seg"
                        style={{
                          width: `${s.missionRate}%`,
                          background: s.missionRate === 100
                            ? 'linear-gradient(90deg,#5BC479,#7BCCE8)'
                            : 'linear-gradient(90deg,#7B5FEF,#B39BFF)',
                        }}
                      />
                    </div>
                  </div>

                </div>
              )
            })}
          </>
        )}

        {/* ═══ 월간 ═══ */}
        {activeTab === 'monthly' && (
          <>
            {/* 월 네비 */}
            <div className="rp-date-nav">
              <button className="rp-nav-btn" onClick={prevMonth}><ChevLeft /></button>
              <span className="rp-date-label">
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </span>
              <button className="rp-nav-btn" onClick={nextMonth}><ChevRight /></button>
            </div>

            {/* 감정 캘린더 */}
            <div className="rp-cal-card">
              <div className="rp-cal-head">
                {DAY_LABELS.map((l, i) => (
                  <span key={i} className={`rp-cal-hlabel${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{l}</span>
                ))}
              </div>
              <div className="rp-cal-body">
                {calCells.map((day, i) => {
                  const future = isFutureDay(day)
                  const emotion = day && !future ? MONTHLY_DATA[day] : null
                  const em = emotion ? EMOTIONS[emotion] : null
                  return (
                    <div key={i} className={`rp-cal-cell${isToday(day) ? ' is-today' : ''}`}>
                      {em ? (
                        <div className="rp-cal-dot" style={{ background: em.color }}>
                          <span className="rp-cal-face">{em.emoji}</span>
                        </div>
                      ) : day ? (
                        <span className={`rp-cal-num${future ? ' future' : ''}`}>{day}</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 감정 범례 */}
            <div className="rp-cal-legend">
              {Object.entries(EMOTIONS).map(([label, e]) => (
                <span key={label} className="rp-legend-item">
                  <span className="rp-dot" style={{ background: e.color }} />{label}
                </span>
              ))}
            </div>

            {/* 요약 카드 3개 */}
            <div className="rp-sum-row">
              <div className="rp-sum-card">
                <span className="rp-sum-label">이번 달 세션</span>
                <span className="rp-sum-val">15<span className="rp-sum-unit">회</span></span>
              </div>
              <div className="rp-sum-card">
                <span className="rp-sum-label">최다 감정</span>
                <span className="rp-sum-val" style={{ color: EMOTIONS[topEmotion?.label]?.color }}>
                  {EMOTIONS[topEmotion?.label]?.emoji} {topEmotion?.label}
                </span>
              </div>
              <div className="rp-sum-card">
                <span className="rp-sum-label">평균 점수</span>
                <span className="rp-sum-val">61<span className="rp-sum-unit">점</span></span>
              </div>
            </div>

            {/* 감정 분포 */}
            <div className="rp-data-card">
              <h3 className="rp-data-title">이달의 감정 분포</h3>
              <div className="rp-bar rp-bar--lg">
                {emotionSummary.map(({ label, pct }) => (
                  <div key={label} className="rp-bar-seg" style={{ width: `${pct}%`, background: EMOTIONS[label]?.color }} />
                ))}
              </div>
              <div className="rp-legend" style={{ marginTop: 10 }}>
                {emotionSummary.map(({ label, pct }) => (
                  <span key={label} className="rp-legend-item">
                    <span className="rp-dot" style={{ background: EMOTIONS[label]?.color }} />{label} {pct}%
                  </span>
                ))}
              </div>
            </div>

            {/* 주간 점수 흐름 */}
            <div className="rp-data-card">
              <h3 className="rp-data-title">주간 점수 흐름</h3>
              <div className="rp-weekly">
                {WEEKLY_TRENDS.map(({ week, score }) => (
                  <div key={week} className="rp-weekly-col">
                    <span className="rp-weekly-score">{score}</span>
                    <div className="rp-weekly-track">
                      <div className="rp-weekly-fill" style={{ height: `${score}%` }} />
                    </div>
                    <span className="rp-weekly-label">{week}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 감정 주의 신호 이력 */}
            <div className="rp-alert-card">
              <div className="rp-alert-hdr">
                <h3 className="rp-data-title">감정 주의 신호 이력</h3>
                <span className="rp-alert-count">{EMOTION_ALERTS.length}건</span>
              </div>
              <p className="rp-alert-desc">같은 부정 감정이 5일 연속 감지될 때 기록돼요</p>

              {EMOTION_ALERTS.length === 0 ? (
                <div className="rp-alert-empty">
                  <span>🌙</span>
                  <span>이번 달 주의 신호가 없어요</span>
                </div>
              ) : (
                <div className="rp-alert-list">
                  {EMOTION_ALERTS.map(alert => {
                    const em = EMOTIONS[alert.emotion]
                    return (
                      <div key={alert.id} className={`rp-alert-item${alert.confirmed ? ' confirmed' : ''}`}>
                        <div className="rp-alert-icon" style={{ background: em?.bg, borderColor: em?.color + '55' }}>
                          <span>{em?.emoji}</span>
                        </div>
                        <div className="rp-alert-body">
                          <div className="rp-alert-top">
                            <span className="rp-alert-emotion" style={{ color: em?.color }}>{alert.emotion}</span>
                            <span className="rp-alert-reason">{alert.reason}</span>
                          </div>
                          <span className="rp-alert-date">{alert.date}</span>
                        </div>
                        <span className={`rp-alert-badge${alert.confirmed ? ' confirmed' : ''}`}>
                          {alert.confirmed ? '확인됨' : '미확인'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </>
        )}

      </div>
    </div>
  )
}

export default Report
