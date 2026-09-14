// The app preview: recorded footage of Hearth Island in use
// (public/clips/preview.mp4, from scripts/capture.mjs), with the store
// captions changing at each beat, then the mark and tagline.
//
// The footage runs unbroken — an app preview must show the app as it is. The
// one liberty is the focus session itself: it runs on the dev time warp so
// fifteen minutes fit, and the frame says so while it happens.
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import shots from "./shots.json";
import { useFontsReady } from "./fonts";
import { assertNoPriceWording } from "./guard";
import { Mark } from "./Mark";
import { COLOR, DISPLAY, UI } from "./theme";

export type Beats = { open: number; focus: number; reward: number; place: number; decorate: number; end: number };
export type AppPreviewProps = { beats?: Beats; footageSeconds?: number };
type Caption = keyof typeof shots.preview;

export const FPS = 30;
export const PREVIEW = { width: 886, height: 1920 };
export const OUTRO_SECONDS = 2.4;
const SCREEN = { width: 700, top: 470 };

export const captionSpans = (b: Beats): { cap: Caption; from: number; to: number }[] => [
  { cap: "open", from: 0, to: b.focus },
  { cap: "focus", from: b.focus, to: b.reward },
  { cap: "reward", from: b.reward, to: b.place },
  { cap: "place", from: b.place, to: b.decorate },
  { cap: "decorate", from: b.decorate, to: b.end },
];

function CaptionBand({ lines, frames }: { lines: readonly string[]; frames: number }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", left: 50, right: 50, top: 170, textAlign: "center",
      fontFamily: DISPLAY, fontWeight: 600, fontSize: 70, lineHeight: 1.12, letterSpacing: "-0.012em",
      opacity: Math.min(enter, exit), transform: `translateY(${(1 - enter) * 16}px)`,
    }}>
      {lines.map((l, i) => <div key={l} style={{ color: i === 1 ? COLOR.berry : COLOR.ink }}>{l}</div>)}
    </div>
  );
}

/** says plainly that the session on screen is sped up */
function TimeChip({ frames }: { frames: number }) {
  const frame = useCurrentFrame();
  const a = Math.min(interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div style={{
      position: "absolute", left: "50%", top: SCREEN.top + 36, transform: "translateX(-50%)", opacity: a,
      background: "rgba(252,250,249,.94)", color: COLOR.ink, borderRadius: 999, padding: "14px 30px",
      fontFamily: UI, fontWeight: 800, fontSize: 30, boxShadow: "0 10px 30px rgba(20,14,24,.35)", whiteSpace: "nowrap",
    }}>15 minutes later</div>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (s: number) => s * fps;
  const bg = interpolate(frame, [0, t(0.3)], [0, 1], { extrapolateRight: "clamp" });
  const isle = interpolate(frame, [t(0.15), t(0.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)) });
  const spark = interpolate(frame, [t(0.5), t(0.9)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const words = interpolate(frame, [t(0.8), t(1.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `rgba(242,236,235,${bg})`, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
      <div style={{ transform: `scale(${0.6 + 0.4 * isle})`, opacity: isle }}><Mark size={300} spark={spark} sprout={isle} /></div>
      <div style={{ opacity: words, transform: `translateY(${(1 - words) * 14}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 88, color: COLOR.berry, lineHeight: 1 }}>Hearth Island</div>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 36, color: COLOR.muted, marginTop: 20 }}>{shots.tagline}</div>
      </div>
    </AbsoluteFill>
  );
}

export function AppPreview({ beats, footageSeconds }: AppPreviewProps) {
  useFontsReady();
  const { fps } = useVideoConfig();
  if (!beats || !footageSeconds) throw new Error("No beats — run npm run capture");
  const spans = captionSpans(beats);
  spans.forEach(s => assertNoPriceWording(`preview/${s.cap}`, ...shots.preview[s.cap]));
  assertNoPriceWording("preview/tagline", shots.tagline);
  const f = (s: number) => Math.round(s * fps);
  const footageFrames = f(footageSeconds);
  const screenH = Math.round(SCREEN.width * 2532 / 1170);
  /* the session is sped up from a moment after Start until the reward */
  const warpFrom = f(beats.focus + 2.6);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 55% at 50% 0%, #FBF4F1 0%, ${COLOR.cream} 60%, ${COLOR.creamDeep} 100%)` }}>
      {spans.map(s => (
        <Sequence key={s.cap} from={f(s.from)} durationInFrames={Math.max(1, f(s.to) - f(s.from))} layout="none">
          <CaptionBand lines={shots.preview[s.cap]} frames={Math.max(1, f(s.to) - f(s.from))} />
        </Sequence>
      ))}
      <div style={{
        position: "absolute", left: (PREVIEW.width - SCREEN.width) / 2 - 14, top: SCREEN.top - 14,
        width: SCREEN.width + 28, height: screenH + 28, borderRadius: 88, background: "#241B28", padding: 14,
        boxShadow: "0 40px 90px -40px rgba(60,38,64,.5)",
      }}>
        <div style={{ width: SCREEN.width, height: screenH, borderRadius: 74, overflow: "hidden", background: COLOR.cream }}>
          <Sequence durationInFrames={footageFrames} layout="none">
            <OffthreadVideo src={staticFile("clips/preview.mp4")} muted style={{ width: "100%", display: "block" }} />
          </Sequence>
        </div>
      </div>
      <Sequence from={warpFrom} durationInFrames={Math.max(1, f(beats.reward) - warpFrom)} layout="none">
        <TimeChip frames={Math.max(1, f(beats.reward) - warpFrom)} />
      </Sequence>
      <Sequence from={footageFrames} layout="none"><Outro /></Sequence>
    </AbsoluteFill>
  );
}
