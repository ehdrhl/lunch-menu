// 브라우저에 저장하는 값: 로그인 토큰
const TOKEN_KEY = 'authToken'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(token: string | null) {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)에서는 무시 */
  }
}
