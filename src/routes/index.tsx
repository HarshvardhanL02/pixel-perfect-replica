import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Boxes, Clock, FileWarning, Plane } from "lucide-react";
import { PageHeader, PriorityBadge, StatusBadge } from "@/components/ui-bits";
import { timeAgo, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · MediResQ" },
      { name: "description", content: "Emergency reports, priorities, supplies and pending deliveries at a glance." },
      { property: "og:title", content: "MediResQ Overview" },
      { property: "og:description", content: "Emergency response KPIs for hospitals, blood banks and responders." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { reports, inventory, deliveries, activity } = useStore();
  const kpis = [
    { label: "Total emergency reports", value: reports.length, icon: FileWarning, tone: "text-primary" },
    { label: "Awaiting review", value: reports.filter((r) => r.status === "Awaiting Review").length, icon: Clock, tone: "text-warning" },
    { label: "High-priority requests", value: reports.filter((r) => (r.priority === "Critical" || r.priority === "High") && r.status !== "Dismissed").length, icon: AlertTriangle, tone: "text-critical" },
    { label: "Supply lines available", value: inventory.filter((i) => i.quantity > 0).length, icon: Boxes, tone: "text-info" },
    { label: "Pending deliveries", value: deliveries.filter((d) => !d.status.startsWith("Delivered")).length, icon: Plane, tone: "text-success" },
  ];
  const queue = reports.filter((r) => r.status === "Awaiting Review" || r.status === "Under Review");
  return (
    <>
      <PageHeader title="Overview" subtitle="Situation summary across the demo response network" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="panel p-5">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-4 text-3xl font-extrabold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Review queue</h2>
            <Link to="/reports" className="text-sm font-semibold text-accent-foreground">View all →</Link>
          </div>
          {queue.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Queue is clear.</p> : (
            <ul className="divide-y divide-border">
              {queue.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                  <span className="min-w-0 flex-1 truncate">{r.location} — {r.observations}</span>
                  <PriorityBadge p={r.priority} /><StatusBadge s={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel p-5">
          <h2 className="mb-3 font-bold">Latest activity</h2>
          <ul className="space-y-3">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="text-sm"><p>{a.message}</p><p className="text-xs text-muted-foreground">{timeAgo(a.at)}</p></li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
