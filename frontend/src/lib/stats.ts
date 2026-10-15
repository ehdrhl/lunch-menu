// 뽑기 기록으로 '가장 많이 뽑힌 식당'을 집계하는 순수 함수(별도 저장소 없이 기록에서 바로 계산한다).
export interface HistoryEntry {
  name: string
  category?: string
}
export interface TopPick {
  name: string
  category?: string
  count: number
}

/** 식당 이름별 뽑힌 횟수가 많은 순(동률이면 이름 가나다순)으로 limit개를 돌려준다. */
export function topPicks(history: HistoryEntry[], limit = 3): TopPick[] {
  const map = new Map<string, TopPick>()
  for (const h of history) {
    const cur = map.get(h.name)
    if (cur) cur.count += 1
    else map.set(h.name, { name: h.name, category: h.category, count: 1 })
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit)
}
