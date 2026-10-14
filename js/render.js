// Setzt Gameplay, Voice-over, Musik und Untertitel zu einem 9:16-MP4 zusammen – komplett im Browser (WebCodecs).
import {
  Input,
  BlobSource,
  ALL_FORMATS,
  CanvasSink,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from '../vendor/mediabunny-1.59.1.min.mjs';
import { SAMPLE_RATE, decodeAudio } from './tts.js';
import { chunkAt } from './captions.js';
import { drawProceduralBackground, drawRedditCard, drawCaption, drawProgressBar, drawWatermark } from './draw.js';

export const WIDTH = 1080;
export const HEIGHT = 1920;

export async function checkSupport() {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    return { ok: false, reason: 'Dieser Browser unterstützt kein WebCodecs. Bitte aktuelles Chrome, Edge oder Safari verwenden.' };
  }
  const video = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: WIDTH, height: HEIGHT });
  const audio = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  if (!video || !audio) return { ok: false, reason: 'Kein passender Video-/Audio-Encoder im Browser gefunden.', video, audio };
  return { ok: true, video, audio };
}

async function mixAudio(narration, { musicBlob, musicVolume = 0.15, tail = 0.8 }) {
  const duration = narration.duration + tail;
  const length = Math.ceil(duration * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const voice = ctx.createBufferSource();
  voice.buffer = narration;
  voice.connect(ctx.destination);
  voice.start(0);
  if (musicBlob) {
    const music = await decodeAudio(await musicBlob.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = music;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(musicVolume, 0);
    gain.gain.setValueAtTime(musicVolume, Math.max(0, duration - 1));
    gain.gain.linearRampToValueAtTime(0, duration);
    src.connect(gain).connect(ctx.destination);
    src.start(0, Math.random() * Math.max(0, music.duration - duration));
  }
  return ctx.startRendering();
}

async function openGameplay(blob, needed, fps) {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('Die Gameplay-Datei enthält keine Videospur.');
  if (!(await track.canDecode())) throw new Error('Das Video-Format der Gameplay-Datei kann dieser Browser nicht dekodieren (am besten H.264-MP4 verwenden).');
  const first = await track.getFirstTimestamp();
  const duration = (await track.computeDuration()) - first;
  const maxStart = Math.max(0, duration - needed);
  const start = first + Math.random() * maxStart;
  const sink = new CanvasSink(track, { width: WIDTH, height: HEIGHT, fit: 'cover', poolSize: 3 });
  const frames = Math.ceil(needed * fps);
  function* timestamps() {
    for (let i = 0; i < frames; i++) {
      const rel = (start - first + i / fps) % Math.max(duration, 0.001);
      yield first + rel;
    }
  }
  return { iterator: sink.canvasesAtTimestamps(timestamps()), input };
}

/**
 * @param {object} job
 *  narration: AudioBuffer, chunks: Untertitel, post: {title, subreddit, author, score, comments},
 *  titleEnd: Sekunde, an der der Titel fertig gesprochen ist,
 *  gameplayBlob?: Blob, musicBlob?: Blob, style: Stiloptionen, canvas: Ziel-Canvas (Vorschau)
 */
export async function renderVideo(job, { onProgress, signal } = {}) {
  const { narration, chunks, post, titleEnd, gameplayBlob, musicBlob, style, canvas } = job;
  const fps = style.fps || 30;
  const support = await checkSupport();
  if (!support.ok) throw new Error(support.reason);

  onProgress?.(0, 'Audio wird gemischt…');
  const mixed = await mixAudio(narration, { musicBlob, musicVolume: style.musicVolume });
  const duration = mixed.duration;
  const totalFrames = Math.ceil(duration * fps);

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });

  let gameplay = null;
  if (gameplayBlob) {
    onProgress?.(0, 'Gameplay wird geladen…');
    gameplay = await openGameplay(gameplayBlob, duration, fps);
  }

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: support.video, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  const audioSource = new AudioBufferSource({ codec: support.audio, quality: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);
  await output.start();

  try {
    // Audio parallel einspeisen, damit der Muxer beide Spuren verschachteln kann.
    const audioDone = audioSource.add(mixed).then(() => audioSource.close());
    audioDone.catch(() => {});

    const seed = Math.floor(Math.random() * 1000);
    let hint = 0;
    const started = performance.now();
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const t = i / fps;

      if (gameplay) {
        const { value } = await gameplay.iterator.next();
        if (value?.canvas) ctx.drawImage(value.canvas, 0, 0, WIDTH, HEIGHT);
        else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
      } else {
        drawProceduralBackground(ctx, WIDTH, HEIGHT, t, seed);
      }
      if (style.dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${style.dim})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      const cardVisible = style.showCard && drawRedditCard(ctx, WIDTH, HEIGHT, post, t, titleEnd, style);
      if (!cardVisible) {
        const r = chunkAt(chunks, t, hint);
        hint = r.index;
        if (r.chunk && (!style.showCard || r.chunk.start >= titleEnd - 0.05)) drawCaption(ctx, WIDTH, HEIGHT, r.chunk, t, style);
      }
      drawWatermark(ctx, WIDTH, HEIGHT, style.watermark, style.font);
      if (style.progressBar) drawProgressBar(ctx, WIDTH, HEIGHT, t / duration, style.highlightColor);

      await videoSource.add(t, 1 / fps);

      if (i % 5 === 0) {
        const elapsed = (performance.now() - started) / 1000;
        const eta = (elapsed / (i + 1)) * (totalFrames - i - 1);
        onProgress?.(i / totalFrames, `Frame ${i + 1}/${totalFrames} · noch ca. ${Math.ceil(eta)} s`);
      }
    }
    videoSource.close();
    await audioDone;
    onProgress?.(1, 'Video wird finalisiert…');
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    await gameplay?.iterator.return?.();
    gameplay?.input.dispose?.();
  }

  const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
  return { blob, duration, codecs: `${support.video}/${support.audio}` };
}
