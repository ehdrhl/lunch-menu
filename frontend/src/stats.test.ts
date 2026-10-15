import { describe, expect, it } from 'vitest'
import { topPicks } from './lib/stats'

const e = (name: string, category?: string) => ({ name, category })

describe('topPicks', () => {
  it('기록이 없으면 빈 배열', () => {
    expect(topPicks([])).toEqual([])
  })

  it('같은 식당은 횟수가 누적된다', () => {
    const top = topPicks([e('비빔밥', '한식'), e('쌀국수', '아시안'), e('비빔밥', '한식'), e('비빔밥', '한식')])
    expect(top).toEqual([
      { name: '비빔밥', category: '한식', count: 3 },
      { name: '쌀국수', category: '아시안', count: 1 },
    ])
  })

  it('횟수가 같으면 이름 가나다순', () => {
    const top = topPicks([e('피자'), e('김밥'), e('라면'), e('나물밥')])
    expect(top.map((t) => t.name)).toEqual(['김밥', '나물밥', '라면'])
    expect(top.every((t) => t.count === 1)).toBe(true)
  })

  it('동률이 섞여 있어도 횟수 내림차순을 먼저 지킨다', () => {
    const top = topPicks([e('가'), e('나'), e('나'), e('다'), e('다'), e('라')])
    expect(top.map((t) => `${t.name}${t.count}`)).toEqual(['나2', '다2', '가1'])
  })

  it('4개 이상이면 기본 3개로 자르고, limit으로 바꿀 수 있다', () => {
    const history = [e('가'), e('가'), e('가'), e('나'), e('나'), e('다'), e('다'), e('라'), e('마')]
    expect(topPicks(history)).toHaveLength(3)
    expect(topPicks(history).map((t) => t.name)).toEqual(['가', '나', '다'])
    expect(topPicks(history, 5).map((t) => t.name)).toEqual(['가', '나', '다', '라', '마'])
    expect(topPicks(history, 1)).toEqual([{ name: '가', category: undefined, count: 3 }])
  })

  it('카테고리는 처음 나온 값을 쓰고, 없으면 없는 채로 둔다', () => {
    const top = topPicks([e('가', '한식'), e('가', '중식'), e('나')])
    expect(top.find((t) => t.name === '가')?.category).toBe('한식')
    expect(top.find((t) => t.name === '나')?.category).toBeUndefined()
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const history = [e('나'), e('가'), e('나')]
    const copy = JSON.stringify(history)
    topPicks(history)
    expect(JSON.stringify(history)).toBe(copy)
  })
})
