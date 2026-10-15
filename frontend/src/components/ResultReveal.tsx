import { useEffect, useRef } from 'react'
import { REVEAL_MS } from '../draw'

interface Props {
  name: string
  category?: string
  onClose: () => void
  duration?: number
}

/** 추첨 결과 전체 화면 연출. 그림 없이 글씨와 CSS 효과만 쓰고, 시간이 지나거나 클릭·Enter·Esc로 닫는다. */
export function ResultReveal({ name, category, onClose, duration = REVEAL_MS }: Props) {
  // 부모가 화면을 다시 그려 onClose가 새 함수로 바뀌어도 타이머가 다시 시작되지 않게 ref에 담아 둔다.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 추첨 버튼에 남은 포커스 때문에 Enter로 닫을 때 다시 뽑기가 눌리지 않도록 오버레이로 포커스를 옮긴다.
    root.current?.focus()
    const timer = setTimeout(() => closeRef.current(), duration)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault() // Enter의 기본 동작(버튼 클릭)을 막는다
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [duration])

  return (
    <div ref={root} className="reveal" role="dialog" aria-modal="true" aria-label="추첨 결과" tabIndex={-1} onClick={() => closeRef.current()}>
      <div className="reveal-inner">
        <p className="reveal-lead">오늘의 점심은</p>
        <p className="reveal-name">{name}</p>
        {category && <span className="reveal-badge">{category}</span>}
      </div>
    </div>
  )
}
