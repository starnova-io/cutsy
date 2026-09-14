import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

/** Hold the frame until the webfonts are in: a frame drawn mid-swap ships the
 *  fallback face, and nothing about the PNG says so. */
export function useFontsReady(): void {
  const [handle] = useState(() => delayRender("webfonts"));
  useEffect(() => { void document.fonts.ready.then(() => continueRender(handle)); }, [handle]);
}
