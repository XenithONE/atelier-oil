import { useEffect, useRef } from "react";
import type { Brush, Tool } from "../types";
import { DEFAULT_BRUSH, DEFAULT_PAPER } from "../types";
import { OilEngine } from "../engine/OilEngine";

export function Range({
  label,
  value,
  min = 0,
  max = 100,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range-control">
      <span className="range-label">
        <span>{label}</span>
        <span className="numeric">
          <input
            aria-label={`${label}の数値`}
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              if (e.target.value !== "")
                onChange(Math.max(min, Math.min(max, Number(e.target.value))));
            }}
          />
          {unit}
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </label>
  );
}
export function ToolIcon({ tool, size = 28 }: { tool: Tool; size?: number }) {
  const paths: Record<Tool, React.ReactNode> = {
    flat: (
      <>
        <path d="m9 3 10 4-4 10-10-4Z" />
        <path d="m10 5-2 6m5-5-2 6m5-5-2 6M5 13l10 4-2 4-3-1-5 13-3-1 5-13-3-1Z" />
      </>
    ),
    round: (
      <>
        <path d="M16 2c-1 6-9 9-7 15 3 5 10 0 10-3 0-4-3-6-3-12Z" />
        <path d="m9 18 5 2-6 11-3-1Z" />
      </>
    ),
    filbert: (
      <>
        <path d="M7 17C0 4 14-1 18 7c2 4-1 9-3 13Z" />
        <path d="m9 7-1 5m4-6-1 7m4-5-1 7M7 17l8 3-2 4-3-1-4 9-3-1 5-10-3-1Z" />
      </>
    ),
    knife: (
      <>
        <path d="m20 2-2 15-7 5-3-2 2-9Z" />
        <path d="m9 20-2 5-2-1-3 8 4 1 3-8-2-1" />
      </>
    ),
    smudge: (
      <>
        <path d="M12 3C9 10 3 16 3 21a9 9 0 0 0 18 0c0-5-6-11-9-18Z" />
        <path d="M7 22c0 3 2 4 4 4" />
      </>
    ),
    picker: (
      <>
        <path d="m14 9-3-3 2-3a5 5 0 0 1 7 7l-3 3-3-3M12 8 3 23l-1 7 6-4 10-14" />
        <path d="m6 20 4 3" />
      </>
    ),
    scraper: (
      <>
        <path d="m7 14 13 4-1 11-17-5Z" />
        <path d="m10 15 4-12 5 2-4 12" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[tool]}
    </svg>
  );
}
export function PaintMark({
  color,
  variant = "daub",
  brush,
}: {
  color: string;
  variant?: "daub" | "stroke";
  brush?: Brush;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const w = variant === "stroke" ? 256 : 90,
      h = variant === "stroke" ? 70 : 90,
      e = new OilEngine(w, h);
    e.setPaper({
      ...DEFAULT_PAPER,
      ground: "#F7F5EF",
      surface: "smooth",
      relief: 80,
      texture: 0,
    });
    const b = {
      ...DEFAULT_BRUSH,
      ...brush,
      color,
      tool:
        brush?.tool === "picker"
          ? "flat"
          : brush?.tool === "smudge"
            ? "filbert"
            : (brush?.tool ?? "flat"),
      size: variant === "stroke" ? 40 : 44,
      mix: 0,
      angle: -25,
    };
    if (variant === "stroke") {
      e.startStroke({ x: 25, y: 44, pressure: 0.7 }, b);
      for (let x = 26; x < 230; x += 3)
        e.moveStroke({
          x,
          y: 40 - Math.sin((x / 240) * Math.PI) * 12,
          pressure: 1 - (x / 250) * 0.7,
        });
    } else {
      e.startStroke(
        { x: 60, y: 45, pressure: 0.9 },
        { ...b, tool: "filbert", size: 47, load: 100, dry: 3, angle: 0 },
      );
      for (let k = 1; k <= 50; k++) {
        const a = (k / 50) * Math.PI * 2;
        e.moveStroke({
          x: 45 + Math.cos(a) * 16,
          y: 45 + Math.sin(a) * 17,
          pressure: 0.8 + Math.sin(a * 3) * 0.12,
        });
      }
      e.endStroke();
    }
    e.endStroke();
    e.renderTo(ref.current);
  }, [color, variant, brush]);
  return (
    <canvas aria-hidden="true" ref={ref} className={`paint-mark ${variant}`} />
  );
}
