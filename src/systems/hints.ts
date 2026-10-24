// 「下一步做什么」提示:按优先级挑一条最该做的事,降低新系统的迷路感
// 纯函数,方便单测。
import type { Progress } from './progress';
import { totalAssetValue, netRisk } from './assets';
import { DAILY_TASKS, dailyAllDone, getDaily } from './daily';
import { LEVELS, isLevelUnlocked, totalStars } from './levels';

export interface NextStep {
  text: string;
  /** 点这条提示要去的场景 */
  scene: string;
  /** 提示语气:urgent 紧急 / normal 建议 */
  tone: 'urgent' | 'normal';
}

/** 挑一条最该做的事;没有可提示的就返回 null */
export function nextStep(p: Progress): NextStep | null {
  const holdings = {
    assets: p.assets ?? {},
    network: p.network ?? {},
    laundered: p.laundered ?? 0
  };

  // 1) 风险过高:优先救命
  const risk = netRisk(holdings);
  if (risk >= 60) {
    return { text: `被查风险 ${risk} · 去洗白或养人脉`, scene: 'Assets', tone: 'urgent' };
  }

  // 2) 每日奖励可领
  try {
    const daily = getDaily(p);
    if (!daily.claimed && dailyAllDone(daily)) {
      return { text: '今日任务已全部完成 · 去领奖励', scene: 'Quest', tone: 'urgent' };
    }
  } catch { /* 忽略 */ }

  // 3) 一项家产都没有:教他养成
  if (totalAssetValue(holdings) === 0) {
    return { text: '去家产界面盖第一项产业,离线也生钱', scene: 'Assets', tone: 'normal' };
  }

  // 4) 还有没通关的主线关卡
  const cleared = LEVELS.filter(l => (p.levelStars[l.id] ?? 0) > 0).length;
  const nextLevel = LEVELS.find(l => isLevelUnlocked(l.id, p.levelStars ?? {}) && (p.levelStars[l.id] ?? 0) === 0);
  if (nextLevel) {
    return {
      text: `第${nextLevel.chapter + 1}章「${nextLevel.name}」还没过 · 已通关 ${cleared}/${LEVELS.length}`,
      scene: 'Campaign',
      tone: 'normal'
    };
  }

  // 5) 星星没刷满
  const stars = totalStars(p.levelStars ?? {});
  if (stars < LEVELS.length * 3) {
    return { text: `还差 ${LEVELS.length * 3 - stars} 颗星 · 回头刷三星`, scene: 'Campaign', tone: 'normal' };
  }

  // 6) 都做完了:提示每日任务
  const todo = DAILY_TASKS.length;
  if (todo > 0) return { text: '主线满星了 · 去把今日任务清一清', scene: 'Quest', tone: 'normal' };
  return null;
}
