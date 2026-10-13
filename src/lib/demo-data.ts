// Fictional demo data only. No real patients, hospitals inventory or live detections.
import type { ActivityEvent, Delivery, Detection, EmergencyReport, Facility, InventoryItem } from "./types";
import rgbSample from "@/assets/rgb-sample.jpg";
import thermalSample from "@/assets/thermal-sample.jpg";

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export const facilities: Facility[] = [
  { id: "H-01", name: "Valley District Hospital (demo)", type: "Hospital", coords: [30.32, 78.03] },
  { id: "H-02", name: "Ridgeview Community Hospital (demo)", type: "Hospital", coords: [30.45, 78.08] },
  { id: "B-01", name: "Central Blood Bank (demo)", type: "Blood Bank", coords: [30.28, 77.98] },
  { id: "B-02", name: "Hillside Blood Centre (demo)", type: "Blood Bank", coords: [30.39, 78.18] },
];

export const initialReports: EmergencyReport[] = [
  { id: "ER-1042", location: "Kandoli ridge trail", coords: [30.41, 78.12], observations: "Hiker fell, suspected leg fracture, conscious", receivedAt: ago(12), priority: "High", status: "Awaiting Review", source: "Field call" },
  { id: "ER-1041", location: "Upper Sahastra village", coords: [30.37, 78.21], observations: "Elderly person, breathing difficulty reported by family", receivedAt: ago(34), priority: "Critical", status: "Under Review", source: "Community app" },
  { id: "ER-1040", location: "Forest sector 7", coords: [30.48, 78.0], observations: "Person-shaped heat signature, stationary (needs human verification)", receivedAt: ago(58), priority: "Medium", status: "Awaiting Review", source: "Camera detection (simulated)" },
  { id: "ER-1039", location: "Riverbank camp, Song river", coords: [30.3, 78.15], observations: "Minor burns from cooking fire, first aid needed", receivedAt: ago(95), priority: "Low", status: "Verified", source: "Responder" },
  { id: "ER-1038", location: "Maldevta road km 14", coords: [30.34, 78.11], observations: "Road accident, blood loss, O+ requested", receivedAt: ago(140), priority: "Critical", status: "Verified", source: "Responder" },
  { id: "ER-1037", location: "Thano school", coords: [30.26, 78.19], observations: "Child with high fever, medicine shortage", receivedAt: ago(220), priority: "Medium", status: "Dismissed", source: "Community app" },
];

export const initialInventory: InventoryItem[] = [
  { id: "INV-01", name: "Blood O+", category: "Blood", quantity: 18, unit: "units", storage: "2–6 °C refrigerated", expiry: inDays(21), facilityId: "B-01" },
  { id: "INV-02", name: "Blood O−", category: "Blood", quantity: 6, unit: "units", storage: "2–6 °C refrigerated", expiry: inDays(9), facilityId: "B-01" },
  { id: "INV-03", name: "Blood A+", category: "Blood", quantity: 11, unit: "units", storage: "2–6 °C refrigerated", expiry: inDays(28), facilityId: "B-02" },
  { id: "INV-04", name: "Blood B+", category: "Blood", quantity: 3, unit: "units", storage: "2–6 °C refrigerated", expiry: inDays(5), facilityId: "B-02" },
  { id: "INV-05", name: "Trauma first-aid kit", category: "First Aid", quantity: 24, unit: "kits", storage: "Room temperature", expiry: inDays(400), facilityId: "H-01" },
  { id: "INV-06", name: "Burn care kit", category: "First Aid", quantity: 9, unit: "kits", storage: "Room temperature", expiry: inDays(300), facilityId: "H-02" },
  { id: "INV-07", name: "Paracetamol 500mg", category: "Medicine", quantity: 600, unit: "tablets", storage: "Below 25 °C, dry", expiry: inDays(240), facilityId: "H-01" },
  { id: "INV-08", name: "Oral rehydration salts", category: "Medicine", quantity: 150, unit: "sachets", storage: "Below 30 °C", expiry: inDays(365), facilityId: "H-02" },
  { id: "INV-09", name: "Salbutamol inhaler", category: "Medicine", quantity: 14, unit: "inhalers", storage: "Below 30 °C", expiry: inDays(180), facilityId: "H-01" },
];

export const initialDeliveries: Delivery[] = [
  { id: "DL-301", reportId: "ER-1038", itemId: "INV-01", quantity: 2, status: "In Transit (Simulated)", createdAt: ago(120) },
  { id: "DL-300", reportId: "ER-1039", itemId: "INV-06", quantity: 1, status: "Delivered (Simulated)", createdAt: ago(80) },
];

export const detections: Detection[] = [
  { id: "DET-RGB-01", camera: "RGB", label: "person (lying)", confidence: 0.87, timestamp: ago(61), location: "Forest sector 7", coords: [30.48, 78.0], box: { x: 41, y: 36, w: 9, h: 13 }, image: rgbSample, note: "Sample frame. Posture alone does not indicate a medical condition." },
  { id: "DET-TH-01", camera: "Thermal", label: "warm body signature", confidence: 0.92, timestamp: ago(58), location: "Forest sector 7", coords: [30.48, 78.0], box: { x: 43, y: 40, w: 7, h: 12 }, image: thermalSample, note: "Sample frame. Heat signature requires human confirmation." },
  { id: "DET-RGB-02", camera: "RGB", label: "person", confidence: 0.64, timestamp: ago(190), box: { x: 41, y: 36, w: 9, h: 13 }, image: rgbSample, note: "Low confidence, no GPS fix available." },
];

export const initialActivity: ActivityEvent[] = [
  { id: "A6", type: "report", message: "ER-1042 received via field call (Kandoli ridge trail)", at: ago(12) },
  { id: "A5", type: "review", message: "ER-1041 moved to Under Review by Dr. Demo", at: ago(30) },
  { id: "A4", type: "report", message: "ER-1040 created from simulated thermal detection", at: ago(58) },
  { id: "A3", type: "match", message: "2 units Blood O+ matched to ER-1038 from Central Blood Bank", at: ago(125) },
  { id: "A2", type: "delivery", message: "DL-301 moved to In Transit (Simulated)", at: ago(118) },
  { id: "A1", type: "delivery", message: "DL-300 marked Delivered (Simulated)", at: ago(60) },
];
