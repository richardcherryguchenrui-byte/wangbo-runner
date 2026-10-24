// 「留置室」横版闯关 —— 关卡数据与地图解析(纯逻辑,不依赖 Phaser,方便单测)
//
// 玩法参考:造梦西游 / 空洞骑士 —— 自由左右移动、二段跳、冲刺、近战、
// 平台地形 + 敌人 + BOSS。主题延续贪官隐喻:谈话室 → 档案室 → 留置室。
//
// 地图用 ASCII 描述,每个字符 = 一个 TILE:
//   #  实体地块(可站立、可阻挡)
//   .  空气
//   P  玩家出生点
//   e  巡逻小兵
//   B  BOSS
//   *  银币
//   h  回血包
//   X  尖刺(碰到掉血)
//   G  出口(有 BOSS 的关卡需先击败 BOSS)

export const DG_TILE = 48;

export type DungeonTheme = 'corridor' | 'archive' | 'detention';

export interface DGRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DGPoint {
  x: number;
  y: number;
}

export interface ParsedDungeon {
  widthPx: number;
  heightPx: number;
  /** 合并后的实体平台矩形(像素) */
  colliders: DGRect[];
  /** 尖刺伤害区(像素,贴在地块上半部) */
  spikes: DGRect[];
  /** 巡逻小兵 */
  enemies: DGPoint[];
  /** 远程:会朝玩家扔举报信 */
  throwers: DGPoint[];
  /** 冲锋:靠近后突进撞击 */
  chargers: DGPoint[];
  coins: DGPoint[];
  hearts: DGPoint[];
  /** 宝箱:开出银币 + 随机增益 */
  chests: DGPoint[];
  /** 茅台:临时攻击力提升 */
  wines: DGPoint[];
  /** 购物卡:回满法力 */
  cards: DGPoint[];
  /** 检查点:死亡后从这里重来 */
  checkpoints: DGPoint[];
  boss: DGPoint | null;
  goal: DGPoint | null;
  /** 玩家出生点:脚底锚点(y 为地面像素 y) */
  playerStart: DGPoint;
}

export interface DungeonLevelDef {
  id: string;
  name: string;
  subtitle: string;
  theme: DungeonTheme;
  /** 小兵血量 */
  enemyHp: number;
  map: string[];
}

const LEVEL_1_MAP = [
  '################################################################',
  '................................................................',
  '................................................................',
  '........................**.m.................**.k...............',
  '.......................#######..............#######.............',
  '.............**.r.......................................C.......',
  '............#######...............**..................######....',
  '.................................#######........................',
  '................................................................',
  '...P.....e...........e......S.......c...h......e....XX........G.',
  '##############################....##############################',
  '##############################.XX.##############################'
];

const LEVEL_2_MAP = [
  '################################################################################',
  '................................................................................',
  '................................................................................',
  '..................**.r......................m.............**.C..................',
  '.................########.................r..............#######................',
  '.....................................########...................................',
  '.........***....................................................................',
  '........########............**.k..................................#######.......',
  '...........................########............########.........................',
  '................................................................................',
  '...P........e...............h..e...S.....c...................e........c....B..G.',
  '######################....######################....############################',
  '######################.XX.######################.XX.############################'
];

const LEVEL_ARCHIVE_MAP = [
  '########################################################################',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '................**.C..............**.m...............**.k...............',
  '...............#######...........#######............#######.............',
  '........................................................................',
  '.......**r...................................r..........................',
  '......#######...........#######...........#######............#######....',
  '........................................................................',
  '...P.......e.......c............h...e...S.........XX...e..h.....c.....G.',
  '##########################....################....######################',
  '##########################.XX.################.XX.######################'
];

export const DUNGEON_LEVELS: DungeonLevelDef[] = [
  {
    id: 'd1',
    name: '谈话室走廊',
    subtitle: '第一次被叫来谈话,腿有点软',
    theme: 'corridor',
    enemyHp: 2,
    map: LEVEL_1_MAP
  },
  {
    id: 'd2',
    name: '档案室',
    subtitle: '一柜子一柜子的材料,全压在你身上',
    theme: 'archive',
    enemyHp: 3,
    map: LEVEL_ARCHIVE_MAP
  },
  {
    id: 'd3',
    name: '留置室深处',
    subtitle: '档案搬完了,人也走不掉了',
    theme: 'detention',
    enemyHp: 3,
    map: LEVEL_2_MAP
  }
];

export function dungeonLevelById(id: string): DungeonLevelDef | undefined {
  return DUNGEON_LEVELS.find(l => l.id === id);
}

export function nextDungeonId(id: string): string | null {
  const idx = DUNGEON_LEVELS.findIndex(l => l.id === id);
  if (idx < 0 || idx + 1 >= DUNGEON_LEVELS.length) return null;
  return DUNGEON_LEVELS[idx + 1].id;
}

/** 第一层永远开放,其余需要上一层通关 */
export function isDungeonUnlocked(id: string, cleared: Record<string, number>): boolean {
  const idx = DUNGEON_LEVELS.findIndex(l => l.id === id);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return (cleared[DUNGEON_LEVELS[idx - 1].id] ?? 0) > 0;
}

/** 地图里出现过的字符集合(用于数据自检) */
export const DG_LEGEND = '#.*PerBchXGCSmk';

/**
 * 解析 ASCII 地图。
 * 平台做「先水平合并、再垂直合并」,把上千个格子压缩成十几个碰撞矩形。
 */
export function parseDungeon(map: string[]): ParsedDungeon {
  const heightTiles = map.length;
  const widthTiles = map.reduce((m, row) => Math.max(m, row.length), 0);

  const colliders: DGRect[] = [];
  const spikes: DGRect[] = [];
  const enemies: DGPoint[] = [];
  const throwers: DGPoint[] = [];
  const chargers: DGPoint[] = [];
  const chests: DGPoint[] = [];
  const wines: DGPoint[] = [];
  const cards: DGPoint[] = [];
  const checkpoints: DGPoint[] = [];
  const coins: DGPoint[] = [];
  const hearts: DGPoint[] = [];
  let boss: DGPoint | null = null;
  let goal: DGPoint | null = null;
  let playerStart: DGPoint = { x: DG_TILE * 1.5, y: DG_TILE * 2 };

  // 1) 逐行找实体地块的水平连续段
  const runsByRow: { c0: number; c1: number }[][] = [];
  for (let r = 0; r < heightTiles; r++) {
    const row = map[r];
    const runs: { c0: number; c1: number }[] = [];
    let start = -1;
    for (let c = 0; c <= widthTiles; c++) {
      const solid = c < row.length && row[c] === '#';
      if (solid && start < 0) start = c;
      if (!solid && start >= 0) {
        runs.push({ c0: start, c1: c - 1 });
        start = -1;
      }
    }
    runsByRow.push(runs);
  }

  // 2) 垂直合并:与上一行完全相同的水平段,延长成一块
  const open: { c0: number; c1: number; r0: number }[] = [];
  for (let r = 0; r < heightTiles; r++) {
    const runs = runsByRow[r];
    const nextOpen: { c0: number; c1: number; r0: number }[] = [];
    runs.forEach(run => {
      const match = open.find(o => o.c0 === run.c0 && o.c1 === run.c1);
      if (match) {
        nextOpen.push(match);
      } else {
        nextOpen.push({ c0: run.c0, c1: run.c1, r0: r });
      }
    });
    // 上一行没能延续下去的段,收口成矩形
    open.forEach(o => {
      if (!nextOpen.includes(o)) {
        colliders.push({
          x: o.c0 * DG_TILE,
          y: o.r0 * DG_TILE,
          w: (o.c1 - o.c0 + 1) * DG_TILE,
          h: (r - o.r0) * DG_TILE
        });
      }
    });
    open.length = 0;
    open.push(...nextOpen);
  }
  open.forEach(o => {
    colliders.push({
      x: o.c0 * DG_TILE,
      y: o.r0 * DG_TILE,
      w: (o.c1 - o.c0 + 1) * DG_TILE,
      h: (heightTiles - o.r0) * DG_TILE
    });
  });

  // 3) 逐格提取实体
  for (let r = 0; r < heightTiles; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      // 脚底锚点:格子底部
      const footX = c * DG_TILE + DG_TILE / 2;
      const footY = (r + 1) * DG_TILE;
      switch (ch) {
        case 'P':
          playerStart = { x: footX, y: footY };
          break;
        case 'e':
          enemies.push({ x: footX, y: footY });
          break;
        case '*':
          coins.push({ x: footX, y: r * DG_TILE + DG_TILE / 2 });
          break;
        case 'h':
          hearts.push({ x: footX, y: footY });
          break;
        case 'B':
          boss = { x: footX, y: footY };
          break;
        case 'G':
          goal = { x: footX, y: footY };
          break;
        case 'X':
          spikes.push({ x: c * DG_TILE + 6, y: r * DG_TILE + DG_TILE / 2, w: DG_TILE - 12, h: DG_TILE / 2 });
          break;
        case 'r':
          throwers.push({ x: footX, y: footY });
          break;
        case 'c':
          chargers.push({ x: footX, y: footY });
          break;
        case 'C':
          chests.push({ x: footX, y: footY });
          break;
        case 'm':
          wines.push({ x: footX, y: footY });
          break;
        case 'k':
          cards.push({ x: footX, y: footY });
          break;
        case 'S':
          checkpoints.push({ x: footX, y: footY });
          break;
        default:
          break;
      }
    }
  }

  return {
    widthPx: widthTiles * DG_TILE,
    heightPx: heightTiles * DG_TILE,
    colliders,
    spikes,
    enemies,
    throwers,
    chargers,
    coins,
    hearts,
    chests,
    wines,
    cards,
    checkpoints,
    boss,
    goal,
    playerStart
  };
}

// ---- 数值:留在这里方便平衡性调整与单测 ----
export const DG_PLAYER_MAX_HP = 5;
export const DG_PLAYER_SPEED = 330;      // 水平跑速 px/s
export const DG_PLAYER_JUMP = 900;       // 起跳速度
export const DG_DOUBLE_JUMP_RATIO = 0.88;
export const DG_DASH_SPEED = 900;
export const DG_DASH_MS = 170;
export const DG_DASH_COOLDOWN_MS = 520;
export const DG_ATTACK_MS = 180;
export const DG_ATTACK_COOLDOWN_MS = 260;
export const DG_ATTACK_DAMAGE = 1;
export const DG_ATTACK_RANGE = 62;
export const DG_INVULN_MS = 900;
export const DG_ENEMY_SPEED = 92;
export const DG_BOSS_HP = 18;
export const DG_BOSS_SPEED = 130;
export const DG_BOSS_TOUCH_DAMAGE = 1;

/** 冲刺可用性(冷却好了才能冲) */
export function canDash(nowMs: number, readyAt: number): boolean {
  return nowMs >= readyAt;
}

/** 攻击是否命中:攻击盒与目标盒是否相交 */
export function boxesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** 攻击盒:面朝方向伸出一段 */
export function attackBox(
  playerX: number, playerY: number, facing: 1 | -1,
  range: number = DG_ATTACK_RANGE, height = 56
): DGRect {
  return {
    x: facing === 1 ? playerX : playerX - range,
    y: playerY - height / 2,
    w: range,
    h: height
  };
}

/** 矩形与「x/y/w/h」描述的另一个矩形是否相交(场景里对物理体用) */
export function boxOverlapRect(rect: DGRect, x: number, y: number, w: number, h: number): boolean {
  return boxesOverlap(rect.x, rect.y, rect.w, rect.h, x, y, w, h);
}


// ============================================================
// 技能与 MP:两个技能对应两段官场戏 ——「实名举报」远程、「金句护体」保命
// ============================================================

export const DG_PLAYER_MAX_MP = 100;
export const DG_MP_REGEN_PER_SEC = 7;
export const DG_MP_ON_KILL = 16;

export interface SkillDef {
  id: 'report' | 'shield';
  name: string;
  desc: string;
  cost: number;
  cooldownMs: number;
}

/** 实名举报:扔出一封举报信,远程穿透一击 */
export const DG_SKILL_REPORT: SkillDef & { damage: number; speed: number; lifeMs: number; pierce: number } = {
  id: 'report',
  name: '实名举报',
  desc: '扔出举报信,远处解决',
  cost: 25,
  cooldownMs: 420,
  damage: 2,
  speed: 780,
  lifeMs: 1100,
  pierce: 1
};

/** 金句护体:短暂无敌并震开周围敌人 */
export const DG_SKILL_SHIELD: SkillDef & { shieldMs: number; radius: number; damage: number } = {
  id: 'shield',
  name: '金句护体',
  desc: '念一句场面话,短暂无敌并震开敌人',
  cost: 45,
  cooldownMs: 3200,
  shieldMs: 1300,
  radius: 165,
  damage: 1
};

/** MP 够且冷却好了才能放 */
export function canUseSkill(mp: number, nowMs: number, readyAt: number, cost: number): boolean {
  return mp >= cost && nowMs >= readyAt;
}

/** 每帧回蓝,封顶 */
export function regenMp(mp: number, dtMs: number, max = DG_PLAYER_MAX_MP, ratePerSec = DG_MP_REGEN_PER_SEC): number {
  if (dtMs <= 0) return Math.min(max, Math.max(0, mp));
  return Math.min(max, Math.max(0, mp + (ratePerSec * dtMs) / 1000));
}

/** 技能冷却剩余比例(0=可用,1=刚进冷却),用于 HUD 遮罩 */
export function skillCooldownRatio(nowMs: number, readyAt: number, cooldownMs: number): number {
  if (cooldownMs <= 0) return 0;
  const remain = Math.max(0, readyAt - nowMs);
  return Math.min(1, remain / cooldownMs);
}

/** 圆形范围命中(护体震开) */
export function inRadius(ax: number, ay: number, bx: number, by: number, radius: number): boolean {
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by) <= radius * radius;
}


// ============================================================
// 敌人种类 / 拾取增益 / 连击加成
// ============================================================

export const DG_THROWER_HP = 2;
export const DG_THROWER_RANGE = 520;      // 进入射程才开火
export const DG_THROWER_COOLDOWN_MS = 1500;
export const DG_THROWER_WINDUP_MS = 420;  // 抬手预警,给玩家反应时间
export const DG_ENEMY_LETTER_SPEED = 380;
export const DG_ENEMY_LETTER_DAMAGE = 1;
export const DG_ENEMY_LETTER_LIFE_MS = 2600;

export const DG_CHARGER_HP = 3;
export const DG_CHARGER_TRIGGER = 300;    // 距离内开始助跑
export const DG_CHARGER_WINDUP_MS = 380;
export const DG_CHARGER_DASH_SPEED = 460;
export const DG_CHARGER_DASH_MS = 420;

export const DG_WINE_BUFF_MS = 12000;     // 茅台:12 秒攻击力 +1
export const DG_WINE_DAMAGE_BONUS = 1;
export const DG_CARD_MP = 55;             // 购物卡:回 55 法力
export const DG_CHEST_COINS = 12;

/** 连击强化:连得越多砍得越疼 */
export function comboDamageBonus(combo: number): number {
  if (combo >= 12) return 2;
  if (combo >= 6) return 1;
  return 0;
}

/** 玩家当前单次近战伤害(基础 + 连击加成 + 茅台增益) */
export function playerMeleeDamage(combo: number, wineActive: boolean, base = DG_ATTACK_DAMAGE): number {
  return base + comboDamageBonus(combo) + (wineActive ? DG_WINE_DAMAGE_BONUS : 0);
}
