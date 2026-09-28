import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

function useNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Sync web/local read — also used as native boot fallback before hydrate. */
export function kvGetLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function kvSetLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore quota / private mode.
  }
}

export async function kvGet(key: string): Promise<string | null> {
  if (!useNative()) return kvGetLocal(key)
  try {
    const { value } = await Preferences.get({ key })
    return value ?? null
  } catch {
    return kvGetLocal(key)
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  kvSetLocal(key, value)
  if (!useNative()) return
  try {
    await Preferences.set({ key, value })
  } catch {
    // Ignore native storage failures; local mirror still written.
  }
}

export function isNativePlatform(): boolean {
  return useNative()
}
