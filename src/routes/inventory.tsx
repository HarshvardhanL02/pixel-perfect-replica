import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { facilities } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Medical Inventory · MediResQ" },
      { name: "description", content: "Demo stock of blood units, first-aid kits and essential medicines." },
      { property: "og:title", content: "MediResQ Medical Inventory" },
      { property: "og:description", content: "Blood, first-aid and medicine stock by source facility." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const { inventory } = useStore();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const rows = inventory.filter((i) => (cat === "All" || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()));
  const days = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / 86400000);

  return (
    <>
      <PageHeader title="Medical Inventory" subtitle="Demo stock — not live hospital data" />
      <div className="panel">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="field pl-9" placeholder="Search supplies…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {["All", "Blood", "First Aid", "Medicine"].map((c) => <button key={c} onClick={() => setCat(c)} className={cat === c ? "btn-primary" : "btn-outline"}>{c}</button>)}
        </div>
        {rows.length === 0 ? <EmptyState title="No supplies found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Item", "Category", "Quantity", "Storage", "Expiry", "Source"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((i) => {
                  const d = days(i.expiry);
                  const low = i.quantity <= 5;
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3 font-semibold">{i.name}</td>
                      <td className="px-4 py-3"><span className="chip bg-accent text-accent-foreground">{i.category}</span></td>
                      <td className="px-4 py-3">{i.quantity} {i.unit} {low && <span className="chip ml-1 bg-critical/15 text-critical">Low</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.storage}</td>
                      <td className="px-4 py-3">{i.expiry} {d <= 10 && <span className="chip ml-1 bg-warning/20 text-[oklch(0.5_0.13_60)]">{d} d left</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{facilities.find((f) => f.id === i.facilityId)?.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
