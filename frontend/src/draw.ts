// 룰렛 연출의 시간표와 계산. 결과는 서버가 정하고, 여기서는 연출만 한다.
// 연출: 룰렛이 돌다 멈춤 → 끝나면 전체 화면 결과 연출(글씨만) → 닫히면 결과 카드에 이름이 남는다.
import type { Restaurant } from './api/restaurants'
import type { SpinFilter } from './api/spins'

export const SHUFFLE_MS = 3000
export const REVEAL_MS = 2800 // 결과 확정 뒤 전체 화면 결과 연출이 떠 있는 시간
export const MAX_SLOTS = 9 // 룰렛에 그려 줄 칸 최대 수

export type DrawPhase = 'shuffle' | 'done'

/** 뽑기 시작 후 경과 시간(ms)에 해당하는 단계 */
export const phaseAt = (elapsedMs: number): DrawPhase => (elapsedMs < SHUFFLE_MS ? 'shuffle' : 'done')

/** 룰렛 칸 수: 후보 수만큼, 최대 9칸(후보가 없어도 빈 룰렛이 되지 않게 최소 2칸) */
export const wheelSlots = (candidateCount: number): number => Math.min(Math.max(candidateCount, 2), MAX_SLOTS)

/** 조건에 맞는 후보 수. 서버와 같은 규칙: 카테고리끼리·태그끼리는 OR, 카테고리와 태그 사이는 AND. 화면 표시용이고 결과는 서버가 정한다. */
export const countCandidates = (restaurants: Restaurant[], filter: SpinFilter): number =>
  restaurants.filter(
    (r) =>
      (filter.categories.length === 0 || filter.categories.includes(r.category_name)) &&
      (filter.tags.length === 0 || r.tags.some((t) => filter.tags.includes(t))),
  ).length
