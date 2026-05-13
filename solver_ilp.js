(function () {
    'use strict';


    async function ensureGLPK() {
        if (window.glpk) return; // đã có rồi
        const mod = await import('https://cdn.jsdelivr.net/npm/glpk.js@4.0.1/+esm');
        // mod.default là factory function — gán vào window.glpk để gọi glpk()
        window.glpk = mod.default;
    }

    function buildHalo(shipCells, R, C) {
        const shipSet = new Set(shipCells.map(([r, c]) => `${r},${c}`));
        const haloSet = new Set();
        for (const [sr, sc] of shipCells) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = sr + dr, nc = sc + dc;
                    if (nr >= 0 && nr < R && nc >= 0 && nc < C && !shipSet.has(`${nr},${nc}`))
                        haloSet.add(`${nr},${nc}`);
                }
            }
        }
        return Array.from(haloSet).map(s => s.split(',').map(Number));
    }

    async function solve(puzzle) {
        await ensureGLPK();

        const glpkInstance = await glpk(); // giống hệt code gốc
        const { R, C, row_hints: rowHints, col_hints: colHints, fleet, given: givens } = puzzle;
        const name = puzzle.name || 'Battleship';

        // Bước 1: Sinh toàn bộ pattern
        const patterns = [];
        for (const [sizeStr, count] of Object.entries(fleet)) {
            const size = parseInt(sizeStr, 10);
            if (count === 0) continue;
            for (let r = 0; r < R; r++) {
                for (let c = 0; c < C; c++) {
                    if (c + size <= C) {
                        const shipCells = [];
                        for (let i = 0; i < size; i++) shipCells.push([r, c + i]);
                        patterns.push({ size, shipCells, halo: buildHalo(shipCells, R, C), start: [r, c], dir: 'horizontal' });
                    }
                    if (size > 1 && r + size <= R) {
                        const shipCells = [];
                        for (let i = 0; i < size; i++) shipCells.push([r + i, c]);
                        patterns.push({ size, shipCells, halo: buildHalo(shipCells, R, C), start: [r, c], dir: 'vertical' });
                    }
                }
            }
        }

        // Bước 2: Lọc pattern dựa trên given
        const validPatterns = patterns.filter(p => {
        for (const g of givens) {
            const { r: gr, c: gc, type } = g;
            const coversGiven     = p.shipCells.some(([r, c]) => r === gr && c === gc);
            const haloCoversGiven = p.halo.some(([r, c]) => r === gr && c === gc);

            if (type === 'obstacle') {
                if (coversGiven) return false;
            } else {
                if (coversGiven) {
                    if (type === 'single') {
                        if (p.size !== 1) return false;
                    } else if (type === 'left') {
                        if (!(p.size >= 2 && p.dir === 'horizontal' && p.start[0] === gr && p.start[1] === gc)) return false;
                    } else if (type === 'right') {
                        if (!(p.size >= 2 && p.dir === 'horizontal' && p.start[0] === gr && p.start[1] + p.size - 1 === gc)) return false;
                    } else if (type === 'up') {
                        if (!(p.size >= 2 && p.dir === 'vertical' && p.start[0] === gr && p.start[1] === gc)) return false;
                    } else if (type === 'down') {
                        if (!(p.size >= 2 && p.dir === 'vertical' && p.start[0] + p.size - 1 === gr && p.start[1] === gc)) return false;
                    } else if (type === 'mid') {
                        const isEnd = (p.start[0] === gr && p.start[1] === gc) ||
                                      (p.dir === 'horizontal'
                                          ? (p.start[0] === gr && p.start[1] + p.size - 1 === gc)
                                          : (p.start[0] + p.size - 1 === gr && p.start[1] === gc));
                        if (isEnd || p.size < 3) return false;
                    }
                } else {
                    if (haloCoversGiven) return false;
                }
            }
        }
        return true;
    });

        if (validPatterns.length === 0) {
            console.warn(`[${name}] Không có pattern hợp lệ sau khi lọc.`);
            return null;
        }

        // Bước 3: Xây dựng mô hình ILP
        const lp = {
            name,
            objective: { direction: glpkInstance.GLP_MIN, name: 'obj', vars: [] },
            subjectTo: [],
            binaries: validPatterns.map((_, i) => `x${i}`)
        };

        // (29) Không chạm nhau
        for (let r = 0; r < R - 1; r++) {
            for (let c = 0; c < C - 1; c++) {
                const vars = [];
                validPatterns.forEach((p, i) => {
                    const inBox = p.shipCells.some(([sr, sc]) =>
                        (sr === r     && sc === c    ) ||
                        (sr === r     && sc === c + 1) ||
                        (sr === r + 1 && sc === c    ) ||
                        (sr === r + 1 && sc === c + 1)
                    );
                    if (inBox) vars.push({ name: `x${i}`, coef: 1 });
                });
                if (vars.length > 0) {
                    lp.subjectTo.push({
                        name: `noconflict_${r}_${c}`,
                        vars,
                        bnds: { type: glpkInstance.GLP_UP, ub: 1, lb: 0 }
                    });
                }
            }
        }

        // (28) Số lượng tàu
        for (const [sizeStr, count] of Object.entries(fleet)) {
            const size = parseInt(sizeStr, 10);
            const vars = [];
            validPatterns.forEach((p, i) => {
                if (p.size === size) vars.push({ name: `x${i}`, coef: 1.0 });
            });
            if (vars.length > 0) {
                lp.subjectTo.push({
                    name: `fleet_${size}`,
                    vars,
                    bnds: { type: glpkInstance.GLP_FX, ub: count, lb: count }
                });
            }
        }

        // (26) Row hints
        for (let r = 0; r < R; r++) {
            const vars = [];
            validPatterns.forEach((p, i) => {
                const cnt = p.shipCells.filter(([rr]) => rr === r).length;
                if (cnt > 0) vars.push({ name: `x${i}`, coef: cnt });
            });
            lp.subjectTo.push({
                name: `row_${r}`,
                vars,
                bnds: { type: glpkInstance.GLP_FX, ub: rowHints[r], lb: rowHints[r] }
            });
        }

        // (27) Col hints
        for (let c = 0; c < C; c++) {
            const vars = [];
            validPatterns.forEach((p, i) => {
                const cnt = p.shipCells.filter(([, cc]) => cc === c).length;
                if (cnt > 0) vars.push({ name: `x${i}`, coef: cnt });
            });
            lp.subjectTo.push({
                name: `col_${c}`,
                vars,
                bnds: { type: glpkInstance.GLP_FX, ub: colHints[c], lb: colHints[c] }
            });
        }

        // (30) Given ship cells
        givens.forEach(g => {
            if (g.type === 'obstacle') return;
            const vars = [];
            validPatterns.forEach((p, i) => {
                if (p.shipCells.some(([r, c]) => r === g.r && c === g.c))
                    vars.push({ name: `x${i}`, coef: 1.0 });
            });
            if (vars.length > 0) {
                lp.subjectTo.push({
                    name: `given_ship_${g.r}_${g.c}`,
                    vars,
                    bnds: { type: glpkInstance.GLP_FX, ub: 1.0, lb: 1.0 }
                });
            }
        });

        // Obstacle cells
        givens.forEach(g => {
            if (g.type !== 'obstacle') return;
            const vars = [];
            validPatterns.forEach((p, i) => {
                if (p.shipCells.some(([r, c]) => r === g.r && c === g.c))
                    vars.push({ name: `x${i}`, coef: 1.0 });
            });
            if (vars.length > 0) {
                lp.subjectTo.push({
                    name: `obstacle_${g.r}_${g.c}`,
                    vars,
                    bnds: { type: glpkInstance.GLP_FX, ub: 0.0, lb: 0.0 }
                });
            }
        });

        // Bước 4: Giải
        const t0 = performance.now();
        const result = await glpkInstance.solve(lp, { msglev: glpkInstance.GLP_MSG_OFF, presol: true });
        const elapsed = performance.now() - t0;

        if (result.result.status !== glpkInstance.GLP_OPT) {
            console.log(`[${name}] Không tìm thấy nghiệm (${elapsed.toFixed(0)}ms). Status:`, result.result.status);
            return null;
        }

        // Bước 5: Dựng board
        const board = Array.from({ length: R }, () => Array(C).fill(0));
        validPatterns.forEach((p, i) => {
            if (result.result.vars[`x${i}`] > 0.5)
                p.shipCells.forEach(([r, c]) => { board[r][c] = 1; });
        });

        console.log(`[${name}] Giải xong trong ${elapsed.toFixed(2)}ms`);
        return board;
    }

    window.solverILP = { solve, name: 'ILP (GLPK)', requiresNetwork: true };
})();