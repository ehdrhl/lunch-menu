// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RestaurantDetail from './RestaurantDetail'

const r = { id: 5, name: '땀땀', category_id: 6, category_name: '아시안', tags: ['쌀국수', '베트남'], link_url: 'https://map.naver.com/x', memo: '강남역 11번 출구', mine: false, warning: null }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function open(response: Response) {
  const urls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    return response
  })
  render(
    <MemoryRouter initialEntries={['/restaurants/5']}>
      <Routes>
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
  return urls
}

describe('식당 상세', () => {
  it('이름·카테고리·태그·메모·링크 버튼을 보여 주고 목록으로 돌아가는 링크가 있다', async () => {
    const urls = await open(new Response(JSON.stringify(r)))
    expect(urls).toEqual(['/api/restaurants/5'])
    expect(screen.getByRole('heading', { name: '땀땀' })).toBeTruthy()
    expect(screen.getByText('아시안')).toBeTruthy()
    expect(screen.getByText('기본')).toBeTruthy() // 기본 식당 표시
    expect(screen.getByText('#쌀국수')).toBeTruthy()
    expect(screen.getByText('강남역 11번 출구')).toBeTruthy()
    const link = screen.getByRole('link', { name: /지도\/링크 열기/ }) as HTMLAnchorElement
    expect(link.href).toBe('https://map.naver.com/x')
    expect(link.target).toBe('_blank')
    expect((screen.getByRole('link', { name: /목록으로/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/restaurants')
  })

  it('내 식당에는 ‘기본’ 표시가 없고, 링크가 없으면 안내한다', async () => {
    await open(new Response(JSON.stringify({ ...r, mine: true, link_url: null, memo: null, tags: [] })))
    expect(screen.queryByText('기본')).toBeNull()
    expect(screen.getByText('등록된 링크가 없어요.')).toBeTruthy()
  })

  it('없거나 남의 식당이면 서버의 안내를 보여 준다', async () => {
    await open(new Response(JSON.stringify({ detail: '존재하지 않는 식당입니다.' }), { status: 404 }))
    expect(screen.getByRole('alert').textContent).toBe('존재하지 않는 식당입니다.')
  })
})
