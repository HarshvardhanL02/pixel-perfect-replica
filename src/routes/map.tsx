import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LazyMap, LEGEND, type MapPoint } from "@/components/LazyMap";
import { PageHeader } from "@/components/ui-bits";
import { facilities } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Emergency Map · MediResQ" },
      { name: "description", content: "Map of distress reports, hospitals, blood banks and proposed delivery destinations." },
      { property: "og:title", content: "MediResQ Emergency Map" },
      { property: "og:description", content: "OpenStreetMap view of reports and facilities." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { reports, deliveries } = useStore();
  const [show, setShow] = useState({ report: true, hospital: true, bloodbank: true, destination: true });
  const destIds = new Set(deliveries.filter((d) => !d.status.startsWith("Delivered")).map((d) => d.reportId));
  const points: MapPoint[] = [
    ...reports.filter((r) => r.status !== "Dismissed").map((r) => ({
      id: r.id, coords: r.coords, kind: destIds.has(r.id) ? ("destination" as const) : ("report" as const),
      title: `${r.id} · ${r.priority}`, detail: `${r.location} — ${r.observations}`,
    })),
    ...facilities.map((f) => ({ id: f.id, coords: f.coords, kind: f.type === "Hospital" ? ("hospital" as const) : ("bloodbank" as const), title: f.name, detail: f.type })),
  ].filter((p) => show[p.kind]);

  return (
    <>
      <PageHeader title="Live Emergency Map" subtitle="Demo locations · OpenStreetMap" />
      <div className="panel p-4">
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {LEGEND.map((l, i) => {
            const key = (["report", "hospital", "bloodbank", "destination"] as const)[i];
            return (
              <label key={l.kind} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={show[key]} onChange={(e) => setShow({ ...show, [key]: e.target.checked })} />
                <span className={`h-3 w-3 rounded-full ${l.color}`} />{l.kind}
              </label>
            );
          })}
        </div>
        <LazyMap points={points} height={560} />
      </div>
    </>
  );
}
