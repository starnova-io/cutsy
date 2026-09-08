import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { nextUnlockInfo } from "../game/economy";
import { world } from "../world/world3d";
import { catSVG, dogSVG } from "../ui/mascots";
import type { CompletePayload } from "../game/types";

export function Complete(props: {
  payload: CompletePayload;
  onPlaceGift: () => void;
  onBuildGiftBridge: () => void;
  onRaiseGiftLand: () => void;
  onHome: () => void;
}) {
  const s = useGame();
  const { payload } = props;
  const item = payload.item;
  const nu = nextUnlockInfo(s);
  /* the earned sparks count up while little ✦ fly home */
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const total = payload.minutes;
    const t0 = performance.now();
    const iv = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0 - 350) / 900);
      setShown(Math.max(0, Math.round(total * (1 - Math.pow(1 - Math.max(0, k), 3)))));
      if (k >= 1) window.clearInterval(iv);
    }, 40);
    return () => window.clearInterval(iv);
  }, [payload.minutes]);
  return (
    <section className="screen active" id="screen-complete">
      <div id="complete-inner">
        <div id="complete-spark">
          <svg id="complete-pet" viewBox="-30 -58 60 64" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: s.pet === "dog" ? dogSVG("happy") : catSVG("happy") }} />
          <div id="spark-burst" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="fly-spark" style={{ ["--i" as never]: i as never }}>✦</span>
            ))}
          </div>
        </div>
        <div id="complete-min">{payload.minutes} min focused</div>
        <div id="complete-energy">+ ✦ {shown}</div>
        <div id="complete-grew">{payload.full ? "Your island grew a little." : "Every minute counts."}</div>
        <div id="focus-quality" className={payload.leaves === 0 ? "deep" : ""}>
          {payload.leaves === 0
            ? "Deep focus — you never looked away ✦"
            : `You stepped away ${payload.leaves} ${payload.leaves === 1 ? "time" : "times"} — the island waited.`}
        </div>
        {item && (
          <div id="reward-card">
            <img id="reward-img" alt="" src={world.thumb(item.id)}
              style={{ width: 110, height: 96, objectFit: "contain" }} />
            <div id="reward-name">{item.name}</div>
            <div id="reward-tag">New item unlocked — you earned it</div>
          </div>
        )}
        <div id="complete-actions">
          {item ? (
            <>
              <button className="btn btn-primary" id="btn-reward-primary"
                onClick={item.special === "bridge" ? props.onBuildGiftBridge
                  : item.special === "land" ? props.onRaiseGiftLand : props.onPlaceGift}>
                {item.special === "bridge" ? "Build it" : item.special === "land" ? "Raise it" : "Place it"}
              </button>
              <button className="btn btn-ghost" id="btn-reward-later" onClick={props.onHome}>Later</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" id="btn-reward-primary" onClick={props.onHome}>
                Back to your island
              </button>
              <button className="btn btn-ghost" id="btn-reward-later" onClick={props.onHome}>
                {nu ? `Next unlock: ${nu.item.name} in ${nu.left} min` : "Everything unlocked ✦"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
