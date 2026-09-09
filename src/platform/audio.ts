import eatUrl from '../../assets/sounds/eat.m4a?url'
import crashUrl from '../../assets/sounds/crash.m4a?url'
import musicUrl from '../../assets/sounds/music.mp3?url'

const MUTE_KEY = 'wormular.soundEnabled'

export type AudioController = {
  isEnabled: () => boolean
  setEnabled: (on: boolean) => void
  toggle: () => boolean
  /** Call from a user gesture so browsers allow playback. */
  unlock: () => void
  playEat: () => void
  playCrash: () => void
}

export function createAudio(): AudioController {
  let enabled = loadEnabled()
  let unlocked = false
  let music: HTMLAudioElement | null = null
  let eatProto: HTMLAudioElement | null = null
  let crashProto: HTMLAudioElement | null = null

  function ensureSfx(): void {
    if (!eatProto) {
      eatProto = new Audio(eatUrl)
      eatProto.preload = 'auto'
    }
    if (!crashProto) {
      crashProto = new Audio(crashUrl)
      crashProto.preload = 'auto'
    }
  }

  function ensureMusic(): HTMLAudioElement {
    if (!music) {
      music = new Audio(musicUrl)
      music.loop = true
      music.preload = 'none'
      music.volume = 0.1
    }
    return music
  }

  function syncMusic(): void {
    if (!unlocked || !enabled) {
      music?.pause()
      return
    }
    const m = ensureMusic()
    void m.play().catch(() => {
      // Autoplay may still be blocked until a later gesture.
    })
  }

  function playOneShot(proto: HTMLAudioElement, volume: number): void {
    if (!enabled || !unlocked) return
    const shot = proto.cloneNode(true) as HTMLAudioElement
    shot.volume = volume
    void shot.play().catch(() => {})
  }

  return {
    isEnabled: () => enabled,

    setEnabled(on) {
      enabled = on
      saveEnabled(on)
      if (on) unlocked = true
      if (on) ensureSfx()
      syncMusic()
    },

    toggle() {
      const next = !enabled
      this.setEnabled(next)
      return next
    },

    unlock() {
      if (!unlocked) {
        unlocked = true
        ensureSfx()
      }
      syncMusic()
    },

    playEat() {
      if (!eatProto) ensureSfx()
      playOneShot(eatProto!, 1)
    },

    playCrash() {
      if (!crashProto) ensureSfx()
      playOneShot(crashProto!, 0.85)
    },
  }
}

function loadEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MUTE_KEY)
    if (raw === null) return true
    return raw !== '0' && raw !== 'false'
  } catch {
    return true
  }
}

function saveEnabled(on: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0')
  } catch {
    // Ignore quota / private mode.
  }
}
