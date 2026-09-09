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

type SfxBuffers = {
  eat: AudioBuffer | null
  crash: AudioBuffer | null
}

/**
 * SFX via Web Audio (decode once, play with BufferSource — low latency on iOS).
 * BGM stays on HTMLAudioElement (simple looping).
 */
export function createAudio(): AudioController {
  let enabled = loadEnabled()
  let unlocked = false
  let music: HTMLAudioElement | null = null
  let ctx: AudioContext | null = null
  const buffers: SfxBuffers = { eat: null, crash: null }
  let rawEat: ArrayBuffer | null = null
  let rawCrash: ArrayBuffer | null = null
  let fetchPromise: Promise<void> | null = null
  let decodePromise: Promise<void> | null = null

  function ensureCtx(): AudioContext {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ctx = new AC()
    }
    return ctx
  }

  function prefetchSfx(): Promise<void> {
    if (fetchPromise) return fetchPromise
    fetchPromise = (async () => {
      const [eatRes, crashRes] = await Promise.all([
        fetch(eatUrl),
        fetch(crashUrl),
      ])
      rawEat = await eatRes.arrayBuffer()
      rawCrash = await crashRes.arrayBuffer()
    })().catch(() => {
      fetchPromise = null
    })
    return fetchPromise
  }

  function decodeSfx(): Promise<void> {
    if (buffers.eat && buffers.crash) return Promise.resolve()
    if (decodePromise) return decodePromise
    decodePromise = (async () => {
      await prefetchSfx()
      if (!rawEat || !rawCrash) return
      const ac = ensureCtx()
      // decodeAudioData detaches the buffer; keep copies for retries.
      const [eat, crash] = await Promise.all([
        ac.decodeAudioData(rawEat.slice(0)),
        ac.decodeAudioData(rawCrash.slice(0)),
      ])
      buffers.eat = eat
      buffers.crash = crash
    })().catch(() => {
      decodePromise = null
    })
    return decodePromise
  }

  function playBuffer(buf: AudioBuffer | null, volume: number): void {
    if (!enabled || !unlocked || !buf) return
    const ac = ensureCtx()
    if (ac.state === 'suspended') void ac.resume()
    const src = ac.createBufferSource()
    src.buffer = buf
    const gain = ac.createGain()
    gain.gain.value = volume
    src.connect(gain)
    gain.connect(ac.destination)
    src.start(0)
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

  // Warm-fetch SFX bytes at boot (no AudioContext yet — safer on iOS).
  void prefetchSfx()

  return {
    isEnabled: () => enabled,

    setEnabled(on) {
      enabled = on
      saveEnabled(on)
      if (on) unlocked = true
      if (on) {
        void ensureCtx().resume()
        void decodeSfx()
      }
      syncMusic()
    },

    toggle() {
      const next = !enabled
      this.setEnabled(next)
      return next
    },

    unlock() {
      if (!unlocked) unlocked = true
      const ac = ensureCtx()
      void ac.resume()
      void decodeSfx()
      syncMusic()
    },

    playEat() {
      playBuffer(buffers.eat, 1)
    },

    playCrash() {
      playBuffer(buffers.crash, 0.85)
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
