/* Focus-shield bridge. On an Android (Capacitor) build this talks to the
   native FocusGuard plugin — Do Not Disturb + covering distracting apps
   with a gentle shield. Everywhere else there is no plugin to talk to:
   the web has no such power at all, and iOS has no public API for either
   (Do Not Disturb is read-only via INFocusStatusCenter, and app blocking
   needs the Screen Time / FamilyControls entitlement plus its own
   extension). So off Android we say so instead of pretending.
   Native sources: native/android/. */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GuardPrefs } from "../game/types";

/** the usual suspects; a real build lets the person pick their own */
export const DEFAULT_BLOCKLIST = [
  "com.facebook.katana", "com.instagram.android", "com.zhiliaoapp.musically",
  "com.google.android.youtube", "com.twitter.android", "com.zing.zalo",
  "com.reddit.frontpage",
];

interface FocusGuardPlugin {
  capabilities(): Promise<GuardCaps>;
  requestAccess(): Promise<{ granted: boolean }>;
  pickApps(): Promise<{ chosen: number; apps: number; categories: number }>;
  enableDnd(): Promise<{ granted: boolean }>;
  disableDnd(): Promise<void>;
  startAppBlock(opts: { packages: string[] }): Promise<{ granted: boolean }>;
  stopAppBlock(): Promise<void>;
}

/** what the platform underneath can really do — the UI renders from this */
export interface GuardCaps {
  /** can it silence notifications? (Android yes, iOS never) */
  dnd: boolean;
  /** can it block apps? */
  block: boolean;
  /** must the person choose the apps themselves? (iOS Screen Time) */
  needsPicker: boolean;
  /** how many apps they have chosen so far */
  chosen: number;
}

export const NO_GUARD: GuardCaps = { dnd: false, block: false, needsPicker: false, chosen: 0 };

const FocusGuard = registerPlugin<FocusGuardPlugin>("FocusGuard");

/** what the session actually got — not what was asked for */
export interface GuardStatus { dnd: boolean; block: boolean }

/** true only where the native plugin is really registered (Android builds) */
export const guardAvailable = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("FocusGuard");

/** ask the plugin what it can do. Off a native build nothing can. */
export async function loadGuardCaps(): Promise<GuardCaps> {
  if (!guardAvailable()) return NO_GUARD;
  try { return await FocusGuard.capabilities(); } catch { return NO_GUARD; }
}

/** one-time system grant (iOS: Screen Time authorization) */
export async function requestGuardAccess(): Promise<boolean> {
  if (!guardAvailable()) return false;
  try { return (await FocusGuard.requestAccess()).granted; } catch { return false; }
}

/** what came back from the system picker; apps and whole categories both count */
export interface Picked { chosen: number; apps: number; categories: number }

/** hand over to the system app picker */
export async function pickBlockedApps(): Promise<Picked> {
  const none: Picked = { chosen: 0, apps: 0, categories: 0 };
  if (!guardAvailable()) return none;
  try {
    const r = await FocusGuard.pickApps();
    return { chosen: r.chosen ?? 0, apps: r.apps ?? 0, categories: r.categories ?? 0 };
  } catch { return none; }
}

/** session start: raise whichever shields are switched on, and report back
    which ones actually went up — a missing permission sends the person to
    the right settings screen and resolves { granted: false }. */
export async function beginGuard(g: GuardPrefs): Promise<GuardStatus> {
  const got: GuardStatus = { dnd: false, block: false };
  if (!guardAvailable()) return got;
  /* never ask for a shield this platform can't raise — that round-trip is
     exactly what used to come back silently and get reported as success */
  const caps = await loadGuardCaps();
  g = { dnd: g.dnd && caps.dnd, block: g.block && caps.block };
  if (g.dnd) {
    try { got.dnd = (await FocusGuard.enableDnd()).granted; } catch { got.dnd = false; }
  }
  if (g.block) {
    try {
      got.block = (await FocusGuard.startAppBlock({ packages: DEFAULT_BLOCKLIST })).granted;
    } catch { got.block = false; }
  }
  return got;
}

/** session over (finished, ended early, or abandoned): lower everything */
export async function endGuard(): Promise<void> {
  if (!guardAvailable()) return;
  try { await FocusGuard.disableDnd(); } catch { /* never granted */ }
  try { await FocusGuard.stopAppBlock(); } catch { /* never granted */ }
}
