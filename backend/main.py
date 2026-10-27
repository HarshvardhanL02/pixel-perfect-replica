import sys
import os
import time
import math
import logging
import importlib.util
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sih_backend")

# Base directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
# Legacy local Windows paths as fallback
SIH_ROOT = os.path.dirname(BACKEND_DIR)
DEMO_ROOT = os.path.join(SIH_ROOT, "SIH_26177_DEMO_PROTOTYPE")

def resolve_path(env_var: str, relative_candidates: list, legacy_path: str) -> Optional[str]:
    """
    Resolves file paths in order of priority:
    1. Explicit environment variable
    2. Local deployment paths (e.g., inside ./models or ./perception)
    3. Legacy local workspace paths (D:\\SIH...)
    """
    env_val = os.environ.get(env_var)
    if env_val and os.path.exists(env_val):
        logger.info(f"Resolved {env_var} via env var: {env_val}")
        return env_val

    for rel in relative_candidates:
        candidate = os.path.join(BACKEND_DIR, rel)
        if os.path.exists(candidate):
            logger.info(f"Resolved {env_var} via local path: {candidate}")
            return candidate
        candidate_models = os.path.join(BACKEND_DIR, "models", rel)
        if os.path.exists(candidate_models):
            logger.info(f"Resolved {env_var} via models folder: {candidate_models}")
            return candidate_models

    if legacy_path and os.path.exists(legacy_path):
        logger.info(f"Resolved {env_var} via legacy path: {legacy_path}")
        return legacy_path

    logger.warning(f"Could not resolve path for {env_var}")
    return None

# Resolve Model Paths
RGB_MODEL_PATH = resolve_path(
    "RGB_MODEL_PATH",
    ["c2a_yolo26n_best.pt", "rgb_survivor.pt"],
    os.path.join(DEMO_ROOT, "models", "rgb_survivor", "c2a_yolo26n_best.pt")
)
RGB_FALLBACK_PATH = resolve_path(
    "RGB_FALLBACK_PATH",
    ["yolo26m.pt", "yolo26n.pt"],
    os.path.join(SIH_ROOT, "rgb_survivor", "yolo26m.pt")
)
POSE_MODEL_PATH = resolve_path(
    "POSE_MODEL_PATH",
    ["yolo26n-pose.pt", "yolov8n-pose.pt"],
    os.path.join(SIH_ROOT, "Human Pose Estimation", "yolo26n-pose.pt")
)
YOLO_PERSON_PATH = resolve_path(
    "YOLO_PERSON_PATH",
    ["yolov8n.pt", "yolo26n.pt"],
    os.path.join(DEMO_ROOT, "yolov8n.pt")
)

# Thermal Detector loader with self-contained fallback
thermal_detector_path = resolve_path(
    "THERMAL_DETECTOR_PATH",
    [os.path.join("perception", "thermal_detector.py"), "thermal_detector.py"],
    os.path.join(DEMO_ROOT, "perception", "thermal_detector.py")
)

ThermalDetector = None
if thermal_detector_path and os.path.exists(thermal_detector_path):
    try:
        spec = importlib.util.spec_from_file_location("thermal_detector", thermal_detector_path)
        thermal_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(thermal_module)
        ThermalDetector = thermal_module.ThermalDetector
        logger.info(f"Loaded ThermalDetector module from {thermal_detector_path}")
    except Exception as e:
        logger.warning(f"Failed to load external ThermalDetector: {e}")

# Self-contained ThermalDetector fallback for portable cloud/docker deployments
if ThermalDetector is None:
    logger.info("Using built-in ThermalDetector class")
    class ThermalDetector:
        def __init__(self, config=None):
            self.config = config or {}
            self.intensity_thresh = self.config.get('model', {}).get('prototype', {}).get('intensity_threshold', 180)
            self.min_area = self.config.get('model', {}).get('prototype', {}).get('min_area', 40)
            self.model_loaded = False
            
        def detect(self, image):
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
                        "confidence": thermal_score,
                        "timestamp": time.time(),
                        "source": "PROTOTYPE"
                    })
            return results_out

        def source_name(self):
            return "PROTOTYPE"

app = FastAPI(
    title="SIH Emergency AI Detection API",
    description="Real-time multi-modal inference backend for RGB, Thermal, and Person Pose detection.",
    version="1.0.0"
)

# CORS configuration supporting environment variable override
cors_env = os.environ.get("CORS_ORIGINS", "*")
if cors_env.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model holders
rgb_model = None
rgb_fallback = None
pose_model = None
yolo_person = None
thermal_detector = None

@app.on_event("startup")
def load_all_models():
    global rgb_model, rgb_fallback, pose_model, yolo_person, thermal_detector
    logger.info("Initializing SIH AI models...")
    
    # 1. RGB Survivor Model
    if RGB_MODEL_PATH and os.path.exists(RGB_MODEL_PATH):
        try:
            logger.info(f"Loading primary RGB model: {RGB_MODEL_PATH}")
            rgb_model = YOLO(RGB_MODEL_PATH)
        except Exception as e:
            logger.error(f"Failed to load primary RGB model: {e}")
    if RGB_FALLBACK_PATH and os.path.exists(RGB_FALLBACK_PATH):
        try:
            logger.info(f"Loading fallback RGB model: {RGB_FALLBACK_PATH}")
            rgb_fallback = YOLO(RGB_FALLBACK_PATH)
        except Exception as e:
            logger.error(f"Failed to load fallback RGB model: {e}")

    # 2. Person / Pose Model
    if POSE_MODEL_PATH and os.path.exists(POSE_MODEL_PATH):
        try:
            logger.info(f"Loading Pose model: {POSE_MODEL_PATH}")
            pose_model = YOLO(POSE_MODEL_PATH)
        except Exception as e:
            logger.error(f"Failed to load Pose model: {e}")
    if YOLO_PERSON_PATH and os.path.exists(YOLO_PERSON_PATH):
        try:
            logger.info(f"Loading standard Person detector: {YOLO_PERSON_PATH}")
            yolo_person = YOLO(YOLO_PERSON_PATH)
        except Exception as e:
            logger.error(f"Failed to load YOLO person model: {e}")

    # 3. Thermal Detector
    if ThermalDetector is not None:
        try:
            logger.info("Loading Thermal evidence detector...")
            thermal_detector = ThermalDetector({
                'model': {
                    'type': 'prototype',
                    'prototype': {'intensity_threshold': 180, 'min_area': 40}
                }
            })
            logger.info("Thermal evidence detector loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Thermal detector: {e}")

    logger.info("All models ready for inference.")

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

def decode_image(contents: bytes) -> np.ndarray:
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file or unsupported format. Please upload a valid JPG/PNG.")
    return img

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "SIH Emergency AI Detection API",
        "models": {
            "rgb": "C2A YOLO26n Survivor" if rgb_model else "Fallback",
            "thermal": "Thermal Evidence Detector" if thermal_detector else "Unavailable",
            "person": "YOLO26n-Pose / YOLOv8n" if (pose_model or yolo_person) else "Unavailable"
        }
    }

@app.post("/detect/rgb", response_model=DetectionResponse)
async def detect_rgb(file: UploadFile = File(...)):
    t0 = time.time()
    contents = await file.read()
    img = decode_image(contents)
    h, w = img.shape[:2]
    
    active_model_name = "C2A YOLO26n (Survivor RGB)"
    detections = []
    
    # Try primary C2A survivor model first
    if rgb_model is not None:
        results = rgb_model(img, conf=0.18, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = rgb_model.names.get(cls_id, "person") if hasattr(rgb_model, "names") else "person"
            detections.append(DetectionItem(
                label=label,
                confidence=round(conf, 3),
                x1=round(max(0, min(x1, w)), 1),
                y1=round(max(0, min(y1, h)), 1),
                x2=round(max(0, min(x2, w)), 1),
                y2=round(max(0, min(y2, h)), 1),
                bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
            ))
            
    # If 0 detections and general RGB model available, try fallback
    if len(detections) == 0 and rgb_fallback is not None:
        active_model_name = "YOLO26m (General RGB)"
        results = rgb_fallback(img, conf=0.20, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            cls_id = int(box.cls[0])
            if cls_id == 0:  # person
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append(DetectionItem(
                    label="person",
                    confidence=round(conf, 3),
                    x1=round(max(0, min(x1, w)), 1),
                    y1=round(max(0, min(y1, h)), 1),
                    x2=round(max(0, min(x2, w)), 1),
                    y2=round(max(0, min(y2, h)), 1),
                    bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                ))
                
    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return DetectionResponse(
        success=True,
        model=active_model_name,
        image_width=w,
        image_height=h,
        inference_time_ms=elapsed_ms,
        detections=detections
    )

@app.post("/detect/thermal", response_model=DetectionResponse)
async def detect_thermal(file: UploadFile = File(...)):
    t0 = time.time()
    contents = await file.read()
    img = decode_image(contents)
    h, w = img.shape[:2]
    
    detections = []
    active_model_name = "Thermal Evidence Detector"
    
    if thermal_detector is not None:
        raw_dets = thermal_detector.detect(img)
        if len(raw_dets) == 0 and ThermalDetector is not None:
            sens_detector = ThermalDetector({
                'model': {'type': 'prototype', 'prototype': {'intensity_threshold': 150, 'min_area': 30}}
            })
            raw_dets = sens_detector.detect(img)
            
        for d in raw_dets:
            bx1, by1, bx2, by2 = d["bbox"]
            conf = float(d["confidence"])
            label = "warm body signature" if "thermal" in d.get("class", "").lower() else d.get("class", "thermal_person")
            detections.append(DetectionItem(
                label=label,
                confidence=round(conf, 3),
                x1=round(max(0, min(bx1, w)), 1),
                y1=round(max(0, min(by1, h)), 1),
                x2=round(max(0, min(bx2, w)), 1),
                y2=round(max(0, min(by2, h)), 1),
                bbox=[round(bx1, 1), round(by1, 1), round(bx2, 1), round(by2, 1)]
            ))
            
    if len(detections) == 0 and yolo_person is not None:
        active_model_name = "YOLO Person (Thermal Assist)"
        results = yolo_person(img, conf=0.15, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            if int(box.cls[0]) == 0:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append(DetectionItem(
                    label="thermal person signature",
                    confidence=round(conf, 3),
                    x1=round(max(0, min(x1, w)), 1),
                    y1=round(max(0, min(y1, h)), 1),
                    x2=round(max(0, min(x2, w)), 1),
                    y2=round(max(0, min(y2, h)), 1),
                    bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                ))

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return DetectionResponse(
        success=True,
        model=active_model_name,
        image_width=w,
        image_height=h,
        inference_time_ms=elapsed_ms,
        detections=detections
    )

@app.post("/detect/person", response_model=DetectionResponse)
async def detect_person(file: UploadFile = File(...)):
    t0 = time.time()
    contents = await file.read()
    img = decode_image(contents)
    h, w = img.shape[:2]
    
    active_model_name = "YOLO26n-Pose (Keypoint & Pose Estimator)"
    detections = []
    
    if pose_model is not None:
        results = pose_model(img, conf=0.18, verbose=False)
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
            
            label = f"person ({posture})" if posture != "unknown" else "person"
            detections.append(DetectionItem(
                label=label,
                confidence=round(conf, 3),
                x1=round(max(0, min(x1, w)), 1),
                y1=round(max(0, min(y1, h)), 1),
                x2=round(max(0, min(x2, w)), 1),
                y2=round(max(0, min(y2, h)), 1),
                bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
            ))
            
    if len(detections) == 0 and yolo_person is not None:
        active_model_name = "YOLOv8n (Person Detector)"
        results = yolo_person(img, conf=0.15, verbose=False)
        boxes = results[0].boxes if len(results) > 0 else []
        for box in boxes:
            if int(box.cls[0]) == 0:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append(DetectionItem(
                    label="person",
                    confidence=round(conf, 3),
                    x1=round(max(0, min(x1, w)), 1),
                    y1=round(max(0, min(y1, h)), 1),
                    x2=round(max(0, min(x2, w)), 1),
                    y2=round(max(0, min(y2, h)), 1),
                    bbox=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                ))
                
    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return DetectionResponse(
        success=True,
        model=active_model_name,
        image_width=w,
        image_height=h,
        inference_time_ms=elapsed_ms,
        detections=detections
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

