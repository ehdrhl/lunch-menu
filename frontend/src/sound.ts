// 효과음(F-14): 음원 파일 없이 브라우저 오디오로 짧은 소리를 만든다. 음소거 설정은 브라우저에 저장한다.
import { useSyncExternalStore } from 'react'

const KEY = 'soundOn'

// ── 설정 저장소(음소거 토글) ──
const listeners = new Set<() => void>()

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off' // 기본은 켜짐
  } catch {
    return true
  }
}
let current = readStored()

export const getSoundOn = () => current
export function setSoundOn(on: boolean) {
  current = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 저장할 수 없어도 이번 접속 동안은 유지된다 */
  }
  listeners.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const useSoundOn = () => useSyncExternalStore(subscribe, getSoundOn, () => true)

// ── 소리 재생 ──
interface Osc {
  type: string
  frequency: { setValueAtTime(v: number, t: number): void }
  connect(n: unknown): void
  start(t: number): void
  stop(t: number): void
}
interface Gain {
  gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }
  connect(n: unknown): void
}
export interface AudioLike {
  currentTime: number
  destination: unknown
  state?: string
  resume?: () => Promise<void> | void
  createOscillator(): Osc
  createGain(): Gain
}

export interface SoundDeps {
  getContext: () => AudioLike | null
  vibrate: (pattern: number[]) => void
  enabled: () => boolean
  setInterval: (fn: () => void, ms: number) => unknown
  clearInterval: (id: unknown) => void
  random: () => number
}

const defaultDeps = (): SoundDeps => {
  let ctx: AudioLike | null = null
  return {
    getContext: () => {
      if (ctx) return ctx
      const Ctor = (globalThis as { AudioContext?: new () => AudioLike; webkitAudioContext?: new () => AudioLike }).AudioContext
      ctx = Ctor ? new Ctor() : null
      return ctx
    },
    vibrate: (p) => {
      try {
        navigator.vibrate?.(p)
      } catch {
        /* 진동을 지원하지 않는 기기 */
      }
    },
    enabled: getSoundOn,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
    random: Math.random,
  }
}

export const TICK_MS = 140
// 도 미 솔 도(높은) — 결과가 나올 때 짧은 팡파르
export const REVEAL_NOTES = [523.25, 659.25, 783.99, 1046.5]

export function createSound(deps: SoundDeps = defaultDeps()) {
  let ticking: unknown = null

  function tone(freq: number, delay: number, duration: number, volume: number, type = 'sine') {
    const ctx = deps.getContext()
    if (!ctx) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  function stopShuffle() {
    if (ticking !== null) deps.clearInterval(ticking)
    ticking = null
  }

  return {
    /** 공이 섞이는 동안 짧은 소리를 반복한다. */
    startShuffle() {
      stopShuffle()
      if (!deps.enabled()) return
      const ctx = deps.getContext()
      if (!ctx) return
      void ctx.resume?.() // 브라우저가 소리를 막아 두었다면 사용자 조작 직후 풀어 본다
      ticking = deps.setInterval(() => {
        if (!deps.enabled()) return stopShuffle() // 도중에 음소거하면 바로 멈춘다
        tone(260 + deps.random() * 520, 0, 0.07, 0.07, 'triangle')
      }, TICK_MS)
    },
    stopShuffle,
    /** 결과가 나올 때 팡파르와 진동 */
    playReveal() {
      stopShuffle()
      if (!deps.enabled()) return
      REVEAL_NOTES.forEach((f, i) => tone(f, i * 0.11, 0.35, 0.12))
      deps.vibrate([60, 40, 120])
    },
  }
}

export const sound = createSound()
