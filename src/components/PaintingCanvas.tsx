import { useEffect, useRef, useState } from "react";
import {
  Brush as BrushIcon,
  Minus,
  Plus,
  Maximize2,
  X,
  Hand,
} from "lucide-react";
import type { Brush, Point } from "../types";
import { OilEngine } from "../engine/OilEngine";
interface Props {
  engine: OilEngine;
  brush: Brush;
  revision: number;
  onCommit: () => void;
  onPick: (color: string) => void;
  reference: string | null;
  onCloseReference: () => void;
  onPosition: (p: string) => void;
  ready: boolean;
}
export default function PaintingCanvas({
  engine,
  brush,
  revision,
  onCommit,
  onPick,
  reference,
  onCloseReference,
  onPosition,
  ready,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    raf = useRef(0),
    drawing = useRef<number | null>(null),
    space = useRef(false),
    keyboardDraw = useRef(false),
    keyPoint = useRef<Point>({ x: 480, y: 360, pressure: 0.8 });
  const [area, setArea] = useState({ w: 800, h: 700 }),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [cursor, setCursor] = useState<{ x: number; y: number } | null>(null),
    [moving, setMoving] = useState(false);
  const panStart = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const fit = Math.max(
      0.05,
      Math.min(
        (area.w - (area.w < 600 ? 32 : 56)) / engine.width,
        (area.h - 118) / engine.height,
      ),
    ),
    scale = fit * zoom;
  const callbacks = useRef({ onCommit, onPick, onPosition, brush });
  callbacks.current = { onCommit, onPick, onPosition, brush };
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setArea({
        w: entries[0].contentRect.width,
        h: entries[0].contentRect.height,
      }),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const draw = () => {
      if (!raf.current)
        raf.current = requestAnimationFrame(() => {
          raf.current = 0;
          if (canvas.current) engine.renderTo(canvas.current);
        });
    };
    engine.onDirty = draw;
    draw();
    return () => {
      engine.onDirty = undefined;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [engine]);
  useEffect(() => {
    if (canvas.current) engine.renderTo(canvas.current);
  }, [revision, engine]);
  useEffect(() => {
    const end = () => {
      space.current = false;
      setMoving(false);
      if (drawing.current !== null || keyboardDraw.current) {
        engine.endStroke();
        drawing.current = null;
        keyboardDraw.current = false;
        callbacks.current.onCommit();
      }
    };
    window.addEventListener("blur", end);
    return () => window.removeEventListener("blur", end);
  }, [engine]);
  const point = (event: {
    clientX: number;
    clientY: number;
    pressure: number;
    pointerType: string;
  }): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: (event.clientX - r.left) / scale,
      y: (event.clientY - r.top) / scale,
      pressure:
        event.pointerType === "pen" ? Math.max(0.05, event.pressure) : 0.85,
    };
  };
  const finish = () => {
    if (drawing.current !== null) {
      engine.endStroke();
      drawing.current = null;
      onCommit();
    }
    panStart.current = null;
    setMoving(false);
  };
  return (
    <main
      className={`workbench ${moving ? "is-panning" : ""}`}
      ref={host}
      aria-label="制作スペース"
    >
      <div
        className="canvas-position"
        style={{
          width: engine.width * scale,
          height: engine.height * scale,
          left: area.w / 2 + pan.x,
          top: (area.h - 48) / 2 + pan.y,
        }}
      >
        <canvas
          ref={canvas}
          id="oil-canvas"
          tabIndex={0}
          role="application"
          aria-label="油彩キャンバス"
          aria-describedby="canvas-keyboard-help"
          style={{
            cursor: moving
              ? "grabbing"
              : brush.tool === "picker"
                ? "crosshair"
                : "none",
          }}
          onPointerDown={(e) => {
            if (!ready || e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            keyPoint.current = p;
            if (space.current) {
              panStart.current = {
                x: e.clientX,
                y: e.clientY,
                px: pan.x,
                py: pan.y,
              };
              setMoving(true);
              return;
            }
            if (brush.tool === "picker" || e.altKey) {
              onPick(engine.sample(p.x, p.y));
              return;
            }
            drawing.current = e.pointerId;
            engine.startStroke(p, brush);
          }}
          onPointerMove={(e) => {
            const r = host.current!.getBoundingClientRect();
            setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
            const p = point(e);
            onPosition(`${Math.round(p.x)}, ${Math.round(p.y)}`);
            if (panStart.current) {
              setPan({
                x: panStart.current.px + e.clientX - panStart.current.x,
                y: panStart.current.py + e.clientY - panStart.current.y,
              });
              return;
            }
            if (drawing.current !== e.pointerId) return;
            const native = e.nativeEvent;
            const points =
              typeof native.getCoalescedEvents === "function"
                ? native.getCoalescedEvents()
                : [];
            for (const event of points.length ? points : [native])
              engine.moveStroke(point(event));
          }}
          onPointerUp={(e) => {
            if (drawing.current === e.pointerId) engine.moveStroke(point(e));
            finish();
          }}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={(e) => {
            if (!ready) return;
            if (e.code === "Space") {
              space.current = true;
              setMoving(true);
              e.preventDefault();
              return;
            }
            if (e.key === "Escape") {
              keyboardDraw.current = false;
              engine.endStroke();
              onCommit();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              keyboardDraw.current = !keyboardDraw.current;
              if (keyboardDraw.current)
                engine.startStroke(keyPoint.current, brush);
              else {
                engine.endStroke();
                onCommit();
              }
              return;
            }
            const direction: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            if (direction[e.key]) {
              e.preventDefault();
              const [dx, dy] = direction[e.key],
                step = e.shiftKey ? 10 : 2;
              keyPoint.current = {
                ...keyPoint.current,
                x: Math.max(
                  0,
                  Math.min(engine.width - 1, keyPoint.current.x + dx * step),
                ),
                y: Math.max(
                  0,
                  Math.min(engine.height - 1, keyPoint.current.y + dy * step),
                ),
              };
              const p = keyPoint.current;
              setCursor({
                x:
                  area.w / 2 + pan.x - (engine.width * scale) / 2 + p.x * scale,
                y:
                  (area.h - 48) / 2 +
                  pan.y -
                  (engine.height * scale) / 2 +
                  p.y * scale,
              });
              onPosition(`${Math.round(p.x)}, ${Math.round(p.y)}`);
              if (keyboardDraw.current) engine.moveStroke(p);
            }
          }}
          onKeyUp={(e) => {
            if (e.code === "Space") {
              space.current = false;
              setMoving(false);
            }
          }}
          onBlur={() => {
            if (keyboardDraw.current) {
              keyboardDraw.current = false;
              engine.endStroke();
              onCommit();
            }
          }}
        />
        {!engine.changed && (
          <div className="canvas-invitation" aria-hidden="true">
            <BrushIcon />
            <h1>最初のひと筆を。</h1>
            <p>色を選んで、自由に描いてみましょう</p>
          </div>
        )}
      </div>
      {cursor && !moving && brush.tool !== "picker" && (
        <div
          className="brush-cursor"
          aria-hidden="true"
          style={{
            left: cursor.x,
            top: cursor.y,
            width: Math.max(4, brush.size * scale),
            height: Math.max(4, brush.size * scale),
          }}
        />
      )}
      {reference && (
        <aside className="reference-panel" aria-label="参考画像">
          <header>
            <span>参考画像</span>
            <button
              className="icon-button"
              aria-label="参考画像を閉じる"
              onClick={onCloseReference}
            >
              <X size={16} />
            </button>
          </header>
          <img src={reference} alt="読み込んだ参考画像" />
        </aside>
      )}
      <div className="zoom-bar">
        <button
          className="icon-button"
          aria-label="縮小"
          disabled={zoom <= 0.5}
          onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
        >
          <Minus size={17} />
        </button>
        <output aria-label="表示倍率">{Math.round(scale * 100)}%</output>
        <button
          className="icon-button"
          aria-label="拡大"
          disabled={zoom >= 5}
          onClick={() => setZoom((z) => Math.min(5, z * 1.25))}
        >
          <Plus size={17} />
        </button>
        <span className="bar-divider" />
        <button
          className="fit-button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize2 size={15} />
          全体
        </button>
      </div>
      {zoom > 1.05 && (
        <span className="pan-hint">
          <Hand size={13} />
          Space＋ドラッグで移動
        </span>
      )}
      <p id="canvas-keyboard-help" className="sr-only">
        ドラッグで描画。矢印キーで筆を移動、Enterで描画の開始と終了、Shiftと矢印で大きく移動。Spaceとドラッグでキャンバスを移動。Altとクリックで色を取得。
      </p>
    </main>
  );
}
