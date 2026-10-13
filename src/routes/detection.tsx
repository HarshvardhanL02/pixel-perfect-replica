import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CheckCircle2, Flame, Info, Loader2, ScanSearch, Server, Upload, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { detections } from "@/lib/demo-data";
import { timeAgo } from "@/lib/store";
import {
  analyzeImage, checkHealth, DetectionApiError, getDefaultBaseUrl, loadBaseUrl, saveBaseUrl,
  type DetectionResult, type ModelKind,
} from "@/lib/detection-api";

export const Route = createFileRoute("/detection")({
  head: () => ({
    meta: [
      { title: "AI Detection · MediResQ" },
      { name: "description", content: "Test RGB, thermal and person-detection models through your FastAPI backend." },
      { property: "og:title", content: "MediResQ AI Detection" },
      { property: "og:description", content: "Run trained detection models on uploaded images with human review." },
    ],
  }),
  component: DetectionPage,
});

interface HistoryEntry { id: string; model: ModelKind; fileName: string; at: number; ok: boolean; count?: number; ms?: number | null; error?: string }

const MODELS: { kind: ModelKind; title: string; icon: ReactNode; desc: string }[] = [
  { kind: "rgb", title: "RGB camera", icon: <Camera className="h-5 w-5" />, desc: "Visible-light object detection" },
  { kind: "thermal", title: "Thermal camera", icon: <Flame className="h-5 w-5" />, desc: "Heat-signature detection" },
  { kind: "person", title: "Person detection", icon: <User className="h-5 w-5" />, desc: "Dedicated person detector" },
];

function DetectionPage() {
  const [baseUrl, setBaseUrl] = useState(getDefaultBaseUrl());
  const [draft, setDraft] = useState(baseUrl);
  const [health, setHealth] = useState<"unknown" | "ok" | "down">("unknown");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { const u = loadBaseUrl(); setBaseUrl(u); setDraft(u); }, []);

  const save = async () => {
    saveBaseUrl(draft);
    const u = draft.trim().replace(/\/+$/, "");
    setBaseUrl(u);
    setHealth("unknown");
    const ok = await checkHealth(u);
    setHealth(ok ? "ok" : "down");
    if (ok) toast.success("Backend reachable"); else toast.error("Backend /health not reachable");
  };

  const record = (e: HistoryEntry) => setHistory((h) => [e, ...h].slice(0, 30));

  return (
    <>
      <PageHeader title="AI Detection" subtitle="Camera observations to support — not replace — human review" />

      <div className="panel mb-6 space-y-3 p-5">
        <div className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /><h2 className="font-bold">Backend settings</h2>
          {health === "ok" && <span className="chip bg-accent text-accent-foreground"><CheckCircle2 className="h-3 w-3" />Reachable</span>}
          {health === "down" && <span className="chip bg-destructive/15 text-destructive"><AlertTriangle className="h-3 w-3" />Unreachable</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="FastAPI base URL" className="field min-w-64 flex-1" placeholder="http://localhost:8000" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn-primary" onClick={save}>Save & test</button>
        </div>
        <p className="text-xs text-muted-foreground">Images are sent to <code className="font-mono">POST {baseUrl || "<url>"}/detect/&#123;rgb|thermal|person&#125;</code> as form field <code className="font-mono">file</code>. Model weights and keys stay on your server.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {MODELS.map((m) => <ModelSection key={m.kind} {...m} baseUrl={baseUrl} onResult={record} />)}
        </div>
        <div className="panel h-fit p-5">
          <h2 className="mb-3 font-bold">Results history</h2>
          {history.length === 0 ? <EmptyState title="No analyses yet" hint="Upload an image in any section." /> : (
            <ul className="divide-y divide-border text-sm">
              {history.map((h) => (
                <li key={h.id} className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="chip bg-accent text-accent-foreground uppercase">{h.model}</span>
                    <span className="font-mono text-xs text-muted-foreground">{new Date(h.at).toLocaleTimeString()}</span>
                  </div>
                  <p className="truncate">{h.fileName}</p>
                  {h.ok
                    ? <p className="text-xs text-muted-foreground"><span className="font-semibold text-primary">REAL MODEL</span> · {h.count} detection(s){h.ms != null ? ` · ${Math.round(h.ms)} ms` : ""}</p>
                    : <p className="text-xs text-destructive">Failed: {h.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="mb-2 mt-10 font-bold">Simulated demo samples</h2>
      <div className="panel mb-4 flex gap-3 p-4 text-sm">
        <Info className="h-5 w-5 shrink-0 text-info" />
        <p>These are <strong>simulated samples</strong>, not model output. A detection indicates a possible person, not a diagnosis. Every detection must be verified by a human reviewer.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {detections.map((d) => (
          <div key={d.id} className="panel overflow-hidden">
            <div className="relative">
              <img src={d.image} alt={`${d.camera} sample frame`} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute border-2 border-primary" style={{ left: `${d.box.x}%`, top: `${d.box.y}%`, width: `${d.box.w}%`, height: `${d.box.h}%` }}>
                <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[11px] text-primary-foreground">{d.label} {(d.confidence * 100).toFixed(0)}%</span>
              </div>
              <span className="sim-badge absolute right-2 top-2 bg-card">SIMULATED</span>
            </div>
            <div className="space-y-1 p-4 text-sm">
              <div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{d.id}</span><span className="chip bg-accent text-accent-foreground">{d.camera}</span></div>
              <p><span className="text-muted-foreground">Time:</span> {timeAgo(d.timestamp)}</p>
              <p><span className="text-muted-foreground">Location:</span> {d.location ?? "Unavailable (no GPS fix)"}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ModelSection({ kind, title, icon, desc, baseUrl, onResult }: { kind: ModelKind; title: string; icon: ReactNode; desc: string; baseUrl: string; onResult: (e: HistoryEntry) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<DetectionApiError | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); setNatural(null);
  };

  const run = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await analyzeImage(baseUrl, kind, file);
      setResult(r);
      onResult({ id: crypto.randomUUID(), model: kind, fileName: file.name, at: Date.now(), ok: true, count: r.detections.length, ms: r.processingMs ?? r.roundTripMs });
    } catch (e) {
      const err = e instanceof DetectionApiError ? e : new DetectionApiError((e as Error).message, "Unexpected error.");
      setError(err);
      onResult({ id: crypto.randomUUID(), model: kind, fileName: file.name, at: Date.now(), ok: false, error: err.message });
    } finally { setLoading(false); }
  };

  const w = result?.imageWidth ?? natural?.w ?? 1;
  const h = result?.imageHeight ?? natural?.h ?? 1;
  const pct = (v: number, size: number) => (v <= 1 ? v * 100 : (v / size) * 100);

  return (
    <section className="panel p-5" aria-labelledby={`sec-${kind}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-primary">{icon}</span>
        <div className="flex-1"><h2 id={`sec-${kind}`} className="font-bold">{title}</h2><p className="text-xs text-muted-foreground">{desc}</p></div>
        <label className="btn-outline cursor-pointer"><Upload className="h-4 w-4" />Choose image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <button className="btn-primary" disabled={!file || loading} onClick={run}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}{loading ? "Analyzing…" : "Analyze Image"}
        </button>
      </div>

      {!preview ? <EmptyState title="No image selected" hint="Upload a test image for this model." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg bg-muted">
            <img src={preview} alt={`${title} test upload`} className="block w-full" onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {result?.detections.map((d, i) => d.box && (
              <div key={i} className="absolute border-2 border-primary" style={{ left: `${pct(d.box.x1, w)}%`, top: `${pct(d.box.y1, h)}%`, width: `${pct(d.box.x2 - d.box.x1, w)}%`, height: `${pct(d.box.y2 - d.box.y1, h)}%` }}>
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-primary px-1 font-mono text-[10px] text-primary-foreground">{d.label}{d.confidence != null ? ` ${(d.confidence * 100).toFixed(0)}%` : ""}</span>
              </div>
            ))}
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            {result && <span className="chip absolute right-2 top-2 bg-primary text-primary-foreground">REAL MODEL RESULT</span>}
          </div>

          <div className="min-w-0 space-y-3 text-sm">
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{error.message}</p>
                <p className="mt-1 text-muted-foreground">{error.hint}</p>
                <p className="mt-1 text-xs text-muted-foreground">No results are shown because the model did not respond.</p>
              </div>
            )}
            {result && <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {result.modelName && <span>Model: <strong className="text-foreground">{result.modelName}</strong></span>}
                <span>Processing: <strong className="text-foreground">{result.processingMs != null ? `${Math.round(result.processingMs)} ms` : "not reported"}</strong></span>
                <span>Round trip: {result.roundTripMs} ms</span>
              </div>
              {result.detections.length === 0 ? <p className="text-muted-foreground">The model returned no detections.</p> : (
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="py-1">Object</th><th>Confidence</th><th>Box</th></tr></thead>
                  <tbody>{result.detections.map((d, i) => (
                    <tr key={i} className="border-t border-border"><td className="py-1 font-medium">{d.label}</td>
                      <td>{d.confidence != null ? `${(d.confidence * 100).toFixed(1)}%` : "—"}</td>
                      <td className="font-mono">{d.box ? [d.box.x1, d.box.y1, d.box.x2, d.box.y2].map((v) => Math.round(v * 100) / 100).join(", ") : "—"}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <details><summary className="cursor-pointer text-xs font-semibold">Raw JSON response</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">{JSON.stringify(result.raw, null, 2)}</pre>
              </details>
            </>}
            {!result && !error && !loading && <p className="text-muted-foreground">Press Analyze Image to send this file to your model.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
