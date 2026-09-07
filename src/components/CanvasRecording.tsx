import { useEffect, useRef, useState } from "react";
import { Circle, Download, Pause, Play, Square, Video } from "lucide-react";
import type { RefObject } from "react";
import type { Brush, Point } from "../types";
import { TOOL_NAMES } from "../types";
import { download } from "../engine/project";

interface Props {
  canvas: RefObject<HTMLCanvasElement | null>;
  pointer: RefObject<Point | null>;
  brush: Brush;
  name: string;
}

/** Records the live painting surface; no screenshots or reference images are substituted. */
export default function CanvasRecording({ canvas, pointer, brush, name }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "ready">("idle");
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState("下描き");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const clip = useRef<Blob | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef({ brush, name, note });
  latest.current = { brush, name, note };

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    const current = recorder.current;
    if (current && current.state !== "inactive") current.stop();
    current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  function start() {
    const source = canvas.current;
    if (!source) return;
    setError("");
    try {
      if (!window.MediaRecorder || !source.captureStream)
        throw new Error("このブラウザはキャンバス録画に対応していません。");
      const output = document.createElement("canvas");
      output.width = source.width;
      output.height = source.height + 96;
      const context = output.getContext("2d")!;
      let elapsed = 0, previousTick = performance.now(), previousSecond = 0;
      const frame = () => {
        const now = performance.now(), delta = now - previousTick;
        previousTick = now;
        if (recorder.current?.state === "paused") return;
        elapsed += delta;
        const current = canvas.current;
        if (!current) return;
        const { brush: active, name: title, note: stage } = latest.current;
        context.fillStyle = "#242722";
        context.fillRect(0, 0, output.width, output.height);
        context.font = '16px "Noto Sans JP Variable", sans-serif';
        context.fillStyle = "#ede5d5";
        context.fillText(title, 20, 30, output.width - 240);
        context.textAlign = "right";
        context.fillStyle = "#beaa7b";
        context.fillText("atelier / oil painting", output.width - 20, 30);
        context.textAlign = "left";
        const scale = Math.min(output.width / current.width, (output.height - 96) / current.height);
        const x = (output.width - current.width * scale) / 2;
        const y = 48 + (output.height - 96 - current.height * scale) / 2;
        context.drawImage(current, x, y, current.width * scale, current.height * scale);
        const p = pointer.current;
        if (p) {
          context.save();
          context.beginPath();
          context.rect(x, y, current.width * scale, current.height * scale);
          context.clip();
          context.beginPath();
          context.arc(x + p.x * scale, y + p.y * scale, Math.max(2, active.size * scale / 2), 0, Math.PI * 2);
          context.lineWidth = 1.5;
          context.strokeStyle = "rgba(255,255,255,.65)";
          context.stroke();
          context.lineWidth = .5;
          context.strokeStyle = "rgba(0,0,0,.65)";
          context.stroke();
          context.restore();
        }
        context.fillStyle = "#e9dfcc";
        context.font = '15px "Noto Sans JP Variable", sans-serif';
        context.fillText(stage, 20, output.height - 18, output.width * .58);
        context.textAlign = "right";
        context.fillStyle = "#b8bdb0";
        context.fillText(`${TOOL_NAMES[active.tool]}  /  ${active.size}px  /  ${active.color.toUpperCase()}`, output.width - 20, output.height - 18);
        context.textAlign = "left";
        const second = Math.floor(elapsed / 1000);
        if (second !== previousSecond) {
          previousSecond = second;
          setSeconds(second);
        }
      };
      const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((mime) => MediaRecorder.isTypeSupported(mime));
      if (!mimeType) throw new Error("録画形式を利用できません。");
      const stream = output.captureStream(24);
      const current = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        stream.getTracks().forEach((track) => track.stop());
        clip.current = new Blob(chunks, { type: current.mimeType });
        setState("ready");
      };
      current.onerror = () => {
        setError("録画でエラーが発生しました。保存できる範囲を動画として残します。");
        if (current.state !== "inactive") current.stop();
      };
      recorder.current = current;
      clip.current = null;
      setSeconds(0);
      current.start(1000);
      frame();
      timer.current = setInterval(frame, 1000 / 24);
      setState("recording");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "録画を開始できませんでした。");
    }
  }

  const active = state === "recording" || state === "paused";
  const time = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <aside className={`recording-panel ${active ? "is-recording" : ""}`} aria-label="制作の録画">
      <div className="recording-actions">
        {!active && <button className="secondary" onClick={start}><Video size={16} />制作を録画</button>}
        {active && <>
          <span className="recording-clock"><Circle size={9} fill={state === "recording" ? "#b65c4a" : "none"} />{time}</span>
          <button className="icon-button" aria-label={state === "paused" ? "録画を再開" : "録画を一時停止"} onClick={() => {
            if (state === "paused") { recorder.current?.resume(); setState("recording"); }
            else { recorder.current?.pause(); setState("paused"); }
          }}>{state === "paused" ? <Play size={16} /> : <Pause size={16} />}</button>
          <button className="secondary" onClick={() => recorder.current?.stop()}><Square size={13} />録画を終了</button>
        </>}
        {state === "ready" && <button className="secondary" onClick={() => {
          if (clip.current) download(clip.current, `${name || "無題の作品"}-制作記録.${clip.current.type.includes("mp4") ? "mp4" : "webm"}`);
        }}><Download size={15} />動画を保存</button>}
      </div>
      {active && <input aria-label="動画に表示する制作工程" value={note} maxLength={80} onChange={(event) => setNote(event.target.value)} />}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
