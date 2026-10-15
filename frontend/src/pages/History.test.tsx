// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import History from './History'

const r = (name: string, extra = {}) => ({
  id: 1, name, category_id: 1, category_name: '한식', tags: ['싸다'], link_url: 'https://naver.me/x', memo: null, mine: true, warning: null, ...extra,
})
const item = (id: number, over = {}) => ({
  id, created_at: '2026-10-14T12:30:00', restaurant: r('비빔밥'), filter: { categories: [], tags: [] }, ...over,
})

let respond: () => Response
beforeEach(() => {
  vi.stubGlobal('fetch', async () => respond())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderPage = async () => {
  render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  )
  await act(async () => {})
}

describe('History(뽑기 기록)', () => {
  it('뽑힌 결과를 서버가 준 순서(최신순)대로 보여 주고 어떤 조건으로 뽑았는지 알려 준다', async () => {
    respond = () =>
      new Response(JSON.stringify([
        item(3, { restaurant: r('쌀국수', { category_name: '아시안', tags: [] }), filter: { categories: ['아시안'], tags: ['싸다'] } }),
        item(2, { restaurant: null }),
        item(1),
      ]))
    await renderPage()
    // TOP 3 순위 목록(li)이 따로 생기므로, 기록 목록 안의 행만 센다
    const rows = within(screen.getByRole('list', { name: '뽑기 기록 목록' })).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('쌀국수')).toBeTruthy()
    expect(within(rows[0]).getByText('아시안')).toBeTruthy()
    expect(within(rows[0]).getByText(/조건: 아시안 · #싸다/)).toBeTruthy()
    expect(within(rows[1]).getByText('삭제된 식당')).toBeTruthy() // 식당이 지워져도 기록은 남는다
    expect(within(rows[2]).getByText('비빔밥')).toBeTruthy()
    expect(within(rows[2]).getByText(/조건: 조건 없음\(전체\)/)).toBeTruthy()
    const link = within(rows[2]).getByRole('link', { name: /지도\/링크/ }) as HTMLAnchorElement
    expect(link.href).toBe('https://naver.me/x')
    expect(link.target).toBe('_blank')
    expect(within(rows[1]).queryByRole('link')).toBeNull()
    // 번호는 오래된 것이 1번
    expect(rows.map((x) => x.querySelector('.history-no')!.textContent)).toEqual(['3', '2', '1'])
  })

  it('기록이 없으면 안내를 보여 준다', async () => {
    respond = () => new Response('[]')
    await renderPage()
    expect(screen.getByText(/아직 뽑은 기록이 없어요/)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: '뽑기 기록 목록' })).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByRole('region', { name: '가장 많이 뽑힌 식당' }).textContent).toContain('아직 기록이 없어요.')
  })

  it('불러오기에 실패하면 오류와 다시 시도 버튼을 보여 주고, 다시 시도하면 불러온다', async () => {
    respond = () => new Response(JSON.stringify({ detail: '서버가 바빠요' }), { status: 500 })
    await renderPage()
    expect(screen.getByRole('alert').textContent).toContain('서버가 바빠요')
    respond = () => new Response(JSON.stringify([item(1)]))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await act(async () => {})
    expect(within(screen.getByRole('list', { name: '뽑기 기록 목록' })).getByText('비빔밥')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('기록 위쪽에 가장 많이 뽑힌 식당 TOP 3(횟수 내림차순, 동률은 가나다순)과 카테고리 배지·막대를 보여 준다', async () => {
    const pick = (id: number, name: string, category = '한식') => item(id, { restaurant: r(name, { category_name: category }) })
    respond = () =>
      new Response(JSON.stringify([
        pick(9, '라면', '분식'),
        pick(8, '쌀국수', '아시안'),
        pick(7, '비빔밥'),
        pick(6, '김치찌개'),
        pick(5, '쌀국수', '아시안'),
        pick(4, '비빔밥'),
        pick(3, '김치찌개'),
        pick(2, '비빔밥'),
        item(1, { restaurant: null }), // 삭제된 식당은 집계에서 제외
      ]))
    await renderPage()
    const stats = screen.getByRole('region', { name: '가장 많이 뽑힌 식당' })
    expect(within(stats).getByText('가장 많이 뽑힌 식당 TOP 3')).toBeTruthy()
    const rank = within(stats).getAllByRole('listitem')
    expect(rank).toHaveLength(3) // 4개 이상이어도 3개까지만
    expect(rank.map((li) => li.querySelector('.rank-name')!.textContent)).toEqual(['비빔밥', '김치찌개', '쌀국수']) // 3회, 2회(가나다순), 2회
    expect(rank.map((li) => li.querySelector('.rank-count')!.textContent)).toEqual(['3회', '2회', '2회'])
    expect(rank.map((li) => li.className)).toEqual(['rank-item rank-1', 'rank-item rank-2', 'rank-item rank-3'])
    expect(rank.map((li) => li.querySelector('.rank-no')!.textContent)).toEqual(['1', '2', '3'])
    expect(rank.map((li) => li.querySelector('.category-badge')!.textContent)).toEqual(['한식', '한식', '아시안'])
    const widths = rank.map((li) => (li.querySelector('.rank-bar i') as HTMLElement).style.width)
    expect(widths[0]).toBe('100%')
    expect(parseFloat(widths[1])).toBeCloseTo(66.67, 1)
    expect(widths[1]).toBe(widths[2])
    expect(rank[0].querySelector('.rank-bar')!.getAttribute('aria-hidden')).toBe('true')
    // 통계는 기록 목록 위에 있다
    const list = screen.getByRole('list', { name: '뽑기 기록 목록' })
    expect(stats.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('기록이 바뀌어 다시 불러오면 통계도 함께 바뀐다', async () => {
    respond = () => new Response(JSON.stringify({ detail: '잠깐 오류' }), { status: 500 })
    await renderPage() // 먼저 실패 → 다시 시도로 새 기록을 불러온다
    respond = () => new Response(JSON.stringify([item(1)]))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await act(async () => {})
    const stats = () => screen.getByRole('region', { name: '가장 많이 뽑힌 식당' })
    expect(within(stats()).getByText('1회')).toBeTruthy()
    respond = () => new Response(JSON.stringify([item(3), item(2), item(1)]))
    cleanup()
    await renderPage()
    expect(within(stats()).getByText('3회')).toBeTruthy()
    expect(within(stats()).getAllByRole('listitem')).toHaveLength(1)
  })
})
