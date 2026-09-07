import Capacitor
import FamilyControls
import Foundation
import ManagedSettings
import SwiftUI

/**
 Focus shield for Hearth Island sessions — the iOS half of the Android
 FocusGuard plugin (native/android/).

 What iOS can and cannot do, and why this plugin is shaped the way it is:

 - **Blocking apps** goes through Screen Time (FamilyControls + ManagedSettings).
   The person authorizes once, picks the apps themselves in Apple's
   `FamilyActivityPicker`, and we shield that selection for the length of a
   session. We never learn which apps they picked — the picker hands back
   opaque tokens — so unlike Android there is no hardcoded blocklist.
   Needs iOS 16 (`.individual` authorization) and the Family Controls
   capability; distribution needs Apple's approval of the entitlement.

 - **Do Not Disturb** is simply not available. There is no public API to turn
   a Focus on; `INFocusStatusCenter` only *reads* status, with permission. So
   `enableDnd` reports `granted: false` and the web side hides the row rather
   than claiming a shield that isn't up.
 */
@objc(FocusGuardPlugin)
public class FocusGuardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FocusGuardPlugin"
    public let jsName = "FocusGuard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enableDnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disableDnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startAppBlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAppBlock", returnType: CAPPluginReturnPromise),
    ]

    private static let selectionKey = "hearth.focus.selection"

    /// One store, named, so clearing ours never touches anyone else's settings.
    @available(iOS 16.0, *)
    private var store: ManagedSettingsStore {
        ManagedSettingsStore(named: ManagedSettingsStore.Name("hearth.focus"))
    }

    private var supported: Bool {
        if #available(iOS 16.0, *) { return true }
        return false
    }

    /// What this platform can actually deliver, so the UI never over-promises.
    @objc func capabilities(_ call: CAPPluginCall) {
        var chosen = 0
        if #available(iOS 16.0, *) {
            let sel = storedSelection()
            chosen = (sel?.applicationTokens.count ?? 0) + (sel?.categoryTokens.count ?? 0)
        }
        call.resolve([
            "dnd": false,               /* no public API on iOS, at any version */
            "block": supported,
            "needsPicker": true,        /* the person chooses the apps, not us */
            "chosen": chosen,
        ])
    }

    /// One-time Screen Time authorization.
    @objc func requestAccess(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["granted": false, "reason": "ios16"])
            return
        }
        if AuthorizationCenter.shared.authorizationStatus == .approved {
            call.resolve(["granted": true])
            return
        }
        Task {
            do {
                try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                call.resolve(["granted": AuthorizationCenter.shared.authorizationStatus == .approved])
            } catch {
                /* declined, or a Screen Time passcode stood in the way */
                call.resolve(["granted": false, "reason": error.localizedDescription])
            }
        }
    }

    /// Apple's own picker. The selection is all we keep — tokens, not names.
    @objc func pickApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["chosen": 0, "reason": "ios16"])
            return
        }
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else {
                call.reject("no view controller to present from")
                return
            }
            let start = self.storedSelection() ?? FamilyActivitySelection()
            let picker = AppPickerHost(selection: start) { picked in
                host.presentedViewController?.dismiss(animated: true)
                if let picked = picked { self.storeSelection(picked) }
                /* A category ("Social") counts as a pick just as much as a single
                   app does — counting only applicationTokens read as "nothing
                   chosen" for anyone who picked a whole category. */
                let sel = picked ?? start
                call.resolve([
                    "chosen": sel.applicationTokens.count + sel.categoryTokens.count,
                    "apps": sel.applicationTokens.count,
                    "categories": sel.categoryTokens.count,
                ])
            }
            let vc = UIHostingController(rootView: picker)
            vc.modalPresentationStyle = .formSheet
            /* Cancel and Done are the only ways out: a swipe-dismiss would skip
               the completion and leave the caller's promise pending forever. */
            vc.isModalInPresentation = true
            host.present(vc, animated: true)
        }
    }

    /// Not possible on iOS — say so rather than pretending.
    @objc func enableDnd(_ call: CAPPluginCall) {
        call.resolve(["granted": false, "reason": "unsupported"])
    }

    @objc func disableDnd(_ call: CAPPluginCall) {
        call.resolve()
    }

    /// Raise the shield over whatever the person picked. `packages` (the
    /// Android blocklist) is ignored: iOS gives us no way to name an app.
    @objc func startAppBlock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve(["granted": false, "reason": "ios16"])
            return
        }
        guard AuthorizationCenter.shared.authorizationStatus == .approved else {
            call.resolve(["granted": false, "reason": "unauthorized"])
            return
        }
        guard let sel = storedSelection(),
              !(sel.applicationTokens.isEmpty && sel.categoryTokens.isEmpty) else {
            call.resolve(["granted": false, "reason": "nothing-picked"])
            return
        }
        store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
        store.shield.applicationCategories = sel.categoryTokens.isEmpty
            ? nil : .specific(sel.categoryTokens)
        call.resolve(["granted": true])
    }

    /// Lower it. Runs unconditionally — a shield left up after a session would
    /// lock someone out of their own phone.
    @objc func stopAppBlock(_ call: CAPPluginCall) {
        if #available(iOS 16.0, *) { store.clearAllSettings() }
        call.resolve()
    }

    // MARK: - the selection, kept between launches

    @available(iOS 16.0, *)
    private func storeSelection(_ sel: FamilyActivitySelection) {
        guard let data = try? JSONEncoder().encode(sel) else { return }
        UserDefaults.standard.set(data, forKey: Self.selectionKey)
    }

    @available(iOS 16.0, *)
    private func storedSelection() -> FamilyActivitySelection? {
        guard let data = UserDefaults.standard.data(forKey: Self.selectionKey) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }
}

/// SwiftUI wrapper: Apple's picker plus a Done button, since the picker
/// itself ships no chrome.
@available(iOS 16.0, *)
private struct AppPickerHost: View {
    @State var selection: FamilyActivitySelection
    let done: (FamilyActivitySelection?) -> Void

    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $selection)
                .navigationTitle("Apps to shield")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { done(nil) }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { done(selection) }
                    }
                }
        }
    }
}
