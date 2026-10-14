// Zeichenfunktionen für das Video: Hintergrund, Reddit-Karte, Untertitel.
import { formatCount } from './text.js';

const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInCubic = (x) => x * x * x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- Prozeduraler "Endless Runner"-Hintergrund (falls kein Gameplay hochgeladen ist) ---------- */

export function drawProceduralBackground(ctx, W, H, t, seed = 0) {
  const horizon = H * 0.4;
  const f = W * 0.9;
  const camH = 1.6;
  const speed = 9;
  const travelled = t * speed;
  const hue = (seed * 57 + t * 8) % 360;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, `hsl(${hue + 240}, 70%, 8%)`);
  sky.addColorStop(1, `hsl(${hue + 290}, 80%, 30%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);

  // Sonne
  const sunR = W * 0.22;
  const sun = ctx.createLinearGradient(0, horizon - sunR * 2, 0, horizon);
  sun.addColorStop(0, `hsl(${hue + 40}, 100%, 65%)`);
  sun.addColorStop(1, `hsl(${hue + 330}, 100%, 55%)`);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(W / 2, horizon, sunR, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 260}, 70%, 12%)`;
  for (let i = 0; i < 6; i++) {
    const y = horizon - sunR * (0.12 + i * 0.16) + ((t * 30) % (sunR * 0.16));
    ctx.fillRect(W / 2 - sunR, y, sunR * 2, sunR * 0.035 * (1 + i * 0.3));
  }

  // Skyline
  ctx.fillStyle = `hsl(${hue + 260}, 60%, 6%)`;
  for (let i = 0; i < 24; i++) {
    const bw = W / 18;
    const x = ((i * bw - t * 12) % (W + bw * 2) + W + bw * 2) % (W + bw * 2) - bw;
    const bh = H * (0.03 + hash(i + seed) * 0.1);
    ctx.fillRect(x, horizon - bh, bw * 0.9, bh);
  }

  // Boden
  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, `hsl(${hue + 270}, 60%, 10%)`);
  ground.addColorStop(1, `hsl(${hue + 250}, 70%, 4%)`);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, W, H - horizon);

  const project = (x, y, z) => ({ x: W / 2 + (x * f) / z, y: horizon + ((camH - y) * f) / z, s: f / z });

  ctx.strokeStyle = `hsla(${hue + 300}, 100%, 60%, 0.55)`;
  ctx.lineWidth = 3;
  for (let k = 0; k < 40; k++) {
    const z = k + 1 - (travelled % 1);
    if (z < 0.6) continue;
    const p = project(0, 0, z);
    ctx.globalAlpha = clamp01(1.4 - z / 30);
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(W, p.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let x = -12; x <= 12; x += 1.2) {
    const a = project(x, 0, 0.6);
    const b = project(x, 0, 60);
    ctx.strokeStyle = Math.abs(x) < 2 ? `hsla(${hue + 180}, 100%, 60%, 0.9)` : `hsla(${hue + 300}, 100%, 60%, 0.35)`;
    ctx.lineWidth = Math.abs(x) < 2 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Hindernisse & Münzen (deterministisch aus Index berechnet)
  const items = [];
  const spacing = 3.2;
  const first = Math.floor(travelled / spacing);
  for (let i = first; i < first + 14; i++) {
    const z = i * spacing - travelled + 4;
    if (z < 3.2 || z > 45) continue;
    const lane = Math.floor(hash(i + seed * 13) * 3) - 1;
    items.push({ i, z, lane, coin: hash(i * 3.7 + seed) > 0.55 });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) {
    const x = it.lane * 1.2;
    const fade = clamp01(1.3 - it.z / 40) * clamp01((it.z - 3.2) / 1.5);
    ctx.globalAlpha = fade;
    if (it.coin) {
      const p = project(x, 0.7 + Math.sin(t * 6 + it.i) * 0.1, it.z);
      ctx.fillStyle = '#ffd400';
      ctx.shadowColor = '#ffd400';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.s * 0.22 * Math.abs(Math.cos(t * 4 + it.i)) + 2, p.s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const h = 0.9 + hash(it.i + 99) * 0.8;
      const tl = project(x - 0.5, h, it.z);
      const br = project(x + 0.5, 0, it.z);
      const back = project(x - 0.5, h, it.z + 0.8);
      const backR = project(x + 0.5, h, it.z + 0.8);
      const col = `hsl(${(hue + it.i * 47) % 360}, 90%, 55%)`;
      ctx.fillStyle = `hsl(${(hue + it.i * 47) % 360}, 90%, 72%)`;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(br.x, tl.y);
      ctx.lineTo(backR.x, backR.y);
      ctx.lineTo(back.x, back.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 25;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
  }
  ctx.globalAlpha = 1;

  // Läufer
  const laneT = t / 1.7;
  const laneIdx = Math.floor(laneT);
  const from = Math.floor(hash(laneIdx + seed) * 3) - 1;
  const to = Math.floor(hash(laneIdx + 1 + seed) * 3) - 1;
  const lerp = clamp01((laneT - laneIdx) * 4);
  const rx = (from + (to - from) * (lerp * lerp * (3 - 2 * lerp))) * 1.2;
  const jump = Math.max(0, Math.sin(t * 3.4)) ** 2 * 0.9;
  const feet = project(rx, jump, 5);
  const head = project(rx, jump + 1.55, 5);
  const bodyH = feet.y - head.y;
  const bw = bodyH * 0.28;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const shadow = project(rx, 0, 5);
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, bw * 0.9, bw * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  const run = Math.sin(t * 16);
  ctx.strokeStyle = '#1b1b2f';
  ctx.lineWidth = bw * 0.38;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(feet.x, feet.y - bodyH * 0.42);
  ctx.lineTo(feet.x - bw * 0.5 * run, feet.y);
  ctx.moveTo(feet.x, feet.y - bodyH * 0.42);
  ctx.lineTo(feet.x + bw * 0.5 * run, feet.y);
  ctx.stroke();
  ctx.fillStyle = '#ff3d7f';
  ctx.shadowColor = '#ff3d7f';
  ctx.shadowBlur = 30;
  roundRect(ctx, feet.x - bw / 2, head.y + bodyH * 0.2, bw, bodyH * 0.42, bw * 0.3);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd7b5';
  ctx.beginPath();
  ctx.arc(head.x, head.y + bodyH * 0.1, bw * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00e1ff';
  ctx.fillRect(head.x - bw * 0.45, head.y - bodyH * 0.02, bw * 0.9, bw * 0.22);
  ctx.lineCap = 'butt';
}

/* ---------- Reddit-Karte (wird während des Titels eingeblendet) ---------- */

export function drawRedditCard(ctx, W, H, post, t, titleEnd, opts = {}) {
  const inDur = 0.35, outDur = 0.25;
  if (t > titleEnd + outDur) return false;
  let scale = easeOutBack(clamp01(t / inDur));
  let alpha = 1;
  if (t > titleEnd) {
    const k = easeInCubic(clamp01((t - titleEnd) / outDur));
    scale *= 1 - k * 0.3;
    alpha = 1 - k;
  }
  const dark = opts.theme === 'dark';
  const font = '"Montserrat"';
  const cw = W * 0.86;
  const pad = cw * 0.06;
  ctx.save();

  ctx.font = `800 ${Math.round(W * 0.05)}px ${font}, Arial, sans-serif`;
  let titleSize = W * 0.05;
  let lines = wrapLines(ctx, post.title, cw - pad * 2);
  while (lines.length > 6 && titleSize > W * 0.032) {
    titleSize *= 0.92;
    ctx.font = `800 ${Math.round(titleSize)}px ${font}, Arial, sans-serif`;
    lines = wrapLines(ctx, post.title, cw - pad * 2);
  }
  const lineH = titleSize * 1.25;
  const headerH = W * 0.1;
  const footerH = W * 0.08;
  const ch = pad + headerH + pad * 0.5 + lines.length * lineH + pad * 0.6 + footerH + pad * 0.6;
  const cx = W / 2, cy = H * 0.42;

  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cw / 2, -ch / 2);

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = dark ? '#1a1a1b' : '#ffffff';
  roundRect(ctx, 0, 0, cw, ch, W * 0.035);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Avatar
  const av = headerH * 0.85;
  const avX = pad + av / 2, avY = pad + headerH / 2;
  ctx.fillStyle = '#ff4500';
  ctx.beginPath();
  ctx.arc(avX, avY, av / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(avX, avY + av * 0.08, av * 0.3, av * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4500';
  ctx.beginPath();
  ctx.arc(avX - av * 0.11, avY + av * 0.06, av * 0.045, 0, Math.PI * 2);
  ctx.arc(avX + av * 0.11, avY + av * 0.06, av * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(avX + av * 0.2, avY - av * 0.28, av * 0.07, 0, Math.PI * 2);
  ctx.fill();

  const textX = pad + av + pad * 0.5;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = dark ? '#d7dadc' : '#1c1c1c';
  ctx.font = `800 ${Math.round(W * 0.036)}px ${font}, Arial, sans-serif`;
  const subName = opts.channelName || (post.subreddit ? `r/${post.subreddit}` : 'Reddit Stories');
  ctx.fillText(subName, textX, avY - headerH * 0.04);
  // Verifiziert-Haken
  const nameW = ctx.measureText(subName).width;
  const vr = W * 0.016;
  ctx.fillStyle = '#1d9bf0';
  ctx.beginPath();
  ctx.arc(textX + nameW + vr * 1.8, avY - headerH * 0.04 - vr * 0.9, vr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = vr * 0.35;
  ctx.beginPath();
  ctx.moveTo(textX + nameW + vr * 1.3, avY - headerH * 0.04 - vr * 0.9);
  ctx.lineTo(textX + nameW + vr * 1.7, avY - headerH * 0.04 - vr * 0.5);
  ctx.lineTo(textX + nameW + vr * 2.3, avY - headerH * 0.04 - vr * 1.3);
  ctx.stroke();

  ctx.fillStyle = dark ? '#818384' : '#787c7e';
  ctx.font = `600 ${Math.round(W * 0.027)}px ${font}, Arial, sans-serif`;
  ctx.fillText(post.author ? `u/${post.author}` : 'anonymous', textX, avY + headerH * 0.36);

  // Award-Abzeichen
  const awardColors = ['#ffd635', '#c0c0c0', '#ff8717', '#46d160'];
  for (let i = 0; i < awardColors.length; i++) {
    const ax = cw - pad - i * W * 0.045 - W * 0.018;
    ctx.fillStyle = awardColors[i];
    ctx.beginPath();
    ctx.arc(ax, avY, W * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }

  // Titel
  ctx.fillStyle = dark ? '#f2f2f2' : '#111';
  ctx.font = `800 ${Math.round(titleSize)}px ${font}, Arial, sans-serif`;
  let y = pad + headerH + pad * 0.5 + titleSize;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lineH;
  }

  // Fußzeile: Upvotes, Kommentare, Teilen
  const fy = ch - pad * 0.6 - footerH / 2;
  const iconColor = dark ? '#818384' : '#878a8c';
  ctx.font = `700 ${Math.round(W * 0.03)}px ${font}, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  let fx = pad;
  const s = W * 0.022;
  ctx.fillStyle = '#ff4500';
  ctx.beginPath();
  ctx.moveTo(fx + s, fy - s);
  ctx.lineTo(fx + s * 2, fy);
  ctx.lineTo(fx + s * 1.4, fy);
  ctx.lineTo(fx + s * 1.4, fy + s);
  ctx.lineTo(fx + s * 0.6, fy + s);
  ctx.lineTo(fx + s * 0.6, fy);
  ctx.lineTo(fx, fy);
  ctx.closePath();
  ctx.fill();
  fx += s * 2.6;
  ctx.fillStyle = iconColor;
  const scoreText = formatCount(post.score || 0);
  ctx.fillText(scoreText, fx, fy);
  fx += ctx.measureText(scoreText).width + W * 0.06;
  ctx.strokeStyle = iconColor;
  ctx.lineWidth = s * 0.25;
  ctx.beginPath();
  ctx.ellipse(fx + s, fy, s, s * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  fx += s * 2.6;
  const commentText = formatCount(post.comments || 0);
  ctx.fillText(commentText, fx, fy);
  ctx.textAlign = 'right';
  ctx.fillText('Share', cw - pad, fy);
  ctx.textAlign = 'left';
  ctx.restore();
  return true;
}

/* ---------- Untertitel ---------- */

export function drawCaption(ctx, W, H, chunk, t, opts) {
  const fs = Math.round(W * (opts.size || 0.085));
  const font = `900 ${fs}px ${opts.font || 'Montserrat'}, Impact, Arial Black, sans-serif`;
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const words = chunk.words.map((w) => ({ w, text: opts.uppercase ? w.text.toUpperCase() : w.text }));
  const space = ctx.measureText(' ').width;
  const maxW = W * 0.86;
  const lines = [];
  let line = [], lw = 0;
  for (const it of words) {
    it.width = ctx.measureText(it.text).width;
    if (line.length && lw + space + it.width > maxW) {
      lines.push({ items: line, width: lw });
      line = [];
      lw = 0;
    }
    lw += (line.length ? space : 0) + it.width;
    line.push(it);
  }
  if (line.length) lines.push({ items: line, width: lw });

  const age = t - chunk.start;
  const pop = opts.animate === false ? 1 : 0.7 + 0.3 * easeOutBack(clamp01(age / 0.12));
  const cy = H * (opts.position ?? 0.5);
  const lineH = fs * 1.15;
  ctx.translate(W / 2, cy);
  ctx.scale(pop, pop);
  let activeIdx = -1;
  chunk.words.forEach((w, i) => {
    if (w.start <= t) activeIdx = i;
  });

  const totalH = lines.length * lineH;
  let idx = 0;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    let x = -L.width / 2;
    const y = -totalH / 2 + lineH * (li + 0.5);
    for (const it of L.items) {
      const active = idx === activeIdx && opts.highlight !== false;
      ctx.save();
      if (active && opts.animate !== false) {
        ctx.translate(x + it.width / 2, y);
        ctx.scale(1.08, 1.08);
        ctx.translate(-(x + it.width / 2), -y);
      }
      ctx.lineWidth = fs * 0.22;
      ctx.strokeStyle = '#000';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = fs * 0.15;
      ctx.shadowOffsetY = fs * 0.06;
      ctx.strokeText(it.text, x, y);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = active ? opts.highlightColor || '#ffe600' : opts.color || '#ffffff';
      ctx.fillText(it.text, x, y);
      ctx.restore();
      x += it.width + space;
      idx++;
    }
  }
  ctx.restore();
}

export function drawProgressBar(ctx, W, H, progress, color = '#ffe600') {
  const h = Math.round(H * 0.006);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, H - h, W, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, H - h, W * clamp01(progress), h);
}

export function drawWatermark(ctx, W, H, text, font = 'Montserrat') {
  if (!text) return;
  ctx.save();
  ctx.font = `800 ${Math.round(W * 0.04)}px ${font}, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = W * 0.008;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, W / 2, H * 0.74);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, W / 2, H * 0.74);
  ctx.restore();
}
