// SLYDE — Procedural SFX generator (Phase 4 audio).
// Synthesizes all game sounds as 16-bit mono WAVs into assets/sfx/.
// Run: npm run generate:sfx
// Every sound is a small envelope-shaped tone cluster — no external assets.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 22050; // sample rate

function wav(samples: Float32Array): Buffer {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

type Tone = { f: number; ms: number; gain?: number; type?: 'sine' | 'noise' | 'triangle' };

function render(tones: Tone[], gapMs = 0): Float32Array {
  const chunks: Float32Array[] = [];
  for (const t of tones) {
    const n = Math.floor((SR * t.ms) / 1000);
    const s = new Float32Array(n);
    const g = t.gain ?? 0.8;
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (SR * 0.004)) * Math.pow(1 - i / n, 1.4);
      if (t.type === 'noise') {
        s[i] = g * env * (Math.random() * 2 - 1);
      } else {
        const wave = t.type === 'triangle'
          ? Math.asin(Math.sin((2 * Math.PI * t.f * i) / SR)) * (2 / Math.PI)
          : Math.sin((2 * Math.PI * t.f * i) / SR);
        s[i] = g * env * wave;
      }
    }
    chunks.push(s);
    if (gapMs > 0) chunks.push(new Float32Array(Math.floor((SR * gapMs) / 1000)));
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

const OUT = join(__dirname, '..', '..', 'assets', 'sfx');
mkdirSync(OUT, { recursive: true });

const files: Record<string, Float32Array> = {
  // Woody thock — low sine knock with noise transient.
  'thock.wav': render([{ f: 180, ms: 90, gain: 0.9 }, { f: 90, ms: 40, gain: 0.5 }]),
  // Brass click for UI buttons.
  'click.wav': render([{ f: 950, ms: 28, gain: 0.55 }, { f: 620, ms: 40, gain: 0.4 }]),
  // Whoosh — filtered-noise sweep for screen transitions.
  'whoosh.wav': render([
    { f: 300, ms: 60, gain: 0.15, type: 'noise' },
    { f: 500, ms: 120, gain: 0.25, type: 'noise' },
    { f: 200, ms: 90, gain: 0.12, type: 'noise' },
  ]),
  // Timer tick (≤10s zone).
  'tick.wav': render([{ f: 1200, ms: 32, gain: 0.5 }]),
  // Urgent double-beep (≤5s zone).
  'urgent.wav': render([{ f: 1560, ms: 70, gain: 0.85 }, { f: 1560, ms: 70, gain: 0.85 }], 40),
  // Fail — loud falling tone.
  'fail.wav': render([{ f: 640, ms: 130, gain: 0.9 }, { f: 470, ms: 130, gain: 0.85 }, { f: 300, ms: 240, gain: 0.9 }]),
  // Win — 3-note rising chime.
  'win.wav': render([{ f: 523, ms: 120, gain: 0.8 }, { f: 659, ms: 120, gain: 0.8 }, { f: 784, ms: 200, gain: 0.85 }], 20),
  // New personal best — 4-note fanfare (plays ~0.6s after win chime).
  'best.wav': render([
    { f: 523, ms: 90, gain: 0.75 }, { f: 659, ms: 90, gain: 0.75 },
    { f: 784, ms: 90, gain: 0.8 }, { f: 1047, ms: 260, gain: 0.85 },
  ], 15),
  // Level start — 2-note rising chime.
  'start.wav': render([{ f: 392, ms: 100, gain: 0.8 }, { f: 587, ms: 160, gain: 0.85 }], 20),
};

// Music loop — gentle plucked pentatonic bed (~19s), loops seamlessly.
function musicLoop(): Float32Array {
  const notes = [262, 294, 330, 392, 440]; // C D E G A pentatonic
  const stepMs = 730;
  const chunks: Float32Array[] = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 26; i++) {
    const f = notes[Math.floor(rand() * notes.length)] * (rand() < 0.25 ? 2 : 1);
    const n = Math.floor((SR * stepMs * 1.6) / 1000);
    const s = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const env = Math.min(1, j / (SR * 0.006)) * Math.pow(1 - j / n, 2.2);
      const decay = Math.pow(1 - j / n, 3);
      // pluck: fundamental + soft octave, slight detune warmth
      const w =
        Math.sin((2 * Math.PI * f * j) / SR) * 0.6 +
        Math.sin((2 * Math.PI * f * 2.001 * j) / SR) * 0.25 +
        Math.sin((2 * Math.PI * f * 3 * j) / SR) * 0.08;
      s[j] = 0.5 * env * decay * w;
    }
    chunks.push(s);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

files['music.wav'] = musicLoop();

for (const [name, samples] of Object.entries(files)) {
  writeFileSync(join(OUT, name), wav(samples));
}
console.log(`Wrote ${Object.keys(files).length} SFX files to assets/sfx`);
