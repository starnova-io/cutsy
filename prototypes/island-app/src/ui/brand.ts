/* The mark: a tiny floating island, one sprout, a ✦ above it — focus →
   growth → your world. Drawn as plain shapes in a 100×100 box so the app
   icon, the launch image and the animated splash are the same drawing. The
   island's top dips a little in the middle and its underside tapers to a
   point, which reads as a heart only if you're looking for one. */

/** the island's top face — two soft lobes */
export const ISLE_TOP =
  "M15 55C15 44.8 31 41.4 41 42.4C45.4 42.9 47.6 44 50 44C52.4 44 54.6 42.9 59 42.4C69 41.4 85 44.8 85 55C85 64.5 68.5 69 50 69C31.5 69 15 64.5 15 55Z";
/** the rocky underside, tapering to a rounded point */
export const ISLE_BASE = "M15.4 57C18 70 31.5 81.5 44.4 89C48 91.1 52 91.1 55.6 89C68.5 81.5 82 70 84.6 57Z";
/** the shaded right half of the underside */
export const ISLE_SHADE = "M50 90.6C51.9 90.6 53.8 90 55.6 89C68.5 81.5 82 70 84.6 57H50Z";
/** a sprout: stem plus two leaves, rooted at (50, 50) */
export const SPROUT_STEM = "M50 50.5V38.5";
export const SPROUT_LEFT = "M49.6 42.6C45.8 43.4 41.2 41.2 40 35.8C44.6 34.6 49 37.2 49.6 42.6Z";
export const SPROUT_RIGHT = "M50.4 39.2C51.4 33.4 56.4 29.6 62 30.6C61.4 36.6 56.4 40.2 50.4 39.2Z";
/** ✦ centred on (0,0), radius ~10 */
export const SPARK = "M0 -10C1.4 -2.9 2.9 -1.4 10 0C2.9 1.4 1.4 2.9 0 10C-1.4 2.9 -2.9 1.4 -10 0C-2.9 -1.4 -1.4 -2.9 0 -10Z";

export const BRAND = {
  plum: "#3A2640", plumDeep: "#2B1D31",
  cream: "#F2ECEB", sand: "#F3E3D6", pink: "#E7BCC9", pinkShade: "#D39DAF",
  grass: "#93B87C", grassDeep: "#6F945C", gold: "#E3A83E", berry: "#9C4F76",
};
