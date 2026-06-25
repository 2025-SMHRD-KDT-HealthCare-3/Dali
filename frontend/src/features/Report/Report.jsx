import React, { useState, useMemo, useEffect, useCallback } from 'react'
import ThemeToggle from '../Public/ThemeToggle'
import StarBg     from '../Public/StarBg'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import './report.css'
import { reportApi } from '../../api/reports'
import { emotionAlertApi } from '../../api/emotionAlerts'
import { missionApi } from '../../api/missions'
import { logAnalysisApi } from '../../api/logAnalysis'
import { formatTime } from '../Public/timeUtils'

/* ── 감정 팔레트 ── */
const EMOTION_SCORE_FIELD = {
  '기쁨': 'joy_score',
  '슬픔': 'sad_score',
  '불안': 'anxiety_score',
  '분노': 'anger_score',
  '상처': 'hurt_score',
  '당황': 'embarrass_score',
}

const EMOTIONS = {
  '기쁨': { color: '#FFD746', bg: 'rgba(255, 215, 70, 0.18)',   emoji: '😊' },
  '불안': { color: '#B39BFF', bg: 'rgba(179, 155, 255, 0.18)', emoji: '😰' },
  '당황': { color: '#4BCD78', bg: 'rgba(75, 205, 120, 0.18)',  emoji: '😳' },
  '슬픔': { color: '#5AA0FF', bg: 'rgba(90, 160, 255, 0.18)',  emoji: '😢' },
  '분노': { color: '#FF5A50', bg: 'rgba(255, 90, 80, 0.18)',   emoji: '😠' },
  '상처': { color: '#9B9BAF', bg: 'rgba(155, 155, 175, 0.18)', emoji: '🥺' },
}

const formatDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatMonth = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/* ── 수학 함수형 물결 SVG 생성 ── */
const generateMathWave = (pct) => {
  const amp = Math.max(2, (pct / 100) * 38)
  const cy = 50 - 2 * amp
  let d = `M -100 50 `
  for (let i = -100; i < 400; i += 100) {
    d += `Q ${i + 25} ${cy}, ${i + 50} 50 T ${i + 100} 50 `
  }
  return d
}

const generateTrendLinePath = (data, width = 300, height = 100) => {
  if (!data || data.length < 2) return ''
  const PAD  = 8   // 위아래 여백(SVG 단위) — 극단값에서 베지어 제어점이 뷰포트 밖으로 나가는 것을 방지
  const yMax = 100
  const xStep = width / (data.length - 1)
  const points = data.map((d, i) => [
    i * xStep,
    (height - PAD) - (d / yMax) * (height - PAD * 2),
  ])

  const controlPoint = (current, previous, next, reverse) => {
    const p = previous || current
    const n = next || current
    const smoothing = 0.2
    const length = Math.sqrt(Math.pow(n[0] - p[0], 2) + Math.pow(n[1] - p[1], 2))
    const angle = Math.atan2(n[1] - p[1], n[0] - p[0]) + (reverse ? Math.PI : 0)
    return [current[0] + Math.cos(angle) * length * smoothing, current[1] + Math.sin(angle) * length * smoothing]
  }

  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point[0].toFixed(2)},${point[1].toFixed(2)}`
    const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point)
    const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true)
    return `${acc} C ${cpsX.toFixed(2)},${cpsY.toFixed(2)} ${cpeX.toFixed(2)},${cpeY.toFixed(2)} ${point[0].toFixed(2)},${point[1].toFixed(2)}`
  }, '')
}

/* ── API 리포트 → 화면 데이터 변환 ──
   Node의 emotion_ratio = [{ emotion, score }] 사용 (score 합계 ≈ 100, 이미 정렬됨)
   raw score 필드(joy_score 등)는 모델 미연동 시 0.0이라 직접 읽으면 빈 배열 반환 */
const toRatios = (r) => {
  const src = Array.isArray(r.emotion_ratio) ? r.emotion_ratio : []
  return src
    .filter(e => e.score > 0)
    .map(e => ({ label: e.emotion, pct: Math.round(e.score) }))
}

const TODAY = new Date()
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
  const { isAuthenticated } = useAuth()

  const [activeTab,      setActiveTab]      = useState('daily')
  const [focusEmotion,   setFocusEmotion]   = useState(null)   // 월간 감정 변화 포커스
  const [currentDate,    setCurrentDate]    = useState(new Date())
  const [currentMonth,   setCurrentMonth]   = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const [dailyReports,   setDailyReports]   = useState([])
  const [dailyReview,    setDailyReview]    = useState(null)   // one_line_review (최상위 키)
  const [monthlyData,    setMonthlyData]    = useState(null)   // Node monthly 전체 응답
  const [alerts,         setAlerts]         = useState([])
  const [missions,       setMissions]       = useState([])
  const [dailyLoading,   setDailyLoading]   = useState(false)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [sessionAnalyses, setSessionAnalyses] = useState({})

  const loadDaily = useCallback((date) => {
    setDailyLoading(true)
    setSessionAnalyses({})
    reportApi.getDaily(formatDate(date))
      .then(res => {
        setDailyReview(res.one_line_review || null)
        const reports = res.reports || []
        setDailyReports(reports)
        const ids = reports.map(r => r.session_id).filter(Boolean)
        Promise.all(
          ids.map(id => logAnalysisApi.getLogAnalyses(id).catch(() => ({ analyses: [] })))
        ).then(results => {
          const map = {}
          ids.forEach((id, i) => { map[id] = results[i].analyses || [] })
          setSessionAnalyses(map)
        })
      })
      .catch(() => { setDailyReview(null); setDailyReports([]) })
      .finally(() => setDailyLoading(false))
  }, [])

  const loadMonthly = useCallback((month) => {
    setMonthlyLoading(true)
    Promise.all([
      reportApi.getMonthly(formatMonth(month)).catch(() => null),
      emotionAlertApi.getAlerts().catch(() => ({ alerts: [] })),
    ])
      .then(([rRes, aRes]) => {
        setMonthlyData(rRes)
        setAlerts(aRes.alerts || [])
      })
      .finally(() => setMonthlyLoading(false))
  }, [])

  useEffect(() => { loadDaily(currentDate)   }, [currentDate])
  useEffect(() => { loadMonthly(currentMonth) }, [currentMonth])

  /* 오늘 미션 조회 (미션 수행률용) */
  useEffect(() => {
    if (!isAuthenticated) return
    missionApi.getMissions()
      .then(res => setMissions(res.missions || []))
      .catch(() => {})
  }, [isAuthenticated])

  const prevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const nextDay = () => {
    const d = new Date(currentDate); d.setDate(d.getDate() + 1)
    if (d <= TODAY) setCurrentDate(d)
  }
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d) }
  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d) }

  const dateLabel = (() => {
    const d = currentDate
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${weekdays[d.getDay()]})`
  })()

  /* 오늘 미션 수행률 (오늘 날짜 볼 때만 표시) */
  const isViewingToday = formatDate(currentDate) === formatDate(TODAY)
  const todayStr = formatDate(TODAY)
  const todayMissions = missions.filter(m => m.mission_date?.slice(0, 10) === todayStr)
  const missionRate = isViewingToday && todayMissions.length > 0
    ? Math.round(todayMissions.filter(m => m.is_completed === 'Y').length / todayMissions.length * 100)
    : undefined

  /* 캘린더 계산 */
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
    return d > new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())
  }
  const isToday = (day) =>
    !!day &&
    currentMonth.getFullYear() === TODAY.getFullYear() &&
    currentMonth.getMonth() === TODAY.getMonth() &&
    day === TODAY.getDate()

  /* 캘린더 날짜별 감정 맵 — Node의 daily_emotions 사용 */
  const calEmotionMap = useMemo(() => {
    const map = {}
    monthlyData?.daily_emotions?.forEach(({ date, selected_emotion }) => {
      const day = new Date(date).getDate()
      map[day] = selected_emotion
    })
    return map
  }, [monthlyData])

  /* 월간 감정 분포 — Node의 emotion_distribution 사용 */
  const emotionSummary = useMemo(() => {
    if (!monthlyData?.emotion_distribution?.length) return []
    const total = monthlyData.emotion_distribution.reduce((s, e) => s + e.score, 0) || 1
    return monthlyData.emotion_distribution
      .filter(e => e.score > 0)
      .map(e => ({ label: e.emotion, pct: Math.round(e.score / total * 100) }))
  }, [monthlyData])

  const topEmotion = useMemo(() => {
    const top = monthlyData?.summary?.top_emotion
    if (!top) return null
    return { label: top, pct: emotionSummary.find(e => e.label === top)?.pct || 0 }
  }, [monthlyData, emotionSummary])

  /* 활동 일수 — Node의 summary.active_days 사용 */
  const activeDays = monthlyData?.summary?.active_days || 0

  /* 월간 감정 변화 — Node의 emotion_trend 사용 */
  const monthlyTrendData = useMemo(() => {
    if (!monthlyData?.emotion_trend?.length) return {}
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    const data = Object.fromEntries(
      Object.keys(EMOTIONS).map(e => [e, Array(daysInMonth).fill(0)])
    )
    const fieldMap = { joy: '기쁨', sad: '슬픔', anxiety: '불안', anger: '분노', hurt: '상처', embarrass: '당황' }
    monthlyData.emotion_trend.forEach(t => {
      const day = new Date(t.date).getDate() - 1
      Object.entries(fieldMap).forEach(([field, label]) => {
        data[label][day] = t[field] || 0
      })
    })
    return data
  }, [monthlyData, currentMonth])

  const hasTrendData = (monthlyData?.summary?.total_sessions || 0) > 0

  /* ── 렌더 ── */
  return (
    <div className="report-screen">

      <StarBg bgClass="rp-bg" starClass="rp-star" positions={['rs1','rs2','rs3','rs4']} />

      <ThemeToggle className="report-theme-toggle" />

      <div className="rp-inner">

        {/* 헤더 */}
        <div className="rp-header">
          <h1 className="rp-title">마음 기록</h1>
        </div>

        {/* 탭 */}
        <div className="rp-tabs">
          <button className={`rp-tab${activeTab === 'daily' ? ' active' : ''}`} onClick={() => setActiveTab('daily')}>오늘의 마음 정리</button>
          <button className={`rp-tab${activeTab === 'monthly' ? ' active' : ''}`} onClick={() => setActiveTab('monthly')}>이번 달 마음 흐름</button>
        </div>

        {/* ═══ 일간 ═══ */}
        {activeTab === 'daily' && (
          <>
            <div className="rp-date-nav">
              <button className="rp-nav-btn" onClick={prevDay}><ChevLeft /></button>
              <span className="rp-date-label">{dateLabel}</span>
              <button className="rp-nav-btn" onClick={nextDay} disabled={formatDate(currentDate) === formatDate(TODAY)}><ChevRight /></button>
            </div>

            {dailyLoading ? (
              <div className="rp-empty"><p>불러오는 중...</p></div>
            ) : dailyReports.length === 0 ? (
              <div className="rp-empty">
                <span className="rp-empty-emoji">🌙</span>
                <p>이 날의 대화 기록이 없어요</p>
              </div>
            ) : (
              <>
                {/* AI 한마디 */}
                {dailyReview && (
                  <div className="rp-session-card rp-ai-review-card">
                    <span className="rp-ai-review-icon">💬</span>
                    <p className="rp-ai-review-text">
                      <strong>달리의 한마디</strong>
                      {dailyReview}
                    </p>
                  </div>
                )}

                {/* 오늘 미션 수행률 (오늘 날짜 조회 시에만) */}
                {missionRate !== undefined && (
                  <div className="rp-session-card">
                    <div className="rp-bar-section">
                      <div className="rp-mission-hdr">
                        <span className="rp-bar-label">오늘의 미션 수행률</span>
                        <span className="rp-mission-pct" style={{ color: missionRate === 100 ? '#5BC479' : '#B39BFF' }}>
                          {missionRate}%
                        </span>
                      </div>
                      <div className="rp-bar rp-bar--track">
                        <div
                          className="rp-bar-seg"
                          style={{
                            width: `${missionRate}%`,
                            background: missionRate === 100
                              ? 'linear-gradient(90deg,#5BC479,#7BCCE8)'
                              : 'linear-gradient(90deg,#7B5FEF,#B39BFF)',
                          }}
                        />
                      </div>
                      <p className="rp-mission-desc">미션은 하루에 한 번 생성돼요</p>
                    </div>
                  </div>
                )}

                {dailyReports.map((r, idx) => {
                  const ue = EMOTIONS[r.selected_emotion]
                  const me = EMOTIONS[r.dominant_emotion]
                  const ratios = toRatios(r)

                  const analyses   = sessionAnalyses[r.session_id] || []
                  const userField  = EMOTION_SCORE_FIELD[r.selected_emotion]
                  const modelField = EMOTION_SCORE_FIELD[r.dominant_emotion]
                  const userScores  = analyses.map(a => +(a[userField]  || 0))
                  const modelScores = analyses.map(a => +(a[modelField] || 0))
                  const userLinePath  = generateTrendLinePath(userScores)
                  const modelLinePath = generateTrendLinePath(modelScores)
                  const analysesLoaded = r.session_id in sessionAnalyses

                  return (
                    <div key={r.report_id} className="rp-session-card">

                      {/* 세션 헤더 */}
                      <div className="rp-session-hdr">
                        <span className="rp-session-num">세션 {idx + 1}</span>
                        <span className="rp-session-time">{formatTime(r.created_at)}</span>
                      </div>

                      {/* 감정 변화 그래프 — 말풍선별 감정 점수 추이 */}
                      <div className="rp-math-compare">
                        <div className="rp-math-header">
                          <div className="rp-math-item">
                            <span className="rp-math-lbl">내가 선택</span>
                            <div className="rp-math-val" style={{ color: ue?.color || '#fff' }}>
                              {r.selected_emotion || '❔'}
                            </div>
                          </div>
                          <div className="rp-math-item right">
                            <span className="rp-math-lbl">달리의 분석</span>
                            <div className="rp-math-val" style={{ color: me?.color || '#fff' }}>
                              {r.dominant_emotion || '❔'}
                            </div>
                          </div>
                        </div>

                        <div className="rp-math-graph">
                          <svg viewBox="0 0 300 100" className="rp-math-svg" preserveAspectRatio="none" overflow="visible">
                            {userLinePath  && <path d={userLinePath}  fill="none" stroke={ue?.color  || '#ccc'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                            {modelLinePath && <path d={modelLinePath} fill="none" stroke={me?.color || '#ccc'} strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />}
                            {analysesLoaded && !userLinePath && !modelLinePath && (
                              <text x="150" y="55" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.35">
                                {analyses.length < 2 ? '대화가 짧아 그래프를 그릴 수 없어요' : '감정 분석 데이터가 없어요'}
                              </text>
                            )}
                            {!analysesLoaded && (
                              <text x="150" y="55" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.35">불러오는 중...</text>
                            )}
                          </svg>
                        </div>
                      </div>

                      {/* 감정 비율 바 */}
                      {ratios.length > 0 && (
                        <div className="rp-bar-section">
                          <span className="rp-bar-label">감정 비율</span>
                          <div className="rp-bar">
                            {ratios.map(rt => (
                              <div key={rt.label} className="rp-bar-seg" style={{ width: `${rt.pct}%`, background: EMOTIONS[rt.label]?.color }} />
                            ))}
                          </div>
                          <div className="rp-legend">
                            {ratios.map(rt => (
                              <span key={rt.label} className="rp-legend-item">
                                <span className="rp-dot" style={{ background: EMOTIONS[rt.label]?.color }} />{rt.label} {rt.pct}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
            <div className="rp-date-nav">
              <button className="rp-nav-btn" onClick={prevMonth}><ChevLeft /></button>
              <span className="rp-date-label">
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </span>
              <button className="rp-nav-btn" onClick={nextMonth}><ChevRight /></button>
            </div>

            {monthlyLoading ? (
              <div className="rp-empty"><p>불러오는 중...</p></div>
            ) : (
              <>
                {/* 감정 캘린더 */}
                <div className="rp-cal-card">
                  <div className="rp-cal-head">
                    {DAY_LABELS.map((l, i) => (
                      <span key={i} className={`rp-cal-hlabel${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{l}</span>
                    ))}
                  </div>
                  <div className="rp-cal-body">
                    {calCells.map((day, i) => {
                      const future  = isFutureDay(day)
                      const emotion = day && !future ? calEmotionMap[day] : null
                      const em      = emotion ? EMOTIONS[emotion] : null
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
                    <span className="rp-sum-val">{monthlyData?.summary?.total_sessions || 0}<span className="rp-sum-unit">회</span></span>
                  </div>
                  <div className="rp-sum-card">
                    <span className="rp-sum-label">최다 감정</span>
                    <span className="rp-sum-val" style={{ color: EMOTIONS[topEmotion?.label]?.color }}>
                      {topEmotion ? `${EMOTIONS[topEmotion.label]?.emoji} ${topEmotion.label}` : '-'}
                    </span>
                  </div>
                  <div className="rp-sum-card">
                    <span className="rp-sum-label">활동 일수</span>
                    <span className="rp-sum-val">{activeDays || '-'}{activeDays ? <span className="rp-sum-unit">일</span> : ''}</span>
                  </div>
                </div>

                {/* 감정 분포 */}
                {emotionSummary.length > 0 && (
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
                )}

                {/* 월간 감정 변화 */}
                {hasTrendData && (
                  <div className="rp-data-card">
                    <h3 className="rp-data-title">월간 감정 변화</h3>
                    <div className="rp-trend-graph">
                      <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                        {Object.entries(monthlyTrendData).map(([emotion, data]) => {
                          const isFocused = focusEmotion === emotion
                          const isOther   = focusEmotion && !isFocused
                          const path      = generateTrendLinePath(data)
                          if (!path) return null
                          return (
                            <path
                              key={emotion}
                              d={path}
                              stroke={EMOTIONS[emotion]?.color || '#ccc'}
                              strokeWidth={isFocused ? 3 : isOther ? 1 : 2.5}
                              opacity={isOther ? 0.15 : 1}
                              fill="none"
                              style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                            />
                          )
                        })}
                      </svg>
                    </div>
                    {focusEmotion && (
                      <p className="rp-trend-focus-label" style={{ color: EMOTIONS[focusEmotion]?.color }}>
                        {EMOTIONS[focusEmotion]?.emoji} {focusEmotion}
                      </p>
                    )}
                    <div className="rp-legend" style={{ marginTop: 10 }}>
                      {Object.keys(EMOTIONS).map(label => (
                        <span
                          key={label}
                          className={`rp-legend-item rp-legend-btn${focusEmotion === label ? ' active' : ''}`}
                          style={{ opacity: focusEmotion && focusEmotion !== label ? 0.35 : 1 }}
                          onClick={() => setFocusEmotion(prev => prev === label ? null : label)}
                        >
                          <span className="rp-dot" style={{ background: EMOTIONS[label]?.color }} />{label}
                        </span>
                      ))}
                    </div>
                    {focusEmotion && (
                      <button className="rp-trend-reset" onClick={() => setFocusEmotion(null)}>전체 보기</button>
                    )}
                  </div>
                )}

                {!hasTrendData && (
                  <div className="rp-empty">
                    <span className="rp-empty-emoji">🌙</span>
                    <p>이번 달 대화 기록이 없어요</p>
                  </div>
                )}

                {/* 감정 주의 신호 이력 */}
                <div className="rp-alert-card">
                  <div className="rp-alert-hdr">
                    <h3 className="rp-data-title">감정 주의 신호 이력</h3>
                    <span className="rp-alert-count">{alerts.length}건</span>
                  </div>
                  <p className="rp-alert-desc">같은 부정 감정이 5일 연속 감지될 때 기록돼요</p>

                  {alerts.length === 0 ? (
                    <div className="rp-alert-empty">
                      <span>🌙</span>
                      <span>이번 달 주의 신호가 없어요</span>
                    </div>
                  ) : (
                    <div className="rp-alert-list">
                      {alerts.map(alert => {
                        const emotion   = alert.alerted_emotion || alert.alerts_emotion
                        const reason    = alert.alert_reason    || alert.alerts_reason
                        const alertDate = new Date(alert.alerted_at || alert.created_at).toLocaleDateString('ko-KR')
                        const confirmed = alert.is_confirmed === 'Y'
                        const em = EMOTIONS[emotion]
                        return (
                          <div key={alert.e_alert_id} className={`rp-alert-item${confirmed ? ' confirmed' : ''}`}>
                            <div className="rp-alert-icon" style={{ background: em?.bg, borderColor: (em?.color || '#aaa') + '55' }}>
                              <span>{em?.emoji || '⚠️'}</span>
                            </div>
                            <div className="rp-alert-body">
                              <div className="rp-alert-top">
                                <span className="rp-alert-emotion" style={{ color: em?.color }}>{emotion}</span>
                                <span className="rp-alert-reason">{reason}</span>
                              </div>
                              <span className="rp-alert-date">{alertDate}</span>
                            </div>
                            <span className={`rp-alert-badge${confirmed ? ' confirmed' : ''}`}>
                              {confirmed ? '확인됨' : '미확인'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}

export default Report
