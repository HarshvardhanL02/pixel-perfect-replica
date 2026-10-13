// In-memory demo store. Swap these actions for calls in src/lib/api.ts when a FastAPI backend exists.
import { createContext, useContext, useState, type ReactNode } from "react";
import type { ActivityEvent, Delivery, DeliveryStatus, EmergencyReport, InventoryItem, Priority, ReviewStatus } from "./types";
import { initialActivity, initialDeliveries, initialInventory, initialReports } from "./demo-data";

export const DELIVERY_FLOW: DeliveryStatus[] = ["Pending", "Planned", "In Transit (Simulated)", "Delivered (Simulated)"];

interface Store {
  reports: EmergencyReport[];
  inventory: InventoryItem[];
  deliveries: Delivery[];
  activity: ActivityEvent[];
  role: "Reviewer" | "Viewer";
  setRole: (r: "Reviewer" | "Viewer") => void;
  addReport: (r: Omit<EmergencyReport, "id" | "receivedAt" | "status">) => void;
  updateReport: (id: string, patch: { status?: ReviewStatus; priority?: Priority }) => void;
  createDelivery: (reportId: string, itemId: string, quantity: number) => string;
  advanceDelivery: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 1043;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState(initialReports);
  const [inventory, setInventory] = useState(initialInventory);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [activity, setActivity] = useState(initialActivity);
  const [role, setRole] = useState<"Reviewer" | "Viewer">("Reviewer");

  const log = (type: ActivityEvent["type"], message: string) =>
    setActivity((a) => [{ id: crypto.randomUUID(), type, message, at: new Date().toISOString() }, ...a]);

  const store: Store = {
    reports, inventory, deliveries, activity, role, setRole,
    addReport: (r) => {
      const id = `ER-${seq++}`;
      setReports((x) => [{ ...r, id, receivedAt: new Date().toISOString(), status: "Awaiting Review" }, ...x]);
      log("report", `${id} received (${r.location}) – awaiting human review`);
    },
    updateReport: (id, patch) => {
      setReports((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      if (patch.status) log("review", `${id} status set to ${patch.status}`);
      if (patch.priority) log("review", `${id} provisional priority set to ${patch.priority}`);
    },
    createDelivery: (reportId, itemId, quantity) => {
      const id = `DL-${300 + deliveries.length + 1}`;
      setDeliveries((d) => [{ id, reportId, itemId, quantity, status: "Pending", createdAt: new Date().toISOString() }, ...d]);
      setInventory((inv) => inv.map((i) => (i.id === itemId ? { ...i, quantity: Math.max(0, i.quantity - quantity) } : i)));
      const item = inventory.find((i) => i.id === itemId);
      log("match", `${quantity} ${item?.unit} ${item?.name} matched to ${reportId} (${id})`);
      return id;
    },
    advanceDelivery: (id) => {
      const d = deliveries.find((x) => x.id === id);
      if (!d) return;
      const next = DELIVERY_FLOW[Math.min(DELIVERY_FLOW.indexOf(d.status) + 1, DELIVERY_FLOW.length - 1)];
      if (next === d.status) return;
      setDeliveries((all) => all.map((x) => (x.id === id ? { ...x, status: next } : x)));
      log("delivery", `${id} moved to ${next}`);
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};
