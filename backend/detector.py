"""
detector.py – Universal Board Game Shape Detector (dùng làm module)
"""
import cv2
import numpy as np
import os

# ── Config mặc định cho từng grid_size ──
CONFIGS = {
    6: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.78, "Down": 0.72,
            "Up": 0.78, "Left": 0.72, "Right": 0.72,
            "_scale_ranges": {
                "Single": (0.30, 1.4), "Mid":   (0.30, 1.4),
                "Down":   (0.25, 1.4), "Up":    (0.25, 1.4),
                "Left":   (0.25, 1.4), "Right": (0.25, 1.4),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    8: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.78, "Down": 0.73,
            "Up": 0.78, "Left": 0.73, "Right": 0.73,
            "_scale_ranges": {
                "Single": (0.30, 1.4), "Mid":   (0.30, 1.4),
                "Down":   (0.25, 1.4), "Up":    (0.25, 1.4),
                "Left":   (0.25, 1.4), "Right": (0.25, 1.4),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    10: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.80, "Down": 0.75,
            "Up": 0.80, "Left": 0.75, "Right": 0.75,
            "_scale_ranges": {
                "Single": (0.35, 1.3), "Mid":   (0.35, 1.3),
                "Down":   (0.30, 1.3), "Up":    (0.30, 1.3),
                "Left":   (0.30, 1.3), "Right": (0.30, 1.3),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    15: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.80, "Down": 0.75,
            "Up": 0.80, "Left": 0.75, "Right": 0.75,
            "_scale_ranges": {
                "Single": (0.35, 1.2), "Mid":   (0.35, 1.2),
                "Down":   (0.30, 1.2), "Up":    (0.30, 1.2),
                "Left":   (0.30, 1.2), "Right": (0.30, 1.2),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    20: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.80, "Down": 0.75,
            "Up": 0.80, "Left": 0.75, "Right": 0.75,
            "_scale_ranges": {
                "Single": (0.35, 1.1), "Mid":   (0.35, 1.1),
                "Down":   (0.30, 1.1), "Up":    (0.30, 1.1),
                "Left":   (0.30, 1.1), "Right": (0.30, 1.1),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    25: {
        "thresholds": {
            "Single": 0.83, "Mid": 0.8, "Down": 0.75,
            "Up": 0.75, "Left": 0.75, "Right": 0.75,
            "_scale_ranges": {
                "Single": (0.35, 1.1), "Mid":   (0.35, 1.1),
                "Down":   (0.30, 1.1), "Up":    (0.30, 1.1),
                "Left":   (0.30, 1.1), "Right": (0.30, 1.1),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
    # Thêm vào CONFIGS sau dòng 25: (sau config của 25)
    30: {
        "thresholds": {
            "Single": 0.85, "Mid": 0.79, "Down": 0.75,
            "Up": 0.75, "Left": 0.75, "Right": 0.75,
            "_scale_ranges": {
                "Single": (0.35, 1.1), "Mid":   (0.35, 1.1),
                "Down":   (0.35, 1.1), "Up":    (0.35, 1.1),
                "Left":   (0.35, 1.1), "Right": (0.35, 1.1),
            },
        },
        "lower_blue": np.array([85,  40, 150]),
        "upper_blue": np.array([130, 200, 255]),
        "min_pixel_ratio": 0.15,
    },
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = {
    "Single": [os.path.join(BASE_DIR, "templates", "single.png")],
    "Mid":    [os.path.join(BASE_DIR, "templates", "mid.png")],
    "Down":   [os.path.join(BASE_DIR, "templates", "down_2.png")],
    "Up":     [os.path.join(BASE_DIR, "templates", "up.png")],
    "Left":   [os.path.join(BASE_DIR, "templates", "left_2.png")],
    "Right":  [os.path.join(BASE_DIR, "templates", "right.png")],
}

# ── Các hàm tiện ích ──
def find_grid_lines(img_gray, grid_size):
    """Tìm đường kẻ board bằng HoughLinesP (ưu tiên), fallback: transition scan."""
    h, w = img_gray.shape
    n_need = grid_size + 1

    def cluster(positions, gap=8):
        if not positions:
            return []
        groups, cur = [], [positions[0]]
        for p in positions[1:]:
            if p - cur[-1] <= gap:
                cur.append(p)
            else:
                groups.append(int(np.mean(cur)))
                cur = [p]
        groups.append(int(np.mean(cur)))
        return groups

    def pick_best_group(lines, n):
        lines = sorted(lines)
        if len(lines) <= n:
            return lines
        best_std, best = float('inf'), lines[:n]
        for i in range(len(lines) - n + 1):
            grp = lines[i:i+n]
            gaps = [grp[j+1]-grp[j] for j in range(n-1)]
            std = np.std(gaps)
            if std < best_std:
                best_std, best = std, grp
        return best

    def hough_grid_lines(min_len_ratio):
        edges = cv2.Canny(img_gray, 30, 120)
        min_len = int(min(w, h) * min_len_ratio)
        segs = cv2.HoughLinesP(edges, 1, np.pi/180,
                               threshold=25,
                               minLineLength=min_len,
                               maxLineGap=12)
        if segs is None:
            return [], []
        h_pos, v_pos = [], []
        for seg in segs:
            x1, y1, x2, y2 = seg[0]
            dx, dy = abs(x2-x1), abs(y2-y1)
            if dy < 5 and dx >= min_len:        # duong ngang
                h_pos.append((y1+y2)//2)
            elif dx < 5 and dy >= min_len:      # duong doc
                v_pos.append((x1+x2)//2)
        return cluster(sorted(h_pos)), cluster(sorted(v_pos))

    for ratio in [0.55, 0.45, 0.38, 0.30, 0.22]:
        h_raw, v_raw = hough_grid_lines(ratio)
        h_lines = pick_best_group(h_raw, n_need)
        v_lines = pick_best_group(v_raw, n_need)
        if len(h_lines) == n_need and len(v_lines) == n_need:
            return h_lines, v_lines

    # fallback scan
    def scan_transitions(arr, dark_thresh=120, light_thresh=150):
        return [i for i in range(1, len(arr))
                if arr[i-1] > light_thresh and arr[i] < dark_thresh]

    mx, my = int(w*0.08), int(h*0.08)
    sx1, sx2, sy1, sy2 = mx, w-mx, my, h-my
    for dark_thresh in [120, 100, 80, 60, 140]:
        h_votes = np.zeros(h, dtype=int)
        for x in [sx1 + int(r*(sx2-sx1)) for r in [.1,.2,.3,.4,.5,.6,.7,.8,.9]]:
            for pos in scan_transitions(img_gray[:, x], dark_thresh):
                h_votes[max(0,pos-3):min(h,pos+4)] += 1
        v_votes = np.zeros(w, dtype=int)
        for y in [sy1 + int(r*(sy2-sy1)) for r in [.1,.2,.3,.4,.5,.6,.7,.8,.9]]:
            for pos in scan_transitions(img_gray[y, :], dark_thresh):
                v_votes[max(0,pos-3):min(w,pos+4)] += 1
        h_lines = pick_best_group(cluster(list(np.where(h_votes>=1)[0])), n_need)
        v_lines = pick_best_group(cluster(list(np.where(v_votes>=1)[0])), n_need)
        if len(h_lines) == n_need and len(v_lines) == n_need:
            return h_lines, v_lines

    # fallback Canny
    edges = cv2.Canny(img_gray, 30, 100)
    hv = np.sum(edges, axis=1).astype(float); hv /= (hv.max()+1e-9)
    vv = np.sum(edges, axis=0).astype(float); vv /= (vv.max()+1e-9)
    h_lines = pick_best_group(cluster(list(np.where(hv>0.05)[0])), n_need)
    v_lines = pick_best_group(cluster(list(np.where(vv>0.05)[0])), n_need)
    return h_lines, v_lines

def read_header_numbers(img_gray, v_lines, h_lines, bx1, by1, bx2, by2, grid_size):
    """
    Doc so header dung pytesseract OCR.
    Scale len x4-x6 truoc khi OCR de tang do chinh xac tren o nho.
    Thu ca normal va inverted, nhieu psm mode.
    """
    import pytesseract

    _CFGS = [
        '--psm 10 --oem 3 -c tessedit_char_whitelist=0123456789',
        '--psm 8  --oem 3 -c tessedit_char_whitelist=0123456789',
        '--psm 7  --oem 3 -c tessedit_char_whitelist=0123456789',
        '--psm 13 --oem 3 -c tessedit_char_whitelist=0123456789',
    ]

    def ocr_cell(cell_gray):
        if cell_gray is None or cell_gray.size == 0:
            return None
        ch, cw = cell_gray.shape[:2]
        if cw < 3 or ch < 3:
            return None
        scale = max(4, 120 // max(1, min(cw, ch)))
        big = cv2.resize(cell_gray, (cw * scale, ch * scale),
                         interpolation=cv2.INTER_CUBIC)
        _, th = cv2.threshold(big, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        th_inv = cv2.bitwise_not(th)
        pad = 10
        th     = cv2.copyMakeBorder(th,     pad, pad, pad, pad,
                                    cv2.BORDER_CONSTANT, value=255)
        th_inv = cv2.copyMakeBorder(th_inv, pad, pad, pad, pad,
                                    cv2.BORDER_CONSTANT, value=255)
        for variant in [th, th_inv]:
            for cfg in _CFGS:
                txt = pytesseract.image_to_string(variant, config=cfg).strip()
                digits = ''.join(c for c in txt if c.isdigit())
                if digits:
                    return int(digits)
        return None

    col_numbers, row_numbers = [], []

    if by1 > 5:
        for c in range(grid_size):
            x1 = v_lines[c]
            x2 = v_lines[c + 1] if c + 1 < len(v_lines) else bx2
            mx = max(2, (x2 - x1) // 8)
            my = max(2, by1 // 8)
            col_numbers.append(ocr_cell(img_gray[my:by1 - my, x1 + mx:x2 - mx]))
    else:
        col_numbers = [None] * grid_size

    if bx1 > 5:
        for r in range(grid_size):
            y1 = h_lines[r]
            y2 = h_lines[r + 1] if r + 1 < len(h_lines) else by2
            my = max(2, (y2 - y1) // 8)
            mx = max(2, bx1 // 8)
            row_numbers.append(ocr_cell(img_gray[y1 + my:y2 - my, mx:bx1 - mx]))
    else:
        row_numbers = [None] * grid_size

    return col_numbers, row_numbers

def pixel_to_cell(cx, cy, v_lines, h_lines, grid_size):
    col = next((i+1 for i in range(len(v_lines)-1)
                if v_lines[i] <= cx < v_lines[i+1]), None)
    if col is None:
        col = 1 if cx < v_lines[0] else grid_size
    row = next((i+1 for i in range(len(h_lines)-1)
                if h_lines[i] <= cy < h_lines[i+1]), None)
    if row is None:
        row = 1 if cy < h_lines[0] else grid_size
    return row, col

def detect_obstacles_by_color(img_hsv, v_lines, h_lines, grid_size,
                               occupied, lower_blue, upper_blue, min_ratio=0.15):
    mask = cv2.inRange(img_hsv, lower_blue, upper_blue)
    obs = set()
    for row in range(1, grid_size+1):
        for col in range(1, grid_size+1):
            if (row, col) in occupied:
                continue
            x1, x2 = v_lines[col-1], v_lines[col]
            y1, y2 = h_lines[row-1], h_lines[row]
            area = (x2-x1) * (y2-y1)
            if area > 0 and np.sum(mask[y1:y2, x1:x2] > 0) / area >= min_ratio:
                obs.add((row, col))
    return obs

def detect_shapes(img_rgb, img_gray, img_hsv,
                  v_lines, h_lines, template_dict, thresholds,
                  grid_size, lower_blue, upper_blue, min_pixel_ratio):
    img_h, img_w = img_gray.shape
    cell_w = (v_lines[-1] - v_lines[0]) / grid_size
    detected, occupied = {}, set()
    scale_ranges = thresholds.get("_scale_ranges", {})

    for shape_name in ["Single", "Mid","Left", "Right", "Down", "Up" ]:
        paths = template_dict.get(shape_name, [])
        found = set()
        thr = thresholds.get(shape_name, 0.78)
        sr  = scale_ranges.get(shape_name, (0.30, 1.3))
        min_w = max(1, int(cell_w * sr[0]))
        max_w = max(2, int(cell_w * sr[1]))

        for path in paths:
            tmpl = cv2.imread(path, 0)
            if tmpl is None:
                continue
            t_h, t_w = tmpl.shape
            for cw in range(min_w, max_w+1, 2):
                ch = int(t_h * cw / t_w)
                if cw <= 0 or ch <= 0 or ch > img_h or cw > img_w:
                    continue
                res = cv2.matchTemplate(img_gray,
                                        cv2.resize(tmpl, (cw, ch)),
                                        cv2.TM_CCOEFF_NORMED)
                for pt in zip(*np.where(res >= thr)[::-1]):
                    cx, cy = pt[0] + cw//2, pt[1] + ch//2
                    row, col = pixel_to_cell(cx, cy, v_lines, h_lines, grid_size)
                    cell = (row, col)
                    if cell in occupied or cell in found:
                        continue
                    found.add(cell)
                    occupied.add(cell)
        detected[shape_name] = sorted(found)

    obs = detect_obstacles_by_color(img_hsv, v_lines, h_lines, grid_size,
                                    occupied, lower_blue, upper_blue, min_pixel_ratio)
    detected["Obstacle"] = sorted(obs)
    return detected

# ── Hàm chính dùng cho API ──
def detect_board(image_path, grid_size):
    if grid_size not in CONFIGS:
        raise ValueError(f"Unsupported grid size: {grid_size}")

    cfg = CONFIGS[grid_size]
    thresholds = cfg["thresholds"]
    lower_blue = cfg["lower_blue"]
    upper_blue = cfg["upper_blue"]
    min_ratio  = cfg["min_pixel_ratio"]

    img_rgb = cv2.imread(image_path)
    if img_rgb is None:
        raise ValueError("Cannot read image")
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    img_hsv  = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2HSV)

    h_lines, v_lines = find_grid_lines(img_gray, grid_size)
    if len(h_lines) < grid_size + 1 or len(v_lines) < grid_size + 1:
        raise RuntimeError("Not enough grid lines found")

    bx1, bx2 = v_lines[0], v_lines[-1]
    by1, by2 = h_lines[0], h_lines[-1]

    col_nums, row_nums = read_header_numbers(img_gray, v_lines, h_lines,
                                             bx1, by1, bx2, by2, grid_size)

    results = detect_shapes(img_rgb, img_gray, img_hsv,
                            v_lines, h_lines, TEMPLATES, thresholds,
                            grid_size, lower_blue, upper_blue, min_ratio)

    shapes_list = []
    for shape_type in ["Single", "Mid", "Down", "Up", "Left", "Right"]:
        for (r, c) in results.get(shape_type, []):
            shapes_list.append({"r": r, "c": c, "type": shape_type})

    obstacles_list = [{"r": r, "c": c} for (r, c) in results.get("Obstacle", [])]

    col_hints_out = [c if c is not None else 0 for c in col_nums]
    row_hints_out = [r if r is not None else 0 for r in row_nums]

    return {
        "row_hints": row_hints_out,
        "col_hints": col_hints_out,
        "shapes": shapes_list,
        "obstacles": obstacles_list
    }
