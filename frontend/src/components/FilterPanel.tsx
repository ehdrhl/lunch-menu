import { useState } from 'react'
import type { Category } from '../api/restaurants'
import type { SpinFilter } from '../api/spins'

interface Props {
  categories: Category[]
  tags: string[]
  filter: SpinFilter
  disabled: boolean
  onChange: (next: SpinFilter) => void
}

type Option = { kind: 'category' | 'tag'; value: string; label: string }

/** 추천 조건: 검색창에서 카테고리·태그를 골라 담으면 위쪽에 칩으로 쌓인다. 칩을 누르면 뺀다. */
export default function FilterPanel({ categories, tags, filter, disabled, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const selected: Option[] = [
    ...filter.categories.map((v) => ({ kind: 'category' as const, value: v, label: v })),
    ...filter.tags.map((v) => ({ kind: 'tag' as const, value: v, label: `#${v}` })),
  ]
  const word = query.trim().toLowerCase().replace(/^#/, '')
  const options: Option[] = [
    ...categories.filter((c) => !filter.categories.includes(c.name)).map((c) => ({ kind: 'category' as const, value: c.name, label: c.name })),
    ...tags.filter((t) => !filter.tags.includes(t)).map((t) => ({ kind: 'tag' as const, value: t, label: `#${t}` })),
  ].filter((o) => !word || o.value.toLowerCase().includes(word))

  const add = (o: Option) =>
    onChange(o.kind === 'category' ? { ...filter, categories: [...filter.categories, o.value] } : { ...filter, tags: [...filter.tags, o.value] })
  const remove = (o: Option) =>
    onChange(
      o.kind === 'category'
        ? { ...filter, categories: filter.categories.filter((x) => x !== o.value) }
        : { ...filter, tags: filter.tags.filter((x) => x !== o.value) },
    )

  return (
    <section className="card conditions filter-panel">
      <h2 className="inline-head">
        조건 <span className="muted hint">고르지 않으면 전체가 후보예요. 여러 개 고를 수 있어요.</span>
      </h2>
      {selected.length > 0 && (
        <div className="chips selected-chips" role="group" aria-label="고른 조건">
          {selected.map((o) => (
            <button key={`${o.kind}:${o.value}`} type="button" disabled={disabled} className="tag active" aria-label={`${o.label} 빼기`} onClick={() => remove(o)}>
              {o.label} ✕
            </button>
          ))}
        </div>
      )}
      <input
        className="search"
        value={query}
        disabled={disabled}
        placeholder="조건 검색 (카테고리, #태그)"
        aria-label="조건 검색"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {!disabled && (focused || query) && (
        <div className="chips option-chips" role="group" aria-label="조건 후보" onMouseDown={(e) => e.preventDefault()}>
          {options.length === 0 && <span className="muted small">맞는 조건이 없어요</span>}
          {options.map((o) => (
            <button key={`${o.kind}:${o.value}`} type="button" className="tag" onClick={() => add(o)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
