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

/** 下一级造价(沿用旧语义,单位是银币);已满级返回 null */
export function nextCost(def: { baseCost: number; costMul: number; maxLevel: number }, level: number): number | null {
  if (level >= def.maxLevel) return null;
  return Math.round(def.baseCost * Math.pow(def.costMul, level));
}

/** 货币种类:coin = 跑酷赚的银币(公开收入), corrupt = 产业产出的黑金(赃款) */
export type Currency = 'coin' | 'corrupt';

export interface CostQuote {
  currency: Currency;
  amount: number;
}

/**
 * 分档消费:
 * - 首次建造(0→1)花「银币」—— 明面上拿工资去置办
 * - 后续升级(n→n+1)花「黑金」—— 私下用赃款扩产
 */
export function quoteCost(
  def: { baseCost: number; costMul: number; maxLevel: number },
  level: number,
  corruptMul = 1.6
): CostQuote | null {
  const coins = nextCost(def, level);
  if (coins === null) return null;
  if (level === 0) return { currency: 'coin', amount: coins };
  return { currency: 'corrupt', amount: Math.round(coins * corruptMul) };
}

/** 黑金余额够不够 */
export function canAfford(wallet: { coins: number; corrupt: number }, q: CostQuote): boolean {
  return q.currency === 'coin' ? wallet.coins >= q.amount : wallet.corrupt >= q.amount;
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
  const fine = Math.min(coins, seized.risk * 12);   // 罚款扣的是黑金
  return {
    triggered: true,
    shielded: false,
    passed: false,
    seizedAssetId: seized.id,
    fine,
    message: `「${seized.name}」被查了出来,人也被留下了`
  };
}

/** 洗白造价(黑金):风险越高越贵 */
export function launderCost(h: Holdings): number {
  return Math.round(netRisk(h) * 14);
}

/** 打点造价(黑金):被查时花钱摆平 */
export function bribeCost(risk: number): number {
  return Math.max(80, Math.round(risk * 20));
}

/** 洗白效果:抵掉当前净风险的 30%(至少 1 点) */
export function launderEffect(h: Holdings): number {
  const risk = netRisk(h);
  if (risk <= 0) return 0;
  return Math.max(1, Math.round(risk * 0.3));
}


// ============================================================
// 资产对玩法的加成:钱不是白花的 —— 盖出来的东西要能改变你跑关的手感
// ============================================================

export interface AssetPerks {
  /** 情妇别墅:每 2 级多一顶乌纱帽 */
  extraLives: number;
  /** 关联公司:局内银币倍率 */
  coinMul: number;
  /** 干股煤矿:横版近战伤害加成 */
  meleeBonus: number;
  /** 海外账户:横版开局人脉 */
  startMp: number;
  /** 学区房:星级/首通奖励倍率 */
  rewardMul: number;
  /** 小金库:每次通关额外银币(直接加) */
  clearBonus: number;
}

export const EMPTY_PERKS: AssetPerks = {
  extraLives: 0, coinMul: 1, meleeBonus: 0, startMp: 0, rewardMul: 1, clearBonus: 0
};

/** 根据当前资产等级算出玩法加成 */
export function assetPerks(h: Holdings): AssetPerks {
  const lv = (id: string) => h.assets[id] ?? 0;
  const villa = lv('villa');
  const shell = lv('shell');
  const mine = lv('mine');
  const offshore = lv('offshore');
  const estate = lv('estate');
  const purse = lv('purse');
  return {
    extraLives: Math.floor(villa / 2),
    coinMul: 1 + shell * 0.04,
    meleeBonus: Math.min(3, Math.floor(mine / 2)),
    startMp: offshore * 12,
    rewardMul: 1 + estate * 0.05,
    clearBonus: purse * 2
  };
}

/** 家产总值(用于主界面展示与排行) */
export function totalAssetValue(h: Holdings): number {
  return ASSETS.reduce((sum, a) => {
    const level = h.assets[a.id] ?? 0;
    let cost = 0;
    for (let i = 0; i < level; i++) cost += nextCost(a, i) ?? 0;
    return sum + cost;
  }, 0);
}

/** 每项资产的一句话玩法说明(界面展示用) */
export const ASSET_PERK_TEXT: Record<string, string> = {
  purse: '每关通关额外 +2 银币',
  villa: '每 2 级 +1 顶乌纱帽',
  shell: '局内银币 +4%/级',
  mine: '每 2 级横版近战 +1',
  offshore: '横版开局人脉 +12/级',
  estate: '星级奖励 +5%/级'
};

/** 界面上的短标签版玩法说明 */
export const ASSET_PERK_SHORT: Record<string, string> = {
  purse: '通关 +2',
  villa: '2级 +1帽',
  shell: '银币 +4%/级',
  mine: '2级 +1攻',
  offshore: '人脉 +12/级',
  estate: '奖励 +5%/级'
};

/** 家产总值的中文简写(万/亿),主界面展示用 */
export function formatValue(v: number): string {
  if (v >= 100000000) return `${(v / 100000000).toFixed(2)}亿`;
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
  return String(v);
}


// ============================================================
// 风向:每隔一段时间全局变一次,风险与收益跟着变
// 用时间窗做种子,同一时间段所有玩家看到的是同一个风向
// ============================================================

export interface WindDef {
  id: string;
  name: string;
  desc: string;
  /** 风险倍率 */
  riskMul: number;
  /** 收益倍率 */
  incomeMul: number;
}

export const WINDS: WindDef[] = [
  { id: 'inspection', name: '中央巡视组进驻', desc: '风声鹤唳,被查风险 ×1.5', riskMul: 1.5, incomeMul: 1 },
  { id: 'reshuffle', name: '换届窗口期', desc: '人事一动,银两 ×2', riskMul: 0.8, incomeMul: 2 },
  { id: 'calm', name: '风平浪静', desc: '上面忙着开会,没人管你', riskMul: 0.6, incomeMul: 1 },
  { id: 'antigraft', name: '扫黑除恶专项行动', desc: '矿和公司都得低调:风险 ×1.2,收益 ×0.7', riskMul: 1.2, incomeMul: 0.7 },
  { id: 'boom', name: '土地财政红利', desc: '遍地是钱:收益 ×1.4', riskMul: 1, incomeMul: 1.4 }
];

/** 风向每 20 分钟换一次 */
export const WIND_WINDOW_MS = 20 * 60 * 1000;

/** 当前风向(按时间窗确定性选择) */
export function currentWind(nowMs: number): { wind: WindDef; endsAt: number; windowIndex: number } {
  const windowIndex = Math.floor(nowMs / WIND_WINDOW_MS);
  // 简单散列,让相邻窗口不总是同一档
  const idx = ((windowIndex * 2654435761) >>> 0) % WINDS.length;
  return { wind: WINDS[idx], endsAt: (windowIndex + 1) * WIND_WINDOW_MS, windowIndex };
}

/** 叠加风向后的实际收益 */
export function incomePerMinWithWind(h: Holdings, wind: WindDef): number {
  return Math.round(incomePerMin(h) * wind.incomeMul);
}

/** 叠加风向后的实际净风险 */
export function netRiskWithWind(h: Holdings, wind: WindDef): number {
  return Math.max(0, Math.min(100, Math.round(netRisk(h) * wind.riskMul)));
}

// ============================================================
// 家产称号:总值越高,名头越大
// ============================================================

export interface AssetTitle {
  name: string;
  color: string;
  minValue: number;
}

// 门槛按当前资产表的上限(全满级约 20.8 万)设计,保证每一档都够得着
export const ASSET_TITLES: AssetTitle[] = [
  { name: '白手套', color: '#ced4da', minValue: 0 },
  { name: '操盘手', color: '#8ce99a', minValue: 3000 },
  { name: '幕后老板', color: '#74c0fc', minValue: 15000 },
  { name: '一方诸侯', color: '#b197fc', minValue: 60000 },
  { name: '隐形富豪', color: '#ffd43b', minValue: 150000 }
];

export function assetTitle(value: number): AssetTitle {
  let out = ASSET_TITLES[0];
  ASSET_TITLES.forEach(t => { if (value >= t.minValue) out = t; });
  return out;
}

// ---- 新闻弹幕:审查/没收时来一条「本市新闻」 ----
const NEWS_SEIZED = [
  '本市某干部涉嫌严重违纪违法,目前正接受纪律审查和监察调查',
  '有关部门通报:一起领导干部违规经商办企业问题被查处',
  '据知情人士透露,某项目资金流向正在被逐笔核对',
  '深夜通报:某单位主要负责人已被采取留置措施'
];
const NEWS_PASSED = [
  '检查组已完成本轮核查,未发现该单位存在明显问题',
  '举报线索经核实不属实,相关同志继续主持工作',
  '巡视组结束进驻,反馈会上强调了作风建设'
];

export function newsFor(seized: boolean, seed: number): string {
  const pool = seized ? NEWS_SEIZED : NEWS_PASSED;
  const i = Math.abs(Math.floor(seed * 7919)) % pool.length;
  return pool[i];
}


// ============================================================
// 官场名人堂:没有后端也能有竞争感 —— 一组固定「对手」按家产总值排位
// ============================================================

export interface Rival {
  name: string;
  value: number;
  /** 一句评语,越靠后越狂 */
  taunt: string;
}

export const RIVALS: Rival[] = [
  { name: '街道办的小杨', value: 1500, taunt: '刚学会收第一条烟' },
  { name: '隔壁老王', value: 6000, taunt: '三套房,两辆车,一个情妇' },
  { name: '祁厅长的司机', value: 18000, taunt: '开车的人知道的事最多' },
  { name: '开发区的赵总', value: 45000, taunt: '一个标就是七位数' },
  { name: '省城来的李公子', value: 90000, taunt: '他爸的名字印在红头文件上' },
  { name: '高小琴的钢琴老师', value: 150000, taunt: '山水庄园的账,她最清楚' },
  { name: '传说中的「老领导」', value: 200000, taunt: '没人见过他,但所有人都听他的' }
];

export interface LeaderRow {
  name: string;
  value: number;
  taunt: string;
  isPlayer: boolean;
  rank: number;
}

/** 把玩家插进对手榜里,返回排好序的名次表 */
export function assetLeaderboard(h: Holdings, playerName = '我'): LeaderRow[] {
  const mine = totalAssetValue(h);
  const rows: LeaderRow[] = RIVALS.map(r => ({
    name: r.name, value: r.value, taunt: r.taunt, isPlayer: false, rank: 0
  }));
  rows.push({ name: playerName, value: mine, taunt: mine > 0 ? '你的家产' : '还没有产业', isPlayer: true, rank: 0 });
  rows.sort((a, b) => b.value - a.value);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** 玩家名次与「下一个要超过的对手」 */
export function nextRival(h: Holdings): { rank: number; ahead: Rival | null; gap: number } {
  const mine = totalAssetValue(h);
  const ahead = RIVALS.filter(r => r.value > mine).sort((a, b) => a.value - b.value)[0] ?? null;
  const rows = assetLeaderboard(h);
  const me = rows.find(r => r.isPlayer)!;
  return { rank: me.rank, ahead, gap: ahead ? ahead.value - mine : 0 };
}
