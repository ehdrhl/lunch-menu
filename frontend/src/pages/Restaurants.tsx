import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import {
  createRestaurant,
  deleteRestaurant,
  listRestaurants,
  updateRestaurant,
  listCategories,
  type Category,
  type Restaurant,
  type RestaurantInput,
} from '../api/restaurants'
import RestaurantCard from '../components/RestaurantCard'
import RestaurantForm from '../components/RestaurantForm'

export default function Restaurants() {
  const [items, setItems] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [selected, setSelected] = useState<number[]>([]) // 고른 카테고리(없으면 전체)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Restaurant | 'new' | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    listCategories().then(setCategories).catch((e) => setError(errorMessage(e)))
  }, [])

  const load = useCallback(async () => {
    try {
      setItems(await listRestaurants({ q: debouncedQ, category: selected.length ? selected : undefined }))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoaded(true)
    }
  }, [debouncedQ, selected])

  useEffect(() => {
    load()
  }, [load])

  async function save(body: RestaurantInput) {
    setBusy(true)
    setFormError(null)
    try {
      const saved = editing && editing !== 'new' ? await updateRestaurant(editing.id, body) : await createRestaurant(body)
      setEditing(null)
      setNotice(saved.warning ? `저장했습니다. (주의: ${saved.warning})` : '저장했습니다.')
      await load()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(r: Restaurant) {
    if (!confirm(`‘${r.name}’ 식당을 삭제할까요?`)) return
    try {
      await deleteRestaurant(r.id)
      setNotice('삭제했습니다.')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const filtering = Boolean(debouncedQ || selected.length)
  const toggleCategory = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const openForm = (target: Restaurant | 'new') => {
    setFormError(null)
    setNotice(null)
    setEditing(target)
  }

  return (
    <div>
      <div className="between page-head">
        <h1>식당 목록</h1>
        <button onClick={() => openForm('new')}>+ 식당 등록</button>
      </div>

      <section className="card filter-bar">
        <div className="filter-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·태그 검색 (예: #라면)" aria-label="이름 검색" className="search" />
          <div className="chips" role="group" aria-label="카테고리 필터">
            <button
              type="button"
              className={`tag${selected.length === 0 ? ' active' : ''}`}
              aria-pressed={selected.length === 0}
              onClick={() => setSelected([])}
            >
              전체
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tag${selected.includes(c.id) ? ' active' : ''}`}
                aria-pressed={selected.includes(c.id)}
                onClick={() => toggleCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <p className="error" role="alert">
          {error} <button className="link" onClick={load}>다시 시도</button>
        </p>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}

      {loaded && !error && items.length === 0 && (
        <section className="card empty">
          {filtering ? (
            <p>조건에 맞는 식당이 없습니다. 검색어나 필터를 바꿔 보세요.</p>
          ) : (
            <>
              <p>등록된 식당이 없습니다. 식당을 등록해 보세요!</p>
              <button onClick={() => openForm('new')}>첫 식당 등록하기</button>
            </>
          )}
        </section>
      )}

      <div className="cards-grid">
        {items.map((r) => (
          <RestaurantCard key={r.id} r={r} onEdit={() => openForm(r)} onDelete={() => remove(r)} />
        ))}
      </div>

      {editing && (
        <RestaurantForm
          categories={categories}
          initial={editing === 'new' ? undefined : editing}
          busy={busy}
          error={formError}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
