// Eingebaute, prozedural gezeichnete Hintergrund-Animationen (eigener Code, keine externen Assets).
// Jede Animation ist eine Fabrik `create(seed)` → { draw(ctx, W, H, t) }. Zustandsbehaftete Simulationen
// rechnen in festen Zeitschritten bis zur angefragten Zeit vor und starten neu, wenn t zurückspringt.
import { drawProceduralBackground } from './draw.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hilfsfunktion für Simulationen mit festem Zeitschritt.
function simulation(init, step, render, dt = 1 / 120) {
  let s = null;
  return {
    draw(ctx, W, H, t) {
      if (!s || t < s.time - 1e-6) s = { ...init(W, H), time: 0 };
      let guard = 0;
      while (s.time + dt <= t && guard++ < 20000) {
        step(s, dt, W, H);
        s.time += dt;
      }
      render(ctx, W, H, s, t);
    },
  };
}

/* ======================= Block-Parkour (Minecraft-Stil) ======================= */

function blockParkour(seed) {
  const D = 3.2; // Abstand der Blöcke in Laufrichtung
  const T = 0.62; // Sekunden pro Sprung
  const bx = (i) => Math.round(Math.sin(i * 0.83 + seed) * 1.4 + Math.sin(i * 0.31 + seed * 2) * 1.2);
  const by = (i) => (hash(i * 1.7 + seed) > 0.72 ? 1 : 0) + (hash(i * 3.1 + seed) > 0.9 ? 1 : 0);
  const gold = (i) => i % 17 === 9;

  const grass = ['#5d9c2f', '#69aa36', '#548d2a', '#77b843'];
  const dirt = ['#8a5a32', '#7a4e2b', '#966640', '#6e4526'];
  const goldC = ['#f5d33d', '#e8c22c', '#ffe15a', '#d8b120'];

  return {
    draw(ctx, W, H, t) {
      const f = W * 0.78;
      const horizon = H * 0.36;
      const s = t / T;
      const i0 = Math.floor(s);
      const k = s - i0;
      const cx = lerp(bx(i0), bx(i0 + 1), smooth(k));
      const cz = lerp(i0 * D, (i0 + 1) * D, k) + 0.5;
      const cy = lerp(by(i0), by(i0 + 1), smooth(k)) + 1.62 + Math.sin(Math.PI * k) * 1.1;
      const nearZ = cz + 0.3;
      const P = (x, y, z) => [W / 2 + ((x - cx) * f) / (z - cz), horizon - ((y - cy) * f) / (z - cz)];

      // Himmel
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#5b8cff');
      sky.addColorStop(1, '#bcd6ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon + 2);
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(W * 0.72, H * 0.06, W * 0.1, W * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let c = 0; c < 7; c++) {
        const w = W * (0.18 + hash(c + seed) * 0.2);
        const x = ((hash(c * 7 + seed) * W * 1.6 - t * 18 * (1 + c * 0.15)) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
        const y = H * (0.03 + hash(c * 3 + seed) * 0.22);
        ctx.fillRect(x, y, w, W * 0.035);
        ctx.fillRect(x + w * 0.2, y - W * 0.03, w * 0.5, W * 0.035);
      }
      // ferne Berge
      ctx.fillStyle = '#8aa7d8';
      for (let m = 0; m < 14; m++) {
        const mw = W / 7;
        const x = ((m * mw - t * 6) % (W + mw) + W + mw) % (W + mw) - mw;
        const mh = H * (0.02 + hash(m + seed * 5) * 0.06);
        ctx.fillRect(x, horizon - mh, mw * 0.95, mh + 2);
      }

      // Lava unten
      const lava = ctx.createLinearGradient(0, horizon, 0, H);
      lava.addColorStop(0, '#ff7a1a');
      lava.addColorStop(0.15, '#e2470f');
      lava.addColorStop(1, '#a3200a');
      ctx.fillStyle = lava;
      ctx.fillRect(0, horizon, W, H - horizon);
      for (let j = 0; j < 60; j++) {
        const lz = cz + 1 + ((j * 0.9 - (t * 2.3) % 0.9) % 54);
        const lx = cx + (hash(j * 13.3 + Math.floor((cz + j * 0.9) / 54)) - 0.5) * 30;
        if (lz <= cz + 0.5) continue;
        const [sx, sy] = P(lx, -8, lz);
        const sz = (f * 0.8) / (lz - cz);
        ctx.fillStyle = j % 3 ? 'rgba(255,200,60,0.55)' : 'rgba(120,20,0,0.45)';
        ctx.fillRect(sx - sz / 2, sy - sz / 4, sz, sz / 2);
      }

      const quad = (pts, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let q = 1; q < 4; q++) ctx.lineTo(pts[q][0], pts[q][1]);
        ctx.closePath();
        ctx.fill();
      };
      const shade = (hex, m) => {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.min(255, ((n >> 16) & 255) * m), g = Math.min(255, ((n >> 8) & 255) * m), b = Math.min(255, (n & 255) * m);
        return `rgb(${r | 0},${g | 0},${b | 0})`;
      };

      for (let i = i0 + 16; i >= i0; i--) {
        const x0 = bx(i) - 0.5, x1 = bx(i) + 0.5;
        const top = by(i);
        const z0 = i * D, z1 = z0 + 1;
        if (z1 <= nearZ) continue;
        const dist = z0 - cz;
        ctx.globalAlpha = clamp01(1.6 - dist / 40);
        const isGold = gold(i);
        const topPal = isGold ? goldC : grass;
        const sidePal = isGold ? goldC : dirt;
        const N = 4;
        // Seitenflächen
        const sides = [];
        if (cx < x0 - 0.01) sides.push(x0);
        if (cx > x1 + 0.01) sides.push(x1);
        for (const sxp of sides) {
          for (let a = 0; a < N; a++)
            for (let b = 0; b < N; b++) {
              const za = Math.max(nearZ, z0 + a / N), zb = z0 + (a + 1) / N;
              if (zb <= za) continue;
              const ya = top - (b + 1) / N, yb = top - b / N;
              const base = !isGold && b === 0 ? topPal[(i + a) % 4] : sidePal[Math.floor(hash(i * 31 + a * 7 + b + 2) * 4)];
              quad([P(sxp, yb, za), P(sxp, yb, zb), P(sxp, ya, zb), P(sxp, ya, za)], shade(base, 0.72));
            }
        }
        // Vorderseite
        if (z0 > nearZ) {
          for (let a = 0; a < N; a++)
            for (let b = 0; b < N; b++) {
              const xa = x0 + a / N, xb = x0 + (a + 1) / N;
              const ya = top - (b + 1) / N, yb = top - b / N;
              const base = !isGold && b === 0 ? topPal[(i + a) % 4] : sidePal[Math.floor(hash(i * 17 + a * 5 + b) * 4)];
              quad([P(xa, yb, z0), P(xb, yb, z0), P(xb, ya, z0), P(xa, ya, z0)], shade(base, 0.86));
            }
        }
        // Oberseite
        if (cy > top) {
          for (let a = 0; a < N; a++)
            for (let b = 0; b < N; b++) {
              const xa = x0 + a / N, xb = x0 + (a + 1) / N;
              const za = Math.max(nearZ, z0 + b / N), zb = z0 + (b + 1) / N;
              if (zb <= za) continue;
              const base = topPal[Math.floor(hash(i * 11 + a * 3 + b * 13) * 4)];
              quad([P(xa, top, za), P(xb, top, za), P(xb, top, zb), P(xa, top, zb)], shade(base, 1.08));
            }
        }
      }
      ctx.globalAlpha = 1;

      // Fadenkreuz
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const ch = W * 0.022, cw = W * 0.004;
      ctx.fillRect(W / 2 - ch, H / 2 - cw, ch * 2, cw * 2);
      ctx.fillRect(W / 2 - cw, H / 2 - ch, cw * 2, ch * 2);
    },
  };
}

/* ======================= Satisfying Balls ======================= */

function bouncingBalls(seed) {
  const rand = rng(seed + 7);
  const newBall = (W, H, hue) => {
    const a = rand() * Math.PI * 2;
    const sp = W * (0.5 + rand() * 0.6);
    return { x: W / 2, y: H * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: W * 0.032, hue, trail: [], escaped: false };
  };
  return simulation(
    (W, H) => ({ balls: [newBall(W, H, rand() * 360), newBall(W, H, rand() * 360)], ring: 0, bounces: 0, flash: 0 }),
    (s, dt, W, H) => {
      const R = W * 0.42, cx = W / 2, cy = H * 0.5, g = W * 1.5, gap = 0.8;
      s.ring += dt * 1.1;
      s.flash = Math.max(0, s.flash - dt * 3);
      const born = [];
      for (const b of s.balls) {
        b.vy += g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (!b.escaped) {
          const dx = b.x - cx, dy = b.y - cy;
          const d = Math.hypot(dx, dy);
          if (d + b.r >= R) {
            let rel = Math.atan2(dy, dx) - s.ring;
            rel = ((rel % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
            if (Math.abs(rel) < gap / 2 && d < R + b.r) {
              b.escaped = true;
            } else {
              const nx = dx / d, ny = dy / d;
              const dot = b.vx * nx + b.vy * ny;
              if (dot > 0) {
                b.vx -= 2 * dot * nx;
                b.vy -= 2 * dot * ny;
                const sp = Math.hypot(b.vx, b.vy);
                const target = Math.max(sp, W * 1.1);
                b.vx = (b.vx / sp) * target + (rand() - 0.5) * W * 0.05;
                b.vy = (b.vy / sp) * target;
              }
              b.x = cx + nx * (R - b.r - 0.5);
              b.y = cy + ny * (R - b.r - 0.5);
              b.hue = (b.hue + 37) % 360;
              b.r = Math.min(W * 0.07, b.r * 1.01);
              s.bounces++;
              s.flash = 1;
            }
          }
        }
        b.trail.push(b.x, b.y);
        if (b.trail.length > 28) b.trail.splice(0, 2);
        if (b.escaped && b.y - b.r > H) {
          b.dead = true;
          const n = s.balls.length < 18 ? 2 : 1;
          for (let k = 0; k < n; k++) born.push(newBall(W, H, (b.hue + k * 120) % 360));
        }
      }
      s.balls = s.balls.filter((b) => !b.dead).concat(born);
    },
    (ctx, W, H, s) => {
      const R = W * 0.42, cx = W / 2, cy = H * 0.5, gap = 0.8;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.7);
      bg.addColorStop(0, '#1a1030');
      bg.addColorStop(1, '#05030c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const hue = (s.time * 40) % 360;
      ctx.lineCap = 'round';
      ctx.lineWidth = W * 0.022;
      ctx.strokeStyle = `hsl(${hue}, 100%, ${60 + s.flash * 25}%)`;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 30 + s.flash * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, R + ctx.lineWidth / 2, s.ring + gap / 2, s.ring + Math.PI * 2 - gap / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = 'butt';
      for (const b of s.balls) {
        for (let j = 0; j < b.trail.length; j += 2) {
          const a = j / b.trail.length;
          ctx.fillStyle = `hsla(${b.hue}, 100%, 60%, ${a * 0.35})`;
          ctx.beginPath();
          ctx.arc(b.trail[j], b.trail[j + 1], b.r * (0.4 + a * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `hsl(${b.hue}, 100%, 60%)`;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = W * 0.006;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `800 ${Math.round(W * 0.045)}px "Montserrat", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Bälle: ${s.balls.length}  ·  Bounces: ${s.bounces}`, W / 2, H * 0.17);
      ctx.textAlign = 'left';
    }
  );
}

/* ======================= Block-Regen (Tetris-Stil, spielt sich selbst) ======================= */

const TETROMINOES = [
  { c: '#00e5ff', m: [[0, 0, 0, 0], [1, 1, 1, 1]] },
  { c: '#ffe600', m: [[1, 1], [1, 1]] },
  { c: '#b84dff', m: [[0, 1, 0], [1, 1, 1]] },
  { c: '#3ddc84', m: [[0, 1, 1], [1, 1, 0]] },
  { c: '#ff4d6d', m: [[1, 1, 0], [0, 1, 1]] },
  { c: '#3d7bff', m: [[1, 0, 0], [1, 1, 1]] },
  { c: '#ff9a2e', m: [[0, 0, 1], [1, 1, 1]] },
];
const rotate = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());
const cellsOf = (m) => m.flatMap((row, r) => row.flatMap((v, c) => (v ? [[r, c]] : [])));
const SHAPES = TETROMINOES.map((p) => {
  const rots = [];
  let m = p.m;
  for (let i = 0; i < 4; i++) {
    const cells = cellsOf(m);
    const key = JSON.stringify(cells);
    if (!rots.some((r) => JSON.stringify(r) === key)) rots.push(cells);
    m = rotate(m);
  }
  return { color: p.c, rots };
});

function tetris(seed) {
  const COLS = 10;
  const rand = rng(seed + 3);
  const fits = (board, cells, row, col) =>
    cells.every(([r, c]) => {
      const rr = row + r, cc = col + c;
      return cc >= 0 && cc < COLS && rr < board.length && (rr < 0 || !board[rr][cc]);
    });
  const dropRow = (board, cells, col) => {
    let row = -2;
    if (!fits(board, cells, row, col)) return null;
    while (fits(board, cells, row + 1, col)) row++;
    return row;
  };
  const evaluate = (board, cells, row, col, rows) => {
    const b = board.map((r) => r.slice());
    for (const [r, c] of cells) if (row + r >= 0) b[row + r][col + c] = 1;
    else return -1e9;
    let lines = 0;
    for (const r of b) if (r.every(Boolean)) lines++;
    const heights = [];
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let h = 0, seen = false;
      for (let r = 0; r < rows; r++) {
        if (b[r][c]) {
          if (!seen) h = rows - r;
          seen = true;
        } else if (seen) holes++;
      }
      heights.push(h);
    }
    let bump = 0;
    for (let c = 1; c < COLS; c++) bump += Math.abs(heights[c] - heights[c - 1]);
    const agg = heights.reduce((a, x) => a + x, 0);
    return -0.51 * agg + 0.76 * lines * 4 - 0.36 * holes * 3 - 0.18 * bump + rand() * 0.3;
  };
  const spawn = (s) => {
    const type = Math.floor(rand() * SHAPES.length);
    let best = null;
    SHAPES[type].rots.forEach((cells, rot) => {
      for (let col = -2; col < COLS; col++) {
        const row = dropRow(s.board, cells, col);
        if (row == null) continue;
        const score = evaluate(s.board, cells, row, col, s.rows);
        if (!best || score > best.score) best = { score, rot, col, row };
      }
    });
    if (!best || best.score < -1e8) {
      s.board = s.board.map((r) => r.map(() => 0));
      return spawn(s);
    }
    const startCol = Math.floor(COLS / 2) - 1;
    s.piece = { type, ...best, y: -3, startCol, x: startCol };
  };
  return simulation(
    (W, H) => {
      const cell = W / COLS;
      const rows = Math.ceil(H / cell);
      const s = { rows, cell, board: Array.from({ length: rows }, () => Array(COLS).fill(0)), clearing: null };
      // Mit einem halb gefüllten, zufälligen Feld starten, damit sofort Action ist.
      for (let r = rows - 4; r < rows; r++) {
        const hole = Math.floor(rand() * COLS);
        for (let c = 0; c < COLS; c++) if (c !== hole) s.board[r][c] = SHAPES[Math.floor(rand() * 7)].color;
      }
      spawn(s);
      return s;
    },
    (s, dt) => {
      if (s.clearing) {
        s.clearing.t -= dt;
        if (s.clearing.t <= 0) {
          s.board = s.board.filter((_, r) => !s.clearing.rows.includes(r));
          while (s.board.length < s.rows) s.board.unshift(Array(COLS).fill(0));
          s.clearing = null;
          spawn(s);
        }
        return;
      }
      const p = s.piece;
      const total = p.row + 3;
      p.y += dt * 16;
      const k = clamp01((p.y + 3) / Math.max(1, total * 0.4));
      p.x = lerp(p.startCol, p.col, smooth(k));
      if (p.y >= p.row) {
        for (const [r, c] of SHAPES[p.type].rots[p.rot]) if (p.row + r >= 0) s.board[p.row + r][p.col + c] = SHAPES[p.type].color;
        const full = s.board.flatMap((row, r) => (row.every(Boolean) ? [r] : []));
        if (full.length) s.clearing = { rows: full, t: 0.28 };
        else spawn(s);
        if (s.board[1].some(Boolean)) s.board = s.board.map((r) => r.map(() => 0));
      }
    },
    (ctx, W, H, s) => {
      const cell = s.cell;
      const top = H - s.rows * cell;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#120b2e');
      bg.addColorStop(1, '#070514');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for (let c = 1; c < 10; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cell, 0);
        ctx.lineTo(c * cell, H);
        ctx.stroke();
      }
      const block = (x, y, color, alpha = 1) => {
        const pad = cell * 0.04, b = cell * 0.12;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + pad, y + pad, cell - pad * 2, b);
        ctx.fillRect(x + pad, y + pad, b, cell - pad * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + pad, y + cell - pad - b, cell - pad * 2, b);
        ctx.fillRect(x + cell - pad - b, y + pad, b, cell - pad * 2);
        ctx.globalAlpha = 1;
      };
      s.board.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return;
          if (s.clearing?.rows.includes(r)) block(c * cell, top + r * cell, '#ffffff', 0.5 + 0.5 * Math.sin(s.clearing.t * 60));
          else block(c * cell, top + r * cell, v);
        })
      );
      if (!s.clearing && s.piece) {
        const p = s.piece;
        const shape = SHAPES[p.type];
        ctx.strokeStyle = shape.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 4;
        for (const [r, c] of shape.rots[p.rot]) ctx.strokeRect((p.col + c) * cell + 6, top + (p.row + r) * cell + 6, cell - 12, cell - 12);
        ctx.globalAlpha = 1;
        for (const [r, c] of shape.rots[p.rot]) block((p.x + c) * cell, top + (p.y + r) * cell, shape.color);
      }
    },
    1 / 60
  );
}

/* ======================= Geometry Jump ======================= */

function geometryJump(seed) {
  return {
    draw(ctx, W, H, t) {
      const v = W * 0.75;
      const s = W * 0.12;
      const ground = H * 0.68;
      const cubeX = W * 0.3;
      const L = v * 0.6; // horizontale Sprungweite
      const jumpH = s * 2.3;
      const world = t * v;
      const P = world + cubeX;
      const hue = (t * 25 + seed * 40) % 360;
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.1)), 8);

      const obstacles = (from, to) => {
        const out = [];
        let i = Math.max(0, Math.floor(from / (W * 1.2)) - 2);
        for (; ; i++) {
          const ox = W * 1.2 + i * W * 1.2 + hash(i + seed) * W * 0.4;
          if (ox > to) break;
          const kind = Math.floor(hash(i * 2.3 + seed) * 4);
          const width = kind === 1 ? s * 1.6 : kind === 3 ? s * 1.4 : s * 0.9;
          if (ox + width / 2 >= from) out.push({ i, ox, kind, width });
        }
        return out;
      };

      const bg = ctx.createLinearGradient(0, 0, 0, ground);
      bg.addColorStop(0, `hsl(${hue}, 80%, ${18 + beat * 8}%)`);
      bg.addColorStop(1, `hsl(${hue + 40}, 85%, ${34 + beat * 10}%)`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, ground);
      for (let i = 0; i < 18; i++) {
        const size = W * (0.08 + hash(i + seed) * 0.18);
        const par = 0.15 + hash(i * 5) * 0.25;
        const x = ((hash(i * 9 + seed) * W * 2 - world * par) % (W * 2) + W * 2) % (W * 2) - W * 0.3;
        const y = hash(i * 4.4 + seed) * ground * 0.9;
        ctx.strokeStyle = `hsla(${hue + 60}, 100%, 75%, ${0.12 + beat * 0.15})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, size, size);
      }

      // Boden
      ctx.fillStyle = `hsl(${hue + 200}, 70%, 12%)`;
      ctx.fillRect(0, ground, W, H - ground);
      const tile = s * 1.2;
      ctx.strokeStyle = `hsla(${hue + 180}, 100%, 70%, 0.25)`;
      ctx.lineWidth = 3;
      for (let x = -((world) % tile); x < W; x += tile) {
        ctx.strokeRect(x, ground, tile, tile);
        ctx.strokeRect(x - tile / 2, ground + tile, tile, tile);
      }
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = `hsl(${hue + 180}, 100%, 70%)`;
      ctx.shadowBlur = 25;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.lineTo(W, ground);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hindernisse
      const obs = obstacles(world - s, world + W + s);
      for (const o of obs) {
        const x = o.ox - world;
        ctx.fillStyle = '#0a0a12';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        const spike = (cx) => {
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.45, ground);
          ctx.lineTo(cx, ground - s * 0.95);
          ctx.lineTo(cx + s * 0.45, ground);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };
        if (o.kind === 0 || o.kind === 2) spike(x);
        else if (o.kind === 1) {
          spike(x - s * 0.4);
          spike(x + s * 0.4);
        } else {
          ctx.fillRect(x - s * 0.7, ground - s * 1.1, s * 1.4, s * 1.1);
          ctx.strokeRect(x - s * 0.7, ground - s * 1.1, s * 1.4, s * 1.1);
        }
      }

      // Würfel springt über jedes Hindernis
      let y = 0, rot = 0;
      const near = obstacles(P - L, P + L);
      for (const o of near) {
        const start = o.ox - L / 2;
        if (P >= start && P <= start + L) {
          const ph = (P - start) / L;
          y = 4 * jumpH * ph * (1 - ph);
          rot = (o.i + smooth(ph)) * (Math.PI / 2);
        } else if (P > start + L) rot = (o.i + 1) * (Math.PI / 2);
      }
      // Spur
      for (let k = 1; k <= 10; k++) {
        ctx.fillStyle = `hsla(${hue + 180}, 100%, 70%, ${0.4 - k * 0.035})`;
        const sz = s * (0.5 - k * 0.03);
        ctx.fillRect(cubeX - s / 2 - k * s * 0.35, ground - s / 2 - sz / 2 - y * Math.max(0, 1 - k * 0.15), sz, sz);
      }
      ctx.save();
      ctx.translate(cubeX, ground - s / 2 - y);
      ctx.rotate(rot);
      ctx.shadowColor = `hsl(${hue + 120}, 100%, 60%)`;
      ctx.shadowBlur = 35;
      ctx.fillStyle = `hsl(${hue + 120}, 100%, 55%)`;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = `hsl(${hue + 300}, 100%, 60%)`;
      ctx.fillRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
      ctx.strokeRect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
      ctx.restore();
    },
  };
}

/* ======================= Lava-Lampe ======================= */

function lavaLamp(seed) {
  return {
    draw(ctx, W, H, t) {
      const hue = (seed * 30 + t * 6) % 360;
      ctx.fillStyle = `hsl(${hue + 250}, 60%, 7%)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const x = W * (0.5 + 0.38 * Math.sin(t * (0.13 + hash(i + seed) * 0.12) + i * 2.1));
        const y = H * (0.5 + 0.42 * Math.sin(t * (0.09 + hash(i * 3 + seed) * 0.1) + i * 1.3));
        const r = W * (0.3 + 0.18 * Math.sin(t * 0.3 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const h = (hue + i * 40) % 360;
        g.addColorStop(0, `hsla(${h}, 100%, 60%, 0.55)`);
        g.addColorStop(1, `hsla(${h}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 40; i++) {
        const sp = 40 + hash(i * 7 + seed) * 90;
        const y = H - ((t * sp + hash(i + seed) * H * 1.2) % (H * 1.2)) + H * 0.1;
        const x = W * hash(i * 13 + seed) + Math.sin(t + i) * 20;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(x, y, W * (0.004 + hash(i * 2) * 0.01), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

export const BUILTIN_BACKGROUNDS = [
  { id: 'neon', name: 'Neon-Runner (Subway-Stil)', create: (seed) => ({ draw: (ctx, W, H, t) => drawProceduralBackground(ctx, W, H, t, seed) }) },
  { id: 'blocks', name: 'Block-Parkour (Minecraft-Stil)', create: blockParkour },
  { id: 'dash', name: 'Geometry Jump', create: geometryJump },
  { id: 'balls', name: 'Satisfying Balls', create: bouncingBalls },
  { id: 'tetris', name: 'Block-Regen (Tetris-Stil)', create: tetris },
  { id: 'lava', name: 'Lava-Lampe (ruhig)', create: lavaLamp },
];

export function createBackground(id, seed = Math.floor(Math.random() * 1000)) {
  const def = BUILTIN_BACKGROUNDS.find((b) => b.id === id) || BUILTIN_BACKGROUNDS[0];
  return def.create(seed);
}
