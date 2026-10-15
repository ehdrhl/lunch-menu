import { request } from './client'

export interface User {
  id: number
  username: string
  nickname: string
}
export interface AuthResult {
  token: string
  user: User
}

export const signup = (username: string, password: string, nickname: string) =>
  request<AuthResult>('POST', '/auth/signup', { username, password, nickname })
export const login = (username: string, password: string) => request<AuthResult>('POST', '/auth/login', { username, password })
export const me = () => request<User>('GET', '/auth/me')
