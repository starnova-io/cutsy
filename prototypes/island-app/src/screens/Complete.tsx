import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { nextUnlockInfo } from "../game/economy";
import { world } from "../world/world3d";
import { catSVG, dogSVG } from "../ui/mascots";
import * as sfx from "../game/sfx";
import { softHaptic } from "../native/haptics";
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
  /* the companion wakes before it celebrates: a sleepy stretch, then the jump */
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    /* the sound of "ahh, done": the full signature, a few tiny tinks as the
       sparks fly (not one per spark), the companion's sleepy mrrr, and — if
       something unlocked — its own sound as it's revealed */
    const ts = [
      window.setTimeout(() => { sfx.signature(3); softHaptic(); }, 60),
      ...[0, 1, 2].map(i => window.setTimeout(() => sfx.sparkTink(i), 480 + i * 140)),
      window.setTimeout(() => sfx.petMrrr(s.pet), 560),
      window.setTimeout(() => setAwake(true), 700),
    ];
    const lvUp = Math.floor(s.totalMin / 100) > Math.floor((s.totalMin - payload.minutes) / 100);
    if (item) ts.push(window.setTimeout(() => sfx.unlock(item.cat, item.id), lvUp ? 2300 : 1000));
    return () => ts.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* leaving sends the sparks down into the island before Home appears */
  const [leaving, setLeaving] = useState(false);
  const away = (fn: () => void) => () => {
    if (leaving) return;
    setLeaving(true);
    sfx.tapUI();
    window.setTimeout(() => sfx.sparkTink(3), 300);
    window.setTimeout(fn, navigator.webdriver ? 0 : 420);
  };
  /* crossing a hundred minutes is a level: the bar runs to full, a spark runs
     along it, and the number turns over — quiet, no confetti */
  const lvlNow = Math.floor(s.totalMin / 100) + 1;
  const lvlBefore = Math.floor((s.totalMin - payload.minutes) / 100) + 1;
  const leveled = lvlNow > lvlBefore;
  const [lvlShown, setLvlShown] = useState(lvlBefore);
  useEffect(() => {
    if (!leveled) return;
    const t = window.setTimeout(() => { setLvlShown(lvlNow); sfx.levelUp(); softHaptic(); }, 1750);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tag = !item ? "" : item.special === "land" || item.special === "bridge" ? "New land discovered"
    : item.cat === "buildings" ? "New building unlocked" : item.cat === "plants" ? "New plant unlocked"
    : "New piece unlocked";
  return (
    <section className={"screen active" + (leaving ? " leaving" : "")} id="screen-complete">
      <div id="complete-inner">
        <div id="complete-spark">
          <svg id="complete-pet" viewBox="-30 -58 60 64" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: s.pet === "dog" ? dogSVG(awake ? "happy" : "drowsy") : catSVG(awake ? "happy" : "drowsy") }} />
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
        {leveled && (
          <div id="level-up" style={{ ["--from" as never]: ((s.totalMin - payload.minutes) % 100) + "%" as never }}>
            <span className="lu-num" key={lvlShown}>Level {lvlShown}</span>
            <div className="lu-track"><div className="lu-fill" /><span className="lu-spark" aria-hidden="true">✦</span></div>
          </div>
        )}
        {item && (
          <div id="reward-card" className={leveled ? "after-level" : ""}>
            <img id="reward-img" alt="" src={world.thumb(item.id)}
              style={{ width: 110, height: 96, objectFit: "contain" }} />
            <div id="reward-name">{item.name}</div>
            <div id="reward-tag">{tag}</div>
          </div>
        )}
        <div id="complete-actions">
          {item ? (
            <>
              <button className="btn btn-primary" id="btn-reward-primary" data-sfx="own"
                onClick={away(item.special === "bridge" ? props.onBuildGiftBridge
                  : item.special === "land" ? props.onRaiseGiftLand : props.onPlaceGift)}>
                {item.special === "bridge" ? "Build it" : item.special === "land" ? "Raise it" : "Place it"}
              </button>
              <button className="btn btn-ghost" id="btn-reward-later" data-sfx="own" onClick={away(props.onHome)}>Later</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" id="btn-reward-primary" data-sfx="own" onClick={away(props.onHome)}>
                Back to your island
              </button>
              <button className="btn btn-ghost" id="btn-reward-later" data-sfx="own" onClick={away(props.onHome)}>
                {nu ? `Next unlock: ${nu.item.name} in ${nu.left} min` : "Everything unlocked ✦"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
