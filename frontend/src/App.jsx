import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import Leftpanel from './features/Public/Leftpanel'
import Footer    from './features/Public/Footer'
import Auth      from './features/Auth/Auth'
import Splash    from './features/Splash/Splash'
import Main      from './features/Main/Main'
import Chat      from './features/Chat/Chat'
import Settings  from './features/Settings/Settings'
import Mission      from './features/Mission/Mission'
import Report       from './features/Report/Report'
import Onboarding   from './features/Onboarding/Onboarding'
import Info         from './features/Info/Info'

const FOOTER_PATHS = ['/main', '/report', '/mission', '/settings']

function App() {
  const { pathname } = useLocation()
  const showFooter = FOOTER_PATHS.includes(pathname)

  return (
    <div className="app-layout">
      <Leftpanel />
      <div className="app-content">
        <Routes>
          <Route path="/"        element={<Splash />} />
          <Route path="/auth"    element={<Auth />} />
          <Route path="/main"    element={<Main />} />
          <Route path="/chat"     element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/mission"     element={<Mission />} />
          <Route path="/report"      element={<Report />} />
          <Route path="/onboarding"  element={<Onboarding />} />
          <Route path="/info"        element={<Info />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
        {showFooter && <Footer />}
      </div>
    </div>
  )
}

export default App
