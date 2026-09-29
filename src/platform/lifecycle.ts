import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNativePlatform } from './kv'

export type AppLifecycleHandlers = {
  /** App left the foreground (home, lock, multitasking). */
  onBackground: () => void
  /** App became active again. */
  onForeground: () => void
}

/**
 * Capacitor App state + Page Visibility. Prefer App plugin on native;
 * visibilitychange covers web / PWA and is a backup on iOS.
 */
export async function bindAppLifecycle(
  handlers: AppLifecycleHandlers,
): Promise<() => void> {
  let lastHidden = typeof document !== 'undefined' && document.hidden
  let nativeHandle: PluginListenerHandle | null = null

  const onVis = () => {
    const hidden = document.hidden
    if (hidden === lastHidden) return
    lastHidden = hidden
    if (hidden) handlers.onBackground()
    else handlers.onForeground()
  }

  document.addEventListener('visibilitychange', onVis)

  if (isNativePlatform()) {
    try {
      nativeHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          lastHidden = false
          handlers.onForeground()
        } else {
          lastHidden = true
          handlers.onBackground()
        }
      })
    } catch {
      // Plugin missing — visibilitychange still works.
    }
  }

  return () => {
    document.removeEventListener('visibilitychange', onVis)
    void nativeHandle?.remove()
  }
}
