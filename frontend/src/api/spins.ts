import { request } from './client'
import type { Restaurant } from './restaurants'

export interface SpinFilter {
  categories: string[]
  tags: string[]
}

export interface SpinResult {
  restaurant: Restaurant
}

export const spin = (filter: SpinFilter) => request<SpinResult>('POST', '/spins', filter)

export interface SpinHistoryItem {
  id: number
  created_at: string
  restaurant: Restaurant | null // 식당이 삭제됐으면 null
  filter: SpinFilter
}
export const listSpins = (limit = 100) => request<SpinHistoryItem[]>('GET', `/spins?limit=${limit}`)
