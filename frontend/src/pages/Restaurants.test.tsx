// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Restaurants from './Restaurants'

const categories = [{ id: 1, name: '한식' }, { id: 2, name: '일식' }, { id: 3, name: '분식' }]
const all = [
  { id: 1, name: '비빔밥', category_id: 1, category_name: '한식', tags: ['싸다'], link_url: null, memo: null, mine: true, warning: null },
  { id: 2, name: '스시로', category_id: 2, category_name: '일식', tags: ['비쌈'], link_url: null, memo: null, mine: true, warning: null },
  { id: 3, name: '김밥천국', category_id: 3, category_name: '분식', tags: ['싸다'], link_url: null, memo: null, mine: true, warning: null },
]
let urls: string[]

beforeEach(() => {
  vi.useFakeTimers()
  urls = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    if (url.endsWith('/categories')) return new Response(JSON.stringify(categories))
    const q = new URL(url, 'http://x').searchParams
    const ids = q.getAll('category').map(Number)
    const tag = q.get('tag')
    const text = q.get('q')
    return new Response(
      JSON.stringify(all.filter((r) => (!ids.length || ids.includes(r.category_id)) && (!tag || r.tags.includes(tag)) && (!text || r.name.includes(text) || r.tags.some((t) => t.includes(text.replace(/^#/, '')))))),
    )
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const flush = (ms = 20) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const names = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const lastList = () => urls.filter((u) => u.includes('/restaurants')).at(-1)!

async function renderPage() {
  render(
    <MemoryRouter>
      <Restaurants />
    </MemoryRouter>,
  )
  await flush()
}

describe('식당 목록: 카테고리 다중 선택(칩)', () => {
  it('처음에는 ‘전체’가 선택되어 모든 식당을 보여 준다', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: '전체' }).getAttribute('aria-pressed')).toBe('true')
    expect(names()).toEqual(['비빔밥', '스시로', '김밥천국'])
    expect(lastList()).not.toContain('category=')
  })

  it('카테고리 칩을 여러 개 누르면 고른 것만 보이고 서버에는 반복 파라미터로 전달된다', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: '한식' }))
    await flush()
    expect(names()).toEqual(['비빔밥'])
    fireEvent.click(screen.getByRole('button', { name: '분식' }))
    await flush()
    expect(names()).toEqual(['비빔밥', '김밥천국'])
    expect(lastList()).toContain('category=1&category=3')
    expect(screen.getByRole('button', { name: '전체' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: '한식' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('고른 칩을 다시 누르면 해제되고, ‘전체’를 누르면 모두 해제된다', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: '한식' }))
    fireEvent.click(screen.getByRole('button', { name: '일식' }))
    await flush()
    expect(names()).toEqual(['비빔밥', '스시로'])
    fireEvent.click(screen.getByRole('button', { name: '한식' }))
    await flush()
    expect(names()).toEqual(['스시로'])
    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    await flush()
    expect(names()).toEqual(['비빔밥', '스시로', '김밥천국'])
  })

  it('이름 검색창에서 태그로도 찾을 수 있고(#라면), 맞는 식당이 없으면 안내한다', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '#비쌈' } })
    await flush(400)
    expect(names()).toEqual(['스시로'])
    expect(screen.queryByRole('button', { name: '#비쌈' })).toBeNull() // 태그를 눌러 거르는 기능은 없다
    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는집' } })
    await flush(400)
    expect(names()).toEqual([])
    expect(screen.getByText(/조건에 맞는 식당이 없습니다/)).toBeTruthy()
  })

  it('기본 식당은 ‘기본’ 표시가 붙고 수정·삭제 버튼이 없다', async () => {
    all.push({ id: 4, name: '공용집', category_id: 1, category_name: '한식', tags: [], link_url: null, memo: null, mine: false, warning: null })
    try {
      await renderPage()
      const cards = screen.getAllByRole('article')
      const shared = cards.find((c) => c.textContent?.includes('공용집'))!
      const own = cards.find((c) => c.textContent?.includes('비빔밥'))!
      expect(shared.textContent).toContain('기본')
      expect(shared.querySelector('button')).toBeNull()
      expect(own.textContent).not.toContain('기본')
      expect(Array.from(own.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['수정', '삭제'])
    } finally {
      all.pop()
    }
  })
})
