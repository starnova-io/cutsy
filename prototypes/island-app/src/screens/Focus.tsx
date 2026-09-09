import { mutate, useGame } from "../game/store";
import { curWeather } from "../game/weather";
import { guardAvailable, type GuardCaps, type GuardStatus } from "../native/guard";
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
  /** what the native shields actually managed to do — null before a session */
  shield: GuardStatus | null;
  /** what this device can do at all */
  caps: GuardCaps;
  onPickApps: () => void;
  onPickMin: (m: number) => void;
  onToggleDemo: () => void;
  onStart: () => void;
  onPause: () => void;
  onEnd: () => void;
  onBack: () => void;
}) {
  const s = useGame();
  const { session, chosenMin, shield, caps } = props;
  const running = !!session;
  /* Offer only what the platform can really do: no plugin at all (web) leaves
     both rows visibly inert, and a row the device can't honour — Do Not
     Disturb on iOS — isn't shown at all rather than sitting there dead. */
  const native = guardAvailable();
  const hint = native ? null : "Phone app";
  const sub = curWeather() === "rain" ? "Rain on the water, warm by the fire." : "Your island is waiting for you.";
  return (
    <section className={"screen active" + (running ? " running" : "")} id="screen-focus">
      {/* dev-only time warp — visit with #demo (or ?demo) to reveal it, never in screenshots */}
      {(location.hash.includes("demo") || location.search.includes("demo")) && (
        <button id="demo-toggle" className={props.demo ? "on" : ""} onClick={props.onToggleDemo}
          title="Speed up time to preview the loop">Demo ×60</button>
      )}
      <div id="focus-inner">
        <div id="focus-top">
          <span id="shield" style={{ visibility: running && shield && (shield.dnd || shield.block) ? "visible" : "hidden" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11Z" fill="#A89AA6" /></svg>
            {" "}{shield?.block ? "Distracting apps blocked" : "Notifications silenced"}
          </span>
          <div id="timer">{fmt(session ? session.remainMs : chosenMin * 60000)}</div>
          <div id="focus-line">
            {session?.awayPaused ? "Paused — your island waited for you."
              : session?.paused ? "Paused — take a breath." : "Let’s focus together."}
          </div>
          <div id="focus-sub">{sub}</div>
        </div>
        <svg id="focus-scene" viewBox="0 0 300 152" aria-hidden="true"
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
              <div id="guard-rows">
                {(caps.dnd || !native) && (
                  <button className={"guard-row" + (caps.dnd && s.guard.dnd ? " on" : "") + (caps.dnd ? "" : " off")}
                    id="guard-dnd" disabled={!caps.dnd}
                    onClick={() => mutate(st => { st.guard.dnd = !st.guard.dnd; })}>
                    <span className="sw" aria-hidden="true" />Silence notifications
                    {hint && <span className="hint">{hint}</span>}
                  </button>
                )}
                {(caps.block || !native) && (
                  <button className={"guard-row" + (caps.block && s.guard.block ? " on" : "") + (caps.block ? "" : " off")}
                    id="guard-block" disabled={!caps.block}
                    onClick={() => {
                      /* turning it on with nothing picked goes straight to the
                         system picker — an empty blocklist shields nothing */
                      if (!s.guard.block && caps.needsPicker && !caps.chosen) { props.onPickApps(); return; }
                      mutate(st => { st.guard.block = !st.guard.block; });
                    }}>
                    <span className="sw" aria-hidden="true" />Block distracting apps
                    {hint && <span className="hint">{hint}</span>}
                  </button>
                )}
                {/* the island radio is pure web audio, so it works everywhere */}
                <button className={"guard-row" + (s.radio ? " on" : "")} id="guard-radio"
                  onClick={() => mutate(st => { st.radio = !st.radio; })}>
                  <span className="sw" aria-hidden="true" />Island radio
                  <span className="hint">plays with the screen off</span>
                </button>
                {caps.block && caps.needsPicker && !!caps.chosen && (
                  <button className="guard-pick" id="guard-pick" onClick={props.onPickApps}>
                    {caps.chosen} app{caps.chosen === 1 ? "" : "s"} chosen — change
                  </button>
                )}
              </div>
              <button className="btn btn-primary" id="btn-start" onClick={props.onStart}>Start</button>
              <button className="btn btn-ghost" id="btn-back-home" onClick={props.onBack}>Back to your island</button>
            </>
          )}
          {running && (
            <>
              <button className="btn btn-primary" id="btn-pause" onClick={props.onPause}>
                {session!.paused ? "Resume" : "Pause"}
              </button>
              <button className="btn btn-ghost" id="btn-end" onClick={props.onEnd}>Finish early</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
