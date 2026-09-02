import { byId, PETS } from "../game/catalog";
import { mutate, resetState, useGame } from "../game/store";
import { ask, toast } from "../ui/feedback";
import { catSVG, dogSVG } from "../ui/mascots";
import type { PetKind } from "../game/types";

const RICO = {
  leaf: <svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 18.5C5.5 10.5 10.5 5.5 18.5 5.5c0 8-5 13-13 13Z" /><path d="M5.5 18.5c2.6-4.4 5.8-7.6 9.4-10" /></svg>,
  frame: <svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="4" width="15" height="16" rx="1.8" /><path d="M6.2 16.5l3.8-4 3 3.1 1.8-1.9 3 3.1" /><circle cx="9.6" cy="9.2" r="1.3" /></svg>,
  house: <svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.2 11.4 12 4.8l7.8 6.6" /><path d="M6.3 10v8.2a1.9 1.9 0 0 0 1.9 1.9h7.6a1.9 1.9 0 0 0 1.9-1.9V10" /></svg>,
  paw: <svg className="row-ic" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15.8" rx="4.6" ry="3.7" /><circle cx="6.3" cy="11.2" r="1.9" /><circle cx="9.9" cy="8.4" r="1.9" /><circle cx="14.1" cy="8.4" r="1.9" /><circle cx="17.7" cy="11.2" r="1.9" /></svg>,
  isle: <svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0" /><path d="M12 13V5" /><path d="M12 5c3 0 5 1.5 5 3.5-2 .8-4 .3-5-1.2" /><path d="M12 6.5c-2.4-.6-4.3.3-5 2 1.8 1 3.8.6 5-.8" /></svg>,
};

export function Profile(props: { onPaywall: () => void; onHome: () => void }) {
  const s = useGame();
  const lvl = 1 + Math.floor(s.totalMin / 100);
  const counts: Record<string, number> = {};
  for (const p of s.placed) counts[byId(p.id).cat] = (counts[byId(p.id).cat] ?? 0) + 1;
  const rows: [JSX.Element, string, number][] = [
    [RICO.leaf, "Plants", counts.plants ?? 0],
    [RICO.frame, "Decor", counts.decor ?? 0],
    [RICO.house, "Buildings", counts.buildings ?? 0],
    [RICO.paw, "Companion", 1],
    [RICO.isle, "Islands", s.bridge ? 2 : 1],
  ];
  const pickPet = (k: PetKind) => {
    if (s.pet === k) return;
    mutate(st => { st.pet = k; });
    toast(`${PETS[k].name} is happy to join you.`);
  };
  return (
    <section className="screen active" id="screen-profile">
      <header className="sheet-head">
        <h1>Your world</h1>
        <span className="pill">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c2.5 3.5 6 5.6 6 9.5A6 6 0 0 1 6 12.5C6 8.6 9.5 6.5 12 3Z" fill="#E8913C" /><path d="M12 11c1.2 1.7 2.5 2.7 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.7 1.3-2.7 2.5-4.4Z" fill="#F2C14E" /></svg>
          <span id="streak-pill-2">{s.streak} day streak</span>
        </span>
      </header>
      <div className="scroll">
        <div className="card" id="profile">
          <h2>Your progress</h2>
          <div id="prog-top"><span className="spark">✦</span><b id="pts-all">{s.totalMin}</b><span className="pts-lbl">earned all-time</span></div>
          <div id="level-row">
            <span id="level-lbl">Level {lvl}</span>
            <div id="level-track"><div id="level-fill" style={{ width: (s.totalMin % 100) + "%" }} /></div>
          </div>
          <div id="week-line">This week · {s.weekMin} min focused · {s.sessions} sessions · {s.daysActive} days</div>
        </div>
        <div className="card">
          <h2>Your island</h2>
          <div id="world-inventory">
            {rows.map(([ic, n, v]) => (
              <div className="world-row" key={n}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>{ic}{n}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Companion</h2>
          <div className="pet-opts" id="pet-opts">
            {(["cat", "dog"] as PetKind[]).map(k => (
              <button key={k} className={"pet-opt" + (s.pet === k ? " on" : "")} data-pet={k} onClick={() => pickPet(k)}>
                <svg viewBox="-27 -52 54 58" dangerouslySetInnerHTML={{ __html: k === "dog" ? dogSVG("idle") : catSVG("idle") }} />
                <span className="pn">{PETS[k].name}</span>
                <span className="ps">{s.pet === k ? "Your companion" : "Choose"}</span>
              </button>
            ))}
          </div>
          <div id="pet-desc">{PETS[s.pet].line}</div>
        </div>
        <div className="card" id="prem-card">
          {s.premium ? (
            <>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                Hearth Premium <span className="pb" style={{ position: "static", fontSize: 11 }}>✦ member</span>
              </h2>
              <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, lineHeight: 1.45 }}>
                The whole catalog is open. Thank you for keeping the fire warm.
              </div>
              <button className="btn btn-ghost" id="prem-cancel" style={{ padding: "10px 0 0" }}
                onClick={() => { void ask("End the demo membership? Anything you already placed stays on your island.", "End it", "Keep it").then(ok => { if (ok) { mutate(st => { st.premium = false; }); toast("Membership ended — your island keeps everything you earned."); } }); }}>
                Cancel membership (demo)
              </button>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: 6 }}>Hearth Premium</h2>
              <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, lineHeight: 1.45 }}>
                Palms, campfires, docks and whole new islands — your focus still earns every piece.
              </div>
              <button className="btn see-prem" id="prem-see"
                style={{ marginTop: 11, width: "100%", padding: "11px 0", fontSize: 13 }}
                onClick={props.onPaywall}>✦ See Premium</button>
            </>
          )}
        </div>
        <p className="foot-note">
          Prototype — everything stays on this device.<br />
          In the real app, focus sessions silence distracting apps via Screen&nbsp;Time&nbsp;/&nbsp;Focus APIs.
        </p>
        <div style={{ textAlign: "center", paddingBottom: "calc(20px + env(safe-area-inset-bottom) + 88px)" }}>
          <button id="reset-link" onClick={() => { void ask("Reset the prototype to its starting state?", "Reset", "Cancel").then(ok => { if (ok) { resetState(); toast("Fresh start."); props.onHome(); } }); }}>
            Reset prototype data
          </button>
        </div>
      </div>
    </section>
  );
}
