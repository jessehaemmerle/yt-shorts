// Holt Geschichten von Reddit – direkt über die öffentlichen JSON-Endpunkte, optional über einen
// CORS-Proxy, oder über das Reddit-Archiv „Arctic Shift“ (CORS-fähig, braucht keinen Proxy).

export const PRESET_SUBREDDITS = [
  'confessions',
  'TrueOffMyChest',
  'AmItheAsshole',
  'AITAH',
  'tifu',
  'pettyrevenge',
  'MaliciousCompliance',
  'entitledparents',
  'relationship_advice',
  'offmychest',
  'ProRevenge',
  'nosleep',
  'TwoHotTakes',
  'BestofRedditorUpdates',
];

const ARCTIC = 'https://arctic-shift.photon-reddit.com/api';

/* ---------------- Hilfsfunktionen ---------------- */

function proxied(proxy, target) {
  proxy = proxy.trim();
  if (proxy.includes('{url}')) return proxy.replace('{url}', encodeURIComponent(target));
  // Ohne Platzhalter: Proxys wie "https://proxy.example/?url=" erwarten die kodierte URL am Ende,
  // Pfad-Proxys wie "https://proxy.example/" die rohe URL.
  return /[?=&]$/.test(proxy) ? proxy + encodeURIComponent(target) : proxy.replace(/\/?$/, '/') + target;
}

async function readJson(res, label) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const hint = /<html|<!doctype/i.test(text) ? 'HTML-Seite statt JSON (Sperrseite oder Proxy-Fehler)' : 'keine gültige JSON-Antwort';
    throw new Error(`${label}: ${hint}`);
  }
  // Manche Proxys (z.B. allorigins "/get") verpacken die Antwort als String in "contents".
  if (json && typeof json.contents === 'string') {
    try {
      json = JSON.parse(json.contents);
    } catch {
      throw new Error(`${label}: Proxy hat keine JSON-Daten geliefert`);
    }
  }
  if (json?.error && !json.data) throw new Error(`${label}: ${typeof json.error === 'string' ? json.error : JSON.stringify(json.error)}`);
  return json;
}

async function getJson(url, label) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`${label}: Verbindung blockiert (${e.message})`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = (JSON.parse(body).error || '').toString().slice(0, 120);
    } catch {
      /* egal */
    }
    throw new Error(`${label}: HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (gesperrt/API-Key nötig)' : res.status === 429 ? ' (zu viele Anfragen)' : ''}${detail ? ' – ' + detail : ''}`);
  }
  return readJson(res, label);
}

function mapPost(d) {
  return {
    id: d.id,
    subreddit: d.subreddit,
    title: d.title || '',
    body: d.selftext || '',
    author: d.author && d.author !== '[deleted]' ? d.author : '',
    score: d.score || 0,
    comments: d.num_comments || 0,
    over18: !!d.over_18,
    url: d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/comments/${d.id}`,
    created: d.created_utc || 0,
    isSelf: d.is_self !== false,
    stickied: !!d.stickied,
  };
}

function isUsable(p) {
  return p.isSelf && !p.stickied && p.body && !/^\[(removed|deleted)\]$/i.test(p.body.trim());
}

/* ---------------- Reddit direkt / über Proxy ---------------- */

async function fetchRedditJson(path, proxy) {
  const errors = [];
  const candidates = proxy
    ? [{ url: proxied(proxy, `https://www.reddit.com${path}`), label: 'CORS-Proxy' }]
    : [
        { url: `https://www.reddit.com${path}`, label: 'reddit.com' },
        { url: `https://old.reddit.com${path}`, label: 'old.reddit.com' },
      ];
  for (const c of candidates) {
    try {
      return await getJson(c.url, c.label);
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(errors.join('; '));
}

async function fetchSubredditReddit(sub, { sort, time, limit, proxy }) {
  let path = `/r/${encodeURIComponent(sub)}/${sort}.json?limit=${limit}&raw_json=1`;
  if (sort === 'top' || sort === 'controversial') path += `&t=${time}`;
  const json = await fetchRedditJson(path, proxy);
  if (!json?.data?.children) throw new Error('Unerwartete Antwort von Reddit');
  return json.data.children.map((c) => mapPost(c.data));
}

/* ---------------- Arctic-Shift-Archiv ---------------- */

const SPAN = { day: 1, week: 7, month: 30, year: 365, all: 365 * 6 };
// Arctic Shift sortiert nur nach Datum und liefert max. 100 Posts pro Anfrage. Für "Top" werden daher
// mehrere Zeitfenster über den Zeitraum verteilt abgefragt und lokal nach Score sortiert.
const SAMPLES = { day: 2, week: 4, month: 5, year: 6, all: 6 };

async function fetchSubredditArchive(sub, { sort, time }) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const base = `${ARCTIC}/posts/search?subreddit=${encodeURIComponent(sub)}&limit=100`;
  let urls;
  if (sort === 'new' || sort === 'hot') {
    // Brandneue Posts haben im Archiv noch keine Votes – "hot" nimmt daher die letzten 1–3 Tage.
    urls = sort === 'new' ? [`${base}&sort=desc`] : [`${base}&sort=desc&before=${now - DAY}`, `${base}&sort=desc&before=${now - 2 * DAY}`];
  } else {
    // Die letzten ~30 h überspringen: Scores werden im Archiv erst nachträglich aktualisiert.
    const end = now - (time === 'day' ? 0.5 * DAY : 1.25 * DAY);
    const span = SPAN[time] * DAY;
    const n = SAMPLES[time];
    urls = Array.from({ length: n }, (_, i) => `${base}&sort=desc&before=${Math.floor(end - (span * i) / n)}`);
  }
  const results = await Promise.allSettled(urls.map((u) => getJson(u, 'Arctic Shift')));
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (!ok.length) throw results[0].reason;
  const seen = new Set();
  const posts = [];
  for (const r of ok)
    for (const d of r.value.data || []) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      posts.push(mapPost(d));
    }
  posts.sort((a, b) => b.score - a.score);
  return posts;
}

/* ---------------- Öffentliche API ---------------- */

/**
 * source: 'auto' (Reddit, bei Fehler Archiv) | 'reddit' | 'archive'
 * Rückgabe: { posts, via } – via = 'reddit' | 'archive'
 */
export async function fetchSubreddit(sub, { sort = 'top', time = 'week', limit = 75, proxy = '', source = 'auto' } = {}) {
  sub = sub.replace(/^\/?r\//i, '').trim();
  let redditError = null;
  if (source !== 'archive') {
    try {
      const posts = await fetchSubredditReddit(sub, { sort, time, limit, proxy });
      return { posts: posts.filter(isUsable), via: 'reddit' };
    } catch (e) {
      redditError = e;
      if (source === 'reddit') throw e;
    }
  }
  try {
    const posts = await fetchSubredditArchive(sub, { sort, time });
    return { posts: posts.filter(isUsable), via: 'archive' };
  } catch (e) {
    throw new Error(redditError ? `${redditError.message}; Archiv: ${e.message}` : e.message);
  }
}

export async function fetchPostByUrl(link, { proxy = '', source = 'auto' } = {}) {
  let u;
  try {
    u = new URL(link.trim());
  } catch {
    throw new Error('Ungültiger Link.');
  }
  if (!/(^|\.)(reddit\.com|redd\.it)$/i.test(u.hostname)) throw new Error('Bitte einen reddit.com-Link einfügen.');
  const id = u.hostname.endsWith('redd.it') ? u.pathname.slice(1) : u.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
  const errors = [];

  if (source !== 'archive' && !u.hostname.endsWith('redd.it')) {
    try {
      const json = await fetchRedditJson(u.pathname.replace(/\/+$/, '') + '.json?raw_json=1', proxy);
      const d = Array.isArray(json) ? json[0]?.data?.children?.[0]?.data : json?.data?.children?.[0]?.data;
      if (d) return checkPost(mapPost(d));
    } catch (e) {
      errors.push(e.message);
      if (source === 'reddit') throw e;
    }
  }
  if (!id) throw new Error(errors[0] || 'Keine Post-ID im Link gefunden.');
  try {
    const json = await getJson(`${ARCTIC}/posts/ids?ids=${encodeURIComponent(id)}`, 'Arctic Shift');
    const d = json.data?.[0];
    if (!d) throw new Error('Post nicht im Archiv gefunden');
    return checkPost(mapPost(d));
  } catch (e) {
    errors.push('Archiv: ' + e.message);
    throw new Error(errors.join('; '));
  }
}

function checkPost(post) {
  if (!post.body || /^\[(removed|deleted)\]$/i.test(post.body.trim())) throw new Error('Dieser Post hat keinen (sichtbaren) Text.');
  return post;
}
