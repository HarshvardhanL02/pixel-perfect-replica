---
title: MediResQ AI Detection Backend
emoji: 🚁
colorFrom: blue
colorTo: red
sdk: gradio
sdk_version: 5.20.0
app_file: app.py
pinned: false
license: mit
---

# 🚁 MediResQ AI Detection Backend

Real-time multi-modal AI detection service supporting **RGB Aerial Survivor Detection**, **Thermal Evidence Detection**, and **Human Posture/Pose Estimation** for the MediResQ drone disaster response platform.

Hosted for free on **Hugging Face Spaces** with **ZeroGPU** hardware acceleration support.

---

## 📡 Live API Endpoints for MediResQ

When hosted on Hugging Face Spaces, this service exposes both an interactive Gradio Web UI and direct REST API endpoints with full CORS (`*`) enabled:

| Method | Endpoint | Description | Payload Format |
|---|---|---|---|
| `GET` | `/health` | Health status and loaded model inventory | None |
| `POST` | `/detect/rgb` | Aerial survivor detection in visible light | `multipart/form-data` with field `file` |
| `POST` | `/detect/thermal` | High-temperature body signature detection | `multipart/form-data` with field `file` |
| `POST` | `/detect/person` | Survivor detection with pose/posture heuristics | `multipart/form-data` with field `file` |

### Expected Output Format (JSON)
```json
{
  "success": true,
  "model": "C2A YOLO26n (Survivor RGB)",
  "image_width": 1920,
  "image_height": 1080,
  "inference_time_ms": 28.4,
  "detections": [
    {
      "label": "person",
      "confidence": 0.92,
      "x1": 420.5,
      "y1": 310.2,
      "x2": 580.0,
      "y2": 612.4,
      "bbox": [420.5, 310.2, 580.0, 612.4]
    }
  ]
}
```

---

## 📦 Model Weights & File Sizes

All model weights are stored in the `models/` directory:

| Model File | Purpose | Size | Hugging Face Limit |
|---|---|---|---|
| `models/c2a_yolo26n_best.pt` | Primary RGB Survivor Detector | ~6.24 MB | ✅ Well within 50 MB / 5 GB limit |
| `models/yolo26n-pose.pt` | Primary Keypoint & Pose Estimator | ~7.88 MB | ✅ Well within 50 MB / 5 GB limit |
| `models/yolov8n.pt` | Standard Person Detector Fallback | ~6.55 MB | ✅ Well within 50 MB / 5 GB limit |
| `models/yolo26m.pt` | Fallback General RGB Detector | ~44.26 MB | ✅ Well within 50 MB / 5 GB limit |

*Total repository model payload: ~64.9 MB (fits effortlessly within free Hugging Face git limits without large file restrictions).*

---

## 🚀 Free Deployment Guide: Hugging Face Spaces

### Step 1: Create a Free Hugging Face Space
1. Sign in or create a free account at [huggingface.co](https://huggingface.co).
2. Click your profile picture at top right and choose **New Space** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
3. Fill in:
   - **Space Name**: `mediresq-ai-backend` (or your preferred name)
   - **License**: `mit`
   - **Space SDK**: Select **Gradio**
   - **Gradio template**: Blank
   - **Space hardware**: Select **CPU basic (2 vCPU · 16 GB · Free)** OR **ZeroGPU (NVIDIA A100 / L4 · Free)**
4. Click **Create Space**.

---

### Step 2: Upload Files to the Space

You can upload either via the **Web UI** or via **Git CLI**.

#### Option A: Web UI Upload (Easiest, No Git required)
1. In your newly created Space, open the **Files** tab.
2. Click **Add file** -> **Upload files**.
3. Drag and drop the following files from your `backend/` directory:
   - `app.py`
   - `requirements.txt`
   - `README.md`
4. Commit the changes.
5. Create the `models/` folder:
   - Click **Add file** -> **Upload files**.
   - Upload the 4 `.pt` files (`c2a_yolo26n_best.pt`, `yolo26n-pose.pt`, `yolov8n.pt`, `yolo26m.pt`) into `models/`.
   - Commit changes.

#### Option B: Git CLI Upload
```bash
# 1. Clone your empty Hugging Face Space
git clone https://huggingface.co/spaces/<YOUR_USERNAME>/<YOUR_SPACE_NAME>
cd <YOUR_SPACE_NAME>

# 2. Copy the backend files from this workspace into the cloned repo:
# - app.py
# - requirements.txt
# - README.md
# - models/ (all 4 .pt files)

# 3. Commit and push
git add .
git commit -m "Deploy MediResQ AI Backend with ZeroGPU & FastAPI REST endpoints"
git push
```

---

### Step 3: Space Build & Launch
- Hugging Face will automatically install dependencies from `requirements.txt` and launch `app.py`.
- Status will transition from **Building** -> **Running**.
- Your public Space URL will be:
  ```
  https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space
  ```

---

## 🔗 Connecting MediResQ Website

Once your Hugging Face Space is **Running**:

1. Open your MediResQ frontend (`pixel-perfect-replica-main`).
2. Update the API URL in **one** of two ways:
   - **In UI**: Navigate to the **Detection** page in the web app, open settings/API configuration, and enter:
     ```
     https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space
     ```
   - **In `.env`**: Set:
     ```env
     VITE_DETECTION_API_URL=https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space
     ```
3. Test health status:
   ```bash
   curl https://<YOUR_USERNAME>-<YOUR_SPACE_NAME>.hf.space/health
   ```
   Should return:
   ```json
   {"status":"ok","service":"MediResQ Emergency AI Detection API","models":{...},"gpu_available":true}
   ```

---

## ⚡ ZeroGPU Notes & Limitations

1. **How ZeroGPU Works**:
   - ZeroGPU is a free Hugging Face feature providing dynamic NVIDIA A100 / L4 GPU slices during function execution.
   - Functions decorated with `@spaces.GPU` dynamically claim a GPU slice, execute CUDA inference, and immediately release it back to the free pool.
2. **Quota & Rate Limits**:
   - Free Hugging Face accounts receive a generous daily ZeroGPU compute quota. If quota runs out during heavy continuous testing, the Space automatically falls back to CPU without crashing.
3. **CPU vs ZeroGPU Performance**:
   - Since these YOLO nano models (`c2a_yolo26n_best.pt` at 6.2 MB) have only ~3M parameters, CPU inference on Hugging Face's free 2 vCPU 16GB tier takes only **20–35 milliseconds**.
   - ZeroGPU startup overhead can take 1–2 seconds to acquire a GPU slice. For single image queries, CPU is actually faster. ZeroGPU shines when processing higher resolutions or concurrent detection requests.

---

## 💻 Local Development

Local development is fully preserved:
```bat
run_server.bat
```
Launches the original FastAPI backend at `http://localhost:8000`.
Interactive Swagger API docs available at `http://localhost:8000/docs`.
