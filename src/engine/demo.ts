import { OilEngine } from "./OilEngine";
import { DEFAULT_BRUSH } from "../types";
// A small original study painted with the same editable oil engine as the user's strokes.
export function paintStudy(engine: OilEngine) {
  const w = engine.width,
    h = engine.height;
  let seed = 19;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function stroke(
    x: number,
    y: number,
    dx: number,
    dy: number,
    size: number,
    color: string,
    load = 75,
    tool: "flat" | "knife" | "filbert" = "flat",
  ) {
    const b = {
      ...DEFAULT_BRUSH,
      color,
      size: (size * w) / 960,
      load,
      mix: 8,
      dry: 22,
      tool,
      angle: -12,
    };
    engine.startStroke({ x: x * w, y: y * h, pressure: 0.8 }, b);
    for (let i = 1; i <= 5; i++)
      engine.moveStroke({
        x: (x + (dx * i) / 5) * w,
        y: (y + (dy * i) / 5) * h,
        pressure: 0.65 + Math.sin((i / 5) * Math.PI) * 0.3,
      });
    engine.endStroke();
  }
  const oldDirty = engine.onDirty;
  engine.onDirty = undefined;
  // Overlapping broad marks form a sky, blue distance, olive meadow and warm path.
  for (let y = -0.02; y < 1.08; y += 0.035)
    for (let x = -0.04; x < 1.04; x += 0.055) {
      const sky = ["#C2D2D3", "#B6CDCF", "#D6DFD9", "#DBDBCB"],
        meadow = ["#71806A", "#8C9161", "#A19E69", "#707953"];
      const palette = y < 0.48 ? sky : meadow;
      stroke(
        x,
        y + rand() * 0.018,
        0.07 + rand() * 0.04,
        (rand() - 0.5) * 0.017,
        66,
        palette[Math.floor(rand() * 4)],
        60,
      );
    }
  for (let i = 0; i < 50; i++) {
    const x = rand();
    stroke(
      x,
      0.44 + Math.sin(x * 12) * 0.026,
      0.12,
      rand() * 0.02,
      40,
      ["#657B82", "#83958C", "#ACB7A9"][i % 3],
      70,
    );
  }
  for (let i = 0; i < 60; i++) {
    const y = 0.51 + rand() * 0.5,
      x = 0.51 - (y - 0.5) * 0.2 + (rand() - 0.5) * (y - 0.35) * 0.22;
    stroke(
      x,
      y,
      0.035 + (y - 0.4) * 0.07,
      -0.015,
      24 + y * 25,
      ["#D8C49A", "#C1AE80", "#B29A6A"][i % 3],
      85,
      "knife",
    );
  }
  for (let i = 0; i < 90; i++) {
    const x = rand(),
      y = 0.59 + rand() * 0.45;
    if (Math.abs(x - (0.51 - (y - 0.5) * 0.2)) < 0.05) continue;
    stroke(
      x,
      y,
      0.009 + rand() * 0.02,
      -0.016 - rand() * 0.03,
      6 + rand() * 9,
      ["#4D6143", "#D3BA66", "#A7A25B", "#687747"][i % 4],
      90,
      "filbert",
    );
  }
  for (let i = 0; i < 35; i++) {
    const x = rand(),
      y = 0.72 + rand() * 0.25;
    if (Math.abs(x - 0.45) < 0.07) continue;
    stroke(
      x,
      y,
      0.008,
      -0.006,
      5 + rand() * 9,
      ["#C77949", "#E7D5A0", "#DDCB8C"][i % 3],
      95,
      "knife",
    );
  }
  engine.load(engine.snapshot());
  engine.onDirty = oldDirty;
  engine.invalidate();
}
