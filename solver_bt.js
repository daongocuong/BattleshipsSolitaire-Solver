// solver_bt.js — Giữ nguyên 100% logic gốc
// Contract: window.solverBT.solve(puzzle) → Promise<board[][]|null>

const DIRECTION = {
    left:  [[0, 1],  [0, -1]],
    right: [[0, -1], [0, 1]],
    up:    [[1, 0],  [-1, 0]],
    down:  [[-1, 0], [1, 0]]
};

const countVal = (arr, val) => arr.filter(x => x === val).length;
const getCol = (board, c) => board.map(row => row[c]);

function makeBoard(R, C) {
    return Array.from({length: R}, () => Array(C).fill(-1));
}

function forceVal(board, r, c, v) {
    const R = board.length, C = board[0].length;
    if (r < 0 || r >= R || c < 0 || c >= C) {
        return v === 0;
    }
    if (board[r][c] === -1 || board[r][c] === v) {
        board[r][c] = v;
        return true;
    }
    return false;
}

function diagWater(board, r, c) {
    const dirs = [[-1,-1], [-1,1], [1,-1], [1,1]];
    for (let [dr, dc] of dirs) {
        if (!forceVal(board, r+dr, c+dc, 0)) return false;
    }
    return true;
}

function resolveMid(board, r, c) {
    const R = board.length, C = board[0].length;

    const upVal    = (r - 1 >= 0) ? board[r-1][c] : 0;
    const downVal  = (r + 1 <  R) ? board[r+1][c] : 0;
    const leftVal  = (c - 1 >= 0) ? board[r][c-1] : 0;
    const rightVal = (c + 1 <  C) ? board[r][c+1] : 0;

    const upBlocked    = (r - 1 < 0) || upVal === 0;
    const downBlocked  = (r + 1 >= R) || downVal === 0;
    const leftBlocked   = (c - 1 < 0) || leftVal === 0;
    const rightBlocked  = (c + 1 >= C) || rightVal === 0;

    const vertBlocked = upBlocked || downBlocked;
    const horizBlocked = leftBlocked || rightBlocked;
    if (vertBlocked && horizBlocked) return false;

    const hasUp    = upVal === 1;
    const hasDown  = downVal === 1;
    const hasLeft  = leftVal === 1;
    const hasRight = rightVal === 1;

    const vertShip   = hasUp || hasDown;
    const horizShip  = hasLeft || hasRight;

    if (vertShip && horizShip) return false;

    if (vertShip) {
        if (vertBlocked) return false;
        if (!forceVal(board, r-1, c, 1)) return false;
        if (!forceVal(board, r+1, c, 1)) return false;
        if (!forceVal(board, r, c-1, 0)) return false;
        if (!forceVal(board, r, c+1, 0)) return false;
        return true;
    }
    if (horizShip) {
        if (horizBlocked) return false;
        if (!forceVal(board, r, c-1, 1)) return false;
        if (!forceVal(board, r, c+1, 1)) return false;
        if (!forceVal(board, r-1, c, 0)) return false;
        if (!forceVal(board, r+1, c, 0)) return false;
        return true;
    }

    if (horizBlocked) {
        if (!forceVal(board, r-1, c, 1)) return false;
        if (!forceVal(board, r+1, c, 1)) return false;
        if (!forceVal(board, r, c-1, 0)) return false;
        if (!forceVal(board, r, c+1, 0)) return false;
        return true;
    }
    if (vertBlocked) {
        if (!forceVal(board, r, c-1, 1)) return false;
        if (!forceVal(board, r, c+1, 1)) return false;
        if (!forceVal(board, r-1, c, 0)) return false;
        if (!forceVal(board, r+1, c, 0)) return false;
        return true;
    }

    return true;
}

function applyGiven(board, puzzle) {
    const R = board.length, C = board[0].length;

    for (let r = 0; r < R; r++) {
        if (puzzle.row_hints[r] === 0) {
            for (let c = 0; c < C; c++) {
                if (!forceVal(board, r, c, 0)) return false;
            }
        }
    }
    for (let c = 0; c < C; c++) {
        if (puzzle.col_hints[c] === 0) {
            for (let r = 0; r < R; r++) {
                if (!forceVal(board, r, c, 0)) return false;
            }
        }
    }

    for (let g of puzzle.given) {
        const r = g.r, c = g.c, t = g.type;
        if (t === "obstacle") {
            if (!forceVal(board, r, c, 0)) return false;
            continue;
        }

        if (!forceVal(board, r, c, 1)) return false;
        if (!diagWater(board, r, c)) return false;

        if (t === "single") {
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                if (!forceVal(board, r+dr, c+dc, 0)) return false;
            }
        } else if (DIRECTION[t]) {
            const df = DIRECTION[t][0];
            const bf = DIRECTION[t][1];
            const fr = r + df[0], fc = c + df[1];
            const br = r + bf[0], bc = c + bf[1];

            if (!forceVal(board, fr, fc, 1)) return false;
            if (!forceVal(board, br, bc, 0)) return false;
            if (!diagWater(board, r, c)) return false;
            if (!diagWater(board, fr, fc)) return false;

            if (df[0] === 0) {
                if (!forceVal(board, r-1, c, 0)) return false;
                if (!forceVal(board, r+1, c, 0)) return false;
                if (!forceVal(board, fr-1, fc, 0)) return false;
                if (!forceVal(board, fr+1, fc, 0)) return false;
            } else {
                if (!forceVal(board, r, c-1, 0)) return false;
                if (!forceVal(board, r, c+1, 0)) return false;
                if (!forceVal(board, fr, fc-1, 0)) return false;
                if (!forceVal(board, fr, fc+1, 0)) return false;
            }
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (let g of puzzle.given) {
            if (g.type !== "mid") continue;
            const snap = board.flat().join(',');
            if (!resolveMid(board, g.r, g.c)) return false;
            if (board.flat().join(',') !== snap) changed = true;
        }
    }
    return true;
}

function noDiag(board, r, c) {
    if (board[r][c] !== 1) return true;
    const R = board.length, C = board[0].length;
    for (let [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr >= 0 && nr < R && nc >= 0 && nc < C && board[nr][nc] === 1) return false;
    }
    return true;
}

function countPartialFleet(board) {
    const R = board.length, C = board[0].length;
    const vis = Array.from({length: R}, () => Array(C).fill(false));
    const complete = {};

    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            if (vis[r][c] || board[r][c] !== 1) continue;
            vis[r][c] = true;
            let len = 1;
            let isComplete = true;

            if (r + 1 < R && board[r+1][c] === 1) {
                let rr = r;
                while (rr + 1 < R && board[rr+1][c] === 1) {
                    rr++;
                    vis[rr][c] = true;
                    len++;
                }
                if (r > 0 && board[r-1][c] === -1) isComplete = false;
                if (rr + 1 < R && board[rr+1][c] === -1) isComplete = false;
            }
            else if (c + 1 < C && board[r][c+1] === 1) {
                let cc = c;
                while (cc + 1 < C && board[r][cc+1] === 1) {
                    cc++;
                    vis[r][cc] = true;
                    len++;
                }
                if (c > 0 && board[r][c-1] === -1) isComplete = false;
                if (cc + 1 < C && board[r][cc+1] === -1) isComplete = false;
            }
            else {
                if ((r > 0 && board[r-1][c] === -1) ||
                    (r + 1 < R && board[r+1][c] === -1) ||
                    (c > 0 && board[r][c-1] === -1) ||
                    (c + 1 < C && board[r][c+1] === -1)) {
                    isComplete = false;
                }
            }

            if (isComplete) {
                complete[len] = (complete[len] || 0) + 1;
            }
        }
    }
    return complete;
}

function checkFleetConstraint(board, puzzle) {
    const complete = countPartialFleet(board);
    let totalComplete = 0;
    const totalRequired = Object.values(puzzle.fleet).reduce((a,b) => a+b, 0);

    for (let size in complete) {
        const maxAllowed = puzzle.fleet[size] || 0;
        if (complete[size] > maxAllowed) return false;
        totalComplete += complete[size];
    }
    if (totalComplete > totalRequired) return false;
    return true;
}

function violatesLocal(board, puzzle, r, c) {
    const rowCount1 = countVal(board[r], 1);
    const rowCountUnk = countVal(board[r], -1);
    if (rowCount1 > puzzle.row_hints[r]) return true;
    if (rowCount1 + rowCountUnk < puzzle.row_hints[r]) return true;

    const col = getCol(board, c);
    const colCount1 = countVal(col, 1);
    const colCountUnk = countVal(col, -1);
    if (colCount1 > puzzle.col_hints[c]) return true;
    if (colCount1 + colCountUnk < puzzle.col_hints[c]) return true;

    if (!noDiag(board, r, c)) return true;
    if (!checkFleetConstraint(board, puzzle)) return true;

    return false;
}

function propagate(board, puzzle) {
    const R = board.length, C = board[0].length;
    let changed = true;

    while (changed) {
        changed = false;

        for (let r = 0; r < R; r++) {
            let s = countVal(board[r], 1);
            let unk = [];
            for (let c=0; c<C; c++) if (board[r][c] === -1) unk.push(c);
            let need = puzzle.row_hints[r] - s;
            if (need < 0) return false;
            if (need === 0 && unk.length > 0) {
                for (let c of unk) if (!forceVal(board, r, c, 0)) return false;
                changed = true;
            } else if (need === unk.length && need > 0) {
                for (let c of unk) {
                    if (!forceVal(board, r, c, 1)) return false;
                    if (!noDiag(board, r, c)) return false;
                }
                changed = true;
            }
        }

        for (let c = 0; c < C; c++) {
            let col = getCol(board, c);
            let s = countVal(col, 1);
            let unk = [];
            for (let r=0; r<R; r++) if (board[r][c] === -1) unk.push(r);
            let need = puzzle.col_hints[c] - s;
            if (need < 0) return false;
            if (need === 0 && unk.length > 0) {
                for (let r of unk) if (!forceVal(board, r, c, 0)) return false;
                changed = true;
            } else if (need === unk.length && need > 0) {
                for (let r of unk) {
                    if (!forceVal(board, r, c, 1)) return false;
                    if (!noDiag(board, r, c)) return false;
                }
                changed = true;
            }
        }

        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                if (board[r][c] === 1) {
                    for (let [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                        if (!forceVal(board, r+dr, c+dc, 0)) return false;
                    }
                }
            }
        }

        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                if (board[r][c] !== 1) continue;
                const bu = (r === 0 || board[r-1][c] === 0);
                const bd = (r === R-1 || board[r+1][c] === 0);
                const bl = (c === 0 || board[r][c-1] === 0);
                const br = (c === C-1 || board[r][c+1] === 0);

                if (bu && bd) {
                    if (!forceVal(board, r-1, c, 0)) return false;
                    if (!forceVal(board, r+1, c, 0)) return false;
                }
                if (bl && br) {
                    if (!forceVal(board, r, c-1, 0)) return false;
                    if (!forceVal(board, r, c+1, 0)) return false;
                }
            }
        }

        for (let g of puzzle.given) {
            if (g.type !== "mid") continue;
            const snap = board.flat().join(',');
            if (!resolveMid(board, g.r, g.c)) return false;
            if (board.flat().join(',') !== snap) changed = true;
        }

        if (!checkFleetConstraint(board, puzzle)) return false;
    }
    return true;
}

function countFleetSizes(board) {
    const R = board.length, C = board[0].length;
    const vis = Array.from({length: R}, () => Array(C).fill(false));
    const sizes = {};
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            if (vis[r][c] || board[r][c] !== 1) continue;
            vis[r][c] = true;
            let len = 1;
            let rr = r;
            while (rr+1 < R && board[rr+1][c] === 1) { rr++; vis[rr][c] = true; len++; }
            if (len === 1) {
                let cc = c;
                while (cc+1 < C && board[r][cc+1] === 1) { cc++; vis[r][cc] = true; len++; }
            }
            sizes[len] = (sizes[len] || 0) + 1;
        }
    }
    return sizes;
}

function isSolution(board, puzzle) {
    const R = board.length, C = board[0].length;
    for (let r=0; r<R; r++) {
        if (board[r].includes(-1)) return false;
        if (countVal(board[r], 1) !== puzzle.row_hints[r]) return false;
    }
    for (let c=0; c<C; c++) {
        const col = getCol(board, c);
        if (countVal(col, 1) !== puzzle.col_hints[c]) return false;
    }
    for (let r=0; r<R; r++) {
        for (let c=0; c<C; c++) {
            if (board[r][c] === 1 && !noDiag(board, r, c)) return false;
        }
    }
    const foundFleet = countFleetSizes(board);
    for (let sz in puzzle.fleet) {
        if ((foundFleet[sz] || 0) !== puzzle.fleet[sz]) return false;
    }
    for (let sz in foundFleet) {
        if ((puzzle.fleet[sz] || 0) !== foundFleet[sz]) return false;
    }
    return true;
}

function findNextCell(board, puzzle) {
    const R = board.length, C = board[0].length;
    let best = null, bestScore = Infinity;

    for (let r = 0; r < R; r++) {
        const ru = countVal(board[r], -1);
        if (ru === 0) continue;
        for (let c = 0; c < C; c++) {
            if (board[r][c] !== -1) continue;
            const cu = countVal(getCol(board, c), -1);
            const score = ru * cu;
            if (score < bestScore) {
                bestScore = score;
                best = {r, c};
            }
        }
    }
    if (!best) return null;

    const rowNeed = puzzle.row_hints[best.r] - countVal(board[best.r], 1);
    const colNeed = puzzle.col_hints[best.c] - countVal(getCol(board, best.c), 1);
    return { ...best, tryOrder: rowNeed > colNeed ? [1, 0] : [0, 1] };
}

function _backtrack(board, puzzle) {
    const target = findNextCell(board, puzzle);
    if (!target) {
        return isSolution(board, puzzle) ? board : null;
    }

    const {r, c, tryOrder} = target;
    for (let val of tryOrder) {
        const nb = board.map(row => [...row]);
        if (!forceVal(nb, r, c, val)) continue;
        if (violatesLocal(nb, puzzle, r, c)) continue;
        if (!propagate(nb, puzzle)) continue;

        const result = _backtrack(nb, puzzle);
        if (result !== null) return result;
    }
    return null;
}

// ── Export theo contract window.solverBT ─────────────────────────────────────
async function solve(puzzle) {
    const board = makeBoard(puzzle.R, puzzle.C);
    if (!applyGiven(board, puzzle)) return null;
    if (!propagate(board, puzzle)) return null;

    await new Promise(res => setTimeout(res, 0)); // yield frame cho UI

    return _backtrack(board, puzzle);
}

window.solverBT = { solve, name: 'Backtracking', requiresNetwork: false };