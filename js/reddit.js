// Holt Geschichten über die öffentlichen JSON-Endpunkte von Reddit (direkt aus dem Browser).

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

function buildCandidates(path, proxy) {
  const urls = [`https://www.reddit.com${path}`, `https://old.reddit.com${path}`, `https://api.reddit.com${path.replace('.json', '')}`];
  if (proxy) {
    const target = `https://www.reddit.com${path}`;
    const proxied = proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(target)) : proxy + encodeURIComponent(target);
    // Mit gesetztem Proxy zuerst den Proxy versuchen – der direkte Weg ist dann meist blockiert.
    urls.unshift(proxied);
  }
  return urls;
}

async function fetchJson(path, proxy) {
  const errors = [];
  for (const url of buildCandidates(path, proxy)) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        errors.push(`${new URL(url).host}: HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e.message}`);
    }
  }
  throw new Error(
    'Reddit konnte nicht geladen werden (' + errors.join('; ') + '). ' +
      'Tipp: In den Einstellungen einen CORS-Proxy eintragen oder den Text manuell einfügen.'
  );
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
    url: d.permalink ? `https://www.reddit.com${d.permalink}` : '',
    created: d.created_utc || 0,
    isSelf: !!d.is_self,
    stickied: !!d.stickied,
  };
}

function isUsable(p) {
  return p.isSelf && !p.stickied && p.body && !/^\[(removed|deleted)\]$/i.test(p.body.trim());
}

export async function fetchSubreddit(sub, { sort = 'top', time = 'week', limit = 50, proxy = '' } = {}) {
  sub = sub.replace(/^\/?r\//i, '').trim();
  let path = `/r/${encodeURIComponent(sub)}/${sort}.json?limit=${limit}&raw_json=1`;
  if (sort === 'top' || sort === 'controversial') path += `&t=${time}`;
  const json = await fetchJson(path, proxy);
  const children = json?.data?.children || [];
  return children.map((c) => mapPost(c.data)).filter(isUsable);
}

export async function fetchPostByUrl(link, { proxy = '' } = {}) {
  let u;
  try {
    u = new URL(link.trim());
  } catch {
    throw new Error('Ungültiger Link.');
  }
  if (!/reddit\.com$/i.test(u.hostname)) throw new Error('Bitte einen reddit.com-Link einfügen.');
  const path = u.pathname.replace(/\/+$/, '') + '.json?raw_json=1';
  const json = await fetchJson(path, proxy);
  const d = Array.isArray(json) ? json[0]?.data?.children?.[0]?.data : json?.data?.children?.[0]?.data;
  if (!d) throw new Error('Post nicht gefunden.');
  const post = mapPost(d);
  if (!post.body) throw new Error('Dieser Post hat keinen Text.');
  return post;
}
