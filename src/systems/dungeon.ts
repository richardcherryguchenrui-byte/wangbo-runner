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
  enemies: DGPoint[];
  coins: DGPoint[];
  hearts: DGPoint[];
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
  '........................***..................***................',
  '.......................#######..............#######.............',
  '.............***........................................e.......',
  '............#######...............***.................######....',
  '.................................#######........................',
  '................................................................',
  '...P.....e......e....e.......h......e...........e...XX......e.G.',
  '##############################....##############################',
  '##############################.XX.##############################'
];

const LEVEL_2_MAP = [
  '################################################################################',
  '................................................................................',
  '................................................................................',
  '..................***.....................................***...................',
  '.................########...............e................#######................',
  '.....................................########...................................',
  '.........***........................................................e...........',
  '........########............***...................................#######.......',
  '...........................########............########.........................',
  '................................................................................',
  '...P........e......e...........e...h.....e..........e........e........e....B..G.',
  '######################....######################....############################',
  '######################.XX.######################.XX.############################'
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
export const DG_LEGEND = '#.PeB*hXG';

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
    coins,
    hearts,
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
