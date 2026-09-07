import Capacitor
import UIKit

/**
 Capacitor only auto-registers plugins listed in `capacitor.config.json`'s
 `packageClassList`, which `cap sync` fills in from installed npm packages.
 FocusGuard lives in the app itself, not in a package, so it has to introduce
 itself here — otherwise `Capacitor.isPluginAvailable("FocusGuard")` is false
 and the web side (correctly) reports that the shield isn't available.
 */
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FocusGuardPlugin())
    }
}
