import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.lwilli.wormular',
  appName: 'Wormular',
  webDir: 'dist',
  backgroundColor: '#0B1020',
  ios: {
    // Edge-to-edge WKWebView so the arena centers on the physical screen.
    // UI already respects env(safe-area-inset-*) for chrome.
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
}

export default config
