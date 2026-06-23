// 공통 fetch 래퍼 — 토큰 관리, 401 자동 재시도, ApiError 정의

const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`

/* ── 액세스 토큰 (메모리 보관, 새로고침 시 초기화) ── */
let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

/* ── 커스텀 에러 클래스 ── */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.message = message
  }
}

/* ── 토큰 재발급 시도 ── */
// 성공 시 새 토큰을 메모리에 저장하고 true 반환, 실패 시 false
async function tryRefresh() {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.access_token) {
      setAccessToken(data.access_token)
      return true
    }
    return false
  } catch {
    return false
  }
}

/* ── 공통 요청 함수 ── */
// auth:    true 이면 Authorization 헤더 추가 (기본값)
// retry:   401 시 토큰 재발급 후 1회 재시도 여부 (무한루프 방지)
// rawBody: true 이면 Content-Type 생략 + body를 JSON.stringify 하지 않음 (FormData 전송용)
async function request(path, { method = 'GET', body, auth = true, retry = true, rawBody = false } = {}) {
  const headers = rawBody ? {} : { 'Content-Type': 'application/json' }

  if (auth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include', // httpOnly 쿠키 자동 전송
    headers,
    ...(body !== undefined ? { body: rawBody ? body : JSON.stringify(body) } : {}),
  })

  // 응답 파싱 (JSON / 텍스트 자동 구분) — 401 코드 확인을 위해 먼저 파싱
  let data
  const contentType = res.headers.get('Content-Type') || ''
  try {
    data = contentType.includes('application/json') ? await res.json() : await res.text()
  } catch {
    data = null
  }

  // 401 처리
  if (res.status === 401 && auth) {
    // 다른 기기 로그인으로 세션 교체 → 토큰 비우고 로그인 화면으로
    if (data?.code === 'SESSION_REPLACED') {
      _accessToken = null
      sessionStorage.setItem('auth_notice', '다른 기기에서 로그인되어 자동으로 로그아웃되었습니다.')
      window.location.replace('/auth')
      throw new ApiError(401, 'SESSION_REPLACED', data.message)
    }
    // 일반 401 → 재발급 성공 시 원래 요청 1회 재시도
    if (retry) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        return request(path, { method, body, auth, retry: false, rawBody })
      }
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.code ?? 'UNKNOWN_ERROR',
      data?.message ?? '알 수 없는 오류가 발생했습니다.',
    )
  }

  return data
}

/* ── HTTP 메서드 헬퍼 ── */
// options 로 { auth: false } 등 request 옵션 전달 가능
export const api = {
  get:      (path, options)          => request(path, { ...options, method: 'GET' }),
  post:     (path, body, options)    => request(path, { ...options, method: 'POST', body }),
  put:      (path, body, options)    => request(path, { ...options, method: 'PUT', body }),
  patch:    (path, body, options)    => request(path, { ...options, method: 'PATCH', body }),
  delete:   (path, options)          => request(path, { ...options, method: 'DELETE' }),
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', body: formData, rawBody: true }),
}
