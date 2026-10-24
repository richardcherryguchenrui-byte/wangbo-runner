// 存档成长系统:银币、累计翻越、称号、皮肤、挂件、手枪、升级、统计
// 所有数据保存在 localStorage,跨局持久
// 载入时浅合并默认值:新增字段不会重置老玩家的存档(银币永不丢失)
import { PISTOL_BULLETS_PER_RUN, PISTOL_BULLETS_PER_LEVEL } from '../config/constants';

export type PendantId = '' | 'star' | 'crown' | 'briefcase' | 'medal' | 'scale' | 'trophy';

export interface DailyState {
  date: string;      // 归属日期 'YYYY-MM-DD'(本地时区)
  dodged: number;    // 当日累计翻越
  surviveMs: number; // 当日单局最长存活
  kills: number;     // 当日累计击毁
  picked: number;    // 当日累计拾取道具
  claimed: boolean;  // 当日奖励是否已领取
  /** 当日家产建设次数(含人脉) */
  assetBuys?: number;
  /** 当日躲过/摆平的纪检委审查次数 */
  audits?: number;
}

export interface Progress {
  coins: number;          // 银币(翻越障碍获得)
  totalDodged: number;    // 累计翻越障碍数(决定称号)
  owned: string[];        // 已拥有物品 id
  pendant: PendantId;     // 当前装备的挂件
  extraLives: number;     // 已解锁的额外初始生命(0~3)
  skin: string;           // 当前使用的主角皮肤:''=原角色,'qitongwei'=祁同伟,'night'/'gold'/'inferno'
  bribeMoon: number;      // 顾教授的贿月库存(消耗品,500银币/个)
  // ---- v2 新增字段(缺失时由 defaults 补齐,老存档自动迁移) ----
  saveVersion: number;    // 存档结构版本号
  bestTimeMs: number;     // 最佳存活(毫秒,自 v1 独立 key 迁移)
  bestDodged: number;     // 单局最多翻越
  bestCombo: number;      // 单局最高连击
  totalRuns: number;      // 累计局数
  totalTimeMs: number;    // 累计游玩毫秒
  totalKills: number;     // 累计手枪击毁
  totalPickups: number;   // 累计拾取道具
  totalSpent: number;     // 累计消费银币
  inspectionsSurvived: number; // 累计平安度过巡视组次数
  achievements: string[]; // 已获得成就 id
  daily: DailyState | null;
  lastLoginDate: string;  // 上次登录日期(签到用)
  loginStreak: number;    // 连续签到天数
  pistolLevel: number;    // 手枪升级 0~2(弹容量 3/5/7)
  bribeCarryLevel: number;// 贿月携带升级 0~1(3/5 个)
  tutorialDone: boolean;  // 新手引导是否完成
  bestRankIndex: number;  // 单局最高官阶(0=科员)
  missionsDone: number;   // 累计完成本局考核次数
  overdrives: number;     // 累计进入高光时刻次数
  nearMisses: number;     // 累计擦身而过次数
  dailyPlays: number;     // 每日挑战参与次数
  // ---- 闯关模式 ----
  levelStars: Record<string, number>; // 每关最高星数(关卡 id → 0~3)
  levelClears: number;                // 累计通关次数(含重复刷)
  perfectSlides: number;              // 累计完美滑铲次数
  starMilestones: number[];           // 已领取的星级里程碑(存星数阈值)
  dungeonCleared: Record<string, number>; // 留置室横版关卡通关次数(关卡 id → 次数)
  /** 宽大处理额度:在留置室交代成功后攒下,下一局主线关卡多给几顶乌纱帽 */
  redeemBonus: number;
  // ---- 贪官养成 ----
  assets: Record<string, number>;   // 贪污资产等级(资产 id → 等级)
  network: Record<string, number>;  // 人脉等级(人脉 id → 等级)
  laundered: number;                // 洗白累计抵掉的风险
  lastAccrualAt: number;            // 上次收益结算时间戳(离线收益用)
  lastAuditAt: number;              // 上次纪检委审查时间戳
  auditsSurvived: number;           // 累计躲过的审查次数
  assetsSeized: number;             // 累计被没收的资产次数
  assetsIntroDone: boolean;         // 家产界面首次引导是否看过
  /** 黑金(赃款):产业产出,用于升级产业、打点、洗白;与跑酷的银币完全分开 */
  corrupt: number;
}

const KEY = 'wangboProgress';
export const SAVE_VERSION = 2;

// 初始生命升级:每级需要的累计翻越数逐级递增
export const LIFE_UPGRADE_THRESHOLDS = [100, 300, 600];
export const MAX_EXTRA_LIVES = LIFE_UPGRADE_THRESHOLDS.length;

export function nextLifeThreshold(p: Progress): number | null {
  return p.extraLives < MAX_EXTRA_LIVES ? LIFE_UPGRADE_THRESHOLDS[p.extraLives] : null;
}

// 祁同伟皮肤:需要累计翻越 1000 个障碍解锁
export const SKIN_QITONGWEI_REQUIREMENT = 1000;

// 手枪/携带升级
export const PISTOL_UPGRADE_PRICES = [200, 400];  // pistolLevel 0→1→2
export const BRIBE_UPGRADE_PRICES = [300];        // bribeCarryLevel 0→1

function defaults(): Progress {
  return {
    coins: 0, totalDodged: 0, owned: [], pendant: '', extraLives: 0, skin: '', bribeMoon: 0,
    saveVersion: SAVE_VERSION,
    bestTimeMs: 0, bestDodged: 0, bestCombo: 0,
    totalRuns: 0, totalTimeMs: 0, totalKills: 0, totalPickups: 0, totalSpent: 0,
    inspectionsSurvived: 0,
    achievements: [], daily: null,
    lastLoginDate: '', loginStreak: 0,
    pistolLevel: 0, bribeCarryLevel: 0,
    tutorialDone: false,
    bestRankIndex: 0, missionsDone: 0, overdrives: 0, nearMisses: 0, dailyPlays: 0,
    levelStars: {}, levelClears: 0, perfectSlides: 0, starMilestones: [], dungeonCleared: {}, redeemBonus: 0,
    assets: {}, network: {}, laundered: 0,
    lastAccrualAt: 0, lastAuditAt: 0, auditsSurvived: 0, assetsSeized: 0,
    assetsIntroDone: false, corrupt: 0
  };
}

export function loadProgress(): Progress {
  let p: Progress = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = { ...defaults(), ...JSON.parse(raw) };
  } catch {}
  // 迁移:旧版本最佳成绩存在独立 key 'bestTimeMs',并入新存档(幂等,只取更大值)
  try {
    const legacy = Number(localStorage.getItem('bestTimeMs') || '0');
    if (legacy && legacy > (p.bestTimeMs || 0)) {
      p.bestTimeMs = legacy;
      saveProgress(p);
    }
  } catch {}
  p.saveVersion = SAVE_VERSION;
  return p;
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// 称号:按累计翻越数解锁,每级 1000 个障碍
export function getTitle(totalDodged: number): string {
  if (totalDodged >= 4000) return '厅长';
  if (totalDodged >= 3000) return '局长';
  if (totalDodged >= 2000) return '处长';
  if (totalDodged >= 1000) return '科长';
  return '科员';
}

// 称号里程碑(用于展示下一级目标)
export const TITLE_MILESTONES: [number, string][] = [
  [1000, '科长'], [2000, '处长'], [3000, '局长'], [4000, '厅长']
];

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'pistol' | 'pendant' | 'life' | 'skin' | 'pistolup' | 'bribeup';
  pendant?: PendantId;
  skin?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'life', name: '初始生命 +1', desc: '每级需更多累计翻越', price: 0, kind: 'life' },
  { id: 'skin-qitongwei', name: '皮肤 · 祁同伟', desc: '累计翻越 1000 解锁', price: 0, kind: 'skin', skin: 'qitongwei' },
  { id: 'pistol', name: '反腐手枪', desc: '每局 3 发子弹,射击摧毁障碍', price: 30, kind: 'pistol' },
  { id: 'pistol-up', name: '弹容量升级', desc: '每级 +2 发子弹', price: 0, kind: 'pistolup' },
  { id: 'bribe-up', name: '贿月扩容', desc: '每局携带上限 3→5 个', price: 0, kind: 'bribeup' },
  { id: 'skin-night', name: '皮肤 · 夜行侠', desc: '深蓝染色,夜间潜行', price: 200, kind: 'skin', skin: 'night' },
  { id: 'skin-gold', name: '皮肤 · 金身王博', desc: '金光护体,富贵逼人', price: 400, kind: 'skin', skin: 'gold' },
  { id: 'skin-inferno', name: '皮肤 · 赤焰王博', desc: '赤焰加身,火力全开', price: 800, kind: 'skin', skin: 'inferno' },
  { id: 'pendant-star', name: '反弹之星', desc: '头顶显示星星挂件', price: 25, kind: 'pendant', pendant: 'star' },
  { id: 'pendant-medal', name: '勋章挂件', desc: '头顶显示勋章挂件', price: 45, kind: 'pendant', pendant: 'medal' },
  { id: 'pendant-briefcase', name: '连结之包', desc: '头顶显示公文包挂件', price: 35, kind: 'pendant', pendant: 'briefcase' },
  { id: 'pendant-crown', name: '反复之官', desc: '头顶显示皇冠挂件', price: 60, kind: 'pendant', pendant: 'crown' },
  { id: 'pendant-scale', name: '天平挂件', desc: '头顶显示天平挂件', price: 120, kind: 'pendant', pendant: 'scale' },
  { id: 'pendant-trophy', name: '冠军奖杯', desc: '头顶显示奖杯挂件', price: 300, kind: 'pendant', pendant: 'trophy' }
];

export const PENDANT_TEXTURE: Record<PendantId, string> = {
  '': '', star: 'pendant-star', crown: 'pendant-crown', briefcase: 'pendant-briefcase',
  medal: 'pendant-medal', scale: 'pendant-scale', trophy: 'pendant-trophy'
};

export function hasPistol(p: Progress): boolean {
  return p.owned.includes('pistol');
}

// 每局起始子弹数(随升级增长)
export function bulletsPerRun(p: Progress): number {
  return PISTOL_BULLETS_PER_RUN + p.pistolLevel * PISTOL_BULLETS_PER_LEVEL;
}

// 贿月每局携带上限(随升级增长)
export function bribeCarryLimit(p: Progress): number {
  return 3 + p.bribeCarryLevel * 2;
}

// 是否装备了皮肤(非默认、非祁同伟)
export function activeSkin(p: Progress): string {
  return p.skin === 'qitongwei' ? '' : p.skin;
}
