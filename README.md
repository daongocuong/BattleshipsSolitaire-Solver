# 🚢 Battleships Solitaire — Solver & Creator

> Giải và tạo đề Battleships Solitaire tự động — kết hợp Backtracking, ILP và AI scan ảnh

🌐 **Demo:** [daongocuong.github.io/BattleshipsSolitaire-Solver](https://daongocuong.github.io/BattleshipsSolitaire-Solver)

---

## Giới thiệu

Battleships Solitaire (hay Bimaru) là dạng câu đố logic: đặt hạm đội tàu vào lưới sao cho khớp với số đếm ở đầu mỗi hàng và cột. Project này cung cấp ba chức năng chính:

- **Giải tự động** với 2 engine: Backtracking (offline) và ILP/GLPK (cần mạng)
- **Tạo đề** bằng tay hoặc ngẫu nhiên, có thể chọn ô gợi ý (given)
- **Scan ảnh** để nhận diện đề trực tiếp từ ảnh chụp màn hình

---

## Tính năng

| | |
|---|---|
| 🔍 | Giải tự động bằng Backtracking — chạy hoàn toàn offline |
| ⚡ | Giải bằng ILP/GLPK — chính xác, hiệu quả hơn với đề lớn |
| ✏️ | Tạo đề thủ công hoặc đặt tàu ngẫu nhiên |
| 🎯 | Chọn ô gợi ý (given) linh hoạt theo slider |
| 📸 | Scan đề từ ảnh chụp màn hình bằng Ctrl+V |
| 🔎 | Thu phóng bảng tùy ý |
| 📐 | Hỗ trợ bảng từ 5×5 đến 26×26 |

---

## Cấu trúc dự án

```
BattleshipsSolitaire-Solver/
├── index.html          # Giao diện chính
├── ui.js               # Logic giao diện
├── style.css           # CSS
├── solver_bt.js        # Solver Backtracking
├── solver_ilp.js       # Solver ILP (GLPK.js)
├── templates/          # Ảnh mẫu
│   └── example.png
├── backend/            # Backend phục vụ tính năng scan
│   ├── scan_server.py  # FastAPI server
│   ├── detector.py     # Nhận diện ảnh (OpenCV + Tesseract)
│   ├── requirements.txt
│   └── Dockerfile
├── templates/          # Ảnh mẫu dùng cho tính năng scan
│   ├── single.png
│   ├── mid.png
│   ├── up.png
│   ├── down_2.png
│   ├── left_2.png
│   └── right.png
└── README.md
```

---

## Cài đặt & Chạy

### Frontend

Không cần cài đặt — truy cập thẳng link demo bên trên.

Hoặc clone về và mở `index.html` trực tiếp trong trình duyệt:

```bash
git clone https://github.com/daongocuong/BattleshipsSolitaire-Solver.git
cd BattleshipsSolitaire-Solver
# Mở index.html trong trình duyệt
```

---

### Backend (Scan Server)

Backend được deploy trên **Render** để phục vụ tính năng scan ảnh.

**Chạy local:**

```bash
cd backend

# Cài dependencies
pip install -r requirements.txt

# Cài Tesseract OCR (nếu chưa có)
# Ubuntu/Debian:
sudo apt-get install tesseract-ocr
# macOS:
brew install tesseract

# Chạy server
python scan_server.py
# Server chạy tại: http://localhost:8000
```

**Chạy bằng Docker:**

```bash
cd backend
docker build -t battleships-backend .
docker run -p 8000:8000 battleships-backend
```

---

## Cách hoạt động

### Solver Backtracking
- Áp dụng constraint propagation (hàng, cột, đường chéo) trước khi backtrack
- Ưu tiên ô có ít lựa chọn nhất (MRV heuristic)
- Chạy hoàn toàn trong trình duyệt, không cần mạng

### Solver ILP (GLPK.js)
- Sinh tất cả pattern đặt tàu hợp lệ
- Xây dựng mô hình Integer Linear Programming
- Giải bằng thư viện [GLPK.js](https://github.com/jvail/glpk.js) tải qua CDN
- Hiệu quả hơn Backtracking với các đề lớn (15×15 trở lên)

### Scan ảnh
- Frontend nhận ảnh từ clipboard (Ctrl+V), gửi lên backend
- Backend dùng OpenCV nhận diện đường kẻ bảng bằng HoughLinesP
- OCR số hàng/cột bằng Tesseract
- Template matching nhận diện loại ô tàu (Single, Mid, Up, Down, Left, Right)
- Trả về JSON để frontend load vào solver

---

## Hướng dẫn dùng tính năng Scan

1. Chụp màn hình bảng Battleships — bao gồm **toàn bộ ô** và **số đầu hàng/cột**
2. Nhấn **Ctrl+C** để copy ảnh vào clipboard
3. Chuyển sang tab **📸 Scan đề**
4. Nhấn **Ctrl+V** vào vùng dán ảnh
5. Chọn đúng kích thước bảng (N)
6. Nhấn **Scan và chuyển sang Giải**
7. Kiểm tra kết quả rồi nhấn **Giải**

---

## Công nghệ sử dụng

**Frontend:**
- Vanilla JavaScript, HTML5, CSS3
- [GLPK.js](https://cdn.jsdelivr.net/npm/glpk.js) — ILP solver, tải qua CDN

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
- [OpenCV](https://opencv.org/) — xử lý ảnh
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) qua pytesseract
- Docker
- Deploy trên [Render](https://render.com)

---

## License

MIT License — tự do sử dụng, chỉnh sửa và phân phối.

---
