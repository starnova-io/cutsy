// Guideline 2.3.7: a price, or the word "free", in store media is inaccurate
// metadata. The screens are checked as they're captured (scripts/capture.mjs);
// the words this package adds on top are checked here before anything draws.
const BAD = /(^|[^a-z])(free|discount|sale|trial)([^a-z]|$)|[$€£¥]\s?\d|\/\s?(month|year|mo|yr)\b/i;

export function assertNoPriceWording(where: string, ...lines: readonly string[]): void {
  const hit = lines.find(l => BAD.test(l));
  if (hit) throw new Error(`Guideline 2.3.7: "${hit}" (${where}) names a price or "free" — change src/shots.json`);
}
