import { kvGet, kvGetLocal, kvSet, kvSetLocal } from './kv'

const HAPTICS_KEY = 'wormular.hapticsEnabled'
const ONBOARDING_KEY = 'wormular.onboardingComplete'
/** Legacy single mute — same key as audio.ts migration. */
const LEGACY_SOUND_KEY = 'wormular.soundEnabled'
const SFX_KEY = 'wormular.sfxEnabled'
const MUSIC_KEY = 'wormular.musicEnabled'

export type AppSettings = {
  hapticsEnabled: boolean
  sfxEnabled: boolean
  musicEnabled: boolean
  onboardingComplete: boolean
}

let cache: AppSettings = {
  hapticsEnabled: true,
  sfxEnabled: true,
  musicEnabled: true,
  onboardingComplete: false,
}
let ready = false

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback
  return raw !== '0' && raw !== 'false'
}

function parseLocal(): AppSettings {
  // Migrate legacy mute into split keys if needed.
  const legacy = kvGetLocal(LEGACY_SOUND_KEY)
  let sfx = kvGetLocal(SFX_KEY)
  let music = kvGetLocal(MUSIC_KEY)
  if (legacy !== null && sfx === null && music === null) {
    const on = parseBool(legacy, true)
    kvSetLocal(SFX_KEY, on ? '1' : '0')
    kvSetLocal(MUSIC_KEY, on ? '1' : '0')
    sfx = on ? '1' : '0'
    music = on ? '1' : '0'
  }
  return {
    hapticsEnabled: parseBool(kvGetLocal(HAPTICS_KEY), true),
    sfxEnabled: parseBool(sfx, true),
    musicEnabled: parseBool(music, true),
    onboardingComplete: parseBool(kvGetLocal(ONBOARDING_KEY), false),
  }
}

/** Hydrate from Preferences on native; localStorage on web. */
export async function initSettings(): Promise<void> {
  if (ready) return
  const local = parseLocal()
  const [haptics, sfx, music, onboarding] = await Promise.all([
    kvGet(HAPTICS_KEY),
    kvGet(SFX_KEY),
    kvGet(MUSIC_KEY),
    kvGet(ONBOARDING_KEY),
  ])
  cache = {
    hapticsEnabled: parseBool(haptics, local.hapticsEnabled),
    sfxEnabled: parseBool(sfx, local.sfxEnabled),
    musicEnabled: parseBool(music, local.musicEnabled),
    onboardingComplete: parseBool(onboarding, local.onboardingComplete),
  }
  ready = true
}

export function getSettings(): AppSettings {
  if (!ready) cache = parseLocal()
  return { ...cache }
}

export function isHapticsEnabled(): boolean {
  return getSettings().hapticsEnabled
}

export function setHapticsEnabled(on: boolean): void {
  cache.hapticsEnabled = on
  void kvSet(HAPTICS_KEY, on ? '1' : '0')
}

export function toggleHaptics(): boolean {
  const next = !isHapticsEnabled()
  setHapticsEnabled(next)
  return next
}

export function isOnboardingComplete(): boolean {
  return getSettings().onboardingComplete
}

export function setOnboardingComplete(done: boolean): void {
  cache.onboardingComplete = done
  void kvSet(ONBOARDING_KEY, done ? '1' : '0')
}

/** Kept for audio.ts to write through the same keys. */
export function persistSfxEnabled(on: boolean): void {
  cache.sfxEnabled = on
  void kvSet(SFX_KEY, on ? '1' : '0')
}

export function persistMusicEnabled(on: boolean): void {
  cache.musicEnabled = on
  void kvSet(MUSIC_KEY, on ? '1' : '0')
}

export function loadSfxEnabled(): boolean {
  return getSettings().sfxEnabled
}

export function loadMusicEnabled(): boolean {
  return getSettings().musicEnabled
}
