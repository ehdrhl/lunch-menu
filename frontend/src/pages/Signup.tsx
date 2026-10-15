import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { login, signup } from '../api/auth'
import { errorMessage } from '../api/client'
import { useAuth } from '../AuthContext'

const USERNAME_RE = /^[a-z0-9_]{4,20}$/

export default function Signup() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = username.trim().toLowerCase()
  const problem = !name
    ? null
    : !USERNAME_RE.test(name)
      ? '아이디는 영문 소문자·숫자·밑줄 4~20자로 입력해 주세요.'
      : password && (password.length < 8 || password.length > 64)
        ? '비밀번호는 8~64자로 입력해 주세요.'
        : confirm && confirm !== password
          ? '비밀번호가 서로 달라요.'
          : null
  const ready = USERNAME_RE.test(name) && password.length >= 8 && password.length <= 64 && confirm === password && nickname.trim().length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const out = await signup(name, password, nickname.trim())
      signIn(out.token, out.user) // 가입하면 바로 로그인된다(App이 추천 화면으로 보낸다)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container landing">
      <h1>🍽️ 오늘 뭐 먹지?</h1>
      <p className="muted">가입하면 기본 맛집으로 바로 시작하고, 나만의 맛집을 더할 수 있어요.</p>
      <form className="card auth-form" onSubmit={submit}>
        <h2>회원가입</h2>
        <label>
          아이디
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="영문 소문자·숫자·밑줄 4~20자" maxLength={20} autoComplete="username" autoCapitalize="none" required autoFocus />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8~64자" maxLength={64} autoComplete="new-password" required />
        </label>
        <label>
          비밀번호 확인
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={64} autoComplete="new-password" required />
        </label>
        <label>
          닉네임
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} required />
        </label>
        <p className="muted small">비밀번호를 잊으면 찾을 수 없어요(이메일을 받지 않아요). 꼭 기억해 주세요.</p>
        {(problem || error) && <p className="error" role="alert">{error ?? problem}</p>}
        <button disabled={busy || !ready}>가입하기</button>
      </form>
      <p className="muted auth-switch">
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </p>
    </main>
  )
}
