import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import { useAuth } from './contexts/AuthContext'
import Leftpanel  from './features/Public/Leftpanel'
import Footer     from './features/Public/Footer'
import Auth       from './features/Auth/Auth'
import Splash     from './features/Splash/Splash'
import Main       from './features/Main/Main'
import Chat       from './features/Chat/Chat'
import Settings   from './features/Settings/Settings'
import Mission    from './features/Mission/Mission'
import Report     from './features/Report/Report'
import Onboarding from './features/Onboarding/Onboarding'
import Info           from './features/Info/Info'
import DataManagement       from './features/DataManagement/DataManagement'
import NotificationSettings from './features/NotificationSettings/NotificationSettings'

const FOOTER_PATHS = ['/main', '/report', '/mission', '/settings']

function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return null
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (authLoading) return null
  if (isAuthenticated) return <Navigate to="/main" replace />
  return children
}

function App() {
  const { pathname } = useLocation()
  const { authLoading } = useAuth()
  const showFooter = FOOTER_PATHS.includes(pathname)

  if (authLoading) {
    return (
      <div className="auth-loading">
        <span className="auth-loading-spinner" />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Leftpanel />
      <div className="app-content">
        <Routes>
          <Route path="/"           element={<PublicOnlyRoute><Splash /></PublicOnlyRoute>} />
          <Route path="/auth"       element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
          <Route path="/main"       element={<Main />} />
          <Route path="/chat"       element={<Chat />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/info"       element={<ProtectedRoute><Info /></ProtectedRoute>} />
          <Route path="/settings"   element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/mission"    element={<ProtectedRoute><Mission /></ProtectedRoute>} />
          <Route path="/report"     element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/data"          element={<ProtectedRoute><DataManagement /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
        {showFooter && <Footer />}
      </div>
    </div>
  )
}

export default App
