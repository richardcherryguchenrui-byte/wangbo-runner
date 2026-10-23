// 障碍编排:从「纯随机单障碍」升级为有节奏的手工 Pattern
// 目标:前期松弛、中期组合、后期需要滑铲/二段跳;同时保证最小反应间距,不做阴间关卡。
// 本模块不依赖 Phaser,方便单元测试。

export interface PatternObstacle {
  at: number;          // 相对本次生成起点的横向距离(px)
  flyer: boolean;      // 低空飞行障碍(需要滑铲或起跳)
  key: string;
  warn?: boolean;
}

export interface PatternCoin {
  at: number;
  dy: number;          // 相对地面的高度(负数向上)
}

export interface RunPattern {
  name: string;
  obstacles: PatternObstacle[];
  coins: PatternCoin[];
  pickupAt?: number;   // 若有,在此偏移放置一个随机道具
  spanPx: number;      // 最后一个元素之后还需要预留的距离
  gapSec: number;      // 之后再过多久出现下一组
}

const GROUND_KEYS = ['ob-gold', 'ob-redpacket', 'ob-treasure', 'ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'];
const FLYER_MIN = -128;
const FLYER_MAX = -108;
export // 低空美女的底边高度:站姿会撞头,滑铲(48px 高)刚好从下方钻过
const FLYER_Y = -58;

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}

function coinArc(start: number, end: number, count: number, baseDy: number, peakDy: number): PatternCoin[] {
  const out: PatternCoin[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const at = start + (end - start) * t;
    const dy = baseDy + (peakDy - baseDy) * Math.sin(t * Math.PI);
    out.push({ at, dy });
  }
  return out;
}

function coinLine(start: number, end: number, count: number, dy: number): PatternCoin[] {
  const out: PatternCoin[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ at: start + (end - start) * (i / Math.max(1, count - 1)), dy });
  }
  return out;
}

export interface PatternOptions {
  rng: () => number;
  elapsedMs: number;
  speed: number;
  /** 上组是什么(防止连续重复) */
  lastPattern?: string;
  /** 连续多少组是障碍组(用于强制插入喘息) */
  actionStreak?: number;
}

export function stageFor(elapsedMs: number): 0 | 1 | 2 | 3 {
  if (elapsedMs < 20000) return 0;
  if (elapsedMs < 45000) return 1;
  if (elapsedMs < 80000) return 2;
  return 3;
}

function baseGap(stage: number, rng: () => number): number {
  const base = stage === 0 ? 0.92 : stage === 1 ? 0.8 : stage === 2 ? 0.64 : 0.52;
  return base + rng() * 0.22;
}

function single(opts: PatternOptions): RunPattern {
  const { rng } = opts;
  // 前 20 秒不出低空美女,给新手熟悉跳跃的时间
  const flyer = stageFor(opts.elapsedMs) >= 1 && rng() < 0.22;
  const at = 0;
  const key = flyer ? pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng) : pick(GROUND_KEYS, rng);
  const coins = rng() < 0.58
    ? coinArc(-40, 220, 6, -110, -205)
    : [];
  return {
    name: flyer ? 'single-flyer' : 'single',
    obstacles: [{ at, flyer, key, warn: flyer }],
    coins,
    pickupAt: rng() < 0.14 ? 180 : undefined,
    spanPx: 260,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng)
  };
}

function double(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const gap = Math.max(300, speed * (0.92 + rng() * 0.1));
  const coins: PatternCoin[] = [
    ...coinArc(-30, 180, 5, -105, -190),
    ...coinArc(180 + gap * 0.4, gap + 240, 4, -105, -185)
  ];
  return {
    name: 'double',
    obstacles: [
      { at: 0, flyer: false, key: pick(GROUND_KEYS, rng) },
      { at: gap, flyer: false, key: pick(GROUND_KEYS, rng) }
    ],
    coins,
    spanPx: gap + 300,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.08
  };
}

function triple(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const gap = Math.max(300, speed * 0.9);
  return {
    name: 'triple',
    obstacles: [
      { at: 0, flyer: false, key: pick(GROUND_KEYS, rng) },
      { at: gap, flyer: false, key: pick(GROUND_KEYS, rng) },
      { at: gap * 2, flyer: false, key: pick(GROUND_KEYS, rng) }
    ],
    coins: coinArc(-30, gap * 2 + 200, 9, -120, -215),
    spanPx: gap * 2 + 300,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.25
  };
}

function flyer(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const coins = coinLine(-40, 220, 5, -46);
  return {
    name: 'flyer',
    obstacles: [{ at: 0, flyer: true, key: pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng), warn: true }],
    coins,
    spanPx: 280,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng)
  };
}

function flyerGround(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const gap = Math.max(420, speed * 1.12);
  return {
    name: 'flyer-ground',
    obstacles: [
      { at: 0, flyer: true, key: pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng), warn: true },
      { at: gap, flyer: false, key: pick(GROUND_KEYS, rng) }
    ],
    coins: [
      ...coinLine(-30, 140, 3, -46),
      ...coinArc(gap - 80, gap + 210, 5, -120, -205)
    ],
    spanPx: gap + 300,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.12
  };
}

function groundFlyer(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const gap = Math.max(430, speed * 1.08);
  return {
    name: 'ground-flyer',
    obstacles: [
      { at: 0, flyer: false, key: pick(GROUND_KEYS, rng) },
      { at: gap, flyer: true, key: pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng), warn: true }
    ],
    coins: [
      ...coinArc(-30, 200, 5, -115, -200),
      ...coinLine(gap - 30, gap + 130, 3, -46)
    ],
    spanPx: gap + 300,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.2
  };
}

function doubleFlyer(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const gap = Math.max(360, speed * 0.88);
  return {
    name: 'double-flyer',
    obstacles: [
      { at: 0, flyer: true, key: pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng), warn: true },
      { at: gap, flyer: true, key: pick(['ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4'], rng), warn: true }
    ],
    coins: coinLine(-30, gap + 170, 7, -46),
    spanPx: gap + 280,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.22
  };
}

function coinRun(opts: PatternOptions): RunPattern {
  const { rng } = opts;
  const len = 360 + rng() * 180;
  return {
    name: 'coin-run',
    obstacles: [],
    coins: coinLine(0, len, 8, -95 + rng() * 30),
    pickupAt: rng() < 0.55 ? len * 0.6 : undefined,
    spanPx: len + 150,
    gapSec: 0.66 + rng() * 0.18
  };
}

function treasure(opts: PatternOptions): RunPattern {
  const { rng, speed } = opts;
  const at = 0;
  return {
    name: 'treasure',
    obstacles: [{ at, flyer: false, key: 'ob-treasure' }],
    coins: coinArc(-60, 260, 10, -100, -225),
    pickupAt: 300,
    spanPx: 420,
    gapSec: baseGap(stageFor(opts.elapsedMs), rng) + 0.1
  };
}

function breather(opts: PatternOptions): RunPattern {
  const { rng } = opts;
  return {
    name: 'breather',
    obstacles: [],
    coins: coinLine(0, 260, 4, -80),
    pickupAt: 230 + rng() * 60,
    spanPx: 330,
    gapSec: 0.64 + rng() * 0.14
  };
}

type Builder = (o: PatternOptions) => RunPattern;

export function generatePattern(opts: PatternOptions): RunPattern {
  const stage = stageFor(opts.elapsedMs);
  const { rng } = opts;
  const streak = opts.actionStreak ?? 0;

  // 连续打了 3 组障碍后,高概率给一段喘息 + 银币线,避免压力单调
  if (streak >= 3 && rng() < 0.62) {
    return rng() < 0.45 ? breather(opts) : coinRun(opts);
  }
  if (streak >= 5) return breather(opts);

  const pools: Record<number, { fn: Builder; w: number; name: string }[]> = {
    0: [
      { fn: single, w: 80, name: 'single' },
      { fn: coinRun, w: 13, name: 'coin-run' },
      { fn: breather, w: 7, name: 'breather' }
    ],
    1: [
      { fn: single, w: 30, name: 'single' },
      { fn: double, w: 20, name: 'double' },
      { fn: flyer, w: 18, name: 'flyer' },
      { fn: coinRun, w: 17, name: 'coin-run' },
      { fn: treasure, w: 8, name: 'treasure' },
      { fn: breather, w: 7, name: 'breather' }
    ],
    2: [
      { fn: single, w: 17, name: 'single' },
      { fn: double, w: 20, name: 'double' },
      { fn: flyer, w: 16, name: 'flyer' },
      { fn: flyerGround, w: 15, name: 'flyer-ground' },
      { fn: groundFlyer, w: 10, name: 'ground-flyer' },
      { fn: coinRun, w: 10, name: 'coin-run' },
      { fn: treasure, w: 7, name: 'treasure' },
      { fn: breather, w: 5, name: 'breather' }
    ],
    3: [
      { fn: single, w: 10, name: 'single' },
      { fn: double, w: 17, name: 'double' },
      { fn: triple, w: 9, name: 'triple' },
      { fn: flyer, w: 12, name: 'flyer' },
      { fn: flyerGround, w: 16, name: 'flyer-ground' },
      { fn: groundFlyer, w: 13, name: 'ground-flyer' },
      { fn: doubleFlyer, w: 8, name: 'double-flyer' },
      { fn: coinRun, w: 7, name: 'coin-run' },
      { fn: treasure, w: 5, name: 'treasure' },
      { fn: breather, w: 3, name: 'breather' }
    ]
  };

  const pool = pools[stage].filter(p => p.name !== opts.lastPattern || poolOnlyOne(pools[stage]));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let roll = rng() * total;
  let chosen = pool[0];
  for (const p of pool) {
    if (roll < p.w) { chosen = p; break; }
    roll -= p.w;
  }
  return chosen.fn(opts);
}

function poolOnlyOne(pool: { name: string }[]): boolean {
  return pool.length <= 1;
}
