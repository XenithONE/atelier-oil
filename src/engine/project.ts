import { DEFAULT_BRUSH, DEFAULT_PAPER } from "../types";
import type { DocumentMeta, PaintingState, Tool } from "../types";
import { clamp } from "./color";

const MAGIC = "ATELIER1",
  MAX_PIXELS = 2560000;
const isHex = (v: unknown): v is string =>
  typeof v === "string" && /^#[\da-f]{6}$/i.test(v);
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("作品の設定を読み取れません。");
  return v as Record<string, unknown>;
}
function number(v: unknown, fallback: number, min: number, max: number) {
  return typeof v === "number" && Number.isFinite(v)
    ? clamp(v, min, max)
    : fallback;
}
export function validateMeta(raw: unknown): DocumentMeta {
  const m = record(raw),
    p = record(m.paper),
    b = record(m.brush);
  const tools: Tool[] = [
    "flat",
    "round",
    "filbert",
    "knife",
    "smudge",
    "picker",
    "scraper",
  ];
  return {
    name: typeof m.name === "string" ? m.name.slice(0, 120) : "無題の作品",
    paper: {
      surface:
        p.surface === "cotton" || p.surface === "smooth" ? p.surface : "linen",
      texture: number(p.texture, 45, 0, 100),
      light: number(p.light, 315, 0, 360),
      relief: number(p.relief, 65, 0, 100),
      ground: isHex(p.ground) ? p.ground : DEFAULT_PAPER.ground,
    },
    brush: {
      tool: tools.includes(b.tool as Tool) ? (b.tool as Tool) : "flat",
      color: isHex(b.color) ? b.color : DEFAULT_BRUSH.color,
      size: number(b.size, 36, 1, 160),
      load: number(b.load, 75, 1, 100),
      mix: number(b.mix, 35, 0, 100),
      dry: number(b.dry, 15, 0, 100),
      angle: number(b.angle, -25, -90, 90),
      medium: number(b.medium, 0, 0, 100),
    },
    palette: Array.isArray(m.palette)
      ? m.palette.filter(isHex).slice(0, 8)
      : [],
  };
}
export function encodeProject(state: PaintingState, meta: DocumentMeta): Blob {
  const json = new TextEncoder().encode(JSON.stringify(meta)),
    padding = Math.ceil(json.length / 4) * 4,
    n = state.width * state.height,
    offset = 24 + padding;
  const buffer = new ArrayBuffer(offset + n * 9),
    view = new DataView(buffer),
    bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode(MAGIC));
  view.setUint32(8, state.width, true);
  view.setUint32(12, state.height, true);
  view.setUint32(16, json.length, true);
  view.setUint32(20, offset, true);
  bytes.set(json, 24);
  bytes.set(state.paint, offset);
  // Explicit little endian keeps exported thickness portable across platforms.
  for (let i = 0; i < n; i++)
    view.setFloat32(offset + n * 4 + i * 4, state.relief[i], true);
  bytes.set(state.wet, offset + n * 8);
  return new Blob([buffer], { type: "application/x-atelier" });
}
export async function decodeProject(
  blob: Blob,
): Promise<{ state: PaintingState; meta: DocumentMeta }> {
  if (blob.size < 24 || blob.size > 25 * 1024 * 1024)
    throw Error("作品ファイルのサイズが正しくありません（上限25MB）。");
  const buffer = await blob.arrayBuffer(),
    bytes = new Uint8Array(buffer),
    v = new DataView(buffer);
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC)
    throw Error("atelierで保存した .atelier ファイルを選んでください。");
  const w = v.getUint32(8, true),
    h = v.getUint32(12, true),
    jsonLength = v.getUint32(16, true),
    offset = v.getUint32(20, true),
    n = w * h;
  if (
    w < 64 ||
    h < 64 ||
    w > 2000 ||
    h > 2000 ||
    n > MAX_PIXELS ||
    jsonLength > 65536 ||
    offset !== 24 + Math.ceil(jsonLength / 4) * 4 ||
    buffer.byteLength !== offset + n * 9
  )
    throw Error("作品ファイルが壊れているか、対応サイズを超えています。");
  const meta = validateMeta(
    JSON.parse(new TextDecoder().decode(bytes.subarray(24, 24 + jsonLength))),
  );
  const relief = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const value = v.getFloat32(offset + n * 4 + i * 4, true);
    if (!Number.isFinite(value) || value < 0 || value > 32)
      throw Error("厚みデータが壊れています。");
    relief[i] = value;
  }
  return {
    state: {
      width: w,
      height: h,
      paint: new Uint8ClampedArray(bytes.slice(offset, offset + n * 4)),
      relief,
      wet: bytes.slice(offset + n * 8),
    },
    meta,
  };
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("atelier-oil", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("works");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return connection;
}
export async function saveLocal(blob: Blob) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("works", "readwrite");
    tx.objectStore("works").put(blob, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function loadLocal(): Promise<Blob | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("works").objectStore("works").get("current");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[<>:"/\\|?*]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
