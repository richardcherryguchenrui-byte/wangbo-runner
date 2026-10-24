// 单局考核:每局随机(每日挑战用种子)抽一个小目标,完成立刻发银币
// 目的:给「无限生存」一个短周期目标,让新手也能带着任务感跑起来。
import type { Progress } from './progress';

export type MissionId = 'dodge' | 'combo' | 'pickup' | 'survive' | 'kill' | 'nearmiss' | 'flawless';

export interface RunMission {
  id: MissionId;
  title: string;
  desc: string;
  target: number;
  unit: string;
  reward: number;
}

export interface MissionState {
  dodged: number;
  comboMax: number;
  pickups: number;
  elapsedMs: number;
  kills: number;
  nearMisses: number;
  timeSinceHitMs: number;
}

const ALL: RunMission[] = [
  { id: 'dodge', title: '稳步高升', desc: '翻越 15 个诱惑', target: 15, unit: '个', reward: 30 },
  { id: 'survive', title: '稳坐钓鱼台', desc: '存活 30 秒', target: 30, unit: '秒', reward: 30 },
  { id: 'pickup', title: '雁过拔毛', desc: '拾取 3 个道具', target: 3, unit: '个', reward: 35 },
  { id: 'combo', title: '一气呵成', desc: '达成 ×10 连击', target: 10, unit: '连', reward: 45 },
  { id: 'kill', title: '反腐先锋', desc: '击毁 3 个障碍', target: 3, unit: '个', reward: 40 },
  { id: 'nearmiss', title: '有惊无险', desc: '擦身而过 4 次', target: 4, unit: '次', reward: 50 },
  { id: 'flawless', title: '两袖清风', desc: '无伤存活 20 秒', target: 20, unit: '秒', reward: 50 }
];

export function missionValue(m: RunMission, s: MissionState): number {
  switch (m.id) {
    case 'dodge': return s.dodged;
    case 'combo': return s.comboMax;
    case 'pickup': return s.pickups;
    case 'survive': return Math.floor(s.elapsedMs / 1000);
    case 'kill': return s.kills;
    case 'nearmiss': return s.nearMisses;
    case 'flawless': return Math.floor(s.timeSinceHitMs / 1000);
  }
}

export function missionProgressText(m: RunMission, s: MissionState): string {
  const v = Math.min(missionValue(m, s), m.target);
  switch (m.id) {
    case 'dodge': return `已翻越 ${v}/${m.target}`;
    case 'survive': return `坚持 ${v}/${m.target} 秒`;
    case 'pickup': return `已拾取 ${v}/${m.target}`;
    case 'combo': return `最高连击 ${v}/${m.target}`;
    case 'kill': return `已击毁 ${v}/${m.target}`;
    case 'nearmiss': return `擦身 ${v}/${m.target}`;
    case 'flawless': return `无伤 ${v}/${m.target} 秒`;
  }
}

export function missionDone(m: RunMission, s: MissionState): boolean {
  return missionValue(m, s) >= m.target;
}

// 抽本局考核:前期只给简单目标;解锁手枪后才可能抽到击毁;玩得多了再给高难目标
export function pickRunMission(p: Progress, rng: () => number): RunMission {
  const pool: RunMission[] = [ALL[0], ALL[1]];
  if (p.totalRuns >= 1) pool.push(ALL[2]);
  if (p.totalRuns >= 3) pool.push(ALL[3]);
  if (p.totalRuns >= 5) pool.push(ALL[5]);
  if (p.totalRuns >= 8) pool.push(ALL[6]);
  if (p.owned.includes('pistol')) pool.push(ALL[4]);
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

export const MISSIONS = ALL;
