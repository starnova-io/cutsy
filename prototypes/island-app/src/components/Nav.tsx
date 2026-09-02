import type { Screen } from "../game/types";

const TABS: { key: Screen; label: string; icon: JSX.Element }[] = [
  {
    key: "home", label: "Home",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.2 11.4 12 4.8l7.8 6.6" /><path d="M6.3 10v8.2a1.9 1.9 0 0 0 1.9 1.9h7.6a1.9 1.9 0 0 0 1.9-1.9V10" /><path d="M10.1 20.1v-4.3a1.9 1.9 0 0 1 3.8 0v4.3" /></svg>,
  },
  {
    key: "focus", label: "Focus",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13.4" r="7.1" /><path d="M12 13.4v-3.5" /><path d="M9.9 2.8h4.2" /><path d="M12 2.8v2.5" /><path d="M17.6 8l1.5-1.5" /></svg>,
  },
  {
    key: "shop", label: "Shop",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.7 8.7h12.6l-.85 9.8a2 2 0 0 1-2 1.8H8.55a2 2 0 0 1-2-1.8z" /><path d="M9.1 10.9V6.8a2.9 2.9 0 0 1 5.8 0v4.1" /></svg>,
  },
  {
    key: "profile", label: "You",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.3" r="4" /><path d="M5.3 20.2c1.4-3.4 3.9-5.1 6.7-5.1s5.3 1.7 6.7 5.1" /></svg>,
  },
];

export function Nav({ screen, onGo, hidden }: { screen: Screen; onGo: (s: Screen) => void; hidden: boolean }) {
  return (
    <nav id="nav" className={hidden ? "hidden" : ""} aria-label="Main">
      {TABS.map(t => (
        <button key={t.key} data-nav={t.key} className={screen === t.key ? "on" : ""}
          aria-label={t.label} onClick={() => onGo(t.key)}>
          {t.icon}
          <span className="lbl">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
