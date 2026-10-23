// 每日挑战:固定种子 + 今日规则,每天换一次;完成/破纪录发银币
// 数据独立存储,避免污染主存档;换设备丢失也无所谓。
import { DAILY_REWARD_FIRST, DAILY_REWARD_RECORD } from '../config/constants';
import { todayStr } from './daily';

export interface DailyModifier {
  id: string;
  name: string;
  desc: string;
  icon: string;
  speedMul: number;
  coinMul: number;
  livesDelta: number;
  inspectionFast: boolean;
}

const MODIFIERS: DailyModifier[] = [
  { id: 'speed', name: '极速晋升', desc: '跑速 +10%,银币 +15%', icon: '⚡', speedMul: 1.1, coinMul: 1.15, livesDelta: 0, inspectionFast: false },
  { id: 'redpacket', name: '红包雨', desc: '本局银币翻倍', icon: '🧧', speedMul: 1, coinMul: 2, livesDelta: 0, inspectionFast: false },
  { id: 'inspection', name: '巡视风暴', desc: '巡视组提前来袭,银币 +30%', icon: '🚨', speedMul: 1, coinMul: 1.3, livesDelta: 0, inspectionFast: true },
  { id: 'fragile', name: '一命通关', desc: '少一条命,银币 +50%', icon: '💔', speedMul: 1, coinMul: 1.5, livesDelta: -1, inspectionFast: false }
];

export interface DailyState {
  date: string;
  bestMs: number;
  plays: number;
  rewarded: boolean;
}

export interface DailyChallenge {
  date: string;
  seed: number;
  modifier: DailyModifier;
  state: DailyState;
}

// 每日规则对应的手绘图标(避免 emoji 跨平台差异)
export function dailyModifierIcon(id: string): string {
  if (id === 'speed') return 'ui-bolt';
  if (id === 'redpacket') return 'ui-envelope';
  if (id === 'inspection') return 'ui-siren';
  return 'ui-broken-heart';
}

const KEY = 'wangboDaily';

function hashDate(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

// 简单快速的确定性随机数(每日挑战 / 测试可复现)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function read(): DailyState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.date !== 'string') return null;
    return { date: v.date, bestMs: Number(v.bestMs) || 0, plays: Number(v.plays) || 0, rewarded: !!v.rewarded };
  } catch { return null; }
}

function write(s: DailyState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getDailyChallenge(): DailyChallenge {
  const date = todayStr();
  const seed = hashDate(date);
  let state = read();
  if (!state || state.date !== date) {
    state = { date, bestMs: 0, plays: 0, rewarded: false };
    write(state);
  }
  const modifier = MODIFIERS[seed % MODIFIERS.length];
  return { date, seed, modifier, state };
}

export interface DailyResult {
  reward: number;
  isRecord: boolean;
  firstToday: boolean;
  bestMs: number;
}

// 结算每日挑战:首次完成 +40;首次完成同时破纪录再 +40;之后只更新纪录不再发钱
export function recordDailyRun(timeMs: number): DailyResult {
  const dc = getDailyChallenge();
  const s = dc.state;
  const isRecord = timeMs > s.bestMs;
  const firstToday = !s.rewarded;
  let reward = 0;
  if (firstToday) reward += DAILY_REWARD_FIRST;
  if (isRecord && s.bestMs > 0) reward += DAILY_REWARD_RECORD;
  if (isRecord) s.bestMs = Math.round(timeMs);
  s.plays += 1;
  s.rewarded = true;
  write(s);
  return { reward, isRecord, firstToday, bestMs: s.bestMs };
}

// 仅供测试/调试:读取当前记录
export function peekDailyState(): DailyState | null {
  return read();
}

export const DAILY_MODIFIERS = MODIFIERS;
