import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import type { Category, Restaurant } from '../api/restaurants'
import { spin, type SpinFilter } from '../api/spins'
import { countCandidates } from '../draw'
import { sound } from '../sound'
import DrawMachine, { type DrawRun } from './DrawMachine'
import FilterPanel from './FilterPanel'
import { ResultReveal } from './ResultReveal'

interface Props {
  restaurants: Restaurant[] // 기본 식당 + 내 식당(후보 수를 세는 데 쓴다)
  categories: Category[]
  tags: string[]
  onResult?: (restaurant: Restaurant) => void // 연출이 끝나 결과가 공개될 때(최근 기록 패널용)
}

const EMPTY: SpinFilter = { categories: [], tags: [] }

/** 추천 화면: 조건 선택, 룰렛, 결과. 열 때마다 지난 결과 없이 처음 상태로 시작한다. */
export default function DrawView({ restaurants, categories, tags, onResult }: Props) {
  const [filter, setFilter] = useState<SpinFilter>(EMPTY)
  const [run, setRun] = useState<DrawRun | null>(null)
  const [animating, setAnimating] = useState(false)
  const [shown, setShown] = useState<Restaurant | null>(null) // 연출이 끝난 뒤 공개하는 결과
  const [busy, setBusy] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false) // 결과 확정 직후 전체 화면 연출
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef(0)
  const pending = useRef<Restaurant | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const play = useCallback((restaurant: Restaurant) => {
    pending.current = restaurant
    setShown(null)
    setRevealOpen(false) // 이전 결과 연출이 떠 있었다면 닫는다
    setAnimating(true)
    sound.startShuffle() // 룰렛이 도는 동안 효과음(음소거면 소리 없음)
    setRun({ token: ++tokenRef.current, name: restaurant.name })
  }, [])

  // 룰렛이 실제로 멈춘 순간(결과 확정)에만 결과 연출을 띄운다.
  const finish = useCallback(() => {
    setAnimating(false)
    setShown(pending.current)
    if (pending.current) onResultRef.current?.(pending.current)
    setRevealOpen(true)
    sound.playReveal() // 결과 팡파르와 진동
  }, [])
  useEffect(() => () => sound.stopShuffle(), []) // 화면을 떠나면 소리를 멈춘다
  const closeReveal = useCallback(() => setRevealOpen(false), [])

  async function pull() {
    setBusy(true)
    setError(null)
    try {
      const out = await spin(filter)
      play(out.restaurant)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const candidateCount = countCandidates(restaurants, filter)
  const result = animating ? null : shown
  const noCandidates = candidateCount === 0
  const canAct = !animating && !busy

  return (
    <div className="draw-view">
      <FilterPanel categories={categories} tags={tags} filter={filter} disabled={!canAct} onChange={setFilter} />

      <DrawMachine count={candidateCount} run={run} onDone={finish} />

      {result && (
        <section className="card result" aria-label="결과">
          <div className="result-row">
            <p key={result.id} className="result-name drawn-name">{result.name}</p>
            {result.category_name && <span className="category-badge">{result.category_name}</span>}
          </div>
          {result.link_url && (
            <a className="result-link" href={result.link_url} target="_blank" rel="noopener noreferrer">지도/링크 ↗</a>
          )}
        </section>
      )}

      <div className="draw-actions">
        <button className="lever draw-btn" onClick={pull} disabled={!canAct || noCandidates}>
          {animating ? '뽑는 중…' : result ? '다시 뽑기 🔄' : '🎡 룰렛 돌리기'}
        </button>
        <p className={noCandidates ? 'error' : 'muted'} role="status">
          {noCandidates ? '조건에 맞는 식당이 없어요. 조건을 조금 풀어 보세요.' : `후보 ${candidateCount}곳`}
        </p>
        <Link to="/history"><button className="link-btn">기록 보기</button></Link>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {revealOpen && result && <ResultReveal name={result.name} category={result.category_name} onClose={closeReveal} />}
    </div>
  )
}
