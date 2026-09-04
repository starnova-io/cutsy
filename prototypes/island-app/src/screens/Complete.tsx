import { useGame } from "../game/store";
import { nextUnlockInfo } from "../game/economy";
import { world } from "../world/world3d";
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
  return (
    <section className="screen active" id="screen-complete">
      <div id="complete-inner">
        <div id="complete-spark">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M30 8l3.4 15.6L49 27l-15.6 3.4L30 46l-3.4-15.6L11 27l15.6-3.4Z" fill="#DFA23A" />
            <path d="M48 38l1.9 7.1L57 47l-7.1 1.9L48 56l-1.9-7.1L39 47l7.1-1.9Z" fill="#9C4F76" />
            <path d="M14 42l1.4 5.1L20.5 48.5l-5.1 1.4L14 55l-1.4-5.1L7.5 48.5l5.1-1.4Z" fill="#8FB07A" />
          </svg>
        </div>
        <div id="complete-min">{payload.minutes} min focused</div>
        <div id="complete-energy">+ ✦ {payload.minutes}</div>
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
