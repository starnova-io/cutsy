import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* On a tablet the phone-sized layout used to sit at 430pt in the middle of a
   1000pt screen. It keeps its proportions but is scaled up to the height of
   the screen — the island, the type and the touch targets all grow together.
   `zoom` rather than a transform, so text and the 3D canvas stay crisp. */
function fitTablet(): void {
  const el = document.getElementById("phone");
  if (!el) return;
  const k = Math.min(innerHeight / 920, innerWidth / 430);
  const tablet = innerWidth >= 700 && k > 1.05;
  el.style.zoom = tablet ? String(k) : "";
  document.documentElement.classList.toggle("tablet", tablet);
}
addEventListener("resize", fitTablet);
new MutationObserver(fitTablet).observe(document.getElementById("root")!, { childList: true });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
