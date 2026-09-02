/* Imperative toast/confirm bridges so game code can speak to the UI
   without prop drilling. App registers the real implementations. */

type ToastFn = (msg: string, ms?: number) => void;
type AskFn = (msg: string, okLabel: string, cancelLabel: string) => Promise<boolean>;

let toastImpl: ToastFn = () => {};
let askImpl: AskFn = async () => false;

export const registerFeedback = (t: ToastFn, a: AskFn): void => { toastImpl = t; askImpl = a; };
export const toast = (msg: string, ms = 2200): void => toastImpl(msg, ms);
export const ask = (msg: string, okLabel: string, cancelLabel: string): Promise<boolean> =>
  askImpl(msg, okLabel, cancelLabel);

export function confettiBurst(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const host = document.getElementById("phone");
  if (!host) return;
  const cols = ["#9C4F76", "#8FB07A", "#DFA23A", "#F3DEE5", "#7C3D60"];
  for (let i = 0; i < 26; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = (4 + Math.random() * 92) + "%";
    c.style.background = cols[i % cols.length];
    c.style.animationDuration = (1.3 + Math.random() * 1.1) + "s";
    c.style.animationDelay = (Math.random() * .5) + "s";
    c.style.width = (6 + Math.random() * 6) + "px";
    host.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

export function heartAt(clientX: number, clientY: number): void {
  const host = document.getElementById("phone");
  if (!host) return;
  const pr = host.getBoundingClientRect();
  const heart = document.createElement("div");
  heart.className = "heart-float";
  heart.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 20.6S5.2 16.2 3 12A5.3 5.3 0 0 1 12 6.7 5.3 5.3 0 0 1 21 12c-2.2 4.2-9 8.6-9 8.6Z" fill="#9C4F76"/></svg>`;
  heart.style.left = (clientX - pr.left - 10) + "px";
  heart.style.top = (clientY - pr.top - 30) + "px";
  host.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
}
