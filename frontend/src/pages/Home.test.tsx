// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Restaurant } from '../api/restaurants'
import { REVEAL_MS, SHUFFLE_MS } from '../draw'
import { sound } from '../sound'
import Home from './Home'

const make = (id: number, name: string, category_name: string, tags: string[] = []): Restaurant => ({
  id, name, category_id: id, category_name, tags, link_url: 'https://naver.me/x', memo: null, mine: id !== 1, warning: null,
})
const categories = [{ id: 1, name: '한식' }, { id: 2, name: '일식' }]

// 가짜 서버: 화면이 부르는 API에 답하고, 호출 기록을 남긴다.
interface Server {
  restaurants: Restaurant[]
  calls: { method: string; url: string; body?: { categories: string[]; tags: string[] } }[]
  pick: (n: number) => Restaurant | null // n번째 스핀 결과(null이면 404)
  spins: number
  history: (Restaurant | null)[] // 서버에 남은 뽑기 기록(오래된 것부터). null은 삭제된 식당
}
let server: Server

beforeEach(() => {
  vi.useFakeTimers()
  server = { restaurants: [make(1, '비빔밥', '한식', ['싸다']), make(2, '스시로', '일식', ['비쌈'])], calls: [], spins: 0, history: [], pick: () => server.restaurants[0] }
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    server.calls.push({ method, url, body: init.body ? JSON.parse(init.body as string) : undefined })
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (url.endsWith('/categories')) return json(categories)
    if (url.startsWith('/api/restaurants')) return json(server.restaurants)
    if (url.endsWith('/spins') && method === 'POST') {
      const r = server.pick(++server.spins)
      if (r) server.history.push(r)
      return r ? json({ restaurant: r }) : json({ detail: '조건에 맞는 식당이 없습니다.' }, 404)
    }
    if (url.startsWith('/api/spins')) {
      const limit = Number(new URL(url, 'http://x').searchParams.get('limit') ?? 100)
      const items = server.history.map((restaurant, i) => ({ id: i + 1, created_at: '2026-10-15T12:00:00', restaurant, filter: { categories: [], tags: [] } }))
      return json(items.reverse().slice(0, limit))
    }
    return json({ detail: 'unexpected' }, 500)
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const flush = (ms = 20) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const renderHome = async () => {
  render(<MemoryRouter><Home /></MemoryRouter>)
  await flush()
}
const spinCalls = () => server.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/spins'))
const rouletteStart = () => screen.getByRole('button', { name: /룰렛 돌리기|다시 뽑기/ })

describe('Home: 추천 화면', () => {
  it('열면 지난 결과 없이 룰렛과 조건이 처음 상태로 보이고, 후보 수를 알려 준다', async () => {
    await renderHome()
    expect(document.querySelector('.roulette')).toBeTruthy()
    expect(screen.getByLabelText('조건 검색')).toBeTruthy()
    expect(screen.queryByLabelText('결과')).toBeNull()
    expect(screen.queryByLabelText('최근 뽑기')).toBeNull()
    expect(screen.getByRole('button', { name: /룰렛 돌리기/ })).toBeTruthy()
    expect(screen.getByText('후보 2곳')).toBeTruthy()
    expect(screen.queryByText(/뽑기 시작/)).toBeNull() // 팀 시절의 '뽑기 시작' 단계는 없다
  })

  it('식당이 하나도 없으면 룰렛 대신 등록 안내를 보여 준다', async () => {
    server.restaurants = []
    await renderHome()
    expect(screen.getByText(/식당을 등록해 보세요/)).toBeTruthy()
    expect(document.querySelector('.roulette')).toBeNull()
  })

  it('조건을 고르면 후보 수가 바뀌고, 서버에 그 조건으로 요청한다', async () => {
    server.pick = () => server.restaurants[1]
    await renderHome()
    fireEvent.focus(screen.getByLabelText('조건 검색'))
    fireEvent.click(screen.getByRole('button', { name: '일식' }))
    expect(screen.getByText('후보 1곳')).toBeTruthy()
    fireEvent.click(rouletteStart())
    await flush()
    expect(spinCalls()[0].body).toEqual({ categories: ['일식'], tags: [] })
    // 칩을 누르면 조건에서 빠진다
    await flush(SHUFFLE_MS + 100)
    fireEvent.keyDown(window, { key: 'Escape' })
    await flush()
    fireEvent.click(within(screen.getByRole('group', { name: '고른 조건' })).getByRole('button', { name: '일식 빼기' }))
    expect(screen.getByText('후보 2곳')).toBeTruthy()
  })

  it('룰렛이 도는 동안 결과를 숨기고, 멈추면 결과 연출 → 결과 카드 순서로 서버 결과를 공개한다', async () => {
    const start = vi.spyOn(sound, 'startShuffle').mockImplementation(() => {})
    const reveal = vi.spyOn(sound, 'playReveal').mockImplementation(() => {})
    await renderHome()
    fireEvent.click(rouletteStart())
    await flush()
    expect(document.querySelector('.wheel.shuffle')).toBeTruthy()
    expect(start).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('결과')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('button', { name: /뽑는 중/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('조건 검색') as HTMLInputElement).disabled).toBe(true)
    await flush(SHUFFLE_MS)
    expect(document.querySelector('.wheel.shuffle')).toBeNull()
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: '추첨 결과' }).querySelector('.reveal-name')!.textContent).toBe('비빔밥')
    await flush(REVEAL_MS + 100)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.result-name')!.textContent).toBe('비빔밥')
    expect(document.querySelector('.category-badge')!.textContent).toBe('한식')
    expect(screen.getByRole('button', { name: /다시 뽑기/ })).toBeTruthy()
  })

  it('조건에 맞는 식당이 없으면 뽑기가 비활성이고 안내가 나온다', async () => {
    await renderHome()
    fireEvent.change(screen.getByLabelText('조건 검색'), { target: { value: '일식' } })
    fireEvent.click(screen.getByRole('button', { name: '일식' }))
    fireEvent.change(screen.getByLabelText('조건 검색'), { target: { value: '#싸다' } })
    fireEvent.click(screen.getByRole('button', { name: '#싸다' }))
    expect(screen.getByText(/조건에 맞는 식당이 없어요/)).toBeTruthy() // 일식이면서 #싸다인 식당은 없다
    expect((rouletteStart() as HTMLButtonElement).disabled).toBe(true)
  })

  it('서버가 거절하면(404) 오류 문구를 보여 주고 룰렛은 돌지 않는다', async () => {
    server.pick = () => null
    await renderHome()
    fireEvent.click(rouletteStart())
    await flush()
    expect(screen.getByRole('alert').textContent).toContain('조건에 맞는 식당이 없습니다')
    expect(document.querySelector('.wheel.shuffle')).toBeNull()
  })

  it('룰렛이 멈출 때마다 오른쪽에 최근 뽑기가 최신순으로 쌓이고, 8건을 넘으면 오래된 것부터 사라진다', async () => {
    server.pick = (n) => make(100 + n, `식당${n}`, '한식')
    await renderHome()
    for (let i = 0; i < 9; i++) {
      fireEvent.click(rouletteStart())
      await flush()
      await flush(SHUFFLE_MS + 100)
      fireEvent.keyDown(window, { key: 'Escape' })
      await flush()
    }
    const items = within(screen.getByLabelText('최근 뽑기')).getAllByRole('listitem')
    expect(items).toHaveLength(8)
    expect(items[0].textContent).toContain('식당9')
    expect(items[7].textContent).toContain('식당2')
    expect(screen.queryByText('식당1')).toBeNull()
  })

  it('다시 열면 지난 결과 카드는 사라지지만 최근 뽑기는 서버 기록에서 다시 불러와 그대로 남는다', async () => {
    const first = render(<MemoryRouter><Home /></MemoryRouter>)
    await flush()
    fireEvent.click(rouletteStart())
    await flush()
    await flush(SHUFFLE_MS + 100)
    fireEvent.keyDown(window, { key: 'Escape' })
    await flush()
    expect(document.querySelector('.result-name')).toBeTruthy()
    first.unmount()
    await renderHome()
    expect(document.querySelector('.result-name')).toBeNull() // 결과 카드는 처음 상태
    const items = within(screen.getByLabelText('최근 뽑기')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['비빔밥한식']) // 기록은 지워지지 않았다
    expect(screen.getByRole('button', { name: /룰렛 돌리기/ })).toBeTruthy()
  })

  it('최근 뽑기는 열 때 서버 기록의 최근 8건을 최신순으로 보여 주고, 새로 뽑아도 8건을 넘기 전에는 하나도 지우지 않는다', async () => {
    server.history = [1, 2, 3].map((n) => make(100 + n, `옛식당${n}`, '한식')) // 오래된 것부터
    server.pick = (n) => make(200 + n, `새식당${n}`, '일식')
    await renderHome()
    const names = () => within(screen.getByLabelText('최근 뽑기')).getAllByRole('listitem').map((li) => li.querySelector('.recent-name')!.textContent)
    expect(names()).toEqual(['옛식당3', '옛식당2', '옛식당1'])
    for (let i = 1; i <= 5; i++) {
      fireEvent.click(rouletteStart())
      await flush()
      await flush(SHUFFLE_MS + 100)
      fireEvent.keyDown(window, { key: 'Escape' })
      await flush()
      expect(names()).toHaveLength(Math.min(3 + i, 8)) // 8건이 되기 전까지는 줄지 않는다
    }
    expect(names()).toEqual(['새식당5', '새식당4', '새식당3', '새식당2', '새식당1', '옛식당3', '옛식당2', '옛식당1'])
    fireEvent.click(rouletteStart())
    await flush()
    await flush(SHUFFLE_MS + 100)
    fireEvent.keyDown(window, { key: 'Escape' })
    await flush()
    expect(names()).toEqual(['새식당6', '새식당5', '새식당4', '새식당3', '새식당2', '새식당1', '옛식당3', '옛식당2']) // 9번째부터 가장 오래된 것만 밀려난다
  })

  it('최근 뽑기 항목을 누르면 그 식당 상세 주소로 이동하고, 삭제된 식당은 누를 수 없다', async () => {
    server.history = [null, make(77, '쌀국수', '아시안')]
    await renderHome()
    const panel = within(screen.getByLabelText('최근 뽑기'))
    const link = panel.getByRole('link', { name: /쌀국수/ }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/restaurants/77')
    expect(panel.getByText('삭제된 식당').closest('a')).toBeNull()
    expect(panel.getAllByRole('link')).toHaveLength(1)
  })
})
