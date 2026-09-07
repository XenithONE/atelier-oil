import { ChevronDown, Droplets, Waves, Eraser } from "lucide-react";
import { Range, ToolIcon, PaintMark } from "./Controls";
import { TOOL_NAMES } from "../types";
import type { Brush, Tool } from "../types";
interface Props {
  brush: Brush;
  onChange: (patch: Partial<Brush>) => void;
  onWash: () => void;
  onDry: () => void;
}
const presets: Record<string, Partial<Brush>> = {
  standard: { load: 75, mix: 35, dry: 15, medium: 0 },
  impasto: { load: 100, mix: 15, dry: 0, medium: 0 },
  dry: { load: 55, mix: 5, dry: 80, medium: 0 },
  glaze: { load: 55, mix: 10, dry: 0, medium: 88 },
};
export default function ToolPanel({ brush, onChange, onWash, onDry }: Props) {
  const tools: Tool[] = [
    "flat",
    "round",
    "filbert",
    "knife",
    "smudge",
    "picker",
  ];
  const presetValue =
    Object.keys(presets).find((k) =>
      Object.entries(presets[k]).every(
        ([key, value]) => brush[key as keyof Brush] === value,
      ),
    ) ?? "custom";
  return (
    <>
      <section className="tools-section">
        <h2>道具</h2>
        <div className="tool-grid">
          {tools.map((tool) => (
            <button
              key={tool}
              aria-label={TOOL_NAMES[tool]}
              aria-pressed={brush.tool === tool}
              onClick={() => onChange({ tool })}
              className={`tool-button ${brush.tool === tool ? "selected" : ""}`}
            >
              <ToolIcon tool={tool} />
              <span>{TOOL_NAMES[tool]}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>筆の調整</h2>
        <PaintMark color={brush.color} variant="stroke" brush={brush} />
        <Range
          label="筆の太さ"
          value={brush.size}
          min={1}
          max={160}
          unit="px"
          onChange={(size) => onChange({ size })}
        />
        <Range
          label="絵具の量"
          value={brush.load}
          min={1}
          onChange={(load) => onChange({ load })}
        />
        <Range
          label="混ざりやすさ"
          value={brush.mix}
          onChange={(mix) => onChange({ mix })}
        />
        <Range
          label="筆の乾き"
          value={brush.dry}
          onChange={(dry) => onChange({ dry })}
        />
        <details className="advanced">
          <summary>
            メディウムと筆先
            <ChevronDown size={14} />
          </summary>
          <div className="details-body">
            <label className="select-label">
              描き味
              <select
                aria-label="描き味"
                value={presetValue}
                onChange={(e) => {
                  if (presets[e.target.value])
                    onChange(presets[e.target.value]);
                }}
              >
                {presetValue === "custom" && (
                  <option value="custom">自分の配合</option>
                )}
                <option value="standard">標準の油彩</option>
                <option value="impasto">厚塗り / インパスト</option>
                <option value="dry">ドライブラシ</option>
                <option value="glaze">薄塗り / グレーズ</option>
              </select>
            </label>
            <Range
              label="オイル・希釈"
              value={brush.medium}
              onChange={(medium) => onChange({ medium })}
            />
            <Range
              label="筆先の角度"
              value={brush.angle}
              min={-90}
              max={90}
              unit="°"
              onChange={(angle) => onChange({ angle })}
            />
            <button
              className={`secondary full ${brush.tool === "scraper" ? "selected" : ""}`}
              aria-pressed={brush.tool === "scraper"}
              onClick={() => onChange({ tool: "scraper" })}
            >
              <Eraser size={17} />
              スクレーパー
            </button>
            <p className="muted small">
              絵具を削り取ります。元に戻す操作にも対応。
            </p>
          </div>
        </details>
      </section>
      <div className="maintenance">
        <button onClick={onWash}>
          <Droplets size={19} />
          筆を洗う
        </button>
        <button onClick={onDry}>
          <Waves size={19} />
          乾燥させる
        </button>
      </div>
    </>
  );
}
