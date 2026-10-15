import { request } from './client'

export interface Category {
  id: number
  name: string
}

export interface Restaurant {
  id: number
  name: string
  category_id: number
  category_name: string
  tags: string[]
  link_url: string | null
  memo: string | null
  mine: boolean // 내가 등록한 식당(기본 식당은 false라 고치거나 지울 수 없다)
  warning: string | null
}

export interface RestaurantInput {
  name: string
  category_id: number
  tags: string[]
  link_url: string | null
  memo: string | null
}

export interface RestaurantQuery {
  q?: string
  category?: number[] // 여러 개를 함께 고를 수 있다
  tag?: string
}

export const listCategories = () => request<Category[]>('GET', '/categories')

export function listRestaurants(query: RestaurantQuery = {}) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  for (const id of query.category ?? []) params.append('category', String(id))
  if (query.tag) params.set('tag', query.tag)
  const qs = params.toString()
  return request<Restaurant[]>('GET', `/restaurants${qs ? `?${qs}` : ''}`)
}
export const getRestaurant = (id: number) => request<Restaurant>('GET', `/restaurants/${id}`)
export const createRestaurant = (body: RestaurantInput) => request<Restaurant>('POST', '/restaurants', body)
export const updateRestaurant = (id: number, body: RestaurantInput) => request<Restaurant>('PUT', `/restaurants/${id}`, body)
export const deleteRestaurant = (id: number) => request<void>('DELETE', `/restaurants/${id}`)
