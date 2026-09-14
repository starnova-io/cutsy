import { Composition, Folder, Still, staticFile } from "remotion";
import { AppPreview, FPS, OUTRO_SECONDS, PREVIEW, type AppPreviewProps } from "./AppPreview";
import { DEVICES, Shot65, Shot69, ShotIpad, type StoreShotProps } from "./StoreShot";

/* every shot is a prop, not a composition of its own: the Studio (npm run dev)
   shows one per device with a shot picker, and scripts/render.mjs walks them all */
const shot: StoreShotProps = { shot: "island" };

export const RemotionRoot = () => (
  <>
    <Folder name="Screenshots">
      <Still id="Screenshot-iphone-6-9" component={Shot69} defaultProps={shot} width={DEVICES["iphone-6.9"].width} height={DEVICES["iphone-6.9"].height} />
      <Still id="Screenshot-iphone-6-5" component={Shot65} defaultProps={shot} width={DEVICES["iphone-6.5"].width} height={DEVICES["iphone-6.5"].height} />
      <Still id="Screenshot-ipad-13" component={ShotIpad} defaultProps={shot} width={DEVICES["ipad-13"].width} height={DEVICES["ipad-13"].height} />
    </Folder>
    <Folder name="Preview">
      <Composition id="AppPreview" component={AppPreview} width={PREVIEW.width} height={PREVIEW.height} fps={FPS}
        durationInFrames={FPS * 27} defaultProps={{} as AppPreviewProps}
        /* length comes from the footage: its beats file says where each caption changes */
        calculateMetadata={async ({ props }) => {
          const res = await fetch(staticFile("clips/preview.json"));
          if (!res.ok) throw new Error("clips/preview.json missing — run npm run capture");
          const clip = (await res.json()) as { duration: number; beats: AppPreviewProps["beats"] };
          return { durationInFrames: Math.round((clip.duration + OUTRO_SECONDS) * FPS), props: { ...props, beats: clip.beats, footageSeconds: clip.duration } };
        }} />
    </Folder>
  </>
);
