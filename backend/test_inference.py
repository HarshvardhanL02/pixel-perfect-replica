import os
import sys
import io
import cv2
import numpy as np
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, gradio_predict

client = TestClient(app)

def create_sample_image():
    """Create a sample synthetic test image with a drawn person-like shape."""
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Background gradient
    for y in range(480):
        img[y, :] = (int(50 + y * 0.1), int(80 + y * 0.1), int(120 + y * 0.1))
    # Draw a humanoid silhouette
    cv2.circle(img, (320, 160), 30, (220, 200, 180), -1)  # head
    cv2.rectangle(img, (290, 190), (350, 320), (180, 50, 50), -1)  # torso
    cv2.line(img, (300, 320), (290, 420), (50, 50, 180), 12)  # left leg
    cv2.line(img, (340, 320), (350, 420), (50, 50, 180), 12)  # right leg
    cv2.line(img, (290, 210), (250, 290), (180, 50, 50), 10)  # left arm
    cv2.line(img, (350, 210), (390, 290), (180, 50, 50), 10)  # right arm
    
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes(), img

def run_tests():
    print("=" * 60)
    print("RUNNING MEDIRESQ AI BACKEND VERIFICATION SUITE")
    print("=" * 60)
    
    # 1. Health Check
    print("[1/5] Testing GET /health...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    health_data = res.json()
    print("  Status code:", res.status_code)
    print("  Payload:", health_data)
    assert health_data["status"] == "ok"
    assert "models" in health_data
    print("  -> PASSED")

    img_bytes, img_raw = create_sample_image()

    # 2. RGB Detection Endpoint
    print("\n[2/5] Testing POST /detect/rgb...")
    res = client.post("/detect/rgb", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"RGB detect failed: {res.status_code} - {res.text}"
    data = res.json()
    print("  Status code:", res.status_code)
    print(f"  Model used: {data['model']}")
    print(f"  Inference time: {data['inference_time_ms']} ms")
    print(f"  Detections found: {len(data['detections'])}")
    assert data["success"] is True
    assert "image_width" in data and "image_height" in data
    print("  -> PASSED")

    # 3. Thermal Detection Endpoint
    print("\n[3/5] Testing POST /detect/thermal...")
    res = client.post("/detect/thermal", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Thermal detect failed: {res.status_code} - {res.text}"
    data = res.json()
    print("  Status code:", res.status_code)
    print(f"  Model used: {data['model']}")
    print(f"  Inference time: {data['inference_time_ms']} ms")
    print(f"  Detections found: {len(data['detections'])}")
    assert data["success"] is True
    print("  -> PASSED")

    # 4. Person & Pose Detection Endpoint
    print("\n[4/5] Testing POST /detect/person...")
    res = client.post("/detect/person", files={"file": ("test.jpg", img_bytes, "image/jpeg")})
    assert res.status_code == 200, f"Person detect failed: {res.status_code} - {res.text}"
    data = res.json()
    print("  Status code:", res.status_code)
    print(f"  Model used: {data['model']}")
    print(f"  Inference time: {data['inference_time_ms']} ms")
    print(f"  Detections found: {len(data['detections'])}")
    assert data["success"] is True
    print("  -> PASSED")

    # 5. Gradio UI Prediction Function
    print("\n[5/5] Testing Gradio visual prediction function...")
    rgb_converted = cv2.cvtColor(img_raw, cv2.COLOR_BGR2RGB)
    annotated, json_out = gradio_predict(rgb_converted, "rgb")
    assert annotated is not None
    assert isinstance(json_out, dict)
    assert json_out["success"] is True
    print(f"  Gradio output image shape: {annotated.shape}")
    print(f"  Gradio output model: {json_out['model']}")
    print("  -> PASSED")

    print("\n" + "=" * 60)
    print("ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
