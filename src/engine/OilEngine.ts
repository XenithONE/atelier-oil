import type { Brush, Paper, PaintingState, Point, RGB } from "../types";
import { DEFAULT_PAPER } from "../types";
import { clamp, hexRGB, pigmentMix, rgbHex } from "./color";

type Rect = { x: number; y: number; w: number; h: number };
type Patch = {
  rect: Rect;
  paint: Uint8ClampedArray;
  relief: Float32Array;
  wet: Uint8Array;
};
type Entry = { before: Patch; after: Patch; bytes: number };
const hash = (x: number, y: number) => {
  let n = Math.imul(x + 731, 374761393) ^ Math.imul(y + 193, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

export class OilEngine {
  width: number;
  height: number;
  paint: Uint8ClampedArray;
  relief: Float32Array;
  wet: Uint8Array;
  paper: Paper = { ...DEFAULT_PAPER };
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  private before: PaintingState | null = null;
  private bounds: Rect | null = null;
  private last: Point | null = null;
  private brush: Brush | null = null;
  private bristles: RGB[] = [];
  private loaded: boolean[] = [];
  private lastColor = "";
  private distance = 0;
  private hasDab = false;
  private seed = 1;
  private dirty: Rect | null = null;
  private output: Uint8ClampedArray;
  private ground: RGB = hexRGB(DEFAULT_PAPER.ground);
  changed = false;
  onDirty: (() => void) | undefined;

  constructor(width = 960, height = 720) {
    this.width = width;
    this.height = height;
    this.paint = new Uint8ClampedArray(width * height * 4);
    this.relief = new Float32Array(width * height);
    this.wet = new Uint8Array(width * height);
    this.output = new Uint8ClampedArray(width * height * 4);
    this.invalidate();
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get strokeActive() {
    return this.before !== null;
  }
  get historyCount() {
    return this.undoStack.length;
  }
  snapshot(): PaintingState {
    return {
      width: this.width,
      height: this.height,
      paint: this.paint.slice(),
      relief: this.relief.slice(),
      wet: this.wet.slice(),
    };
  }
  load(state: PaintingState) {
    this.width = state.width;
    this.height = state.height;
    this.paint = state.paint.slice();
    this.relief = state.relief.slice();
    this.wet = state.wet.slice();
    this.output = new Uint8ClampedArray(this.width * this.height * 4);
    this.undoStack = [];
    this.redoStack = [];
    this.before = null;
    this.brush = null;
    this.last = null;
    this.bristles = [];
    this.loaded = [];
    this.lastColor = "";
    this.changed = this.paint.some((v, i) => i % 4 === 3 && v > 0);
    this.invalidate();
  }
  setPaper(paper: Paper) {
    this.paper = { ...paper };
    this.ground = hexRGB(paper.ground);
    this.invalidate();
  }
  invalidate() {
    this.dirty = { x: 0, y: 0, w: this.width, h: this.height };
    this.onDirty?.();
  }
  private mark(rect: Rect) {
    const union = (a: Rect | null, b: Rect): Rect =>
      a
        ? {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
            h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
          }
        : b;
    this.dirty = union(this.dirty, rect);
    this.bounds = union(this.bounds, rect);
    this.onDirty?.();
  }
  private patch(state: PaintingState, rect: Rect): Patch {
    const paint = new Uint8ClampedArray(rect.w * rect.h * 4),
      relief = new Float32Array(rect.w * rect.h),
      wet = new Uint8Array(rect.w * rect.h);
    for (let y = 0; y < rect.h; y++) {
      const src = (rect.y + y) * this.width + rect.x,
        dst = y * rect.w;
      paint.set(state.paint.subarray(src * 4, (src + rect.w) * 4), dst * 4);
      relief.set(state.relief.subarray(src, src + rect.w), dst);
      wet.set(state.wet.subarray(src, src + rect.w), dst);
    }
    return { rect, paint, relief, wet };
  }
  private apply(p: Patch) {
    for (let y = 0; y < p.rect.h; y++) {
      const dst = (p.rect.y + y) * this.width + p.rect.x,
        src = y * p.rect.w;
      this.paint.set(p.paint.subarray(src * 4, (src + p.rect.w) * 4), dst * 4);
      this.relief.set(p.relief.subarray(src, src + p.rect.w), dst);
      this.wet.set(p.wet.subarray(src, src + p.rect.w), dst);
    }
    this.changed = this.paint.some((v, i) => i % 4 === 3 && v > 0);
    this.invalidate();
  }
  undo() {
    this.endStroke();
    const entry = this.undoStack.pop();
    if (entry) {
      this.apply(entry.before);
      this.redoStack.push(entry);
    }
  }
  redo() {
    this.endStroke();
    const entry = this.redoStack.pop();
    if (entry) {
      this.apply(entry.after);
      this.undoStack.push(entry);
    }
  }
  private beginEdit() {
    this.before = this.snapshot();
    this.bounds = null;
  }
  endStroke() {
    if (this.brush && this.last && !this.hasDab) {
      this.dab(this.last, (this.brush.angle * Math.PI) / 180);
      this.hasDab = true;
    }
    if (this.before && this.bounds) {
      const before = this.patch(this.before, this.bounds),
        after = this.patch(this, this.bounds);
      this.undoStack.push({
        before,
        after,
        bytes:
          before.paint.byteLength * 2 +
          before.relief.byteLength * 2 +
          before.wet.byteLength * 2,
      });
      this.redoStack = [];
      let bytes = this.undoStack.reduce((n, e) => n + e.bytes, 0);
      while (
        this.undoStack.length > 1 &&
        (bytes > 80 * 1024 * 1024 || this.undoStack.length > 60)
      )
        bytes -= this.undoStack.shift()!.bytes;
    }
    this.before = null;
    this.last = null;
    this.brush = null;
    this.bounds = null;
  }
  dry() {
    this.endStroke();
    this.beginEdit();
    this.wet.fill(0);
    this.mark({ x: 0, y: 0, w: this.width, h: this.height });
    this.endStroke();
  }
  wash() {
    this.endStroke();
    this.bristles = [];
    this.loaded = [];
    this.lastColor = "";
  }
  clear() {
    this.endStroke();
    this.beginEdit();
    this.paint.fill(0);
    this.relief.fill(0);
    this.wet.fill(0);
    this.changed = false;
    this.mark({ x: 0, y: 0, w: this.width, h: this.height });
    this.endStroke();
  }
  sample(x: number, y: number): string {
    const i =
      (Math.floor(clamp(y, 0, this.height - 1)) * this.width +
        Math.floor(clamp(x, 0, this.width - 1))) *
      4;
    const a = this.paint[i + 3] / 255;
    return rgbHex(
      [0, 1, 2].map(
        (c) => this.paint[i + c] * a + this.ground[c] * (1 - a),
      ) as RGB,
    );
  }
  startStroke(point: Point, brush: Brush) {
    this.endStroke();
    this.beginEdit();
    this.brush = { ...brush };
    this.last = point;
    this.distance = 0;
    this.hasDab = false;
    this.seed++;
    const fresh = hexRGB(brush.color),
      carry =
        this.lastColor === brush.color &&
        this.bristles.length === 48 &&
        brush.tool !== "smudge";
    this.bristles = Array.from({ length: 48 }, (_, i) =>
      carry
        ? pigmentMix(fresh, this.bristles[i], (brush.mix / 100) * 0.35)
        : [...fresh],
    );
    this.loaded = Array(48).fill(brush.tool !== "smudge");
    this.lastColor = brush.color;
  }
  moveStroke(point: Point) {
    if (!this.last || !this.brush) return;
    const start = this.last,
      dx = point.x - start.x,
      dy = point.y - start.y,
      dist = Math.hypot(dx, dy);
    if (dist < 0.25) return;
    const steps = Math.ceil(dist / Math.max(1, this.brush.size * 0.07));
    const angle =
      this.brush.tool === "knife"
        ? (this.brush.angle * Math.PI) / 180
        : Math.atan2(dy, dx) + (this.brush.angle * Math.PI) / 180;
    if (!this.hasDab) {
      this.dab(start, angle);
      this.hasDab = true;
    }
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.distance += dist / steps;
      this.dab(
        {
          x: start.x + dx * t,
          y: start.y + dy * t,
          pressure: start.pressure + (point.pressure - start.pressure) * t,
        },
        angle,
      );
    }
    this.last = point;
  }
  private dab(p: Point, angle: number) {
    const b = this.brush!;
    if (b.tool === "picker") return;
    const pressure = clamp(p.pressure, 0.08, 1),
      r = Math.max(0.8, b.size * 0.5 * (0.35 + 0.65 * Math.sqrt(pressure)));
    const cs = Math.cos(angle),
      sn = Math.sin(angle),
      squash =
        b.tool === "flat"
          ? 0.4
          : b.tool === "knife"
            ? 0.3
            : b.tool === "filbert"
              ? 0.65
              : 1;
    const extent = Math.ceil(r + 3),
      x0 = Math.max(0, Math.floor(p.x - extent)),
      x1 = Math.min(this.width - 1, Math.ceil(p.x + extent)),
      y0 = Math.max(0, Math.floor(p.y - extent)),
      y1 = Math.min(this.height - 1, Math.ceil(p.y + extent));
    if (x1 < x0 || y1 < y0) return;
    const load =
        (b.load / 100) *
        (0.28 + 0.72 * Math.exp(-this.distance / (b.size * 70 + 200))),
      dry = b.dry / 100,
      medium = b.medium / 100;
    const ink: RGB[] = [],
      laneWet: number[] = [];
    // Each bristle picks up pigment independently. Dry paint remains fixed under fresh paint.
    for (let k = 0; k < 48; k++) {
      const cross = (k / 47 - 0.5) * r * 1.8;
      const lead = r * squash + Math.max(1, b.size * 0.07);
      const sx = Math.round(
          clamp(p.x + cs * lead - sn * cross, 0, this.width - 1),
        ),
        sy = Math.round(
          clamp(p.y + sn * lead + cs * cross, 0, this.height - 1),
        ),
        idx = sy * this.width + sx,
        a = this.paint[idx * 4 + 3] / 255,
        w = this.wet[idx] / 255;
      laneWet[k] = w * a;
      const underlying: [number, number, number] = [
        this.paint[idx * 4],
        this.paint[idx * 4 + 1],
        this.paint[idx * 4 + 2],
      ];
      if (b.tool === "smudge" && !this.loaded[k] && a * w > 0.02) {
        this.bristles[k] = underlying;
        this.loaded[k] = true;
      }
      const pick = (b.tool === "smudge" ? 0.42 : (b.mix / 100) * 0.35) * w * a;
      if (pick > 0.01)
        this.bristles[k] = pigmentMix(this.bristles[k], underlying, pick);
      ink[k] =
        b.tool === "smudge"
          ? a > 0.05
            ? pigmentMix(this.bristles[k], underlying, 0.35)
            : this.bristles[k]
          : this.bristles[k];
    }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - p.x,
          dy = y - p.y,
          u = (dx * cs + dy * sn) / (r * squash),
          v = (-dx * sn + dy * cs) / r;
        const shape =
          b.tool === "flat"
            ? Math.max(Math.abs(u), Math.abs(v))
            : b.tool === "knife"
              ? Math.abs(u) * 0.72 + Math.abs(v)
              : Math.hypot(u, v);
        if (shape >= 1) continue;
        const i = y * this.width + x,
          j = i * 4,
          lane = Math.round(clamp((v + 1) * 0.5) * 47);
        // A diluted round/filbert brush feathers at its edge for translucent glazes.
        const feather = b.tool === "round" || b.tool === "filbert" ? medium : 0;
        const edge =
            clamp((1 - shape) * 9) * (1 - feather) +
            Math.pow(1 - shape * shape, 3) * feather,
          bristle =
            0.22 +
            0.78 *
              Math.pow(
                0.5 +
                  0.5 *
                    Math.sin(
                      v * r * 2.35 + Math.sin(v * r * 0.46) * 2 + this.seed,
                    ),
                0.7,
              );
        const tooth =
          hash(x, y) * 0.5 +
          0.5 * (0.5 + 0.5 * Math.sin(x * 2.1) * Math.sin(y * 1.9));
        if (dry > 0 && tooth + bristle * 0.3 < dry * 0.97) continue;
        if (
          b.tool === "smudge" &&
          (laneWet[lane] < 0.02 || this.wet[i] < 5 || !this.loaded[lane])
        )
          continue;
        let amount =
          edge *
          load *
          (b.tool === "knife" ? 1 : 0.85) *
          (0.5 + 0.5 * bristle) *
          (1 - medium * 0.94);
        if (b.tool === "scraper") {
          const keep = 1 - edge * 0.28;
          this.paint[j + 3] *= keep;
          this.relief[i] *= keep;
          this.wet[i] *= keep;
          continue;
        }
        if (b.tool === "smudge") amount = edge * 0.19 * laneWet[lane];
        if (amount < 0.001) continue;
        const a = this.paint[j + 3] / 255,
          alpha = amount + a * (1 - amount),
          factor = amount / Math.max(0.001, alpha),
          color = ink[lane];
        for (let c = 0; c < 3; c++)
          this.paint[j + c] =
            this.paint[j + c] * (1 - factor) + color[c] * factor;
        this.paint[j + 3] = alpha * 255;
        const deposit =
          load *
          (b.tool === "knife" ? 3.4 : 1.25) *
          edge *
          (0.1 + 0.9 * bristle) *
          (1 - dry * 0.78) *
          (1 - medium * 0.97);
        if (b.tool === "smudge") {
          this.relief[i] *= 1 - amount * 0.2;
        } else {
          this.relief[i] = Math.min(
            32,
            this.relief[i] * (1 - amount * 0.25) + deposit * pressure,
          );
          this.wet[i] = Math.max(this.wet[i], (1 - dry * 0.85) * 255);
        }
      }
    this.changed = true;
    this.mark({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  renderPixels(): Uint8ClampedArray {
    if (!this.dirty) return this.output;
    const d = this.dirty,
      x0 = Math.max(0, d.x - 2),
      y0 = Math.max(0, d.y - 2),
      x1 = Math.min(this.width, d.x + d.w + 2),
      y1 = Math.min(this.height, d.y + d.h + 2);
    const light = (this.paper.light * Math.PI) / 180,
      lx = Math.cos(light),
      ly = Math.sin(light),
      strength = this.paper.relief / 100,
      texture = this.paper.texture / 100;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * this.width + x,
          j = i * 4,
          a = this.paint[j + 3] / 255,
          h = this.relief[i];
        const nx =
          (this.relief[y * this.width + Math.max(0, x - 1)] -
            this.relief[y * this.width + Math.min(this.width - 1, x + 1)]) *
          0.8 *
          strength;
        const ny =
          (this.relief[Math.max(0, y - 1) * this.width + x] -
            this.relief[Math.min(this.height - 1, y + 1) * this.width + x]) *
          0.8 *
          strength;
        const len = Math.sqrt(nx * nx + ny * ny + 1),
          diffuse = (nx * lx + ny * ly + 1.4) / (len * 1.72);
        const shine =
          Math.pow(
            Math.max(0, (nx * lx * 0.38 + ny * ly * 0.38 + 1) / len / 1.135),
            26,
          ) *
          Math.min(1, h) *
          a *
          strength *
          (0.25 + (0.75 * this.wet[i]) / 255) *
          48;
        const weave =
          this.paper.surface === "smooth"
            ? 0
            : this.paper.surface === "linen"
              ? Math.sin(x * 1.5) * Math.cos(y * 1.27) * 7 +
                (hash(x, y) - 0.5) * 5
              : (Math.sin(x * 2.3) +
                  Math.cos(y * 2.1) +
                  (hash(x, y) - 0.5) * 4) *
                1.8;
        const shading = 1 + clamp(diffuse - 0.814, -0.55, 0.35) * strength;
        for (let c = 0; c < 3; c++) {
          const base = this.paint[j + c] * a + this.ground[c] * (1 - a);
          this.output[j + c] =
            base * shading + shine + weave * texture * (1 - a * 0.75);
        }
        this.output[j + 3] = 255;
      }
    this.dirty = null;
    return this.output;
  }
  renderTo(canvas: HTMLCanvasElement) {
    if (canvas.width !== this.width || canvas.height !== this.height) {
      canvas.width = this.width;
      canvas.height = this.height;
    }
    const context = canvas.getContext("2d");
    if (context)
      context.putImageData(
        new ImageData(
          new Uint8ClampedArray(this.renderPixels()),
          this.width,
          this.height,
        ),
        0,
        0,
      );
  }
}
