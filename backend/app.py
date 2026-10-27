# Hugging Face ZeroGPU setup - MUST be imported before PyTorch / CUDA libraries
try:
    import spaces
except ImportError:
    class MockSpaces:
        @staticmethod
        def GPU(func=None, **kwargs):
            if func is None:
                return lambda f: f
            return func
    spaces = MockSpaces()

import sys
import os
import time
import math
import logging
from typing import List, Optional, Dict, Any

import cv2
import numpy as np
import torch
from fastapi import File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
import gradio as gr
from gradio.routes import App

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mediresq_backend")

if "spaces" in sys.modules and hasattr(spaces, "GPU"):
    logger.info("Hugging Face ZeroGPU environment active (@spaces.GPU enabled).")
else:
    logger.info("Running in standard/CPU environment (ZeroGPU decorator bypassed).")

# Base directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

def resolve_model(filename: str, legacy_path: Optional[str] = None) -> Optional[str]:
    """Resolve model file from models/ folder, local dir, env var, or legacy fallback."""
    env_key = filename.replace(".", "_").replace("-", "_").upper() + "_PATH"
    if os.environ.get(env_key) and os.path.exists(os.environ[env_key]):
        return os.environ[env_key]
    local_model = os.path.join(MODELS_DIR, filename)
    if os.path.exists(local_model):
        return local_model
    local_root = os.path.join(BACKEND_DIR, filename)
    if os.path.exists(local_root):
        return local_root
    if legacy_path and os.path.exists(legacy_path):
        return legacy_path
    return None

# Locate model files
RGB_MODEL_PATH = resolve_model("c2a_yolo26n_best.pt", r"D:\SIH\backend\models\c2a_yolo26n_best.pt")
RGB_FALLBACK_PATH = resolve_model("yolo26m.pt", r"D:\SIH\backend\models\yolo26m.pt")
POSE_MODEL_PATH = resolve_model("yolo26n-pose.pt", r"D:\SIH\backend\models\yolo26n-pose.pt")
YOLO_PERSON_PATH = resolve_model("yolov8n.pt", r"D:\SIH\backend\models\yolov8n.pt")

# Built-in lightweight ThermalDetector
class ThermalDetector:
    def __init__(self, config=None):
        self.config = config or {}
        self.intensity_thresh = self.config.get('model', {}).get('prototype', {}).get('intensity_threshold', 180)
        self.min_area = self.config.get('model', {}).get('prototype', {}).get('min_area', 40)
        
    def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        results_out = []
        if image is None:
            return results_out
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        _, thresh = cv2.threshold(normalized, self.intensity_thresh, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > self.min_area:
                x, y, w, h = cv2.boundingRect(cnt)
                roi = normalized[y:y+h, x:x+w]
                mean_val = cv2.mean(roi, mask=thresh[y:y+h, x:x+w])[0]
                thermal_score = min(mean_val / 255.0 + 0.1, 1.0)
                results_out.append({
                    "class": "thermal_person",
                    "bbox": [x, y, x+w, y+h],
                    "confidence": float(thermal_score)
                })
        return results_out

# Global model holders (Loaded ONCE at startup on CPU)
rgb_model: Optional[YOLO] = None
rgb_fallback: Optional[YOLO] = None
pose_model: Optional[YOLO] = None
yolo_person: Optional[YOLO] = None
thermal_detector: Optional[ThermalDetector] = None

def init_models():
    """Load models once into memory on CPU; moved to CUDA dynamically by ZeroGPU when called."""
    global rgb_model, rgb_fallback, pose_model, yolo_person, thermal_detector
    logger.info("Pre-loading AI models once into memory...")
    
    # 1. Primary RGB Survivor Model
    if RGB_MODEL_PATH and os.path.exists(RGB_MODEL_PATH):
        try:
            logger.info(f"Loading primary RGB model: {RGB_MODEL_PATH}")
            rgb_model = YOLO(RGB_MODEL_PATH)
        except Exception as e:
            logger.error(f"Failed to load primary RGB model: {e}")
            
    # Fallback RGB Model
    if RGB_FALLBACK_PATH and os.path.exists(RGB_FALLBACK_PATH):
        try:
            logger.info(f"Loading fallback RGB model: {RGB_FALLBACK_PATH}")
            rgb_fallback = YOLO(RGB_FALLBACK_PATH)
        except Exception as e:
            logger.error(f"Failed to load fallback RGB model: {e}")

    # 2. Pose & Keypoint Model
    if POSE_MODEL_PATH and os.path.exists(POSE_MODEL_PATH):
        try:
            logger.info(f"Loading Pose model: {POSE_MODEL_PATH}")
            pose_model = YOLO(POSE_MODEL_PATH)
        except Exception as e:
            logger.error(f"Failed to load Pose model: {e}")
            
    # Standard YOLO Person Detector
    if YOLO_PERSON_PATH and os.path.exists(YOLO_PERSON_PATH):
        try:
            logger.info(f"Loading standard Person model: {YOLO_PERSON_PATH}")
            yolo_person = YOLO(YOLO_PERSON_PATH)
        except Exception as e:
            logger.error(f"Failed to load YOLO person model: {e}")

    # 3. Thermal Evidence Detector
    thermal_detector = ThermalDetector()
    logger.info("All models loaded and ready.")

# Initialize models immediately on module load
init_models()

# Pydantic Schemas matching MediResQ DetectionApi contract
class DetectionItem(BaseModel):
    label: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float
    bbox: List[float]

class DetectionResponse(BaseModel):
    success: bool
    model: str
    image_width: int
    image_height: int
    inference_time_ms: float
    detections: List[DetectionItem]

def decode_image_bytes(contents: bytes) -> np.ndarray:
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file or unsupported format. Please upload JPG/PNG.")
    return img

def get_target_device() -> str:
    """Use CUDA only when available/allocated by ZeroGPU; otherwise CPU."""
    return "cuda" if torch.cuda.is_available() else "cpu"

# ----------------- Core Inference Functions with ZeroGPU Support -----------------

@spaces.GPU(duration=60)
def execute_rgb_detection(img: np.ndarray) -> Dict[str, Any]:
    t0 = time.time()
    h, w = img.shape[:2]
    device = get_target_device()
    active_model_name = "C2A YOLO26n (Survivor RGB)"
    detections: List[Dict[str, Any]] = []

    # 1. Primary C2A Survivor Model
    if rgb_model is not None:
        results = rgb_model(img, conf=0.18, device=device, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = rgb_model.names.get(cls_id, "person") if hasattr(rgb_model, "names") else "person"
            detections.append({
                "label": label,
                "confidence": round(conf, 3),
                "x1": round(max(0.0, min(float(x1), float(w))), 1),
                "y1": round(max(0.0, min(float(y1), float(h))), 1),
                "x2": round(max(0.0, min(float(x2), float(w))), 1),
                "y2": round(max(0.0, min(float(y2), float(h))), 1),
                "bbox": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)]
            })

    # 2. General RGB Fallback if 0 detections
    if len(detections) == 0 and rgb_fallback is not None:
        active_model_name = "YOLO26m (General RGB)"
        results = rgb_fallback(img, conf=0.20, device=device, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            cls_id = int(box.cls[0])
            if cls_id == 0:  # person class
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append({
                    "label": "person",
                    "confidence": round(conf, 3),
                    "x1": round(max(0.0, min(float(x1), float(w))), 1),
                    "y1": round(max(0.0, min(float(y1), float(h))), 1),
                    "x2": round(max(0.0, min(float(x2), float(w))), 1),
                    "y2": round(max(0.0, min(float(y2), float(h))), 1),
                    "bbox": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)]
                })

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return {
        "success": True,
        "model": active_model_name,
        "image_width": w,
        "image_height": h,
        "inference_time_ms": elapsed_ms,
        "detections": detections
    }

@spaces.GPU(duration=60)
def execute_thermal_detection(img: np.ndarray) -> Dict[str, Any]:
    t0 = time.time()
    h, w = img.shape[:2]
    device = get_target_device()
    active_model_name = "Thermal Evidence Detector"
    detections: List[Dict[str, Any]] = []

    # 1. Thermal Intensity / Contour analysis
    if thermal_detector is not None:
        raw_dets = thermal_detector.detect(img)
        if len(raw_dets) == 0:
            sensitive_detector = ThermalDetector({'model': {'prototype': {'intensity_threshold': 150, 'min_area': 30}}})
            raw_dets = sensitive_detector.detect(img)
            
        for d in raw_dets:
            bx1, by1, bx2, by2 = d["bbox"]
            conf = float(d["confidence"])
            detections.append({
                "label": "thermal body signature",
                "confidence": round(conf, 3),
                "x1": round(max(0.0, min(float(bx1), float(w))), 1),
                "y1": round(max(0.0, min(float(by1), float(h))), 1),
                "x2": round(max(0.0, min(float(bx2), float(w))), 1),
                "y2": round(max(0.0, min(float(by2), float(h))), 1),
                "bbox": [round(float(bx1), 1), round(float(by1), 1), round(float(bx2), 1), round(float(by2), 1)]
            })

    # 2. YOLO Assist if 0 thermal contours detected
    if len(detections) == 0 and yolo_person is not None:
        active_model_name = "YOLO Person (Thermal Assist)"
        results = yolo_person(img, conf=0.15, device=device, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            if int(box.cls[0]) == 0:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append({
                    "label": "thermal person signature",
                    "confidence": round(conf, 3),
                    "x1": round(max(0.0, min(float(x1), float(w))), 1),
                    "y1": round(max(0.0, min(float(y1), float(h))), 1),
                    "x2": round(max(0.0, min(float(x2), float(w))), 1),
                    "y2": round(max(0.0, min(float(y2), float(h))), 1),
                    "bbox": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)]
                })

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return {
        "success": True,
        "model": active_model_name,
        "image_width": w,
        "image_height": h,
        "inference_time_ms": elapsed_ms,
        "detections": detections
    }

@spaces.GPU(duration=60)
def execute_person_detection(img: np.ndarray) -> Dict[str, Any]:
    t0 = time.time()
    h, w = img.shape[:2]
    device = get_target_device()
    active_model_name = "YOLO26n-Pose (Keypoint & Pose Estimator)"
    detections: List[Dict[str, Any]] = []

    # 1. Pose Keypoint Estimator
    if pose_model is not None:
        results = pose_model(img, conf=0.18, device=device, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        keypoints = results[0].keypoints if (len(results) > 0 and hasattr(results[0], "keypoints")) else None

        for idx, box in enumerate(boxes):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            box_w = x2 - x1
            box_h = y2 - y1
            posture = "lying" if box_w > box_h * 1.1 else "standing/upright"

            if keypoints is not None and idx < len(keypoints):
                kpts = keypoints[idx]
                if hasattr(kpts, "xy") and len(kpts.xy[0]) > 0:
                    pts = kpts.xy[0].cpu().numpy() if hasattr(kpts.xy[0], "cpu") else kpts.xy[0]
                    if len(pts) >= 17:
                        head_y = pts[0][1]
                        ankles_y = max(pts[15][1], pts[16][1])
                        ankles_x = (pts[15][0] + pts[16][0]) / 2 if (pts[15][0] > 0 and pts[16][0] > 0) else pts[0][0]
                        if ankles_y > 0 and head_y > 0:
                            dy = abs(ankles_y - head_y)
                            dx = abs(ankles_x - pts[0][0])
                            posture = "standing/upright" if dy > dx * 1.2 else "lying"

            label = f"person ({posture})"
            detections.append({
                "label": label,
                "confidence": round(conf, 3),
                "x1": round(max(0.0, min(float(x1), float(w))), 1),
                "y1": round(max(0.0, min(float(y1), float(h))), 1),
                "x2": round(max(0.0, min(float(x2), float(w))), 1),
                "y2": round(max(0.0, min(float(y2), float(h))), 1),
                "bbox": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)]
            })

    # 2. Standard Person Detector Fallback
    if len(detections) == 0 and yolo_person is not None:
        active_model_name = "YOLOv8n (Person Detector)"
        results = yolo_person(img, conf=0.15, device=device, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            if int(box.cls[0]) == 0:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append({
                    "label": "person",
                    "confidence": round(conf, 3),
                    "x1": round(max(0.0, min(float(x1), float(w))), 1),
                    "y1": round(max(0.0, min(float(y1), float(h))), 1),
                    "x2": round(max(0.0, min(float(x2), float(w))), 1),
                    "y2": round(max(0.0, min(float(y2), float(h))), 1),
                    "bbox": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)]
                })

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return {
        "success": True,
        "model": active_model_name,
        "image_width": w,
        "image_height": h,
        "inference_time_ms": elapsed_ms,
        "detections": detections
    }

# ----------------- Visual Annotation Helper for Gradio UI -----------------

def annotate_image(img_bgr: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    annotated = img_bgr.copy()
    h, w = annotated.shape[:2]
    for d in detections:
        x1 = int(max(0, min(d["x1"], w)))
        y1 = int(max(0, min(d["y1"], h)))
        x2 = int(max(0, min(d["x2"], w)))
        y2 = int(max(0, min(d["y2"], h)))
        label = d.get("label", "detection")
        conf = d.get("confidence", 0.0)
        text = f"{label} {conf:.2f}"
        
        if "lying" in label.lower():
            color = (0, 0, 255)  # BGR Red
        elif "thermal" in label.lower() or "warm" in label.lower():
            color = (0, 140, 255)  # BGR Orange
        else:
            color = (0, 220, 50)  # BGR Green

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(annotated, text, (x1 + 3, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    return annotated

def gradio_predict(input_img: Optional[np.ndarray], mode: str):
    if input_img is None:
        return None, {"error": "Please upload an image."}
    
    img_bgr = cv2.cvtColor(input_img, cv2.COLOR_RGB2BGR)
    
    if mode == "rgb":
        data = execute_rgb_detection(img_bgr)
    elif mode == "thermal":
        data = execute_thermal_detection(img_bgr)
    else:
        data = execute_person_detection(img_bgr)
        
    annotated_bgr = annotate_image(img_bgr, data["detections"])
    annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
    return annotated_rgb, data

# ZeroGPU requires registered Gradio component callbacks to be decorated with @spaces.GPU
@spaces.GPU(duration=60)
def predict_rgb_gradio(input_img: Optional[np.ndarray]):
    return gradio_predict(input_img, "rgb")

@spaces.GPU(duration=60)
def predict_thermal_gradio(input_img: Optional[np.ndarray]):
    return gradio_predict(input_img, "thermal")

@spaces.GPU(duration=60)
def predict_person_gradio(input_img: Optional[np.ndarray]):
    return gradio_predict(input_img, "person")

# ----------------- Gradio UI Definition -----------------

with gr.Blocks(title="MediResQ AI Detection Platform") as demo:
    gr.Markdown(
        """
        # 🚁 MediResQ AI Detection Backend
        ### Real-Time Aerial Survivor, Thermal Signature & Human Pose Estimation
        *Public online endpoint serving the **MediResQ** Drone Disaster Response System.*
        
        **REST API Base URL:** Mounts all routes (`/health`, `/detect/rgb`, `/detect/thermal`, `/detect/person`) directly for external HTTP fetch.
        """
    )
    
    with gr.Tabs():
        with gr.TabItem("Visible Light (RGB) Survivor"):
            with gr.Row():
                with gr.Column():
                    rgb_in = gr.Image(type="numpy", label="Upload Aerial RGB Image")
                    rgb_btn = gr.Button("Detect Survivors", variant="primary")
                with gr.Column():
                    rgb_out_img = gr.Image(type="numpy", label="Detections Visualized")
                    rgb_out_json = gr.JSON(label="Structured Response")
            rgb_btn.click(fn=predict_rgb_gradio, inputs=rgb_in, outputs=[rgb_out_img, rgb_out_json])

        with gr.TabItem("Thermal Signature"):
            with gr.Row():
                with gr.Column():
                    th_in = gr.Image(type="numpy", label="Upload Thermal Drone Image")
                    th_btn = gr.Button("Detect Thermal Signatures", variant="primary")
                with gr.Column():
                    th_out_img = gr.Image(type="numpy", label="Thermal Signatures Visualized")
                    th_out_json = gr.JSON(label="Structured Response")
            th_btn.click(fn=predict_thermal_gradio, inputs=th_in, outputs=[th_out_img, th_out_json])

        with gr.TabItem("Person & Pose Estimation"):
            with gr.Row():
                with gr.Column():
                    pose_in = gr.Image(type="numpy", label="Upload Disaster Scene Image")
                    pose_btn = gr.Button("Estimate Posture & Pose", variant="primary")
                with gr.Column():
                    pose_out_img = gr.Image(type="numpy", label="Keypoint & Posture Visualized")
                    pose_out_json = gr.JSON(label="Structured Response")
            pose_btn.click(fn=predict_person_gradio, inputs=pose_in, outputs=[pose_out_img, pose_out_json])

        with gr.TabItem("API Documentation & Status"):
            gr.Markdown(
                """
                ### Direct REST Endpoints for MediResQ Frontend
                | Endpoint | Method | Format | Purpose |
                |---|---|---|---|
                | `/health` | `GET` | JSON | Server status and loaded model inventory |
                | `/detect/rgb` | `POST` | `multipart/form-data` (`file`) | Visible light survivor detection |
                | `/detect/thermal` | `POST` | `multipart/form-data` (`file`) | Thermal body heat signature detection |
                | `/detect/person` | `POST` | `multipart/form-data` (`file`) | Posture ('lying' vs 'standing') & person detection |

                **CORS is enabled for all origins (`*`)** so web applications hosted on Vercel, Netlify, or localhost can directly query this Space.
                """
            )

# ----------------- Direct REST Endpoints Attached via Gradio App -----------------
# Create Gradio App instance and register custom REST routes

app = App()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "MediResQ Emergency AI Detection API",
        "models": {
            "rgb": "C2A YOLO26n Survivor" if rgb_model else "Fallback",
            "thermal": "Thermal Evidence Detector" if thermal_detector else "Unavailable",
            "person": "YOLO26n-Pose / YOLOv8n" if (pose_model or yolo_person) else "Unavailable"
        },
        "gpu_available": torch.cuda.is_available()
    }

@app.post("/detect/rgb", response_model=DetectionResponse)
async def detect_rgb_api(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_image_bytes(contents)
    result = execute_rgb_detection(img)
    return DetectionResponse(**result)

@app.post("/detect/thermal", response_model=DetectionResponse)
async def detect_thermal_api(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_image_bytes(contents)
    result = execute_thermal_detection(img)
    return DetectionResponse(**result)

@app.post("/detect/person", response_model=DetectionResponse)
async def detect_person_api(file: UploadFile = File(...)):
    contents = await file.read()
    img = decode_image_bytes(contents)
    result = execute_person_detection(img)
    return DetectionResponse(**result)

# Enable Gradio queue for ZeroGPU request pooling
demo.queue()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"Starting server on port {port}...")
    demo.launch(
        _app=app,
        ssr_mode=False,
        strict_cors=False,
        server_name="0.0.0.0",
        server_port=port
    )
