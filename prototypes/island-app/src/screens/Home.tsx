import { useEffect, useRef, useState } from "react";
import { useTween } from "../ui/tween";
import { catSVG, dogSVG } from "../ui/mascots";
import { useGame } from "../game/store";
import { nextUnlockInfo } from "../game/economy";
import { WorldView } from "../world/WorldView";
import { world } from "../world/world3d";
import type { PlacedItem } from "../game/types";
import type { Arrival } from "../App";

const HINT_KEY = "hearth-hint-orbit";


const seen = (k: string): boolean => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
const markSeen = (k: string): void => { try { localStorage.setItem(k, "1"); } catch { /* private mode */ } };

export function Home(props: {
  chosenMin: number;
  onFocus: () => void;
  arrange: boolean;
  onToggleArrange: () => void;
  sound: boolean;
  onToggleSound: () => void;
  /** the piece currently lifted off the island, if any */
  held: PlacedItem | null;
  onRotateHeld: () => void;
  onCancelHeld: () => void;
  /** Home before the session that just paid out — animate from it */
  arrival?: Arrival | null;
  /** a gift that just landed on the island */
  reveal?: { name: string; sub: string } | null;
}) {
  const s = useGame();
  const nu = nextUnlockInfo(s);
  const { chosenMin, onFocus, arrange, arrival } = props;
  /* After a session the numbers don't just change, they travel: the Sparks
     count up, the unlock bar fills from where it was. */
  const energy = useTween(arrival ? arrival.energy : s.energy, s.energy, !!arrival, 900, 450);
  /* only travel when it's still the same goal — once it's reached, the next
     one simply appears rather than counting the wrong way */
  const sameGoal = !!arrival && arrival.goal !== null && arrival.goal === nu?.item.id;
  const left = useTween(sameGoal ? arrival!.left! : nu?.left ?? 0, nu?.left ?? 0, sameGoal, 900, 700);
  const [barFrom, setBarFrom] = useState<number | null>(sameGoal ? arrival!.pct : null);
  useEffect(() => {
    if (!arrival || !sameGoal) return;
    setBarFrom(arrival.pct);
    const t = window.setTimeout(() => setBarFrom(null), 700);
    return () => window.clearTimeout(t);
  }, [arrival]);
  /* the arrange tool only appears while the person is touching their
     island — an idle Home shows just the world and the speaker */
  const [tools, setTools] = useState(false);
  const hideT = useRef<number | undefined>(undefined);
  const wake = () => {
    setTools(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setTools(false), 6000);
  };
  useEffect(() => () => window.clearTimeout(hideT.current), []);
  const [hint, setHint] = useState(() => !seen(HINT_KEY));
  const dismissHint = () => { if (hint) { setHint(false); markSeen(HINT_KEY); } };
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(dismissHint, 6800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);
  return (
    <section className="screen active" id="screen-home">
      <header id="home-head">
        <div id="home-title">My little island</div>
        <div id="home-energy" aria-label={`${s.energy} Sparks`}><span className="spark">✦</span><b id="energy-pill" className={arrival ? "counting" : ""}>{energy}</b></div>
      </header>
      <div id="home-world-outer" onPointerDown={() => { wake(); dismissHint(); }}>
        {hint && (
          /* the first-run gesture hint lives on the island it's about, never
             over the Focus button — and only ever shows once */
          <div id="world-hint" aria-hidden="true">
            <svg className="hint-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="m7 9-3 3 3 3M17 9l3 3-3 3" /></svg>Drag to explore
            <span className="dot">·</span>
            <svg className="hint-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20 10 14M20 4l-6 6" /><path d="M4 15v5h5M20 9V4h-5" /></svg>Pinch to zoom
          </div>
        )}
        {props.reveal && (
          <div id="unlock-banner" key={props.reveal.name} aria-live="polite">
            <div className="ub-shade" aria-hidden="true" />
            <div className="ub-sweep" aria-hidden="true" />
            <div className="ub-card">
              <span className="ub-spark" aria-hidden="true">✦</span>
              <b>{props.reveal.name}</b>
              <span>{props.reveal.sub}</span>
            </div>
          </div>
        )}
        {arrival?.streakUp && (
          /* the day's first session: a small warm card, the companion beside it */
          <div id="streak-card" aria-live="polite" style={props.reveal ? { top: 104 } : undefined}>
            <svg className="sc-pet" viewBox="-27 -56 54 62" aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: s.pet === "dog" ? dogSVG("happy") : catSVG("happy") }} />
            <svg className="sc-flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2.5 3.5 6 5.6 6 9.5A6 6 0 0 1 6 12.5C6 8.6 9.5 6.5 12 3Z" fill="#E8913C" /><path d="M12 11c1.2 1.7 2.5 2.7 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.7 1.3-2.7 2.5-4.4Z" fill="#F2C14E" /></svg>
            <span><b>{s.streak} day streak</b>{[7, 14, 30, 100].includes(s.streak) ? <em>{s.streak} days together</em> : null}</span>
          </div>
        )}
        <WorldView id="world-wrap"
          opts={props.held ? { ghost: props.held, grid: true, highlight: arrange } : { highlight: arrange }} />
        {props.held && (
          /* No Done here on purpose: tapping open ground or letting go of a
             drag is what puts a piece down. These two are the ways out. */
          <div id="hold-bar">
            <button className="btn hold-btn" onClick={props.onRotateHeld}>⟳ Rotate</button>
            <button className="btn hold-btn ghost" onClick={props.onCancelHeld}>Put back</button>
          </div>
        )}
        <button id="btn-arrange" className={(arrange ? "on" : "") + (tools || arrange ? "" : " ghosted")}
          aria-label="Arrange your island" title="Arrange your island" onClick={props.onToggleArrange}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18M3 12h18" /><path d="M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5" />
          </svg>
        </button>
        <button id="btn-sound" data-sfx="own" className={props.sound ? "" : "off"}
          aria-label={props.sound ? "Turn island sounds off" : "Turn island sounds on"}
          title="Island sounds" onClick={props.onToggleSound}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
            {props.sound
              ? <><path d="M15 9.3a4 4 0 0 1 0 5.4" /><path d="M17.8 6.6a8 8 0 0 1 0 10.8" /></>
              : <path d="m15.5 9.5 5 5m0-5-5 5" />}
          </svg>
        </button>
      </div>
      <div id="home-cta" className={arrival ? "arrived" : ""}>
        <div id="streak-line" className={arrival?.streakUp ? "streak-up" : ""}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2.5 3.5 6 5.6 6 9.5A6 6 0 0 1 6 12.5C6 8.6 9.5 6.5 12 3Z" fill="#E8913C" /><path d="M12 11c1.2 1.7 2.5 2.7 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.7 1.3-2.7 2.5-4.4Z" fill="#F2C14E" /></svg>
          <span id="streak-pill">{s.streak} day streak</span>
          <span className="dot">·</span>
          <span id="today-min">{s.todayMin} min</span>&nbsp;today
        </div>
        <button className="btn btn-primary" id="btn-focus" onClick={onFocus}>Focus · {chosenMin} min</button>
        <div id="unlock-track"><div id="unlock-fill" className={barFrom !== null ? "hold" : ""}
          style={{ width: (barFrom ?? (nu ? nu.pct : 100)) + "%" }} /></div>
        <div id="next-unlock">
          {nu
            ? <><img className="nu-thumb" alt="" src={world.thumb(nu.item.id)} /><span><b>{left} min</b> of focus until <b>{nu.item.name}</b></span></>
            : <>Everything unlocked <span className="spark">✦</span></>}
        </div>
      </div>
    </section>
  );
}
