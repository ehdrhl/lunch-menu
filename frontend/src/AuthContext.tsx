import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { me, type User } from './api/auth'
import { setUnauthorizedHandler } from './api/client'
import { getToken, setToken } from './lib'

interface AuthState {
  user: User | null
  loading: boolean // 저장된 로그인을 서버에 확인하는 중
  signIn: (token: string, user: User) => void
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])
  const signIn = useCallback((token: string, u: User) => {
    setToken(token)
    setUser(u)
  }, [])

  // 저장된 로그인이 있으면 서버에 확인한다. 만료·변조면 지운다.
  useEffect(() => {
    if (getToken() === null) return
    let alive = true
    me()
      .then((u) => alive && setUser(u))
      .catch((e) => {
        if (alive && (e as { status?: number }).status === 401) setToken(null)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // 로그인이 만료되면(서버 401) 로그인 화면으로 보낸다.
  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 안에서만 쓸 수 있습니다.')
  return ctx
}
