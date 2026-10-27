import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Boxes, Cpu, FileWarning, LayoutDashboard, Map, Menu, Plane, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { checkHealth } from "@/lib/detection-api";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/map", label: "Live Emergency Map", icon: Map },
  { to: "/detection", label: "AI Detection", icon: Cpu },
  { to: "/reports", label: "Emergency Reports", icon: FileWarning },
  { to: "/inventory", label: "Medical Inventory", icon: Boxes },
  { to: "/delivery", label: "Delivery Planning", icon: Plane },
  { to: "/activity", label: "Activity Log", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role, setRole, reports } = useStore();
  const awaiting = reports.filter((r) => r.status === "Awaiting Review").length;

  useEffect(() => {
    let mounted = true;
    const test = async () => {
      const ok = await checkHealth();
      if (mounted) setBackendConnected(ok);
    };
    test();
    const interval = setInterval(test, 5000);
    const onUrlChanged = () => test();
    window.addEventListener("mediresq:api-url-changed", onUrlChanged);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("mediresq:api-url-changed", onUrlChanged);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-[1000] w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-lg font-bold leading-none">MediResQ</p>
            <p className="text-[11px] text-sidebar-muted">Emergency response</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-primary" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}>
                <Icon className="h-4 w-4" />{label}
                {to === "/reports" && awaiting > 0 && <span className="ml-auto rounded-full bg-critical px-2 text-[11px] font-bold text-destructive-foreground">{awaiting}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-sidebar-border p-4 text-xs text-sidebar-muted">
          Prototype · demo data only. Not for clinical use.
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-[999] bg-sidebar/70 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[500] flex items-center gap-3 border-b border-sidebar-border bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="chip bg-sidebar-accent text-sidebar-muted">
            <span className={`h-2 w-2 rounded-full ${backendConnected ? "bg-success" : "bg-warning"}`} />
            {backendConnected ? "Backend connected" : "Demo mode"}
          </span>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <label htmlFor="role" className="text-sidebar-muted">Demo role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as "Reviewer" | "Viewer")}
              className="rounded-lg border border-sidebar-border bg-sidebar px-2 py-1.5 text-sidebar-foreground">
              <option>Reviewer</option>
              <option>Viewer</option>
            </select>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
