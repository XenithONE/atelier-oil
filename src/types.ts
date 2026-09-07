export type RGB = [number, number, number];
export type Tool =
  "flat" | "round" | "filbert" | "knife" | "smudge" | "picker" | "scraper";
export type Surface = "linen" | "cotton" | "smooth";
export interface Brush {
  tool: Tool;
  color: string;
  size: number;
  load: number;
  mix: number;
  dry: number;
  angle: number;
  medium: number;
}
export interface Paper {
  surface: Surface;
  texture: number;
  light: number;
  relief: number;
  ground: string;
}
export interface Point {
  x: number;
  y: number;
  pressure: number;
}
export interface PaintingState {
  width: number;
  height: number;
  paint: Uint8ClampedArray;
  relief: Float32Array;
  wet: Uint8Array;
}
export interface DocumentMeta {
  name: string;
  paper: Paper;
  brush: Brush;
  palette: string[];
}
export const DEFAULT_BRUSH: Brush = {
  tool: "flat",
  color: "#C49A43",
  size: 36,
  load: 75,
  mix: 35,
  dry: 15,
  angle: -25,
  medium: 0,
};
export const DEFAULT_PAPER: Paper = {
  surface: "linen",
  texture: 45,
  light: 315,
  relief: 65,
  ground: "#F5F1E7",
};
export const TOOL_NAMES: Record<Tool, string> = {
  flat: "平筆",
  round: "丸筆",
  filbert: "フィルバート",
  knife: "ナイフ",
  smudge: "ぼかし",
  picker: "スポイト",
  scraper: "スクレーパー",
};
