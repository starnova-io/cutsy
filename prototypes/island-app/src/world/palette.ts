import type { Phase } from "../game/types";

export const C3 = {
  grass: [0x84A86C, 0x7C9E64, 0x8FB07A], sand: 0xD9C08A, dirt: 0x8A6A48, dirtD: 0x74563A,
  wood: 0xB07B4F, woodD: 0x8A5A38, woodL: 0xC99763, leafD: 0x55794A, leaf: 0x6F945C, leafL: 0x87AC72,
  stone: 0xA9A192, stoneD: 0x9E9583, cream: 0xF4E7D0, terra: 0xC96A4A, plum: 0x9C4F76,
  gold: 0xDFA23A, flame: 0xE8913C,
  /* autumn: what deciduous leaves turn into (ceramicSoda's pen ramp:
     dusty red -> rust -> tan -> pale straw), and the drier grass */
  fall: [0xB45252, 0xC96A4A, 0xD3A068, 0xEDE19E],
  grassFall: [0x9DA766, 0x94A05F, 0xA8B073],
  /* spring: fresh grass, blossom dots on the trees, drifting petals */
  grassSpring: [0x8FBF6E, 0x86B566, 0x9AC77C],
  petal: [0xF6C9D8, 0xFBE3EC, 0xF3B7CC],
  blossom: 0xF4A8C4,
  /* winter: snow-covered ground, frosted beach, icy water tint */
  grassWinter: [0xE9EFF1, 0xE0E8EB, 0xF1F5F7],
  sandWinter: 0xE0D8C2,
  snow: 0xF4F8FA,
  ice: 0x8FB6C8,
  water: { day: 0x679690, dawn: 0x84A093, dusk: 0x81948B, night: 0x35485A } as Record<Phase, number>,
};

export interface PhaseLook {
  sky: number; hemi: number; ground: number; hInt: number;
  sun: number; int: number; dir: [number, number, number];
}

export const PH3: Record<Phase, PhaseLook> = {
  dawn:  { sky: 0xF6E0C8, hemi: 0xFFE8D0, ground: 0x9A8A78, hInt: .95, sun: 0xFFD9A8, int: .7,  dir: [-7, 4.5, 3] },
  day:   { sky: 0xBCD6D2, hemi: 0xFFFFFF, ground: 0xA8987F, hInt: 1.0, sun: 0xFFF6E0, int: .9,  dir: [5, 9, 3] },
  dusk:  { sky: 0xF2C9A2, hemi: 0xFFDDB8, ground: 0x8A7A6A, hInt: .9,  sun: 0xFFC98A, int: .65, dir: [-8, 3.2, -2] },
  night: { sky: 0x2C3854, hemi: 0x9FB2DE, ground: 0x3A3448, hInt: .55, sun: 0xC9D6FF, int: .28, dir: [4, 7, -3] },
};
