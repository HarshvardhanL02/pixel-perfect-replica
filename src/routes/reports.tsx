import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { timeAgo, useStore } from "@/lib/store";
import type { EmergencyReport, Priority, ReviewStatus } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Emergency Reports · MediResQ" },
      { name: "description", content: "Search, filter and human-review incoming emergency reports." },
      { property: "og:title", content: "MediResQ Emergency Reports" },
      { property: "og:description", content: "Report triage with a human-review step." },
    ],
  }),
  component: Reports,
});

const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
const STATUSES: ReviewStatus[] = ["Awaiting Review", "Under Review", "Verified", "Dismissed"];

function Reports() {
  const { reports, updateReport, role } = useStore();
  const [q, setQ] = useState("");
  const [p, setP] = useState<string>("All");
  const [s, setS] = useState<string>("All");
  const [formOpen, setFormOpen] = useState(false);
  const canEdit = role === "Reviewer";

  const rows = useMemo(() => reports.filter((r) =>
    (p === "All" || r.priority === p) && (s === "All" || r.status === s) &&
    `${r.id} ${r.location} ${r.observations}`.toLowerCase().includes(q.toLowerCase())), [reports, q, p, s]);

  return (
    <>
      <PageHeader title="Emergency Reports" subtitle="Priorities are provisional until verified by a human reviewer"
        actions={<button className="btn-primary" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />New demo report</button>} />
      <div className="panel">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="field pl-9" placeholder="Search ID, location, observations…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="field w-auto" value={p} onChange={(e) => setP(e.target.value)} aria-label="Priority filter">
            <option>All</option>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className="field w-auto" value={s} onChange={(e) => setS(e.target.value)} aria-label="Status filter">
            <option>All</option>{STATUSES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        {!canEdit && <p className="border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground">Viewer role: switch to Reviewer in the top bar to change status or priority.</p>}
        {rows.length === 0 ? <EmptyState title="No reports match" hint="Try clearing filters or search." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["ID", "Location", "Observations", "Received", "Priority", "Review status", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3">{r.location}<div className="text-xs text-muted-foreground">{r.source}</div></td>
                    <td className="max-w-xs px-4 py-3">{r.observations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{timeAgo(r.receivedAt)}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <select className="field py-1" value={r.priority} onChange={(e) => updateReport(r.id, { priority: e.target.value as Priority })} aria-label={`Priority for ${r.id}`}>
                          {PRIORITIES.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      ) : <PriorityBadge p={r.priority} />}
                    </td>
                    <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "Awaiting Review" && <button disabled={!canEdit} className="btn-outline px-2.5 py-1 text-xs" onClick={() => updateReport(r.id, { status: "Under Review" })}>Start review</button>}
                        {(r.status === "Awaiting Review" || r.status === "Under Review") && <>
                          <button disabled={!canEdit} className="btn-primary px-2.5 py-1 text-xs" onClick={() => { updateReport(r.id, { status: "Verified" }); toast.success(`${r.id} verified`); }}>Verify</button>
                          <button disabled={!canEdit} className="btn-ghost px-2.5 py-1 text-xs" onClick={() => updateReport(r.id, { status: "Dismissed" })}>Dismiss</button>
                        </>}
                        {(r.status === "Verified" || r.status === "Dismissed") && <button disabled={!canEdit} className="btn-ghost px-2.5 py-1 text-xs" onClick={() => updateReport(r.id, { status: "Under Review" })}>Reopen</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {formOpen && <ReportForm onClose={() => setFormOpen(false)} />}
    </>
  );
}

function ReportForm({ onClose }: { onClose: () => void }) {
  const { addReport } = useStore();
  const [f, setF] = useState({ location: "", observations: "", priority: "Medium" as Priority, source: "Field call" as EmergencyReport["source"], lat: "30.40", lng: "78.10" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(f.lat), lng = parseFloat(f.lng);
    if (!f.location.trim() || !f.observations.trim() || isNaN(lat) || isNaN(lng)) return toast.error("Fill in location, observations and valid coordinates.");
    addReport({ location: f.location.trim(), observations: f.observations.trim(), priority: f.priority, source: f.source, coords: [lat, lng] });
    toast.success("Demo report added — awaiting review");
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-sidebar/70 p-4" onClick={onClose}>
      <form className="panel w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New demo emergency report</h2><button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div><label className="label" htmlFor="loc">Location</label><input id="loc" className="field" maxLength={100} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><label className="label" htmlFor="obs">Symptoms / observations</label><textarea id="obs" rows={3} maxLength={400} className="field" value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="lat">Latitude</label><input id="lat" className="field" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} /></div>
          <div><label className="label" htmlFor="lng">Longitude</label><input id="lng" className="field" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} /></div>
          <div><label className="label" htmlFor="pr">Provisional priority</label><select id="pr" className="field" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label" htmlFor="src">Source</label><select id="src" className="field" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as EmergencyReport["source"] })}>{["Field call", "Community app", "Responder", "Camera detection (simulated)"].map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary">Submit report</button></div>
      </form>
    </div>
  );
}
