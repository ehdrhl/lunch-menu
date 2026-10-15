import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { phaseAt, SHUFFLE_MS, wheelSlots, type DrawPhase } from '../draw'

export interface DrawRun {
  token: number // 뽑기마다 달라지는 값. 바뀌면 연출을 처음부터 다시 한다.
  name: string // 서버가 정한 식당 이름
}

interface Props {
  count: number // 룰렛 칸 수(후보 수)
  run: DrawRun | null
  onDone: () => void // 룰렛이 멈춰 결과를 보여 줄 때
}

const COLORS = ['#ff7272', '#fbc400', '#69c8f2', '#b0d840', '#c58cf2']
const colorOf = (i: number) => COLORS[i % COLORS.length]
const SLOT_RADIUS = 86 // 번호가 놓이는 반지름(px)

export default function DrawMachine({ count, run, onDone }: Props) {
  const [phase, setPhase] = useState<DrawPhase | 'idle'>('idle')
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const finish = useCallback(() => {
    clearTimer()
    setPhase('done')
    doneRef.current()
  }, [])

  useEffect(() => {
    if (!run) return
    setPhase(phaseAt(0))
    clearTimer()
    timer.current = setTimeout(finish, SHUFFLE_MS)
    return clearTimer
  }, [run, finish])

  const slots = wheelSlots(count)
  const spinning = phase === 'shuffle'
  const seg = 360 / slots
  const gradient = Array.from({ length: slots }, (_, i) => `${colorOf(i)} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ')
  // 멈추는 각도는 뽑기마다 다르게(연출용. 결과는 서버가 정한다).
  const rest = run ? (run.token * 137) % 360 : 0
  const wheelStyle = {
    background: `conic-gradient(${gradient})`,
    ['--rest' as string]: `${rest}deg`,
  } as CSSProperties

  return (
    <div className={`roulette${spinning ? ' drawing' : ''}`} aria-label="룰렛">
      <div className="pointer" aria-hidden="true" />
      <div className={`wheel${spinning ? ' shuffle' : ''}`} style={wheelStyle}>
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className="slot"
            style={{ transform: `rotate(${(i + 0.5) * seg}deg) translateY(-${SLOT_RADIUS}px)` }}
          >
            {i + 1}
          </span>
        ))}
        <span className="hub" aria-hidden="true">GO</span>
      </div>
      <div className="roulette-stand" aria-hidden="true" />
    </div>
  )
}
