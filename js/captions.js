// Wandelt die Zeichen-Zeitstempel von ElevenLabs in Wörter und Untertitel-Häppchen um.

export function buildWords(chars) {
  const words = [];
  let cur = null;
  for (const ch of chars) {
    if (/\s/.test(ch.c)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { raw: '', start: ch.start, end: ch.end };
    cur.raw += ch.c;
    cur.end = Math.max(cur.end, ch.end);
  }
  if (cur) words.push(cur);
  for (const w of words) {
    w.text = w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}?!]+$/gu, '').replace(/[“”"]/g, '');
    w.sentenceEnd = /[.!?…]["')\]]*$/.test(w.raw);
    w.pause = /[,;:]["')\]]*$/.test(w.raw);
  }
  return words.filter((w) => w.text);
}

/** Gruppiert Wörter zu kurzen Untertitel-Einblendungen. */
export function buildChunks(words, { maxWords = 3, maxChars = 16 } = {}) {
  const chunks = [];
  let cur = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) flush();
    cur.push(w);
    if (w.sentenceEnd || w.pause) flush();
  }
  flush();
  // Jede Einblendung bleibt bis zur nächsten stehen (kein Flackern), aber nicht ewig in langen Pausen.
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].showUntil = next ? Math.min(next.start, chunks[i].end + 1.0) : chunks[i].end + 0.6;
  }
  return chunks;
}

export function chunkAt(chunks, t, hint = 0) {
  // Linearer Fortschritt mit Hinweis-Index, da die Zeit beim Rendern monoton steigt.
  let i = Math.max(0, Math.min(hint, chunks.length - 1));
  while (i > 0 && chunks[i].start > t) i--;
  while (i < chunks.length - 1 && chunks[i + 1].start <= t) i++;
  const c = chunks[i];
  if (!c || t < c.start || t >= c.showUntil) return { chunk: null, index: i };
  return { chunk: c, index: i };
}
