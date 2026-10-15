import { setSoundOn, useSoundOn } from '../sound'

/** 효과음 켜기/끄기(음소거). 설정은 브라우저에 저장된다. */
export default function SoundToggle() {
  const on = useSoundOn()
  return (
    <button type="button" className="sound-toggle" aria-pressed={on} onClick={() => setSoundOn(!on)}>
      {on ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐'}
    </button>
  )
}
