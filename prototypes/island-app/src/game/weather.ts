import type { Phase, Weather } from "./types";

export const dayStamp = (): string => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
};

/* URL-hash overrides for demos: #night, #day, #dawn, #rain, #cloud */
let phaseOverride: Phase | null = null;
let weatherOverride: Weather | null = null;
{
  const h = typeof location !== "undefined" ? location.hash : "";
  if (h.includes("night")) phaseOverride = "night";
  else if (h.includes("dawn")) phaseOverride = "dawn";
  else if (h.includes("day")) phaseOverride = "day";
  if (h.includes("rain")) weatherOverride = "rain";
  else if (h.includes("cloud")) weatherOverride = "cloudy";
}
export const setWeatherOverride = (w: Weather | null) => { weatherOverride = w; };

export function dayPhase(): Phase {
  const h = new Date().getHours();
  return h >= 5 && h < 8 ? "dawn" : h < 16 ? "day" : h < 19 ? "dusk" : "night";
}

export function todayWeather(): Weather {
  let h = 0;
  for (const c of dayStamp()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = h % 100;
  return r < 45 ? "clear" : r < 75 ? "cloudy" : "rain";
}

export const curPhase = (): Phase => phaseOverride ?? dayPhase();
export const curWeather = (): Weather => weatherOverride ?? todayWeather();
