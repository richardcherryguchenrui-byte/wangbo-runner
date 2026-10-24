// 贪官养成系统:贪污资产 + 人脉关系 + 纪检委审查
//
// 循环:跑酷/横版赚银币 → 建造资产(随时间产出银币) → 资产越高风险越高
//       → 用人脉压低风险、用银币洗白 → 躲过纪检委审查,资产继续生钱
//
// 本模块不依赖 Phaser,方便单元测试与平衡性调整。

export interface AssetDef {
  id: string;
  name: string;
  desc: string;
  /** 第一级造价 */
  baseCost: number;
  /** 每多一级造价乘以该系数 */
  costMul: number;
  /** 每级每分钟产出银币 */
  incomePerMin: number;
  /** 每级累积的「被查风险」 */
  risk: number;
  maxLevel: number;
}

/** 贪污资产:从「小金库」一路到「学区房炒房团」 */
export const ASSETS: AssetDef[] = [
  { id: 'purse', name: '小金库', desc: '抽屉里的现金,谁也不知道', baseCost: 60, costMul: 1.55, incomePerMin: 4, risk: 2, maxLevel: 8 },
  { id: 'villa', name: '情妇别墅', desc: '写在她名下,住着他的人', baseCost: 150, costMul: 1.6, incomePerMin: 10, risk: 4, maxLevel: 8 },
  { id: 'shell', name: '关联公司', desc: '左手批条子,右手接工程', baseCost: 320, costMul: 1.62, incomePerMin: 24, risk: 7, maxLevel: 8 },
  { id: 'mine', name: '干股煤矿', desc: '不出钱,只出批文', baseCost: 640, costMul: 1.65, incomePerMin: 55, risk: 11, maxLevel: 8 },
  { id: 'offshore', name: '海外账户', desc: '钱出去了,人还在国内', baseCost: 1200, costMul: 1.68, incomePerMin: 120, risk: 16, maxLevel: 6 },
  { id: 'estate', name: '学区房炒房团', desc: '一边批地,一边囤房', baseCost: 2400, costMul: 1.7, incomePerMin: 260, risk: 22, maxLevel: 6 }
];

export interface NetworkDef {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  costMul: number;
  /** 每级降低的风险 */
  protection: number;
  /** 每级提升的收益百分比 */
  incomeBonus: number;
  /** 每级提供「审查豁免」次数上限 */
  auditShield: number;
  maxLevel: number;
}

/** 人脉网络:老领导、秘书、财务、巡视组熟人、组织部长 */
export const NETWORK: NetworkDef[] = [
  { id: 'mentor', name: '退休老领导', desc: '一个电话,风向就变了', baseCost: 120, costMul: 1.7, protection: 3, incomeBonus: 0, auditShield: 0, maxLevel: 5 },
  { id: 'secretary', name: '秘书小王', desc: '材料到他手里,先过一遍', baseCost: 240, costMul: 1.7, protection: 1, incomeBonus: 8, auditShield: 0, maxLevel: 5 },
  { id: 'accountant', name: '财务老李', desc: '账做得平,查不出窟窿', baseCost: 420, costMul: 1.72, protection: 6, incomeBonus: 0, auditShield: 0, maxLevel: 5 },
  { id: 'inspector', name: '巡视组熟人', desc: '要来查了,他会先咳嗽一声', baseCost: 800, costMul: 1.75, protection: 4, incomeBonus: 0, auditShield: 1, maxLevel: 3 },
  { id: 'cadre', name: '组织部长', desc: '名单怎么排,他说了算', baseCost: 1600, costMul: 1.8, protection: 8, incomeBonus: 15, auditShield: 0, maxLevel: 3 }
];

export function assetById(id: string): AssetDef | undefined {
  return ASSETS.find(a => a.id === id);
}
export function networkById(id: string): NetworkDef | undefined {
  return NETWORK.find(n => n.id === id);
}

/** 下一级造价;已满级返回 null */
export function nextCost(def: { baseCost: number; costMul: number; maxLevel: number }, level: number): number | null {
  if (level >= def.maxLevel) return null;
  return Math.round(def.baseCost * Math.pow(def.costMul, level));
}

export interface Holdings {
  /** 每项资产的等级 */
  assets: Record<string, number>;
  /** 每个人脉的等级 */
  network: Record<string, number>;
  /** 洗白累计抵掉的风险(洗白是持久效果) */
  laundered?: number;
}

/** 每分钟总收益(含人脉加成) */
export function incomePerMin(h: Holdings): number {
  const base = ASSETS.reduce((sum, a) => sum + a.incomePerMin * (h.assets[a.id] ?? 0), 0);
  const bonus = NETWORK.reduce((sum, n) => sum + n.incomeBonus * (h.network[n.id] ?? 0), 0);
  return Math.round(base * (1 + bonus / 100));
}

/** 资产带来的原始风险 */
export function rawRisk(h: Holdings): number {
  return ASSETS.reduce((sum, a) => sum + a.risk * (h.assets[a.id] ?? 0), 0);
}

/** 人脉带来的保护值 */
export function protection(h: Holdings): number {
  return NETWORK.reduce((sum, n) => sum + n.protection * (h.network[n.id] ?? 0), 0);
}

/** 净风险:被查概率的分子(0~100) */
export function netRisk(h: Holdings): number {
  return Math.max(0, Math.min(100, rawRisk(h) - protection(h) - (h.laundered ?? 0)));
}

/** 审查豁免次数(巡视组熟人给) */
export function auditShield(h: Holdings): number {
  return NETWORK.reduce((sum, n) => sum + n.auditShield * (h.network[n.id] ?? 0), 0);
}

/** 是否已经建过任何资产 */
export function hasAnyAsset(h: Holdings): boolean {
  return ASSETS.some(a => (h.assets[a.id] ?? 0) > 0);
}

// ---- 离线收益 ----
/** 离线收益上限:12 小时 */
export const MAX_OFFLINE_MS = 12 * 60 * 60 * 1000;

export interface AccrualResult {
  coins: number;
  elapsedMs: number;
  capped: boolean;
}

/** 按离线时长结算收益(超过上限按上限算) */
export function accrueOffline(h: Holdings, elapsedMs: number): AccrualResult {
  if (elapsedMs <= 0) return { coins: 0, elapsedMs: 0, capped: false };
  const capped = elapsedMs > MAX_OFFLINE_MS;
  const used = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const perMin = incomePerMin(h);
  const coins = Math.floor((perMin * used) / 60000);
  return { coins, elapsedMs: used, capped };
}

// ---- 纪检委审查 ----
export interface AuditResult {
  triggered: boolean;
  /** 用掉了一次豁免 */
  shielded: boolean;
  /** 审查通过(蒙混过关) */
  passed: boolean;
  /** 被没收的资产 id */
  seizedAssetId: string | null;
  /** 被罚款的银币 */
  fine: number;
  message: string;
}

/**
 * 判定一次审查。
 * @param roll 0~1 的随机数(测试时可传固定值)
 * @param shieldLeft 剩余审查豁免次数
 */
export function resolveAudit(h: Holdings, coins: number, roll: number, shieldLeft: number): AuditResult {
  const risk = netRisk(h);
  if (risk <= 0) {
    return { triggered: false, shielded: false, passed: true, seizedAssetId: null, fine: 0, message: '没人查你,安心数钱' };
  }
  const chance = Math.min(0.85, risk / 100);
  if (roll >= chance) {
    return { triggered: false, shielded: false, passed: true, seizedAssetId: null, fine: 0, message: '这次风声过去了' };
  }
  // 触发审查:先看豁免
  if (shieldLeft > 0) {
    return {
      triggered: true,
      shielded: true,
      passed: true,
      seizedAssetId: null,
      fine: 0,
      message: '巡视组的熟人咳嗽了一声,组里临时改了行程'
    };
  }
  // 没收价值最高的一项资产
  let worst: AssetDef | null = null;
  let worstValue = 0;
  ASSETS.forEach(a => {
    const lv = h.assets[a.id] ?? 0;
    if (lv <= 0) return;
    const value = a.incomePerMin * lv;
    if (value > worstValue) {
      worstValue = value;
      worst = a;
    }
  });
  if (!worst) {
    return { triggered: true, shielded: false, passed: false, seizedAssetId: null, fine: 0, message: '被叫去谈话,好在没什么可交代的' };
  }
  const seized = worst as AssetDef;
  const fine = Math.min(coins, seized.risk * 12);
  return {
    triggered: true,
    shielded: false,
    passed: false,
    seizedAssetId: seized.id,
    fine,
    message: `「${seized.name}」被查了出来,人也被留下了`
  };
}

/** 洗白造价:风险越高越贵 */
export function launderCost(h: Holdings): number {
  return Math.round(netRisk(h) * 14);
}

/** 洗白效果:抵掉当前净风险的 30%(至少 1 点) */
export function launderEffect(h: Holdings): number {
  const risk = netRisk(h);
  if (risk <= 0) return 0;
  return Math.max(1, Math.round(risk * 0.3));
}
