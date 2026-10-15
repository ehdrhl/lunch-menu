import { describe, expect, it } from 'vitest'
import type { Restaurant } from './api/restaurants'
import { countCandidates, MAX_SLOTS, phaseAt, REVEAL_MS, SHUFFLE_MS, wheelSlots } from './draw'

describe('phaseAt', () => {
  it('룰렛이 도는 동안 → 끝 순서로 넘어간다', () => {
    expect(phaseAt(0)).toBe('shuffle')
    expect(phaseAt(SHUFFLE_MS - 1)).toBe('shuffle')
    expect(phaseAt(SHUFFLE_MS)).toBe('done')
    expect(phaseAt(SHUFFLE_MS + 10_000)).toBe('done')
  })

  it('연출 시간표', () => {
    expect(SHUFFLE_MS).toBe(3000)
    expect(REVEAL_MS).toBe(2800)
  })
})

describe('wheelSlots', () => {
  it('후보 수만큼, 최대 9칸이고 너무 적어도 최소 2칸이다', () => {
    expect(wheelSlots(3)).toBe(3)
    expect(wheelSlots(50)).toBe(MAX_SLOTS)
    expect(wheelSlots(1)).toBe(2)
    expect(wheelSlots(0)).toBe(2)
  })
})

describe('countCandidates', () => {
  const r = (name: string, category_name: string, tags: string[]): Restaurant => ({
    id: 1, name, category_id: 1, category_name, tags, link_url: null, memo: null, mine: false, warning: null,
  })
  const all = [r('a', '한식', ['싸다']), r('b', '일식', ['비쌈']), r('c', '분식', ['싸다'])]

  it('조건이 없으면 전체다', () => {
    expect(countCandidates(all, { categories: [], tags: [] })).toBe(3)
  })
  it('카테고리끼리·태그끼리는 OR, 카테고리와 태그 사이는 AND다(서버와 같다)', () => {
    expect(countCandidates(all, { categories: ['한식', '일식'], tags: [] })).toBe(2)
    expect(countCandidates(all, { categories: [], tags: ['싸다', '비쌈'] })).toBe(3)
    expect(countCandidates(all, { categories: ['일식', '분식'], tags: ['싸다'] })).toBe(1)
    expect(countCandidates(all, { categories: ['한식'], tags: ['비쌈'] })).toBe(0)
  })
})
