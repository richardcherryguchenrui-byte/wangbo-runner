// 每日任务 + 连续签到:按本地日期翻转,数据存在存档的 daily 字段
import type { DailyState, Progress } from './progress';

export interface DailyTask {
  id: string;
  name: string;
  target: number;
  reward: number;
  unit: string; // 显示单位:个 / 秒 / 次
  get(p: DailyState): number;
}

export const DAILY_TASKS: DailyTask[] = [
  { id: 'dodge', name: '翻越障碍', target: 30, reward: 20, unit: '个', get: d => d.dodged },
  { id: 'survive', name: '单局存活', target: 45, reward: 25, unit: '秒', get: d => Math.floor(d.surviveMs / 1000) },
  { id: 'kill', name: '击毁障碍', target: 5, reward: 20, unit: '个', get: d => d.kills },
  { id: 'pickup', name: '拾取道具', target: 3, reward: 15, unit: '个', get: d => d.picked },
  { id: 'build', name: '添置产业', target: 2, reward: 25, unit: '次', get: d => d.assetBuys ?? 0 },
  { id: 'audit', name: '摆平一次审查', target: 1, reward: 30, unit: '次', get: d => d.audits ?? 0 }
];

// 全部完成的额外奖励
export const DAILY_ALL_BONUS = 40;

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

// 取今天的任务状态(跨天自动重置)
export function getDaily(p: Progress): DailyState {
  const today = todayStr();
  if (!p.daily || p.daily.date !== today) {
    p.daily = { date: today, dodged: 0, surviveMs: 0, kills: 0, picked: 0, claimed: false, assetBuys: 0, audits: 0 };
  }
  return p.daily;
}

// 一局结束更新当日任务(仅累加/取最大值,由调用方 saveProgress)
export function updateDailyFromRun(p: Progress, run: { dodged: number; surviveMs: number; kills: number; picked: number }) {
  const d = getDaily(p);
  d.dodged += run.dodged;
  d.surviveMs = Math.max(d.surviveMs, run.surviveMs);
  d.kills += run.kills;
  d.picked += run.picked;
}

export function dailyCompletedCount(d: DailyState): number {
  return DAILY_TASKS.filter(t => t.get(d) >= t.target).length;
}

export function dailyAllDone(d: DailyState): boolean {
  return DAILY_TASKS.every(t => t.get(d) >= t.target);
}

// 领取每日奖励:返回获得的银币数(0 = 不可领取)
export function claimDailyReward(p: Progress): number {
  const d = getDaily(p);
  if (d.claimed || !dailyAllDone(d)) return 0;
  d.claimed = true;
  const total = DAILY_TASKS.reduce((s, t) => s + t.reward, 0) + DAILY_ALL_BONUS;
  p.coins += total;
  return total;
}

// 签到:每天首次登录 +20,连续 7 天额外 +100
// 返回 { signed, streak, coins }(coins 为本轮签到获得的银币)
export function checkIn(p: Progress): { signed: boolean; streak: number; coins: number } {
  const today = todayStr();
  if (p.lastLoginDate === today) return { signed: false, streak: p.loginStreak, coins: 0 };
  p.loginStreak = p.lastLoginDate === yesterdayStr() ? p.loginStreak + 1 : 1;
  p.lastLoginDate = today;
  const coins = 20 + (p.loginStreak > 0 && p.loginStreak % 7 === 0 ? 100 : 0);
  p.coins += coins;
  return { signed: true, streak: p.loginStreak, coins };
}


/** 家产系统调用:记一次建设(买资产或结交人脉) */
export function noteAssetBuild(p: Progress, count = 1) {
  const d = getDaily(p);
  d.assetBuys = (d.assetBuys ?? 0) + count;
}

/** 家产系统调用:记一次摆平的审查 */
export function noteAuditHandled(p: Progress, count = 1) {
  const d = getDaily(p);
  d.audits = (d.audits ?? 0) + count;
}
