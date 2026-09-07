/* Splash bridge. The native launch screen stays up until the island has
   actually drawn — otherwise the app flashes white between the launch image
   and the first WebGL frame. No-ops on the web, where there is no splash. */
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

const native = (): boolean => Capacitor.isNativePlatform();

let done = false;
function hideNow(): void {
  if (done || !native()) return;
  done = true;
  void SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => undefined);
}

/* launchAutoHide is off, so nothing but this module ever takes the splash
   down. If boot throws before hideSplash() runs, this failsafe still does —
   a stuck splash is a bricked app. */
if (native()) setTimeout(hideNow, 5000);

/** call once the first frame is on screen */
export function hideSplash(): void {
  if (!native()) return;
  /* two frames: one to commit the DOM, one for the renderer to paint into it */
  requestAnimationFrame(() => requestAnimationFrame(hideNow));
}
