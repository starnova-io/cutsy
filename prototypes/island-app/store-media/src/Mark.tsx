import { BRAND, ISLE_BASE, ISLE_SHADE, ISLE_TOP, SPARK, SPROUT_LEFT, SPROUT_RIGHT, SPROUT_STEM } from "../../src/ui/brand";

/** the Hearth Island mark, drawn from the app's own shapes */
export function Mark({ size, spark = 1, sprout = 1 }: { size: number; spark?: number; sprout?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
      <path d={ISLE_BASE} fill={BRAND.pink} />
      <path d={ISLE_SHADE} fill={BRAND.pinkShade} />
      <path d={ISLE_TOP} fill={BRAND.sand} />
      <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: `scale(${sprout})` }}>
        <ellipse cx="50" cy="56.5" rx="9" ry="3" fill={BRAND.grass} />
        <g transform="translate(50 56) scale(1.15) translate(-50 -50.5)">
          <path d={SPROUT_STEM} stroke={BRAND.grassDeep} strokeWidth="2.2" strokeLinecap="round" />
          <path d={SPROUT_LEFT} fill={BRAND.grass} />
          <path d={SPROUT_RIGHT} fill={BRAND.grass} />
        </g>
      </g>
      <path d={SPARK} fill={BRAND.gold} transform={`translate(50 ${16 + (1 - spark) * -18}) scale(${0.95 * spark})`} opacity={spark} />
    </svg>
  );
}
