// 시간 포맷 유틸리티
// Chat.jsx now(), Onboarding.jsx nowStr(), Report.jsx timeLabel()을 하나로 통합

// 오전/오후 HH:MM 형식 반환
// d 생략 시 현재 시각, ISO 문자열 또는 Date 객체 모두 허용
export const formatTime = (d = new Date()) => {
  const date = typeof d === 'string' ? new Date(d) : d
  const hh = date.getHours()
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mm}`
}
