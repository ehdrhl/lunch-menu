import { useEffect, useMemo, useState } from 'react'
import { errorMessage } from '../api/client'
import { listSpins, type SpinFilter, type SpinHistoryItem } from '../api/spins'
import { topPicks } from '../lib/stats'

const LIMIT = 100

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })

function filterText(f: SpinFilter): string {
  const parts = [...f.categories, ...f.tags.map((t) => `#${t}`)]
  return parts.length ? parts.join(' · ') : '조건 없음(전체)'
}

/** 그동안 뽑기로 뽑힌 결과 목록(최신순) */
export default function History() {
  const [items, setItems] = useState<SpinHistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setItems(await listSpins(LIMIT))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  // 기록이 바뀌면 통계도 함께 다시 계산한다. 삭제된 식당은 이름을 알 수 없어 제외한다.
  const top = useMemo(
    () =>
      topPicks(
        (items ?? []).flatMap((it) => (it.restaurant ? [{ name: it.restaurant.name, category: it.restaurant.category_name }] : [])),
      ),
    [items],
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="history-page">
      <div className="between page-head">
        <h1>뽑기 기록</h1>
        {items && <span className="muted">최근 {items.length}건{items.length >= LIMIT ? ` (최대 ${LIMIT}건)` : ''}</span>}
      </div>
      {items && (
        <section className="stats" aria-label="가장 많이 뽑힌 식당">
          <h3>가장 많이 뽑힌 식당 TOP 3</h3>
          {top.length === 0 ? (
            <p className="muted">아직 기록이 없어요.</p>
          ) : (
            <ol className="rank">
              {top.map((t, i) => (
                <li key={t.name} className={`rank-item rank-${i + 1}`}>
                  <span className="rank-no">{i + 1}</span>
                  <span className="rank-name">{t.name}</span>
                  {t.category && <span className="category-badge">{t.category}</span>}
                  <span className="rank-count">{t.count}회</span>
                  <span className="rank-bar" aria-hidden="true">
                    <i style={{ width: `${(t.count / top[0].count) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error} <button className="link" onClick={load}>다시 시도</button>
        </p>
      )}
      {!items && !error && <p>불러오는 중…</p>}
      {items && items.length === 0 && (
        <section className="card empty">
          <p>아직 뽑은 기록이 없어요. 추천 화면에서 룰렛을 돌려 보세요!</p>
        </section>
      )}
      <ol className="history-list" aria-label="뽑기 기록 목록">
        {items?.map((it, i) => (
          <li key={it.id} className="card history-item">
            <span className="history-no" aria-hidden="true">{items.length - i}</span>
            <div className="history-main">
              <strong className={it.restaurant ? '' : 'muted'}>{it.restaurant?.name ?? '삭제된 식당'}</strong>
              {it.restaurant && (
                <span className="history-chips">
                  <span className="chip">{it.restaurant.category_name}</span>
                  {it.restaurant.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
                </span>
              )}
            </div>
            <div className="history-meta muted small">
              <span>{fmt(it.created_at)}</span>
              <span>조건: {filterText(it.filter)}</span>
            </div>
            {it.restaurant?.link_url && (
              <a href={it.restaurant.link_url} target="_blank" rel="noopener noreferrer" className="btn-link">지도/링크 ↗</a>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
