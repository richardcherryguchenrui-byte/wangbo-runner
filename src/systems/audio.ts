// 全局音频设置:静音开关 + 低/中/高三段音量,持久化并全局生效
// 双 BGM:主界面/前期用 bgm,游戏 30 秒后交叉淡入 bgm2
import Phaser from 'phaser';

export interface AudioSettings {
  mute: boolean;
  volume: 0 | 1 | 2; // 低/中/高
}

const KEY = 'wangboAudio';
const LEVEL_VOLUME = [0.25, 0.55, 0.9]; // 低/中/高对应的音量系数
const BGM_BASE = 0.35;

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { mute: false, volume: 1, ...JSON.parse(raw) };
  } catch {}
  return { mute: false, volume: 1 };
}

export function saveAudioSettings(s: AudioSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

// 当前音量系数:静音为 0,否则按档位
export function soundMult(): number {
  const s = loadAudioSettings();
  return s.mute ? 0 : LEVEL_VOLUME[s.volume];
}

function playLoop(scene: Phaser.Scene, key: string) {
  const mult = soundMult();
  if (mult <= 0) return null;
  const existing = scene.sound.get(key) as Phaser.Sound.WebAudioSound | null;
  if (existing) {
    if (!existing.isPlaying) existing.play();
    existing.setVolume(BGM_BASE * mult);
    return existing;
  }
  const s = scene.sound.add(key, { loop: true, volume: BGM_BASE * mult });
  s.play();
  return s;
}

// 开始/刷新 BGM(主界面/商店/游戏内调用;结算页调用 stopBgm)
// 注意:Phaser 的声音管理器是全局共享的,跨场景持续播放,
// 因此每次进入场景都要重新应用当前音量设置,否则设置修改不会生效
export function startBgm(scene: Phaser.Scene) {
  try {
    stopBgm2(scene);
    playLoop(scene, 'bgm');
  } catch {}
}

// 开始第二首 BGM(先停掉第一首)
export function startBgm2(scene: Phaser.Scene) {
  try {
    stopBgm(scene);
    playLoop(scene, 'bgm2');
  } catch {}
}

// 交叉淡入第二首 BGM:第一首渐弱,第二首渐强
export function crossfadeToBgm2(scene: Phaser.Scene) {
  try {
    const mult = soundMult();
    if (mult <= 0) return;
    const bgm2 = scene.sound.get('bgm2') as Phaser.Sound.WebAudioSound | null;
    if (bgm2 && bgm2.isPlaying) return; // 已切换过
    const bgm1 = scene.sound.get('bgm') as Phaser.Sound.WebAudioSound | null;
    const s2 = scene.sound.add('bgm2', { loop: true, volume: 0 });
    s2.play();
    const target = BGM_BASE * mult;
    scene.tweens.add({ targets: s2, volume: target, duration: 900, ease: 'Sine.inOut' });
    if (bgm1) {
      scene.tweens.add({
        targets: bgm1, volume: 0, duration: 900, ease: 'Sine.inOut',
        onComplete: () => { try { bgm1.stop(); } catch {} }
      });
    }
  } catch {}
}

export function stopBgm(scene: Phaser.Scene) {
  try { scene.sound.stopByKey('bgm'); } catch {}
  try { scene.sound.stopByKey('bgm2'); } catch {}
}

export function stopBgm2(scene: Phaser.Scene) {
  try { scene.sound.stopByKey('bgm2'); } catch {}
}

// 暂停/恢复 BGM(游戏暂停用)
export function pauseBgm(scene: Phaser.Scene) {
  try {
    scene.sound.getAllPlaying().forEach(s => { if (s.key === 'bgm' || s.key === 'bgm2') s.pause(); });
  } catch {}
}

export function resumeBgm(scene: Phaser.Scene) {
  try {
    [scene.sound.get('bgm'), scene.sound.get('bgm2')].forEach(s => {
      if (s && !s.isPlaying && s.isPaused) s.resume();
    });
  } catch {}
}

// 播放音效(自动应用音量设置,静音时跳过)
export function playSfx(scene: Phaser.Scene, key: string, baseVolume = 0.5) {
  const mult = soundMult();
  if (mult <= 0) return;
  try { scene.sound.play(key, { volume: baseVolume * mult }); } catch {}
}
