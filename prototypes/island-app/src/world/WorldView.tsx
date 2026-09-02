import { useEffect, useRef } from "react";
import { world, type WorldOpts } from "./world3d";
import { useGame } from "../game/store";

/* Hosts the shared three.js canvas. Whichever WorldView is mounted last
   owns the canvas; opts/state changes re-sync the scene. */
export function WorldView({ opts, id }: { opts?: WorldOpts; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useGame();
  const optsKey = JSON.stringify(opts ?? {});
  useEffect(() => {
    if (ref.current) world.mount(ref.current, opts ?? {});
  }, [optsKey, s]);
  return <div id={id} className="world-host" ref={ref} />;
}
