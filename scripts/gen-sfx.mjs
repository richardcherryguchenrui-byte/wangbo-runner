// 合成音效生成器:程序生成 16-bit PCM WAV,输出到 public/assets/
// 运行:npm run gen:sfx(新增/修改音效后重新执行)
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const SR = 22050;

// ---- 基础波形 ----
function sine(f, t) { return Math.sin(2 * Math.PI * f * t); }
function square(f, t) { return Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1; }
function triangle(f, t) { return 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * f * t)); }
function noise() { return Math.random() * 2 - 1; }

// 线性包络:attackMs 起音、holdMs 保持、releaseMs 释放
function env(t, totalMs, attackMs, releaseMs) {
  if (t * 1000 < attackMs) return t * 1000 / attackMs;
  const rel = (totalMs - t * 1000) / releaseMs;
  if (t * 1000 > totalMs - releaseMs && releaseMs > 0) return Math.max(0, Math.min(1, rel));
  return 1;
}

function note(freq, durMs, { wave = 'sine', vol = 0.5, attackMs = 4, releaseMs = 40 } = {}) {
  const n = Math.floor(SR * durMs / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const w = wave === 'square' ? square(freq, t) : wave === 'triangle' ? triangle(freq, t) : sine(freq, t);
    out[i] = w * env(t, durMs, attackMs, releaseMs) * vol;
  }
  return out;
}

function silence(ms) {
  return new Float32Array(Math.floor(SR * ms / 1000));
}

function mix(...parts) {
  const total = Math.max(...parts.map(p => p.length));
  const out = new Float32Array(total);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  // 软限幅,防爆音
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.2) * 0.9;
  return out;
}

function seq(notes, gapMs = 0) {
  const parts = [];
  let offset = 0;
  for (const [freq, dur] of notes) {
    const n = note(freq, dur);
    parts.push({ offset, data: n });
    offset += dur + gapMs;
  }
  const total = offset;
  const out = new Float32Array(Math.floor(SR * total / 1000));
  for (const p of parts) {
    const start = Math.floor(SR * p.offset / 1000);
    for (let i = 0; i < p.data.length; i++) out[start + i] += p.data[i];
  }
  return out;
}

// ---- WAV 编码 ----
function toWav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);       // fmt 块大小
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // 单声道
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);   // 字节率
  buf.writeUInt16LE(2, 32);        // 块对齐
  buf.writeUInt16LE(16, 34);       // 位深
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  return buf;
}

function save(name, samples) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), toWav(samples));
  console.log(`✅ ${name} (${(samples.length / SR).toFixed(2)}s, ${(samples.length * 2 / 1024).toFixed(0)}KB)`);
}

// ---- 音效定义 ----
// 银币入账:短促双音上行
save('coin.wav', seq([[988, 55], [1319, 110]], 25));
// 射击:方波快速下滑
save('shoot.wav', (() => {
  const n = Math.floor(SR * 0.14);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 900 - 6500 * t;
    out[i] = square(Math.max(120, f), t) * env(t, 140, 2, 30) * 0.35;
  }
  return out;
})());
// 拾取道具:三角波琶音
save('pickup.wav', seq([[523, 70], [659, 70], [784, 70], [1047, 140]], 20));
// 二段跳解锁:上行琶音
save('unlock.wav', seq([[523, 90], [659, 90], [784, 90], [1047, 260]], 30));
// 按钮点击:极短高音
save('click.wav', note(1500, 45, { vol: 0.3, attackMs: 1, releaseMs: 40 }));
// 破纪录号角
save('record.wav', seq([[523, 120], [659, 120], [784, 120], [1047, 420]], 40));
// 空中美女预警:两声短促方波
save('warn.wav', seq([[700, 60], [700, 60]], 70));
// 巡视组来袭警报:三声急促
save('wave_start.wav', seq([[550, 90], [550, 90], [550, 90], [660, 200]], 50));
// 平安度过:欢快上行
save('wave_clear.wav', seq([[659, 90], [784, 90], [1047, 240]], 30));
// 滑铲:短促下坠的气流声(噪声 + 下滑方波)
save('slide.wav', (() => {
  const n = Math.floor(SR * 0.26);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 620 - 520 * (t / 0.26);
    const e = Math.max(0, 1 - t / 0.26);
    out[i] = (noise() * 0.25 + triangle(Math.max(90, f), t) * 0.22) * e;
  }
  return out;
})());
// 擦身而过:一声轻快的「叮」
save('near.wav', seq([[1568, 45], [2093, 90]], 12));
// 升官号角:五音上行 + 尾音
save('promote.wav', seq([[523, 80], [659, 80], [784, 80], [1047, 120], [1319, 300]], 25));
// 高光时刻:上升扫频 + 明亮和弦
save('hype.wav', (() => {
  const n = Math.floor(SR * 0.62);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 260 + 1600 * (t / 0.62);
    const e = Math.min(1, t / 0.06) * Math.max(0, 1 - t / 0.62);
    out[i] = triangle(f, t) * 0.28 * e;
  }
  return out;
})());
// 完成考核:清脆双音
save('mission.wav', seq([[880, 70], [1175, 160]], 20));


// ---- 第二首 BGM:8 秒芯片音乐循环(Am-F-C-G,150BPM,16 步) ----
(() => {
  const bpm = 150;
  const step = 60 / bpm / 4; // 十六分音符(秒)
  const loopS = 8;
  const steps = Math.floor(loopS / step);
  const out = new Float32Array(Math.floor(SR * loopS));
  // 和弦根音(每 4 步换)
  const bassRoots = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
  const leadNotes = [440, 523.25, 659.25, 783.99, 880, 1046.5]; // A4 C5 E5 G5 A5 C6
  const melody = [0, 2, 4, 2, 3, 2, 4, 3, 2, 4, 5, 4, 3, 2, 1, 0];
  for (let s = 0; s < steps; s++) {
    const t0 = s * step;
    const dur = step * 0.9;
    // 贝斯:方波,每步一个根音
    const bassF = bassRoots[s % 16 >> 2];
    for (let i = 0; i < dur * SR; i++) {
      const t = t0 + i / SR;
      const v = square(bassF, t) * env(t - t0, dur * 1000, 2, 30) * 0.16;
      const idx = Math.floor(t * SR);
      if (idx < out.length) out[idx] += v;
    }
    // 旋律:三角波
    const mf = leadNotes[melody[s % 16]];
    for (let i = 0; i < dur * SR; i++) {
      const t = t0 + i / SR;
      const v = triangle(mf, t) * env(t - t0, dur * 1000, 2, 60) * 0.2;
      const idx = Math.floor(t * SR);
      if (idx < out.length) out[idx] += v;
    }
    // 鼓点:白噪声短促(每 2 步一次)
    if (s % 2 === 0) {
      for (let i = 0; i < 0.05 * SR; i++) {
        const t = t0 + i / SR;
        const v = noise() * env(t - t0, 50, 1, 25) * 0.12;
        const idx = Math.floor(t * SR);
        if (idx < out.length) out[idx] += v;
      }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.3) * 0.9;
  save('bgm2.wav', out);
})();

console.log('\n全部音效已生成到 public/assets/');
