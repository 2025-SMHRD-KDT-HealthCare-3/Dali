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
