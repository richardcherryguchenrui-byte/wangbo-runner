// 完美滑铲判定(纯逻辑,不依赖 Phaser,方便单测)
//
// 旧判定只看「躲过去的那一刻是不是正在滑铲」,而低空障碍本来就必须滑铲才能过,
// 于是只要躲掉就必然判定完美 —— 滑铲奖励等于白送。
//
// 新判定看「起滑时机」:低空障碍越近才起滑(卡点越准),才算完美;
// 提前很久滑下去、一路滑到障碍过去,只是普通翻越。

import {
  PERFECT_SLIDE_ETA_MS,
  PERFECT_SLIDE_OVERLAP_TOL_PX,
  NEAR_MISS_CLUTCH_ETA_MS
} from '../config/constants';

export interface SlideCandidate {
  /** 障碍前沿到玩家前沿的像素距离;负值 = 已经贴到/轻微重叠 */
  distanceToContact: number;
  flyer: boolean;
  counted: boolean;
  hit: boolean;
}

/** 起滑时刻还剩多少毫秒接触该障碍;负数(已接触)按 0 计 */
export function contactEtaMs(distanceToContact: number, speed: number): number {
  if (!(speed > 0)) return Number.POSITIVE_INFINITY;
  return (Math.max(0, distanceToContact) / speed) * 1000;
}

/**
 * 起滑瞬间的时机是否够「卡点」。
 * @param distanceToContact 障碍前沿到玩家前沿的距离(px),负值表示已贴近/轻微重叠
 * @param speed 当前跑速(障碍相对玩家的接近速度 px/s)
 */
export function isPerfectSlideTiming(
  distanceToContact: number,
  speed: number,
  windowMs: number = PERFECT_SLIDE_ETA_MS,
  overlapTolPx: number = PERFECT_SLIDE_OVERLAP_TOL_PX
): boolean {
  if (!(speed > 0) || !(windowMs > 0)) return false;
  // 障碍已经整个跑到身后(早就过去了),不算这次起滑的功劳
  if (distanceToContact < -Math.max(0, overlapTolPx)) return false;
  return contactEtaMs(distanceToContact, speed) <= windowMs;
}

/**
 * 从当前障碍里挑出这次起滑应该记「完美」的那一个:
 * 未命中、未计数的低空障碍中,接触时间在窗口内且最近的一个。
 * 返回候选下标,没有则返回 null。
 */
export function tightSlideIndex(
  candidates: SlideCandidate[],
  speed: number,
  windowMs: number = PERFECT_SLIDE_ETA_MS,
  overlapTolPx: number = PERFECT_SLIDE_OVERLAP_TOL_PX
): number | null {
  let best: number | null = null;
  let bestEta = Number.POSITIVE_INFINITY;
  candidates.forEach((c, i) => {
    if (!c.flyer || c.counted || c.hit) return;
    if (!isPerfectSlideTiming(c.distanceToContact, speed, windowMs, overlapTolPx)) return;
    const eta = contactEtaMs(c.distanceToContact, speed);
    if (eta < bestEta) {
      bestEta = eta;
      best = i;
    }
  });
  return best;
}

/**
 * 擦身而过也要「卡点」:不管跳还是滑,只有动作发生在贴脸那一瞬间才认。
 * 从当前障碍里挑出这次动作(跳/滑)应该记功劳的那一个 —— 不限种类(跳过的可能是高障碍)。
 */
export function clutchIndex(
  candidates: SlideCandidate[],
  speed: number,
  windowMs: number = NEAR_MISS_CLUTCH_ETA_MS,
  overlapTolPx: number = PERFECT_SLIDE_OVERLAP_TOL_PX
): number | null {
  let best: number | null = null;
  let bestEta = Number.POSITIVE_INFINITY;
  candidates.forEach((c, i) => {
    if (c.counted || c.hit) return;
    if (!isPerfectSlideTiming(c.distanceToContact, speed, windowMs, overlapTolPx)) return;
    const eta = contactEtaMs(c.distanceToContact, speed);
    if (eta < bestEta) {
      bestEta = eta;
      best = i;
    }
  });
  return best;
}
