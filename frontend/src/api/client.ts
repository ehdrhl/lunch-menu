import { getToken } from '../lib'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// 로그인이 만료되어 서버가 401을 주면 알린다(AuthContext가 로그인 화면으로 보낸다). 로그인·가입 요청의 401은 제외한다.
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let res: Response
  const token = getToken()
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? { ...auth, ...headers } : { 'Content-Type': 'application/json', ...auth, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  }
  if (!res.ok) {
    let message = `요청에 실패했습니다. (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      /* 본문이 JSON이 아니면 기본 메시지 */
    }
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) onUnauthorized?.()
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))
