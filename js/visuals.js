// Story-Visuals statt (oder zusätzlich zu) Gameplay: Hook-Karte, Chat-Nachbau, Emoji-Szenen, Zahlen,
// Urteils-Stempel der Erzähler-Figur, Kommentar-Frage und Cliffhanger. Alles wird direkt auf das
// Canvas gezeichnet und ist eine reine Funktion der Zeit.
import { drawRedditCard } from './draw.js';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const BOLD = '"Montserrat", Arial, sans-serif';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Emojis einmal in moderater Größe rastern und dann skaliert zeichnen: große Emoji-Schriftgrößen werden
// von manchen Systemen nur als blasse Umriss-Glyphe gerendert – und so ist es auch schneller.
const emojiCache = new Map();
function emojiImage(e) {
  if (!emojiCache.has(e)) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const x = c.getContext('2d');
    x.font = `120px ${EMOJI_FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffffff';
    x.fillText(e, 80, 88);
    emojiCache.set(e, c);
  }
  return emojiCache.get(e);
}
export function drawEmoji(ctx, e, x, y, size) {
  const img = emojiImage(e);
  const s = size * (160 / 120);
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
}
const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Größte Schrift, bei der der Text in maxLines Zeilen und maxW Breite passt. */
function fit(ctx, text, maxW, maxLines, start, min, weight = 900, family = BOLD) {
  let size = start, lines;
  for (;;) {
    ctx.font = `${weight} ${Math.round(size)}px ${family}`;
    lines = wrap(ctx, text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
    if ((lines.length <= maxLines && widest <= maxW) || size <= min) break;
    size *= 0.93;
  }
  return { lines, size: Math.round(size) };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

/* ---------------- Hintergrund in den Farben der Nische ---------------- */

export function drawThemeBackground(ctx, W, H, t, palette) {
  const [dark, mid, accent] = palette;
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, mid);
  g.addColorStop(0.55, dark);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // weiche, langsam wandernde Lichtflecken
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = W * (0.5 + 0.45 * Math.sin(t * (0.11 + i * 0.03) + i * 1.7));
    const y = H * (0.45 + 0.4 * Math.cos(t * (0.08 + i * 0.025) + i * 2.3));
    const r = W * (0.45 + 0.1 * i);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(i % 2 ? accent : mid, 0.18));
    rg.addColorStop(1, rgba(mid, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // dezentes, schräg laufendes Punkteraster
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const step = W / 12;
  const off = (t * 18) % step;
  for (let y = -step; y < H + step; y += step)
    for (let x = -step; x < W + step; x += step) {
      ctx.beginPath();
      ctx.arc(x + off + ((y / step) % 2) * (step / 2), y + off, 3, 0, Math.PI * 2);
      ctx.fill();
    }
}

/* ---------------- Wiedererkennbare Erzähler-Figur ---------------- */

export function drawPersonaBadge(ctx, W, H, persona, name, t, accent) {
  const r = W * 0.052;
  const x = W * 0.06 + r, y = H * 0.065 + r;
  const pulse = 1 + 0.04 * Math.sin(t * 6);
  ctx.save();
  ctx.font = `800 ${Math.round(W * 0.034)}px ${BOLD}`;
  const label = name || persona.name;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x - r, y - r * 0.72, r * 2 + tw + W * 0.06, r * 1.44, r * 0.72);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
  ctx.fill();
  drawEmoji(ctx, persona.emoji, x, y, r * 1.2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${Math.round(W * 0.034)}px ${BOLD}`;
  ctx.fillText(label, x + r + W * 0.025, y + 2);
  ctx.restore();
}

/* ---------------- Hook-Karte (ab Frame 1) ---------------- */

export function drawHookCard(ctx, W, H, rect, { text, tag, partLabel, accent, age, alpha = 1 }) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const maxW = rect.w * 0.9;
  let { lines, size } = fit(ctx, text.toUpperCase(), maxW, 4, W * 0.13, W * 0.06);
  // Textblock + Etikett müssen in den Bereich passen (sonst Überlappung mit der Erzähler-Figur)
  const need = lines.length * size * 1.22 + W * 0.2;
  if (need > rect.h) size = Math.round(size * Math.max(0.6, (rect.h - W * 0.2) / (lines.length * size * 1.22)));
  ctx.font = `900 ${size}px ${BOLD}`;
  const lineH = size * 1.22;
  const total = lines.length * lineH;
  const punch = age < 0.25 ? 1.25 - 0.25 * easeOutBack(age / 0.25) : 1 + 0.012 * Math.sin(age * 5);
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  ctx.translate(cx, cy);
  ctx.scale(punch, punch);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Tag-Zeile (Serie + Folge, Subreddit, Teil)
  if (tag || partLabel) {
    ctx.font = `800 ${Math.round(W * 0.036)}px ${BOLD}`;
    const label = [tag, partLabel].filter(Boolean).join('  ·  ');
    const tw = ctx.measureText(label).width + W * 0.06;
    const ty = -total / 2 - W * 0.09;
    ctx.fillStyle = accent;
    roundRect(ctx, -tw / 2, ty - W * 0.035, tw, W * 0.07, W * 0.035);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillText(label, 0, ty + 2);
  }
  ctx.font = `900 ${size}px ${BOLD}`;
  lines.forEach((line, i) => {
    const y = -total / 2 + lineH * (i + 0.5);
    const w = ctx.measureText(line).width + size * 0.5;
    ctx.save();
    ctx.rotate(((i % 2 ? 1 : -1) * 1.6 * Math.PI) / 180);
    ctx.fillStyle = i % 2 ? '#ffffff' : accent;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, -w / 2, y - lineH * 0.46, w, lineH * 0.92, size * 0.18);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#0a0a0a';
    ctx.fillText(line, 0, y + size * 0.04);
    ctx.restore();
  });
  ctx.restore();
}

/* ---------------- Story-Beats ---------------- */

function drawScene(ctx, W, rect, v, age, accent) {
  const cx = rect.x + rect.w / 2;
  const emojis = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v.emojis || '🤔'), (s) => s.segment)
    .filter((s) => s.trim())
    .slice(0, 3);
  const es = rect.h * (emojis.length > 1 ? 0.3 : 0.38);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(es)}px ${EMOJI_FONT}`;
  const gap = es * 1.15;
  emojis.forEach((e, i) => {
    const local = age - i * 0.12;
    const k = easeOutBack(clamp01(local / 0.35));
    const bob = Math.sin(age * 3 + i) * es * 0.04;
    const x = cx + (i - (emojis.length - 1) / 2) * gap;
    const y = rect.y + rect.h * 0.36 + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(Math.sin(age * 2 + i) * 0.06);
    drawEmoji(ctx, e, 0, 0, es);
    ctx.restore();
  });
  if (v.text) {
    const k = easeOut((age - 0.15) / 0.3);
    const { lines, size } = fit(ctx, v.text.toUpperCase(), rect.w * 0.9, 2, W * 0.085, W * 0.05);
    ctx.font = `900 ${size}px ${BOLD}`;
    ctx.globalAlpha = k;
    lines.forEach((line, i) => {
      const y = rect.y + rect.h * 0.78 + i * size * 1.2 + (1 - k) * 40;
      const w = ctx.measureText(line).width + size * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, cx - w / 2, y - size * 0.62, w, size * 1.2, size * 0.2);
      ctx.fill();
      ctx.fillStyle = i === 0 ? accent : '#fff';
      ctx.fillText(line, cx, y + size * 0.03);
    });
  }
  ctx.restore();
}

function drawStat(ctx, W, rect, v, age, accent) {
  const cx = rect.x + rect.w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Zahl hochzählen lassen, wenn sie eindeutig ist
  let shown = v.value;
  const m = v.value.match(/^([^\d]*)([\d.,]+)(.*)$/);
  if (m) {
    const num = parseFloat(m[2].replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0) {
      const k = easeOut(age / 0.7);
      const cur = num * k;
      const decimals = /\.\d/.test(m[2]) ? 1 : 0;
      shown = m[1] + cur.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: k < 1 ? 0 : decimals }) + m[3];
    }
  }
  const { size } = fit(ctx, v.value, rect.w * 0.9, 1, W * 0.22, W * 0.09);
  const k = easeOutBack(clamp01(age / 0.3));
  ctx.translate(cx, rect.y + rect.h * 0.42);
  ctx.scale(k, k);
  ctx.font = `900 ${size}px ${BOLD}`;
  ctx.lineWidth = size * 0.1;
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.strokeText(shown, 0, 0);
  ctx.fillStyle = accent;
  ctx.fillText(shown, 0, 0);
  if (v.text) {
    ctx.font = `800 ${Math.round(W * 0.055)}px ${BOLD}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(v.text.toUpperCase(), 0, size * 0.85);
  }
  ctx.restore();
}

function drawChat(ctx, W, fullRect, messages, t, accent, partner) {
  // messages: [{from, sender, text, start}] – nur die aktuelle Folge von Chat-Zeilen
  const pad = W * 0.04;
  const x = fullRect.x + fullRect.w * 0.05, w = fullRect.w * 0.9;
  const them = [...messages].reverse().find((m) => m.from === 'them')?.sender || partner || 'Chat';
  // Fensterhöhe an den Inhalt anpassen (mittig im Bereich)
  ctx.font = `600 ${Math.round(W * 0.044)}px ${BOLD}`;
  const fs0 = Math.round(W * 0.044);
  const contentH = messages.reduce((h, m) => h + wrap(ctx, m.text, w * 0.72 - fs0 * 1.4).length * fs0 * 1.3 + fs0 * 1.4, 0);
  const h = Math.min(fullRect.h, W * 0.13 + contentH + pad * 2 + fs0);
  const rect = { x: fullRect.x, y: fullRect.y + (fullRect.h - h) / 2, w: fullRect.w, h };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#f4f4f7';
  roundRect(ctx, x, rect.y, w, rect.h, W * 0.05);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // Kopfzeile
  const headH = W * 0.13;
  ctx.fillStyle = '#e9e9ee';
  roundRect(ctx, x, rect.y, w, headH, W * 0.05);
  ctx.fill();
  ctx.fillRect(x, rect.y + headH * 0.5, w, headH * 0.5);
  const ar = headH * 0.3;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + pad + ar, rect.y + headH / 2, ar, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(ar * 1.1)}px ${BOLD}`;
  ctx.fillText(them.slice(0, 1).toUpperCase(), x + pad + ar, rect.y + headH / 2 + 2);
  ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(W * 0.042)}px ${BOLD}`;
  ctx.fillText(them, x + pad + ar * 2 + W * 0.025, rect.y + headH / 2 + 2);

  // Blasen von unten nach oben stapeln (neueste unten)
  const fs = Math.round(W * 0.044);
  ctx.font = `600 ${fs}px ${BOLD}`;
  const maxBW = w * 0.72;
  const bubbles = messages.map((m) => {
    const lines = wrap(ctx, m.text, maxBW - fs * 1.4);
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4;
    return { ...m, lines, bw, bh: lines.length * fs * 1.3 + fs * 0.9 };
  });
  let y = rect.y + rect.h - pad;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, rect.y + headH, w, rect.h - headH);
  ctx.clip();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    const age = t - b.start;
    const typing = b.from === 'them' && age < 0.45 && i === bubbles.length - 1;
    const bh = typing ? fs * 2 : b.bh;
    const bw = typing ? fs * 4 : b.bw;
    const k = easeOutBack(clamp01((typing ? age : age - (b.from === 'them' ? 0.45 : 0)) / 0.25));
    y -= bh;
    const bx = b.from === 'me' ? x + w - pad - bw : x + pad;
    ctx.save();
    ctx.translate(bx + (b.from === 'me' ? bw : 0), y + bh);
    ctx.scale(typing ? 1 : k, typing ? 1 : k);
    ctx.translate(-(b.from === 'me' ? bw : 0), -bh);
    ctx.fillStyle = b.from === 'me' ? '#2f7cf6' : '#dcdce3';
    roundRect(ctx, 0, 0, bw, bh, fs * 0.9);
    ctx.fill();
    ctx.fillStyle = b.from === 'me' ? '#fff' : '#111';
    if (typing) {
      for (let d = 0; d < 3; d++) {
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(age * 12 - d));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(fs * (1.1 + d * 0.9), bh / 2, fs * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      b.lines.forEach((l, li) => ctx.fillText(l, fs * 0.7, fs * 0.45 + li * fs * 1.3));
    }
    ctx.restore();
    y -= fs * 0.5;
    if (y < rect.y + headH) break;
  }
  ctx.restore();
  ctx.restore();
}

/** Zeichnet das Visual der aktuellen Story-Zeile in den Bereich rect. */
export function drawBeat(ctx, W, H, rect, beat, t, { accent, post, theme = 'light', allowScene = true }) {
  const v = beat.visual;
  const age = t - beat.start;
  if (v.type === 'none') return;
  if (v.type === 'chat') return drawChat(ctx, W, rect, beat.chat, t, accent, beat.partner);
  if (v.type === 'stat' && v.value) return drawStat(ctx, W, rect, v, age, accent);
  // Die Reddit-Karte steht nur kurz; danach übernimmt das eigentliche Visual der Zeile (falls vorhanden).
  const hasFallback = allowScene && (v.fallbackType === 'stat' ? v.value : v.emojis || v.text);
  if (v.type === 'reddit' && age > 3.4 && hasFallback) {
    return v.fallbackType === 'stat' ? drawStat(ctx, W, rect, v, age - 3.4, accent) : drawScene(ctx, W, rect, v, age - 3.4, accent);
  }
  if (v.type === 'reddit') {
    drawRedditCard(ctx, W, H, post, age, Math.max(0.5, Math.min(hasFallback ? 3.15 : 1e9, beat.end - beat.start - 0.25)), { theme: theme === 'dark' ? 'dark' : 'light', cy: rect.y + rect.h / 2 });
    return;
  }
  drawScene(ctx, W, rect, v, age, accent);
}

/* ---------------- Eigene Ebene: Urteil ---------------- */

export function drawVerdict(ctx, W, rect, { label, verdict, persona, accent, age }) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = clamp01(age / 0.2);
  drawEmoji(ctx, persona.emoji, cx, cy - rect.h * 0.24 + Math.sin(age * 3) * 6, rect.h * 0.26);
  ctx.font = `900 ${Math.round(W * 0.05)}px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(label, cx, cy - rect.h * 0.02);
  if (verdict) {
    // Stempel "knallt" auf die Karte
    const slam = clamp01((age - 0.3) / 0.18);
    const scale = 2.2 - 1.2 * slam;
    ctx.globalAlpha = clamp01((age - 0.3) / 0.1);
    ctx.translate(cx, cy + rect.h * 0.22);
    ctx.rotate((-8 * Math.PI) / 180);
    ctx.scale(scale, scale);
    const { size } = fit(ctx, verdict.toUpperCase(), rect.w * 0.75, 1, W * 0.14, W * 0.06);
    ctx.font = `900 ${size}px ${BOLD}`;
    const w = ctx.measureText(verdict.toUpperCase()).width + size * 0.7;
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = accent;
    roundRect(ctx, -w / 2, -size * 0.75, w, size * 1.5, size * 0.2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(verdict.toUpperCase(), 0, size * 0.04);
  }
  ctx.restore();
}

/* ---------------- Engagement: Frage + Antwort-Buttons ---------------- */

export function drawCta(ctx, W, H, rect, { question, options, accent, age, lang }) {
  const cx = rect.x + rect.w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const k = easeOutBack(clamp01(age / 0.3));
  const { lines, size } = fit(ctx, (question || '').toUpperCase(), rect.w * 0.9, 2, W * 0.11, W * 0.06);
  ctx.font = `900 ${size}px ${BOLD}`;
  ctx.save();
  ctx.translate(cx, rect.y + rect.h * 0.25);
  ctx.scale(k, k);
  lines.forEach((l, i) => {
    const y = (i - (lines.length - 1) / 2) * size * 1.15;
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';
    ctx.strokeText(l, 0, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(l, 0, y);
  });
  ctx.restore();
  if (options?.length === 2) {
    const bw = rect.w * 0.4, bh = W * 0.15;
    const colors = ['#ff4d6d', '#3ddc84'];
    options.forEach((opt, i) => {
      const kk = easeOutBack(clamp01((age - 0.2 - i * 0.12) / 0.3));
      const bx = cx + (i === 0 ? -1 : 1) * rect.w * 0.23;
      const by = rect.y + rect.h * 0.62 + Math.sin(age * 4 + i * 2) * 6;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(kk, kk);
      ctx.fillStyle = colors[i];
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 20;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      const f = fit(ctx, opt.toUpperCase(), bw * 0.85, 1, W * 0.065, W * 0.035);
      ctx.font = `900 ${f.size}px ${BOLD}, ${EMOJI_FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(opt.toUpperCase(), 0, 3);
      ctx.restore();
    });
  }
  // Pfeil Richtung Kommentar-Button (rechts unten in der Shorts-App)
  const ax = W * 0.86, ay = H * 0.6 + Math.sin(age * 6) * 14;
  ctx.globalAlpha = clamp01((age - 0.5) / 0.3);
  drawEmoji(ctx, '👇', ax, ay, W * 0.09);
  ctx.font = `900 ${Math.round(W * 0.04)}px ${BOLD}`;
  ctx.fillStyle = accent;
  ctx.fillText(lang === 'de' ? 'KOMMENTIER!' : 'COMMENT!', ax - W * 0.02, ay - W * 0.08);
  ctx.restore();
}

export function drawCliffhanger(ctx, W, rect, { nextPart, accent, age, lang }) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const k = easeOutBack(clamp01(age / 0.3));
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  drawEmoji(ctx, '⏭️', 0, -W * 0.16, W * 0.2);
  ctx.font = `900 ${Math.round(W * 0.1)}px ${BOLD}`;
  ctx.lineWidth = W * 0.014;
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  const txt = lang === 'de' ? `TEIL ${nextPart} FOLGT` : `PART ${nextPart} NEXT`;
  ctx.strokeText(txt, 0, W * 0.04);
  ctx.fillStyle = accent;
  ctx.fillText(txt, 0, W * 0.04);
  ctx.font = `800 ${Math.round(W * 0.05)}px ${BOLD}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(lang === 'de' ? '➕ FOLGEN, UM ES NICHT ZU VERPASSEN' : '➕ FOLLOW SO YOU DON’T MISS IT', 0, W * 0.15);
  ctx.restore();
}
