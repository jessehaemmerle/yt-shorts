// Das Skript eines Shorts als Datenmodell ("Plan") und seine Abbildung auf die Zeitachse.
//
// Ein Plan beschreibt EINEN Teil (ein Video):
//   hook        – gesprochener Einstieg: der krasseste Satz, kein Intro
//   hookText    – kurzer Text, der ab Frame 1 groß im Bild steht
//   lines[]     – die (gekürzte) Story; jede Zeile mit eigenem Visual
//   cliffhanger – nur bei Teilen vor dem letzten: Spannung auf Teil 2
//   take        – eigene Ebene: Urteil/Analyse der Erzähler-Figur; verdict = kurzes Etikett (z.B. "NTA")
//   cta         – direkte Frage an die Zuschauer; ctaOnScreen + options für die Einblendung
//   loop        – Schlusssatz, der grammatisch in den Hook zurückläuft (Video loopt nahtlos)
import { spokenWordCount, buildWords } from './captions.js';

export const VISUAL_TYPES = ['scene', 'chat', 'stat', 'reddit', 'none'];

export function emptyVisual(type = 'scene') {
  return { type, from: 'them', sender: '', text: '', emojis: '', value: '' };
}

/** Bringt einen (z.B. von Claude gelieferten) Plan in eine saubere, vollständige Form. */
export function normalizePlan(p, defaults = {}) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const plan = {
    lang: p.lang || defaults.lang || 'en',
    nicheId: p.nicheId || defaults.nicheId || 'custom',
    personaId: p.personaId || defaults.personaId || 'judge',
    hook: str(p.hook),
    hookText: str(p.hookText),
    lines: (p.lines || [])
      .map((l) => ({ say: str(l.say), visual: { ...emptyVisual(), ...(l.visual || {}) } }))
      .filter((l) => l.say),
    cliffhanger: str(p.cliffhanger),
    take: str(p.take),
    verdict: str(p.verdict),
    cta: str(p.cta),
    ctaOnScreen: str(p.ctaOnScreen),
    options: Array.isArray(p.options) ? p.options.map(str).filter(Boolean).slice(0, 2) : [],
    loop: str(p.loop),
    part: { index: p.part?.index || 1, total: p.part?.total || 1 },
    ytTitle: str(p.ytTitle),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags.map((h) => str(h).replace(/^#/, '')).filter(Boolean) : [],
    generator: p.generator || defaults.generator || 'auto',
  };
  for (const l of plan.lines) if (!VISUAL_TYPES.includes(l.visual.type)) l.visual.type = 'scene';
  // Satzzeichen am Segmentende sorgen für eine kurze Sprechpause und saubere Untertitel-Trennung.
  const end = (s) => (s && !/[.!?…:"”'’)]$/.test(s) ? s + '.' : s);
  plan.hook = end(plan.hook);
  plan.cliffhanger = end(plan.cliffhanger);
  plan.take = end(plan.take);
  plan.cta = end(plan.cta);
  for (const l of plan.lines) l.say = end(l.say);
  return plan;
}

/** Reihenfolge, in der gesprochen wird. Der Loop-Satz kommt ganz am Ende und führt zurück in den Hook. */
export function segmentsOf(plan) {
  const segs = [];
  if (plan.hook) segs.push({ kind: 'hook', text: plan.hook });
  plan.lines.forEach((l, i) => segs.push({ kind: 'line', index: i, text: l.say }));
  if (plan.cliffhanger) segs.push({ kind: 'cliff', text: plan.cliffhanger });
  if (plan.take) segs.push({ kind: 'take', text: plan.take });
  if (plan.cta) segs.push({ kind: 'cta', text: plan.cta });
  if (plan.loop) segs.push({ kind: 'loop', text: plan.loop });
  return segs;
}

export function narrationText(plan) {
  return segmentsOf(plan)
    .map((s) => s.text)
    .join('\n\n');
}

export function planWordCount(plan) {
  return segmentsOf(plan).reduce((n, s) => n + spokenWordCount(s.text), 0);
}

/**
 * Ordnet jedem Segment seine Sprechzeit zu – anhand der Wort-Zeitstempel von ElevenLabs.
 * Rückgabe: [{kind, index?, text, start, end}] – end = Start des nächsten Segments (bzw. Videoende).
 */
export function buildTimeline(plan, chars, totalDuration) {
  const words = buildWords(chars);
  const segs = segmentsOf(plan);
  let w = 0;
  const out = [];
  for (const s of segs) {
    const n = spokenWordCount(s.text);
    const first = words[Math.min(w, words.length - 1)];
    const last = words[Math.min(w + Math.max(n, 1) - 1, words.length - 1)];
    out.push({ ...s, start: first ? first.start : 0, speechEnd: last ? last.end : 0, wordStart: w, wordCount: n });
    w += n;
  }
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].start : totalDuration;
  if (out.length) out[0].start = 0;
  return { segments: out, words };
}

export function segmentAt(timeline, t) {
  const segs = timeline.segments;
  for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].start) return segs[i];
  return segs[0] || null;
}
