// Eingebauter Skript-Autor ohne KI: wählt den krassesten Satz als Hook, baut Visuals aus Stichworten,
// teilt zu lange Stories in Teile mit Cliffhanger und hängt Urteil, Frage und Loop-Satz an.
// Mit Claude (llm.js) wird die Story zusätzlich gekürzt, umformuliert und wirklich beurteilt.
import { cleanText, WORDS_PER_SECOND } from './text.js';
import { spokenWordCount } from './captions.js';
import { getNiche, getPersona } from './niches.js';
import { normalizePlan, emptyVisual } from './plan.js';

const DRAMA = [
  'cheat', 'cheated', 'cheating', 'affair', 'pregnant', 'divorce', 'police', 'cops', 'fired', 'arrested', 'lied', 'lying',
  'secret', 'secretly', 'stole', 'stolen', 'revenge', 'screamed', 'yelled', 'slapped', 'kicked out', 'disowned',
  'inheritance', 'betrayed', 'found out', 'caught', 'worst', 'last straw', 'died', 'funeral', 'hospital', 'blocked',
  'ruined', 'humiliated', 'threatened', 'lawyer', 'sued', 'court', 'destroyed', 'never', 'everyone', 'refused',
  'banned', 'quit', 'exposed', 'shocked', 'furious', 'crying', 'sobbing', 'laughed', 'ex', 'wedding', 'divorced',
  'diary', 'texts', 'messages', 'locked', 'missing', 'trapped', 'stalked', 'followed', 'unalive', 'unalived',
  'betrug', 'gelogen', 'polizei', 'gefeuert', 'schwanger', 'hochzeit', 'geheim', 'rache', 'erwischt', 'geschrien',
];
const TWIST_START = /^(but|then|that'?s when|suddenly|and then|until|turns out|little did|aber|dann|plötzlich|bis)\b/i;

const EMOJI = [
  [/\b(boss|manager|supervisor|ceo|chef)\b/i, '👔'], [/\b(coworkers?|colleagues?|kollegen?)\b/i, '🧑‍💼'],
  [/\b(office|job|work|shift|büro|arbeit)\b/i, '🏢'], [/\b(fired|gefeuert|quit|resign)/i, '📦'],
  [/(\$|€|\bmoney\b|\bpaid\b|\bpay\b|\bsalary\b|\brent\b|\bgeld\b)/i, '💸'], [/\b(wedding|hochzeit|ring|engaged|proposal)\b/i, '💍'],
  [/\b(bride|braut)\b/i, '👰'], [/\b(husband|wife|boyfriend|girlfriend|partner|fianc)/i, '💑'],
  [/\b(cheat|affair|betray|betrug)/i, '💔'], [/\b(pregnant|baby|schwanger)\b/i, '🤰'],
  [/\b(phone|texts?|texted|message|handy|nachricht)/i, '📱'], [/\b(police|cops|polizei)\b/i, '🚓'],
  [/\b(lawyer|court|sued|anwalt|gericht)\b/i, '⚖️'], [/\b(car|auto|drove|driving)\b/i, '🚗'],
  [/\b(house|apartment|home|wohnung|haus)\b/i, '🏠'], [/\b(mom|mother|mum|mutter|mama)\b/i, '👩'],
  [/\b(dad|father|vater|papa)\b/i, '👨'], [/\b(sister|schwester)\b/i, '👧'], [/\b(brother|bruder)\b/i, '👦'],
  [/\b(mil|mother-in-law|schwiegermutter)\b/i, '👵'], [/\b(cat|katze)\b/i, '🐈'], [/\b(dog|hund)\b/i, '🐕'],
  [/\b(dinner|food|cooked|essen|kitchen)\b/i, '🍽️'], [/\b(birthday|cake|geburtstag)\b/i, '🎂'],
  [/\b(party|feier)\b/i, '🎉'], [/\b(hospital|doctor|krankenhaus|arzt)\b/i, '🏥'], [/\b(school|teacher|schule)\b/i, '🏫'],
  [/\b(christmas|weihnacht)/i, '🎄'], [/\b(gift|present|geschenk)\b/i, '🎁'], [/\b(secret|geheim)/i, '🤫'],
  [/\b(lied|lie|lying|gelogen)\b/i, '🤥'], [/\b(cried|crying|tears|sobbing|weinte)\b/i, '😭'],
  [/\b(angry|furious|screamed|yelled|wütend|schrie)\b/i, '😡'], [/\b(laughed|laughing|lachte)\b/i, '😂'],
  [/\b(shocked|froze|stunned|schock)/i, '😱'], [/\b(revenge|rache|petty)\b/i, '😈'], [/\b(door|tür)\b/i, '🚪'],
  [/\b(night|midnight|nacht)\b/i, '🌙'], [/\b(ghost|geist|shadow)\b/i, '👻'], [/\b(knife|messer)\b/i, '🔪'],
  [/\b(key|keys|schlüssel)\b/i, '🔑'], [/\b(flight|plane|airport|flug)\b/i, '✈️'], [/\b(store|customer|shop|kunde)\b/i, '🛒'],
  [/\b(computer|laptop|email|server)\b/i, '💻'], [/\b(letter|brief)\b/i, '✉️'], [/\b(friend|freund|freundin)\b/i, '🫂'],
];
const NICHE_EMOJI = { work: '🏢', revenge: '😈', aita: '🤔', relationships: '💔', family: '👪', confessions: '🤫', creepy: '👁️', custom: '😳' };

const SENDERS = /\bmy\s+(boss|manager|mom|mother|dad|father|husband|wife|boyfriend|girlfriend|bf|gf|sister|brother|mil|coworker|friend|landlord|neighbou?r|ex|fianc[eé]e?)\b/i;
const STOP = new Set('the a an and or but so to of in on at for with my me i was were is are it that this he she they we you his her their our be been had have has did do not no just then when what which who very really'.split(' '));

export function splitSentences(text) {
  const out = [];
  for (const para of String(text).split(/\n+/)) {
    const m = para.match(/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)/g) || [];
    for (const s of m) if (s.trim()) out.push(s.trim());
  }
  return out;
}

function detectLang(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const de = (t.match(/ (und|ich|nicht|der|die|das|ist|mein|meine|sie|er|wir|aber|dass) /g) || []).length;
  const en = (t.match(/ (and|i|not|the|is|my|she|he|we|but|that|was|to) /g) || []).length;
  return de > en ? 'de' : 'en';
}

function hookScore(sentence, i, n) {
  const s = sentence.toLowerCase();
  let score = 0;
  for (const k of DRAMA) if (s.includes(k)) score += 2;
  if (/["“”]/.test(sentence)) score += 1.5;
  if (/!/.test(sentence)) score += 1;
  if (/[$€]\s?\d|\d+\s?(k|grand|years|months|dollars|euro)/i.test(sentence)) score += 1.5;
  const words = spokenWordCount(sentence);
  score += words >= 7 && words <= 24 ? 2 : words < 5 ? -3 : -1;
  if (i === 0) score -= 2; // Erste Sätze sind fast immer Kontext ("Mein Freund und ich sind seit…")
  if (i === 1) score -= 1;
  if (/^(so|ok(ay)?|hi|hello|throwaway|for context|background|edit|update)\b/i.test(sentence)) score -= 4;
  if (i > n * 0.4) score += 0.5;
  return score;
}

function shortTitle(title, lang) {
  let t = title.replace(/^\s*(aitah?|wibtah?|tifu|am i the a-hole|would i be the a-hole)\s*(for|if|by)?\s*/i, '');
  t = t.replace(/[,;:]\s*$/, '').trim();
  if (/^(aitah?|am i the a-hole)/i.test(title)) t = (lang === 'de' ? 'Bin ich im Unrecht, weil ' : 'Am I wrong for ') + t;
  const words = t.split(/\s+/);
  if (words.length > 9) t = words.slice(0, 8).join(' ') + '…';
  return t.replace(/\?*$/, '') + (/^(am i|bin ich|would|should|was)/i.test(t) ? '?' : '');
}

function visualFor(line, nicheId) {
  const quote = line.match(/["“]([^"”]{3,140})["”]/);
  if (quote) {
    const before = line.slice(0, quote.index);
    const me = /\b(i|we)\s+(said|told|asked|replied|texted|answered|yelled|screamed|wrote)\b|\bsagte ich\b/i.test(before) || /^i\b/i.test(before.trim());
    const who = line.match(SENDERS)?.[1];
    return { ...emptyVisual('chat'), from: me ? 'me' : 'them', sender: me ? 'Me' : who ? who[0].toUpperCase() + who.slice(1).toLowerCase() : 'Them', text: quote[1].trim() };
  }
  const stat = line.match(/([$€]\s?[\d.,]+\s?(?:k|grand)?|\b\d[\d.,]*\s?(?:years?|months?|weeks?|days?|hours?|dollars?|euros?|kids?|times|jahre|monate|tage|stunden)\b)/i);
  if (stat) {
    const after = line
      .slice(stat.index + stat[0].length)
      .split(/[.!?;,]/)[0]
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(' ');
    return { ...emptyVisual('stat'), value: stat[0].trim(), text: after };
  }
  const emojis = [];
  for (const [re, e] of EMOJI) if (re.test(line) && !emojis.includes(e)) emojis.push(e);
  if (!emojis.length) emojis.push(NICHE_EMOJI[nicheId] || '😳');
  // Kernaussage: die 2–4 aussagekräftigsten aufeinanderfolgenden Wörter
  const words = line.replace(/["“”]/g, '').split(/\s+/);
  let best = '', bestScore = -1;
  for (let i = 0; i < words.length; i++) {
    for (let len = 2; len <= 4 && i + len <= words.length; len++) {
      const slice = words.slice(i, i + len);
      const clean = slice.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''));
      if (STOP.has(clean[0]) || STOP.has(clean[clean.length - 1])) continue;
      if (slice.slice(0, -1).some((w) => /[.!?;:,]$/.test(w))) continue; // nicht über Satzgrenzen hinweg
      let sc = clean.reduce((n, w) => n + (STOP.has(w) ? 0 : w.length > 3 ? 2 : 1), 0) + (DRAMA.some((d) => clean.join(' ').includes(d)) ? 4 : 0) - len * 0.6;
      if (sc > bestScore) {
        bestScore = sc;
        best = slice.join(' ').replace(/[.,!?;:]+$/, '');
      }
    }
  }
  return { ...emptyVisual('scene'), emojis: emojis.slice(0, 3).join(''), text: best || words.slice(-3).join(' ') };
}

const redditVisual = (v) => ({ ...v, type: 'reddit', fallbackType: v.type === 'chat' ? 'none' : v.type });

function groupLines(sentences) {
  // 1–2 Sätze pro Zeile, damit jedes Visual ein paar Sekunden steht.
  const lines = [];
  let cur = '';
  for (const s of sentences) {
    const next = cur ? cur + ' ' + s : s;
    if (cur && (spokenWordCount(next) > 28 || /["“]/.test(s) || /["“]/.test(cur))) {
      lines.push(cur);
      cur = s;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function splitParts(sentences, budget, maxParts = 5) {
  const total = sentences.reduce((n, s) => n + spokenWordCount(s), 0);
  if (total <= budget * 1.2) return [sentences];
  const parts = Math.max(2, Math.min(maxParts, Math.ceil(total / budget), Math.floor(total / 55)));
  const target = total / parts;
  const out = [];
  let cur = [], count = 0;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    cur.push(s);
    count += spokenWordCount(s);
    const next = sentences[i + 1];
    const remainingParts = parts - out.length - 1;
    if (!next || remainingParts <= 0) continue;
    // Schnitt bevorzugt direkt vor einem Wendepunkt ("But…", "Then…") – das ist der Cliffhanger.
    const near = count >= target * 0.75;
    if ((near && TWIST_START.test(next)) || count >= target * 1.15) {
      out.push(cur);
      cur = [];
      count = 0;
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

const TAKES = {
  judge: {
    en: ['My verdict: the moment someone chose their pride over a simple honest conversation, this was lost. And it wasn’t OP who chose it.', 'Verdict? Being polite isn’t the same as being a doormat. OP drew a line, and that line was fair.'],
    de: ['Mein Urteil: In dem Moment, in dem jemand Stolz über ein ehrliches Gespräch gestellt hat, war alles verloren. Und das war nicht OP.', 'Urteil? Höflich sein heißt nicht, sich alles gefallen zu lassen. OP hat eine Grenze gezogen, und die war fair.'],
  },
  buddy: {
    en: ['Look, I’ve seen bad decisions, but this one deserves its own documentary. Somebody here needs a reality check, and it’s not who you think.', 'Honestly? If this happened to me, I’d have done the exact same thing, just way less politely.'],
    de: ['Ganz ehrlich, ich hab schon viele schlechte Entscheidungen gesehen, aber die hier verdient eine eigene Doku.', 'Ehrlich? Wäre mir das passiert, hätte ich genau dasselbe gemacht, nur deutlich unhöflicher.'],
  },
  psych: {
    en: ['Psychologists call this a boundary violation: someone tests how far they can go, and every time nobody pushes back, the line moves. OP finally pushed back.', 'What we see here is classic projection: accusing someone else of exactly what you are doing yourself.'],
    de: ['Psychologen nennen das eine Grenzverletzung: Jemand testet, wie weit er gehen kann, und solange niemand widerspricht, verschiebt sich die Grenze.', 'Das hier ist klassische Projektion: Man wirft anderen genau das vor, was man selbst tut.'],
  },
  drama: {
    en: ['Oh, the audacity! I would have packed my bags and taken the good towels with me. Iconic behaviour from OP, honestly.', 'Girl. GIRL. The nerve of these people! I’m clutching my pearls over here.'],
    de: ['Also diese Dreistigkeit! Ich hätte die Koffer gepackt und die guten Handtücher gleich mitgenommen.', 'Schätzchen. SCHÄTZCHEN. Diese Unverschämtheit! Ich bin fassungslos.'],
  },
  narrator: {
    en: ['Here’s the thing: both sides believed they were the reasonable one. That’s exactly why this blew up.', 'The twist is that nobody here was evil, just everyone was a little too proud.'],
    de: ['Das Spannende: Beide Seiten hielten sich für die Vernünftigen. Genau deshalb ist es eskaliert.', 'Der Knackpunkt: Niemand hier war böse, nur alle ein bisschen zu stolz.'],
  },
};

const T = {
  en: {
    cliff: 'Part {n} is up next. Follow so you don’t miss what happened.',
    cliffCta: 'What do you think happens next? Comment your guess.',
    cliffOnScreen: 'WHAT HAPPENS NEXT?',
    recap: 'Part {n}. Last time:',
    loop: 'And honestly? I still can’t believe it all started like this:',
  },
  de: {
    cliff: 'Teil {n} kommt als Nächstes. Folge mir, damit du nicht verpasst, wie es weitergeht.',
    cliffCta: 'Was glaubst du, passiert als Nächstes? Schreib deinen Tipp in die Kommentare.',
    cliffOnScreen: 'WIE GEHT’S WEITER?',
    recap: 'Teil {n}. Was bisher geschah:',
    loop: 'Und ehrlich? Ich fasse immer noch nicht, dass alles so anfing:',
  },
};

/**
 * Erstellt die Pläne (einen pro Teil) für einen Reddit-Post.
 * opts: { nicheId, personaId, targetSec, speed, withTake, withCta, withLoop, allowParts, censor, stripEdits }
 */
export function autoScript(post, opts) {
  const niche = getNiche(opts.nicheId);
  const persona = getPersona(opts.personaId);
  const body = cleanText(post.body, { censor: opts.censor, stripEdits: opts.stripEdits });
  const title = cleanText(post.title, { censor: opts.censor, stripEdits: false });
  const lang = detectLang(title + ' ' + body);
  const t = T[lang];
  const sentences = splitSentences(body);
  if (!sentences.length) throw new Error('Die Story hat keinen Text.');

  // Hook = krassester Satz der Story
  let hookIdx = 0, best = -Infinity;
  sentences.forEach((s, i) => {
    const sc = hookScore(s, i, sentences.length);
    if (sc > best) {
      best = sc;
      hookIdx = i;
    }
  });
  // Verbindungswörter am Anfang ergeben ohne Kontext keinen Sinn ("Then the director called…").
  const hook = sentences[hookIdx]
    .replace(/^(then|so|and|but|also|anyway|well|dann|also|und|aber)\b[\s,]*/i, '')
    .replace(/^./, (c) => c.toUpperCase());

  const take = opts.withTake ? TAKES[persona.id][lang][Math.floor(Math.random() * 2)] : '';
  const cta = opts.withCta ? niche.cta[lang] : '';
  const loop = opts.withLoop ? t.loop : '';
  const wps = WORDS_PER_SECOND * (opts.speed || 1);
  const budget = Math.round(opts.targetSec * wps);
  const overhead = spokenWordCount(hook) + spokenWordCount(take) + spokenWordCount(cta) + spokenWordCount(loop);
  // Teile sollen sich lohnen: Hook + Story dürfen das Ziel ausfüllen, Meinung/Frage kommen nur im letzten Teil dazu.
  const storyBudget = Math.max(60, budget - spokenWordCount(hook) - Math.round((overhead - spokenWordCount(hook)) / 2));

  // Wenn der Hook aus den ersten Sätzen stammt, nicht doppelt erzählen.
  const story = hookIdx <= 1 ? sentences.filter((_, i) => i !== hookIdx) : sentences;
  const parts = opts.allowParts ? splitParts(story, storyBudget) : [story];
  const hookText = shortTitle(title, lang);

  return parts.map((partSentences, pi) => {
    const isLast = pi === parts.length - 1;
    const n = pi + 1;
    const lines = groupLines(partSentences).map((say, li) => ({
      say,
      visual: pi === 0 && li === 0 ? redditVisual(visualFor(say, niche.id)) : visualFor(say, niche.id),
    }));
    const prevLast = pi > 0 ? parts[pi - 1][parts[pi - 1].length - 1] : '';
    return normalizePlan(
      {
        lang,
        nicheId: niche.id,
        personaId: persona.id,
        hook: pi === 0 ? hook : `${t.recap.replace('{n}', n)} ${prevLast}`,
        hookText,
        lines,
        cliffhanger: isLast ? '' : t.cliff.replace('{n}', n + 1),
        take: isLast ? take : '',
        verdict: '',
        cta: isLast ? cta : opts.withCta ? t.cliffCta : '',
        ctaOnScreen: isLast ? niche.ctaOnScreen[lang] : t.cliffOnScreen,
        options: isLast ? niche.options[lang] : [],
        loop: isLast ? loop : '',
        part: { index: n, total: parts.length },
        hashtags: niche.hashtags,
        generator: 'auto',
      },
      {}
    );
  });
}
