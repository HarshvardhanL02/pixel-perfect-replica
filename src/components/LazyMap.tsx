import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { MapPoint } from "./MapView";
import type { LatLng } from "@/lib/types";

const MapView = lazy(() => import("./MapView"));

export type { MapPoint };

export function LazyMap(props: { points: MapPoint[]; route?: LatLng[]; height?: number }) {
  const fallback = <div className="animate-pulse rounded-xl bg-muted" style={{ height: props.height ?? 480 }} />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <MapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export const LEGEND = [
  { kind: "Distress report", color: "bg-critical" },
  { kind: "Hospital", color: "bg-primary" },
  { kind: "Blood bank", color: "bg-info" },
  { kind: "Delivery destination", color: "bg-warning" },
];
