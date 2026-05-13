# scan_server.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
from detector import detect_board

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/scan")
async def scan_board(
    image: UploadFile = File(...),
    grid_size: int = Form(...)
):
    # Lưu ảnh tạm
    suffix = os.path.splitext(image.filename)[1] if image.filename else ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await image.read())
        tmp_path = tmp.name

    try:
        result = detect_board(tmp_path, grid_size)
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.unlink(tmp_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)