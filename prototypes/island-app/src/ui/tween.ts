import { useEffect, useState } from "react";

/** a number that eases from `from` to `to` once, after `delay` ms */
export function useTween(from: number, to: number, on: boolean, dur: number, delay: number): number {
  const [v, setV] = useState(on ? from : to);
  useEffect(() => {
    if (!on || from === to) { setV(to); return; }
    setV(from);
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, from, to]);
  return v;
}

/** a few ✦ fly from one element to another, across the phone frame */
export function flySparks(from: Element | null, to: Element | null, n = 5, onLand?: (i: number) => void): void {
  const host = document.getElementById("phone");
  if (!host || !from || !to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const hr = host.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const ax = a.left + a.width / 2 - hr.left, ay = a.top + a.height / 2 - hr.top;
  const bx = b.left + b.width / 2 - hr.left, by = b.top + b.height / 2 - hr.top;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.className = "fly-home";
    el.textContent = "✦";
    el.style.left = ax + "px"; el.style.top = ay + "px";
    host.appendChild(el);
    const dx = bx - ax + (Math.random() - .5) * 26, dy = by - ay + (Math.random() - .5) * 14;
    const mid = { x: dx * .5 + (Math.random() - .5) * 60, y: Math.min(dy, 0) * .5 - 40 - Math.random() * 30 };
    const anim = el.animate([
      { transform: "translate(-50%,-50%) scale(.6)", opacity: 0 },
      { transform: `translate(calc(${mid.x}px - 50%), calc(${mid.y}px - 50%)) scale(1.1)`, opacity: 1, offset: .45 },
      { transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%)) scale(.5)`, opacity: .9 },
    ], { duration: 520 + i * 40, delay: i * 55, easing: "cubic-bezier(.45,0,.4,1)", fill: "forwards" });
    anim.onfinish = () => { el.remove(); onLand?.(i); };
  }
}