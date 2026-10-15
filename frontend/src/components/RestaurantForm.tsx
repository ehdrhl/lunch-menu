import { useState, type FormEvent } from 'react'
import type { Category, Restaurant, RestaurantInput } from '../api/restaurants'

interface Props {
  categories: Category[]
  initial?: Restaurant
  busy: boolean
  error: string | null
  onSubmit: (body: RestaurantInput) => void
  onCancel: () => void
}

export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v)

export default function RestaurantForm({ categories, initial, busy, error, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState<number>(initial?.category_id ?? categories[0]?.id ?? 0)
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [link, setLink] = useState(initial?.link_url ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const tagList = [...new Set(tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))]
    if (tagList.length > 5) return setLocalError('태그는 최대 5개까지 입력할 수 있습니다.')
    if (tagList.some((t) => t.length > 20)) return setLocalError('태그는 20자 이하여야 합니다.')
    if (link.trim() && !isHttpUrl(link.trim())) return setLocalError('링크는 http:// 또는 https://로 시작해야 합니다.')
    setLocalError(null)
    onSubmit({
      name: name.trim(),
      category_id: categoryId,
      tags: tagList,
      link_url: link.trim() || null,
      memo: memo.trim() || null,
    })
  }

  const shown = localError ?? error
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? '식당 수정' : '식당 등록'}</h2>
        {shown && <p className="error" role="alert">{shown}</p>}
        <label>
          이름 *
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
        </label>
        <label>
          카테고리 *
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          태그 (쉼표로 구분, 최대 5개)
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예: 1만원 이하, 도보 5분" />
        </label>
        <label>
          지도/네이버 링크
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" maxLength={500} />
        </label>
        <label>
          메모
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={300} rows={3} />
        </label>
        <div className="row end">
          <button type="button" className="secondary" onClick={onCancel}>취소</button>
          <button disabled={busy || !name.trim() || !categoryId}>{initial ? '저장' : '등록'}</button>
        </div>
      </form>
    </div>
  )
}
