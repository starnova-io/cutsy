import { useCallback, useEffect, useRef, useState } from "react";
import type { CompletePayload, PlacedItem, Screen, SessionInfo } from "./game/types";
import { getState, mutate, useGame } from "./game/store";
import { fits, firstFreeSpot, itemFootprint, nextUnlockInfo } from "./game/economy";
import { commitPlacement, completeSession, grantLand, pickUpPlaced } from "./game/actions";
import { audio } from "./game/audio";
import { ambientDuck, ambientStart, ambientStop, setListenerAzimuth, setPresence } from "./game/ambience";
import * as sfx from "./game/sfx";
import { byId } from "./game/catalog";
import { world, petView } from "./world/world3d";
import { initPetPosition, petGoTo, setWanderCtx } from "./world/wander";
import { hideSplash } from "./native/splash";
import { dropHaptic, liftHaptic, softHaptic, tickHaptic } from "./native/haptics";
import { registerFeedback, toast, ask as askFeedback, heartAt, type AskOpts } from "./ui/feedback";
import { beginGuard, endGuard, guardAvailable, loadGuardCaps, NO_GUARD, pickBlockedApps,
  requestGuardAccess, type GuardCaps, type GuardStatus } from "./native/guard";
import { Nav } from "./components/Nav";
import { Splash } from "./components/Splash";
import { Home } from "./screens/Home";
import { Focus } from "./screens/Focus";
import { Complete } from "./screens/Complete";
import { Shop } from "./screens/Shop";
import { Profile } from "./screens/Profile";
import { Paywall } from "./screens/Paywall";
import { configurePurchases, isPremium, onEntitlementChange } from "./native/purchases";
import { initAnalytics, logEvent, logScreen } from "./native/analytics";

interface Placing {
  item: PlacedItem;
  origin: PlacedItem | null;
  /* Every placement is inline now — on the island, no Done. The flag stays
     so a lifted piece is distinguishable from no piece at all. */
  inline?: boolean;
}
/** what Home looked like before a session paid out, so it can animate the change */
export interface Arrival { energy: number; pct: number; left: number | null; goal: string | null; streakUp: boolean; level: number }
interface DialogState extends AskOpts { msg: string; ok: string; cancel: string; resolve: (v: boolean) => void }

/** what a tapped piece sounds like */
const objectKind = (id: string): "tree" | "flower" | "house" | "stone" | "water" | "other" => {
  const a = byId(id);
  if (/flower|tulip|rose|sunflower|lavender/.test(id)) return "flower";
  if (a.cat === "plants") return "tree";
  if (a.cat === "buildings" || /house|cabin|bench|fence|dock|shed/.test(id)) return "house";
  if (/rock|well|stone|lantern|birdbath|sandcastle|fountain/.test(id)) return "stone";
  return "other";
};

const initialScreen = (): Screen => {
  const h = location.hash.slice(1);
  return (["focus", "shop", "profile", "paywall"] as Screen[]).includes(h as Screen) ? (h as Screen) : "home";
};

export default function App() {
  useGame(); /* re-render on state changes */
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [chosenMin, setChosenMin] = useState(25);
  const [demo, setDemo] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [payload, setPayload] = useState<CompletePayload | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  /* a gift landing on the island gets its own moment on Home, not a dialog */
  const [reveal, setReveal] = useState<{ name: string; sub: string } | null>(null);
  const revealT = useRef<number | undefined>(undefined);
  const showReveal = (name: string, sub: string) => {
    window.clearTimeout(revealT.current);
    window.setTimeout(() => { world.unlockShow(); setReveal({ name, sub }); }, 250);
    revealT.current = window.setTimeout(() => setReveal(null), 3000);
  };
  const beforeRef = useRef<Arrival | null>(null);
  const [arrange, setArrange] = useState(false);
  /* which shields are actually up this session — null until the plugin answers */
  const [shield, setShield] = useState<GuardStatus | null>(null);
  /* what this device can do at all; the Focus screen only offers what's real */
  const [caps, setCaps] = useState<GuardCaps>(NO_GUARD);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  /* the launch sequence plays on a cold start into Home — not for a deep
     link, and not under a test driver that needs the island to hold still */
  const [splash, setSplash] = useState(() => initialScreen() === "home" && (!navigator.webdriver || location.search.includes("splash")));
  /* with the animated splash covering the page, the native launch image can
     go as soon as React has painted — they share their first frame */
  useEffect(() => { if (splash) hideSplash(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- refs so world callbacks always see the latest ---- */
  const screenRef = useRef(screen); screenRef.current = screen;
  const placingRef = useRef(placing); placingRef.current = placing;
  const sessionRef = useRef(session); sessionRef.current = session;
  const arrangeRef = useRef(arrange); arrangeRef.current = arrange;
  const demoRef = useRef(demo); demoRef.current = demo;

  useEffect(() => { void loadGuardCaps().then(setCaps); }, []);

  /* ---- billing + analytics boot (native only; no-ops on web) ---- */
  useEffect(() => {
    void (async () => {
      await configurePurchases();
      await initAnalytics();
      logEvent("app_open");
      const prem = await isPremium();
      if (prem && !getState().premium) mutate(st => { st.premium = true; });
      await onEntitlementChange(prem => mutate(st => { st.premium = prem; }));
    })();
  }, []);

  /* log every screen; the paywall gets its own funnel event */
  useEffect(() => {
    logScreen(screen);
    if (screen === "paywall") logEvent("paywall_shown");
  }, [screen]);

  /* Screen Time hands back opaque tokens, so on iOS the person picks the apps
     in Apple's own sheet — we only ever learn how many. */
  const pickApps = useCallback(async () => {
    if (!(await requestGuardAccess())) {
      toast("Screen Time access is needed to block apps", 3200);
      return;
    }
    const { chosen, apps, categories } = await pickBlockedApps();
    setCaps(c => ({ ...c, chosen }));
    /* picking *is* switching it on — coming back to a toggle still sitting
       off reads as if the whole thing failed */
    mutate(st => { st.guard.block = chosen > 0; });
    if (!chosen) { toast("Pick at least one app to block", 2600); return; }
    const bits = [apps && `${apps} app${apps === 1 ? "" : "s"}`,
      categories && `${categories} categor${categories === 1 ? "y" : "ies"}`].filter(Boolean);
    toast(`Blocking ${bits.join(" · ")} during sessions`, 2800);
  }, []);

  /* ---- feedback plumbing ---- */
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    registerFeedback(
      (msg, ms = 2200) => {
        setToastMsg(msg);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToastMsg(null), ms);
      },
      (msg, ok, cancel, opts) => new Promise<boolean>(resolve => { sfx.modalOpen(); setDialog({ ...opts, msg, ok, cancel, resolve }); }),
    );
  }, []);

  /* ---- world boot ---- */
  /** drop an item where it stands; shoos the companion out from under it */
  const settle = useCallback((item: PlacedItem) => {
    const f = itemFootprint(item);
    const ptx = Math.round(petView.x), pty = Math.round(petView.y);
    world.queueSettle(item.x, item.y);
    commitPlacement(item);
    dropHaptic();
    if (ptx >= item.x && ptx < item.x + f.w && pty >= item.y && pty < item.y + f.d) {
      const spot = firstFreeSpot(getState(), "yarn");
      mutate(st => { st.cat = { x: spot.x, y: spot.y }; });
      petView.x = spot.x; petView.y = spot.y; petView.napping = false;
    }
  }, []);
  /** lift a placed piece and wait for somewhere to put it */
  const liftItem = useCallback((idx: number) => {
    const item = pickUpPlaced(idx);
    if (!item) return;
    liftHaptic();
    sfx.lift();
    const origin = { ...item };
    mutate(st => { st.held = { item, origin }; });   /* survives a kill mid-move */
    setPlacing({ item, origin, inline: true });
  }, []);
  /** the same, from the Shop's list — it has to show you the island first */
  const startMove = useCallback((idx: number) => {
    liftItem(idx);
    setScreen("home");
  }, [liftItem]);
  /** a piece that has never been on the island: from the Shop, or a gift */
  const startPlacing = useCallback((id: string, quiet = false) => {
    const item = firstFreeSpot(getState(), id);
    sfx.lift();
    mutate(st => { st.held = { item, origin: null }; });
    setPlacing({ item, origin: null, inline: true });
    setScreen("home");
    if (!quiet) toast("Tap where it should go");
  }, []);
  /** land a lifted item if the tile it is on is free; otherwise leave it held */
  const dropInline = useCallback((cand: PlacedItem) => {
    const p0 = placingRef.current;
    if (!p0) return false;
    if (!fits(getState(), cand)) {
      /* no popup: the piece shakes its head and stays in hand */
      setPlacing(p => (p ? { ...p, item: cand } : p));
      world.shakeGhost();
      sfx.invalid();
      tickHaptic();
      return false;
    }
    settle(cand);
    mutate(st => { st.held = null; });
    if (!p0.origin) toast("It looks lovely here.");
    setPlacing(null);
    return true;
  }, [settle]);

  useEffect(() => {
    world.init({
      getState,
      onTapPet: (cx, cy) => {
        if (screenRef.current !== "home") return;
        /* the companion looks round at you, then answers in its own way —
           a sound only some of the time, so a tap never feels mechanical */
        const voice = sfx.petTap(getState().pet);
        petView.face = world.cameraFace;
        const r = Math.random();
        if (voice === "meow" || (voice === null && r < .35)) { petView.mode = "happy"; petView.modeT = 1.6; heartAt(cx, cy); }
        else if (voice === "purr") { petView.mode = "look"; petView.modeT = 2; heartAt(cx, cy, "spark"); }
        else { petView.mode = "spin"; petView.modeT = .9; }
        softHaptic();
      },
      onTapItem: idx => {
        if (screenRef.current !== "home") return;
        /* Arrange mode is the only way to pick something up. A plain tap is for
           playing with the island — otherwise tapping a tree to watch the leaves
           fall would sometimes shake it and sometimes yank it off the ground,
           depending on the season and the species. */
        /* holding something already: the tap belongs to putting it down */
        if (placingRef.current) return;
        if (arrangeRef.current) { liftItem(idx); return; }
        world.pokeItem(idx);
        const p = getState().placed[idx];
        if (p) sfx.tapObject(objectKind(p.id));
      },
      onMoveGhost: (x, y) => {
        if (!placingRef.current) return;
        setPlacing(p => (p ? { ...p, item: { ...p.item, x, y } } : p));
      },
      onCamera: (zoom, theta) => { setPresence(zoom); setListenerAzimuth(theta); },
      onTapWater: () => sfx.tapObject("water"),
      onDropGhost: () => {
        const p = placingRef.current;
        if (p?.inline) dropInline(p.item);
      },
      onTapTile: (x, y) => {
        const held = placingRef.current;
        if (screenRef.current === "home" && held?.inline) {
          dropInline({ ...held.item, x, y });
          return;
        }
        if (screenRef.current === "home" && !sessionRef.current && !arrangeRef.current) petGoTo(x, y);
      },
    });
    initPetPosition();
    hideSplash();          /* the launch image stays up until the island is drawn */
    setWanderCtx({
      worldVisible: () => screenRef.current === "home" || screenRef.current === "shop",
      blocked: () => !!sessionRef.current || !!placingRef.current,
    });
    /* browsers only allow audio after a gesture — the first tap anywhere
       wakes the island's soundscape */
    const arm = () => { if (getState().sound) ambientStart(); };
    window.addEventListener("pointerdown", arm, { once: true });
    /* the orbit/zoom hint is Home's own now — on the island, once */
    return () => window.removeEventListener("pointerdown", arm);
  }, [startMove, liftItem, dropInline]);

  const toggleSound = useCallback(() => {
    const on = !getState().sound;
    if (on) sfx.toggleOn(); else sfx.toggleOff();
    mutate(st => { st.sound = on; });
    if (on) { audio(); ambientStart(); toast("Sound on — listen to your island"); }
    else { ambientStop(); toast("Sound off"); }
  }, []);

  /* ---- the focus session engine ---- */
  const remainRef = useRef(0);
  const lastTickRef = useRef(0);
  const leavesRef = useRef(0);
  const wakeRef = useRef<{ release(): Promise<void> } | null>(null);
  const lockScreen = async () => {
    try {
      wakeRef.current = await (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } })
        .wakeLock?.request("screen") ?? null;
    } catch { wakeRef.current = null; }
  };
  const shieldDown = () => {
    setShield(null);
    void wakeRef.current?.release().catch(() => undefined);
    wakeRef.current = null;
    void endGuard();
  };

  /* leaving the app mid-session gently pauses it — the island just waits */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const s = sessionRef.current;
        const st = getState();
        /* island radio: mid-session, the soundscape (and the timer) carry on
           with the screen off — pocket focus, ears on the island */
        const radio = !!s && !s.paused && st.radio && st.sound;
        if (s && !s.paused && !radio) {
          leavesRef.current += 1;
          setSession({ ...s, paused: true, awayPaused: true });
        }
        if (!radio) ambientStop();
      } else {
        if (getState().sound) ambientStart();
        if (sessionRef.current) void lockScreen();
        if (sessionRef.current?.awayPaused)
          toast("Welcome back — your session paused itself, nothing lost.", 3200);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(() => {
    if (!session) return;
    const iv = window.setInterval(() => {
      const s = sessionRef.current;
      if (!s || s.paused) { lastTickRef.current = performance.now(); return; }
      const now = performance.now();
      remainRef.current -= (now - lastTickRef.current) * (demoRef.current ? 60 : 1);
      lastTickRef.current = now;
      if (remainRef.current <= 0) {
        window.clearInterval(iv);
        /* 00:00 holds for a breath of silence before anything celebrates */
        setSession({ ...s, remainMs: 0 });
        window.setTimeout(() => finishSession(s.durMin, true), navigator.webdriver ? 0 : 260);
      } else {
        setSession({ ...s, remainMs: remainRef.current });
      }
    }, 200);
    return () => window.clearInterval(iv);
    /* re-arm only when a session starts */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session]);

  /** pay a session out and move to the reward — shared by the timer and End session */
  const finishSession = (minutes: number, full: boolean) => {
    shieldDown();
    ambientDuck(false);
    const st0 = getState(), nu0 = nextUnlockInfo(st0);
    beforeRef.current = { energy: st0.energy, pct: nu0 ? nu0.pct : 100, left: nu0 ? nu0.left : null, goal: nu0 ? nu0.item.id : null, streakUp: false,
      level: Math.floor(st0.totalMin / 100) };
    const streak0 = st0.streak;
    const done = completeSession(minutes, full, leavesRef.current);
    beforeRef.current.streakUp = getState().streak > streak0;
    logEvent("focus_complete", { minutes, full });
    setSession(null);
    setPayload(done);
    setScreen("complete");
  };
  /** back on Home after a reward: let the island and the numbers react */
  const arriveHome = () => {
    const b = beforeRef.current;
    if (b?.streakUp) {
      const n = getState().streak;
      window.setTimeout(() => sfx.streak([7, 14, 30, 100].includes(n)), 1100);
    }
    setArrival(b);
    beforeRef.current = null;
    window.setTimeout(() => { world.celebrate(); petCheer(); }, 280);
    window.setTimeout(() => setArrival(null), 4200);
  };

  const startSession = () => {
    audio();
    logEvent("focus_start", { minutes: chosenMin, demo });
    if (getState().sound) ambientStart();
    remainRef.current = chosenMin * 60000;
    lastTickRef.current = performance.now();
    leavesRef.current = 0;
    void lockScreen();
    setShield(null);
    void beginGuard(getState().guard).then(got => {
      setShield(got);
      /* on Android a shield can fail because the one-time grant is missing —
         the plugin has just opened that settings screen, so say why */
      if (!guardAvailable()) return;
      const want = getState().guard;
      if (caps.dnd && want.dnd && !got.dnd) toast("Allow Do Not Disturb access to silence notifications", 3200);
      else if (caps.block && want.block && !got.block) {
        toast(caps.needsPicker
          ? "Choose the apps to block, then start again"
          : "Allow usage access and overlay to block apps", 3200);
      }
    });
    setSession({ durMin: chosenMin, remainMs: remainRef.current, paused: false });
  };
  const togglePause = () => {
    const was = sessionRef.current;
    if (was) {
      /* pause: the island quiets and the companion asks mmrp? — resume is one note */
      ambientDuck(!was.paused);
      if (!was.paused) sfx.petMrrp(getState().pet); else sfx.signature(1);
    }
    setSession(s => {
      if (!s) return s;
      const paused = !s.paused;
      lastTickRef.current = performance.now();
      return { ...s, paused, awayPaused: false };
    });
  };
  const endEarly = () => {
    const s = sessionRef.current;
    if (!s) return;
    const focusedMin = Math.floor((s.durMin * 60000 - remainRef.current) / 60000);
    if (focusedMin >= 1) {
      void askFeedback(`Wrap up now and you'll keep ✦ ${focusedMin} for the ${focusedMin} min you focused.`,
        "End session", "Keep focusing", { title: "Stay a little longer?", stay: true }).then(okd => {
          if (!okd || !sessionRef.current) return;
          finishSession(focusedMin, false);
        });
    } else {
      void askFeedback("Leave now and this session won't count toward your island.",
        "Leave session", "Keep focusing", { title: "Leave already?", stay: true }).then(okd => {
          if (!okd || !sessionRef.current) return;
          shieldDown();
          ambientDuck(false);
          setSession(null);
          toast("No worries — your island will wait for you.");
          setScreen("home");
        });
    }
  };

  /* ---- placement ---- */

  /** give a lifted piece back to where it came from */
  const putBack = useCallback(() => {
    const p = placingRef.current;
    if (!p) return;
    mutate(st => {
      if (p.origin) st.placed.push({ ...p.origin });
      else st.inventory.push(p.item.id);
      st.held = null;
    });
    setPlacing(null);
  }, []);


  /* ---- complete-screen gift handlers ---- */
  /* back on the island after a finished session, the companion celebrates */
  const petCheer = () => {
    petView.mode = "happy";
    petView.modeT = 3.5;
  };
  const placeGift = () => {
    const item = payload?.item;
    if (!item) return;
    arriveHome();
    startPlacing(item.id, true);
    showReveal(item.name, "Tap where it should go");
  };
  const buildGiftBridge = () => {
    mutate(st => { st.bridge = true; });
    world.revealIslet();
    arriveHome();
    showReveal("Bridge to the Isle", "New area discovered");
    setScreen("home");
  };
  const raiseGiftLand = () => {
    const item = payload?.item;
    if (!item) return;
    grantLand(item.id);
    arriveHome();
    showReveal(item.name, "New land rises from the sea");
    setScreen("home");
  };

  /* Every ordinary button gets a soft wooden tok, and picking something gets a
     pluck; buttons with a sound of their own opt out with data-sfx="own". */
  const clickSound = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("button");
    if (!el || el.disabled || el.dataset.sfx === "own") return;
    if (el.matches(".sitem, .cat-chip, .chip, .pet-opt, .plan")) sfx.selectPluck(); else sfx.tapUI();
  };
  const go = (s: Screen) => {
    if (s !== screenRef.current) sfx.tabPop();
    setScreen(s);
  };
  const navHidden = screen === "complete" || screen === "paywall" || (screen === "focus" && !!session);

  return (
    <div id="phone" className={"on-" + screen} onClickCapture={clickSound}>
      {screen === "home" && (
        <Home chosenMin={chosenMin} onFocus={() => setScreen("focus")} arrange={arrange}
          sound={getState().sound} onToggleSound={toggleSound}
          held={placing?.inline ? placing.item : null} arrival={arrival} reveal={reveal}
          onRotateHeld={() => setPlacing(p => (p ? { ...p, item: { ...p.item, rot: (p.item.rot + 1) % 4 } } : p))}
          onCancelHeld={putBack}
          onToggleArrange={() => {
            putBack();          /* leaving arrange mode never strands a piece */
            setArrange(a => {
              if (!a) toast("Arrange mode — tap a piece, then tap where it goes");
              return !a;
            });
          }} />
      )}
      {screen === "focus" && (
        <Focus session={session} chosenMin={chosenMin} demo={demo} shield={shield} leaving={!!dialog?.stay}
          caps={caps} onPickApps={pickApps}
          onPickMin={setChosenMin} onToggleDemo={() => { setDemo(d => !d); toast(demo ? "Demo speed off" : "Demo speed ×60 — a minute passes each second"); }}
          onStart={startSession} onPause={togglePause} onEnd={endEarly} onBack={() => setScreen("home")} />
      )}
      {screen === "complete" && payload && (
        <Complete payload={payload} onPlaceGift={placeGift} onBuildGiftBridge={buildGiftBridge}
          onRaiseGiftLand={raiseGiftLand}
          onHome={() => {
            const item = payload.item;
            if (item && item.special === "land") grantLand(item.id, false); /* still theirs, just quietly */
            else if (item && item.special !== "bridge" && !getState().inventory.includes(item.id))
              mutate(st => { st.inventory.push(item.id); });
            arriveHome();
            setScreen("home");
          }} />
      )}
      {screen === "shop" && (
        <Shop onPaywall={() => setScreen("paywall")}
          onPlaceInventory={startPlacing}
          onMove={startMove} />
      )}
      {screen === "profile" && <Profile onPaywall={() => setScreen("paywall")} onHome={() => setScreen("home")} onToggleSound={toggleSound} />}
      {screen === "paywall" && <Paywall onClose={() => setScreen("shop")} />}

      <Nav screen={screen} onGo={go} hidden={navHidden} />
      {splash && <Splash pet={getState().pet} onLand={sfx.splashSignature} onDive={() => world.introDolly()} onDone={() => setSplash(false)} />}

      {dialog && (
        <div id="dlg" className={"show" + (dialog.stay ? " stay" : "")} role="alertdialog">
          <div className="box">
            {dialog.title && <h3 id="dlg-title">{dialog.title}</h3>}
            <p id="dlg-msg">{dialog.msg}</p>
            {/* when staying is what we hope for, staying is the filled button
                on top and leaving drops to a quiet line under it */}
            <div className={"row" + (dialog.stay ? " stay" : "")}>
              <button className={"btn " + (dialog.stay ? "btn-ghost leave" : "ok")} id="dlg-ok" data-sfx="own"
                onClick={() => { sfx.modalClose(); dialog.resolve(true); setDialog(null); }}>{dialog.ok}</button>
              <button className={"btn " + (dialog.stay ? "ok" : "btn-ghost")} id="dlg-cancel" data-sfx="own"
                onClick={() => { sfx.modalClose(); dialog.resolve(false); setDialog(null); }}>{dialog.cancel}</button>
            </div>
          </div>
        </div>
      )}
      <div id="toast" role="status" className={toastMsg ? "show" : ""}>{toastMsg}</div>
    </div>
  );
}
