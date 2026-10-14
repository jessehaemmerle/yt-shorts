// ElevenLabs Text-to-Speech mit Zeitstempeln pro Zeichen (für Wort-genaue Untertitel).
import { splitText } from './text.js';

const API = 'https://api.elevenlabs.io';
export const SAMPLE_RATE = 48000;

export const MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (beste Qualität)', maxChars: 9000 },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (schnell, günstiger)', maxChars: 9000 },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (am günstigsten)', maxChars: 9000 },
];

async function apiError(res) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.detail?.message || j?.detail?.status || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j.detail || j));
  } catch {
    /* kein JSON */
  }
  if (res.status === 401) return new Error('ElevenLabs: API-Key ungültig oder ohne Berechtigung. ' + detail);
  if (res.status === 429) return new Error('ElevenLabs: Rate-Limit/Kontingent erreicht. ' + detail);
  return new Error(`ElevenLabs: HTTP ${res.status} ${detail}`);
}

export async function listVoices(apiKey) {
  const res = await fetch(`${API}/v1/voices`, { headers: { 'xi-api-key': apiKey } });
  if (!res.ok) throw await apiError(res);
  const json = await res.json();
  return (json.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels || {},
    preview: v.preview_url,
  }));
}

export async function getSubscription(apiKey) {
  const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': apiKey } });
  if (!res.ok) throw await apiError(res);
  const j = await res.json();
  return { used: j.character_count, limit: j.character_limit, tier: j.tier };
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function decodeAudio(arrayBuffer) {
  const ctx = new OfflineAudioContext(2, 1, SAMPLE_RATE);
  return ctx.decodeAudioData(arrayBuffer);
}

function concatBuffers(buffers) {
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const length = buffers.reduce((n, b) => n + b.length, 0);
  const out = new AudioBuffer({ numberOfChannels: channels, length, sampleRate: SAMPLE_RATE });
  let offset = 0;
  for (const b of buffers) {
    for (let c = 0; c < channels; c++) out.getChannelData(c).set(b.getChannelData(Math.min(c, b.numberOfChannels - 1)), offset);
    offset += b.length;
  }
  return out;
}

const cache = new Map();

/**
 * Erzeugt das Voice-over. Rückgabe: { audioBuffer, chars: [{c, start, end}] }
 * chars ist die Zeichenfolge, die ElevenLabs tatsächlich gesprochen hat, mit Start/Ende in Sekunden.
 */
export async function synthesize({ apiKey, voiceId, modelId, text, speed = 1, stability = 0.5, similarity = 0.75, style = 0 }, onProgress) {
  if (!apiKey) throw new Error('Kein ElevenLabs API-Key hinterlegt.');
  if (!voiceId) throw new Error('Keine Stimme ausgewählt.');
  const cacheKey = JSON.stringify([voiceId, modelId, text, speed, stability, similarity, style]);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const model = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const chunks = splitText(text, model.maxChars);
  const buffers = [];
  const chars = [];
  let timeOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i / chunks.length, `Voice-over ${i + 1}/${chunks.length} wird erzeugt…`);
    const body = {
      text: chunks[i],
      model_id: model.id,
      voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true, speed },
    };
    if (i > 0) body.previous_text = chunks[i - 1].slice(-500);
    if (i < chunks.length - 1) body.next_text = chunks[i + 1].slice(0, 500);
    const res = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiError(res);
    const json = await res.json();
    const buffer = await decodeAudio(base64ToBytes(json.audio_base64).buffer);
    const a = json.alignment || json.normalized_alignment;
    if (!a?.characters) throw new Error('ElevenLabs hat keine Zeitstempel geliefert.');
    if (i > 0) chars.push({ c: ' ', start: timeOffset, end: timeOffset });
    for (let k = 0; k < a.characters.length; k++) {
      chars.push({
        c: a.characters[k],
        start: timeOffset + a.character_start_times_seconds[k],
        end: timeOffset + a.character_end_times_seconds[k],
      });
    }
    buffers.push(buffer);
    timeOffset += buffer.duration;
  }
  onProgress?.(1, 'Voice-over fertig');
  const result = { audioBuffer: buffers.length === 1 ? buffers[0] : concatBuffers(buffers), chars };
  cache.set(cacheKey, result);
  return result;
}
