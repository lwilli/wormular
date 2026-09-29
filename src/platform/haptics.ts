import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativePlatform } from './kv'
import { isHapticsEnabled } from './settings'

/**
 * Thin haptics façade. No-ops on web / when disabled / when the plugin fails.
 * Never throws into gameplay.
 */
export const haptics = {
  light: () => void impact(ImpactStyle.Light),
  medium: () => void impact(ImpactStyle.Medium),
  heavy: () => void impact(ImpactStyle.Heavy),
  success: () => void notify(NotificationType.Success),
  warning: () => void notify(NotificationType.Warning),
  error: () => void notify(NotificationType.Error),
  /** Short selection tick — used sparingly for UI confirmations. */
  selection: () => void selection(),
}

async function impact(style: ImpactStyle): Promise<void> {
  if (!canHaptic()) return
  try {
    await Haptics.impact({ style })
  } catch {
    // Unavailable (simulator, restricted settings, etc.)
  }
}

async function notify(type: NotificationType): Promise<void> {
  if (!canHaptic()) return
  try {
    await Haptics.notification({ type })
  } catch {
    // ignore
  }
}

async function selection(): Promise<void> {
  if (!canHaptic()) return
  try {
    await Haptics.selectionStart()
    await Haptics.selectionEnd()
  } catch {
    // ignore
  }
}

function canHaptic(): boolean {
  return isNativePlatform() && isHapticsEnabled()
}
