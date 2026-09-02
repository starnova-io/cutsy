import { useGame } from "../game/store";
import { nextUnlockInfo } from "../game/economy";
import { WorldView } from "../world/WorldView";

export function Home(props: {
  chosenMin: number;
  onFocus: () => void;
  arrange: boolean;
  onToggleArrange: () => void;
}) {
  const s = useGame();
  const nu = nextUnlockInfo(s);
  const { chosenMin, onFocus, arrange } = props;
  return (
    <section className="screen active" id="screen-home">
      <header id="home-head">
        <div id="home-energy"><span className="spark">✦</span><b id="energy-pill">{s.energy}</b></div>
        <div id="home-title">My little island</div>
      </header>
      <div id="home-world-outer">
        <WorldView id="world-wrap" opts={{ highlight: arrange }} />
        <button id="btn-arrange" className={arrange ? "on" : ""} aria-label="Arrange your island"
          title="Arrange your island" onClick={props.onToggleArrange}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18M3 12h18" /><path d="M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5" />
          </svg>
        </button>
      </div>
      <div id="home-cta">
        <div id="streak-line">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2.5 3.5 6 5.6 6 9.5A6 6 0 0 1 6 12.5C6 8.6 9.5 6.5 12 3Z" fill="#E8913C" /><path d="M12 11c1.2 1.7 2.5 2.7 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.7 1.3-2.7 2.5-4.4Z" fill="#F2C14E" /></svg>
          <span id="streak-pill">{s.streak} day streak</span>
          <span className="dot">·</span>
          <span id="today-min">{s.todayMin} min</span>&nbsp;today
        </div>
        <button className="btn btn-primary" id="btn-focus" onClick={onFocus}>Focus · {chosenMin} min</button>
        <div id="unlock-track"><div id="unlock-fill" style={{ width: (nu ? nu.pct : 100) + "%" }} /></div>
        <div id="next-unlock">
          {nu
            ? <><b>{nu.left} min</b> of focus until <b>{nu.item.name}</b></>
            : <>Everything unlocked <span className="spark">✦</span></>}
        </div>
      </div>
    </section>
  );
}
