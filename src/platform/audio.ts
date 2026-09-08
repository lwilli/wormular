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

  const music = new Audio(musicUrl)
  music.loop = true
  music.preload = 'auto'
  music.volume = 0.10

  function syncMusic(): void {
    if (!unlocked || !enabled) {
      music.pause()
      return
    }
    void music.play().catch(() => {
      // Autoplay may still be blocked until a later gesture.
    })
  }

  function playOneShot(src: string, volume: number): void {
    if (!enabled || !unlocked) return
    const shot = new Audio(src)
    shot.volume = volume
    void shot.play().catch(() => {})
  }

  return {
    isEnabled: () => enabled,

    setEnabled(on) {
      enabled = on
      saveEnabled(on)
      if (on) unlocked = true
      syncMusic()
    },

    toggle() {
      const next = !enabled
      this.setEnabled(next)
      return next
    },

    unlock() {
      if (unlocked) {
        syncMusic()
        return
      }
      unlocked = true
      syncMusic()
    },

    playEat() {
      playOneShot(eatUrl, 1)
    },

    playCrash() {
      playOneShot(crashUrl, 0.85)
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
