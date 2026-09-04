import { useMemo, useState } from "react";
import { useGame } from "../game/store";
import { CATALOG, CATS, PETS, byId } from "../game/catalog";
import { firstFreeSpot } from "../game/economy";
import { buildBridge, buyAndPlace, buyLand } from "../game/actions";
import { mutate } from "../game/store";
import { world } from "../world/world3d";
import { WorldView } from "../world/WorldView";
import { toast, confettiBurst } from "../ui/feedback";
import type { CatalogItem, GameState, PetKind, PlacedItem } from "../game/types";

type Entry = CatalogItem | { petKey: PetKind };
const isPet = (e: Entry): e is { petKey: PetKind } => (e as { petKey?: PetKind }).petKey !== undefined;
const keyOf = (e: Entry): string => isPet(e) ? "pet-" + e.petKey : e.id;

type ItemState = "adopted" | "adopt" | "built" | "gated" | "locked" | "inv" | "buy" | "poor";

function stateOf(s: GameState, e: Entry): ItemState {
  if (isPet(e)) return s.pet === e.petKey ? "adopted" : "adopt";
  if (e.special === "bridge" && s.bridge) return "built";
  if (e.special === "land" && s.lands.includes(e.id)) return "built";
  if (e.premium && !s.premium) return "gated";
  if (e.unlock > s.totalMin) return "locked";
  if (s.inventory.includes(e.id)) return "inv";
  return s.energy >= e.price ? "buy" : "poor";
}

export function Shop(props: {
  onPaywall: () => void;
  onPlaceInventory: (id: string) => void;
  onMove: (idx: number) => void;
}) {
  const s = useGame();
  const [cat, setCat] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(null);

  const list: Entry[] = useMemo(() => {
    const items: Entry[] = CATALOG.filter(a => cat === "all" || a.cat === cat);
    const pets: Entry[] = (cat === "all" || cat === "pets")
      ? (["cat", "dog"] as PetKind[]).map(k => ({ petKey: k })) : [];
    return cat === "pets" ? [...pets, ...items] : [...items, ...pets];
  }, [cat]);

  const selKey = sel && list.some(e => keyOf(e) === sel) ? sel : (list.length ? keyOf(list[0]) : null);
  const selEntry = list.find(e => keyOf(e) === selKey) ?? null;
  const selState = selEntry ? stateOf(s, selEntry) : null;

  const ghost: PlacedItem | null = useMemo(() => {
    if (!selEntry || isPet(selEntry) || selEntry.special) return null;
    return firstFreeSpot(s, selEntry.id);
  }, [selEntry, s]);

  const previewPet = selEntry && isPet(selEntry) ? selEntry.petKey : null;

  function buy(a: CatalogItem): void {
    if (a.special === "bridge") {
      if (buildBridge()) {
        confettiBurst();
        toast("New area discovered!", 3000);
      }
      return;
    }
    if (a.special === "land") {
      if (buyLand(a.id)) {
        confettiBurst();
        toast("New land rises from the sea!", 3000);
      }
      return;
    }
    if (!ghost) return;
    if (buyAndPlace(a.id, ghost)) {
      world.queuePop(a.id);
      toast("It's yours!");
    }
  }

  const placedCount = selEntry && !isPet(selEntry) ? s.placed.filter(p => p.id === selEntry.id).length : 0;

  return (
    <section className="screen active" id="screen-shop">
      <header className="sheet-head">
        <div><h1>Decorate</h1><div className="sheet-sub">Your focus buys it — 1 minute = 1 ✦</div></div>
        <span className="pill"><span className="spark">✦</span><span id="energy-pill-shop">{s.energy}</span></span>
      </header>
      <WorldView id="shop-world-wrap" opts={{ ghost, previewPet }} />
      <div id="cats">
        {CATS.map(c => (
          <button key={c} className={"cat-chip" + (c === cat ? " on" : "")} data-cat={c}
            onClick={() => { setCat(c); setSel(null); }}>
            {c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
        {!s.premium && (
          <button className="cat-chip prem-banner" data-paywall onClick={props.onPaywall}>✦ Premium</button>
        )}
      </div>
      <div id="strip">
        {list.map(e => {
          const k = keyOf(e);
          const st = isPet(e) ? null : stateOf(s, e);
          return (
            <button key={k} data-sel={k}
              className={"sitem" + (k === selKey ? " on" : "") + (st === "locked" ? " dim" : "")}
              onClick={() => setSel(k)}>
              {!isPet(e) && e.premium && <span className="pb">✦</span>}
              <img alt="" src={world.thumb(k)} />
              <span>{isPet(e) ? PETS[e.petKey].name : e.name}</span>
              <b>{isPet(e) ? (s.pet === e.petKey ? "with you" : "a friend") : "✦ " + e.price}</b>
            </button>
          );
        })}
      </div>
      <div id="shop-action">
        <div id="sa-info">
          <b id="sa-name">{selEntry ? (isPet(selEntry) ? PETS[selEntry.petKey].name : selEntry.name) : ""}</b>
          <span id="sa-note">
            {!selEntry ? "" : isPet(selEntry) ? PETS[selEntry.petKey].line
              : selState === "built" ? (selEntry.special === "land" ? "Part of your island now" : "The isle across the water is yours")
              : selState === "gated" ? "In the premium catalog"
              : selState === "locked" ? `Focus ${selEntry.unlock - s.totalMin} more min to unlock`
              : selState === "inv" ? "Yours — waiting to be placed"
              : placedCount ? `On your island ×${placedCount}`
              : selState === "poor" ? `Save ✦ ${selEntry.price - s.energy} more`
              : "Tap buy to bring it home"}
          </span>
        </div>
        <div id="sa-btns">
          {selEntry && isPet(selEntry) && (
            s.pet === selEntry.petKey
              ? <button className="btn buy-main" disabled>Adopted</button>
              : <button className="btn buy-main" data-adopt={selEntry.petKey}
                  onClick={() => { const k = (selEntry as { petKey: PetKind }).petKey; mutate(st => { st.pet = k; }); toast(`${PETS[k].name} is happy to join you.`); }}>
                  Adopt
                </button>
          )}
          {selEntry && !isPet(selEntry) && (
            <>
              {placedCount > 0 && !selEntry.special && (
                <button className="btn move-btn" data-move={selEntry.id}
                  onClick={() => props.onMove(s.placed.map(p => p.id).lastIndexOf(selEntry.id))}>
                  Move
                </button>
              )}
              {selState === "built" && <button className="btn buy-main" disabled>Built</button>}
              {selState === "gated" && <button className="btn see-prem" data-paywall onClick={props.onPaywall}>✦ Premium</button>}
              {selState === "locked" && <button className="btn buy-main" disabled>✦ {selEntry.price}</button>}
              {selState === "inv" && <button className="btn buy-main" data-place={selEntry.id}
                onClick={() => { mutate(st => { st.inventory = st.inventory.filter(x => x !== selEntry.id); }); props.onPlaceInventory(selEntry.id); }}>Place</button>}
              {selState === "buy" && <button className="btn buy-main" data-buy={selEntry.id} onClick={() => buy(selEntry)}>
                {selEntry.special === "bridge" ? "Build" : selEntry.special === "land" ? "Raise" : "Buy"} · ✦ {selEntry.price}
              </button>}
              {selState === "poor" && <button className="btn buy-main" disabled>✦ {selEntry.price}</button>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
