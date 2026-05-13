# Dùng base image Python 3.11
FROM python:3.11-slim

# Cài đặt Tesseract OCR và các thư viện hệ thống cần thiết
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy file requirements và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code và thư mục templates vào container
COPY . .

# Mở port
EXPOSE 8000

# Chạy server FastAPI, sử dụng biến môi trường PORT của server
CMD ["sh", "-c", "uvicorn scan_server:app --host 0.0.0.0 --port ${PORT:-8000}"]
