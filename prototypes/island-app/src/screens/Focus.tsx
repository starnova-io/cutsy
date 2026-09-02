import { useGame } from "../game/store";
import { curWeather } from "../game/weather";
import { focusSceneSVG } from "../ui/mascots";
import type { SessionInfo } from "../game/types";

const fmt = (ms: number): string => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};

export function Focus(props: {
  session: SessionInfo | null;
  chosenMin: number;
  demo: boolean;
  onPickMin: (m: number) => void;
  onToggleDemo: () => void;
  onStart: () => void;
  onPause: () => void;
  onEnd: () => void;
  onBack: () => void;
}) {
  const s = useGame();
  const { session, chosenMin } = props;
  const running = !!session;
  const sub = curWeather() === "rain" ? "Rain on the water, warm by the fire." : "Your island is waiting for you.";
  return (
    <section className={"screen active" + (running ? " running" : "")} id="screen-focus">
      <button id="demo-toggle" className={props.demo ? "on" : ""} onClick={props.onToggleDemo}
        title="Speed up time for this prototype">Demo ×60</button>
      <div id="focus-inner">
        <div id="focus-top">
          <span id="shield" style={{ visibility: running ? "visible" : "hidden" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11Z" fill="#A89AA6" /></svg>
            {" "}Distracting apps silenced
          </span>
          <div id="timer">{fmt(session ? session.remainMs : chosenMin * 60000)}</div>
          <div id="focus-line">{session?.paused ? "Paused — take a breath." : "Let’s focus together."}</div>
          <div id="focus-sub">{sub}</div>
        </div>
        <svg id="focus-scene" viewBox="0 0 300 170" aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: focusSceneSVG(s.pet, running && !session?.paused ? "sleep" : "idle") }} />
        <div id="focus-actions">
          {!running && (
            <>
              <div id="dur-chips">
                {[15, 25, 50].map(m => (
                  <button key={m} className={"chip" + (chosenMin === m ? " on" : "")}
                    data-min={m} onClick={() => props.onPickMin(m)}>{m} min</button>
                ))}
              </div>
              <div id="earn-line">You’ll earn <b>✦ {chosenMin}</b> when you finish</div>
              <button className="btn btn-primary" id="btn-start" onClick={props.onStart}>Start</button>
              <button className="btn btn-ghost" id="btn-back-home" onClick={props.onBack}>Back to your island</button>
            </>
          )}
          {running && (
            <>
              <button className="btn btn-primary" id="btn-pause" onClick={props.onPause}>
                {session!.paused ? "Resume" : "Pause"}
              </button>
              <button className="btn btn-ghost" id="btn-end" onClick={props.onEnd}>End session</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
