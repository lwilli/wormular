import Foundation
import Capacitor
import GameKit
import UIKit

/**
 Minimal Game Center bridge for Wormular.
 Auth is non-blocking; every method soft-fails so gameplay continues offline
 or when the player is signed out of Game Center.
 */
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAuthenticated", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDashboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockAchievement", returnType: CAPPluginReturnPromise)
    ]

    private var authCall: CAPPluginCall?
    private var authConfigured = false

    @objc func initialize(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated {
            call.resolve(authPayload())
            return
        }
        // Only keep the latest caller; auth is fire-and-forget from JS.
        authCall = call
        guard !authConfigured else { return }
        authConfigured = true

        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, _ in
            guard let self = self else { return }
            if let viewController = viewController {
                DispatchQueue.main.async {
                    self.bridge?.viewController?.present(viewController, animated: true)
                }
                return
            }
            let payload = self.authPayload()
            if let pending = self.authCall {
                self.authCall = nil
                pending.resolve(payload)
            }
        }
    }

    @objc func isAuthenticated(_ call: CAPPluginCall) {
        call.resolve([
            "authenticated": GKLocalPlayer.local.isAuthenticated
        ])
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["submitted": false])
            return
        }
        guard let scoreValue = call.getInt("score") else {
            call.resolve(["submitted": false])
            return
        }
        let leaderboardId = call.getString("leaderboardId") ?? "wormular.highscore"
        GKLeaderboard.submitScore(
            scoreValue,
            context: 0,
            player: GKLocalPlayer.local,
            leaderboardIDs: [leaderboardId]
        ) { error in
            call.resolve(["submitted": error == nil])
        }
    }

    @objc func showDashboard(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve()
            return
        }
        DispatchQueue.main.async {
            let vc = GKGameCenterViewController(state: .leaderboards)
            if let leaderboardId = call.getString("leaderboardId") {
                vc.leaderboardIdentifier = leaderboardId
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func unlockAchievement(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["unlocked": false])
            return
        }
        guard let achievementId = call.getString("achievementId") else {
            call.resolve(["unlocked": false])
            return
        }
        let percent = call.getDouble("percentComplete") ?? 100
        let achievement = GKAchievement(identifier: achievementId)
        achievement.percentComplete = percent
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            call.resolve(["unlocked": error == nil])
        }
    }

    public func gameCenterViewControllerDidFinish(
        _ gameCenterViewController: GKGameCenterViewController
    ) {
        gameCenterViewController.dismiss(animated: true)
    }

    private func authPayload() -> [String: Any] {
        let player = GKLocalPlayer.local
        var payload: [String: Any] = [
            "authenticated": player.isAuthenticated
        ]
        if player.isAuthenticated {
            payload["playerName"] = player.displayName
        }
        return payload
    }
}
