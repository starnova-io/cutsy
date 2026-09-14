// One App Store screenshot: a caption, a small ✦, and the device below it
// holding the real screen captured from the app (public/raw/<device>/<shot>.png,
// written by scripts/capture.mjs), at the store's exact pixel size.
import { AbsoluteFill, Img, staticFile } from "remotion";
import shots from "./shots.json";
import { useFontsReady } from "./fonts";
import { assertNoPriceWording } from "./guard";
import { COLOR, DISPLAY } from "./theme";
import { SPARK } from "../../src/ui/brand";

export type ShotName = keyof typeof shots.captions;
export type StoreShotProps = { shot: ShotName };

/** Store image sizes; `k` scales the 430-wide phone design (or 1032-wide iPad). */
export const DEVICES = {
  "iphone-6.9": { width: 1290, height: 2796, k: 3, raw: "iphone", screen: 330 },
  "iphone-6.5": { width: 1284, height: 2778, k: 1284 / 430, raw: "iphone", screen: 330 },
  "ipad-13": { width: 2064, height: 2752, k: 2, raw: "ipad", screen: 820 },
} as const;
export type Device = keyof typeof DEVICES;

export function StoreShot({ shot, device }: StoreShotProps & { device: Device }) {
  useFontsReady();
  const d = DEVICES[device];
  const k = d.k;
  const lines = shots.captions[shot];
  assertNoPriceWording(`${device}/${shot}`, ...lines);
  const tablet = d.raw === "ipad";
  const screenW = d.screen * k;
  /* phones keep the capture's aspect; the device bleeds off the bottom edge,
     which reads as a real phone rather than a cropped picture of one */
  const aspect = tablet ? 1376 / 1032 : 932 / 430;
  const radius = (tablet ? 36 : 44) * k;
  const bezel = (tablet ? 14 : 10) * k;

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(120% 60% at 50% 0%, #FBF4F1 0%, ${COLOR.cream} 55%, ${COLOR.creamDeep} 100%)`,
      alignItems: "center", flexDirection: "column", overflow: "hidden",
    }}>
      <svg width={22 * k} height={22 * k} viewBox="-12 -12 24 24" style={{ marginTop: (tablet ? 70 : 62) * k }}>
        <path d={SPARK} fill={COLOR.gold} />
      </svg>
      <div style={{
        marginTop: 14 * k, padding: `0 ${28 * k}px`, textAlign: "center",
        fontFamily: DISPLAY, fontWeight: 600, fontSize: (tablet ? 40 : 33) * k, lineHeight: 1.14,
        letterSpacing: "-0.012em", color: COLOR.ink,
      }}>
        {lines.map((l, i) => <div key={l} style={{ color: i === 1 ? COLOR.berry : COLOR.ink }}>{l}</div>)}
      </div>
      <div style={{
        position: "relative", marginTop: (tablet ? 46 : 36) * k,
        width: screenW + bezel * 2, height: screenW * aspect + bezel * 2,
        borderRadius: radius + bezel, background: "#241B28", padding: bezel, flex: "none",
        boxShadow: `0 ${24 * k}px ${60 * k}px ${-24 * k}px rgba(60, 38, 64, .45)`,
      }}>
        <div style={{ width: screenW, height: screenW * aspect, borderRadius: radius, overflow: "hidden", background: COLOR.cream }}>
          <Img src={staticFile(`raw/${d.raw}/${shot}.png`)} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const Shot69 = (p: StoreShotProps) => <StoreShot {...p} device="iphone-6.9" />;
export const Shot65 = (p: StoreShotProps) => <StoreShot {...p} device="iphone-6.5" />;
export const ShotIpad = (p: StoreShotProps) => <StoreShot {...p} device="ipad-13" />;
