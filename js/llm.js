// Skript-Autor mit Claude: kürzt die Story auf 25–45 s, findet den stärksten Hook, schreibt die eigene
// Meinung der Erzähler-Figur, den Loop-Satz und ein Storyboard (Chat-Nachbau, Szenen, Zahlen).
// Läuft direkt im Browser mit dem API-Key des Nutzers (offizielles SDK, lokal gebündelt in vendor/).
import { Anthropic } from '../vendor/anthropic-sdk-1.8.0.min.mjs';
import { getNiche, getPersona } from './niches.js';
import { normalizePlan } from './plan.js';
import { cleanText, WORDS_PER_SECOND } from './text.js';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (beste Skripte)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (schneller, günstiger)' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (am günstigsten)' },
];

const VISUAL = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'from', 'sender', 'text', 'emojis', 'value'],
  properties: {
    type: { type: 'string', enum: ['scene', 'chat', 'stat', 'reddit', 'none'] },
    from: { type: 'string', enum: ['me', 'them'] },
    sender: { type: 'string' },
    text: { type: 'string' },
    emojis: { type: 'string' },
    value: { type: 'string' },
  },
};

const PART = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'hook_text', 'lines', 'cliffhanger', 'take', 'verdict', 'cta', 'cta_on_screen', 'options', 'loop'],
  properties: {
    hook: { type: 'string' },
    hook_text: { type: 'string' },
    lines: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['say', 'visual'], properties: { say: { type: 'string' }, visual: VISUAL } },
    },
    cliffhanger: { type: 'string' },
    take: { type: 'string' },
    verdict: { type: 'string' },
    cta: { type: 'string' },
    cta_on_screen: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    loop: { type: 'string' },
  },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['parts', 'yt_title', 'hashtags'],
  properties: {
    parts: { type: 'array', items: PART },
    yt_title: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `You write scripts for a faceless YouTube Shorts channel that turns Reddit posts into 25–45 second videos.
The channel is not a text-to-speech reading service: every video adds its own layer (a sharp hook, a tight retelling, and the narrator character's real opinion), so it is clearly original commentary on the post.

Return JSON that matches the schema. Rules:

LENGTH
- Each part is spoken aloud. Keep each part's total spoken words (hook + lines + cliffhanger + take + cta + loop) at or under the word budget you are given. Shorter is fine; longer is not.
- Prefer a single part. Only split into 2–3 parts when the story genuinely cannot be told well inside the budget. Each non-final part ends on a cliffhanger.

HOOK (first 1–2 seconds decide everything)
- "hook" is the first spoken sentence: the most shocking, intriguing or absurd moment of the story, max 20 words. Never open with setup like "So my boyfriend and I have been together for three years".
- "hook_text" is the big on-screen text shown from the very first frame: max 7 words, a teaser that does not simply repeat the hook.
- For part 2 and later, the hook recaps the previous cliffhanger in one sentence, starting with "Part N." (or "Teil N." in German).

STORY
- "lines": 4–10 short lines that retell the post in first person as the original poster. Tighten hard: cut backstory, keep conflict, escalation and payoff. One or two short sentences per line. Do not invent events that are not in the post.
- Each line gets a visual:
  - "chat": for dialogue, texts or arguments. "text" is the message (max 120 characters), "from" is "me" (the poster) or "them", "sender" is a short role name like "Boss", "Mom", "Ex".
  - "stat": for numbers or money. "value" like "$4,000" or "3 years", "text" a 2–5 word label.
  - "scene": everything else. "emojis" 1–3 emojis that illustrate the moment, "text" a 2–5 word key phrase.
  - "reddit": only allowed for the very first line of part 1 (shows the original post card).
  Fill fields that do not apply to the chosen type with an empty string ("from" with "them").

OWN LAYER
- "take" (final part only): 1–3 sentences in the narrator character's voice with a real, specific opinion or analysis that refers to details of this story. No fence-sitting unless the character is neutral.
- "verdict": max 3 words for an on-screen stamp, e.g. "NTA", "BOTH WRONG", "TEXTBOOK GASLIGHTING".

ENGAGEMENT AND LOOP
- "cta": one direct question to the viewer that is easy to answer in a comment (a binary choice works best), ending with an invitation to comment.
- "cta_on_screen": max 4 words. "options": exactly two very short answer labels.
- "loop" (final part only): a short unfinished lead-in that ends without punctuation and flows grammatically straight into the hook sentence, so the video can loop seamlessly. Example: hook "My boss gave my promotion to the intern." → loop "And all of that, just because".
- Non-final parts: "cliffhanger" teases the next part; "cta" asks viewers to guess what happens next; "take", "verdict" and "loop" are empty strings. Final part: "cliffhanger" is an empty string.

SAFETY AND QUALITY
- Advertiser-friendly wording: no slurs, no graphic violence or sex; use common Shorts euphemisms ("unalive", "spicy") where needed and soften swearing ("freaking").
- Use roles instead of real names; never include usernames, addresses or other identifying details.
- "yt_title": max 70 characters, curiosity-driven but honest. "hashtags": 3–5 tags without "#".`;

function client(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function explain(error) {
  if (error instanceof Anthropic.AuthenticationError) return 'Claude: API-Key ungültig.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'Claude: Dieser API-Key hat keinen Zugriff auf das Modell.';
  if (error instanceof Anthropic.RateLimitError) return 'Claude: Rate-Limit erreicht – kurz warten und erneut versuchen.';
  if (error instanceof Anthropic.BadRequestError) return 'Claude: Anfrage abgelehnt – ' + error.message;
  if (error instanceof Anthropic.APIConnectionError) return 'Claude: Keine Verbindung zu api.anthropic.com.';
  if (error instanceof Anthropic.APIError) return `Claude: Fehler ${error.status} – ${error.message}`;
  return 'Claude: ' + (error?.message || String(error));
}

/**
 * opts: { apiKey, model, nicheId, personaId, personaName, lang ('en'|'de'), targetSec, speed, allowParts, censor }
 * Rückgabe: Array von Plänen (ein Plan pro Teil).
 */
export async function claudeScript(post, opts) {
  const niche = getNiche(opts.nicheId);
  const persona = getPersona(opts.personaId);
  const lang = opts.lang === 'de' ? 'de' : 'en';
  const budget = Math.round(opts.targetSec * WORDS_PER_SECOND * (opts.speed || 1));
  const body = cleanText(post.body, { censor: false, stripEdits: true });
  const brief = [
    `Channel niche: ${niche.name} (series name "${niche.series[lang]}").`,
    `Narrator character: ${opts.personaName || persona.name}. Voice and attitude: ${persona.style}`,
    `Write everything in ${lang === 'de' ? 'German (natural spoken German, translate the story)' : 'English'}.`,
    `Target length per part: about ${opts.targetSec} seconds, so at most ${budget} spoken words per part.`,
    opts.allowParts ? 'Splitting into parts is allowed if really needed.' : 'Do not split: produce exactly one part.',
    `A good closing question for this niche would be similar to: "${niche.cta[lang]}" with answers ${JSON.stringify(niche.options[lang])}. Adapt it to the story.`,
    '',
    `Subreddit: r/${post.subreddit || 'unknown'}`,
    `Post title: ${post.title}`,
    'Post text:',
    body,
  ].join('\n');

  const fallbackCapable = opts.model !== 'claude-haiku-5-5';
  let response;
  try {
    response = await client(opts.apiKey).beta.messages.create({
      model: opts.model || 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: brief }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      // Falls ein Sicherheitsfilter ablehnt, übernimmt serverseitig automatisch ein passendes Ersatzmodell.
      ...(fallbackCapable ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    });
  } catch (e) {
    throw new Error(explain(e));
  }
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude hat diese Story abgelehnt' + (response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : '.') + ' Nimm eine andere Story oder den eingebauten Skript-Autor.');
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude: Antwort zu lang abgeschnitten – bitte erneut versuchen.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Claude hat kein gültiges JSON geliefert – bitte erneut versuchen.');
  }
  const parts = (data.parts || []).filter((p) => p.lines?.length);
  if (!parts.length) throw new Error('Claude hat kein verwertbares Skript geliefert.');
  const safe = (s) => cleanText(s || '', { censor: opts.censor, stripEdits: false });
  return parts.map((p, i) =>
    normalizePlan({
      lang,
      nicheId: niche.id,
      personaId: persona.id,
      hook: safe(p.hook),
      hookText: p.hook_text,
      lines: p.lines.map((l, li) => ({
        say: safe(l.say),
        visual: { ...l.visual, type: l.visual.type === 'reddit' && !(i === 0 && li === 0) ? 'scene' : l.visual.type },
      })),
      cliffhanger: i < parts.length - 1 ? safe(p.cliffhanger) : '',
      take: i === parts.length - 1 ? safe(p.take) : '',
      verdict: i === parts.length - 1 ? p.verdict : '',
      cta: safe(p.cta),
      ctaOnScreen: p.cta_on_screen,
      options: p.options,
      // Kein Satzzeichen am Loop-Ende, damit er in den Hook übergeht
      loop: i === parts.length - 1 ? safe(p.loop).replace(/[.!?…]+$/, '') : '',
      part: { index: i + 1, total: parts.length },
      ytTitle: data.yt_title,
      hashtags: data.hashtags,
      generator: 'claude',
    })
  );
}
