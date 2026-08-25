// 全局音频设置:静音开关 + 低/中/高三段音量,持久化并全局生效
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

// 开始/刷新 BGM(主界面/商店/游戏内调用;结算页调用 stopBgm)
// 注意:Phaser 的声音管理器是全局共享的,跨场景持续播放,
// 因此每次进入场景都要重新应用当前音量设置,否则设置修改不会生效
export function startBgm(scene: Phaser.Scene) {
  const mult = soundMult();
  try {
    if (mult <= 0) {
      stopBgm(scene);
      return;
    }
    const bgm = scene.sound.get('bgm') as Phaser.Sound.WebAudioSound | null;
    if (bgm) {
      if (!bgm.isPlaying) bgm.play();
      bgm.setVolume(BGM_BASE * mult); // 关键:重新应用音量
    } else {
      const s = scene.sound.add('bgm', { loop: true, volume: BGM_BASE * mult });
      s.play();
    }
  } catch {}
}

export function stopBgm(scene: Phaser.Scene) {
  try { scene.sound.stopByKey('bgm'); } catch {}
}

// 播放音效(自动应用音量设置,静音时跳过)
export function playSfx(scene: Phaser.Scene, key: string, baseVolume = 0.5) {
  const mult = soundMult();
  if (mult <= 0) return;
  try { scene.sound.play(key, { volume: baseVolume * mult }); } catch {}
}
