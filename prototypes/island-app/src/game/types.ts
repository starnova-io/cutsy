export type Category = "plants" | "decor" | "buildings" | "pets" | "land";
export type PetKind = "cat" | "dog";
export type Screen = "home" | "focus" | "complete" | "shop" | "place" | "profile" | "paywall";
export type Phase = "dawn" | "day" | "dusk" | "night";
export type Weather = "clear" | "cloudy" | "rain";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface CatalogItem {
  id: string;
  name: string;
  cat: Category;
  price: number;
  unlock: number;          // total focused minutes required
  w: number;
  d: number;
  premium?: boolean;
  special?: "bridge";
}

export interface PlacedItem {
  id: string;
  x: number;
  y: number;
  rot: number;             // quarter turns
  stage?: number;          // plants grow 0..2 with completed sessions
}

/** focus-shield preferences: silence notifications / block apps (native builds) */
export interface GuardPrefs { dnd: boolean; block: boolean }

export interface GameState {
  energy: number;
  totalMin: number;
  todayMin: number;
  weekMin: number;
  sessions: number;
  daysActive: number;
  streak: number;
  lastDay: string;
  lastStreakDay?: string;
  bridge: boolean;
  placed: PlacedItem[];
  inventory: string[];
  cat: { x: number; y: number };
  pet: PetKind;
  premium: boolean;
  guard: GuardPrefs;
}

export interface SessionInfo {
  durMin: number;
  remainMs: number;
  paused: boolean;
  /** paused automatically because the person left the app */
  awayPaused?: boolean;
}

export interface CompletePayload {
  minutes: number;
  full: boolean;
  item: CatalogItem | null;
  /** how many times the person left the app mid-session */
  leaves: number;
}
