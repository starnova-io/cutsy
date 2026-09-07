import { useCallback, useEffect, useRef, useState } from "react";
import type { CompletePayload, PlacedItem, Screen, SessionInfo } from "./game/types";
import { getState, mutate, useGame } from "./game/store";
import { fits, firstFreeSpot, itemFootprint } from "./game/economy";
import { commitPlacement, completeSession, grantLand, pickUpPlaced } from "./game/actions";
import { audio, startRain, stopRain } from "./game/audio";
import { curSeason, curWeather } from "./game/weather";
import { world, petView } from "./world/world3d";
import { initPetPosition, petGoTo, setWanderCtx } from "./world/wander";
import { hideSplash } from "./native/splash";
import { registerFeedback, toast, ask as askFeedback, confettiBurst, heartAt } from "./ui/feedback";
import { beginGuard, endGuard, guardAvailable, loadGuardCaps, NO_GUARD, pickBlockedApps,
  requestGuardAccess, type GuardCaps, type GuardStatus } from "./native/guard";
import { Nav } from "./components/Nav";
import { Home } from "./screens/Home";
import { Focus } from "./screens/Focus";
import { Complete } from "./screens/Complete";
import { Shop } from "./screens/Shop";
import { Place } from "./screens/Place";
import { Profile } from "./screens/Profile";
import { Paywall } from "./screens/Paywall";

interface Placing { item: PlacedItem; origin: PlacedItem | null }
interface DialogState { msg: string; ok: string; cancel: string; resolve: (v: boolean) => void }

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
  const [arrange, setArrange] = useState(false);
  /* which shields are actually up this session — null until the plugin answers */
  const [shield, setShield] = useState<GuardStatus | null>(null);
  /* what this device can do at all; the Focus screen only offers what's real */
  const [caps, setCaps] = useState<GuardCaps>(NO_GUARD);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  /* ---- refs so world callbacks always see the latest ---- */
  const screenRef = useRef(screen); screenRef.current = screen;
  const placingRef = useRef(placing); placingRef.current = placing;
  const sessionRef = useRef(session); sessionRef.current = session;
  const arrangeRef = useRef(arrange); arrangeRef.current = arrange;
  const demoRef = useRef(demo); demoRef.current = demo;

  useEffect(() => { void loadGuardCaps().then(setCaps); }, []);

  /* Screen Time hands back opaque tokens, so on iOS the person picks the apps
     in Apple's own sheet — we only ever learn how many. */
  const pickApps = useCallback(async () => {
    if (!(await requestGuardAccess())) {
      toast("Screen Time access is needed to shield apps", 3200);
      return;
    }
    const { chosen, apps, categories } = await pickBlockedApps();
    setCaps(c => ({ ...c, chosen }));
    /* picking *is* switching it on — coming back to a toggle still sitting
       off reads as if the whole thing failed */
    mutate(st => { st.guard.block = chosen > 0; });
    if (!chosen) { toast("Pick at least one app to shield", 2600); return; }
    const bits = [apps && `${apps} app${apps === 1 ? "" : "s"}`,
      categories && `${categories} categor${categories === 1 ? "y" : "ies"}`].filter(Boolean);
    toast(`Shielding ${bits.join(" · ")} during sessions`, 2800);
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
      (msg, ok, cancel) => new Promise<boolean>(resolve => setDialog({ msg, ok, cancel, resolve })),
    );
  }, []);

  /* ---- world boot ---- */
  const startMove = useCallback((idx: number) => {
    const item = pickUpPlaced(idx);
    if (!item) return;
    setPlacing({ item, origin: { ...item } });
    setScreen("place");
  }, []);

  useEffect(() => {
    world.init({
      getState,
      onTapPet: (cx, cy) => {
        if (screenRef.current !== "home") return;
        petView.mode = "happy";
        petView.modeT = 1.6;
        heartAt(cx, cy);
      },
      onTapItem: idx => {
        if (screenRef.current !== "home" || placingRef.current) return;
        /* Arrange mode is the only way to pick something up. A plain tap is for
           playing with the island — otherwise tapping a tree to watch the leaves
           fall would sometimes shake it and sometimes yank it off the ground,
           depending on the season and the species. */
        if (arrangeRef.current) { setArrange(false); startMove(idx); return; }
        world.pokeItem(idx);
      },
      onMoveGhost: (x, y) => {
        if (!placingRef.current) return;
        setPlacing(p => (p ? { ...p, item: { ...p.item, x, y } } : p));
      },
      onTapTile: (x, y) => {
        if (screenRef.current === "place" && placingRef.current) {
          /* tapping open ground sends the item there too — an invalid spot
             turns the footprint red rather than silently doing nothing */
          setPlacing(p => (p ? { ...p, item: { ...p.item, x, y } } : p));
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
    const t = window.setTimeout(() => toast("Drag to spin your island · pinch to zoom", 3200), 1200);
    return () => window.clearTimeout(t);
  }, [startMove]);

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
    stopRain();
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
        if (s && !s.paused) {
          leavesRef.current += 1;
          stopRain();
          setSession({ ...s, paused: true, awayPaused: true });
        }
      } else {
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
        shieldDown();
        const done = completeSession(s.durMin, true, leavesRef.current);
        setSession(null);
        setPayload(done);
        setScreen("complete");
        confettiBurst();
      } else {
        setSession({ ...s, remainMs: remainRef.current });
      }
    }, 200);
    return () => window.clearInterval(iv);
    /* re-arm only when a session starts */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session]);

  /* in winter, "rain" days fall as silent snow */
  const rainy = () => curWeather() === "rain" && curSeason() !== "winter";
  const startSession = () => {
    audio();
    if (rainy()) startRain();
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
          ? "Choose the apps to shield, then start again"
          : "Allow usage access and overlay to shield apps", 3200);
      }
    });
    setSession({ durMin: chosenMin, remainMs: remainRef.current, paused: false });
  };
  const togglePause = () => {
    setSession(s => {
      if (!s) return s;
      const paused = !s.paused;
      if (paused) stopRain(); else if (rainy()) startRain();
      lastTickRef.current = performance.now();
      return { ...s, paused, awayPaused: false };
    });
  };
  const endEarly = () => {
    const s = sessionRef.current;
    if (!s) return;
    const focusedMin = Math.floor((s.durMin * 60000 - remainRef.current) / 60000);
    if (focusedMin >= 1) {
      void askFeedback(`End the session early? You'll keep ✦ ${focusedMin} for the ${focusedMin} min you focused.`,
        "End session", "Keep going").then(okd => {
          if (!okd || !sessionRef.current) return;
          shieldDown();
          const done = completeSession(focusedMin, false, leavesRef.current);
          setSession(null);
          setPayload(done);
          setScreen("complete");
          confettiBurst();
        });
    } else {
      shieldDown();
      setSession(null);
      toast("No worries — your island will wait for you.");
      setScreen("home");
    }
  };

  /* ---- placement ---- */
  const placeDone = () => {
    const p = placingRef.current;
    if (!p || !fits(getState(), p.item)) return;
    const f = itemFootprint(p.item);
    const ptx = Math.round(petView.x), pty = Math.round(petView.y);
    commitPlacement(p.item);
    if (ptx >= p.item.x && ptx < p.item.x + f.w && pty >= p.item.y && pty < p.item.y + f.d) {
      const spot = firstFreeSpot(getState(), "yarn");
      mutate(st => { st.cat = { x: spot.x, y: spot.y }; });
      petView.x = spot.x; petView.y = spot.y; petView.napping = false;
    }
    setPlacing(null);
    toast("It looks lovely here.");
    setScreen("home");
  };
  const placeCancel = () => {
    const p = placingRef.current;
    if (p) {
      if (p.origin) mutate(st => { st.placed.push({ ...p.origin! }); });
      else mutate(st => { st.inventory.push(p.item.id); });
    }
    setPlacing(null);
    setScreen("home");
  };

  /* ---- complete-screen gift handlers ---- */
  const placeGift = () => {
    const item = payload?.item;
    if (!item) return;
    setPlacing({ item: firstFreeSpot(getState(), item.id), origin: null });
    setScreen("place");
  };
  const buildGiftBridge = () => {
    mutate(st => { st.bridge = true; });
    world.revealIslet();
    confettiBurst();
    toast("New area discovered!", 3000);
    setScreen("home");
  };
  const raiseGiftLand = () => {
    const item = payload?.item;
    if (!item) return;
    grantLand(item.id);
    confettiBurst();
    toast("New land rises from the sea!", 3000);
    setScreen("home");
  };

  const go = (s: Screen) => setScreen(s);
  const navHidden = screen === "place" || screen === "complete" || screen === "paywall" || (screen === "focus" && !!session);

  return (
    <div id="phone">
      {screen === "home" && (
        <Home chosenMin={chosenMin} onFocus={() => setScreen("focus")} arrange={arrange}
          onToggleArrange={() => {
            setArrange(a => {
              if (!a) toast("Arrange mode — tap anything to pick it up");
              return !a;
            });
          }} />
      )}
      {screen === "focus" && (
        <Focus session={session} chosenMin={chosenMin} demo={demo} shield={shield}
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
            setScreen("home");
          }} />
      )}
      {screen === "shop" && (
        <Shop onPaywall={() => setScreen("paywall")}
          onPlaceInventory={id => { setPlacing({ item: firstFreeSpot(getState(), id), origin: null }); setScreen("place"); }}
          onMove={startMove} />
      )}
      {screen === "place" && placing && (
        <Place placing={placing.item}
          onRotate={() => setPlacing(p => (p ? { ...p, item: { ...p.item, rot: (p.item.rot + 1) % 4 } } : p))}
          onDone={placeDone} onCancel={placeCancel} />
      )}
      {screen === "profile" && <Profile onPaywall={() => setScreen("paywall")} onHome={() => setScreen("home")} />}
      {screen === "paywall" && <Paywall onClose={() => setScreen("shop")} />}

      <Nav screen={screen} onGo={go} hidden={navHidden} />

      {dialog && (
        <div id="dlg" className="show" role="alertdialog">
          <div className="box">
            <p id="dlg-msg">{dialog.msg}</p>
            <div className="row">
              <button className="btn ok" id="dlg-ok" onClick={() => { dialog.resolve(true); setDialog(null); }}>{dialog.ok}</button>
              <button className="btn btn-ghost" id="dlg-cancel" onClick={() => { dialog.resolve(false); setDialog(null); }}>{dialog.cancel}</button>
            </div>
          </div>
        </div>
      )}
      <div id="toast" role="status" className={toastMsg ? "show" : ""}>{toastMsg}</div>
    </div>
  );
}
