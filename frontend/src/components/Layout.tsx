import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import SoundToggle from './SoundToggle'

/** 로그인한 사용자의 공통 화면 틀(상단 내비게이션). 로그인하지 않았으면 로그인 화면으로 보낸다. */
export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-title">🍽️ 오늘 뭐 먹지?</Link>
          <nav>
            <NavLink to="/" end>추천</NavLink>
            <NavLink to="/restaurants">목록</NavLink>
            <NavLink to="/history">기록</NavLink>
          </nav>
          <span className="nav-right">
            <SoundToggle />
            <span className="muted" aria-label="닉네임">{user.nickname}</span>
            <button className="link" onClick={signOut}>로그아웃</button>
          </span>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
