import UIKit
import Capacitor
import WebKit

/// Capacitor bridge with iOS text interaction (magnifier / selection) disabled.
/// CSS alone cannot suppress the loupe Apple reintroduced in iOS 15.
class GameViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        if #available(iOS 14.5, *) {
            config.preferences.isTextInteractionEnabled = false
        }
        return config
    }
}
