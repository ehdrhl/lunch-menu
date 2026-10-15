// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSoundOn, setSoundOn } from '../sound'
import SoundToggle from './SoundToggle'

beforeEach(() => {
  localStorage.clear()
  act(() => setSoundOn(true))
})
afterEach(cleanup)

describe('SoundToggle', () => {
  it('켜짐 상태를 aria-pressed와 문구로 보여 주고, 누르면 꺼진다', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button', { name: /효과음 켜짐/ })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    const off = screen.getByRole('button', { name: /효과음 꺼짐/ })
    expect(off.getAttribute('aria-pressed')).toBe('false')
    expect(getSoundOn()).toBe(false)
    expect(localStorage.getItem('soundOn')).toBe('off')
    fireEvent.click(off)
    expect(screen.getByRole('button', { name: /효과음 켜짐/ })).toBeTruthy()
  })

  it('다른 곳에서 설정을 바꿔도 같은 값을 보여 준다', () => {
    render(<SoundToggle />)
    act(() => setSoundOn(false))
    expect(screen.getByRole('button', { name: /효과음 꺼짐/ })).toBeTruthy()
  })
})
