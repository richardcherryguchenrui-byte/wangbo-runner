// 闯关模式 ·「官场现形记」
// 6 章 × 3 关:每关固定时长,活到最后就算通关(1 星),
// 另有 2 个进阶目标(擦身 / 完美滑铲 / 连击 / 无伤)凑满 3 星。
// 章节按累计星数解锁,逼玩家回头刷星 —— 这是闯关模式的上瘾核心。
//
// 本模块不依赖 Phaser,方便单元测试。

export type StarGoalKind = 'dodge' | 'nearmiss' | 'perfectSlide' | 'combo' | 'noHit' | 'coins';

export interface StarGoal {
  kind: StarGoalKind;
  target: number;
  label: string;
}

export interface LevelDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  /** 一句官场梗,关卡选择页展示 */
  flavor: string;
  /** 通关所需存活时长 */
  durationMs: number;
  speedStart: number;
  speedEnd: number;
  /** 首次通关银币 */
  rewardFirst: number;
  /** 每颗星额外银币 */
  rewardStar: number;
  /** 两个进阶目标(通关本身算第 1 颗星) */
  goals: [StarGoal, StarGoal];
  /** 巡视组(纪委)来袭时刻;不填则按默认节奏 */
  bossAtMs?: number;
  /** 关卡内的节奏压缩系数:越大越快出现低空美女等进阶障碍 */
  stageSpeed: number;
}

export interface ChapterDef {
  index: number;
  name: string;
  tagline: string;
  /** 进入本章所需的累计星数 */
  requireStars: number;
}

export const CHAPTERS: ChapterDef[] = [
  { index: 0, name: '秘书起步', tagline: '端茶倒水,先把人做稳', requireStars: 0 },
  { index: 1, name: '迎来送往', tagline: '酒桌上一句话能定前程', requireStars: 2 },
  { index: 2, name: '工程发包', tagline: '标书里夹着信封', requireStars: 5 },
  { index: 3, name: '人事任命', tagline: '谁上谁下,看你会不会站', requireStars: 9 },
  { index: 4, name: '巡视风暴', tagline: '会议室气氛变了', requireStars: 14 },
  { index: 5, name: '落马时刻', tagline: '凌晨的门铃声', requireStars: 20 }
];

function lv(
  chapter: number,
  index: number,
  name: string,
  flavor: string,
  durationMs: number,
  speed: [number, number],
  goals: [StarGoal, StarGoal],
  opts: { bossAtMs?: number; stageSpeed?: number; rewardFirst?: number } = {}
): LevelDef {
  return {
    id: `l${chapter + 1}-${index + 1}`,
    chapter,
    index,
    name,
    flavor,
    durationMs,
    speedStart: speed[0],
    speedEnd: speed[1],
    rewardFirst: opts.rewardFirst ?? 40 + chapter * 25 + index * 10,
    rewardStar: 6 + chapter * 3,
    goals,
    bossAtMs: opts.bossAtMs,
    stageSpeed: opts.stageSpeed ?? 2.2 + chapter * 0.28
  };
}

export const LEVELS: LevelDef[] = [
  // ---- 第一章 · 秘书起步 ----
  lv(0, 0, '端茶倒水', '别碰倒领导那杯茶', 22000, [280, 360],
    [{ kind: 'dodge', target: 8, label: '翻越 8 个诱惑' },
     { kind: 'nearmiss', target: 1, label: '擦身而过 1 次' }],
    { stageSpeed: 1.6 }),
  lv(0, 1, '材料专家', '一份材料改八遍', 25000, [300, 400],
    [{ kind: 'dodge', target: 12, label: '翻越 12 个诱惑' },
     { kind: 'combo', target: 8, label: '连击 ×8' }],
    { stageSpeed: 1.9 }),
  lv(0, 2, '酒桌文化', '敬酒要快,躲酒要稳', 28000, [310, 420],
    [{ kind: 'nearmiss', target: 2, label: '擦身而过 2 次' },
     { kind: 'noHit', target: 1, label: '全程不受伤' }],
    { stageSpeed: 2.1 }),

  // ---- 第二章 · 迎来送往 ----
  lv(1, 0, '红包往来', '收下还是退回,全看手速', 28000, [330, 450],
    [{ kind: 'dodge', target: 16, label: '翻越 16 个诱惑' },
     { kind: 'nearmiss', target: 3, label: '擦身而过 3 次' }],
    { stageSpeed: 2.4 }),
  lv(1, 1, '饭局排位', '主陪副陪,一步都不能错', 30000, [340, 470],
    [{ kind: 'combo', target: 10, label: '连击 ×10' },
     { kind: 'perfectSlide', target: 2, label: '完美滑铲 2 次' }],
    { stageSpeed: 3.0 }),
  lv(1, 2, '车改之后', '公车私用,躲开巡视', 32000, [350, 490],
    [{ kind: 'nearmiss', target: 4, label: '擦身而过 4 次' },
     { kind: 'coins', target: 60, label: '单局 60 银币' }],
    { stageSpeed: 3.2, bossAtMs: 24000 }),

  // ---- 第三章 · 工程发包 ----
  lv(2, 0, '项目上马', '标书里夹着信封', 32000, [370, 510],
    [{ kind: 'dodge', target: 20, label: '翻越 20 个诱惑' },
     { kind: 'perfectSlide', target: 3, label: '完美滑铲 3 次' }],
    { stageSpeed: 3.0 }),
  lv(2, 1, '拆迁现场', '钉子户与关系户', 34000, [380, 530],
    [{ kind: 'combo', target: 12, label: '连击 ×12' },
     { kind: 'nearmiss', target: 5, label: '擦身而过 5 次' }],
    { stageSpeed: 3.2, bossAtMs: 26000 }),
  lv(2, 2, '审计来访', '账本要经得起翻', 36000, [390, 550],
    [{ kind: 'perfectSlide', target: 4, label: '完美滑铲 4 次' },
     { kind: 'noHit', target: 1, label: '全程不受伤' }],
    { stageSpeed: 3.4 }),

  // ---- 第四章 · 人事任命 ----
  lv(3, 0, '提拔名单', '谁上谁下,一纸定生死', 36000, [400, 570],
    [{ kind: 'dodge', target: 24, label: '翻越 24 个诱惑' },
     { kind: 'combo', target: 14, label: '连击 ×14' }],
    { stageSpeed: 3.4 }),
  lv(3, 1, '组织谈话', '说真话说假话', 38000, [410, 590],
    [{ kind: 'nearmiss', target: 6, label: '擦身而过 6 次' },
     { kind: 'perfectSlide', target: 5, label: '完美滑铲 5 次' }],
    { stageSpeed: 3.6, bossAtMs: 28000 }),
  lv(3, 2, '民主测评', '票数要凑齐,人心要稳住', 40000, [420, 610],
    [{ kind: 'coins', target: 90, label: '单局 90 银币' },
     { kind: 'noHit', target: 1, label: '全程不受伤' }],
    { stageSpeed: 3.8 }),

  // ---- 第五章 · 巡视风暴 ----
  lv(4, 0, '巡视组进驻', '会议室空气一下子冷了', 40000, [430, 630],
    [{ kind: 'dodge', target: 28, label: '翻越 28 个诱惑' },
     { kind: 'perfectSlide', target: 6, label: '完美滑铲 6 次' }],
    { stageSpeed: 3.8, bossAtMs: 30000 }),
  lv(4, 1, '谈话函询', '一句一句往回问', 42000, [440, 650],
    [{ kind: 'nearmiss', target: 7, label: '擦身而过 7 次' },
     { kind: 'combo', target: 16, label: '连击 ×16' }],
    { stageSpeed: 4.0, bossAtMs: 26000 }),
  lv(4, 2, '线索移交', '举报信堆成了山', 44000, [450, 670],
    [{ kind: 'perfectSlide', target: 8, label: '完美滑铲 8 次' },
     { kind: 'coins', target: 120, label: '单局 120 银币' }],
    { stageSpeed: 4.2, bossAtMs: 22000 }),

  // ---- 第六章 · 落马时刻 ----
  lv(5, 0, '双规通知', '凌晨四点,门铃响了', 44000, [460, 690],
    [{ kind: 'dodge', target: 32, label: '翻越 32 个诱惑' },
     { kind: 'noHit', target: 1, label: '全程不受伤' }],
    { stageSpeed: 4.2, bossAtMs: 20000 }),
  lv(5, 1, '留置期间', '时间过得很慢', 46000, [470, 710],
    [{ kind: 'nearmiss', target: 8, label: '擦身而过 8 次' },
     { kind: 'perfectSlide', target: 9, label: '完美滑铲 9 次' }],
    { stageSpeed: 4.4, bossAtMs: 18000 }),
  lv(5, 2, '最后陈述', '这一路,值得吗', 48000, [480, 740],
    [{ kind: 'combo', target: 20, label: '连击 ×20' },
     { kind: 'coins', target: 150, label: '单局 150 银币' }],
    { stageSpeed: 4.6, bossAtMs: 16000 })
];

export const MAX_STARS_PER_LEVEL = 3;
export const TOTAL_STARS = LEVELS.length * MAX_STARS_PER_LEVEL;

export interface LevelStats {
  cleared: boolean;
  timeMs: number;
  dodged: number;
  nearMisses: number;
  perfectSlides: number;
  comboMax: number;
  hits: number;
  coins: number;
}

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find(l => l.id === id);
}

export function chapterOf(level: LevelDef): ChapterDef {
  return CHAPTERS[level.chapter];
}

export function goalValue(goal: StarGoal, stats: LevelStats): number {
  switch (goal.kind) {
    case 'dodge': return stats.dodged;
    case 'nearmiss': return stats.nearMisses;
    case 'perfectSlide': return stats.perfectSlides;
    case 'combo': return stats.comboMax;
    case 'coins': return stats.coins;
    case 'noHit': return stats.hits === 0 ? 1 : 0;
  }
}

export function goalDone(goal: StarGoal, stats: LevelStats): boolean {
  return goalValue(goal, stats) >= goal.target;
}

/** 0~3 星:通关 1 星,达成两个目标各加 1 星;未通关 0 星 */
export function starCount(level: LevelDef, stats: LevelStats): number {
  if (!stats.cleared) return 0;
  let stars = 1;
  if (goalDone(level.goals[0], stats)) stars += 1;
  if (goalDone(level.goals[1], stats)) stars += 1;
  return stars;
}

export function totalStars(levelStars: Record<string, number>): number {
  return LEVELS.reduce((sum, l) => sum + (levelStars[l.id] ?? 0), 0);
}

/** 关卡按顺序解锁:第一章第一关永远开放,其余需要上一关至少 1 星 */
export function isLevelUnlocked(id: string, levelStars: Record<string, number>): boolean {
  const idx = LEVELS.findIndex(l => l.id === id);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = LEVELS[idx - 1];
  return (levelStars[prev.id] ?? 0) >= 1;
}

/** 章节解锁:上一章最后一关通关 + 累计星数达标 */
export function isChapterUnlocked(chapter: number, levelStars: Record<string, number>): boolean {
  const ch = CHAPTERS[chapter];
  if (!ch) return false;
  if (totalStars(levelStars) < ch.requireStars) return false;
  if (chapter === 0) return true;
  return isLevelUnlocked(chapterFirstLevelId(chapter), levelStars);
}

export function chapterFirstLevelId(chapter: number): string {
  const first = LEVELS.find(l => l.chapter === chapter);
  return first ? first.id : '';
}

export function nextLevelId(id: string): string | null {
  const idx = LEVELS.findIndex(l => l.id === id);
  if (idx < 0 || idx + 1 >= LEVELS.length) return null;
  return LEVELS[idx + 1].id;
}

/** 关卡内速度曲线:从 speedStart 线性升到 speedEnd */
export function levelSpeedAt(level: LevelDef, elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / Math.max(1, level.durationMs)));
  return level.speedStart + (level.speedEnd - level.speedStart) * t;
}

/** 剩余时间(毫秒,不小于 0) */
export function remainingMs(level: LevelDef, elapsedMs: number): number {
  return Math.max(0, level.durationMs - elapsedMs);
}

/** 关卡通关后的银币奖励:首次通关额外给一笔 */
export function levelReward(level: LevelDef, stars: number, firstClear: boolean): number {
  const base = stars * level.rewardStar;
  return base + (firstClear ? level.rewardFirst : 0);
}

// ============================================================
// 星级里程碑:累计星数换实物奖励,给「回头刷星」一个看得见的终点
// ============================================================

export interface StarMilestone {
  stars: number;
  coins: number;
  bribeMoon?: number;
  label: string;
}

export const STAR_MILESTONES: StarMilestone[] = [
  { stars: 5, coins: 60, label: '初露头角' },
  { stars: 10, coins: 100, bribeMoon: 1, label: '小有门路' },
  { stars: 18, coins: 140, bribeMoon: 1, label: '半个圈内人' },
  { stars: 27, coins: 200, bribeMoon: 2, label: '说得上话' },
  { stars: 36, coins: 260, bribeMoon: 2, label: '手眼通天' },
  { stars: 45, coins: 320, bribeMoon: 3, label: '一路绿灯' },
  { stars: 54, coins: 500, bribeMoon: 3, label: '全身而退 · 查无此人' }
];

/** 本次从 prevTotal 涨到 newTotal,跨过了哪些里程碑(用于发放奖励) */
export function newlyReachedMilestones(prevTotal: number, newTotal: number): StarMilestone[] {
  return STAR_MILESTONES.filter(m => m.stars > prevTotal && m.stars <= newTotal);
}

/** 下一个还没拿到的里程碑(展示用) */
export function nextMilestone(totalStarsCount: number): StarMilestone | null {
  return STAR_MILESTONES.find(m => m.stars > totalStarsCount) ?? null;
}

// ============================================================
// 结局文案:通关与落马都分档,失败也要有戏
// ============================================================

const CLEAR_LINES = [
  '勉强上岸,冷汗一身',
  '平安落地,履历干净',
  '一路顺风顺水,查无此人'
];

/** 通关文案:按星级分档(1~3 星) */
export function clearLine(stars: number): string {
  const idx = Math.min(CLEAR_LINES.length - 1, Math.max(0, stars - 1));
  return CLEAR_LINES[idx];
}

// 每章三种落马说法,按「推进到哪一步」挑一句
const LANDFALL_LINES: string[][] = [
  ['刚端起茶杯就被叫去谈话', '材料改到第八遍,人先烦了', '文件都归档了,人却没能下班'],
  ['酒还没敬到位,人先倒了', '红包塞回去的时候手抖了', '人都送到门口了,还差最后一句客套'],
  ['标书第一页就把名字写错了', '审计翻到第三页就停了下来', '标书都封好了,信封却掉在地上'],
  ['名单还没拟,自己先被划掉了', '组织谈话时话多说了半句', '名单就差最后一个名字没签'],
  ['巡视组一进门就点了你的名', '线索移交单上出现了自己的名字', '巡视组都准备走了,又被叫了回去'],
  ['凌晨的敲门声比闹钟还准时', '留置室的灯一直亮着', '最后一句陈述卡在喉咙里']
];

/**
 * 落马文案:ratio = 本关推进程度(0~1),越接近通关,说法越让人心疼。
 * 分三档:不到一半 / 过半 / 就差一点。
 */
export function landfallLine(level: LevelDef, ratio: number): string {
  const lines = LANDFALL_LINES[level.chapter] ?? LANDFALL_LINES[0];
  const tier = ratio < 0.5 ? 0 : ratio < 0.85 ? 1 : 2;
  return lines[tier];
}
