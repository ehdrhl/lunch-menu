import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { login, signup } from '../api/auth'
import { errorMessage } from '../api/client'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const out = await login(username.trim(), password)
      signIn(out.token, out.user)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container landing">
      <h1>🍽️ 오늘 뭐 먹지?</h1>
      <p className="muted">로그인하고 나만의 맛집으로 점심 메뉴를 정해요.</p>
      <form className="card auth-form" onSubmit={submit}>
        <h2>로그인</h2>
        <label>
          아이디
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required autoFocus />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy || !username.trim() || !password}>로그인</button>
      </form>
      <p className="muted auth-switch">
        처음이세요? <Link to="/signup">회원가입</Link>
      </p>
    </main>
  )
}
