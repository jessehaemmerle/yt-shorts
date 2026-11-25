// Bearbeitbare Ansicht eines Skripts (Plan pro Teil): Hook, Story-Zeilen mit Visual, Urteil, Frage, Loop.
import { emptyVisual, planWordCount } from './plan.js';
import { WORDS_PER_SECOND, formatDuration } from './text.js';

const TYPE_LABELS = { scene: '🎬 Szene', chat: '💬 Chat', stat: '🔢 Zahl', reddit: '📄 Reddit-Karte', none: '– nur Untertitel' };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function field(label, value, onInput, { multiline = false, rows = 2, placeholder = '' } = {}) {
  const input = multiline ? el('textarea', { rows, value, placeholder }) : el('input', { value, placeholder });
  input.addEventListener('input', () => onInput(input.value));
  return el('label', {}, label, input);
}

/**
 * script: { parts: Plan[] }, state: { partIdx }, opts: { speed, onChange }
 */
export function renderPlanEditor(root, script, ui, opts) {
  root.innerHTML = '';
  if (!script?.parts?.length) return;
  const plan = script.parts[ui.partIdx] || script.parts[0];
  const changed = () => {
    updateStats();
    opts.onChange?.();
  };

  // Teil-Auswahl
  if (script.parts.length > 1) {
    const tabs = el('div', { className: 'tabs' });
    script.parts.forEach((p, i) => {
      const b = el('button', { className: 'chip' + (i === ui.partIdx ? ' on' : ''), textContent: `Teil ${i + 1}/${script.parts.length}` });
      b.onclick = () => {
        ui.partIdx = i;
        renderPlanEditor(root, script, ui, opts);
        opts.onChange?.();
      };
      tabs.append(b);
    });
    root.append(tabs);
  }

  const stats = el('p', { className: 'stats' });
  function updateStats() {
    const words = planWordCount(plan);
    const sec = words / (WORDS_PER_SECOND * (opts.speed() || 1));
    stats.replaceChildren(
      'Dieser Teil: ',
      el('b', { textContent: `${words} Wörter` }),
      ' · ca. ',
      el('b', { textContent: formatDuration(sec) }),
      ' · ',
      el('span', { className: sec > 50 ? 'warn' : sec < 20 ? 'warn' : 'ok', textContent: sec > 50 ? 'zu lang – kürzen (Ziel 25–45 s)' : sec < 20 ? 'sehr kurz' : 'gute Länge ✓' }),
      plan.generator === 'claude' ? ' · ✍️ von Claude' : ' · ⚙️ automatisch'
    );
  }

  root.append(
    el('h3', { textContent: '1 · Hook (die ersten 1–2 Sekunden)' }),
    el(
      'div',
      { className: 'grid2' },
      field('Gesprochener Einstieg (krassester Satz)', plan.hook, (v) => ((plan.hook = v), changed()), { multiline: true }),
      field('Großer Text im Bild (max. ~7 Wörter)', plan.hookText, (v) => ((plan.hookText = v), changed()), { multiline: true })
    ),
    el('h3', { textContent: '2 · Story & Visuals' })
  );

  const list = el('div', { className: 'plan-lines' });
  const renderLines = () => {
    list.innerHTML = '';
    plan.lines.forEach((line, i) => {
      const v = line.visual;
      const typeSel = el('select');
      for (const [val, label] of Object.entries(TYPE_LABELS)) typeSel.add(new Option(label, val));
      typeSel.value = v.type;
      typeSel.onchange = () => {
        line.visual = { ...emptyVisual(typeSel.value), text: v.text, emojis: v.emojis };
        renderLines();
        changed();
      };
      const extra = el('div', { className: 'visual-fields' }, typeSel);
      const vf = (label, key, ph) => {
        const inp = el('input', { value: v[key] || '', placeholder: ph, title: label });
        inp.addEventListener('input', () => ((v[key] = inp.value), changed()));
        return inp;
      };
      if (v.type === 'scene') extra.append(vf('Emojis', 'emojis', '😱💸'), vf('Kernaussage', 'text', 'KERNAUSSAGE'));
      if (v.type === 'stat') extra.append(vf('Zahl', 'value', '$4,000'), vf('Beschriftung', 'text', 'gestohlen'));
      if (v.type === 'chat') {
        const from = el('select');
        from.add(new Option('von mir (rechts)', 'me'));
        from.add(new Option('vom Gegenüber (links)', 'them'));
        from.value = v.from;
        from.onchange = () => ((v.from = from.value), changed());
        extra.append(from, vf('Absender', 'sender', 'Chef'), vf('Nachricht', 'text', 'Nachrichtentext'));
      }
      const say = el('textarea', { rows: 2, value: line.say });
      say.addEventListener('input', () => ((line.say = say.value), changed()));
      const btn = (txt, title, fn) => {
        const b = el('button', { className: 'btn ghost small', textContent: txt, title });
        b.onclick = () => {
          fn();
          renderLines();
          changed();
        };
        return b;
      };
      const tools = el(
        'div',
        { className: 'line-tools' },
        el('span', { className: 'line-no', textContent: String(i + 1) }),
        btn('↑', 'nach oben', () => i > 0 && plan.lines.splice(i - 1, 0, plan.lines.splice(i, 1)[0])),
        btn('↓', 'nach unten', () => i < plan.lines.length - 1 && plan.lines.splice(i + 1, 0, plan.lines.splice(i, 1)[0])),
        btn('✕', 'Zeile löschen', () => plan.lines.splice(i, 1))
      );
      list.append(el('div', { className: 'plan-line' }, tools, el('div', { className: 'line-body' }, say, extra)));
    });
    const add = el('button', { className: 'btn ghost small', textContent: '+ Zeile' });
    add.onclick = () => {
      plan.lines.push({ say: '', visual: emptyVisual('scene') });
      renderLines();
      changed();
    };
    list.append(add);
  };
  renderLines();
  root.append(list);

  if (plan.part.index < plan.part.total) {
    root.append(field('Cliffhanger (Teil endet hier)', plan.cliffhanger, (v) => ((plan.cliffhanger = v), changed()), { multiline: true }));
  }
  root.append(
    el('h3', { textContent: '3 · Eigene Ebene: Meinung der Erzähler-Figur' }),
    el(
      'div',
      { className: 'grid2' },
      field('Urteil / Analyse (gesprochen)', plan.take, (v) => ((plan.take = v), changed()), { multiline: true, rows: 3, placeholder: 'Leer = keine eigene Meinung' }),
      field('Stempel im Bild (z.B. NTA)', plan.verdict, (v) => ((plan.verdict = v), changed()), { placeholder: 'NTA' })
    ),
    el('h3', { textContent: '4 · Kommentar-Frage & Loop' }),
    el(
      'div',
      { className: 'grid2' },
      field('Frage (gesprochen)', plan.cta, (v) => ((plan.cta = v), changed()), { multiline: true }),
      field('Frage im Bild', plan.ctaOnScreen, (v) => ((plan.ctaOnScreen = v), changed()))
    ),
    el(
      'div',
      { className: 'grid2' },
      field('Antwort A', plan.options[0] || '', (v) => ((plan.options[0] = v), changed())),
      field('Antwort B', plan.options[1] || '', (v) => ((plan.options[1] = v), changed()))
    ),
    field('Loop-Schluss (führt zurück in den Hook, ohne Satzzeichen am Ende)', plan.loop, (v) => ((plan.loop = v), changed()), { placeholder: 'Und alles fing damit an, dass' }),
    stats
  );
  updateStats();
}
