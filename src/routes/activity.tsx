import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileWarning, Link2, Plane } from "lucide-react";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { timeAgo, useStore } from "@/lib/store";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log · MediResQ" },
      { name: "description", content: "Timeline of reports, reviews, supply matches and simulated deliveries." },
      { property: "og:title", content: "MediResQ Activity Log" },
      { property: "og:description", content: "Audit timeline for the emergency response workflow." },
    ],
  }),
  component: ActivityPage,
});

const meta = {
  report: { icon: FileWarning, label: "Report received", tone: "bg-critical/15 text-critical" },
  review: { icon: CheckCircle2, label: "Reviewed", tone: "bg-info/15 text-info" },
  match: { icon: Link2, label: "Supply matched", tone: "bg-accent text-accent-foreground" },
  delivery: { icon: Plane, label: "Delivery simulated", tone: "bg-success/15 text-success" },
};

function ActivityPage() {
  const { activity } = useStore();
  const [t, setT] = useState<string>("all");
  const list = activity.filter((a) => t === "all" || a.type === t);
  return (
    <>
      <PageHeader title="Activity Log" />
      <div className="panel p-5">
        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => setT("all")} className={t === "all" ? "btn-primary" : "btn-outline"}>All</button>
          {Object.entries(meta).map(([k, m]) => <button key={k} onClick={() => setT(k)} className={t === k ? "btn-primary" : "btn-outline"}>{m.label}</button>)}
        </div>
        {list.length === 0 ? <EmptyState title="No activity yet" /> : (
          <ol className="relative ml-4 border-l border-border">
            {list.map((a) => {
              const m = meta[a.type];
              return (
                <li key={a.id} className="mb-5 ml-6">
                  <span className={`absolute -left-4 grid h-8 w-8 place-items-center rounded-full ring-4 ring-card ${m.tone}`}><m.icon className="h-4 w-4" /></span>
                  <p className="text-sm font-medium">{a.message}</p>
                  <p className="text-xs text-muted-foreground">{m.label} · {timeAgo(a.at)} · {new Date(a.at).toLocaleTimeString()}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
