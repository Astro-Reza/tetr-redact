// ══════════════════════════════════════════════════════════════
//  TETRIS × PRETEXT  —  index.js  (ES Module, top-level await)
//
//  WHY THIS MUST BE type="module":
//    1. We import from esm.sh using bare ESM import syntax.
//    2. We use top-level `await` (document.fonts.ready + prepareWithSegments).
//    Both require the browser's module pipeline — a plain <script> will
//    throw a SyntaxError and pretext will never load.
//
//  COMMON REASONS PRETEXT FAILS TO LOAD:
//    A. Script tag missing type="module"  → import statement = SyntaxError
//    B. Network / CDN timeout from esm.sh → `prepared` stays undefined,
//       loading spinner never hides (check DevTools > Network tab)
//    C. top-level await not reached      → caused by (A) above
//    D. Font not ready before prepare()  → text metrics wrong; await fonts.ready fixes this
// ══════════════════════════════════════════════════════════════

import { prepareWithSegments, layoutNextLine }
  from 'https://esm.sh/@chenglou/pretext@0.0.3';

// ══════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════
const COLS = 10, ROWS = 20, CELL = 30;
const W = COLS * CELL, H = ROWS * CELL;
const FONT_STR = '11px "Geologica"';
const LINE_H = CELL;
const TEXT_PAD = 3;   // px gap around block edges before text starts
const MIN_SLOT = 16;  // skip slots narrower than this (px)

const COLORS = {
  I: '#cf6a4c',   // rust red
  O: '#8f9d6a',   // moss green
  T: '#9b703f',   // warm leather
  S: '#7587a6',   // denim blue
  Z: '#9b5c5c',   // faded maroon
  J: '#FFB061',   // amber (our UI accent)
  L: '#6b6659',   // taupe grey
};

const PIECES = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { shape: [[1, 1], [1, 1]] },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};
const PKS = Object.keys(PIECES);

// SRS wall-kick tables
const KICKS = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// Long text corpus — repeated so the cursor never runs dry
const LOREM_BASE =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure ' +
  'dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur ' +
  'excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt ' +
  'mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error sit voluptatem ' +
  'accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore ' +
  'veritatis et quasi architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem ' +
  'quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos ' +
  'qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem ipsum quia ';
let currentCorpus = LOREM_BASE.repeat(10);

// ══════════════════════════════════════════════════════════════
//  DOM
// ══════════════════════════════════════════════════════════════
const gc = document.getElementById('gc');
const ctx = gc.getContext('2d');
const hc = document.getElementById('hc');
const hctx = hc.getContext('2d');
const ncs = [0, 1, 2].map(i => document.getElementById('n' + i));
const nctx = ncs.map(c => c.getContext('2d'));

// ══════════════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════════════
let board, cur, hold, nq;
let score, lines, level, combo;
let holdUsed, dead, paused, started;
let lockTimer, lockMoves;
let softDrop = false;
let raf, lastT = 0, lastFrameT = 0, dropInt;
let best = +(localStorage.getItem('ptbest') || 0);
let prepared;               // pretext PreparedTextWithSegments handle
let flashRows = new Set(); // rows mid-clear animation
let flashStart = 0;

// ══════════════════════════════════════════════════════════════
//  BAG / PIECE UTILS
// ══════════════════════════════════════════════════════════════
function newBag() {
  const b = [...PKS];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pull() {
  if (nq.length < 6) nq.push(...newBag());
  return nq.shift();
}

function spawn(t) {
  const s = PIECES[t].shape.map(r => [...r]);
  return {
    type: t, shape: s,
    x: Math.floor(COLS / 2) - Math.floor(s[0].length / 2),
    y: t === 'I' ? -1 : 0, rot: 0
  };
}

function rotMat(mat, n = 1) {
  let m = mat;
  for (let k = 0; k < ((n % 4 + 4) % 4); k++) {
    const rows = m.length, cols = m[0].length;
    m = Array.from({ length: cols }, (_, i) =>
      Array.from({ length: rows }, (_, j) => m[rows - 1 - j][i]));
  }
  return m;
}

function collides(shape, x, y, b = board) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && b[ny][nx]) return true;
    }
  return false;
}

function ghostY() {
  let gy = cur.y;
  while (!collides(cur.shape, cur.x, gy + 1)) gy++;
  return gy;
}

function tryRot(n) {
  const nr = ((cur.rot + n) % 4 + 4) % 4;
  const ns = rotMat(cur.shape, ((n % 4) + 4) % 4);
  const key = `${cur.rot}${nr}`;
  const tbl = cur.type === 'I' ? KICKS_I : KICKS;
  for (const [kx, ky] of (tbl[key] || [[0, 0]])) {
    if (!collides(ns, cur.x + kx, cur.y - ky)) {
      cur.x += kx; cur.y -= ky;
      cur.shape = ns; cur.rot = nr;
      lockTimer = Date.now();
      lockMoves = Math.min(lockMoves + 1, 15);
      applyDCD(); // DAS Cut Delay on rotation
      return true;
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  GAME LOGIC
// ══════════════════════════════════════════════════════════════
function place() {
  for (let r = 0; r < cur.shape.length; r++)
    for (let c = 0; c < cur.shape[r].length; c++) {
      if (!cur.shape[r][c]) continue;
      const ny = cur.y + r, nx = cur.x + c;
      if (ny < 0) { endGame(); return; }
      board[ny][nx] = cur.type;
    }
  clearLines();
  spawnNext();
}

function clearLines() {
  const toClear = [];
  for (let r = ROWS - 1; r >= 0; r--)
    if (board[r].every(c => c)) toClear.push(r);
  if (!toClear.length) { combo = 0; return; }

  flashRows = new Set(toClear);
  flashStart = performance.now();

  setTimeout(() => {
    for (let r = ROWS - 1; r >= 0; r--)
      if (board[r].every(c => c)) { board.splice(r, 1); board.unshift(Array(COLS).fill(null)); r++; }
    flashRows.clear();
    combo++;
    const n = toClear.length;
    const pts = [0, 100, 300, 500, 800][n] * level + (combo > 1 ? 50 * combo * level : 0);
    score += pts; lines += n; level = Math.floor(lines / 10) + 1;
    dropInt = getDropInt();
    updateUI();
  }, 200);
}

function spawnNext() {
  holdUsed = false;
  cur = spawn(pull());
  lockTimer = Date.now(); lockMoves = 0;
  applyDCD(); // DAS Cut Delay on new piece spawn
  if (collides(cur.shape, cur.x, cur.y)) endGame();
  drawMinis();
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - cur.y) * 2;
  cur.y = gy;
  place(); updateUI();
}

function swapHold() {
  if (holdUsed) return;
  holdUsed = true;
  const t = cur.type;
  if (hold) { cur = spawn(hold); } else { spawnNext(); }
  hold = t; drawHold();
}

function moveDown() {
  if (!collides(cur.shape, cur.x, cur.y + 1)) {
    cur.y++; lockTimer = Date.now(); lockMoves = 0;
  } else {
    if (Date.now() - lockTimer > 500 || lockMoves >= 15) place();
  }
}

function getDropInt() { return Math.max(80, 800 - (level - 1) * 72); }

// ══════════════════════════════════════════════════════════════
//  PRETEXT TEXT LAYER
//
//  Each game row = one text line (height = CELL px).
//  We compute which pixel columns are occupied (placed blocks +
//  falling piece + ghost), merge them into exclusion intervals,
//  carve the remaining slots, then call layoutNextLine() for each.
//  The cursor advances continuously top-to-bottom so text flows
//  seamlessly. Resets to start each frame so text reflows live.
// ══════════════════════════════════════════════════════════════
function buildExclusions(row) {
  const occ = [];
  // Placed cells
  for (let c = 0; c < COLS; c++)
    if (board[row][c]) occ.push([c * CELL, (c + 1) * CELL]);
  // Falling piece
  if (!dead && cur && !flashRows.has(row)) {
    for (let r = 0; r < cur.shape.length; r++)
      for (let c = 0; c < cur.shape[r].length; c++) {
        if (!cur.shape[r][c]) continue;
        if (cur.y + r === row) occ.push([(cur.x + c) * CELL, (cur.x + c + 1) * CELL]);
      }
  }
  // Ghost piece
  if (!dead && cur) {
    const gy = ghostY();
    for (let r = 0; r < cur.shape.length; r++)
      for (let c = 0; c < cur.shape[r].length; c++) {
        if (!cur.shape[r][c]) continue;
        if (gy + r === row) occ.push([(cur.x + c) * CELL, (cur.x + c + 1) * CELL]);
      }
  }
  // Merge overlapping intervals
  occ.sort((a, b) => a[0] - b[0]);
  const m = [];
  for (const [l, r] of occ) {
    if (m.length && m[m.length - 1][1] >= l) m[m.length - 1][1] = Math.max(m[m.length - 1][1], r);
    else m.push([l, r]);
  }
  return m;
}

function carveSlots(merged) {
  const slots = [];
  let x = TEXT_PAD;
  for (const [l, r] of merged) {
    if (l - x > MIN_SLOT) slots.push({ left: x, right: l - TEXT_PAD });
    x = r + TEXT_PAD;
  }
  if (W - x > MIN_SLOT) slots.push({ left: x, right: W - TEXT_PAD });
  return slots;
}

function drawTextLayer() {
  if (!prepared) return;

  ctx.font = FONT_STR;
  ctx.textBaseline = 'middle';

  let cursor = { segmentIndex: 0, graphemeIndex: 0 };

  for (let row = 0; row < ROWS; row++) {
    const textY = row * LINE_H + LINE_H * 0.5 + 1;
    const isClear = flashRows.has(row);

    if (isClear) {
      const t = (performance.now() - flashStart) / 200;
      const alpha = 0.15 + 0.15 * Math.sin(t * Math.PI * 5);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(2)})`; // faint pulse during clear
    } else {
      ctx.fillStyle = '#444444';   // dark grey text on white canvas
    }

    const merged = buildExclusions(row);
    const slots = carveSlots(merged);

    for (const slot of slots) {
      const slotW = slot.right - slot.left;
      if (slotW < MIN_SLOT) continue;

      let line = layoutNextLine(prepared, cursor, slotW);
      if (!line) {
        cursor = { segmentIndex: 0, graphemeIndex: 0 };
        line = layoutNextLine(prepared, cursor, slotW);
      }
      if (line) {
        ctx.fillText(line.text, slot.left, textY);
        cursor = line.end;
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  CANVAS RENDERING
// ══════════════════════════════════════════════════════════════
function drawBlock(x, y, type, alpha = 1, sz = CELL) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#111111';
  // Fill the block but shave off 3px at the bottom.
  // This naturally exposes 3px of the white canvas between rows,
  // creating a thicker, crisp single white horizontal line.
  ctx.fillRect(x, y, sz, sz - 5);
  ctx.globalAlpha = 1;
}

function draw() {
  // 1. White page background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 2. No grid — clean white page

  // 3. PRETEXT — text flows around all block exclusions
  drawTextLayer();

  // 4. Placed board cells
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c])
        drawBlock(c * CELL, r * CELL, board[r][c], flashRows.has(r) ? 0.45 : 1);

  if (!dead && cur) {
    // 5. Ghost
    const gy = ghostY();
    for (let r = 0; r < cur.shape.length; r++)
      for (let c = 0; c < cur.shape[r].length; c++) {
        if (!cur.shape[r][c]) continue;
        const px = (cur.x + c) * CELL, py = (gy + r) * CELL;
        // Ghost: clear landing indicator
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(px, py, CELL, CELL - 5);

        // Single sharp 1px outline for ghost
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 4);
      }

    // 6. Falling piece
    for (let r = 0; r < cur.shape.length; r++)
      for (let c = 0; c < cur.shape[r].length; c++)
        if (cur.shape[r][c])
          drawBlock((cur.x + c) * CELL, (cur.y + r) * CELL, cur.type);
  }
}

// ══════════════════════════════════════════════════════════════
//  MINI CANVASES
// ══════════════════════════════════════════════════════════════
function miniPiece(ctx2, type, cw, ch, sz = 17) {
  ctx2.clearRect(0, 0, cw, ch);
  if (!type) return;
  const s = PIECES[type].shape, rows = s.length, cols = s[0].length;
  const ox = Math.floor((cw - cols * sz) / 2), oy = Math.floor((ch - rows * sz) / 2);
  const col = COLORS[type];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (s[r][c]) {
        ctx2.fillStyle = col;
        ctx2.fillRect(ox + c * sz + 1, oy + r * sz + 1, sz - 2, sz - 2);
        ctx2.fillStyle = 'rgba(255,255,255,0.2)';
        ctx2.fillRect(ox + c * sz + 2, oy + r * sz + 2, sz - 4, 3);
      }
}

function drawHold() { miniPiece(hctx, hold, hc.width, hc.height, 17); }
function drawMinis() {
  drawHold();
  nq.slice(0, 3).forEach((t, i) => miniPiece(nctx[i], t, ncs[i].width, ncs[i].height, [19, 16, 13][i]));
}

// ══════════════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════════════
function updateUI() {
  document.getElementById('sv').textContent = score.toLocaleString();
  document.getElementById('lnv').textContent = lines;
  document.getElementById('lv').textContent = level;
  document.getElementById('lb').style.width = (lines % 10) * 10 + '%';
  if (score > best) { best = score; localStorage.setItem('ptbest', best); }
  document.getElementById('bv').textContent = best.toLocaleString();
}

// ══════════════════════════════════════════════════════════════
//  GAME FLOW
// ══════════════════════════════════════════════════════════════
function loop(ts) {
  if (!started || paused || dead) return;
  const dt = ts - lastFrameT;
  lastFrameT = ts;

  // DAS/ARR horizontal handling (frame-independent)
  updateHandling(dt);

  // Gravity: SDF multiplies the drop speed when soft-dropping
  const elapsedDrop = ts - lastT;
  const interval = softDrop ? Math.max(dropInt / handling.sdf, 1) : dropInt;
  if (elapsedDrop > interval) { lastT = ts; moveDown(); }
  draw();
  raf = requestAnimationFrame(loop);
}

function initGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  hold = null;
  nq = [...newBag(), ...newBag()];
  score = 0; lines = 0; level = 1; combo = 0;
  holdUsed = false; dead = false; paused = false; softDrop = false;
  flashRows.clear();
  dropInt = getDropInt();
  spawnNext(); updateUI(); drawHold();
}

function startGame() {
  document.getElementById('sov').classList.add('h');
  initGame(); started = true; lastT = performance.now(); lastFrameT = lastT;
  raf = requestAnimationFrame(loop);
}

function retryGame() {
  if (!started) return;
  document.getElementById('gov').classList.add('h');
  document.getElementById('pov').classList.add('h');
  dead = false; paused = false; cancelAnimationFrame(raf);
  initGame(); lastT = performance.now(); lastFrameT = lastT;
  raf = requestAnimationFrame(loop);
}

function forfeitGame() {
  document.getElementById('pov').classList.add('h'); endGame();
}

function endGame() {
  dead = true; cancelAnimationFrame(raf);
  document.getElementById('fs').textContent = score.toLocaleString();
  document.getElementById('gov').classList.remove('h');
  updateUI(); draw();
}

function pauseGame() {
  paused = true; cancelAnimationFrame(raf);
  document.getElementById('pov').classList.remove('h');
}

function resumeGame() {
  paused = false;
  document.getElementById('pov').classList.add('h');
  lastT = performance.now(); lastFrameT = lastT;
  raf = requestAnimationFrame(loop);
}

document.getElementById('startBtn').onclick = startGame;
document.getElementById('resumeBtn').onclick = resumeGame;
document.getElementById('forfeitBtn').onclick = forfeitGame;
document.getElementById('retryBtn').onclick = retryGame;

// ══════════════════════════════════════════════════════════════
//  TETR.IO-STYLE HANDLING SYSTEM
//  Frame-independent DAS / ARR / DCD / SDF
// ══════════════════════════════════════════════════════════════
const handling = {
  das: 300,  // ms — Delayed Auto Shift (longer = less sensitive)
  arr: 80,   // ms — Auto Repeat Rate (higher = slower repeat)
  dcd: 12,   // ms — DAS Cut Delay
  sdf: 35,   // ×  — Soft Drop Factor
};

// Per-direction state (independent left/right tracking like TETR.IO)
const dirState = {
  left: { held: false, dasElapsed: 0, arrElapsed: 0, charged: false, dcdPause: 0 },
  right: { held: false, dasElapsed: 0, arrElapsed: 0, charged: false, dcdPause: 0 },
};
// Which direction was pressed LAST (for priority — TETR.IO uses last-key-wins)
let lastDir = null;

function resetDirState(dir) {
  const s = dirState[dir];
  s.held = false; s.dasElapsed = 0; s.arrElapsed = 0;
  s.charged = false; s.dcdPause = 0;
}

// Called by tryRot() and spawnNext() to apply DAS Cut Delay
function applyDCD() {
  dirState.left.dcdPause = handling.dcd;
  dirState.right.dcdPause = handling.dcd;
}

// Move piece horizontally by dx, respecting collisions & lock timer
function tryMove(dx) {
  if (!cur || dead || paused) return;
  if (!collides(cur.shape, cur.x + dx, cur.y)) {
    cur.x += dx;
    lockTimer = Date.now();
  }
}

// Core update — called every frame with delta time in ms
function updateHandling(dt) {
  if (!started || paused || dead || !cur) return;

  // Determine active direction (last-key-wins priority)
  const active = lastDir && dirState[lastDir].held ? lastDir : null;

  for (const dir of ['left', 'right']) {
    const s = dirState[dir];
    if (!s.held) continue;

    const dx = dir === 'left' ? -1 : 1;

    // DCD pause: after rotation or spawn, briefly freeze DAS accumulation
    if (s.dcdPause > 0) {
      s.dcdPause -= dt;
      if (s.dcdPause > 0) continue;
      s.dcdPause = 0;
    }

    // Only process the active direction (last-key-wins)
    if (dir !== active) continue;

    if (!s.charged) {
      // Still in DAS charge phase
      s.dasElapsed += dt;
      if (s.dasElapsed >= handling.das) {
        s.charged = true;
        s.arrElapsed = 0;
        // If ARR is 0, instant teleport to wall (like TETR.IO ARR=0)
        if (handling.arr === 0) {
          while (!collides(cur.shape, cur.x + dx, cur.y)) cur.x += dx;
        } else {
          tryMove(dx);
        }
      }
    } else {
      // In auto-repeat phase
      if (handling.arr === 0) {
        // ARR=0 means teleport to wall every frame
        while (!collides(cur.shape, cur.x + dx, cur.y)) cur.x += dx;
      } else {
        s.arrElapsed += dt;
        while (s.arrElapsed >= handling.arr) {
          s.arrElapsed -= handling.arr;
          tryMove(dx);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  INPUT EVENTS
// ══════════════════════════════════════════════════════════════
const held = {};

document.addEventListener('keydown', e => {
  if (held[e.code]) return;
  held[e.code] = true;

  if (!started) { if (e.code === 'Enter') startGame(); return; }
  if (e.code === 'KeyA') { if (dead) retryGame(); return; }
  if (e.code === 'Escape') { if (!dead) paused ? resumeGame() : pauseGame(); return; }
  if (dead || paused) return;

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      resetDirState('left');
      dirState.left.held = true;
      lastDir = 'left';
      tryMove(-1); // immediate first move
      draw();
      break;
    case 'ArrowRight':
      e.preventDefault();
      resetDirState('right');
      dirState.right.held = true;
      lastDir = 'right';
      tryMove(1); // immediate first move
      draw();
      break;
    case 'ArrowDown': e.preventDefault(); softDrop = true; break;
    case 'KeyV': e.preventDefault(); hardDrop(); break;
    case 'ArrowUp': e.preventDefault(); tryRot(1); break;
    case 'KeyC': e.preventDefault(); tryRot(3); break;
    case 'KeyX': e.preventDefault(); tryRot(2); break;
    case 'KeyZ': e.preventDefault(); swapHold(); drawMinis(); break;
  }
  draw();
});

document.addEventListener('keyup', e => {
  held[e.code] = false;
  if (e.code === 'ArrowDown') softDrop = false;
  if (e.code === 'ArrowLeft') {
    resetDirState('left');
    // If right is still held, it becomes active
    if (dirState.right.held) lastDir = 'right';
  }
  if (e.code === 'ArrowRight') {
    resetDirState('right');
    if (dirState.left.held) lastDir = 'left';
  }
});

// ══════════════════════════════════════════════════════════════
//  BURGER MENU + SLIDER WIRING
// ══════════════════════════════════════════════════════════════
const burgerBtn = document.getElementById('burgerBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingsClose = document.getElementById('settingsClose');

function toggleSettings() {
  const open = settingsPanel.classList.toggle('open');
  burgerBtn.classList.toggle('open', open);
}
burgerBtn.onclick = toggleSettings;
settingsClose.onclick = toggleSettings;

// Wire sliders
function wireSlider(id, key, suffix, parse = Number) {
  const slider = document.getElementById('slider' + id);
  const display = document.getElementById('val' + id);
  slider.addEventListener('input', () => {
    handling[key] = parse(slider.value);
    display.textContent = slider.value + suffix;
  });
}
wireSlider('DAS', 'das', ' ms');
wireSlider('ARR', 'arr', ' ms');
wireSlider('DCD', 'dcd', ' ms');
wireSlider('SDF', 'sdf', '×');

// ══════════════════════════════════════════════════════════════
//  BOOT — wait for fonts, then prepare pretext ONCE
//
//  FIX: prepareWithSegments() calls canvas.measureText() internally.
//  If the custom font ('Share Tech Mono') hasn't loaded yet, the
//  browser falls back to a system monospace and all glyph widths
//  are wrong — text overflows or clips unpredictably.
//  `await document.fonts.ready` guarantees the font is loaded
//  before we call prepareWithSegments().
// ══════════════════════════════════════════════════════════════
document.getElementById('bv').textContent = best.toLocaleString();

await document.fonts.ready;

try {
  prepared = prepareWithSegments(currentCorpus, FONT_STR);
} catch (err) {
  console.error('[pretext] prepareWithSegments failed:', err);
}

// Hide loading spinner, show start screen
document.getElementById('loading-msg').style.display = 'none';
document.getElementById('sov').classList.remove('h');

// Draw an empty board as a live preview of the text effect
board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
cur = null; dead = true;
draw();
dead = false;

// ══════════════════════════════════════════════════════════════
//  CUSTOM TEXT INPUT
// ══════════════════════════════════════════════════════════════
document.getElementById('applyTextBtn').onclick = () => {
  const val = document.getElementById('customText').value.trim();
  const base = val || LOREM_BASE;
  // Repeat to ensure the cursor never runs dry over 20 lines
  currentCorpus = base.repeat(Math.max(1, Math.ceil(3000 / base.length)));
  try {
    prepared = prepareWithSegments(currentCorpus, FONT_STR);
    if (!started || paused || dead) draw(); // live update if not currently playing
  } catch (err) {
    console.error('[pretext] Failed updating custom text:', err);
  }
};
