import type { ReactNode } from "react";
import type { DeliveryStatus, Priority, ReviewStatus } from "@/lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-sidebar-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const pri: Record<Priority, string> = {
  Critical: "bg-critical/15 text-critical",
  High: "bg-warning/20 text-[oklch(0.5_0.13_60)]",
  Medium: "bg-info/15 text-info",
  Low: "bg-muted text-muted-foreground",
};
export const PriorityBadge = ({ p }: { p: Priority }) => <span className={`chip ${pri[p]}`}>{p}</span>;

const st: Record<ReviewStatus, string> = {
  "Awaiting Review": "bg-warning/20 text-[oklch(0.5_0.13_60)]",
  "Under Review": "bg-info/15 text-info",
  Verified: "bg-success/15 text-success",
  Dismissed: "bg-muted text-muted-foreground",
};
export const StatusBadge = ({ s }: { s: ReviewStatus }) => <span className={`chip ${st[s]}`}>{s}</span>;

const dl: Record<DeliveryStatus, string> = {
  Pending: "bg-muted text-muted-foreground",
  Planned: "bg-info/15 text-info",
  "In Transit (Simulated)": "bg-accent text-accent-foreground",
  "Delivered (Simulated)": "bg-success/15 text-success",
};
export const DeliveryBadge = ({ s }: { s: DeliveryStatus }) => <span className={`chip ${dl[s]}`}>{s}</span>;

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="font-semibold text-card-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
