import { Color, mix } from "spectral.js";
import type { RGB } from "../types";
export const clamp = (n: number, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, n));
export const hexRGB = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
export const rgbHex = (rgb: RGB) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const colors = new Map<string, Color>();
function spectralColor(hex: string) {
  let c = colors.get(hex);
  if (!c) {
    c = new Color(hex);
    if (colors.size > 2048) colors.clear();
    colors.set(hex, c);
  }
  return c;
}
const cache = new Map<string, RGB>();
// Spectral mixing is evaluated per bristle, then coverage is composited separately.
export function pigmentMix(a: RGB, b: RGB, t: number): RGB {
  if (t < 0.008) return [...a];
  if (t > 0.992) return [...b];
  const ah = rgbHex(a.map((v) => Math.round(v / 4) * 4) as RGB);
  const bh = rgbHex(b.map((v) => Math.round(v / 4) * 4) as RGB);
  const q = Math.round(t * 32) / 32,
    key = `${ah}${bh}${q}`;
  let rgb = cache.get(key);
  if (!rgb) {
    rgb = hexRGB(
      mix([spectralColor(ah), 1 - q], [spectralColor(bh), q]).toString(),
    );
    if (cache.size > 6000) cache.clear();
    cache.set(key, rgb);
  }
  return [...rgb];
}
export function mixPalette(values: string[], weights?: number[]) {
  if (!values.length) return "#C49A43";
  return mix(
    ...values.map((v, i): [Color, number] => [
      spectralColor(v),
      weights?.[i] ?? 1,
    ]),
  ).toString();
}
