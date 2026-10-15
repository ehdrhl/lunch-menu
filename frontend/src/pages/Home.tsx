import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listCategories, listRestaurants, type Category, type Restaurant } from '../api/restaurants'
import { listSpins } from '../api/spins'
import DrawView from '../components/DrawView'

const RECENT_MAX = 8 // 오른쪽 최근 기록 패널에 남기는 개수

interface RecentDraw {
  key: string
  restaurantId: number | null // 식당이 삭제됐으면 null(누를 수 없다)
  name: string
  category: string | null
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentDraw[]>([])
  const recentKey = useRef(0)

  const load = useCallback(() => {
    setError(null)
    // 최근 뽑기는 서버 기록에서 불러와 화면을 떠났다 와도 지워지지 않는다(못 불러오면 빈 채로 시작).
    Promise.all([listRestaurants(), listCategories(), listSpins(RECENT_MAX).catch(() => [])])
      .then(([rs, cs, spins]) => {
        setRestaurants(rs)
        setCategories(cs)
        setRecent(
          spins.map((s) => ({
            key: `log-${s.id}`,
            restaurantId: s.restaurant?.id ?? null,
            name: s.restaurant?.name ?? '삭제된 식당',
            category: s.restaurant?.category_name ?? null,
          })),
        )
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  const addRecent = useCallback((r: Restaurant) => {
    // 8건을 넘을 때만 가장 오래된 것이 밀려난다.
    setRecent((cur) => [{ key: `new-${++recentKey.current}`, restaurantId: r.id, name: r.name, category: r.category_name }, ...cur].slice(0, RECENT_MAX))
  }, [])

  if (!restaurants) {
    return error ? (
      <p className="error" role="alert">{error} <button className="link" onClick={load}>다시 시도</button></p>
    ) : (
      <p>불러오는 중…</p>
    )
  }

  if (restaurants.length === 0) {
    return (
      <section className="card empty">
        <h2>🍽️ 식당을 등록해 보세요</h2>
        <p className="muted">식당이 있어야 룰렛을 돌릴 수 있어요.</p>
        <Link to="/restaurants"><button>식당 등록하러 가기</button></Link>
      </section>
    )
  }

  const tags = [...new Set(restaurants.flatMap((r) => r.tags))].sort()

  return (
    <div className="home-layout">
      <div className="home-page">
        <header className="home-head">
          <h1>🍽️ 오늘 뭐 먹지?</h1>
        </header>
        <DrawView restaurants={restaurants} categories={categories} tags={tags} onResult={addRecent} />
      </div>
      {recent.length > 0 && (
        <aside className="recent-log" aria-label="최근 뽑기">
          <h3>최근 뽑기</h3>
          <ol>
            {recent.map((r) => (
              <li key={r.key}>
                {r.restaurantId !== null ? (
                  <Link className="recent-item" to={`/restaurants/${r.restaurantId}`} title="식당 상세 보기">
                    <span className="recent-name">{r.name}</span>
                    {r.category && <span className="recent-cat">{r.category}</span>}
                  </Link>
                ) : (
                  <span className="recent-name muted">{r.name}</span>
                )}
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  )
}
