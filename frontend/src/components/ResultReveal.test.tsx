// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultReveal } from './ResultReveal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ResultReveal(추첨 결과 전체 화면 연출)', () => {
  it('작은 문구, 식당 이름, 카테고리 배지를 보여 준다', () => {
    render(<ResultReveal name="비빔밥" category="한식" onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: '추첨 결과' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.querySelector('.reveal-lead')!.textContent).toBe('오늘의 점심은')
    expect(dialog.querySelector('.reveal-name')!.textContent).toBe('비빔밥')
    expect(dialog.querySelector('.reveal-badge')!.textContent).toBe('한식')
    expect(dialog.querySelector('img, svg')).toBeNull() // 그림 없이 글씨만
  })

  it('카테고리가 없으면 배지를 그리지 않는다', () => {
    render(<ResultReveal name="비빔밥" onClose={() => {}} />)
    expect(document.querySelector('.reveal-badge')).toBeNull()
  })

  it('2.8초 뒤 자동으로 닫힌다', () => {
    const onClose = vi.fn()
    render(<ResultReveal name="비빔밥" onClose={onClose} />)
    act(() => void vi.advanceTimersByTime(2799))
    expect(onClose).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('duration을 바꿀 수 있다', () => {
    const onClose = vi.fn()
    render(<ResultReveal name="비빔밥" onClose={onClose} duration={500} />)
    act(() => void vi.advanceTimersByTime(500))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('부모가 다시 그려져 onClose가 새 함수가 되어도 타이머가 처음부터 다시 시작하지 않는다', () => {
    const first = vi.fn()
    const { rerender } = render(<ResultReveal name="비빔밥" onClose={first} />)
    act(() => void vi.advanceTimersByTime(2000))
    const second = vi.fn()
    rerender(<ResultReveal name="비빔밥" onClose={second} />) // 폴링 때마다 일어나는 일
    act(() => void vi.advanceTimersByTime(900)) // 처음부터 세면 2900ms가 아니라 900ms 경과
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1) // 마지막으로 넘긴 onClose가 불린다
  })

  it('클릭·Esc·Enter로 즉시 닫고, 다른 키는 무시한다', () => {
    const onClose = vi.fn()
    render(<ResultReveal name="비빔밥" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: ' ' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('Enter의 기본 동작을 막고 오버레이로 포커스를 옮긴다', () => {
    render(<ResultReveal name="비빔밥" onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    window.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
  })

  it('닫히면(언마운트) 타이머와 키 이벤트를 정리한다', () => {
    const onClose = vi.fn()
    const { unmount } = render(<ResultReveal name="비빔밥" onClose={onClose} />)
    unmount()
    act(() => void vi.advanceTimersByTime(5000))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
