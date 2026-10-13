// Shared domain types. Mirror these as Pydantic models in a FastAPI backend later.
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type ReviewStatus = "Awaiting Review" | "Under Review" | "Verified" | "Dismissed";
export type DeliveryStatus = "Pending" | "Planned" | "In Transit (Simulated)" | "Delivered (Simulated)";
export type LatLng = [number, number];

export interface EmergencyReport {
  id: string;
  location: string;
  coords: LatLng;
  observations: string;
  receivedAt: string; // ISO
  priority: Priority;
  status: ReviewStatus;
  source: "Field call" | "Community app" | "Camera detection (simulated)" | "Responder";
}

export interface Facility {
  id: string;
  name: string;
  type: "Hospital" | "Blood Bank";
  coords: LatLng;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: "Blood" | "First Aid" | "Medicine";
  quantity: number;
  unit: string;
  storage: string;
  expiry: string; // ISO date
  facilityId: string;
}

export interface Delivery {
  id: string;
  reportId: string;
  itemId: string;
  quantity: number;
  status: DeliveryStatus;
  createdAt: string;
}

export interface Detection {
  id: string;
  camera: "RGB" | "Thermal";
  label: string;
  confidence: number;
  timestamp: string;
  location?: string;
  coords?: LatLng;
  box: { x: number; y: number; w: number; h: number }; // percentages
  image: string;
  note: string;
}

export interface ActivityEvent {
  id: string;
  type: "report" | "review" | "match" | "delivery";
  message: string;
  at: string;
}
