import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import RestaurantDetail from './pages/RestaurantDetail'
import Restaurants from './pages/Restaurants'
import Signup from './pages/Signup'

/** 로그인·가입 화면: 이미 로그인했으면(방금 로그인한 경우 포함) 원래 가려던 화면으로 보낸다. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  return user ? <Navigate to={from} replace /> : children
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <main className="container"><p>불러오는 중…</p></main>
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="history" element={<History />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
