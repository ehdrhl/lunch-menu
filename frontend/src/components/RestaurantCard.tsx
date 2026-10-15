import type { Restaurant } from '../api/restaurants'

interface Props {
  r: Restaurant
  onEdit: () => void
  onDelete: () => void
}

export default function RestaurantCard({ r, onEdit, onDelete }: Props) {
  return (
    <article className="card restaurant">
      <div className="between">
        <h3>{r.name}</h3>
        <span>
          {!r.mine && <span className="chip default-chip">기본</span>}
          <span className="chip">{r.category_name}</span>
        </span>
      </div>
      {r.tags.length > 0 && (
        <div className="tags">
          {r.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
      )}
      {r.memo && <p className="memo">{r.memo}</p>}
      <div className="between">
        <span>
          {r.link_url && (
            <a className="btn-link" href={r.link_url} target="_blank" rel="noopener noreferrer">지도/링크 열기 ↗</a>
          )}
        </span>
        {r.mine && (
          <span>
            <button className="link" onClick={onEdit}>수정</button>
            <button className="link danger" onClick={onDelete}>삭제</button>
          </span>
        )}
      </div>
    </article>
  )
}
