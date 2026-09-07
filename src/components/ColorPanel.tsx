import { useState } from "react";
import { ImagePlus, RotateCw, Eraser, ChevronDown, Plus } from "lucide-react";
import { Range, PaintMark } from "./Controls";
import { PIGMENTS, colorName } from "../pigments";
import { mixPalette } from "../engine/color";
import type { Paper } from "../types";
interface Props {
  color: string;
  palette: string[];
  paper: Paper;
  onColor: (v: string) => void;
  onPalette: (v: string[]) => void;
  onPaper: (v: Paper) => void;
  onReference: () => void;
}
export default function ColorPanel({
  color,
  palette,
  paper,
  onColor,
  onPalette,
  onPaper,
  onReference,
}: Props) {
  const [ratio, setRatio] = useState(50);
  const update = (patch: Partial<Paper>) => onPaper({ ...paper, ...patch });
  const mix = () => {
    if (palette.length < 2) return;
    const result = mixPalette(
      palette,
      palette.length === 2 ? [ratio, 100 - ratio] : undefined,
    );
    onColor(result);
    onPalette([result]);
  };
  return (
    <>
      <section>
        <h2>絵具</h2>
        <div className="pigment-grid">
          {PIGMENTS.map((p) => (
            <button
              className={`pigment ${color.toLowerCase() === p.hex.toLowerCase() ? "active" : ""}`}
              key={p.hex}
              aria-label={p.name}
              title={p.name}
              aria-pressed={color.toLowerCase() === p.hex.toLowerCase()}
              onClick={() => onColor(p.hex)}
            >
              <PaintMark color={p.hex} />
            </button>
          ))}
        </div>
        <div className="active-color">
          <label className="color-input" title="色を選ぶ">
            <input
              type="color"
              aria-label="任意の絵具の色"
              value={color}
              onChange={(e) => onColor(e.target.value)}
            />
          </label>
          <div>
            <span>{colorName(color)}</span>
            <input
              className="hex-input"
              aria-label="絵具のカラーコード"
              key={color}
              defaultValue={color.toUpperCase()}
              maxLength={7}
              onBlur={(e) => {
                if (/^#[\da-f]{6}$/i.test(e.target.value))
                  onColor(e.target.value);
                else e.target.value = color.toUpperCase();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </div>
        </div>
      </section>
      <section>
        <h2 className="heading-row">
          調色パレット
          <button
            className="icon-button"
            aria-label="現在の色をパレットに置く"
            title="現在の色をパレットに置く"
            disabled={palette.length >= 8}
            onClick={() => onPalette([...palette, color])}
          >
            <Plus size={17} />
          </button>
        </h2>
        <div className="mixing-board" aria-label="調色パレット">
          {palette.length ? (
            palette.map((p, i) => (
              <button
                key={`${i}-${p}`}
                title={`パレットの色 ${i + 1} を使う`}
                aria-label={`パレットの色 ${i + 1} を使う`}
                onClick={() => onColor(p)}
              >
                <PaintMark color={p} />
              </button>
            ))
          ) : (
            <span>＋ で絵具を置く</span>
          )}
        </div>
        {palette.length === 2 && (
          <Range
            label="左の絵具の割合"
            value={ratio}
            min={1}
            max={99}
            onChange={setRatio}
          />
        )}
        <div className="palette-actions">
          <button
            className="secondary"
            disabled={palette.length < 2}
            onClick={mix}
          >
            <RotateCw size={15} />
            混ぜる
          </button>
          <button
            className="secondary"
            disabled={!palette.length}
            onClick={() => onPalette([])}
          >
            <Eraser size={15} />
            パレットを拭く
          </button>
        </div>
      </section>
      <section>
        <h2>キャンバス</h2>
        <select
          aria-label="キャンバスの素材"
          value={paper.surface}
          onChange={(e) =>
            update({ surface: e.target.value as Paper["surface"] })
          }
        >
          <option value="linen">リネン</option>
          <option value="cotton">コットン</option>
          <option value="smooth">なめらかな板</option>
        </select>
        <Range
          label="テクスチャの強さ"
          value={paper.texture}
          onChange={(texture) => update({ texture })}
        />
        <details className="advanced">
          <summary>
            光と下地
            <ChevronDown size={14} />
          </summary>
          <div className="details-body">
            <Range
              label="厚みの見え方"
              value={paper.relief}
              onChange={(relief) => update({ relief })}
            />
            <Range
              label="光の方向"
              value={paper.light}
              max={360}
              unit="°"
              onChange={(light) => update({ light })}
            />
            <label className="ground-input">
              下地の色
              <input
                type="color"
                aria-label="下地の色"
                value={paper.ground}
                onChange={(e) => update({ ground: e.target.value })}
              />
            </label>
          </div>
        </details>
      </section>
      <button className="secondary full reference-button" onClick={onReference}>
        <ImagePlus size={17} />
        参考画像を開く
      </button>
    </>
  );
}
