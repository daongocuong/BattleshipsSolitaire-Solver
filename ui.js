'use strict';

/* ─────────── SHARED ─────────── */
let currentMode = 'solve';
let currentSolver = 'bt'; // 'bt' | 'ilp'

function inferFinalState(board, r, c) {
    if (board[r][c] === 0) return 'water-marked';
    const R = board.length, C = board[0].length;
    const up    = (r > 0     && board[r-1][c] === 1);
    const down  = (r < R - 1 && board[r+1][c] === 1);
    const left  = (c > 0     && board[r][c-1] === 1);
    const right = (c < C - 1 && board[r][c+1] === 1);
    if (!up && !down && !left && !right) return 'single';
    if ( down && !up && !left && !right) return 'up';
    if ( up   && !down && !left && !right) return 'down';
    if ( right && !up && !down && !left)  return 'left';
    if ( left  && !up && !down && !right) return 'right';
    return 'mid';
}

/* ─────────── SOLVE STATE ─────────── */
let gridData = [];
let fleet = [
    { length:4, count:1 }, { length:3, count:2 },
    { length:2, count:3 }, { length:1, count:4 }
];
let solverWorker = null, solverTimerInterval = null, solverStartTime = 0;
let savedGiven = null;
/* ─────────── CREATE STATE ─────────── */
let createFleet = [
    { length:4, count:1 }, { length:3, count:2 },
    { length:2, count:3 }, { length:1, count:4 }
];
let createGridData = [];
let placedShips   = [];
let nextShipId    = 1;
let dragState     = null;

/* Step-3 */
let cellSolveType = {};   // "r,c" -> 'single'|'up'|'down'|'left'|'right'|'mid'
let givenShipSet  = new Set();
let obstacleSet   = new Set();

/* ─────────── UTILS ─────────── */
function getColumnLabel(idx) {
    let lbl = '', t = idx;
    while (t >= 0) { lbl = String.fromCharCode((t % 26) + 97) + lbl; t = Math.floor(t / 26) - 1; }
    return lbl;
}
function ck(r, c) { return r + ',' + c; }

/* ─────────── MODE SWITCH ─────────── */
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('panel-solve').style.display  = mode === 'solve'  ? '' : 'none';
    document.getElementById('panel-create').style.display = mode === 'create' ? '' : 'none';
    document.getElementById('panel-scan').style.display   = mode === 'scan'   ? '' : 'none';
    document.getElementById('tab-solve').classList.toggle('active', mode === 'solve');
    document.getElementById('tab-create').classList.toggle('active', mode === 'create');
    document.getElementById('tab-scan').classList.toggle('active', mode === 'scan');
    if (mode === 'create' && createGridData.length === 0) initCreateMode();
    

}

/* ═══════════════════════════════════════════════════
   SOLVE MODE
   ═══════════════════════════════════════════════════ */
function initSolveMode() {
    const N = parseInt(document.getElementById('gridSize').value) || 10;
    const ba = document.getElementById('boardArea');
    ba.innerHTML = '';
    gridData = [];
    const layout = document.createElement('div');
    layout.className = 'game-layout';
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-bottom:2px'));
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="hint-cell" id="col-hint-' + i + '"></div>', 'margin-bottom:4px;height:25px'));
    const mid = document.createElement('div');
    mid.className = 'layout-row';
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>'));
    mid.appendChild(mkVG(N, i => '<div class="hint-cell" id="row-hint-' + i + '"></div>', 'v-hints'));
    const board = document.createElement('div');
    board.className = 'board-container';
    board.style.gridTemplateColumns = 'repeat(' + N + ',35px)';
    board.style.gridTemplateRows    = 'repeat(' + N + ',35px)';
    for (let r = 0; r < N; r++) {
        let row = [];
        for (let c = 0; c < N; c++) {
            row.push('empty');
            const cell = document.createElement('div');
            cell.className = 'cell empty';
            cell.dataset.r = r; cell.dataset.c = c;
            cell.onclick = () => toggleCellState(r, c, cell);
            board.appendChild(cell);
        }
        gridData.push(row);
    }
    addCrossHL(board);
    mid.appendChild(board);
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>', '', 'margin-left:3px'));
    layout.appendChild(mid);
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-top:5px'));
    ba.appendChild(layout);
    renderFleetUI();
    syncHints();
    document.getElementById('statusMessage').innerText = '';
    resetZoom('zoomSlider', 'zoomValue', '#boardArea .game-layout');
}

function mkHRow(N, lc, rc, fn, style) {
    const row = document.createElement('div');
    row.className = 'layout-row';
    if (style) row.style.cssText = style;
    let h = '<div class="' + lc + '"></div><div class="h-group" style="grid-template-columns:repeat(' + N + ',35px)">';
    for (let i = 0; i < N; i++) h += fn(i);
    h += '</div><div class="' + rc + '"></div>';
    row.innerHTML = h;
    return row;
}
function mkVG(N, fn, extraCls, extraStyle) {
    extraCls   = extraCls   || '';
    extraStyle = extraStyle || '';
    const el = document.createElement('div');
    el.className = 'v-group ' + extraCls;
    el.style.gridTemplateRows = 'repeat(' + N + ',35px)';
    if (extraStyle) el.style.cssText += ';' + extraStyle;
    el.innerHTML = Array.from({ length: N }, (_, i) => fn(i)).join('');
    return el;
}
function addCrossHL(board) {
    board.addEventListener('mouseover', function (e) {
        const t = e.target.closest('.cell');
        if (!t) return;
        board.querySelectorAll('.cross-highlight').forEach(el => el.classList.remove('cross-highlight'));
        board.querySelectorAll('.cell[data-r="' + t.dataset.r + '"],.cell[data-c="' + t.dataset.c + '"]')
             .forEach(el => el.classList.add('cross-highlight'));
    });
    board.addEventListener('mouseleave', function () {
        board.querySelectorAll('.cross-highlight').forEach(el => el.classList.remove('cross-highlight'));
    });
}
function syncHints() {
    const N  = parseInt(document.getElementById('gridSize').value) || 10;
    const rv = document.getElementById('rowHints').value.trim().split(/\s+/);
    const cv = document.getElementById('colHints').value.trim().split(/\s+/);
    for (let i = 0; i < N; i++) {
        const r2 = rv[i] !== undefined ? rv[i] : '';
        const c2 = cv[i] !== undefined ? cv[i] : '';
        const rd = document.getElementById('row-hint-' + i);
        if (rd) { rd.innerText = r2; rd.className = r2 === '0' ? 'hint-cell dim' : 'hint-cell'; }
        const cd = document.getElementById('col-hint-' + i);
        if (cd) { cd.innerText = c2; cd.className = c2 === '0' ? 'hint-cell dim' : 'hint-cell'; }
    }
}

/* ─── setCellState — render đúng shape tàu ─── */
function setCellState(r, c, el, state) {
    gridData[r][c] = state;
    // Xóa toàn bộ class cũ
    el.className = 'cell';
    el.innerHTML = '';

    if (state === 'empty') {
        el.classList.add('empty');
        return;
    }
    if (state === 'water-marked') {
        el.classList.add('water-marked');
        el.innerHTML = '~';
        return;
    }
    if (state === 'obstacle') {
        el.classList.add('obstacle');
        return;
    }
    // ship states: single, up, down, left, right, mid
    el.classList.add(state);
    const p = document.createElement('div');
    p.className = 'ship-part';
    el.appendChild(p);
}

function toggleCellState(r, c, el) {
    const states = ['empty', 'single', 'up', 'down', 'left', 'right', 'mid', 'obstacle'];
    let cur = gridData[r][c];
    if (cur === 'water-marked') cur = 'empty';
    setCellState(r, c, el, states[(states.indexOf(cur) + 1) % states.length]);
}

/* ─── Fleet UI ─── */
function renderFleetUI() {
    const ct = document.getElementById('fleetContainer');
    ct.innerHTML = '';
    fleet.forEach(function (ship, idx) {
        const d = document.createElement('div');
        d.className = 'fleet-item';
        d.innerHTML = '<span>Tàu ' + ship.length + ' ô:</span>'
            + '<button class="small" onclick="updateFleetCount(' + idx + ',-1)">−</button>'
            + '<strong style="width:20px;text-align:center">' + ship.count + '</strong>'
            + '<button class="small" onclick="updateFleetCount(' + idx + ',1)">+</button>'
            + '<button class="small btn-danger" style="margin-left:15px" onclick="removeShipType(' + idx + ')">Xóa</button>';
        ct.appendChild(d);
    });
}
function updateFleetCount(i, d) { fleet[i].count = Math.max(0, fleet[i].count + d); renderFleetUI(); }
function removeShipType(i) { fleet.splice(i, 1); renderFleetUI(); }
function addShipType() {
    const l = prompt('Nhập độ dài tàu mới:');
    if (l && !isNaN(l)) {
        fleet.push({ length: parseInt(l), count: 1 });
        fleet.sort((a, b) => b.length - a.length);
        renderFleetUI();
    }
}
function resetBoard() {
    const N = parseInt(document.getElementById('gridSize').value) || 10;
    const cells = document.querySelectorAll('#boardArea .board-container .cell');

    if (savedGiven && savedGiven.length > 0) {
        // Đã giải rồi → về trạng thái hint ban đầu
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++)
                setCellState(r, c, cells[r * N + c], 'empty');
        savedGiven.forEach(g => {
            setCellState(g.r, g.c, cells[g.r * N + g.c], g.type);
        });
        savedGiven = null;
    } else {
        // Chưa giải → xóa hết
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++)
                setCellState(r, c, cells[r * N + c], 'empty');
        savedGiven = null;
    }

    document.getElementById('statusMessage').innerText = '';
}

/* ─────────── ZOOM ─────────── */
function adjustZoom(delta, mode) {
    const id = mode === 'create' ? 'createZoomSlider' : mode === 'given' ? 'givenZoomSlider' : 'zoomSlider';
    const sl = document.getElementById(id);
    const nv = Math.round((parseFloat(sl.value) + delta) * 10) / 10;
    if (nv >= parseFloat(sl.min) && nv <= parseFloat(sl.max)) { sl.value = nv; applyZoom(mode); }
}
function applyZoom(mode) {
    if (mode === 'create') {
        const v = document.getElementById('createZoomSlider').value;
        document.getElementById('createZoomValue').innerText = Math.round(v * 100) + '%';
        const el = document.querySelector('#createBoardArea .game-layout');
        if (el) el.style.zoom = v;
    } else if (mode === 'given') {
        const v = document.getElementById('givenZoomSlider').value;
        document.getElementById('givenZoomValue').innerText = Math.round(v * 100) + '%';
        const el = document.querySelector('#givenBoardArea .game-layout');
        if (el) el.style.zoom = v;
    } else {
        const v = document.getElementById('zoomSlider').value;
        document.getElementById('zoomValue').innerText = Math.round(v * 100) + '%';
        const el = document.querySelector('#boardArea .game-layout');
        if (el) el.style.zoom = v;
    }
}
function resetZoom(sliderId, labelId, selector) {
    const sl = document.getElementById(sliderId);
    if (!sl) return;
    sl.value = 1;
    document.getElementById(labelId).innerText = '100%';
    const el = document.querySelector(selector);
    if (el) el.style.zoom = 1;
}

/*    SOLVER    */
function setSolver(val) {
    currentSolver = val;
    const ilpNote = document.getElementById('ilpNote');
    if (ilpNote) ilpNote.style.display = val === 'ilp' ? '' : 'none';
}

async function startSolve() {
    const btn = document.getElementById('solveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const status = document.getElementById('statusMessage');
    const timerBox = document.getElementById('solverTimerBox');
    const N = parseInt(document.getElementById('gridSize').value) || 10;

    // Thu thập hints
    const rowHints = [], colHints = [];
    const rv = document.getElementById('rowHints').value.trim().split(/\s+/);
    const cv = document.getElementById('colHints').value.trim().split(/\s+/);
    for (let i = 0; i < N; i++) {
        rowHints.push(parseInt(rv[i]) || 0);
        colHints.push(parseInt(cv[i]) || 0);
    }

    // Thu thập fleet
    const fleetConfig = {};
    fleet.forEach(f => { if (f.count > 0) fleetConfig[f.length] = f.count; });

    // Thu thập given / obstacle
    const given = [];
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
            const state = gridData[r][c];
            if (state !== 'empty' && state !== 'water-marked')
                given.push({ r, c, type: state });
        }
    savedGiven = given.map(g => ({ ...g }));
    // Chọn solver
    const solver = currentSolver === 'ilp' ? window.solverILP : window.solverBT;
    const solverName = solver ? solver.name : '???';

    btn.disabled = true;
    btn.innerText = '⏳ Đang giải...';
    cancelBtn.style.display = '';
    timerBox.style.display = '';
    status.style.color = '#007bff';
    status.innerText = `⚙️ Đang giải bằng ${solverName}...`;
    solverStartTime = performance.now();

    try {
        const puzzle = { R: N, C: N, name: 'ui-puzzle', row_hints: rowHints, col_hints: colHints, given, fleet: fleetConfig };
        const solution = await solver.solve(puzzle);
        finishSolve(solution, N);
    } catch (err) {
        console.error(err);
        status.style.color = '#dc3545';
        status.innerText = '❌ Lỗi solver: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.innerText = '▶ Giải Bảng Tự Động';
        cancelBtn.style.display = 'none';
        document.getElementById('solverTimerDisplay').innerText =
            ((performance.now() - solverStartTime) / 1000).toFixed(2) + 's';
    }
}

function cancelSolve() {
    if (solverWorker) { solverWorker.terminate(); solverWorker = null; }
    stopTimer();
    document.getElementById('solveBtn').disabled = false;
    document.getElementById('solveBtn').innerText = '▶ Giải Bảng Tự Động';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('statusMessage').style.color = '#e65c00';
    document.getElementById('statusMessage').innerText   = '⏹ Đã hủy.';
}
function stopTimer() {
    if (solverTimerInterval) { clearInterval(solverTimerInterval); solverTimerInterval = null; }
}

/**
 * Áp dụng kết quả lên board UI.
 * - Với ô chưa được given: dùng inferFinalStateSA để tính shape
 * - Với ô given (single/up/down/left/right/mid/obstacle): giữ nguyên
 */
function finishSolve(solution, N, errMsg) {
    stopTimer();
    solverWorker = null;
    const elapsed = ((performance.now() - solverStartTime) / 1000).toFixed(2);
    document.getElementById('solverTimerDisplay').innerText = elapsed + 's';
    document.getElementById('solveBtn').disabled = false;
    document.getElementById('solveBtn').innerText = '▶ Giải Bảng Tự Động';
    document.getElementById('cancelBtn').style.display = 'none';
    const st = document.getElementById('statusMessage');

    if (errMsg) {
        st.style.color = '#dc3545';
        st.innerText   = 'Lỗi: ' + errMsg;
        return;
    }
    if (!solution) {
        st.style.color = '#dc3545';
        st.innerText   = '❌ Không tìm được nghiệm! Thử lại hoặc kiểm tra hints.';
        return;
    }

    const cells       = document.querySelectorAll('#boardArea .board-container .cell');
    const givenStates = new Set(['single', 'up', 'down', 'left', 'right', 'mid', 'obstacle']);

    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cur = gridData[r][c];
        // Giữ nguyên ô given (tàu có hướng + obstacle) — đã hiển thị đúng từ trước
        if (givenStates.has(cur)) continue;

        const shape = inferFinalState(solution, r, c);
        setCellState(r, c, cells[r * N + c], shape);
    }

    st.style.color = '#28a745';
    st.innerText   = '✅ Giải thành công trong ' + elapsed + ' giây!';
}

/* ═══════════════════════════════════════════════════
   CREATE — STEP 1: Fleet config
   ═══════════════════════════════════════════════════ */
function initCreateMode() {
    createFleet = [{ length:4, count:1 }, { length:3, count:2 }, { length:2, count:3 }, { length:1, count:4 }];
    renderCreateFleetEditor();
    setCreateStep(1);
}
function renderCreateFleetEditor() {
    const ct = document.getElementById('createFleetEditor');
    ct.innerHTML = '';
    createFleet.forEach(function (ship, idx) {
        const d = document.createElement('div');
        d.className = 'fleet-item';
        d.innerHTML = '<span>Tàu ' + ship.length + ' ô:</span>'
            + '<button class="small" onclick="updateCF(' + idx + ',-1)">−</button>'
            + '<strong style="width:20px;text-align:center">' + ship.count + '</strong>'
            + '<button class="small" onclick="updateCF(' + idx + ',1)">+</button>'
            + '<button class="small btn-danger" style="margin-left:15px" onclick="removeCF(' + idx + ')">Xóa</button>';
        ct.appendChild(d);
    });
}
function updateCF(i, d) { createFleet[i].count = Math.max(0, createFleet[i].count + d); renderCreateFleetEditor(); }
function removeCF(i)     { createFleet.splice(i, 1); renderCreateFleetEditor(); }
function addCreateShipType() {
    const l = prompt('Độ dài tàu mới:');
    if (!l || isNaN(l)) return;
    createFleet.push({ length: parseInt(l), count: 1 });
    createFleet.sort((a, b) => b.length - a.length);
    renderCreateFleetEditor();
}
function goToStep2() {
    const total = createFleet.reduce((s, f) => s + f.count, 0);
    if (total === 0) { alert('Hãy thêm ít nhất 1 tàu!'); return; }
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    createGridData = Array.from({ length: N }, () => Array(N).fill('empty'));
    placedShips = []; nextShipId = 1;
    buildCreateBoard(N);
    renderShipPalette();
    setCreateStep(2);
    updateStep2Status();
}
function goToStep1() { setCreateStep(1); }

/* ═══════════════════════════════════════════════════
   CREATE — STEP 2: Place ships
   ═══════════════════════════════════════════════════ */
function buildCreateBoard(N) {
    const ba = document.getElementById('createBoardArea');
    ba.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'game-layout';
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-bottom:2px'));
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="hint-cell" id="ch-col-' + i + '">0</div>', 'margin-bottom:4px;height:25px'));
    const mid = document.createElement('div');
    mid.className = 'layout-row';
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>'));
    mid.appendChild(mkVG(N, i => '<div class="hint-cell" id="ch-row-' + i + '">0</div>', 'v-hints'));
    const board = document.createElement('div');
    board.className = 'board-container';
    board.id = 'createBoard';
    board.style.gridTemplateColumns = 'repeat(' + N + ',35px)';
    board.style.gridTemplateRows    = 'repeat(' + N + ',35px)';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className  = 'cell empty';
        cell.dataset.r  = r; cell.dataset.c = c;
        cell.addEventListener('dragover',    onDragOver);
        cell.addEventListener('dragleave',   onDragLeave);
        cell.addEventListener('drop',        onDrop);
        cell.addEventListener('contextmenu', onRightClick);
        cell.addEventListener('dblclick',    onDblClick);
        board.appendChild(cell);
    }
    addCrossHL(board);
    mid.appendChild(board);
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>', '', 'margin-left:3px'));
    layout.appendChild(mid);
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-top:5px'));
    ba.appendChild(layout);
    resetZoom('createZoomSlider', 'createZoomValue', '#createBoardArea .game-layout');
}

function updateStep2Status() {
    const totalNeeded = createFleet.reduce((s, f) => s + f.count, 0);
    const allPlaced   = placedShips.length >= totalNeeded;
    const parts = createFleet.map(f => {
        const placed = placedShips.filter(s => s.length === f.length).length;
        const rem    = f.count - placed;
        return '<span style="color:' + (rem <= 0 ? '#28a745' : '#e65c00') + '">'
            + (rem <= 0 ? '✓' : '⏳') + ' T' + f.length + ': ' + placed + '/' + f.count + '</span>';
    });
    document.getElementById('createFleetStatus').innerHTML =
        parts.join(' &nbsp;|&nbsp; ') + (allPlaced ? ' &nbsp;<strong style="color:#28a745">✅ Đủ hạm đội!</strong>' : '');
    document.getElementById('goStep3Btn').disabled = !allPlaced;
    updateCreateHints();
}
function updateCreateHints() {
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    const rT = Array(N).fill(0), cT = Array(N).fill(0);
    placedShips.forEach(s => {
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i, c = s.horizontal ? s.c + i : s.c;
            if (r >= 0 && r < N && c >= 0 && c < N) { rT[r]++; cT[c]++; }
        }
    });
    for (let i = 0; i < N; i++) {
        const re = document.getElementById('ch-row-' + i);
        const ce = document.getElementById('ch-col-' + i);
        if (re) { re.innerText = rT[i]; re.className = rT[i] === 0 ? 'hint-cell dim' : 'hint-cell'; }
        if (ce) { ce.innerText = cT[i]; ce.className = cT[i] === 0 ? 'hint-cell dim' : 'hint-cell'; }
    }
}

/* ─── Drag & Drop ─── */
function getGhost() {
    let g = document.getElementById('dragGhost');
    if (!g) { g = document.createElement('div'); g.id = 'dragGhost'; document.body.appendChild(g); }
    return g;
}
function buildGhost(len, horiz) {
    const g = getGhost();
    g.className = horiz ? '' : 'vert';
    g.style.flexDirection = horiz ? 'row' : 'column';
    g.innerHTML = Array.from({ length: len }, () => '<div class="ghost-cell"></div>').join('');
    return g;
}
function startDragFromFleet(e, len, horiz) {
    dragState = { shipLength: len, horizontal: horiz };
    const g   = buildGhost(len, horiz);
    e.dataTransfer.setDragImage(g, horiz ? len * 18 : 18, horiz ? 18 : len * 18);
    e.dataTransfer.effectAllowed = 'copy';
    document.addEventListener('keydown', rotateDragKey);
}
function rotateDragKey(e) {
    if ((e.key === 'r' || e.key === 'R') && dragState) {
        dragState.horizontal = !dragState.horizontal;
        buildGhost(dragState.shipLength, dragState.horizontal);
    }
}
function onDragOver(e) {
    e.preventDefault();
    if (!dragState) return;
    const r = parseInt(e.currentTarget.dataset.r);
    const c = parseInt(e.currentTarget.dataset.c);
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    clearDragCls();
    const ok = canPlace(r, c, dragState.shipLength, dragState.horizontal, N);
    for (let i = 0; i < dragState.shipLength; i++) {
        const tr = dragState.horizontal ? r : r + i;
        const tc = dragState.horizontal ? c + i : c;
        const el = document.querySelector('#createBoard .cell[data-r="' + tr + '"][data-c="' + tc + '"]');
        if (el) el.classList.add(ok ? 'drag-ok' : 'drag-bad');
    }
}
function onDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) clearDragCls(); }
function onDrop(e) {
    e.preventDefault();
    clearDragCls();
    document.removeEventListener('keydown', rotateDragKey);
    if (!dragState) return;
    const r = parseInt(e.currentTarget.dataset.r);
    const c = parseInt(e.currentTarget.dataset.c);
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    if (canPlace(r, c, dragState.shipLength, dragState.horizontal, N)) {
        placeShip(r, c, dragState.shipLength, dragState.horizontal);
    } else showCreateMsg('❌ Không thể đặt tàu ở đây!');
    dragState = null;
}
function clearDragCls() {
    document.querySelectorAll('#createBoard .drag-ok,.drag-bad')
        .forEach(el => el.classList.remove('drag-ok', 'drag-bad'));
}
function onRightClick(e) {
    e.preventDefault();
    const r    = parseInt(e.currentTarget.dataset.r);
    const c    = parseInt(e.currentTarget.dataset.c);
    const N    = parseInt(document.getElementById('createGridSize').value) || 10;
    const ship = shipAt(r, c);
    if (!ship) return;
    removeShip(ship.id);
    if (canPlace(ship.r, ship.c, ship.length, !ship.horizontal, N))
        placeShip(ship.r, ship.c, ship.length, !ship.horizontal);
    else { placeShip(ship.r, ship.c, ship.length, ship.horizontal); showCreateMsg('⚠️ Không thể xoay ở đây!'); }
}
function onDblClick(e) {
    const r    = parseInt(e.currentTarget.dataset.r);
    const c    = parseInt(e.currentTarget.dataset.c);
    const ship = shipAt(r, c);
    if (ship) removeShip(ship.id);
}
function shipAt(r, c) {
    return placedShips.find(s => {
        for (let i = 0; i < s.length; i++) {
            const sr = s.horizontal ? s.r : s.r + i;
            const sc = s.horizontal ? s.c + i : s.c;
            if (sr === r && sc === c) return true;
        }
        return false;
    });
}

/* ─── Place / Remove ships ─── */
function canPlace(r, c, len, horiz, N) {
    if (horiz && c + len > N) return false;
    if (!horiz && r + len > N) return false;
    for (let i = 0; i < len; i++) {
        const tr = horiz ? r : r + i, tc = horiz ? c + i : c;
        if (createGridData[tr][tc] !== 'empty') return false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = tr + dr, nc = tc + dc;
            if (nr >= 0 && nr < N && nc >= 0 && nc < N && createGridData[nr][nc] === 'ship') return false;
        }
    }
    return true;
}
function placeShip(r, c, len, horiz) {
    const N  = parseInt(document.getElementById('createGridSize').value) || 10;
    const id = nextShipId++;
    for (let i = 0; i < len; i++) {
        const tr = horiz ? r : r + i, tc = horiz ? c + i : c;
        createGridData[tr][tc] = 'ship';
    }
    for (let i = 0; i < len; i++) {
        const tr = horiz ? r : r + i, tc = horiz ? c + i : c;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = tr + dr, nc = tc + dc;
            if (nr >= 0 && nr < N && nc >= 0 && nc < N && createGridData[nr][nc] === 'empty')
                createGridData[nr][nc] = 'water';
        }
    }
    placedShips.push({ id, r, c, length: len, horizontal: horiz });
    renderCreateBoard();
    renderShipPalette();
    updateStep2Status();
}
function removeShip(id) {
    placedShips = placedShips.filter(s => s.id !== id);
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    rebuildGrid(N);
    renderCreateBoard();
    renderShipPalette();
    updateStep2Status();
}
function rebuildGrid(N) {
    createGridData = Array.from({ length: N }, () => Array(N).fill('empty'));
    placedShips.forEach(s => {
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i, c = s.horizontal ? s.c + i : s.c;
            createGridData[r][c] = 'ship';
        }
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i, c = s.horizontal ? s.c + i : s.c;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < N && nc >= 0 && nc < N && createGridData[nr][nc] === 'empty')
                    createGridData[nr][nc] = 'water';
            }
        }
    });
}
function renderCreateBoard() {
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    document.querySelectorAll('#createBoard .cell').forEach(cell => {
        const r  = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
        cell.innerHTML = '';
        cell.className = 'cell empty';
        cell.draggable = false;
        const st = createGridData[r][c];
        if (st === 'water') { cell.classList.add('cwater'); cell.innerHTML = '<span>~</span>'; return; }
        if (st !== 'ship') return;
        const ship = shipAt(r, c);
        if (!ship) return;
        const idx = ship.horizontal ? c - ship.c : r - ship.r;
        let cls = 'cs-single';
        if (ship.length > 1) {
            if (ship.horizontal)
                cls = idx === 0 ? 'cs-head-h' : idx === ship.length - 1 ? 'cs-tail-h' : 'cs-mid-h';
            else
                cls = idx === 0 ? 'cs-head-v' : idx === ship.length - 1 ? 'cs-tail-v' : 'cs-mid-v';
        }
        cell.classList.add(cls);
        const p = document.createElement('div'); p.className = 'cp'; cell.appendChild(p);
        cell.draggable = true;
        (function (s) {
            cell.addEventListener('dragstart', function (e) {
                dragState = { shipLength: s.length, horizontal: s.horizontal };
                buildGhost(s.length, s.horizontal);
                e.dataTransfer.setDragImage(getGhost(), 17, 17);
                e.dataTransfer.effectAllowed = 'move';
                document.addEventListener('keydown', rotateDragKey);
                setTimeout(() => removeShip(s.id), 0);
            }, { once: true });
        })(ship);
    });
}
function autoPlaceShips() {
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    clearCreateBoard();
    const toPlace = [];
    createFleet.forEach(f => { for (let i = 0; i < f.count; i++) toPlace.push(f.length); });
    toPlace.sort((a, b) => b - a);
    for (let t = 0; t < toPlace.length; t++) {
        const len = toPlace[t]; let ok = false;
        for (let attempt = 0; attempt < 2000 && !ok; attempt++) {
            const horiz = Math.random() < 0.5;
            const r     = Math.floor(Math.random() * N);
            const c     = Math.floor(Math.random() * N);
            if (canPlace(r, c, len, horiz, N)) { placeShip(r, c, len, horiz); ok = true; }
        }
        if (!ok) showCreateMsg('⚠️ Không thể đặt tàu ' + len + ' ô (bảng chật)!');
    }
}
function clearCreateBoard() {
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    placedShips = [];
    createGridData = Array.from({ length: N }, () => Array(N).fill('empty'));
    renderCreateBoard();
    renderShipPalette();
    updateStep2Status();
}

/* ─── Ship Palette: danh sách tàu chưa đặt để kéo vào bảng ─── */
function renderShipPalette() {
    let palette = document.getElementById('shipPalette');
    if (!palette) {
        palette = document.createElement('div');
        palette.id = 'shipPalette';
        palette.style.cssText = [
            'background:#f8f9fa', 'border:1px solid #dee2e6', 'border-radius:8px',
            'padding:12px 14px', 'margin-bottom:12px'
        ].join(';');
        const ba = document.getElementById('createBoardArea');
        ba.parentNode.insertBefore(palette, ba);
    }

    // Tính số tàu còn chưa đặt
    const remaining = {};
    createFleet.forEach(f => { remaining[f.length] = f.count; });
    placedShips.forEach(s => {
        if (remaining[s.length] !== undefined) remaining[s.length]--;
    });

    let html = '<div style="font-size:13px;font-weight:bold;color:#555;margin-bottom:8px">'
        + '⚓ Kéo tàu vào bảng '
        + '<span style="font-weight:normal;color:#888;font-size:12px">'
        + '(nhấn R trong lúc kéo để xoay | double-click ô tàu trên bảng để xóa | click phải để xoay)</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">';

    let hasAny = false;
    createFleet.forEach(f => {
        const rem = Math.max(0, remaining[f.length] || 0);
        if (rem === 0) return;
        hasAny = true;
        // Nhóm theo loại tàu, hiển thị 1 đại diện + số lượng còn lại
        html += '<div class="palette-ship" draggable="true" '
            + 'data-len="' + f.length + '" data-horiz="1" '
            + 'title="Tàu ' + f.length + ' ô — còn ' + rem + ' chiếc" '
            + 'style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:grab;">';
        html += '<div style="display:flex;flex-direction:row;gap:1px;'
            + 'padding:4px 6px;border-radius:6px;border:2px solid #90caf9;background:#e3f2fd">';
        for (let j = 0; j < f.length; j++) {
            html += '<div style="width:26px;height:26px;background:#1e88e5;border-radius:4px;"></div>';
        }
        html += '</div>';
        html += '<span style="font-size:11px;color:#1565c0;font-weight:bold">×' + rem + ' còn lại</span>';
        html += '</div>';
    });

    if (!hasAny) {
        html += '<span style="color:#28a745;font-weight:bold;font-size:14px">✅ Đã đặt đủ tàu!</span>';
    }
    html += '</div>';
    palette.innerHTML = html;

    // Gắn drag events
    palette.querySelectorAll('.palette-ship').forEach(el => {
        el.addEventListener('dragstart', function(e) {
            const len   = parseInt(el.dataset.len);
            const horiz = el.dataset.horiz === '1';
            dragState = { shipLength: len, horizontal: horiz };
            const g = buildGhost(len, horiz);
            e.dataTransfer.setDragImage(g, horiz ? len * 14 : 14, horiz ? 14 : len * 14);
            e.dataTransfer.effectAllowed = 'copy';
            document.addEventListener('keydown', rotateDragKey);
        });
        el.addEventListener('dragend', function() {
            document.removeEventListener('keydown', rotateDragKey);
        });
    });
}
function showCreateMsg(msg) {
    const el = document.getElementById('createStatusMessage');
    el.innerText = msg;
    setTimeout(() => { el.innerText = ''; }, 2200);
}

/* ═══════════════════════════════════════════════════
   CREATE — STEP 3: Choose givens
   ═══════════════════════════════════════════════════ */
function computeCellTypes() {
    cellSolveType = {};
    placedShips.forEach(s => {
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i;
            const c = s.horizontal ? s.c + i : s.c;
            let type;
            if (s.length === 1)      type = 'single';
            else if (s.horizontal)   type = i === 0 ? 'left' : i === s.length - 1 ? 'right' : 'mid';
            else                     type = i === 0 ? 'up'   : i === s.length - 1 ? 'down'  : 'mid';
            cellSolveType[ck(r, c)] = type;
        }
    });
}
function getShapeClass(r, c) {
    const type = cellSolveType[ck(r, c)] || 'single';
    if (type === 'single') return 'gs-single';
    if (type === 'left')   return 'gs-head-h';
    if (type === 'right')  return 'gs-tail-h';
    if (type === 'up')     return 'gs-head-v';
    if (type === 'down')   return 'gs-tail-v';
    // mid — tìm hướng từ ship
    const ship = shipAt(r, c);
    return (ship && ship.horizontal) ? 'gs-mid-h' : 'gs-mid-v';
}

function goToStep3() {
    const totalNeeded = createFleet.reduce((s, f) => s + f.count, 0);
    if (placedShips.length < totalNeeded) { showCreateMsg('⚠️ Chưa đủ tàu!'); return; }
    computeCellTypes();
    givenShipSet = new Set(); obstacleSet = new Set();
    buildGivenBoard();
    const totalShipCells = Object.keys(cellSolveType).length;
    const sl = document.getElementById('givenCountSlider');
    sl.max = totalShipCells;
    sl.value = Math.min(5, totalShipCells);
    onGivenSliderChange();
    setCreateStep(3);
}
function goToStep2FromGiven() {
    givenShipSet = new Set(); obstacleSet = new Set();
    setCreateStep(2);
}

function buildGivenBoard() {
    const N  = parseInt(document.getElementById('createGridSize').value) || 10;
    const ba = document.getElementById('givenBoardArea');
    ba.innerHTML = '';
    const rT = Array(N).fill(0), cT = Array(N).fill(0);
    placedShips.forEach(s => {
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i, c = s.horizontal ? s.c + i : s.c;
            rT[r]++; cT[c]++;
        }
    });
    const layout = document.createElement('div');
    layout.className = 'game-layout';
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-bottom:2px'));
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="hint-cell' + (cT[i] === 0 ? ' dim' : '') + '">' + cT[i] + '</div>',
        'margin-bottom:4px;height:25px'));
    const mid = document.createElement('div');
    mid.className = 'layout-row';
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>'));
    mid.appendChild(mkVG(N, i => '<div class="hint-cell' + (rT[i] === 0 ? ' dim' : '') + '">' + rT[i] + '</div>', 'v-hints'));
    const board = document.createElement('div');
    board.className = 'board-container';
    board.id = 'givenBoard';
    board.style.gridTemplateColumns = 'repeat(' + N + ',35px)';
    board.style.gridTemplateRows    = 'repeat(' + N + ',35px)';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell   = document.createElement('div');
        cell.className  = 'cell';
        cell.dataset.r  = r; cell.dataset.c = c;
        const isShip = createGridData[r][c] === 'ship';
        if (isShip) {
            cell.classList.add('gb-ship');
            cell.classList.add(getShapeClass(r, c));
            const p = document.createElement('div'); p.className = 'cp'; cell.appendChild(p);
        } else {
            cell.classList.add('gb-water');
            cell.innerHTML = '<span style="font-size:13px;color:#5599bb">~</span>';
        }
        (function (rr, cc) { cell.addEventListener('click', () => toggleGivenCell(rr, cc)); })(r, c);
        board.appendChild(cell);
    }
    addCrossHL(board);
    mid.appendChild(board);
    mid.appendChild(mkVG(N, i => '<div class="coord-cell">' + (i + 1) + '</div>', '', 'margin-left:3px'));
    layout.appendChild(mid);
    layout.appendChild(mkHRow(N, 'spacer-left', 'spacer-right',
        i => '<div class="coord-cell">' + getColumnLabel(i) + '</div>', 'margin-top:5px'));
    ba.appendChild(layout);
    resetZoom('givenZoomSlider', 'givenZoomValue', '#givenBoardArea .game-layout');
    updateGivenStats();
}

function toggleGivenCell(r, c) {
    const key    = ck(r, c);
    const isShip = createGridData[r][c] === 'ship';
    if (isShip) {
        if (givenShipSet.has(key)) givenShipSet.delete(key); else givenShipSet.add(key);
    } else {
        if (obstacleSet.has(key)) obstacleSet.delete(key); else obstacleSet.add(key);
    }
    refreshGivenCell(r, c);
    updateGivenStats();
}
function refreshGivenCell(r, c) {
    const cell = document.querySelector('#givenBoard .cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (!cell) return;
    const key    = ck(r, c);
    const isShip = createGridData[r][c] === 'ship';
    cell.classList.remove('gb-ship', 'gb-water', 'gb-given', 'gb-obstacle');
    if (isShip) {
        if (givenShipSet.has(key)) {
            cell.classList.add('gb-given');
            cell.classList.add(getShapeClass(r, c));
        } else {
            cell.classList.add('gb-ship');
            cell.classList.add(getShapeClass(r, c));
        }
        if (!cell.querySelector('.cp')) {
            const p = document.createElement('div'); p.className = 'cp'; cell.appendChild(p);
        }
    } else {
        cell.innerHTML = '';
        if (obstacleSet.has(key)) {
            cell.classList.add('gb-obstacle');
        } else {
            cell.classList.add('gb-water');
            cell.innerHTML = '<span style="font-size:13px;color:#5599bb">~</span>';
        }
    }
}
function refreshAllGivenCells() {
    const N = parseInt(document.getElementById('createGridSize').value) || 10;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) refreshGivenCell(r, c);
}
function updateGivenStats() {
    const total = Object.keys(cellSolveType).length;
    const gs    = givenShipSet.size, obs = obstacleSet.size;
    const pct   = total > 0 ? Math.round(gs / total * 100) : 0;
    const diff  = gs <= 3 ? '🔴 Rất khó' : gs <= 6 ? '🟠 Khó' : pct <= 40 ? '🟡 Trung bình' : '🟢 Dễ';
    document.getElementById('givenStats').innerHTML =
        'Given tàu: <strong>' + gs + '</strong>/' + total + ' ô (' + pct + '%) — ' + diff
        + ' &nbsp;|&nbsp; Obstacle: <strong>' + obs + '</strong> ô';
}

/* Random given */
function onGivenSliderChange() {
    const v     = document.getElementById('givenCountSlider').value;
    document.getElementById('givenCountLabel').innerText = v;
    const total = Object.keys(cellSolveType).length;
    const pct   = total > 0 ? Math.round(parseInt(v) / total * 100) : 0;
    const diff  = parseInt(v) <= 3 ? '🔴 Rất khó' : parseInt(v) <= 6 ? '🟠 Khó' : pct <= 40 ? '🟡 Trung bình' : '🟢 Dễ';
    document.getElementById('givenDiffLabel').innerText = v + ' ô lộ / ' + total + ' tổng (' + pct + '%) — ' + diff;
}
function applyRandomGiven() {
    const count = parseInt(document.getElementById('givenCountSlider').value);
    const totalShipCells = Object.keys(cellSolveType).length;
    givenShipSet = new Set();
    
    if (count <= 0) {
        refreshAllGivenCells();
        updateGivenStats();
        return;
    }

    const singles = placedShips.filter(s => s.length === 1);
    const multiCellShips = placedShips.filter(s => s.length > 1);
    const chosen = [];

    // Giới hạn nghiêm ngặt
    const maxSinglesStrict = Math.ceil(singles.length * 0.6);
    const maxPerShipStrict = (ship) => ship.length === 2 ? 1 : Math.ceil(ship.length * 0.7);
    const strictMaxMulti = multiCellShips.reduce((sum, s) => sum + Math.min(s.length, maxPerShipStrict(s)), 0);
    const maxStrict = maxSinglesStrict + strictMaxMulti;
    const maxWithAllSingles = singles.length + strictMaxMulti;

    let mode = 'strict';
    if (count > maxWithAllSingles) {
        mode = 'full';
    } else if (count > maxStrict) {
        mode = 'relaxedSingles';
    }

    // ---- Strict mode (giữ nguyên tinh thần cũ, có fallback) ----
    if (mode === 'strict') {
        const targetSingles = Math.min(maxSinglesStrict, Math.floor(count * 0.3));
        const targetMultiCell = count - targetSingles;

        const shuffledSingles = [...singles].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(targetSingles, shuffledSingles.length); i++) {
            chosen.push(ck(shuffledSingles[i].r, shuffledSingles[i].c));
        }

        if (targetMultiCell > 0) {
            const endCells = [], midCells = [];
            const shipCellCount = new Map();
            const shuffledMulti = [...multiCellShips].sort(() => Math.random() - 0.5);
            for (const s of shuffledMulti) {
                for (let i = 0; i < s.length; i++) {
                    const r = s.horizontal ? s.r : s.r + i;
                    const c = s.horizontal ? s.c + i : s.c;
                    const key = ck(r, c);
                    const isMid = i > 0 && i < s.length - 1;
                    (isMid ? midCells : endCells).push({ key, ship: s });
                }
            }

            const midQuota = Math.min(Math.max(0, Math.round(targetMultiCell * 0.1)), midCells.length);
            const endQuota = targetMultiCell - midQuota;

            function pickCells(pool, quota) {
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                let added = 0;
                for (const { key, ship } of shuffled) {
                    if (added >= quota) break;
                    if (chosen.includes(key)) continue;
                    const cur = shipCellCount.get(ship) || 0;
                    if (cur >= maxPerShipStrict(ship)) continue;
                    chosen.push(key);
                    shipCellCount.set(ship, cur + 1);
                    added++;
                }
                return added;
            }

            let endAdded = pickCells(endCells, endQuota);
            let midAdded = pickCells(midCells, midQuota);
            let deficit = targetMultiCell - endAdded - midAdded;

            // Bù deficit nếu thiếu (bỏ ràng buộc ship)
            if (deficit > 0) {
                const remainingCells = [...endCells, ...midCells].filter(item => !chosen.includes(item.key));
                const shuffledRemaining = remainingCells.sort(() => Math.random() - 0.5);
                for (const item of shuffledRemaining) {
                    if (deficit <= 0) break;
                    chosen.push(item.key);
                    deficit--;
                }
            }
        }
    }

    // ---- RelaxedSingles mode (bỏ giới hạn singles, giữ ràng buộc tàu dài) ----
    else if (mode === 'relaxedSingles') {
        const neededSingles = Math.min(singles.length, count);
        const shuffledSingles = [...singles].sort(() => Math.random() - 0.5);
        for (let i = 0; i < neededSingles; i++) {
            chosen.push(ck(shuffledSingles[i].r, shuffledSingles[i].c));
        }

        let remaining = count - chosen.length;
        if (remaining > 0) {
            const endCells = [], midCells = [];
            const shipCellCount = new Map();
            const shuffledMulti = [...multiCellShips].sort(() => Math.random() - 0.5);
            for (const s of shuffledMulti) {
                for (let i = 0; i < s.length; i++) {
                    const r = s.horizontal ? s.r : s.r + i;
                    const c = s.horizontal ? s.c + i : s.c;
                    const key = ck(r, c);
                    const isMid = i > 0 && i < s.length - 1;
                    (isMid ? midCells : endCells).push({ key, ship: s });
                }
            }

            function pickCellsRelaxed(pool, needed) {
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                let added = 0;
                for (const { key, ship } of shuffled) {
                    if (added >= needed) break;
                    if (chosen.includes(key)) continue;
                    const cur = shipCellCount.get(ship) || 0;
                    if (cur >= maxPerShipStrict(ship)) continue;
                    chosen.push(key);
                    shipCellCount.set(ship, cur + 1);
                    added++;
                }
                return added;
            }

            let endAdded = pickCellsRelaxed(endCells, remaining);
            remaining -= endAdded;
            if (remaining > 0) {
                pickCellsRelaxed(midCells, remaining);
            }
        }
    }

    // ---- Full mode (không giới hạn) ----
    else {
        const shuffledSingles = [...singles].sort(() => Math.random() - 0.5);
        for (const s of shuffledSingles) {
            if (chosen.length >= count) break;
            chosen.push(ck(s.r, s.c));
        }
        if (chosen.length < count) {
            const endCells = [], midCells = [];
            for (const s of multiCellShips) {
                for (let i = 0; i < s.length; i++) {
                    const r = s.horizontal ? s.r : s.r + i;
                    const c = s.horizontal ? s.c + i : s.c;
                    const key = ck(r, c);
                    const isMid = i > 0 && i < s.length - 1;
                    (isMid ? midCells : endCells).push(key);
                }
            }
            const shuffledEnd = endCells.sort(() => Math.random() - 0.5);
            for (const key of shuffledEnd) {
                if (chosen.length >= count) break;
                if (!chosen.includes(key)) chosen.push(key);
            }
            if (chosen.length < count) {
                const shuffledMid = midCells.sort(() => Math.random() - 0.5);
                for (const key of shuffledMid) {
                    if (chosen.length >= count) break;
                    if (!chosen.includes(key)) chosen.push(key);
                }
            }
        }
    }

    givenShipSet = new Set(chosen);
    refreshAllGivenCells();
    updateGivenStats();
}
function clearAllGiven() {
    givenShipSet = new Set(); obstacleSet = new Set();
    refreshAllGivenCells();
    updateGivenStats();
}

/* Export to Solve mode */
function exportToPuzzle() {
    const N  = parseInt(document.getElementById('createGridSize').value) || 10;
    const rT = Array(N).fill(0), cT = Array(N).fill(0);
    placedShips.forEach(s => {
        for (let i = 0; i < s.length; i++) {
            const r = s.horizontal ? s.r : s.r + i, c = s.horizontal ? s.c + i : s.c;
            rT[r]++; cT[c]++;
        }
    });
    const given = [];
    givenShipSet.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        given.push({ r, c, type: cellSolveType[key] });
    });
    obstacleSet.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        given.push({ r, c, type: 'obstacle' });
    });
    fleet = createFleet.map(f => ({ length: f.length, count: f.count }));
    switchMode('solve');
    document.getElementById('gridSize').value = N;
    initSolveMode();
    document.getElementById('rowHints').value = rT.join(' ');
    document.getElementById('colHints').value = cT.join(' ');
    syncHints();
    renderFleetUI();
    const cells = document.querySelectorAll('#boardArea .board-container .cell');
    given.forEach(g => {
        setCellState(g.r, g.c, cells[g.r * N + g.c], g.type);
    });
    document.getElementById('statusMessage').style.color = '#28a745';
    document.getElementById('statusMessage').innerText =
        '✅ Đã tạo đề! Given tàu: ' + givenShipSet.size + ', Obstacle: ' + obstacleSet.size + '. Nhấn Giải để kiểm tra.';
}

/* Step indicator */
function setCreateStep(step) {
    document.getElementById('createStep1').style.display = step === 1 ? '' : 'none';
    document.getElementById('createStep2').style.display = step === 2 ? '' : 'none';
    document.getElementById('createStep3').style.display = step === 3 ? '' : 'none';
    [1, 2, 3].forEach(n => {
        const c = document.getElementById('sc' + n);
        c.classList.remove('active', 'done');
        if (n < step)      c.classList.add('done');
        else if (n === step) c.classList.add('active');
    });
    const l12 = document.getElementById('sl12'), l23 = document.getElementById('sl23');
    if (l12) l12.classList.toggle('done', step > 1);
    if (l23) l23.classList.toggle('done', step > 2);
}
/* ═══════════════════════════════════════════════════
   SCAN MODE — Dán ảnh từ clipboard (Ctrl+V)
   ═══════════════════════════════════════════════════ */

let _scanImageFile = null; // lưu file ảnh đã dán

// Khởi tạo lắng nghe paste toàn trang khi ở tab scan
function initScanPasteListener() {
    document.addEventListener('paste', function(e) {
        if (currentMode !== 'scan') return;
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                setScanImage(file);
                break;
            }
        }
    });
}

// Khi người dùng click vùng dán → focus để nhận Ctrl+V
function triggerPasteFromClipboard() {
    // Thử dùng Clipboard API (yêu cầu quyền) nếu có
    if (navigator.clipboard && navigator.clipboard.read) {
        navigator.clipboard.read().then(items => {
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    item.getType(imageType).then(blob => {
                        const file = new File([blob], 'paste.png', { type: imageType });
                        setScanImage(file);
                    });
                    return;
                }
            }
            // Không tìm thấy ảnh trong clipboard
            showScanHint();
        }).catch(() => showScanHint());
    } else {
        showScanHint();
    }
}

function showScanHint() {
    const area = document.getElementById('scanPasteArea');
    area.style.borderColor = '#f0ad4e';
    area.style.background  = '#fffbf0';
    setTimeout(() => {
        area.style.borderColor = '#90b4d4';
        area.style.background  = '#f0f7ff';
    }, 1200);
    document.getElementById('scanStatus').style.color = '#888';
    document.getElementById('scanStatus').innerText   = 'Nhấn Ctrl+V sau khi chụp màn hình hoặc copy ảnh vào clipboard.';
}

function setScanImage(file) {
    _scanImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('scanPreview');
        preview.src = e.target.result;
        preview.style.display = '';
        document.getElementById('scanPastePlaceholder').style.display = 'none';
        document.getElementById('scanClearBtn').style.display = '';
        document.getElementById('scanPasteArea').style.background = '#eaf5ea';
        document.getElementById('scanPasteArea').style.borderColor = '#5cb85c';
        document.getElementById('scanStatus').style.color  = '#28a745';
        document.getElementById('scanStatus').innerText = '✅ Đã dán ảnh. Nhấn "Scan" để nhận diện.';
    };
    reader.readAsDataURL(file);
}

function clearScanImage(e) {
    e.stopPropagation();
    _scanImageFile = null;
    const preview = document.getElementById('scanPreview');
    preview.src = '';
    preview.style.display = 'none';
    document.getElementById('scanPastePlaceholder').style.display = '';
    document.getElementById('scanClearBtn').style.display = 'none';
    document.getElementById('scanPasteArea').style.background   = '#f0f7ff';
    document.getElementById('scanPasteArea').style.borderColor  = '#90b4d4';
    document.getElementById('scanStatus').innerText = '';
}

// Gửi ảnh lên server Python để nhận diện
async function startScan() {
    const gridSize = parseInt(document.getElementById('scanGridSize').value);
    const statusEl = document.getElementById('scanStatus');

    if (!_scanImageFile) {
        statusEl.style.color = '#dc3545';
        statusEl.innerText = 'Vui lòng dán ảnh trước (Ctrl+V)!';
        return;
    }

    statusEl.style.color = '#007bff';
    statusEl.innerText = '⏳ Đang gửi ảnh lên server...';

    const formData = new FormData();
    formData.append('image', _scanImageFile, 'scan.png');
    formData.append('grid_size', gridSize);

    try {
        const response = await fetch('https://battleshipssolitaire-solver.onrender.com/scan', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        statusEl.innerText = '✅ Nhận diện thành công! Đang chuyển sang chế độ Giải...';
        populateSolveFromScan(data, gridSize);

    } catch (err) {
        statusEl.style.color = '#dc3545';
        statusEl.innerText = '❌ Lỗi: ' + err.message;
    }
}

// Điền dữ liệu đã scan vào chế độ Solve
function populateSolveFromScan(data, gridSize) {
    // Set kích thước bảng
    document.getElementById('gridSize').value = gridSize;
    
    // Tạo lại bảng mới
    initSolveMode();

    // Điền gợi ý hàng/cột từ scan
    document.getElementById('rowHints').value = data.row_hints.join(' ');
    document.getElementById('colHints').value = data.col_hints.join(' ');
    syncHints();

    // Lấy tất cả cell
    const cells = document.querySelectorAll('#boardArea .board-container .cell');
    
    // Đặt obstacle (ô nước)
    for (const ob of data.obstacles) {
        const idx = (ob.r - 1) * gridSize + (ob.c - 1);
        setCellState(ob.r - 1, ob.c - 1, cells[idx], 'obstacle');
    }
    
    // Map type từ Python sang UI
    const typeMap = {
        'Single': 'single',
        'Mid': 'mid',
        'Up': 'down',
        'Down': 'up',
        'Left': 'right',
        'Right': 'left'
    };
    
    // Đặt các ô tàu với hướng tương ứng
    for (const sh of data.shapes) {
        const idx = (sh.r - 1) * gridSize + (sh.c - 1);
        setCellState(sh.r - 1, sh.c - 1, cells[idx], typeMap[sh.type]);
    }

    // Fleet theo kích thước bảng
    const fleetBySize = {
        6:  [ { length:3, count:1 }, { length:2, count:2 }, { length:1, count:3 } ],
        8:  [ { length:4, count:1 }, { length:3, count:2 }, { length:2, count:3 }, { length:1, count:3 } ],
        10: [ { length:4, count:1 }, { length:3, count:2 }, { length:2, count:3 }, { length:1, count:4 } ],
        15: [ { length:5, count:1 }, { length:4, count:2 }, { length:3, count:3 }, { length:2, count:4 }, { length:1, count:5 } ],
        20: [ { length:7, count:1 }, { length:6, count:2 }, { length:5, count:3 }, { length:4, count:4 }, { length:3, count:5 }, { length:2, count:6 }, { length:1, count:7 } ],
        25: [ { length:8, count:1 }, { length:7, count:2 }, { length:6, count:3 }, { length:5, count:4 }, { length:4, count:5 }, { length:3, count:6 }, { length:2, count:7 }, { length:1, count:8 } ],
        30: [ { length:9, count:1 }, { length:8, count:2 }, { length:7, count:3 }, { length:6, count:4 }, { length:5, count:5 }, { length:4, count:6 }, { length:3, count:7 }, { length:2, count:8 }, { length:1, count:9 } ],
    };
    fleet = fleetBySize[gridSize] || fleetBySize[10];
    renderFleetUI();

    // Thông báo thành công và chuyển sang tab Solve
    document.getElementById('statusMessage').style.color = '#28a745';
    document.getElementById('statusMessage').innerText = '✅ Đã tải dữ liệu từ scan. Kiểm tra và nhấn Giải!';
    switchMode('solve');
}
/* INIT */
window.onload = function () {
    initSolveMode();
    renderCreateFleetEditor();
    setCreateStep(1);
    initScanPasteListener();
    let g = document.getElementById('dragGhost');
    if (!g) {
        g = document.createElement('div');
        g.id = 'dragGhost';
        g.style.cssText = 'position:fixed;left:-999px;top:0;pointer-events:none;z-index:9999;display:flex;gap:1px;';
        document.body.appendChild(g);
    }
};
