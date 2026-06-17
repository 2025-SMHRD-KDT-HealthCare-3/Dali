import React, { useState, useMemo } from 'react'
import ThemeToggle from '../Public/ThemeToggle'
import { useTheme } from '../../contexts/ThemeContext'
import './report.css'

/* ── 감정 팔레트 ── */
const EMOTIONS = {
  '기쁨': { color: '#FFD746', bg: 'rgba(255, 215, 70, 0.18)' },
  '불안': { color: '#B39BFF', bg: 'rgba(179, 155, 255, 0.18)' },
  '당황': { color: '#4BCD78', bg: 'rgba(75, 205, 120, 0.18)' },
  '슬픔': { color: '#5AA0FF', bg: 'rgba(90, 160, 255, 0.18)' },
  '분노': { color: '#FF5A50', bg: 'rgba(255, 90, 80, 0.18)' },
  '상처': { color: '#9B9BAF', bg: 'rgba(155, 155, 175, 0.18)' },
}

const formatDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ── 수학 함수형 물결 SVG 생성 ── */
const generateMathWave = (pct) => {
  // 비율에 비례하여 진폭(Amplitude) 결정 (최대 38px)
  const amp = Math.max(2, (pct / 100) * 38)
  const cy = 50 - 2 * amp
  let d = `M -100 50 `
  // 1주기=100px. 충분한 길이를 그려서 무한 스크롤 애니메이션이 튀지 않게 함
  for (let i = -100; i < 400; i += 100) {
    d += `Q ${i + 25} ${cy}, ${i + 50} 50 T ${i + 100} 50 `
  }
  return d
}

const generateTrendLinePath = (data, width = 300, height = 100) => {
  if (!data || data.length < 2) return '';
  const yMax = 100;
  const xStep = width / (data.length - 1);
  const points = data.map((d, i) => [i * xStep, height - (d / yMax) * height]);

  const controlPoint = (current, previous, next, reverse) => {
    const p = previous || current;
    const n = next || current;
    const smoothing = 0.2;
    const length = Math.sqrt(Math.pow(n[0] - p[0], 2) + Math.pow(n[1] - p[1], 2));
    const angle = Math.atan2(n[1] - p[1], n[0] - p[0]) + (reverse ? Math.PI : 0);
    return [current[0] + Math.cos(angle) * length * smoothing, current[1] + Math.sin(angle) * length * smoothing];
  };

  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point[0].toFixed(2)},${point[1].toFixed(2)}`;
    const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
    const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
    return `${acc} C ${cpsX.toFixed(2)},${cpsY.toFixed(2)} ${cpeX.toFixed(2)},${cpeY.toFixed(2)} ${point[0].toFixed(2)},${point[1].toFixed(2)}`;
  }, '');
};

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
      oneLineReview: '오늘 하루 불안한 마음이 크셨군요. 그래도 솔직하게 털어놔 주셔서 감사합니다.',
      ratios: [
        { label: '불안', pct: 45 },
        { label: '슬픔', pct: 30 },
        { label: '당황', pct: 25 },
      ],
      missionRate: 67,
    },
    {
      id: 2,
      time: '오후 8:15',
      duration: '18분',
      userEmotion: '당황',
      modelEmotion: '기쁨',
      score: 68,
      prevScore: 42,
      ratios: [
        { label: '당황', pct: 55 },
        { label: '기쁨', pct: 35 },
        { label: '상처', pct: 10 },
      ],
    },
  ],
}

/* ── 월간 mock 데이터 (6월 기준, 오늘까지만) ── */
const MONTHLY_DATA = {
  1: '기쁨', 2: '당황', 3: '불안', 4: '슬픔', 5: '기쁨',
  6: '기쁨', 7: '당황', 8: '상처', 9: '불안', 10: '기쁨',
  11: '슬픔', 12: '분노', 13: '당황', 14: '기쁨', 15: '불안',
}

const MONTHLY_TREND_DATA = {
  '기쁨': [10, 12, 15, 14, 18, 20, 22, 25, 23, 20, 18, 15, 16, 18, 20, 25, 28, 30, 28, 25, 22, 20, 23, 25, 28, 26, 24, 22, 20, 18, 19],
  '불안': [30, 28, 25, 26, 24, 22, 20, 18, 20, 22, 25, 28, 30, 28, 25, 20, 18, 15, 16, 18, 20, 22, 20, 18, 15, 17, 19, 21, 23, 25, 24],
  '당황': [5, 6, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5, 6, 7, 8, 7, 6, 5, 6, 7, 6, 7],
  '슬픔': [20, 22, 20, 18, 16, 15, 14, 12, 11, 10, 12, 14, 16, 15, 14, 12, 10, 9, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 22, 20, 21],
  '분노': [15, 12, 10, 8, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 3, 4, 5],
  '상처': [20, 20, 18, 20, 20, 23, 24, 25, 24, 22, 20, 18, 15, 17, 19, 21, 23, 25, 27, 29, 27, 25, 23, 21, 19, 17, 15, 13, 15, 17, 16],
};

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
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
const ChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

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
        ) : (
          <>
            {/* ── AI 한마디 (오늘의 미션 수행률 위) ── */}
            {sessions[0]?.oneLineReview && (
              <div className="rp-session-card rp-ai-review-card">
                <span className="rp-ai-review-icon">💬</span>
                <p className="rp-ai-review-text">
                  <strong>AI 한마디</strong>
                  {sessions[0].oneLineReview}
                </p>
              </div>
            )}

            {/* ── 일간 미션 수행률 (세션 위쪽으로 분리된 독립 칸) ── */}
            {sessions[0]?.missionRate !== undefined && (
              <div className="rp-session-card">
                <div className="rp-bar-section">
                  <div className="rp-mission-hdr">
                    <span className="rp-bar-label">오늘의 미션 수행률</span>
                    <span className="rp-mission-pct" style={{ color: sessions[0].missionRate === 100 ? '#5BC479' : '#B39BFF' }}>
                      {sessions[0].missionRate}%
                    </span>
                  </div>
                  <div className="rp-bar rp-bar--track">
                    <div
                      className="rp-bar-seg"
                      style={{
                        width: `${sessions[0].missionRate}%`,
                        background: sessions[0].missionRate === 100
                          ? 'linear-gradient(90deg,#5BC479,#7BCCE8)'
                          : 'linear-gradient(90deg,#7B5FEF,#B39BFF)',
                      }}
                    />
                  </div>
                  <p className="rp-mission-desc">미션은 하루에 한 번 생성돼요</p>
                </div>
              </div>
            )}

            {sessions.map((s, idx) => {
              const ue = EMOTIONS[s.userEmotion]
              const me = EMOTIONS[s.modelEmotion]
              const userRatio = s.ratios?.find(r => r.label === s.userEmotion)?.pct || 0
              const modelRatio = s.ratios?.find(r => r.label === s.modelEmotion)?.pct || 0
              return (
                <div key={s.id} className="rp-session-card">

                  {/* 세션 헤더 */}
                  <div className="rp-session-hdr">
                    <span className="rp-session-num">세션 {idx + 1}</span>
                    <span className="rp-session-time">{s.time}</span>
                    <span className="rp-session-dur">{s.duration}</span>
                  </div>

                  {/* 감정 비교 (수학 함수형 물결 그래프) */}
                  <div className="rp-math-compare">
                    <div className="rp-math-header">
                      <div className="rp-math-item">
                        <span className="rp-math-lbl">내가 선택</span>
                        <div className="rp-math-val" style={{ color: ue?.color || '#fff' }}>
                          {s.userEmotion || '❔'}
                        </div>
                      </div>
                      <div className="rp-math-item right">
                        <span className="rp-math-lbl">AI 분석</span>
                        <div className="rp-math-val" style={{ color: me?.color || '#fff' }}>
                          {s.modelEmotion || '❔'}
                        </div>
                      </div>
                    </div>

                    <div className="rp-math-graph">
                      <svg viewBox="0 0 300 100" className="rp-math-svg" preserveAspectRatio="none">
                        <g><path d={generateMathWave(userRatio)} fill="none" stroke={ue?.color || '#ccc'} strokeWidth="2.5" /></g>
                        <g><path d={generateMathWave(modelRatio)} fill="none" stroke={me?.color || '#ccc'} strokeWidth="2.5" /></g>
                      </svg>
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
                </div>
              )
            })}
          </>
        )}
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
                <span className="rp-sum-label">대화 세션</span>
                <span className="rp-sum-val">15<span className="rp-sum-unit">회</span></span>
              </div>
              <div className="rp-sum-card">
                <span className="rp-sum-label">최다 감정</span>
                <span className="rp-sum-val" style={{ color: EMOTIONS[topEmotion?.label]?.color }}>
                  {EMOTIONS[topEmotion?.label]?.emoji} {topEmotion?.label}
                </span>
              </div>
              <div className="rp-sum-card">
                <span className="rp-sum-label">미션수행율 평균</span>
                <span className="rp-sum-val">61<span className="rp-sum-unit">%</span></span>
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

            {/* 월간 감정 변화 */}
            <div className="rp-data-card">
              <h3 className="rp-data-title">월간 감정 변화</h3>
              <div className="rp-trend-graph">
                <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                  {Object.entries(MONTHLY_TREND_DATA).map(([emotion, data]) => (
                    <path
                      key={emotion}
                      d={generateTrendLinePath(data)}
                      stroke={EMOTIONS[emotion]?.color || '#ccc'}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  ))}
                </svg>
              </div>
              <div className="rp-legend" style={{ marginTop: 10 }}>
                {Object.keys(EMOTIONS).map(label => (
                  <span key={label} className="rp-legend-item">
                    <span className="rp-dot" style={{ background: EMOTIONS[label]?.color }} />{label}
                  </span>
                ))}
              </div>
            </div>

            {/* 주간 점수 흐름 */}
            <div className="rp-data-card">
              <h3 className="rp-data-title">미션수행율 주차별 흐름</h3>
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
