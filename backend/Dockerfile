# Production Dockerfile for SIH MediResQ AI Backend
# Optimized for Cloud Deployment (Hugging Face Spaces / Cloud Run / Railway / VPS)

FROM python:3.10-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

# Install minimal OS dependencies for OpenCV and system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-optimized PyTorch and Torchvision first to minimize image size (~200MB vs ~2.5GB CUDA)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code and models
COPY . .

# Expose the application port (defaults to 7860 for Hugging Face or dynamically uses $PORT)
EXPOSE 7860

# Launch FastAPI with Uvicorn reading the dynamic PORT variable
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
