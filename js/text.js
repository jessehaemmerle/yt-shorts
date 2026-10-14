// Aufbereitung von Reddit-Texten für Voice-over und Untertitel.

// Abkürzungen, die eine TTS-Stimme sonst falsch oder gar nicht ausspricht.
const ABBREVIATIONS = [
  [/\bAITAH?\b/g, 'Am I the a-hole'],
  [/\bWIBTAH?\b/g, 'Would I be the a-hole'],
  [/\bTIFU\b/g, 'Today I messed up'],
  [/\bTL;?DR:?/gi, 'Too long, didn\'t read:'],
  [/\bNTA\b/g, 'not the a-hole'],
  [/\bYTA\b/g, 'you\'re the a-hole'],
  [/\bESH\b/g, 'everyone sucks here'],
  [/\bNAH\b/g, 'no a-holes here'],
  [/\bBF\b/g, 'boyfriend'],
  [/\bGF\b/g, 'girlfriend'],
  [/\bbf\b/g, 'boyfriend'],
  [/\bgf\b/g, 'girlfriend'],
  [/\bMIL\b/g, 'mother-in-law'],
  [/\bFIL\b/g, 'father-in-law'],
  [/\bSIL\b/g, 'sister-in-law'],
  [/\bBIL\b/g, 'brother-in-law'],
  [/\bDH\b/g, 'my husband'],
  [/\bDW\b/g, 'my wife'],
  [/\bIMO\b/g, 'in my opinion'],
  [/\bIMHO\b/g, 'in my humble opinion'],
  [/\bIDK\b/gi, 'I don\'t know'],
  [/\btbh\b/gi, 'to be honest'],
  [/\bngl\b/gi, 'not gonna lie'],
  [/\bOMG\b/gi, 'oh my god'],
  [/\bw\/o\b/gi, 'without'],
  [/\bw\//gi, 'with '],
  [/\bppl\b/gi, 'people'],
  [/\bbc\b/gi, 'because'],
  [/\bcuz\b/gi, 'because'],
];

// "YouTube-sichere" Ersetzungen im typischen Brainrot-Stil.
const CENSOR = [
  [/\bmotherf+u+c+k+(er|ers|ing)?\b/gi, 'mother-freaker'],
  [/\bf+u+c+k+(ing|in|ed|er|ers|s)?\b/gi, (m, suf = '') => 'freak' + (suf || '')],
  [/\bshit(ty|s|ting)?\b/gi, (m, suf = '') => 'crap' + ({ ty: 'py', s: 's', ting: 'ping' }[suf?.toLowerCase()] ?? '')],
  [/\bbullshit\b/gi, 'nonsense'],
  [/\bbitch(es|ing|y)?\b/gi, (m, suf = '') => ({ es: 'jerks', ing: 'complaining', y: 'snappy' }[suf?.toLowerCase()] ?? 'jerk')],
  [/\bass ?holes?\b/gi, (m) => (m.toLowerCase().endsWith('s') ? 'a-holes' : 'a-hole')],
  [/\bdick(s|head)?\b/gi, 'jerk'],
  [/\bbastards?\b/gi, 'jerk'],
  [/\bcunts?\b/gi, 'jerk'],
  [/\bporn\b/gi, 'corn'],
  [/\bsex\b/gi, 'seggs'],
  [/\bsexual(ly)?\b/gi, (m, suf = '') => 'seggsual' + (suf || '')],
  [/\bsuicide\b/gi, 'self-unaliving'],
  [/\bkill(ed|ing|s)?\b/gi, (m, suf = '') => 'unalive' + ({ ed: 'd', ing: 'ing', s: 's' }[suf?.toLowerCase()] ?? '')],
  [/\bmurder(ed|ing|s)?\b/gi, (m, suf = '') => 'unalive' + ({ ed: 'd', ing: 'ing', s: 's' }[suf?.toLowerCase()] ?? '')],
  [/\brape(d)?\b/gi, (m, d) => (d ? 'assaulted' : 'assault')],
];

export function cleanText(input, { censor = true, stripEdits = true } = {}) {
  let s = String(input || '');
  s = s.replace(/\r/g, '').replace(/&#x200B;|​/g, '');
  // Markdown-Links -> nur Text, nackte URLs entfernen
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/https?:\/\/\S+/g, '');
  s = s.replace(/\b(?:www\.)\S+/g, '');
  if (stripEdits) {
    // Alles ab der ersten Zeile, die mit "Edit:"/"Update:"-artigen Markern beginnt, ist meist Danksagung o.ä.
    s = s.replace(/(?:\n|(?<=[.!?])[ \t]+)[ \t]*(?:\*\*)?(?:edit|eta|ps)[ \t]*\d*[ \t]*(?:\*\*)?[ \t]*[:\-].*$/is, '');
  }
  // Markdown-Formatierung
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  s = s.replace(/^\s*>\s?/gm, '');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/(\*\*|__|~~|\*|`|\^)/g, '');
  // Alters-/Geschlechtsangaben wie "(25F)", "[M30]", "(19 m)"
  s = s.replace(/[(\[]\s*(\d{1,2})\s*(?:[mfMF]|nb|NB)\s*[)\]]/g, ', $1,');
  s = s.replace(/[(\[]\s*(?:[mfMF]|nb|NB)\s*(\d{1,2})\s*[)\]]/g, ', $1,');
  for (const [re, rep] of ABBREVIATIONS) s = s.replace(re, rep);
  if (censor) for (const [re, rep] of CENSOR) s = s.replace(re, rep);
  // Leerzeichen und Satzzeichen glätten
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ ,/g, ',').replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map((l) => l.trim()).join('\n');
  return s.trim();
}

export function wordCount(s) {
  return (String(s).match(/\S+/g) || []).length;
}

// ElevenLabs spricht bei Speed 1.0 ungefähr 2,6 Wörter pro Sekunde.
export const WORDS_PER_SECOND = 2.6;

export function estimateSeconds(words, speed = 1) {
  return words / (WORDS_PER_SECOND * speed);
}

export function formatDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function formatCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

// Teilt einen langen Text an Satzgrenzen in Stücke von höchstens maxChars Zeichen.
export function splitText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?]*["')\]]*\s*|\n+/g) || [text];
  const chunks = [];
  let cur = '';
  for (const sentence of sentences) {
    if ((cur + sentence).length > maxChars && cur) {
      chunks.push(cur.trim());
      cur = '';
    }
    if (sentence.length > maxChars) {
      for (let i = 0; i < sentence.length; i += maxChars) chunks.push(sentence.slice(i, i + maxChars).trim());
    } else {
      cur += sentence;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

export function slugify(s, max = 50) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'short';
}

export function youtubeMetadata(post, credits = []) {
  const sub = post.subreddit ? `r/${post.subreddit}` : 'Reddit';
  const subTag = post.subreddit ? '#' + post.subreddit.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const tags = ['#shorts', '#reddit', '#redditstories', subTag, '#storytime'].filter(Boolean);
  let title = post.title.replace(/\s+/g, ' ').trim();
  const suffix = ' #shorts';
  if (title.length + suffix.length > 100) title = title.slice(0, 100 - suffix.length - 1).trimEnd() + '…';
  title += suffix;
  const credit = post.author ? `Story from ${sub} by u/${post.author}` : `Story from ${sub}`;
  const description = [post.title, '', credit + (post.url ? `\n${post.url}` : ''), ...credits, '', tags.join(' ')].join('\n');
  return { title, description, tags: tags.map((t) => t.slice(1)).join(', ') };
}
