import { useEffect, useState } from "react";
import { BRAND, ISLE_BASE, ISLE_SHADE, ISLE_TOP, SPARK } from "../ui/brand";
import { catSVG, dogSVG } from "../ui/mascots";
import type { PetKind } from "../game/types";

/* The launch, told in two seconds: a ✦ drops onto a bare little island, the
   island grows — grass, a tree, a house — the companion peeks out, the name
   rises, and then the view dives into the island and hands over to the real
   one. The native launch image is this first frame (cream, a ✦ dead centre),
   so there's no seam between the two. */

const DIVE_AT = 2050;   /* ms: the name is up — dive in */
const DONE_AT = 2700;   /* ms: the overlay is gone */

export function Splash({ pet, onLand, onDive, onDone }: { pet: PetKind; onLand: () => void; onDive: () => void; onDone: () => void }) {
  const [dive, setDive] = useState(false);
  useEffect(() => {
    const quick = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = window.setTimeout(() => { setDive(true); onDive(); }, quick ? 450 : DIVE_AT);
    const t2 = window.setTimeout(onDone, quick ? 750 : DONE_AT);
    const t3 = window.setTimeout(onLand, 700);   /* the ✦ touches the island */
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div id="splash" className={dive ? "dive" : ""} aria-hidden="true">
      <svg id="splash-art" viewBox="0 0 100 100">
        <ellipse className="sp-shadow" cx="50" cy="99" rx="22" ry="2.2" fill="rgba(80,50,70,.13)" />
        <g className="sp-isle">
          <path d={ISLE_BASE} fill={BRAND.pink} />
          <path d={ISLE_SHADE} fill={BRAND.pinkShade} />
          <path d={ISLE_TOP} fill={BRAND.sand} />
          <path className="sp-grass" d={ISLE_TOP} fill={BRAND.grass} />
          <ellipse className="sp-pulse" cx="50" cy="55" rx="30" ry="10" fill="none" stroke={BRAND.gold} strokeWidth="1" />
          {/* the tree, back left */}
          <g className="sp-pop sp-tree"><g className="sp-sway">
            <rect x="29.6" y="42" width="2.6" height="12" rx="1" fill="#8A6247" />
            <circle cx="30.9" cy="38.4" r="7.6" fill={BRAND.grassDeep} />
            <circle cx="28.4" cy="35.6" r="4.4" fill="#A9C98F" />
          </g></g>
          {/* the house, back right: cream walls, green roof, one warm window */}
          <g className="sp-pop sp-house">
            <path d="M57 56V45H70.5V56Z" fill="#FBF6F2" />
            <path d="M70.5 56V45H74.5V56Z" fill="#E2D5D2" />
            <path d="M54.6 45.6L64 37L77 45.6Z" fill="#5E8452" />
            <path d="M64 37L77 45.6H70.5Z" fill="#4B6C42" />
            <rect x="60.4" y="47.6" width="5.4" height="4.6" rx="1" fill="#FFD98E" />
          </g>
          {/* the companion steps out beside the house */}
          <g className="sp-pet"><g transform="translate(47 60) scale(.27)"
            dangerouslySetInnerHTML={{ __html: pet === "dog" ? dogSVG("idle") : catSVG("idle") }} /></g>
        </g>
      </svg>
      <svg id="splash-spark" viewBox="-14 -14 28 28">
        <circle className="sp-glow" r="13" fill="rgba(227,168,62,.22)" />
        <path d={SPARK} fill={BRAND.gold} />
      </svg>
      <div id="splash-name">
        <div className="sp-title">Hearth Island</div>
        <div className="sp-tag">Focus. Grow your world.</div>
      </div>
    </div>
  );
}
