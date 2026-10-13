import { createFileRoute } from "@tanstack/react-router";
import { Info, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-bits";
import { detections } from "@/lib/demo-data";
import { api, backendConnected } from "@/lib/api";
import { timeAgo } from "@/lib/store";

export const Route = createFileRoute("/detection")({
  head: () => ({
    meta: [
      { title: "AI Detection · MediResQ" },
      { name: "description", content: "Simulated RGB and thermal person-detection previews, ready for a real model." },
      { property: "og:title", content: "MediResQ AI Detection" },
      { property: "og:description", content: "RGB and thermal detection panel with human review." },
    ],
  }),
  component: Detection,
});

function Detection() {
  const [filter, setFilter] = useState<"All" | "RGB" | "Thermal">("All");
  const list = detections.filter((d) => filter === "All" || d.camera === filter);

  const onUpload = async (file?: File) => {
    if (!file) return;
    if (!backendConnected) { toast.info("No detection model connected yet. Configure the FastAPI backend to run real inference."); return; }
    try { await api.detect(file, "rgb"); toast.success("Sent to model"); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="AI Detection" subtitle="Camera observations to support — not replace — human review"
        actions={
          <label className="btn-primary cursor-pointer"><Upload className="h-4 w-4" />Analyze image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        } />
      <div className="panel mb-6 flex gap-3 p-4 text-sm">
        <Info className="h-5 w-5 shrink-0 text-info" />
        <p>All detections below are <strong>simulated samples</strong>. A detection indicates a possible person, not a diagnosis. Every detection must be verified by a human reviewer before any priority is assigned.</p>
      </div>
      <div className="mb-4 flex gap-2">
        {(["All", "RGB", "Thermal"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? "btn-primary" : "btn-outline"}>{f}</button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {list.map((d) => (
          <div key={d.id} className="panel overflow-hidden">
            <div className="relative">
              <img src={d.image} alt={`${d.camera} sample frame`} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute border-2 border-primary" style={{ left: `${d.box.x}%`, top: `${d.box.y}%`, width: `${d.box.w}%`, height: `${d.box.h}%` }}>
                <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[11px] text-primary-foreground">{d.label} {(d.confidence * 100).toFixed(0)}%</span>
              </div>
              <span className="sim-badge absolute right-2 top-2 bg-card">SIMULATED</span>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
                <span className="chip bg-accent text-accent-foreground">{d.camera}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${d.confidence * 100}%` }} /></div>
              <p><span className="text-muted-foreground">Confidence:</span> {(d.confidence * 100).toFixed(1)}%</p>
              <p><span className="text-muted-foreground">Time:</span> {timeAgo(d.timestamp)}</p>
              <p><span className="text-muted-foreground">Location:</span> {d.location ?? "Unavailable (no GPS fix)"}</p>
              <p className="text-xs text-muted-foreground">{d.note}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
