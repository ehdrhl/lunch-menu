// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSound, getSoundOn, REVEAL_NOTES, setSoundOn, TICK_MS, type AudioLike, type SoundDeps } from './sound'

function fakeAudio() {
  const oscillators: { freq: number; start: number }[] = []
  const ctx: AudioLike = {
    currentTime: 10,
    destination: {},
    state: 'suspended',
    resume: vi.fn(),
    createOscillator: () => {
      const rec = { freq: 0, start: 0 }
      oscillators.push(rec)
      return {
        type: 'sine',
        frequency: { setValueAtTime: (v: number) => void (rec.freq = v) },
        connect() {},
        start: (t: number) => void (rec.start = t),
        stop() {},
      }
    },
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
  }
  return { ctx, oscillators }
}

function makeDeps(over: Partial<SoundDeps> = {}) {
  const audio = fakeAudio()
  const timers = new Map<number, () => void>()
  let nextId = 1
  const vibrate = vi.fn()
  const deps: SoundDeps = {
    getContext: () => audio.ctx,
    vibrate,
    enabled: () => true,
    setInterval: (fn) => {
      timers.set(nextId, fn)
      return nextId++
    },
    clearInterval: (id) => void timers.delete(id as number),
    random: () => 0.5,
    ...over,
  }
  return { deps, audio, timers, vibrate, tick: () => timers.forEach((fn) => fn()) }
}

describe('createSound', () => {
  it('섞이는 동안 짧은 소리를 반복하고, 멈추면 더 나지 않는다', () => {
    const { deps, audio, timers, tick } = makeDeps()
    const s = createSound(deps)
    s.startShuffle()
    expect(timers.size).toBe(1)
    expect(audio.ctx.resume).toHaveBeenCalled() // 브라우저가 막아 둔 소리를 풀어 본다
    tick()
    tick()
    expect(audio.oscillators).toHaveLength(2)
    expect(audio.oscillators[0].freq).toBeGreaterThan(260)
    s.stopShuffle()
    expect(timers.size).toBe(0)
  })

  it('다시 시작해도 타이머가 겹치지 않는다', () => {
    const { deps, timers } = makeDeps()
    const s = createSound(deps)
    s.startShuffle()
    s.startShuffle()
    expect(timers.size).toBe(1)
  })

  it('결과가 나올 때 팡파르(4음)와 진동을 내고 섞는 소리는 멈춘다', () => {
    const { deps, audio, timers, vibrate } = makeDeps()
    const s = createSound(deps)
    s.startShuffle()
    s.playReveal()
    expect(timers.size).toBe(0)
    expect(audio.oscillators.map((o) => o.freq)).toEqual(REVEAL_NOTES)
    const starts = audio.oscillators.map((o) => o.start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b)) // 차례대로 울린다
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('음소거면 소리도 진동도 없고 타이머도 만들지 않는다', () => {
    const { deps, audio, timers, vibrate } = makeDeps({ enabled: () => false })
    const s = createSound(deps)
    s.startShuffle()
    s.playReveal()
    expect(timers.size).toBe(0)
    expect(audio.oscillators).toHaveLength(0)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('섞는 도중에 음소거하면 다음 소리부터 멈춘다', () => {
    let on = true
    const { deps, audio, timers, tick } = makeDeps({ enabled: () => on })
    createSound(deps).startShuffle()
    tick()
    expect(audio.oscillators).toHaveLength(1)
    on = false
    tick()
    expect(audio.oscillators).toHaveLength(1)
    expect(timers.size).toBe(0)
  })

  it('오디오를 지원하지 않는 환경에서도 오류 없이 넘어간다', () => {
    const { deps, timers } = makeDeps({ getContext: () => null })
    const s = createSound(deps)
    expect(() => {
      s.startShuffle()
      s.playReveal()
      s.stopShuffle()
    }).not.toThrow()
    expect(timers.size).toBe(0)
  })

  it('소리 간격은 짧고(0.2초 안) 일정하다', () => {
    expect(TICK_MS).toBeGreaterThan(50)
    expect(TICK_MS).toBeLessThan(200)
  })
})

describe('음소거 설정 저장', () => {
  beforeEach(() => {
    localStorage.clear()
    setSoundOn(true)
  })

  it('끄고 켠 값이 브라우저에 저장된다', () => {
    setSoundOn(false)
    expect(getSoundOn()).toBe(false)
    expect(localStorage.getItem('soundOn')).toBe('off')
    setSoundOn(true)
    expect(localStorage.getItem('soundOn')).toBe('on')
  })

  it('저장소를 쓸 수 없어도 이번 접속 동안은 설정이 유지된다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setSoundOn(false)).not.toThrow()
    expect(getSoundOn()).toBe(false)
    spy.mockRestore()
  })
})
