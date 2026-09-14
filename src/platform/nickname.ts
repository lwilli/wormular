import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { sanitizeName } from '../../shared/protocol'

const KEY = 'wormular.nickname'

let cache = ''
let ready = false

function loadLocal(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLocal(name: string): void {
  try {
    localStorage.setItem(KEY, name)
  } catch {
    // ignore
  }
}

async function loadNative(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return value ?? ''
  } catch {
    return ''
  }
}

async function saveNative(name: string): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: name })
  } catch {
    // ignore
  }
}

function useNative(): boolean {
  return Capacitor.isNativePlatform()
}

export async function initNickname(): Promise<void> {
  if (ready) return
  cache = useNative() ? await loadNative() : loadLocal()
  ready = true
}

export function loadNickname(): string {
  if (!ready) cache = loadLocal()
  return cache
}

export function saveNickname(raw: string): string | null {
  const name = sanitizeName(raw)
  if (!name) return null
  cache = name
  if (useNative()) void saveNative(name)
  else saveLocal(name)
  return name
}
