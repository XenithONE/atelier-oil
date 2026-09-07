import { describe, it, expect } from "vitest";
import { OilEngine } from "./OilEngine";
import { DEFAULT_BRUSH } from "../types";
import { hexRGB, mixPalette } from "./color";
import { encodeProject, decodeProject } from "./project";

const line = (e: OilEngine, color = "#C49A43", options = {}) => {
  e.startStroke(
    { x: 18, y: 48, pressure: 0.85 },
    { ...DEFAULT_BRUSH, color, size: 24, dry: 0, ...options },
  );
  e.moveStroke({ x: 78, y: 48, pressure: 0.85 });
  e.endStroke();
};
const total = (a: ArrayLike<number>) =>
  Array.from(a).reduce((n, v) => n + v, 0);
describe("oil material", () => {
  it("deposits actual paint, thickness and wetness; restores all three through undo and redo", () => {
    const e = new OilEngine(96, 96);
    line(e);
    const saved = e.snapshot();
    expect(total(e.relief)).toBeGreaterThan(500);
    expect(total(e.wet)).toBeGreaterThan(10000);
    e.undo();
    expect(total(e.paint)).toBe(0);
    expect(total(e.relief)).toBe(0);
    expect(total(e.wet)).toBe(0);
    e.redo();
    expect(e.snapshot()).toEqual(saved);
  });
  it("drying is reversible and preserves pigment and thickness", () => {
    const e = new OilEngine(96, 96);
    line(e);
    const s = e.snapshot();
    e.dry();
    expect(total(e.wet)).toBe(0);
    expect(e.paint).toEqual(s.paint);
    expect(e.relief).toEqual(s.relief);
    e.undo();
    expect(e.wet).toEqual(s.wet);
  });
  it("dry paint cannot be moved with a wet blending tool", () => {
    const e = new OilEngine(96, 96);
    line(e);
    e.dry();
    const s = e.snapshot();
    line(e, "#D63620", { tool: "smudge" });
    expect(e.paint).toEqual(s.paint);
    expect(e.relief).toEqual(s.relief);
  });
  it("a blending brush on blank linen does not introduce its selected pigment", () => {
    const e = new OilEngine(96, 96);
    line(e, "#D63620", { tool: "smudge" });
    expect(total(e.paint)).toBe(0);
  });
  it("the knife deposits more material than glazing medium", () => {
    const heavy = new OilEngine(96, 96),
      glaze = new OilEngine(96, 96);
    line(heavy, "#C49A43", { tool: "knife", load: 100 });
    line(glaze, "#C49A43", { medium: 95, load: 100 });
    expect(total(heavy.relief)).toBeGreaterThan(total(glaze.relief) * 5);
  });
  it("dry bristles leave more uncovered linen than loaded bristles", () => {
    const loaded = new OilEngine(96, 96),
      dry = new OilEngine(96, 96);
    line(loaded);
    line(dry, "#C49A43", { dry: 90 });
    expect(total(dry.paint.filter((_, i) => i % 4 === 3))).toBeLessThan(
      total(loaded.paint.filter((_, i) => i % 4 === 3)) * 0.8,
    );
  });
  it("scraping removes relief and undo restores the paint", () => {
    const e = new OilEngine(96, 96);
    line(e);
    const before = e.snapshot();
    line(e, "#000000", { tool: "scraper" });
    expect(total(e.relief)).toBeLessThan(total(before.relief));
    e.undo();
    expect(e.snapshot()).toEqual(before);
  });
  it("light changes the rendered relief without altering the painting material", () => {
    const e = new OilEngine(96, 96);
    line(e);
    const before = e.snapshot(),
      left = e.renderPixels().slice();
    e.setPaper({ ...e.paper, light: 135 });
    const right = e.renderPixels().slice();
    expect(right).not.toEqual(left);
    expect(e.snapshot()).toEqual(before);
  });
  it("a fresh edit after undo removes the abandoned redo branch", () => {
    const e = new OilEngine(96, 96);
    line(e);
    line(e, "#002185");
    e.undo();
    expect(e.canRedo).toBe(true);
    line(e, "#D63620");
    expect(e.canRedo).toBe(false);
  });
  it("a stroke carries wet yellow into blue but does not pick up a dried underpainting", () => {
    const wet = new OilEngine(96, 96),
      dry = new OilEngine(96, 96);
    for (const e of [wet, dry]) line(e, "#FCD200", { load: 100 });
    dry.dry();
    for (const e of [wet, dry]) {
      e.startStroke(
        { x: 48, y: 15, pressure: 1 },
        {
          ...DEFAULT_BRUSH,
          color: "#002185",
          size: 20,
          mix: 85,
          load: 100,
          dry: 0,
          angle: 0,
        },
      );
      e.moveStroke({ x: 48, y: 80, pressure: 1 });
      e.endStroke();
    }
    const w = hexRGB(wet.sample(48, 63)),
      d = hexRGB(dry.sample(48, 63));
    expect(w[1]).toBeGreaterThan(d[1] + 20);
  });
});
describe("pigment mixing", () => {
  it("blue and yellow mix to green instead of an additive grey", () => {
    const [r, g, b] = hexRGB(mixPalette(["#002185", "#FCD200"]));
    expect(g).toBeGreaterThan(r * 1.5);
    expect(g).toBeGreaterThan(b * 1.5);
  });
  it("mixture weights change the result", () => {
    expect(mixPalette(["#002185", "#FCD200"], [10, 90])).not.toEqual(
      mixPalette(["#002185", "#FCD200"], [90, 10]),
    );
  });
});
describe("editable project", () => {
  const meta = {
    name: "油彩テスト",
    paper: new OilEngine(96, 96).paper,
    brush: DEFAULT_BRUSH,
    palette: ["#002185", "#FCD200"],
  };
  it("round trips pigment, relief, wetness and settings exactly", async () => {
    const e = new OilEngine(96, 96);
    line(e);
    const s = e.snapshot(),
      file = encodeProject(s, meta),
      restored = await decodeProject(file);
    expect(restored.state).toEqual(s);
    expect(restored.meta).toEqual(meta);
  });
  it("rejects truncated files before allocating pixel buffers", async () => {
    const file = encodeProject(new OilEngine(96, 96).snapshot(), meta);
    await expect(decodeProject(file.slice(0, file.size - 1))).rejects.toThrow();
  });
  it("rejects oversized dimensions and invalid floating point relief", async () => {
    const file = encodeProject(new OilEngine(96, 96).snapshot(), meta),
      buf = await file.arrayBuffer(),
      v = new DataView(buf),
      offset = v.getUint32(20, true);
    v.setFloat32(offset + 96 * 96 * 4, NaN, true);
    await expect(decodeProject(new Blob([buf]))).rejects.toThrow("厚み");
    v.setUint32(8, 0xffffffff, true);
    await expect(decodeProject(new Blob([buf]))).rejects.toThrow();
  });
});
