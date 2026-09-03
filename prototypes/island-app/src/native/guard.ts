/* Focus-shield bridge. On an Android (Capacitor) build this talks to the
   native FocusGuard plugin — Do Not Disturb + covering distracting apps
   with a gentle shield. On the web it quietly no-ops, so the same session
   code runs everywhere. Native sources: native/android/. */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GuardPrefs } from "../game/types";

/** the usual suspects; a real build lets the person pick their own */
export const DEFAULT_BLOCKLIST = [
  "com.facebook.katana", "com.instagram.android", "com.zhiliaoapp.musically",
  "com.google.android.youtube", "com.twitter.android", "com.zing.zalo",
  "com.reddit.frontpage",
];

interface FocusGuardPlugin {
  enableDnd(): Promise<{ granted: boolean }>;
  disableDnd(): Promise<void>;
  startAppBlock(opts: { packages: string[] }): Promise<{ granted: boolean }>;
  stopAppBlock(): Promise<void>;
}

const FocusGuard = registerPlugin<FocusGuardPlugin>("FocusGuard");

export const guardAvailable = (): boolean => Capacitor.isNativePlatform();

/** session start: raise whichever shields are switched on */
export async function beginGuard(g: GuardPrefs): Promise<void> {
  if (!guardAvailable()) return;
  if (g.dnd) { try { await FocusGuard.enableDnd(); } catch { /* plugin absent */ } }
  if (g.block) { try { await FocusGuard.startAppBlock({ packages: DEFAULT_BLOCKLIST }); } catch { /* plugin absent */ } }
}

/** session over (finished, ended early, or abandoned): lower everything */
export async function endGuard(): Promise<void> {
  if (!guardAvailable()) return;
  try { await FocusGuard.disableDnd(); } catch { /* plugin absent */ }
  try { await FocusGuard.stopAppBlock(); } catch { /* plugin absent */ }
}
