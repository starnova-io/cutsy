/* Tiny haptics bridge. Native builds tick the Taptic Engine; the web build
   quietly does nothing (Capacitor's web fallback pokes navigator.vibrate,
   which desktop browsers don't have). Fire-and-forget on purpose — a drag
   must never wait on a plugin round-trip. */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const native = (): boolean => Capacitor.isNativePlatform();

/* iOS drops taps that arrive faster than the engine can play them, and a fast
   drag crosses tiles every few frames — so keep a floor between ticks. */
let lastTick = 0;

/** one soft tick — the item just snapped to a new tile */
export function tickHaptic(): void {
  if (!native()) return;
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

/** a soft landing — a piece was set down */
export function dropHaptic(): void {
  if (!native()) return;
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
}

/** barely there — a toggle, a start, a quiet celebration */
export function softHaptic(): void {
  if (!native()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

/** a firmer bump — a piece was just lifted off the island */
export function liftHaptic(): void {
  if (!native()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}
