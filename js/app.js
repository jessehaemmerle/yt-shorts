import { PRESET_SUBREDDITS, fetchSubreddit, fetchPostByUrl } from './reddit.js';
import { cleanText, wordCount, estimateSeconds, formatDuration, formatCount, slugify, youtubeMetadata } from './text.js';
import { MODELS, listVoices, getSubscription, synthesize } from './tts.js';
import { buildChunks } from './captions.js';
import { renderVideo, checkSupport, WIDTH, HEIGHT } from './render.js';
import { drawVideoFrame } from './draw.js';
import { BUILTIN_BACKGROUNDS, createBackground } from './backgrounds.js';
import { OPEN_GAMEPLAY, creditLine, downloadClip } from './catalog.js';
import { addMedia, listMedia, deleteMedia, getMedia } from './db.js';
import { NICHES, PERSONAS, getNiche, getPersona, matchesNiche, nextEpisode } from './niches.js';
import { autoScript } from './scriptgen.js';
import { claudeScript, CLAUDE_MODELS } from './llm.js';
import { normalizePlan, narrationText, buildTimeline } from './plan.js';
import { composeFrame, prepareBeats } from './compose.js';
import { renderPlanEditor } from './planeditor.js';
import { Input, BlobSource, ALL_FORMATS, CanvasSink } from '../vendor/mediabunny-1.59.1.min.mjs';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'brs-settings';
const USED_KEY = 'brs-used';
const SUBS_KEY = 'brs-subs';

const state = {
  settings: {},
  subs: { list: [...PRESET_SUBREDDITS], selected: new Set(['confessions', 'TrueOffMyChest', 'AmItheAsshole', 'tifu']) },
  stories: [],
  voices: [],
  current: null, // { id, subreddit, author, title, score, comments, url, body }
  used: new Set(),
  busy: false,
  abort: null,
  progressLabel: '',
  gameplay: [],
  music: [],
  previewFrames: new Map(),
  previewItem: null,
  downloads: new Map(),
  script: null, // { parts: Plan[], sourceKey }
  ui: { partIdx: 0 },
};

/* ---------------- Persistenz ---------------- */

function loadJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privater Modus o.ä. */
  }
}

function readSetting(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range' || el.type === 'number') return Number(el.value);
  return el.value;
}

function initSettings() {
  state.settings = loadJson(SETTINGS_KEY, {});
  for (const el of document.querySelectorAll('[data-setting]')) {
    const key = el.dataset.setting;
    if (key in state.settings && el.tagName !== 'SELECT') {
      if (el.type === 'checkbox') el.checked = !!state.settings[key];
      else el.value = state.settings[key];
    }
    if (!(key in state.settings)) state.settings[key] = readSetting(el);
    el.addEventListener('input', () => {
      state.settings[key] = readSetting(el);
      saveJson(SETTINGS_KEY, state.settings);
      syncOutputs();
      if (['minSec', 'maxSec', 'hideUsed', 'allowNsfw'].includes(key)) renderStoryList();
      if (key === 'speed') updateStats();
      if (key === 'gameplayMode') loadPreviewFrame();
      if (key === 'niche') applyNiche();
      if (key === 'persona') applyPersona();
      if (key === 'voiceId') rememberPersonaVoice();
      if (key === 'targetSec' || key === 'speed') renderEditor();
    });
  }
  const subs = loadJson(SUBS_KEY, null);
  if (subs?.list) state.subs = { list: subs.list, selected: new Set(subs.selected) };
  state.used = new Set(loadJson(USED_KEY, []));
}

// Selects erst setzen, wenn ihre Optionen existieren.
function restoreSelect(el) {
  const v = state.settings[el.dataset.setting];
  if (v != null && [...el.options].some((o) => o.value === String(v))) el.value = String(v);
  state.settings[el.dataset.setting] = el.value;
}

function syncOutputs() {
  for (const id of ['speed', 'stability', 'musicVolume', 'captionSize', 'captionPos', 'dim', 'targetSec']) {
    const out = $(id + 'Out');
    if (out) out.textContent = id === 'targetSec' ? $(id).value : Number($(id).value).toFixed(id === 'captionSize' ? 3 : 2);
  }
}

function saveSubs() {
  saveJson(SUBS_KEY, { list: state.subs.list, selected: [...state.subs.selected] });
}

function markUsed(id) {
  if (!id) return;
  state.used.add(id);
  saveJson(USED_KEY, [...state.used].slice(-2000));
}

/* ---------------- UI-Helfer ---------------- */

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function toast(msg) {
  const t = el('div', { className: 'toast', textContent: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function showError(err) {
  const box = $('error');
  if (!err) {
    box.hidden = true;
    return;
  }
  console.error(err);
  box.textContent = err.message || String(err);
  box.hidden = false;
}

function setProgress(p, text) {
  $('progressWrap').hidden = false;
  $('progressFill').style.width = `${Math.round(p * 100)}%`;
  if (text) $('progressText').textContent = state.progressLabel + text;
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ['renderBtn', 'autoBtn', 'loadStoriesBtn']) $(id).disabled = busy;
  $('cancelBtn').disabled = !busy;
}

const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(1) + ' MB');

/* ---------------- ElevenLabs ---------------- */

async function connect({ quiet = false } = {}) {
  const key = $('apiKey').value.trim();
  if (!key) {
    if (!quiet) showError(new Error('Bitte zuerst einen ElevenLabs API-Key eintragen.'));
    return;
  }
  $('connectBtn').disabled = true;
  try {
    state.voices = await listVoices(key);
    const sel = $('voice');
    sel.innerHTML = '';
    for (const v of state.voices) {
      const tags = [v.labels.gender, v.labels.accent, v.labels.age].filter(Boolean).join(', ');
      sel.add(new Option(v.name + (tags ? ` (${tags})` : ''), v.id));
    }
    restoreSelect(sel);
    saveJson(SETTINGS_KEY, state.settings);
    try {
      const sub = await getSubscription(key);
      $('quota').textContent = `Verbunden ✓ · ${state.voices.length} Stimmen · Kontingent: ${formatCount(sub.used)} / ${formatCount(sub.limit)} Zeichen verbraucht (${sub.tier}).`;
    } catch {
      $('quota').textContent = `Verbunden ✓ · ${state.voices.length} Stimmen.`;
    }
    $('quota').classList.remove('err');
    showError(null);
  } catch (e) {
    $('quota').textContent = e.message;
    $('quota').classList.add('err');
    if (!quiet) showError(e);
  } finally {
    $('connectBtn').disabled = false;
  }
}

let previewAudio;
function previewVoice() {
  const v = state.voices.find((x) => x.id === $('voice').value);
  if (!v?.preview) return toast('Keine Stimmprobe verfügbar');
  previewAudio?.pause();
  previewAudio = new Audio(v.preview);
  previewAudio.play();
}

/* ---------------- Subreddits & Stories ---------------- */

function renderChips() {
  const box = $('subChips');
  box.innerHTML = '';
  for (const sub of state.subs.list) {
    const chip = el('span', { className: 'chip' + (state.subs.selected.has(sub) ? ' on' : ''), textContent: 'r/' + sub });
    chip.onclick = () => {
      if (state.subs.selected.has(sub)) state.subs.selected.delete(sub);
      else state.subs.selected.add(sub);
      saveSubs();
      renderChips();
    };
    if (!PRESET_SUBREDDITS.includes(sub)) {
      const x = el('span', { className: 'x', textContent: '×', title: 'Entfernen' });
      x.onclick = (e) => {
        e.stopPropagation();
        state.subs.list = state.subs.list.filter((s) => s !== sub);
        state.subs.selected.delete(sub);
        saveSubs();
        renderChips();
      };
      chip.appendChild(x);
    }
    box.appendChild(chip);
  }
}

function addSub() {
  const name = $('customSub').value.trim().replace(/^\/?r\//i, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!name) return;
  if (!state.subs.list.some((s) => s.toLowerCase() === name.toLowerCase())) state.subs.list.push(name);
  state.subs.selected.add(name);
  $('customSub').value = '';
  saveSubs();
  renderChips();
}

function storySeconds(p) {
  const text = cleanText(p.title + '. ' + p.body, { censor: false, stripEdits: state.settings.stripEdits });
  return estimateSeconds(wordCount(text), state.settings.speed || 1);
}

async function loadStories() {
  const subs = [...state.subs.selected];
  const status = $('storyStatus');
  status.classList.remove('err');
  if (!subs.length) {
    status.textContent = 'Bitte mindestens ein Subreddit auswählen.';
    return [];
  }
  $('loadStoriesBtn').disabled = true;
  status.textContent = `Lade ${subs.length} Subreddit(s)…`;
  const opts = { sort: $('sort').value, time: $('time').value, limit: 75, proxy: $('proxy').value.trim(), source: $('redditSource').value };
  // Höchstens 3 Subreddits gleichzeitig, um die Quellen nicht mit Anfragen zu fluten.
  const results = new Array(subs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, subs.length) }, async () => {
      while (next < subs.length) {
        const i = next++;
        try {
          results[i] = { status: 'fulfilled', value: await fetchSubreddit(subs[i], opts) };
        } catch (reason) {
          results[i] = { status: 'rejected', reason };
        }
        status.textContent = `Lade Subreddits… ${results.filter(Boolean).length}/${subs.length}`;
      }
    })
  );
  const seen = new Set();
  const stories = [];
  const errors = [];
  let viaArchive = 0;
  results.forEach((r, i) => {
    if (r.status === 'rejected') errors.push(`r/${subs[i]}: ${r.reason.message}`);
    else {
      if (r.value.via === 'archive') viaArchive++;
      for (const p of r.value.posts) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        p.seconds = storySeconds(p);
        stories.push(p);
      }
    }
  });
  stories.sort((a, b) => b.score - a.score);
  state.stories = stories;
  $('loadStoriesBtn').disabled = state.busy;
  if (errors.length && !stories.length) {
    status.textContent = errors[0];
    status.classList.add('err');
  } else {
    status.textContent =
      `${stories.length} Stories geladen` +
      (viaArchive
        ? opts.source === 'archive'
          ? ' (aus dem Arctic-Shift-Archiv)'
          : ` (${viaArchive === results.length - errors.length ? '' : viaArchive + '× '}über das Arctic-Shift-Archiv, da Reddit direkt nicht erreichbar war)`
        : '') +
      (errors.length ? ` · ${errors.length} Subreddit(s) fehlgeschlagen: ${errors.join(' | ')}` : '') +
      '. Klicke eine Story an, um sie zu verwenden.';
  }
  renderStoryList();
  return stories;
}

function fitsLength(p) {
  return p.seconds >= (state.settings.minSec || 0) && p.seconds <= (state.settings.maxSec || 9999);
}

function visibleStories() {
  const niche = getNiche($('niche').value);
  return state.stories.filter(
    (p) => (state.settings.allowNsfw || !p.over18) && (!state.settings.hideUsed || !state.used.has(p.id)) && matchesNiche(niche, p)
  );
}

function badge(text, cls = '') {
  return el('span', { className: 'badge ' + cls, textContent: text });
}

function renderStoryList() {
  const list = $('storyList');
  list.innerHTML = '';
  for (const p of visibleStories()) {
    const meta = el(
      'div',
      { className: 'meta' },
      el('span', { textContent: 'r/' + p.subreddit }),
      el('span', { textContent: '▲ ' + formatCount(p.score) }),
      el('span', { textContent: '💬 ' + formatCount(p.comments) }),
      el('span', { textContent: '⏱ ~' + formatDuration(p.seconds) }),
      fitsLength(p) ? badge('passt', 'fit') : null,
      p.over18 ? badge('NSFW', 'nsfw') : null,
      state.used.has(p.id) ? badge('verwendet') : null
    );
    const li = el('li', {}, el('div', { className: 't', textContent: p.title }), meta);
    if (state.current?.id === p.id) li.classList.add('selected');
    if (state.used.has(p.id)) li.classList.add('used');
    li.onclick = () => selectStory(p);
    list.appendChild(li);
  }
}

function cleanOpts() {
  return { censor: $('censor').checked, stripEdits: $('stripEdits').checked };
}

function selectStory(p) {
  state.current = { ...p };
  $('postSub').value = p.subreddit || '';
  $('postAuthor').value = p.author || '';
  $('postTitle').value = cleanText(p.title, cleanOpts());
  $('postBody').value = cleanText(p.body, cleanOpts());
  state.script = null;
  state.ui.partIdx = 0;
  renderEditor();
  updateStats();
  renderStoryList();
}

function reclean() {
  if (!state.current) return;
  $('postTitle').value = cleanText(state.current.title, cleanOpts());
  $('postBody').value = cleanText(state.current.body, cleanOpts());
  updateStats();
}

async function loadFromUrl() {
  try {
    const p = await fetchPostByUrl($('postUrl').value, { proxy: $('proxy').value.trim(), source: $('redditSource').value });
    p.seconds = storySeconds(p);
    selectStory(p);
    toast('Post geladen');
  } catch (e) {
    showError(e);
  }
}

function blankStory() {
  state.current = { id: 'custom-' + Date.now(), subreddit: '', author: '', title: '', body: '', score: 0, comments: 0, url: '' };
  for (const id of ['postSub', 'postAuthor', 'postTitle', 'postBody']) $(id).value = '';
  state.script = null;
  renderEditor();
  $('sourceBox').open = true;
  $('postTitle').focus();
  updateStats();
  renderStoryList();
}

/** Der aktuelle Quell-Post aus den Feldern (der Nutzer kann Titel/Text frei ändern). */
function sourcePost() {
  const title = $('postTitle').value.trim();
  const body = $('postBody').value.trim();
  if (!title && !body) throw new Error('Keine Story ausgewählt – wähle in Schritt 2 eine Story aus oder füge unter „Original-Post“ eigenen Text ein.');
  const score = state.current?.score || Math.round(1000 + Math.random() * 20000);
  return {
    id: state.current?.id || 'custom-' + Date.now(),
    title: title || body.slice(0, 80),
    body: body || title,
    subreddit: $('postSub').value.trim().replace(/^r\//i, ''),
    author: $('postAuthor').value.trim().replace(/^u\//i, ''),
    score,
    comments: state.current?.comments || Math.round(score / 12),
    url: state.current?.url || '',
  };
}

function scriptOptions() {
  return {
    nicheId: $('niche').value,
    personaId: $('persona').value,
    personaName: $('personaName').value.trim(),
    lang: $('lang').value,
    targetSec: Number($('targetSec').value),
    speed: Number($('speed').value),
    allowParts: $('allowParts').checked,
    withTake: $('withTake').checked,
    withCta: $('withCta').checked,
    withLoop: $('withLoop').checked,
    censor: $('censor').checked,
    stripEdits: $('stripEdits').checked,
    apiKey: $('claudeKey').value.trim(),
    model: $('claudeModel').value,
  };
}

const sourceKey = (post, o) => JSON.stringify([post.title, post.body.length, o.nicheId, o.personaId, o.lang, o.targetSec, o.allowParts, o.withTake, o.withCta, o.withLoop]);

/** Schreibt das Skript: mit Claude, falls ein Key hinterlegt ist, sonst mit dem eingebauten Autor. */
async function writeScript() {
  const post = sourcePost();
  const o = scriptOptions();
  $('writeStatus').textContent = o.apiKey ? 'Claude schreibt das Skript…' : 'Skript wird erstellt…';
  let parts;
  if (o.apiKey) {
    parts = await claudeScript(post, o);
    // Abgeschaltete Bausteine respektieren
    for (const p of parts) {
      if (!o.withTake) (p.take = ''), (p.verdict = '');
      if (!o.withCta) p.cta = '';
      if (!o.withLoop) p.loop = '';
    }
  } else {
    parts = autoScript(post, o);
  }
  state.script = { parts, sourceKey: sourceKey(post, o), post };
  state.ui.partIdx = 0;
  $('writeStatus').textContent =
    (o.apiKey ? '✍️ Von Claude geschrieben' : '⚙️ Automatisch erstellt (mit Claude-Key besser)') +
    (parts.length > 1 ? ` · ${parts.length} Teile` : '') +
    ' – du kannst alles unten anpassen.';
  renderEditor();
  return state.script;
}

async function ensureScript() {
  const post = sourcePost();
  if (state.script && state.script.sourceKey === sourceKey(post, scriptOptions())) return state.script;
  return writeScript();
}

function renderEditor() {
  renderPlanEditor($('planEditor'), state.script, state.ui, { speed: () => Number($('speed').value), onChange: () => {} });
}

/* ---------------- Nische & Erzähler-Figur ---------------- */

function applyNiche({ initial = false } = {}) {
  const niche = getNiche($('niche').value);
  $('nicheHint').textContent = niche.subs
    ? `Serie „${niche.series.de}“ · Subreddits: ${niche.subs.map((s) => 'r/' + s).join(', ')}${niche.filterSubs.length ? ' (breite Subs werden nach Thema gefiltert)' : ''}`
    : 'Wähle unten frei, aus welchen Subreddits Stories kommen.';
  if (niche.subs && !initial) {
    for (const sub of niche.subs) if (!state.subs.list.includes(sub)) state.subs.list.push(sub);
    state.subs.selected = new Set(niche.subs);
    saveSubs();
  }
  renderChips();
  renderStoryList();
}

function applyPersona({ initial = false } = {}) {
  const persona = getPersona($('persona').value);
  if (!initial) {
    $('personaName').value = persona.name;
    state.settings.personaName = persona.name;
    // Ausdrucksstärke der Stimme passend zur Figur
    $('stability').value = persona.voice.stability;
    state.settings.stability = persona.voice.stability;
    const saved = state.settings.personaVoices?.[persona.id];
    if (saved && [...$('voice').options].some((o) => o.value === saved)) {
      $('voice').value = saved;
      state.settings.voiceId = saved;
    }
    saveJson(SETTINGS_KEY, state.settings);
    syncOutputs();
  }
}

function rememberPersonaVoice() {
  state.settings.personaVoices = { ...(state.settings.personaVoices || {}), [$('persona').value]: $('voice').value };
  saveJson(SETTINGS_KEY, state.settings);
}

function updateStats() {
  const text = ($('postTitle').value + ' ' + $('postBody').value).trim();
  const words = wordCount(text);
  const sec = estimateSeconds(words, state.settings.speed || 1);
  const box = $('scriptStats');
  box.replaceChildren(
    el('b', { textContent: words }),
    ' Wörter · ',
    el('b', { textContent: text.length }),
    ' Zeichen (≈ ElevenLabs-Credits) · geschätzte Länge ',
    el('b', { textContent: formatDuration(sec) })
  );
  if (sec > 180) box.append(' · ', el('span', { className: 'warn', textContent: 'Über 3 Minuten – zu lang für Shorts! Text kürzen.' }));
  else if (sec > 60) box.append(' · Shorts erlauben bis zu 3 Minuten.');
}

/* ---------------- Medienbibliothek ---------------- */

async function refreshMedia() {
  state.gameplay = await listMedia('gameplay');
  state.music = await listMedia('music');

  const gsel = $('gameplayMode');
  gsel.innerHTML = '';
  const groupRandom = el('optgroup', { label: 'Zufall' });
  groupRandom.append(new Option('🎲 Zufälliger Clip aus Bibliothek', 'random'), new Option('🎲 Zufällige eingebaute Animation', 'random-builtin'));
  const groupBuiltin = el('optgroup', { label: 'Eingebaute Animationen' });
  for (const b of BUILTIN_BACKGROUNDS) groupBuiltin.append(new Option('✨ ' + b.name, 'bg:' + b.id));
  gsel.append(groupRandom, groupBuiltin);
  if (state.gameplay.length) {
    const groupLib = el('optgroup', { label: 'Deine Bibliothek' });
    for (const m of state.gameplay) groupLib.append(new Option('🎮 ' + m.name, m.id));
    gsel.append(groupLib);
  }
  if (state.settings.gameplayMode === 'procedural') state.settings.gameplayMode = 'bg:neon';
  restoreSelect(gsel);

  const msel = $('musicMode');
  msel.innerHTML = '';
  msel.add(new Option('Keine Musik', 'none'));
  msel.add(new Option('🎲 Zufällig aus Bibliothek', 'random'));
  for (const m of state.music) msel.add(new Option('🎵 ' + m.name, m.id));
  restoreSelect(msel);
  saveJson(SETTINGS_KEY, state.settings);

  renderMediaList($('gameplayList'), state.gameplay);
  renderMediaList($('musicList'), state.music);
  renderCatalog();
  loadPreviewFrame();
}

function renderMediaList(ul, items) {
  ul.innerHTML = '';
  for (const m of items) {
    const del = el('button', { className: 'btn ghost small', textContent: 'Löschen' });
    del.onclick = async () => {
      await deleteMedia(m.id);
      state.previewFrames.delete(m.id);
      refreshMedia();
    };
    ul.appendChild(
      el(
        'li',
        {},
        el('span', { className: 'name', textContent: m.name, title: m.credit || m.name }),
        m.license ? el('span', { className: 'lic', textContent: m.license }) : null,
        el('span', { className: 'size', textContent: fmtSize(m.size) }),
        del
      )
    );
  }
}

function renderCatalog() {
  const ul = $('catalogList');
  ul.innerHTML = '';
  for (const item of OPEN_GAMEPLAY) {
    const have = state.gameplay.some((m) => m.catalogId === item.id);
    const btn = el('button', { className: 'btn small ' + (have ? 'ghost' : 'primary') });
    const running = state.downloads.get(item.id);
    btn.textContent = have ? '✓ In Bibliothek' : running != null ? `${Math.round(running * 100)} %` : `⬇ Laden (${fmtSize(item.size)})`;
    btn.disabled = have || running != null;
    btn.onclick = () => downloadCatalogItem(item, btn);
    const desc = el(
      'div',
      { className: 'desc' },
      el('b', { textContent: item.title }),
      el('span', { textContent: `${item.genre} · ${formatDuration(item.duration)} · ${item.license} · ${item.author}` })
    );
    const link = el('a', { href: item.page, target: '_blank', rel: 'noopener', textContent: 'Quelle', className: 'lic' });
    ul.appendChild(el('li', {}, desc, link, btn));
  }
}

async function downloadCatalogItem(item, btn) {
  state.downloads.set(item.id, 0);
  btn.disabled = true;
  try {
    const file = await downloadClip(item, (p) => {
      state.downloads.set(item.id, p);
      btn.textContent = `${Math.round(p * 100)} %`;
    });
    await addMedia('gameplay', file, { catalogId: item.id, credit: creditLine(item), license: item.license });
    toast(`${item.game} zur Bibliothek hinzugefügt`);
  } catch (e) {
    showError(new Error(`„${item.title}“ konnte nicht geladen werden: ${e.message}`));
  } finally {
    state.downloads.delete(item.id);
    await refreshMedia();
  }
}

async function addFiles(kind, files) {
  try {
    for (const f of files) await addMedia(kind, f);
    toast(`${files.length} Datei(en) gespeichert`);
  } catch (e) {
    showError(new Error('Speichern fehlgeschlagen (Browser-Speicher voll?): ' + e.message));
  }
  await refreshMedia();
}

const randomOf = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

const randomBuiltin = () => randomOf(BUILTIN_BACKGROUNDS).id;

/** Liefert { gameplay: Bibliotheks-Eintrag | null, backgroundId } für das nächste Video. */
async function pickBackground() {
  const mode = $('gameplayMode').value;
  if (mode.startsWith('bg:')) return { gameplay: null, backgroundId: mode.slice(3) };
  if (mode === 'random-builtin' || (mode === 'random' && !state.gameplay.length)) return { gameplay: null, backgroundId: randomBuiltin() };
  if (mode === 'random') return { gameplay: randomOf(state.gameplay), backgroundId: null };
  const gameplay = await getMedia(mode);
  return gameplay ? { gameplay, backgroundId: null } : { gameplay: null, backgroundId: randomBuiltin() };
}

async function pickMusic() {
  const mode = $('musicMode').value;
  if (mode === 'none') return null;
  if (mode === 'random') return randomOf(state.music);
  return getMedia(mode);
}

/* ---------------- Live-Vorschau ---------------- */

async function loadPreviewFrame() {
  const mode = $('gameplayMode').value;
  const item = mode === 'random' ? state.gameplay[0] : state.gameplay.find((m) => m.id === mode);
  state.previewItem = item?.id || null;
  if (!item || state.previewFrames.has(item.id)) return;
  try {
    const input = new Input({ source: new BlobSource(item.blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const sink = new CanvasSink(track, { width: WIDTH });
    const first = await track.getFirstTimestamp();
    const dur = await track.computeDuration();
    const frame = await sink.getCanvas(first + Math.min(5, (dur - first) / 2));
    if (frame) {
      const c = el('canvas', { width: frame.canvas.width, height: frame.canvas.height });
      c.getContext('2d').drawImage(frame.canvas, 0, 0);
      state.previewFrames.set(item.id, c);
    }
    input.dispose?.();
  } catch (e) {
    console.warn('Vorschau-Frame fehlgeschlagen', e);
  }
}

function styleFromSettings() {
  const theme = $('cardTheme').value;
  return {
    font: `"${$('font').value}"`,
    size: Number($('captionSize').value),
    uppercase: $('uppercase').checked,
    animate: $('animate').checked,
    highlight: $('highlight').checked,
    color: $('textColor').value,
    highlightColor: $('highlightColor').value,
    position: Number($('captionPos').value),
    showCard: theme !== 'off',
    theme,
    watermark: $('watermark').value.trim(),
    dim: Number($('dim').value),
    progressBar: $('progressBar').checked,
    musicVolume: Number($('musicVolume').value),
    fps: $('fps60').checked ? 60 : 30,
    showPersona: $('showPersona').checked,
  };
}

const DEMO_POST = {
  id: 'demo',
  subreddit: 'MaliciousCompliance',
  author: 'throwaway_2931',
  title: 'My boss said "do exactly what the manual says" so I did',
  body: 'For context I have worked at this warehouse for 6 years. My new manager decided I was too slow and wrote me up. He told me, "From now on you follow the manual word for word." So I did. The manual says every box needs two signatures, so I waited for him every single time. We shipped 40 orders instead of 400 that day. Then the regional director called him at 4pm asking why $90,000 of orders were late. He came to my desk and said "Just do it your way." I said "Can I get that in writing?" He actually wrote it.',
  score: 18400,
  comments: 1210,
};

// Künstliche Zeitstempel (0,3 s pro Wort), damit die Vorschau dieselbe Zeitachse wie der Export nutzt.
function fakeChars(text, perWord = 0.3) {
  const chars = [];
  let t = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    for (const c of w) chars.push({ c, start: t, end: t + perWord });
    chars.push({ c: ' ', start: t + perWord, end: t + perWord });
    t += perWord;
  }
  return { chars, duration: t + 0.6 };
}

function buildScene(plan, timeline, post, extra = {}) {
  const niche = getNiche(plan.nicheId);
  const persona = getPersona(plan.personaId);
  const style = styleFromSettings();
  const ep = extra.episode ?? nextEpisode(niche.id);
  if (!style.showCard) for (const l of plan.lines) if (l.visual.type === 'reddit') l.visual = { ...l.visual, type: 'scene', emojis: '📄', text: post.title.split(/\s+/).slice(0, 5).join(' ') };
  return {
    plan,
    timeline: prepareBeats(plan, timeline),
    chunks: buildChunks(timeline.words, { maxWords: Number($('maxWords').value) }),
    post,
    style,
    persona,
    personaName: $('personaName').value.trim() || persona.name,
    niche,
    mode: $('visualMode').value,
    tag: `${niche.series[plan.lang] || niche.series.en} #${ep}`.toUpperCase(),
  };
}

function startPreviewLoop() {
  const ctx = $('canvas').getContext('2d', { alpha: false });
  let last = 0;
  let key = '';
  let scene = null;
  let demoPlan = null;
  const previewBgs = new Map();
  const previewBg = (id) => {
    if (!previewBgs.has(id)) previewBgs.set(id, createBackground(id, 3));
    return previewBgs.get(id);
  };
  const t0 = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (state.busy || now - last < 33) return;
    last = now;
    const t = Math.max(0, (now - t0) / 1000);
    const o = scriptOptions();
    let plan = state.script?.parts[state.ui.partIdx];
    let post = state.script?.post;
    if (!plan) {
      const dk = JSON.stringify([o.nicheId, o.personaId, o.withTake, o.withCta, o.withLoop]);
      if (!demoPlan || demoPlan.key !== dk) demoPlan = { key: dk, plan: autoScript(DEMO_POST, { ...o, allowParts: false, targetSec: 60 })[0] };
      plan = demoPlan.plan;
      post = DEMO_POST;
    }
    const np = normalizePlan(plan);
    const k = JSON.stringify([np, $('visualMode').value, $('maxWords').value, $('cardTheme').value, $('personaName').value, $('showPersona').checked]);
    if (k !== key) {
      key = k;
      const { chars, duration } = fakeChars(narrationText(np));
      scene = { ...buildScene(np, buildTimeline(np, chars, duration), post, { episode: nextEpisode(np.nicheId) }), duration };
    }
    scene.style = styleFromSettings();
    const mode = $('gameplayMode').value;
    scene.drawGameplay = (c, w, h, tt) => {
      const img = state.previewItem && state.previewFrames.get(state.previewItem);
      if (img) drawVideoFrame(c, w, h, img, $('gameplayFit').value);
      else {
        const id = mode.startsWith('bg:') ? mode.slice(3) : BUILTIN_BACKGROUNDS[Math.floor(tt / 6) % BUILTIN_BACKGROUNDS.length].id;
        previewBg(id).draw(c, w, h, tt);
      }
    };
    composeFrame(ctx, WIDTH, HEIGHT, t % scene.duration, scene, scene);
  };
  requestAnimationFrame(frame);
}

/* ---------------- Produktion ---------------- */

async function produceCurrent(signal, partIdx = state.ui.partIdx) {
  setProgress(0, 'Skript wird vorbereitet…');
  const script = await ensureScript();
  const plan = normalizePlan(script.parts[partIdx] || script.parts[0]);
  const post = script.post;
  const style = styleFromSettings();
  await Promise.all([document.fonts.load(`900 100px ${style.font}`), document.fonts.load('900 50px "Montserrat"')]).catch(() => {});
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');

  setProgress(0.02, 'Voice-over wird bei ElevenLabs erzeugt…');
  const persona = getPersona(plan.personaId);
  const tts = await synthesize(
    {
      apiKey: $('apiKey').value.trim(),
      voiceId: $('voice').value,
      modelId: $('model').value,
      text: narrationText(plan),
      speed: Number($('speed').value),
      stability: Number($('stability').value),
      style: persona.voice.style,
    },
    (p, msg) => setProgress(0.02 + p * 0.13, msg)
  );
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  if (tts.audioBuffer.duration > 180) toast('Achtung: länger als 3 Minuten – YouTube behandelt das Video nicht als Short.');

  const tail = plan.loop ? 0.25 : 0.8;
  const timeline = buildTimeline(plan, tts.chars, tts.audioBuffer.duration + tail);
  const episode = nextEpisode(plan.nicheId);
  const scene = buildScene(plan, timeline, post, { episode });
  const { gameplay, backgroundId } = await pickBackground();
  const music = await pickMusic();
  const result = await renderVideo(
    {
      narration: tts.audioBuffer,
      scene,
      tail,
      gameplayBlob: gameplay?.blob,
      gameplayFit: $('gameplayFit').value,
      backgroundId,
      musicBlob: music?.blob,
      canvas: $('canvas'),
    },
    { onProgress: (p, msg) => setProgress(0.15 + p * 0.85, msg), signal }
  );
  markUsed(post.id);
  nextEpisode(plan.nicheId, { commit: true });
  const usesGameplay = scene.mode !== 'story';
  const bgName =
    scene.mode === 'story' ? 'Story-Visuals' : gameplay?.name || BUILTIN_BACKGROUNDS.find((b) => b.id === backgroundId)?.name || 'Animation';
  addResult(post, result, bgName, usesGameplay && gameplay?.credit ? [gameplay.credit] : [], { plan, scene, episode });
  renderStoryList();
  return result;
}

function addResult(post, { blob, duration, codecs }, bgName, credits = [], ctx = {}) {
  const meta = youtubeMetadata(post, credits, ctx);
  const url = URL.createObjectURL(blob);
  const filename = `${slugify(meta.title.replace(/#shorts/i, ''))}.mp4`;

  const copyBtn = (label, field) => {
    const b = el('button', { className: 'btn ghost', textContent: label });
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(meta[field]);
        toast('Kopiert!');
      } catch {
        prompt('Zum Kopieren:', meta[field]);
      }
    };
    return b;
  };
  const btns = el(
    'div',
    { className: 'btns' },
    el('a', { className: 'btn primary', href: url, download: filename, textContent: '⬇ MP4' }),
    copyBtn('Titel kopieren', 'title'),
    copyBtn('Beschreibung', 'description')
  );
  const file = new File([blob], filename, { type: 'video/mp4' });
  if (navigator.canShare?.({ files: [file] })) {
    const share = el('button', { className: 'btn ghost', textContent: 'Teilen' });
    share.onclick = () => navigator.share({ files: [file], title: meta.title, text: meta.description }).catch(() => {});
    btns.append(share);
  }
  btns.append(el('a', { className: 'btn ghost', href: 'https://studio.youtube.com/', target: '_blank', rel: 'noopener', textContent: 'YouTube Studio ↗' }));

  const li = el(
    'li',
    {},
    el('video', { src: url, controls: true, playsInline: true, preload: 'metadata' }),
    el(
      'div',
      { className: 'info' },
      el('div', { className: 'rt', textContent: meta.title }),
      el('div', { className: 'rmeta', textContent: `${formatDuration(duration)} · ${fmtSize(blob.size)} · ${codecs} · ${bgName}` }),
      btns
    )
  );
  $('results').prepend(li);
  $('resultsTitle').hidden = false;
}

async function withJob(fn) {
  if (state.busy) return;
  showError(null);
  setBusy(true);
  state.abort = new AbortController();
  let wakeLock = null;
  try {
    wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);
    await fn(state.abort.signal);
  } catch (e) {
    if (e.name === 'AbortError') setProgress(0, 'Abgebrochen.');
    else {
      setProgress(0, 'Fehler.');
      showError(e);
    }
  } finally {
    state.progressLabel = '';
    wakeLock?.release?.().catch(() => {});
    setBusy(false);
  }
}

async function renderOne() {
  await withJob(async (signal) => {
    await produceCurrent(signal);
    setProgress(1, 'Fertig! 🎉 Unten herunterladen.');
  });
}

function pickNextStory() {
  const candidates = visibleStories().filter((p) => !state.used.has(p.id) && fitsLength(p));
  // Aus den 5 beliebtesten passenden Stories zufällig wählen, damit nicht immer dieselbe Reihenfolge entsteht.
  return randomOf(candidates.slice(0, 5));
}

async function autopilot() {
  const count = Math.max(1, Math.min(20, Number($('autoCount').value) || 1));
  await withJob(async (signal) => {
    if (!state.stories.length) {
      setProgress(0, 'Stories werden geladen…');
      await loadStories();
    }
    for (let i = 0; i < count; i++) {
      if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const story = pickNextStory();
      if (!story) {
        throw new Error(
          i === 0
            ? 'Keine passende, unbenutzte Story gefunden. Längenbereich vergrößern, andere Subreddits/Zeitraum wählen oder „Stories laden“ erneut klicken.'
            : `Nach ${i} Video(s) keine weiteren passenden Stories mehr gefunden.`
        );
      }
      selectStory(story);
      state.progressLabel = `Story ${i + 1}/${count}: `;
      const script = await ensureScript();
      const parts = $('renderAllParts').checked ? script.parts.length : 1;
      for (let p = 0; p < parts; p++) {
        if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
        state.progressLabel = `Story ${i + 1}/${count}` + (parts > 1 ? `, Teil ${p + 1}/${parts}` : '') + ': ';
        state.ui.partIdx = p;
        renderEditor();
        await produceCurrent(signal, p);
      }
    }
    state.progressLabel = '';
    setProgress(1, `Autopilot fertig: ${count} Story(s) verarbeitet 🎉`);
  });
}

/* ---------------- Start ---------------- */

async function init() {
  initSettings();

  const msel = $('model');
  for (const m of MODELS) msel.add(new Option(m.name, m.id));
  for (const n of NICHES) $('niche').add(new Option(n.name, n.id));
  for (const p of PERSONAS) $('persona').add(new Option(`${p.emoji} ${p.name}`, p.id));
  for (const m of CLAUDE_MODELS) $('claudeModel').add(new Option(m.name, m.id));
  for (const id of ['model', 'sort', 'time', 'font', 'maxWords', 'cardTheme', 'gameplayFit', 'redditSource', 'niche', 'persona', 'lang', 'claudeModel', 'visualMode'])
    restoreSelect($(id));
  if (!$('personaName').value.trim()) $('personaName').value = getPersona($('persona').value).name;
  saveJson(SETTINGS_KEY, state.settings);
  syncOutputs();

  applyNiche({ initial: true });
  applyPersona({ initial: true });
  $('writeBtn').onclick = () =>
    writeScript().catch((e) => {
      $('writeStatus').textContent = '';
      showError(e);
    });
  $('addSubBtn').onclick = addSub;
  $('customSub').addEventListener('keydown', (e) => e.key === 'Enter' && addSub());
  $('connectBtn').onclick = () => connect();
  $('previewVoiceBtn').onclick = previewVoice;
  $('loadStoriesBtn').onclick = () => loadStories().catch(showError);
  $('loadUrlBtn').onclick = loadFromUrl;
  $('blankStoryBtn').onclick = blankStory;
  $('recleanBtn').onclick = reclean;
  for (const id of ['postTitle', 'postBody']) $(id).addEventListener('input', updateStats);
  $('gameplayInput').onchange = (e) => addFiles('gameplay', [...e.target.files]).then(() => (e.target.value = ''));
  $('musicInput').onchange = (e) => addFiles('music', [...e.target.files]).then(() => (e.target.value = ''));
  $('renderBtn').onclick = renderOne;
  $('autoBtn').onclick = autopilot;
  $('cancelBtn').onclick = () => state.abort?.abort();
  setBusy(false);
  updateStats();

  refreshMedia().catch((e) => console.warn('IndexedDB nicht verfügbar', e));
  startPreviewLoop();

  const support = await checkSupport().catch((e) => ({ ok: false, reason: e.message }));
  const badgeEl = $('support');
  if (support.ok) {
    badgeEl.textContent = `✓ Browser bereit (${support.video.toUpperCase()} + ${support.audio.toUpperCase()})`;
    badgeEl.className = 'support ok';
  } else {
    badgeEl.textContent = '✗ ' + support.reason;
    badgeEl.className = 'support bad';
  }

  if ($('apiKey').value.trim()) connect({ quiet: true });
}

init();
