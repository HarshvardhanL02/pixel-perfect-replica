// Browser-only (Leaflet). Load via LazyMap, never import statically from a route.
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

export interface MapPoint {
  id: string;
  coords: LatLng;
  kind: "report" | "hospital" | "bloodbank" | "destination";
  title: string;
  detail?: string;
}

const colors: Record<MapPoint["kind"], string> = {
  report: "#e5484d",
  hospital: "#2bb5a8",
  bloodbank: "#3e7bfa",
  destination: "#f5a524",
};

export default function MapView({ points, route, height = 480 }: { points: MapPoint[]; route?: LatLng[]; height?: number }) {
  return (
    <MapContainer center={[30.37, 78.09]} zoom={11} style={{ height, width: "100%", borderRadius: 12 }} scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {route && <Polyline positions={route} pathOptions={{ color: "#2bb5a8", weight: 4, dashArray: "8 8" }} />}
      {points.map((p) => (
        <CircleMarker key={p.id + p.kind} center={p.coords} radius={p.kind === "report" ? 9 : 8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: colors[p.kind], fillOpacity: 0.95 }}>
          <Popup><strong>{p.title}</strong>{p.detail && <div>{p.detail}</div>}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export const legend = colors;
