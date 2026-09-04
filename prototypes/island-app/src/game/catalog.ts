import type { CatalogItem, PetKind } from "./types";

export const CATALOG: CatalogItem[] = [
  { id: "flowerpatch", name: "Flower Patch",       cat: "plants",    price: 40,  unlock: 25,  w: 1, d: 1 },
  { id: "pine",        name: "Little Pine",        cat: "plants",    price: 80,  unlock: 25,  w: 1, d: 1 },
  { id: "bush",        name: "Round Bush",         cat: "plants",    price: 60,  unlock: 40,  w: 1, d: 1 },
  { id: "oak",         name: "Oak Tree",           cat: "plants",    price: 120, unlock: 75,  w: 1, d: 1 },
  { id: "palm",        name: "Beach Palm",         cat: "plants",    price: 140, unlock: 150, w: 1, d: 1, premium: true },
  { id: "rock",        name: "Mossy Rock",         cat: "decor",     price: 30,  unlock: 0,   w: 1, d: 1 },
  { id: "stump",       name: "Old Stump",          cat: "decor",     price: 30,  unlock: 0,   w: 1, d: 1 },
  { id: "fence",       name: "Wood Fence",         cat: "decor",     price: 50,  unlock: 0,   w: 1, d: 1 },
  { id: "sign",        name: "Wooden Sign",        cat: "decor",     price: 45,  unlock: 60,  w: 1, d: 1 },
  { id: "bench",       name: "Garden Bench",       cat: "decor",     price: 90,  unlock: 50,  w: 1, d: 1 },
  { id: "lantern",     name: "Stone Lantern",      cat: "decor",     price: 100, unlock: 75,  w: 1, d: 1 },
  { id: "mailbox",     name: "Red Mailbox",        cat: "decor",     price: 70,  unlock: 90,  w: 1, d: 1 },
  { id: "campfire",    name: "Campfire",           cat: "decor",     price: 150, unlock: 120, w: 1, d: 1, premium: true },
  { id: "well",        name: "Wishing Well",       cat: "decor",     price: 180, unlock: 200, w: 1, d: 1, premium: true },
  { id: "house",       name: "Tiny House",         cat: "buildings", price: 250, unlock: 100, w: 2, d: 2 },
  { id: "cabin",       name: "Forest Cabin",       cat: "buildings", price: 300, unlock: 250, w: 2, d: 2, premium: true },
  { id: "dock",        name: "Little Dock",        cat: "buildings", price: 350, unlock: 500, w: 2, d: 1, premium: true },
  { id: "petbed",      name: "Pet Bed",            cat: "pets",      price: 200, unlock: 200, w: 1, d: 1 },
  { id: "yarn",        name: "Yarn Ball",          cat: "pets",      price: 40,  unlock: 90,  w: 1, d: 1 },
  { id: "bridge",      name: "Bridge to the Isle", cat: "land",      price: 100, unlock: 60,  w: 1, d: 1, special: "bridge" },
  { id: "land-east",   name: "Sunny Meadow",       cat: "land",      price: 80,  unlock: 180, w: 0, d: 0, special: "land" },
  { id: "land-shoal",  name: "South Shoal",        cat: "land",      price: 0,   unlock: 260, w: 0, d: 0, special: "land" },
  { id: "land-west",   name: "Quiet Cove",         cat: "land",      price: 120, unlock: 420, w: 0, d: 0, special: "land" },
  { id: "land-north",  name: "North Ridge",        cat: "land",      price: 160, unlock: 620, w: 0, d: 0, special: "land" },
];

export const CATS = ["all", "plants", "decor", "buildings", "pets", "land"] as const;

export const byId = (id: string): CatalogItem => {
  const item = CATALOG.find(a => a.id === id);
  if (!item) throw new Error("unknown item " + id);
  return item;
};

export const PETS: Record<PetKind, { name: string; line: string }> = {
  cat: { name: "Mochi", line: "Curls up in the flowers while you focus." },
  dog: { name: "Miso",  line: "Naps on the beach while you focus." },
};

export const PLANS = {
  monthly:  { name: "Monthly",  price: "$4.99",  note: "per month",                  cta: "Subscribe · $4.99 / month" },
  yearly:   { name: "Yearly",   price: "$29.99", note: "≈ $2.50 / mo · 7-day trial", cta: "Start my free week", badge: "Best value" },
  lifetime: { name: "Lifetime", price: "$59.99", note: "one payment, forever",       cta: "Own it forever · $59.99" },
} as const;
export type PlanKey = keyof typeof PLANS;
