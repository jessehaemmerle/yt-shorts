// Setzt ein Einzelbild zusammen: Hintergrund (Story-Look, Split oder Gameplay), Hook-Karte, Story-Visual,
// Urteil, Kommentar-Frage, Erzähler-Figur und Untertitel – abhängig davon, welches Segment gerade läuft.
import { segmentAt } from './plan.js';
import { chunkAt } from './captions.js';
import { drawCaption, drawProgressBar, drawWatermark } from './draw.js';
import { drawThemeBackground, drawPersonaBadge, drawHookCard, drawBeat, drawVerdict, drawCta, drawCliffhanger } from './visuals.js';

export const LAYOUTS = {
  story: { panel: [0.14, 0.47], caption: 0.72 },
  split: { panel: [0.14, 0.34], caption: 0.5, gameplay: [0.5, 0.5] },
  gameplay: { panel: [0.13, 0.29], caption: null },
};

/** Ergänzt die Zeilen-Segmente um Chat-Verläufe und Zeiten (einmal pro Video). */
export function prepareBeats(plan, timeline) {
  let run = [];
  let partner = '';
  for (const seg of timeline.segments) {
    if (seg.kind !== 'line') {
      run = [];
      continue;
    }
    const v = plan.lines[seg.index].visual;
    seg.visual = v;
    if (v.type === 'chat' && v.text) {
      if (v.from !== 'me' && v.sender) partner = v.sender;
      run = [...run, { from: v.from === 'me' ? 'me' : 'them', sender: v.sender || (v.from === 'me' ? 'Me' : 'Them'), text: v.text, start: seg.start }].slice(-5);
      seg.chat = run;
      seg.partner = partner;
    } else {
      run = [];
      seg.chat = [];
    }
  }
  return timeline;
}

function clipRect(ctx, r, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.translate(r.x, r.y);
  fn(r.w, r.h);
  ctx.restore();
}

/**
 * s: { plan, timeline, chunks, post, style, persona, personaName, niche, mode, tag, duration,
 *      drawGameplay?(ctx, w, h, t) – zeichnet Gameplay/Animation in ein Rechteck der Größe w×h }
 */
export function composeFrame(ctx, W, H, t, s, cache = {}) {
  const mode = LAYOUTS[s.mode] ? s.mode : 'story';
  const L = LAYOUTS[mode];
  const accent = s.niche.palette[2];
  const palette = s.niche.palette;

  // 1) Hintergrund
  if (mode === 'gameplay') {
    s.drawGameplay(ctx, W, H, t);
    if (s.style.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.style.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    drawThemeBackground(ctx, W, H, t, palette);
    if (mode === 'split') {
      const r = { x: 0, y: H * L.gameplay[0], w: W, h: H * L.gameplay[1] };
      clipRect(ctx, r, (w, h) => s.drawGameplay(ctx, w, h, t));
      ctx.fillStyle = accent;
      ctx.fillRect(0, r.y - 4, W, 8);
    }
  }

  const panel = { x: W * 0.04, y: H * L.panel[0], w: W * 0.92, h: H * L.panel[1] };
  const seg = segmentAt(s.timeline, t);
  const age = seg ? t - seg.start : 0;
  let captions = true;
  const plan = s.plan;
  const partLabel = plan.part.total > 1 ? (plan.lang === 'de' ? `TEIL ${plan.part.index}/${plan.part.total}` : `PART ${plan.part.index}/${plan.part.total}`) : '';

  // 2) Segment-Ebene
  if (seg) {
    switch (seg.kind) {
      case 'hook':
        drawHookCard(ctx, W, H, panel, { text: plan.hookText || plan.hook, tag: s.tag, partLabel, accent, age });
        captions = false;
        break;
      case 'line':
        if (seg.visual && (mode !== 'gameplay' || seg.visual.type === 'reddit' || seg.visual.type === 'chat')) {
          drawBeat(ctx, W, H, panel, seg, t, { accent, post: s.post, theme: s.style.theme, allowScene: mode !== 'gameplay' });
        }
        break;
      case 'cliff':
        drawCliffhanger(ctx, W, panel, { nextPart: plan.part.index + 1, accent, age, lang: plan.lang });
        break;
      case 'take':
        drawVerdict(ctx, W, panel, { label: s.persona.takeLabel[plan.lang] || s.persona.takeLabel.en, verdict: plan.verdict, persona: s.persona, accent, age });
        break;
      case 'cta':
        drawCta(ctx, W, H, panel, { question: plan.ctaOnScreen || plan.cta, options: plan.options, accent, age, lang: plan.lang });
        captions = false;
        break;
      case 'loop':
        // Das Ende sieht aus wie der Anfang → nahtloser Loop beim erneuten Abspielen.
        drawHookCard(ctx, W, H, panel, { text: plan.hookText || plan.hook, tag: s.tag, partLabel, accent, age: 1, alpha: Math.min(1, age / 0.5) });
        break;
    }
  }

  // 3) Erzähler-Figur
  if (s.style.showPersona !== false) drawPersonaBadge(ctx, W, H, s.persona, s.personaName, t, accent);

  // 4) Untertitel
  if (captions && s.chunks.length) {
    const r = chunkAt(s.chunks, t, cache.hint || 0);
    cache.hint = r.index;
    if (r.chunk) drawCaption(ctx, W, H, r.chunk, t, { ...s.style, position: L.caption ?? s.style.position });
  }
  drawWatermark(ctx, W, H, s.style.watermark, s.style.font, mode === 'gameplay' ? 0.74 : mode === 'split' ? 0.47 : 0.635);
  if (s.style.progressBar) drawProgressBar(ctx, W, H, t / s.duration, accent);
}
