// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../AuthContext'

const user = { id: 1, username: 'yujin01', nickname: '유진' }
let store: Record<string, string>
let calls: { method: string; url: string; body?: unknown; auth?: string }[]
let handler: (url: string, method: string, body: any) => Response

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  store = {}
  calls = []
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  })
  handler = (url, method) => {
    if (url === '/api/auth/me') return json(user)
    if (url === '/api/restaurants') return json([])
    if (url === '/api/categories') return json([])
    return json({ detail: 'unexpected' }, 500)
  }
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method ?? 'GET', url, body, auth: headers.Authorization })
    return handler(url, init.method ?? 'GET', body)
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const flush = () => act(async () => {})
async function open(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  await flush()
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('로그인 필수', () => {
  it('로그인하지 않으면 어느 주소든 로그인 화면으로 간다', async () => {
    await open('/restaurants')
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(calls.some((c) => c.url.startsWith('/api/restaurants'))).toBe(false) // 로그인 전에는 데이터를 부르지 않는다
  })

  it('저장된 로그인이 있으면 서버에 확인한 뒤 화면을 보여 주고, 상단에 닉네임과 로그아웃이 있다', async () => {
    store.authToken = 'saved-token'
    await open('/')
    expect(calls[0]).toMatchObject({ url: '/api/auth/me', auth: 'Bearer saved-token' })
    expect(screen.getByLabelText('닉네임').textContent).toBe('유진')
    expect(screen.getByRole('link', { name: '추천' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '설정' })).toBeNull()
  })

  it('만료·변조된 로그인(서버 401)은 지우고 로그인 화면으로 보낸다', async () => {
    store.authToken = 'old-token'
    handler = () => json({ detail: '로그인이 필요합니다.' }, 401)
    await open('/')
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(store.authToken).toBeUndefined()
  })

  it('사용 중 서버가 401을 주면(만료) 자동으로 로그인 화면으로 간다', async () => {
    store.authToken = 'saved-token'
    await open('/')
    handler = () => json({ detail: '로그인이 필요합니다.' }, 401)
    fireEvent.click(screen.getByRole('link', { name: '목록' }))
    await flush()
    await flush()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(store.authToken).toBeUndefined()
  })

  it('로그아웃하면 저장된 로그인이 지워지고 로그인 화면으로 간다', async () => {
    store.authToken = 'saved-token'
    await open('/')
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await flush()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(store.authToken).toBeUndefined()
  })
})

describe('로그인 화면', () => {
  it('아이디·비밀번호로 로그인하면 토큰을 저장하고 원래 가려던 화면으로 간다', async () => {
    handler = (url, method, body) =>
      url === '/api/auth/login' ? json({ token: 'new-token', user }) : url === '/api/restaurants' ? json([]) : json([])
    await open('/history')
    type('아이디', ' YuJin01 ')
    type('비밀번호', 'password1')
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    await flush()
    await flush()
    expect(calls.find((c) => c.url === '/api/auth/login')!.body).toEqual({ username: 'YuJin01', password: 'password1' })
    expect(store.authToken).toBe('new-token')
    expect(screen.getByRole('heading', { name: '뽑기 기록' })).toBeTruthy()
  })

  it('틀리면 서버 문구를 그대로 보여 주고 로그인되지 않는다', async () => {
    handler = () => json({ detail: '아이디 또는 비밀번호가 맞지 않아요.' }, 401)
    await open('/login')
    type('아이디', 'yujin01')
    type('비밀번호', 'wrong-password')
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    await flush()
    expect(screen.getByRole('alert').textContent).toBe('아이디 또는 비밀번호가 맞지 않아요.')
    expect(store.authToken).toBeUndefined()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy() // 로그인 시도의 401은 '만료'로 취급하지 않는다
  })

  it('회원가입 화면으로 가는 링크가 있다', async () => {
    await open('/login')
    fireEvent.click(screen.getByRole('link', { name: '회원가입' }))
    await flush()
    expect(screen.getByRole('heading', { name: '회원가입' })).toBeTruthy()
  })
})

describe('회원가입 화면', () => {
  const fill = (over: Partial<Record<'아이디' | '비밀번호' | '비밀번호 확인' | '닉네임', string>> = {}) => {
    const v = { 아이디: 'yujin01', 비밀번호: 'password1', '비밀번호 확인': 'password1', 닉네임: '유진', ...over }
    for (const [label, value] of Object.entries(v)) type(label, value)
  }
  const submit = () => screen.getByRole('button', { name: '가입하기' }) as HTMLButtonElement

  it('조건을 채우면 가입하고, 가입이 끝나면 바로 로그인되어 추천 화면으로 간다', async () => {
    handler = (url) => (url === '/api/auth/signup' ? json({ token: 'fresh', user }, 201) : json([]))
    await open('/signup')
    expect(submit().disabled).toBe(true)
    fill({ 아이디: 'YuJin01', 닉네임: ' 유진 ' })
    expect(submit().disabled).toBe(false)
    fireEvent.click(submit())
    await flush()
    await flush()
    expect(calls.find((c) => c.url === '/api/auth/signup')!.body).toEqual({ username: 'yujin01', password: 'password1', nickname: '유진' })
    expect(store.authToken).toBe('fresh')
    expect(screen.getByLabelText('닉네임').textContent).toBe('유진')
  })

  it('아이디 형식, 비밀번호 길이, 비밀번호 확인이 맞지 않으면 안내하고 가입을 막는다', async () => {
    await open('/signup')
    fill({ 아이디: 'ab' })
    expect(screen.getByRole('alert').textContent).toContain('아이디')
    expect(submit().disabled).toBe(true)
    fill({ 아이디: '한글아이디' })
    expect(submit().disabled).toBe(true)
    fill({ 비밀번호: 'short', '비밀번호 확인': 'short' })
    expect(screen.getByRole('alert').textContent).toContain('비밀번호는 8~64자')
    expect(submit().disabled).toBe(true)
    fill({ 비밀번호: 'password1', '비밀번호 확인': 'password2' })
    expect(screen.getByRole('alert').textContent).toContain('서로 달라요')
    expect(submit().disabled).toBe(true)
    fill({ 닉네임: '   ' })
    expect(submit().disabled).toBe(true)
    expect(calls.some((c) => c.url === '/api/auth/signup')).toBe(false)
  })

  it('이미 있는 아이디면 서버의 안내를 보여 준다', async () => {
    handler = () => json({ detail: '이미 사용 중인 아이디입니다.' }, 409)
    await open('/signup')
    fill()
    fireEvent.click(submit())
    await flush()
    expect(screen.getByRole('alert').textContent).toBe('이미 사용 중인 아이디입니다.')
    expect(store.authToken).toBeUndefined()
  })
})
