import { useState } from "react";
import { PLANS, type PlanKey } from "../game/catalog";
import { mutate } from "../game/store";
import { chime } from "../game/audio";
import { confettiBurst, toast } from "../ui/feedback";
import { catSVG, dogSVG } from "../ui/mascots";

export function Paywall({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<PlanKey>("yearly");
  const subscribe = () => {
    mutate(s => { s.premium = true; });
    confettiBurst(); chime();
    toast("Welcome to Hearth Premium — the whole catalog is open.");
    onClose();
  };
  return (
    <section className="screen active" id="screen-paywall">
      <button id="pw-close" aria-label="Close" onClick={onClose}>✕</button>
      <div className="scroll" id="pw-scroll">
        <svg id="pw-scene" viewBox="0 0 320 168" aria-hidden="true" dangerouslySetInnerHTML={{
          __html: `
          <ellipse cx="160" cy="150" rx="120" ry="14" fill="rgba(110,80,48,.10)"/>
          <g transform="translate(120,150)">${catSVG("idle")}</g>
          <g transform="translate(204,150)">${dogSVG("idle")}</g>
          <path d="M52 38l1.8 6.8 6.8 1.8-6.8 1.8-1.8 6.8-1.8-6.8-6.8-1.8 6.8-1.8Z" fill="#DFA23A"/>
          <path d="M272 24l1.4 5.2 5.2 1.4-5.2 1.4-1.4 5.2-1.4-5.2-5.2-1.4 5.2-1.4Z" fill="#9C4F76"/>
          <path d="M244 62l1 3.8 3.8 1-3.8 1-1 3.8-1-3.8-3.8-1 3.8-1Z" fill="#8FB07A"/>`,
        }} />
        <h1>Hearth Premium</h1>
        <p className="pw-sub">More islands to grow into. Your focus still earns every single piece.</p>
        <ul id="pw-perks">
          <li><svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 18.5C5.5 10.5 10.5 5.5 18.5 5.5c0 8-5 13-13 13Z" /><path d="M5.5 18.5c2.6-4.4 5.8-7.6 9.4-10" /></svg>The full premium catalog — palms, campfires, wishing wells and docks</li>
          <li><svg className="row-ic" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15.8" rx="4.6" ry="3.7" /><circle cx="6.3" cy="11.2" r="1.9" /><circle cx="9.9" cy="8.4" r="1.9" /><circle cx="14.1" cy="8.4" r="1.9" /><circle cx="17.7" cy="11.2" r="1.9" /></svg>Companion accessories and future friends</li>
          <li><svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.2 11.4 12 4.8l7.8 6.6" /><path d="M6.3 10v8.2a1.9 1.9 0 0 0 1.9 1.9h7.6a1.9 1.9 0 0 0 1.9-1.9V10" /></svg>New islands as they open — forest, beach, mountain</li>
          <li><svg className="row-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l2.2 5.6 6 .5-4.6 4 1.4 5.9L12 16.3l-5 3.2 1.4-5.9-4.6-4 6-.5Z" /></svg>Premium items still cost Focus Energy — money never buys progress</li>
        </ul>
        <div id="pw-plans">
          {(Object.keys(PLANS) as PlanKey[]).map(k => {
            const p = PLANS[k];
            return (
              <button key={k} className={"plan" + (plan === k ? " on" : "")} data-plan={k} onClick={() => setPlan(k)}>
                {"badge" in p && <span className="pl-badge">{(p as { badge: string }).badge}</span>}
                <span className="pl-name">{p.name}</span>
                <span className="pl-price">{p.price}</span>
                <span className="pl-note">{p.note}</span>
              </button>
            );
          })}
        </div>
        <button className="btn btn-primary" id="pw-cta" onClick={subscribe}>{PLANS[plan].cta}</button>
        <button className="btn btn-ghost" id="pw-later" onClick={onClose}>Not now</button>
        <p className="pw-fine">
          Prototype — no real purchase happens. In production, billing runs through the App&nbsp;Store (RevenueCat), cancel anytime.
        </p>
      </div>
    </section>
  );
}
