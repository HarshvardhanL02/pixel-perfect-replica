import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Navigation, Plane } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LazyMap, type MapPoint } from "@/components/LazyMap";
import { DeliveryBadge, EmptyState, PageHeader } from "@/components/ui-bits";
import { facilities } from "@/lib/demo-data";
import { isDroneNavConfigured, openDroneNavAI } from "@/lib/drone-nav";
import { DELIVERY_FLOW, useStore } from "@/lib/store";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Planning · MediResQ" },
      {
        name: "description",
        content: "Match supplies to verified requests and simulate drone delivery routes.",
      },
      { property: "og:title", content: "MediResQ Delivery Planning" },
      {
        property: "og:description",
        content: "Simulated drone delivery planning for remote areas.",
      },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const { reports, inventory, deliveries, createDelivery, advanceDelivery, role } = useStore();
  const eligible = reports.filter((r) => r.status === "Verified" || r.status === "Under Review");
  const [reportId, setReportId] = useState(eligible[0]?.id ?? "");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<string | null>(deliveries[0]?.id ?? null);

  const sel = deliveries.find((d) => d.id === selected);
  const preview = sel
    ? {
        report: reports.find((r) => r.id === sel.reportId),
        item: inventory.find((i) => i.id === sel.itemId),
      }
    : {
        report: reports.find((r) => r.id === reportId),
        item: inventory.find((i) => i.id === itemId),
      };
  const origin = facilities.find((f) => f.id === preview.item?.facilityId);
  const route: [number, number][] | undefined =
    origin && preview.report ? [origin.coords, preview.report.coords] : undefined;
  const points: MapPoint[] = [
    ...(origin
      ? [
          {
            id: origin.id,
            coords: origin.coords,
            kind: origin.type === "Hospital" ? ("hospital" as const) : ("bloodbank" as const),
            title: origin.name,
            detail: "Origin",
          },
        ]
      : []),
    ...(preview.report
      ? [
          {
            id: preview.report.id,
            coords: preview.report.coords,
            kind: "destination" as const,
            title: preview.report.id,
            detail: preview.report.location,
          },
        ]
      : []),
  ];
  const km = origin && preview.report ? haversine(origin.coords, preview.report.coords) : 0;
  const item = inventory.find((i) => i.id === itemId);

  const plan = (): void => {
    if (!reportId || !item) {
      toast.error("Select a request and a supply.");
      return;
    }
    if (qty < 1 || qty > item.quantity) {
      toast.error(`Quantity must be 1–${item.quantity}.`);
      return;
    }
    const id = createDelivery(reportId, itemId, qty);
    setSelected(id);
    toast.success(`${id} created (Pending)`);
  };

  return (
    <>
      <PageHeader
        title="Delivery Planning"
        subtitle="Simulation only — no real drone hardware is controlled"
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div className="panel space-y-4 p-5">
            <h2 className="font-bold">Plan a delivery</h2>
            {eligible.length === 0 ? (
              <EmptyState title="No reviewed requests" hint="Verify a report first." />
            ) : (
              <>
                <div>
                  <label className="label" htmlFor="req">
                    Emergency request
                  </label>
                  <select
                    id="req"
                    className="field"
                    value={reportId}
                    onChange={(e) => {
                      setReportId(e.target.value);
                      setSelected(null);
                    }}
                  >
                    {eligible.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {r.location} ({r.priority})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sup">
                    Available supply
                  </label>
                  <select
                    id="sup"
                    className="field"
                    value={itemId}
                    onChange={(e) => {
                      setItemId(e.target.value);
                      setSelected(null);
                      setQty(1);
                    }}
                  >
                    <option value="">Select supply…</option>
                    {inventory
                      .filter((i) => i.quantity > 0)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} — {i.quantity} {i.unit}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="qty">
                    Quantity
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    max={item?.quantity}
                    className="field"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={role !== "Reviewer"}
                  onClick={plan}
                >
                  Create delivery plan
                </button>
                {role !== "Reviewer" && (
                  <p className="text-xs text-muted-foreground">Reviewer role required.</p>
                )}
              </>
            )}
          </div>
          <DroneIllustration status={sel?.status} payload={preview.item?.name} />
          <DroneOperationsCard
            selectedDeliveryId={sel?.id ?? null}
            targetLocation={preview.report?.location ?? null}
          />
        </div>

        <div className="panel p-5 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Proposed route</h2>
              {route && (
                <span className="text-sm text-muted-foreground">
                  {origin?.name} → {preview.report?.location} · {km.toFixed(1)} km · ~
                  {Math.ceil((km / 60) * 60)} min at 60 km/h (est.)
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-xs font-semibold"
              onClick={() => openDroneNavAI()}
              title="Open Drone Nav AI"
            >
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Open Drone Nav AI
              <ArrowUpRight className="h-3 w-3 opacity-70" />
            </button>
          </div>
          <LazyMap points={points} route={route} height={400} />
          <h3 className="mb-2 mt-6 font-bold">Deliveries</h3>
          {deliveries.length === 0 ? (
            <EmptyState title="No deliveries yet" />
          ) : (
            <ul className="divide-y divide-border">
              {deliveries.map((d) => {
                const it = inventory.find((i) => i.id === d.itemId);
                const done = d.status === DELIVERY_FLOW[DELIVERY_FLOW.length - 1];
                return (
                  <li
                    key={d.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg px-2 py-3 text-sm ${selected === d.id ? "bg-accent" : ""}`}
                  >
                    <button
                      className="font-mono text-xs underline"
                      onClick={() => setSelected(d.id)}
                    >
                      {d.id}
                    </button>
                    <span className="flex-1">
                      {d.quantity} {it?.unit} {it?.name} → {d.reportId}
                    </span>
                    <DeliveryBadge s={d.status} />
                    <button
                      className="btn-outline px-2.5 py-1 text-xs"
                      disabled={done || role !== "Reviewer"}
                      onClick={() => {
                        advanceDelivery(d.id);
                        setSelected(d.id);
                      }}
                    >
                      {done ? (
                        "Complete"
                      ) : (
                        <>
                          Advance <ChevronRight className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function DroneIllustration({
  status,
  payload,
}: {
  status?: string | undefined;
  payload?: string | undefined;
}) {
  const step = status ? DELIVERY_FLOW.indexOf(status as (typeof DELIVERY_FLOW)[number]) : -1;
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Drone & payload</h2>
        <span className="sim-badge">SIMULATED</span>
      </div>
      <div className="relative h-28 overflow-hidden rounded-lg bg-sidebar">
        <div className="absolute bottom-3 left-4 right-4 h-0.5 bg-sidebar-border" />
        <div
          className="absolute top-6 flex flex-col items-center text-primary transition-all duration-700"
          style={{ left: `${8 + Math.max(step, 0) * 26}%` }}
        >
          <Plane className="h-8 w-8 rotate-45" />
          <span className="mt-1 rounded bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {payload ?? "No payload"}
          </span>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-1 text-center text-[11px]">
        {DELIVERY_FLOW.map((s, i) => (
          <li
            key={s}
            className={`rounded px-1 py-1.5 ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {s.replace(" (Simulated)", "")}
          </li>
        ))}
      </ol>
    </div>
  );
}

function haversine([a, b]: [number, number], [c, d]: [number, number]) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

function DroneOperationsCard({
  selectedDeliveryId,
  targetLocation,
}: {
  selectedDeliveryId?: string | null;
  targetLocation?: string | null;
}) {
  const configured = isDroneNavConfigured();

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Drone Operations
        </span>
        <span
          className={`chip ${
            configured ? "bg-success/15 text-success" : "bg-warning/20 text-[oklch(0.5_0.13_60)]"
          }`}
        >
          {configured ? "Connected" : "Unconfigured"}
        </span>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Navigation className="h-4 w-4 text-primary" /> Drone Nav AI
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Plan and monitor autonomous drone navigation for emergency medical delivery missions.
        </p>
      </div>

      {selectedDeliveryId && (
        <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Mission target:</span>
            <span className="font-mono font-semibold text-primary">{selectedDeliveryId}</span>
          </div>
          {targetLocation && (
            <p className="truncate text-foreground/80">
              <span className="text-muted-foreground">Destination:</span> {targetLocation}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full justify-between"
        onClick={() => openDroneNavAI()}
      >
        <span className="flex items-center gap-2">
          <Plane className="h-4 w-4" />
          Open Drone Nav AI
        </span>
        <ArrowUpRight className="h-4 w-4 opacity-80" />
      </button>

      {!configured && (
        <p className="text-[11px] text-muted-foreground">
          Set <code className="font-mono text-xs">VITE_DRONE_NAV_AI_URL</code> to link your external
          mission planner.
        </p>
      )}
    </div>
  );
}
