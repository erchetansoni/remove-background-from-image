FROM python:3.12-slim

# System libs needed by opencv / onnxruntime / pillow at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache location for the rembg model (mounted as a volume in compose so it
# survives rebuilds and isn't re-downloaded).
ENV U2NET_HOME=/root/.u2net

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
