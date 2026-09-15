import eatUrl from '../../assets/sounds/eat.m4a?url'
import crashUrl from '../../assets/sounds/crash.m4a?url'
import wooshUrl from '../../assets/sounds/woosh.m4a?url'
import musicUrl from '../../assets/sounds/music.mp3?url'

/** Legacy single mute — migrated into both SFX + music once. */
const LEGACY_MUTE_KEY = 'wormular.soundEnabled'
const SFX_MUTE_KEY = 'wormular.sfxEnabled'
const MUSIC_MUTE_KEY = 'wormular.musicEnabled'

/** Shared Web Audio gains so mobile mix matches desktop (HTMLAudio alone is louder on iOS). */
const SFX_MASTER = 1.55
const MUSIC_GAIN = 0.055
const EAT_VOL = 1
const CRASH_VOL = 0.95
const WOOSH_VOL = 1

export type AudioController = {
  isSfxEnabled: () => boolean
  isMusicEnabled: () => boolean
  setSfxEnabled: (on: boolean) => void
  setMusicEnabled: (on: boolean) => void
  toggleSfx: () => boolean
  toggleMusic: () => boolean
  /** Call from a user gesture so browsers allow playback. */
  unlock: () => void
  playEat: () => void
  playCrash: () => void
  playWoosh: () => void
}

type SfxBuffers = {
  eat: AudioBuffer | null
  crash: AudioBuffer | null
  woosh: AudioBuffer | null
}

/**
 * SFX via Web Audio (decode once, play with BufferSource — low latency on iOS).
 * BGM is also routed through Web Audio (MediaElementSource → GainNode) so
 * relative loudness stays consistent on mobile Safari / WKWebView.
 */
export function createAudio(): AudioController {
  let sfxEnabled = loadFlag(SFX_MUTE_KEY, true)
  let musicEnabled = loadFlag(MUSIC_MUTE_KEY, true)
  migrateLegacyMute()
  // Re-read after migration may have written the split keys.
  sfxEnabled = loadFlag(SFX_MUTE_KEY, true)
  musicEnabled = loadFlag(MUSIC_MUTE_KEY, true)

  let unlocked = false
  let music: HTMLAudioElement | null = null
  let musicGain: GainNode | null = null
  let musicRouted = false
  let ctx: AudioContext | null = null
  const buffers: SfxBuffers = { eat: null, crash: null, woosh: null }
  let rawEat: ArrayBuffer | null = null
  let rawCrash: ArrayBuffer | null = null
  let rawWoosh: ArrayBuffer | null = null
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
      const [eatRes, crashRes, wooshRes] = await Promise.all([
        fetch(eatUrl),
        fetch(crashUrl),
        fetch(wooshUrl),
      ])
      rawEat = await eatRes.arrayBuffer()
      rawCrash = await crashRes.arrayBuffer()
      rawWoosh = await wooshRes.arrayBuffer()
    })().catch(() => {
      fetchPromise = null
    })
    return fetchPromise
  }

  function decodeSfx(): Promise<void> {
    if (buffers.eat && buffers.crash && buffers.woosh) return Promise.resolve()
    if (decodePromise) return decodePromise
    decodePromise = (async () => {
      await prefetchSfx()
      if (!rawEat || !rawCrash || !rawWoosh) return
      const ac = ensureCtx()
      // decodeAudioData detaches the buffer; keep copies for retries.
      const [eat, crash, woosh] = await Promise.all([
        ac.decodeAudioData(rawEat.slice(0)),
        ac.decodeAudioData(rawCrash.slice(0)),
        ac.decodeAudioData(rawWoosh.slice(0)),
      ])
      buffers.eat = eat
      buffers.crash = crash
      buffers.woosh = woosh
    })().catch(() => {
      decodePromise = null
    })
    return decodePromise
  }

  function playBuffer(buf: AudioBuffer | null, volume: number): void {
    if (!sfxEnabled || !unlocked || !buf) return
    const ac = ensureCtx()
    if (ac.state === 'suspended') void ac.resume()
    const src = ac.createBufferSource()
    src.buffer = buf
    const gain = ac.createGain()
    gain.gain.value = volume * SFX_MASTER
    src.connect(gain)
    gain.connect(ac.destination)
    src.start(0)
  }

  function ensureMusic(): HTMLAudioElement {
    if (!music) {
      music = new Audio(musicUrl)
      music.loop = true
      music.preload = 'none'
      // Element volume stays at 1; loudness is controlled by musicGain below.
      music.volume = 1
    }
    routeMusic()
    return music
  }

  function routeMusic(): void {
    if (!music || musicRouted) return
    try {
      const ac = ensureCtx()
      const src = ac.createMediaElementSource(music)
      musicGain = ac.createGain()
      musicGain.gain.value = MUSIC_GAIN
      src.connect(musicGain)
      musicGain.connect(ac.destination)
      musicRouted = true
    } catch {
      // createMediaElementSource can only be called once per element; if it
      // fails, fall back to element volume so music still plays.
      if (music) music.volume = MUSIC_GAIN
    }
  }

  function syncMusic(): void {
    if (!unlocked || !musicEnabled) {
      music?.pause()
      return
    }
    const m = ensureMusic()
    if (musicGain) musicGain.gain.value = MUSIC_GAIN
    void m.play().catch(() => {
      // Autoplay may still be blocked until a later gesture.
    })
  }

  // Warm-fetch SFX bytes at boot (no AudioContext yet — safer on iOS).
  void prefetchSfx()

  return {
    isSfxEnabled: () => sfxEnabled,
    isMusicEnabled: () => musicEnabled,

    setSfxEnabled(on) {
      sfxEnabled = on
      saveFlag(SFX_MUTE_KEY, on)
      if (on) unlocked = true
      if (on) {
        void ensureCtx().resume()
        void decodeSfx()
      }
    },

    setMusicEnabled(on) {
      musicEnabled = on
      saveFlag(MUSIC_MUTE_KEY, on)
      if (on) unlocked = true
      if (on) {
        void ensureCtx().resume()
      }
      syncMusic()
    },

    toggleSfx() {
      const next = !sfxEnabled
      this.setSfxEnabled(next)
      return next
    },

    toggleMusic() {
      const next = !musicEnabled
      this.setMusicEnabled(next)
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
      playBuffer(buffers.eat, EAT_VOL)
    },

    playCrash() {
      playBuffer(buffers.crash, CRASH_VOL)
    },

    playWoosh() {
      playBuffer(buffers.woosh, WOOSH_VOL)
    },
  }
}

function migrateLegacyMute(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_MUTE_KEY)
    if (legacy === null) return
    // Only migrate if split keys are not yet set.
    if (
      localStorage.getItem(SFX_MUTE_KEY) !== null ||
      localStorage.getItem(MUSIC_MUTE_KEY) !== null
    ) {
      return
    }
    const on = legacy !== '0' && legacy !== 'false'
    saveFlag(SFX_MUTE_KEY, on)
    saveFlag(MUSIC_MUTE_KEY, on)
  } catch {
    // Ignore quota / private mode.
  }
}

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw !== '0' && raw !== 'false'
  } catch {
    return fallback
  }
}

function saveFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // Ignore quota / private mode.
  }
}
