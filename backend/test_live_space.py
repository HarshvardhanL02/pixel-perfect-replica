import os
import sys
import json
import time
import requests

LIVE_URL = "https://infonitiate-mediresq-ai.hf.space"
RGB_SAMPLE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "assets", "rgb-sample.jpg"))
THERMAL_SAMPLE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "assets", "thermal-sample.jpg"))

print("=" * 70)
print(f"VERIFYING LIVE HUGGING FACE SPACE: {LIVE_URL}")
print("=" * 70)

# 1. Health check
print("\n[1] Testing GET /health...")
t0 = time.time()
r_health = requests.get(f"{LIVE_URL}/health", timeout=60)
elapsed_health = round((time.time() - t0) * 1000, 2)
print(f"Status Code: {r_health.status_code}")
print(f"Response Time: {elapsed_health} ms")
print(f"Response Body: {r_health.text}")

# 2. CORS Preflight & Headers
print("\n[2] Testing CORS Options & Request Headers...")
cors_headers = {
    "Origin": "https://mediresq-frontend.lovable.app",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type"
}
r_options = requests.options(f"{LIVE_URL}/detect/rgb", headers=cors_headers, timeout=30)
print(f"OPTIONS Status Code: {r_options.status_code}")
print("OPTIONS Response Headers:")
for k in ["access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers", "access-control-allow-credentials"]:
    print(f"  {k}: {r_options.headers.get(k)}")

r_health_cors = requests.get(f"{LIVE_URL}/health", headers={"Origin": "http://localhost:5173"}, timeout=30)
print(f"GET with Origin: http://localhost:5173 -> access-control-allow-origin: {r_health_cors.headers.get('access-control-allow-origin')}")

# 3. RGB Detection Endpoint
print("\n[3] Testing POST /detect/rgb...")
if os.path.exists(RGB_SAMPLE):
    with open(RGB_SAMPLE, "rb") as f:
        file_bytes = f.read()
    print(f"Using image: {RGB_SAMPLE} ({len(file_bytes)} bytes)")
    t0 = time.time()
    r_rgb = requests.post(
        f"{LIVE_URL}/detect/rgb",
        files={"file": ("rgb-sample.jpg", file_bytes, "image/jpeg")},
        headers={"Origin": "http://localhost:5173"},
        timeout=120
    )
    elapsed_rgb = round((time.time() - t0) * 1000, 2)
    print(f"Status Code: {r_rgb.status_code}")
    print(f"Total Roundtrip: {elapsed_rgb} ms")
    print(f"CORS Origin in response: {r_rgb.headers.get('access-control-allow-origin')}")
    try:
        rgb_data = r_rgb.json()
        print("Response JSON:")
        print(json.dumps(rgb_data, indent=2))
    except Exception as e:
        print(f"Failed to parse JSON: {e}, text: {r_rgb.text[:500]}")
else:
    print(f"ERROR: {RGB_SAMPLE} not found!")

# 4. Thermal Detection Endpoint
print("\n[4] Testing POST /detect/thermal...")
if os.path.exists(THERMAL_SAMPLE):
    with open(THERMAL_SAMPLE, "rb") as f:
        file_bytes = f.read()
    print(f"Using image: {THERMAL_SAMPLE} ({len(file_bytes)} bytes)")
    t0 = time.time()
    r_thermal = requests.post(
        f"{LIVE_URL}/detect/thermal",
        files={"file": ("thermal-sample.jpg", file_bytes, "image/jpeg")},
        headers={"Origin": "http://localhost:5173"},
        timeout=120
    )
    elapsed_thermal = round((time.time() - t0) * 1000, 2)
    print(f"Status Code: {r_thermal.status_code}")
    print(f"Total Roundtrip: {elapsed_thermal} ms")
    print(f"CORS Origin in response: {r_thermal.headers.get('access-control-allow-origin')}")
    try:
        thermal_data = r_thermal.json()
        print("Response JSON:")
        print(json.dumps(thermal_data, indent=2))
    except Exception as e:
        print(f"Failed to parse JSON: {e}, text: {r_thermal.text[:500]}")
else:
    print(f"ERROR: {THERMAL_SAMPLE} not found!")

# 5. Person Detection Endpoint
print("\n[5] Testing POST /detect/person...")
if os.path.exists(RGB_SAMPLE):
    with open(RGB_SAMPLE, "rb") as f:
        file_bytes = f.read()
    print(f"Using image: {RGB_SAMPLE} ({len(file_bytes)} bytes)")
    t0 = time.time()
    r_person = requests.post(
        f"{LIVE_URL}/detect/person",
        files={"file": ("rgb-sample.jpg", file_bytes, "image/jpeg")},
        headers={"Origin": "http://localhost:5173"},
        timeout=120
    )
    elapsed_person = round((time.time() - t0) * 1000, 2)
    print(f"Status Code: {r_person.status_code}")
    print(f"Total Roundtrip: {elapsed_person} ms")
    print(f"CORS Origin in response: {r_person.headers.get('access-control-allow-origin')}")
    try:
        person_data = r_person.json()
        print("Response JSON:")
        print(json.dumps(person_data, indent=2))
    except Exception as e:
        print(f"Failed to parse JSON: {e}, text: {r_person.text[:500]}")
else:
    print(f"ERROR: {RGB_SAMPLE} not found!")

print("\n" + "=" * 70)
print("TEST SUMMARY COMPLETE")
print("=" * 70)
