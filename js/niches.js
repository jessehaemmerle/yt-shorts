// Nischen (feste Themen-Serien) und Erzähler-Figuren.
// Eine Nische legt fest, aus welchen Subreddits Stories kommen, welche davon thematisch gefiltert werden,
// welche Frage am Ende gestellt wird, welche Hashtags und welche Farbwelt das Video bekommt.

export const NICHES = [
  {
    id: 'work',
    name: 'Arbeit & Chef-Storys',
    series: { en: 'Boss Files', de: 'Chef-Akte' },
    subs: ['MaliciousCompliance', 'antiwork', 'IDontWorkHereLady', 'TalesFromRetail', 'talesfromtechsupport', 'AmItheAsshole', 'AITAH'],
    // Nur diese Subs werden zusätzlich nach Stichworten gefiltert (sie sind thematisch breit).
    filterSubs: ['AmItheAsshole', 'AITAH', 'antiwork'],
    keywords: /\b(boss|manager|supervisor|coworker|co-worker|colleague|job|work(place|ing)?|fired|hr|shift|office|promotion|raise|salary|customer|employee|interview|quit|resign|overtime|ceo)\b/i,
    cta: { en: 'Would you have quit on the spot?', de: 'Hättest du sofort gekündigt?' },
    ctaOnScreen: { en: 'WOULD YOU QUIT?', de: 'KÜNDIGEN ODER BLEIBEN?' },
    options: { en: ['QUIT', 'STAY'], de: ['KÜNDIGEN', 'BLEIBEN'] },
    hashtags: ['worklife', 'badboss', 'maliciouscompliance', 'jobstories'],
    palette: ['#0b1f3a', '#1d5fa8', '#3ad1ff'],
  },
  {
    id: 'revenge',
    name: 'Rache-Storys',
    series: { en: 'Revenge Files', de: 'Rache-Akte' },
    subs: ['pettyrevenge', 'ProRevenge', 'NuclearRevenge', 'MaliciousCompliance'],
    filterSubs: [],
    keywords: /./,
    cta: { en: 'Too far, or perfectly fair?', de: 'Zu weit gegangen oder völlig fair?' },
    ctaOnScreen: { en: 'TOO FAR OR FAIR?', de: 'ZU WEIT ODER FAIR?' },
    options: { en: ['TOO FAR', 'FAIR'], de: ['ZU WEIT', 'FAIR'] },
    hashtags: ['revenge', 'pettyrevenge', 'karma', 'storytime'],
    palette: ['#2a0707', '#b3261e', '#ff9a3c'],
  },
  {
    id: 'aita',
    name: 'Wer ist im Unrecht? (AITA)',
    series: { en: 'Court of Reddit', de: 'Reddit-Gericht' },
    subs: ['AmItheAsshole', 'AITAH', 'AmIOverreacting', 'WouldIBeTheAhole'],
    filterSubs: [],
    keywords: /./,
    cta: { en: 'YTA or NTA? Tell me in the comments.', de: 'Im Unrecht oder nicht? Schreib’s in die Kommentare.' },
    ctaOnScreen: { en: 'YTA OR NTA?', de: 'IM UNRECHT ODER NICHT?' },
    options: { en: ['YTA', 'NTA'], de: ['IM UNRECHT', 'IM RECHT'] },
    hashtags: ['aita', 'amitheasshole', 'redditstories', 'storytime'],
    palette: ['#1a1405', '#c79a00', '#ffe600'],
  },
  {
    id: 'relationships',
    name: 'Beziehung & Dating',
    series: { en: 'Red Flag Diaries', de: 'Red-Flag-Tagebuch' },
    subs: ['relationship_advice', 'AmIOverreacting', 'TrueOffMyChest', 'BestofRedditorUpdates', 'AITAH'],
    filterSubs: ['TrueOffMyChest', 'AITAH', 'BestofRedditorUpdates'],
    keywords: /\b(boyfriend|girlfriend|bf|gf|husband|wife|fianc[eé]e?|partner|dating|date|ex|cheat(ed|ing)?|marriage|married|divorce|wedding)\b/i,
    cta: { en: 'Red flag or overreaction?', de: 'Red Flag oder Überreaktion?' },
    ctaOnScreen: { en: 'RED FLAG?', de: 'RED FLAG?' },
    options: { en: ['🚩 RED FLAG', 'OVERREACTION'], de: ['🚩 RED FLAG', 'ÜBERREAKTION'] },
    hashtags: ['relationships', 'redflag', 'dating', 'storytime'],
    palette: ['#2a0a1e', '#c2185b', '#ff7ab6'],
  },
  {
    id: 'family',
    name: 'Familie & Hochzeit',
    series: { en: 'Family Drama', de: 'Familiendrama' },
    subs: ['entitledparents', 'JUSTNOMIL', 'weddingshaming', 'AITAH', 'AmItheAsshole'],
    filterSubs: ['AITAH', 'AmItheAsshole'],
    keywords: /\b(mom|mother|dad|father|sister|brother|mil|in-law|parents?|wedding|bride|groom|aunt|uncle|cousin|grandma|grandmother|family|inheritance|baby shower)\b/i,
    cta: { en: 'Who is the real problem here?', de: 'Wer ist hier das eigentliche Problem?' },
    ctaOnScreen: { en: 'WHO’S THE PROBLEM?', de: 'WER IST DAS PROBLEM?' },
    options: { en: ['OP', 'FAMILY'], de: ['OP', 'FAMILIE'] },
    hashtags: ['familydrama', 'entitledparents', 'wedding', 'storytime'],
    palette: ['#10241a', '#2e7d32', '#9be36b'],
  },
  {
    id: 'confessions',
    name: 'Geständnisse',
    series: { en: 'Confession Booth', de: 'Beichtstuhl' },
    subs: ['confessions', 'TrueOffMyChest', 'offmychest'],
    filterSubs: [],
    keywords: /./,
    cta: { en: 'Could you forgive this? Yes or no?', de: 'Könntest du das verzeihen? Ja oder nein?' },
    ctaOnScreen: { en: 'FORGIVE?', de: 'VERZEIHEN?' },
    options: { en: ['YES', 'NO'], de: ['JA', 'NEIN'] },
    hashtags: ['confession', 'secrets', 'trueoffmychest', 'storytime'],
    palette: ['#120c26', '#5e35b1', '#b39dff'],
  },
  {
    id: 'creepy',
    name: 'Gruselig & Unerklärlich',
    series: { en: 'After Dark', de: 'Nach Mitternacht' },
    subs: ['nosleep', 'LetsNotMeet', 'Glitch_in_the_Matrix', 'Paranormal'],
    filterSubs: [],
    keywords: /./,
    cta: { en: 'Would you have stayed? Be honest.', de: 'Wärst du geblieben? Sei ehrlich.' },
    ctaOnScreen: { en: 'WOULD YOU STAY?', de: 'WÄRST DU GEBLIEBEN?' },
    options: { en: ['STAY', 'RUN'], de: ['BLEIBEN', 'RENNEN'] },
    hashtags: ['scarystories', 'creepy', 'nosleep', 'horrorstories'],
    palette: ['#050608', '#263238', '#7fffd4'],
  },
  {
    id: 'custom',
    name: 'Eigene Auswahl (Subreddits frei wählen)',
    series: { en: 'Reddit Stories', de: 'Reddit-Storys' },
    subs: null,
    filterSubs: [],
    keywords: /./,
    cta: { en: 'What would you have done? Comment below.', de: 'Was hättest du gemacht? Schreib’s in die Kommentare.' },
    ctaOnScreen: { en: 'WHAT WOULD YOU DO?', de: 'WAS HÄTTEST DU GEMACHT?' },
    options: { en: ['👍', '👎'], de: ['👍', '👎'] },
    hashtags: ['redditstories', 'storytime', 'reddit'],
    palette: ['#0b0b12', '#3d2a7a', '#ff3d7f'],
  },
];

export function getNiche(id) {
  return NICHES.find((n) => n.id === id) || NICHES[NICHES.length - 1];
}

/** Passt eine Story thematisch zur Nische? Breite Subreddits werden nach Stichworten gefiltert. */
export function matchesNiche(niche, post) {
  if (!niche.filterSubs?.some((s) => s.toLowerCase() === String(post.subreddit).toLowerCase())) return true;
  return niche.keywords.test(post.title + ' ' + post.body.slice(0, 1500));
}

// Wiedererkennbare Erzähler-Figuren. "style" geht an den Skript-Autor (Claude), "voice" sind Startwerte
// für ElevenLabs (niedrige Stabilität + Stil = ausdrucksstärker).
export const PERSONAS = [
  {
    id: 'judge',
    name: 'Richterin Rita',
    emoji: '👩‍⚖️',
    style: 'A sharp, dry judge. Delivers a clear verdict with one precise reason. Calm authority, a little deadpan humour. Never sits on the fence.',
    takeLabel: { en: 'THE VERDICT', de: 'DAS URTEIL' },
    voice: { stability: 0.5, style: 0.25 },
  },
  {
    id: 'buddy',
    name: 'Kumpel Kev',
    emoji: '😏',
    style: 'Sarcastic best friend. Roasts whoever deserves it, uses casual slang, punchy jokes, but lands on a real opinion.',
    takeLabel: { en: 'MY TAKE', de: 'MEINE MEINUNG' },
    voice: { stability: 0.35, style: 0.55 },
  },
  {
    id: 'psych',
    name: 'Dr. Psycho-Logik',
    emoji: '🧠',
    style: 'Pop-psychology explainer. Names the pattern behind the behaviour (e.g. gaslighting, projection, sunk-cost fallacy, people-pleasing) in plain words and says what it means for the people involved. No diagnoses of real people, framed as "this is what psychologists call…".',
    takeLabel: { en: 'PSYCHOLOGY SAYS', de: 'DIE PSYCHOLOGIE SAGT' },
    voice: { stability: 0.55, style: 0.2 },
  },
  {
    id: 'drama',
    name: 'Drama-Tante Doris',
    emoji: '💅',
    style: 'Gossipy, theatrical aunt. Gasps, exaggerates, picks a side loudly and dramatically, but stays funny rather than mean.',
    takeLabel: { en: 'TEA TIME', de: 'TRATSCH-URTEIL' },
    voice: { stability: 0.3, style: 0.65 },
  },
  {
    id: 'narrator',
    name: 'Erzähler (neutral)',
    emoji: '🎙️',
    style: 'Neutral storyteller. Gives a short, fair two-sided reflection instead of a hard verdict.',
    takeLabel: { en: 'THE TWIST', de: 'DER KNACKPUNKT' },
    voice: { stability: 0.5, style: 0.1 },
  },
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

// Folgen-Zähler pro Serie, damit wiederkehrende Zuschauer eine fortlaufende Reihe sehen.
const EP_KEY = 'brs-episodes';
export function nextEpisode(nicheId, { commit = false } = {}) {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(EP_KEY)) || {};
  } catch {
    /* leer */
  }
  const n = (map[nicheId] || 0) + 1;
  if (commit) {
    map[nicheId] = n;
    try {
      localStorage.setItem(EP_KEY, JSON.stringify(map));
    } catch {
      /* privater Modus */
    }
  }
  return n;
}
