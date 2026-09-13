/* Gentle WebAudio cues — no audio assets. The context is created on a
   user gesture (start of a session, a purchase) and reused. */

import { selectPluck, signature } from "./sfx";

let AC: AudioContext | null = null;

export function audio(): AudioContext | null {
  try {
    AC = AC ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (AC.state === "suspended") void AC.resume();
  } catch {
    /* audio unavailable — fine */
  }
  return AC;
}

/* chime() and plink() were the first cues: a bright sine arpeggio and a
   triangle blip, which is the "ting ting" mobile-game sound the island isn't.
   they stay as names, for anything still calling them, but speak in the
   island's own voice now (and obey the sfx switch). */

/** a reward landed: the full signature, dum — ding — ✦ */
export function chime(): void {
  signature(3);
}

/** a small confirmation: the kalimba pluck */
export function plink(): void {
  selectPluck();
}
