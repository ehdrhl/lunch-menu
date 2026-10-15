import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getRestaurant, type Restaurant } from '../api/restaurants'

/** 식당 한 곳의 상세 내용(읽기 전용). 추천 화면의 최근 뽑기에서 눌러 들어온다. */
export default function RestaurantDetail() {
  const { id } = useParams()
  const [r, setR] = useState<Restaurant | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setR(null)
    setError(null)
    getRestaurant(Number(id))
      .then((x) => alive && setR(x))
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className="detail-page">
      <p><Link to="/restaurants">← 목록으로</Link></p>
      {error && <p className="error" role="alert">{error}</p>}
      {!r && !error && <p>불러오는 중…</p>}
      {r && (
        <article className="card detail">
          <div className="detail-head">
            <h1>{r.name}</h1>
            <span>
              {!r.mine && <span className="chip default-chip">기본</span>}
              <span className="category-badge">{r.category_name}</span>
            </span>
          </div>
          {r.tags.length > 0 && (
            <div className="tags" aria-label="태그">
              {r.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}
          {r.memo && <p className="memo">{r.memo}</p>}
          {r.link_url ? (
            <a className="btn-link" href={r.link_url} target="_blank" rel="noopener noreferrer">지도/링크 열기 ↗</a>
          ) : (
            <p className="muted small">등록된 링크가 없어요.</p>
          )}
        </article>
      )}
    </div>
  )
}
