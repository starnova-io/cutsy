import { fits } from "../game/economy";
import { useGame } from "../game/store";
import { WorldView } from "../world/WorldView";
import type { PlacedItem } from "../game/types";

export function Place(props: {
  placing: PlacedItem;
  onRotate: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const s = useGame();
  const ok = fits(s, props.placing);
  return (
    <section className="screen active" id="screen-place">
      <header id="place-head">
        <h1 id="place-title">Place your item</h1>
        <p>Tap a tile to move it — Cancel keeps it safe</p>
      </header>
      <WorldView id="place-world-wrap" opts={{ ghost: props.placing, grid: true }} />
      <div id="place-bar">
        <button className="btn rot" id="btn-place-cancel" onClick={props.onCancel}>Cancel</button>
        <button className="btn rot" id="btn-rotate" onClick={props.onRotate}>⟳ Rotate</button>
        <button className="btn done" id="btn-place-done" disabled={!ok} onClick={props.onDone}>Done</button>
      </div>
    </section>
  );
}
