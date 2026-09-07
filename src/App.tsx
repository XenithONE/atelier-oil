import { useEffect, useRef, useState } from "react";
import {
  Undo2,
  Redo2,
  FilePlus2,
  Save,
  CircleHelp,
  Pencil,
  Download,
  FolderOpen,
  Image,
  Brush as BrushIcon,
  Palette,
  X,
  Keyboard,
  Check,
  ArrowUpRight,
} from "lucide-react";
import ToolPanel from "./components/ToolPanel";
import ColorPanel from "./components/ColorPanel";
import PaintingCanvas from "./components/PaintingCanvas";
import StudioDialog from "./components/StudioDialog";
import { ToolIcon } from "./components/Controls";
import { OilEngine } from "./engine/OilEngine";
import {
  decodeProject,
  download,
  encodeProject,
  loadLocal,
  saveLocal,
} from "./engine/project";
import { paintStudy } from "./engine/demo";
import { DEFAULT_BRUSH, DEFAULT_PAPER, TOOL_NAMES } from "./types";
import type { Brush, DocumentMeta, Paper } from "./types";
import { colorName } from "./pigments";

export default function App() {
  const [engine] = useState(() => new OilEngine());
  const [brush, setBrush] = useState<Brush>({ ...DEFAULT_BRUSH }),
    [paper, setPaper] = useState<Paper>({ ...DEFAULT_PAPER }),
    [palette, setPalette] = useState(["#C49A43", "#266BB5", "#47713B"]),
    [name, setName] = useState("無題の作品");
  const [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("準備中"),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<"save" | "new" | "help" | null>(null),
    [panel, setPanel] = useState<"tools" | "colors" | null>(null);
  const [reference, setReference] = useState<string | null>(null),
    [position, setPosition] = useState(""),
    [newSize, setNewSize] = useState("960x720"),
    [newName, setNewName] = useState("無題の作品"),
    [busy, setBusy] = useState(false);
  const projectInput = useRef<HTMLInputElement>(null),
    referenceInput = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meta: DocumentMeta = { name, paper, brush, palette };
  const latest = useRef(meta);
  latest.current = meta;
  const commit = () => setRevision((v) => v + 1);
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4800);
  }
  function applyMeta(m: DocumentMeta) {
    setName(m.name);
    setBrush(m.brush);
    setPaper(m.paper);
    setPalette(m.palette);
    engine.setPaper(m.paper);
  }
  useEffect(() => {
    let active = true;
    loadLocal()
      .then(async (blob) => {
        if (blob) {
          const data = await decodeProject(blob);
          if (active) {
            engine.load(data.state);
            applyMeta(data.meta);
            setRevision((v) => v + 1);
          }
        }
      })
      .catch(() => {
        if (active)
          notify(
            "自動保存を読み込めませんでした。作品ファイルから再開できます。",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [engine]);
  useEffect(() => {
    engine.setPaper(paper);
  }, [engine, paper]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSaveStatus("保存中…");
    const timer = setTimeout(() => {
      const blob = encodeProject(engine, latest.current);
      saveLocal(blob)
        .then(() => {
          if (!cancelled) setSaveStatus("自動保存済み");
        })
        .catch(() => {
          if (!cancelled) setSaveStatus("自動保存できません");
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [engine, revision, name, brush, paper, palette, ready]);
  useEffect(() => {
    const flush = () => {
      if (ready) {
        engine.endStroke();
        void saveLocal(encodeProject(engine, latest.current)).catch(() => {});
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [engine, ready]);
  useEffect(
    () => () => {
      if (reference) URL.revokeObjectURL(reference);
    },
    [reference],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        !ready ||
        modal ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) engine.redo();
        else engine.undo();
        commit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        engine.redo();
        commit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setModal("save");
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "b") setBrush((v) => ({ ...v, tool: "flat" }));
      else if (k === "i") setBrush((v) => ({ ...v, tool: "picker" }));
      else if (k === "k") setBrush((v) => ({ ...v, tool: "knife" }));
      else if (k === "s") setBrush((v) => ({ ...v, tool: "smudge" }));
      else if (k === "[")
        setBrush((v) => ({ ...v, size: Math.max(1, v.size - 2) }));
      else if (k === "]")
        setBrush((v) => ({ ...v, size: Math.min(160, v.size + 2) }));
      else if (k === "?") setModal("help");
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [engine, modal, ready]);
  function updateBrush(patch: Partial<Brush>) {
    engine.endStroke();
    setBrush((v) => ({ ...v, ...patch }));
  }
  function pickColor(color: string) {
    setBrush((v) => ({
      ...v,
      color,
      tool: v.tool === "picker" ? "flat" : v.tool,
    }));
  }
  function saveProject() {
    engine.endStroke();
    download(
      encodeProject(engine, latest.current),
      `${name || "無題の作品"}.atelier`,
    );
    notify("編集できる作品ファイルを書き出しました。");
  }
  function savePNG() {
    engine.endStroke();
    const c = document.createElement("canvas");
    engine.renderTo(c);
    c.toBlob((blob) => {
      if (blob) {
        download(blob, `${name || "無題の作品"}.png`);
        notify("キャンバスの原寸でPNGを書き出しました。");
      } else notify("PNGの書き出しに失敗しました。もう一度お試しください。");
    }, "image/png");
  }
  async function openProject(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const data = await decodeProject(file);
      engine.load(data.state);
      applyMeta(data.meta);
      commit();
      setModal(null);
      notify("作品を開きました。厚みと濡れ具合も復元しました。");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "作品ファイルを開けませんでした。",
      );
    } finally {
      setBusy(false);
      if (projectInput.current) projectInput.current.value = "";
    }
  }
  async function openReference(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 20 * 1024 * 1024
    ) {
      notify("20MB以下のPNG・JPEG・WebP・GIF画像を選んでください。");
      return;
    }
    const url = URL.createObjectURL(file),
      img = new window.Image();
    img.onload = () => {
      setReference(url);
      setPanel(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      notify("参考画像を読み込めませんでした。");
    };
    img.src = url;
    if (referenceInput.current) referenceInput.current.value = "";
  }
  async function createNew(demo = false) {
    setBusy(true);
    // Let the progress state paint before the optional study is rendered.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const [width, height] = (demo ? "960x720" : newSize)
        .split("x")
        .map(Number);
      const clean = new OilEngine(width, height);
      engine.load(clean.snapshot());
      engine.setPaper(paper);
      if (demo) paintStudy(engine);
      setName(demo ? "風の通り道 — 油彩習作" : newName.trim() || "無題の作品");
      commit();
      setModal(null);
      notify(
        demo
          ? "同じ筆で描いた習作です。この上から描き足せます。"
          : "新しいキャンバスを用意しました。",
      );
    } catch {
      notify(
        "キャンバスを作成できませんでした。小さいサイズでお試しください。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="studio">
      <header className="topbar">
        <a
          href="https://xenithone.github.io/unfiled/"
          className="brand"
          aria-label="atelier・作品一覧へ"
        >
          <span>atelier</span>
          <small>油彩のアトリエ</small>
        </a>
        <label className="title-input">
          <input
            aria-label="作品名"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Pencil size={15} />
        </label>
        <div className="top-actions">
          <div className="history-actions">
            <button
              className="icon-button"
              aria-label="元に戻す"
              title="元に戻す (Ctrl+Z)"
              disabled={!ready || !engine.canUndo}
              onClick={() => {
                engine.undo();
                commit();
              }}
            >
              <Undo2 size={21} />
            </button>
            <button
              className="icon-button"
              aria-label="やり直す"
              title="やり直す (Ctrl+Shift+Z)"
              disabled={!ready || !engine.canRedo}
              onClick={() => {
                engine.redo();
                commit();
              }}
            >
              <Redo2 size={21} />
            </button>
          </div>
          <button
            className="secondary new-button"
            aria-label="新しい作品"
            disabled={!ready}
            onClick={() => setModal("new")}
          >
            <FilePlus2 size={19} />
            <span>新しい作品</span>
          </button>
          <button
            className="primary"
            aria-label="作品を保存"
            disabled={!ready}
            onClick={() => setModal("save")}
          >
            <Save size={19} />
            <span>作品を保存</span>
          </button>
          <button
            className="icon-button help-button"
            aria-label="使い方"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={22} />
          </button>
        </div>
      </header>
      <div className="studio-body">
        {panel && (
          <button
            className="drawer-backdrop"
            aria-label="パネルを閉じる"
            onClick={() => setPanel(null)}
          />
        )}
        <aside
          className={`sidebar left-sidebar ${panel === "tools" ? "drawer-open" : ""}`}
          aria-label="道具と筆の設定"
        >
          <button
            className="drawer-close icon-button"
            aria-label="道具パネルを閉じる"
            onClick={() => setPanel(null)}
          >
            <X size={19} />
          </button>
          <ToolPanel
            brush={brush}
            onChange={updateBrush}
            onWash={() => {
              engine.wash();
              notify("筆を洗いました。次のひと筆は選択中の色から始まります。");
            }}
            onDry={() => {
              engine.dry();
              commit();
              notify(
                "絵具を乾燥させました。下の色を引きずらずに重ねられます。",
              );
            }}
          />
        </aside>
        <PaintingCanvas
          engine={engine}
          brush={brush}
          revision={revision}
          onCommit={commit}
          onPick={pickColor}
          reference={reference}
          onCloseReference={() => setReference(null)}
          onPosition={setPosition}
          ready={ready}
        />
        <aside
          className={`sidebar right-sidebar ${panel === "colors" ? "drawer-open" : ""}`}
          aria-label="絵具とキャンバス設定"
        >
          <button
            className="drawer-close icon-button"
            aria-label="絵具パネルを閉じる"
            onClick={() => setPanel(null)}
          >
            <X size={19} />
          </button>
          <ColorPanel
            color={brush.color}
            palette={palette}
            paper={paper}
            onColor={pickColor}
            onPalette={setPalette}
            onPaper={setPaper}
            onReference={() => referenceInput.current?.click()}
          />
        </aside>
      </div>
      <nav className="mobile-tools" aria-label="制作パネル">
        <button
          aria-pressed={panel === "tools"}
          onClick={() => setPanel((p) => (p === "tools" ? null : "tools"))}
        >
          <BrushIcon size={19} />
          道具
        </button>
        <span>
          {TOOL_NAMES[brush.tool]} · {brush.size}px
        </span>
        <button
          aria-pressed={panel === "colors"}
          onClick={() => setPanel((p) => (p === "colors" ? null : "colors"))}
        >
          <Palette size={19} />
          絵具
        </button>
      </nav>
      <footer className="statusbar">
        <span
          className={`save-status ${saveStatus.includes("できません") ? "error" : ""}`}
          role="status"
        >
          <i />
          {saveStatus}
        </span>
        <span className="current-tool">
          <ToolIcon tool={brush.tool} size={18} />
          {TOOL_NAMES[brush.tool]} · {colorName(brush.color)}
        </span>
        <span className="canvas-size">
          {engine.width} × {engine.height} px
          {position && <small> / {position}</small>}
        </span>
        <span className="shortcut-hint">
          <Keyboard size={16} />B 筆 / I スポイト / Ctrl Z 元に戻す
        </span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            aria-label="通知を閉じる"
            className="icon-button"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <input
        className="sr-only"
        type="file"
        accept=".atelier"
        ref={projectInput}
        tabIndex={-1}
        aria-label="作品ファイルを選択"
        onChange={(e) => void openProject(e.target.files?.[0])}
      />
      <input
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        ref={referenceInput}
        tabIndex={-1}
        aria-label="参考画像を選択"
        onChange={(e) => void openReference(e.target.files?.[0])}
      />
      {modal === "save" && (
        <StudioDialog title="作品を保存" onClose={() => setModal(null)}>
          <p className="dialog-intro">ひと筆の重なりを、そのまま手元に。</p>
          <div className="export-options">
            <button onClick={savePNG}>
              <Image />
              <span>
                <strong>PNG画像を書き出す</strong>
                <small>
                  {engine.width} × {engine.height} px · 厚みの陰影を含む画像
                </small>
              </span>
              <Download size={19} />
            </button>
            <button onClick={saveProject}>
              <Save />
              <span>
                <strong>作品ファイルを保存</strong>
                <small>
                  .atelier · 色・厚み・濡れ具合を保存して、続きを描く
                </small>
              </span>
              <Download size={19} />
            </button>
            <button
              disabled={busy}
              onClick={() => projectInput.current?.click()}
            >
              <FolderOpen />
              <span>
                <strong>作品ファイルを開く</strong>
                <small>現在の作品を置き換えます。先に保存してください。</small>
              </span>
            </button>
          </div>
          <p className="muted small">
            制作中の作品はこのブラウザにも自動保存されます。大切な作品は作品ファイルとして保存してください。
          </p>
        </StudioDialog>
      )}
      {modal === "new" && (
        <StudioDialog
          title="新しい作品"
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <p className="dialog-intro">まっさらなキャンバスから、また一枚。</p>
          {engine.changed && (
            <p className="notice">
              今の作品は置き換わります。残しておく場合は
              <button className="text-button" onClick={saveProject}>
                作品ファイルを保存
              </button>
              してください。
            </p>
          )}
          <label className="field">
            作品名
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="field">
            キャンバスの大きさ
            <select
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
            >
              <option value="960x720">横長 · 960 × 720</option>
              <option value="720x960">縦長 · 720 × 960</option>
              <option value="960x960">正方形 · 960 × 960</option>
              <option value="1600x1200">大きな横長 · 1600 × 1200</option>
            </select>
          </label>
          <button
            className="primary full"
            disabled={busy}
            onClick={() => void createNew()}
          >
            <FilePlus2 size={18} />
            {busy ? "用意しています…" : "キャンバスを用意する"}
          </button>
          <div className="study-option">
            <span>描き味を試してみる</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void createNew(true)}
            >
              油彩の習作を開く
              <ArrowUpRight size={15} />
            </button>
          </div>
        </StudioDialog>
      )}
      {modal === "help" && (
        <StudioDialog title="アトリエの使い方" onClose={() => setModal(null)}>
          <p className="dialog-intro">絵具を選び、混ぜて、重ねる。</p>
          <ol className="help-steps">
            <li>
              <strong>筆と色を選ぶ</strong>
              <p>
                平筆は面、丸筆は細部、フィルバートは柔らかい輪郭。ナイフは盛り上がった絵具を広げます。ペンでは筆圧も使えます。
              </p>
            </li>
            <li>
              <strong>絵具を混ぜる</strong>
              <p>
                ＋で現在の色をパレットに置き、2色以上で「混ぜる」。2色のときは配合の割合も変えられます。キャンバスの濡れた色は筆が拾います。
              </p>
            </li>
            <li>
              <strong>描き味をつくる</strong>
              <p>
                絵具の量を増やすと厚塗りに。「筆の乾き」でかすれ、「オイル・希釈」で透ける薄塗り。「ぼかし」は濡れた色をなじませます。
              </p>
            </li>
            <li>
              <strong>乾かして、描き重ねる</strong>
              <p>
                「乾燥させる」で濡れた絵具が固定されます。乾燥とスクレーパーも元に戻せます。塗った色は次のひと筆で補充されます。
              </p>
            </li>
            <li>
              <strong>光を変えて保存する</strong>
              <p>
                「光と下地」で筆跡の陰影を調整。画像として残すならPNG、続きを描くなら作品ファイルを保存します。
              </p>
            </li>
          </ol>
          <div className="keyboard-guide">
            <h3>キーボードでも</h3>
            <p>
              <kbd>B</kbd> 平筆　<kbd>K</kbd> ナイフ　<kbd>S</kbd> ぼかし　
              <kbd>I</kbd> スポイト
            </p>
            <p>
              <kbd>[</kbd> <kbd>]</kbd> 筆の太さ　<kbd>Ctrl Z</kbd> 元に戻す
            </p>
            <p>
              <kbd>Space＋ドラッグ</kbd> 移動　<kbd>Alt＋クリック</kbd> 色を拾う
            </p>
            <p>
              キャンバスを選択し、矢印キーで筆を移動。<kbd>Enter</kbd>{" "}
              で描画開始・終了。<kbd>Shift</kbd>＋矢印で大きく移動します。
            </p>
          </div>
          <a
            className="text-button"
            href="https://github.com/XenithONE/atelier-oil"
            target="_blank"
            rel="noreferrer"
          >
            ソースコードと制作記録
            <ArrowUpRight size={15} />
          </a>
        </StudioDialog>
      )}
    </div>
  );
}
