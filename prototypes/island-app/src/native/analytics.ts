/* Google Analytics for Firebase — anonymous usage analytics only.
 *
 * Counts of actions, never the contents of anyone's island. No IDFA, no ATT,
 * no ads. On the web (and any non-native build) every call is a no-op, so the
 * vite dev server and e2e runs are unaffected.
 */
import { Capacitor } from "@capacitor/core";
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";

const native = () => Capacitor.isNativePlatform();

export async function initAnalytics(): Promise<void> {
  if (!native()) return;
  try { await FirebaseAnalytics.setEnabled({ enabled: true }); }
  catch (e) { console.warn("[analytics] init failed", e); }
}

export function logEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!native()) return;
  FirebaseAnalytics.logEvent({ name, params }).catch(() => undefined);
}

export function logScreen(screenName: string): void {
  if (!native()) return;
  FirebaseAnalytics.setCurrentScreen({ screenName }).catch(() => undefined);
}
