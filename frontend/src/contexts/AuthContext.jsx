import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/auth'
import { userApi } from '../api/user'
import { setAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    // 네이버/카카오 리다이렉트 콜백 시 단기 쿠키로 access_token 전달됨 (httpOnly: false, 30초)
    const snsCookie = document.cookie.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('sns_access_token='))

    if (snsCookie) {
      const snsToken = snsCookie.split('=').slice(1).join('=')
      document.cookie = 'sns_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      setAccessToken(snsToken)
      setIsAuthenticated(true)
      userApi.getMe()
        .then(res => { if (res.user) setUser(res.user) })
        .catch(() => {})
        .finally(() => setAuthLoading(false))
      return
    }

    authApi.refresh()
      .then(async res => {
        if (res.access_token) {
          setAccessToken(res.access_token)
          setIsAuthenticated(true)
          try {
            const meRes = await userApi.getMe()
            if (meRes.user) setUser(meRes.user)
          } catch {}
        }
      })
      .catch(() => {
        setAccessToken(null)
      })
      .finally(() => {
        setAuthLoading(false)
      })
  }, [])

  function login(token, userData) {
    setAccessToken(token)
    setIsAuthenticated(true)
    if (userData) setUser(userData)
  }

  async function logout() {
    try { await authApi.logout() } catch {}
    setAccessToken(null)
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, setUser, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
