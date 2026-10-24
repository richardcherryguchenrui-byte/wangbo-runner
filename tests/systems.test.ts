// 核心系统单元测试:存档迁移、成就、每日任务/签到、存档导出导入
// 运行:npm test
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadProgress, saveProgress, getTitle, nextLifeThreshold,
  bulletsPerRun, bribeCarryLimit, MAX_EXTRA_LIVES, SAVE_VERSION
} from '../src/systems/progress';
import { ACHIEVEMENTS, claimNewAchievements } from '../src/systems/achievements';
import {
  getDaily, updateDailyFromRun, claimDailyReward, checkIn, dailyAllDone,
  DAILY_TASKS, noteAssetBuild, noteAuditHandled
} from '../src/systems/daily';
import { exportSaveText, importSaveText, resetAllSaves } from '../src/systems/savebackup';
import { RUN_RANKS, rankAt, rankProgress } from '../src/systems/ranks';
import {
  MISSIONS, pickRunMission, missionDone, missionValue, missionProgressText,
  type MissionId, type MissionState
} from '../src/systems/missions';
import { generatePattern, stageFor, FLYER_Y } from '../src/systems/patterns';
import { isPerfectSlideTiming, tightSlideIndex } from '../src/systems/slideJudge';
import { formatDuration } from '../src/systems/offline';
import { nextStep } from '../src/systems/hints';
import {
  ASSETS, NETWORK, nextCost, incomePerMin, rawRisk, protection, netRisk, auditShield,
  accrueOffline, resolveAudit, launderCost, launderEffect, MAX_OFFLINE_MS,
  assetPerks, totalAssetValue, ASSET_PERK_TEXT, EMPTY_PERKS,
  WINDS, WIND_WINDOW_MS, currentWind, incomePerMinWithWind, netRiskWithWind,
  ASSET_TITLES, assetTitle, newsFor, RIVALS, assetLeaderboard, nextRival,
  quoteCost, canAfford, bribeCost,
  type Holdings
} from '../src/systems/assets';
import {
  DUNGEON_LEVELS, DG_LEGEND, DG_TILE, parseDungeon, isDungeonUnlocked, nextDungeonId,
  attackBox, boxesOverlap, canDash, DG_PLAYER_MAX_HP, DG_PLAYER_SPEED, DG_PLAYER_JUMP,
  DG_DOUBLE_JUMP_RATIO, DG_BOSS_HP, DG_ATTACK_DAMAGE, DG_DASH_MS, DG_DASH_COOLDOWN_MS,
  DG_ATTACK_MS, DG_ATTACK_COOLDOWN_MS, DG_ATTACK_RANGE,
  DG_THROWER_HP, DG_CHARGER_HP, DG_WINE_DAMAGE_BONUS, DG_CARD_MP, DG_CHEST_COINS,
  comboDamageBonus, playerMeleeDamage, DG_DEED_MAX_HP, DG_MAX_HP_CAP,
  DG_PLAYER_MAX_MP, DG_MP_REGEN_PER_SEC, DG_MP_ON_KILL, DG_INVULN_MS,
  DG_SKILL_REPORT, DG_SKILL_SHIELD,
  canUseSkill, regenMp, skillCooldownRatio, inRadius
} from '../src/systems/dungeon';
import {
  LEVELS, CHAPTERS, starCount, goalDone, isLevelUnlocked, isChapterUnlocked,
  levelSpeedAt, levelReward, nextLevelId, totalStars, MAX_STARS_PER_LEVEL,
  STAR_MILESTONES, TOTAL_STARS, newlyReachedMilestones, nextMilestone, clearLine, landfallLine,
  CHAPTER_MOODS, chapterMoodAt,
  finalEnding, isCampaignFinished, ENDING_CLEAN, ENDING_CAUGHT
} from '../src/systems/levels';
import { gradeRun } from '../src/systems/grade';
import {
  getDailyChallenge, recordDailyRun, peekDailyState, mulberry32, DAILY_MODIFIERS
} from '../src/systems/dailyChallenge';
import { SLIDE_BODY_HEIGHT, SLIDE_DURATION_MS } from '../src/config/constants';
import type { Progress } from '../src/systems/progress';

// ---- localStorage 桩 ----
class FakeStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  get keys() { return [...this.store.keys()]; }
}

const storage = new FakeStorage();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeProgress(over: Partial<Progress> = {}): Progress {
  return { ...loadProgress(), ...over };
}

// ---- 存档 ----
describe('存档(progress)', () => {
  it('新存档使用 v2 默认值', () => {
    const p = loadProgress();
    expect(p.saveVersion).toBe(SAVE_VERSION);
    expect(p.coins).toBe(0);
    expect(p.achievements).toEqual([]);
    expect(p.tutorialDone).toBe(false);
  });

  it('老存档升级后银币不丢失,新字段自动补齐', () => {
    const old = { coins: 777, totalDodged: 1234, owned: ['pistol'], pendant: 'star', extraLives: 1, skin: '', bribeMoon: 2 };
    storage.setItem('wangboProgress', JSON.stringify(old));
    const p = loadProgress();
    expect(p.coins).toBe(777);           // 银币保留!
    expect(p.totalDodged).toBe(1234);
    expect(p.owned).toContain('pistol');
    expect(p.pistolLevel).toBe(0);       // 新字段补齐
    expect(p.bestTimeMs).toBe(0);
    expect(p.saveVersion).toBe(SAVE_VERSION);
  });

  it('旧版独立 bestTimeMs 自动迁移进存档', () => {
    storage.setItem('bestTimeMs', '42000');
    const p = loadProgress();
    expect(p.bestTimeMs).toBe(42000);
    // 迁移后写回存档,且不会覆盖更大的新值
    saveProgress({ ...p, bestTimeMs: 60000 });
    const p2 = loadProgress();
    expect(p2.bestTimeMs).toBe(60000);
  });

  it('存档损坏时回退默认值,不崩溃', () => {
    storage.setItem('wangboProgress', '{not-json');
    const p = loadProgress();
    expect(p.coins).toBe(0);
    expect(p.saveVersion).toBe(SAVE_VERSION);
  });

  it('子弹数与贿月上限随升级增长', () => {
    expect(bulletsPerRun(makeProgress({ pistolLevel: 0 }))).toBe(3);
    expect(bulletsPerRun(makeProgress({ pistolLevel: 1 }))).toBe(5);
    expect(bulletsPerRun(makeProgress({ pistolLevel: 2 }))).toBe(7);
    expect(bribeCarryLimit(makeProgress({ bribeCarryLevel: 0 }))).toBe(3);
    expect(bribeCarryLimit(makeProgress({ bribeCarryLevel: 1 }))).toBe(5);
  });

  it('称号阈值与生命升级阈值正确', () => {
    expect(getTitle(999)).toBe('科员');
    expect(getTitle(1000)).toBe('科长');
    expect(getTitle(4000)).toBe('厅长');
    expect(nextLifeThreshold(makeProgress({ extraLives: 0 }))).toBe(100);
    expect(nextLifeThreshold(makeProgress({ extraLives: MAX_EXTRA_LIVES }))).toBeNull();
  });
});

// ---- 成就 ----
describe('成就系统', () => {
  it('完成一局后解锁「初入仕途」并发放银币', () => {
    const p = makeProgress({ totalRuns: 1 });
    const got = claimNewAchievements(p);
    expect(got.map(a => a.id)).toContain('first-run');
    expect(p.achievements).toContain('first-run');
    expect(p.coins).toBe(20); // 成就奖励入账
  });

  it('不会重复发放已获得成就', () => {
    const p = makeProgress({ totalRuns: 1 });
    claimNewAchievements(p);
    const coinsAfter = p.coins;
    const again = claimNewAchievements(p);
    expect(again).toHaveLength(0);
    expect(p.coins).toBe(coinsAfter);
  });

  it('满足条件时一次性解锁多项', () => {
    const p = makeProgress({ totalRuns: 5, bestTimeMs: 65000, bestDodged: 60, bestCombo: 25, coins: 0 });
    const got = claimNewAchievements(p);
    const ids = got.map(a => a.id);
    expect(ids).toContain('first-run');
    expect(ids).toContain('survivor-60');
    expect(ids).toContain('dodger-50');
    expect(ids).toContain('combo-20');
    expect(p.coins).toBe(got.reduce((s, a) => s + a.reward, 0));
  });

  it('成就定义完整(每个都有 id/名称/奖励)', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.reward).toBeGreaterThan(0);
    }
  });
});

// ---- 每日任务与签到 ----
describe('每日任务与签到', () => {
  it('跨天自动重置任务', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T10:00:00'));
    const p = makeProgress();
    const d1 = getDaily(p);
    updateDailyFromRun(p, { dodged: 10, surviveMs: 20000, kills: 2, picked: 1 });
    expect(d1.dodged).toBe(10);
    // 第二天:任务自动翻新
    vi.setSystemTime(new Date('2026-08-27T10:00:00'));
    const d2 = getDaily(p);
    expect(d2.dodged).toBe(0);
    expect(d2.date).toBe('2026-08-27');
  });

  it('任务进度取单局最长存活,其余累加', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T10:00:00'));
    const p = makeProgress();
    updateDailyFromRun(p, { dodged: 10, surviveMs: 30000, kills: 2, picked: 1 });
    updateDailyFromRun(p, { dodged: 8, surviveMs: 20000, kills: 1, picked: 0 });
    const d = getDaily(p);
    expect(d.dodged).toBe(18);
    expect(d.surviveMs).toBe(30000);
    expect(d.kills).toBe(3);
    expect(d.picked).toBe(1);
  });

  it('全部完成后才能领取,只能领一次', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T10:00:00'));
    const p = makeProgress();
    updateDailyFromRun(p, { dodged: 30, surviveMs: 45000, kills: 5, picked: 3 });
    // 新增的养成分支也要满足
    noteAssetBuild(p, 2);
    noteAuditHandled(p, 1);
    expect(dailyAllDone(getDaily(p))).toBe(true);
    const total = DAILY_TASKS.reduce((s, t) => s + t.reward, 0) + 40;
    expect(claimDailyReward(p)).toBe(total);
    expect(claimDailyReward(p)).toBe(0); // 第二次 0
    expect(p.coins).toBe(total);
  });

  it('签到:连续天数累计,断签重来,第 7 天额外奖励', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00'));
    const p = makeProgress();
    // 连续 6 天
    let lastCoins = 0;
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(new Date(`2026-08-${20 + i}T10:00:00`));
      const r = checkIn(p);
      expect(r.signed).toBe(true);
      expect(r.streak).toBe(i + 1);
      lastCoins = r.coins;
    }
    expect(lastCoins).toBe(20);
    // 第 7 天:20 + 100
    vi.setSystemTime(new Date('2026-08-26T10:00:00'));
    const r7 = checkIn(p);
    expect(r7.streak).toBe(7);
    expect(r7.coins).toBe(120);
    // 同一天再签到:无
    expect(checkIn(p).signed).toBe(false);
    // 断签:跳过一天后 streak 重新从 1 开始
    vi.setSystemTime(new Date('2026-08-28T10:00:00'));
    expect(checkIn(p).streak).toBe(1);
  });
});

// ---- 存档导出/导入 ----
describe('存档备份', () => {
  it('导出→导入完整还原(银币/皮肤/挂件)', () => {
    const p = makeProgress({ coins: 1234, totalDodged: 888, skin: 'night', pendant: 'crown', owned: ['pistol'] });
    saveProgress(p);
    const text = exportSaveText();
    expect(text.startsWith('WANGBO2.')).toBe(true);
    // 清空再导入
    resetAllSaves();
    expect(loadProgress().coins).toBe(0);
    const err = importSaveText(text);
    expect(err).toBeNull();
    const restored = loadProgress();
    expect(restored.coins).toBe(1234);
    expect(restored.totalDodged).toBe(888);
    expect(restored.skin).toBe('night');
    expect(restored.pendant).toBe('crown');
    expect(restored.owned).toContain('pistol');
  });

  it('拒绝垃圾文本与错误格式', () => {
    expect(importSaveText('')).not.toBeNull();
    expect(importSaveText('随便一段话')).not.toBeNull();
    expect(importSaveText('WANGBO2.!!!bad-base64!!!')).not.toBeNull();
    // 存档内容缺关键字段
    const bad = exportSaveText(); // 结构完整,但手动改掉 magic 前缀
    expect(importSaveText(bad.slice(0, -4) + 'xxxx')).not.toBeNull();
  });

  it('导入旧版结构(缺新字段)自动补全', () => {
    const legacy = JSON.stringify({ progress: { coins: 66, totalDodged: 99 } });
    const text = 'WANGBO2.' + Buffer.from(JSON.stringify({ v: 1, progress: { coins: 66, totalDodged: 99 }, audio: null, head: null })).toString('base64');
    expect(importSaveText(text)).toBeNull();
    const p = loadProgress();
    expect(p.coins).toBe(66);
    expect(p.saveVersion).toBe(SAVE_VERSION);
    expect(p.achievements).toEqual([]);
  });

  it('重置清空全部存档', () => {
    saveProgress(makeProgress({ coins: 999 }));
    storage.setItem('wangboCustomHead', 'data:image/png;base64,xxx');
    storage.setItem('bestTimeMs', '123');
    resetAllSaves();
    expect(storage.getItem('wangboProgress')).toBeNull();
    expect(storage.getItem('wangboCustomHead')).toBeNull();
    expect(storage.getItem('bestTimeMs')).toBeNull();
  });
});

// ---- 单局官阶 ----
describe('单局官阶', () => {
  it('按翻越数跨过阈值升级,最高到厅长', () => {
    expect(rankAt(0).name).toBe('科员');
    expect(rankAt(9).name).toBe('科员');
    expect(rankAt(10).name).toBe('副科长');
    expect(rankAt(23).name).toBe('副科长');
    expect(rankAt(24).name).toBe('科长');
    expect(rankAt(65).name).toBe('处长');
    expect(rankAt(130).name).toBe('局长');
    expect(rankAt(180).name).toBe('厅长');
    expect(rankAt(9999).name).toBe('厅长');
  });

  it('进度比例与下一级差额正确', () => {
    const start = rankProgress(0);
    expect(start.current.name).toBe('科员');
    expect(start.next?.name).toBe('副科长');
    expect(start.ratio).toBe(0);
    expect(start.remain).toBe(10);

    const half = rankProgress(5);
    expect(half.ratio).toBeCloseTo(0.5);
    expect(half.remain).toBe(5);

    const top = rankProgress(200);
    expect(top.next).toBeNull();
    expect(top.ratio).toBe(1);
    expect(top.remain).toBe(0);
  });

  it('官阶表索引连续、阈值严格递增', () => {
    RUN_RANKS.forEach((r, i) => {
      expect(r.index).toBe(i);
      if (i > 0) expect(r.dodged).toBeGreaterThan(RUN_RANKS[i - 1].dodged);
    });
  });
});

// ---- 单局考核 ----
describe('单局考核', () => {
  const baseState: MissionState = {
    dodged: 0, comboMax: 0, pickups: 0, elapsedMs: 0,
    kills: 0, nearMisses: 0, timeSinceHitMs: 0
  };
  const byId = (id: MissionId) => MISSIONS.find(m => m.id === id)!;

  it('各类型进度与完成判定正确', () => {
    const state: MissionState = {
      dodged: 15, comboMax: 10, pickups: 3, elapsedMs: 30000,
      kills: 3, nearMisses: 4, timeSinceHitMs: 20000
    };
    for (const m of MISSIONS) {
      expect(missionDone(m, state)).toBe(true);
      expect(missionValue(m, state)).toBeGreaterThanOrEqual(m.target);
    }
  });

  it('文案使用自然表述并钳制到目标值', () => {
    const state = { ...baseState, dodged: 99, elapsedMs: 999000, timeSinceHitMs: 999000 };
    expect(missionProgressText(byId('dodge'), state)).toBe('已翻越 15/15');
    expect(missionProgressText(byId('survive'), state)).toBe('坚持 30/30 秒');
    expect(missionProgressText(byId('flawless'), state)).toBe('无伤 20/20 秒');
  });

  it('新手池只有简单目标,解锁手枪后才会抽到击毁考核', () => {
    const rookie = makeProgress({ totalRuns: 0, owned: [] });
    const pool = new Set<MissionId>();
    for (let i = 0; i < 30; i++) pool.add(pickRunMission(rookie, () => i / 30).id);
    expect([...pool].sort()).toEqual(['dodge', 'survive']);

    const veteran = makeProgress({ totalRuns: 20, owned: ['pistol'] });
    expect(pickRunMission(veteran, () => 0.999).id).toBe('kill');
  });
});

// ---- 障碍编排 ----
describe('障碍 Pattern', () => {
  it('时间阶段边界与设计一致', () => {
    expect(stageFor(0)).toBe(0);
    expect(stageFor(19999)).toBe(0);
    expect(stageFor(20000)).toBe(1);
    expect(stageFor(44999)).toBe(1);
    expect(stageFor(45000)).toBe(2);
    expect(stageFor(79999)).toBe(2);
    expect(stageFor(80000)).toBe(3);
  });

  it('前 20 秒绝不出现低空美女或飞行 Pattern', () => {
    for (let seed = 1; seed < 120; seed++) {
      const p = generatePattern({ rng: mulberry32(seed), elapsedMs: 5000, speed: 300 });
      expect(['flyer', 'flyer-ground', 'ground-flyer', 'double-flyer', 'slalom', 'twin-flyer']).not.toContain(p.name);
      expect(p.obstacles.some(o => o.flyer)).toBe(false);
    }
  });

  it('连续障碍后压力会回落,障碍按横向距离递增', () => {
    for (let seed = 1; seed < 40; seed++) {
      expect(generatePattern({ rng: mulberry32(seed), elapsedMs: 60000, speed: 500, actionStreak: 5 }).obstacles).toHaveLength(0);
    }
    for (let seed = 1; seed < 80; seed++) {
      const p = generatePattern({ rng: mulberry32(seed), elapsedMs: 90000, speed: 620 });
      const xs = p.obstacles.map(o => o.at);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      p.obstacles.forEach(o => expect(o.at).toBeGreaterThanOrEqual(0));
    }
  });

  it('不连续重复同一 Pattern(有替代项时)', () => {
    for (let seed = 1; seed < 100; seed++) {
      const p = generatePattern({ rng: mulberry32(seed), elapsedMs: 60000, speed: 500, lastPattern: 'single' });
      expect(p.name).not.toBe('single');
    }
  });

  it('低空美女的碰撞底边足以让滑铲通过', () => {
    // 滑铲身高 48,地面在 y=0 时,障碍底边 -58 意味着上方至少留 58px 净空
    expect(FLYER_Y).toBeLessThanOrEqual(-SLIDE_BODY_HEIGHT);
  });

  it('双低空间距小于一次滑铲的位移,可以一口气钻过', () => {
    let found = 0;
    for (let seed = 1; seed < 800 && found < 6; seed++) {
      const p = generatePattern({ rng: mulberry32(seed), elapsedMs: 90000, speed: 620 });
      if (p.name !== 'twin-flyer') continue;
      found += 1;
      const gap = p.obstacles[1].at - p.obstacles[0].at;
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan((620 * SLIDE_DURATION_MS) / 1000);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('hurdle 的间距足够完成跳跃→滑铲→跳跃', () => {
    let found = 0;
    for (let seed = 1; seed < 1600 && found < 6; seed++) {
      const p = generatePattern({ rng: mulberry32(seed), elapsedMs: 90000, speed: 620 });
      if (p.name !== 'hurdle') continue;
      found += 1;
      expect(p.obstacles.map(o => o.flyer)).toEqual([false, true, false]);
      const gaps = [
        p.obstacles[1].at - p.obstacles[0].at,
        p.obstacles[2].at - p.obstacles[1].at
      ];
      gaps.forEach(gap => {
        // 一次满跳约 500px,落地后还要留出滑铲与再次起跳的时间
        expect(gap).toBeGreaterThan(520);
        expect(gap).toBeGreaterThan((620 * SLIDE_DURATION_MS) / 1000);
      });
    }
    expect(found).toBeGreaterThan(0);
  });
});

// ---- 每日挑战 ----
describe('每日挑战', () => {
  it('同一天种子与规则固定,跨天自动重置记录', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T09:00:00'));
    const a = getDailyChallenge();
    const b = getDailyChallenge();
    expect(a.date).toBe('2026-10-24');
    expect(a.seed).toBe(b.seed);
    expect(a.modifier.id).toBe(b.modifier.id);
    recordDailyRun(42000);

    vi.setSystemTime(new Date('2026-10-25T09:00:00'));
    const c = getDailyChallenge();
    expect(c.date).toBe('2026-10-25');
    expect(c.state.bestMs).toBe(0);
    expect(c.state.plays).toBe(0);
    expect(c.state.rewarded).toBe(false);
  });

  it('首次完成 +40,破纪录再 +40,之后不发钱', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T09:00:00'));
    const first = recordDailyRun(30000);
    expect(first.reward).toBe(40);
    expect(first.firstToday).toBe(true);
    expect(first.isRecord).toBe(true);

    const better = recordDailyRun(50000);
    expect(better.reward).toBe(40);
    expect(better.firstToday).toBe(false);
    expect(better.isRecord).toBe(true);
    expect(better.bestMs).toBe(50000);

    const worse = recordDailyRun(20000);
    expect(worse.reward).toBe(0);
    expect(worse.isRecord).toBe(false);
    expect(peekDailyState()?.plays).toBe(3);
    expect(peekDailyState()?.bestMs).toBe(50000);
  });

  it('mulberry32 同种子结果一致,不同种子错开', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const c = mulberry32(54321);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    const seqC = [c(), c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    seqA.forEach(n => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(1); });
  });

  it('每日规则池字段完整且 id 唯一', () => {
    expect(new Set(DAILY_MODIFIERS.map(m => m.id)).size).toBe(DAILY_MODIFIERS.length);
    for (const m of DAILY_MODIFIERS) {
      expect(m.name).toBeTruthy();
      expect(m.desc).toBeTruthy();
      expect(m.speedMul).toBeGreaterThanOrEqual(1);
      expect(m.coinMul).toBeGreaterThanOrEqual(1);
      expect(m.livesDelta).toBeLessThanOrEqual(0);
    }
  });
});

// ---- v2 新增存档字段 ----
describe('v2 新增存档字段', () => {
  it('默认值补齐官阶/任务/擦身/每日参与统计', () => {
    const p = loadProgress();
    expect(p.bestRankIndex).toBe(0);
    expect(p.missionsDone).toBe(0);
    expect(p.overdrives).toBe(0);
    expect(p.nearMisses).toBe(0);
    expect(p.dailyPlays).toBe(0);
  });

  it('老存档缺失新字段时保留旧统计并补 0', () => {
    storage.setItem('wangboProgress', JSON.stringify({ coins: 321, totalDodged: 88, bestTimeMs: 12000, tutorialDone: true }));
    const p = loadProgress();
    expect(p.coins).toBe(321);
    expect(p.totalDodged).toBe(88);
    expect(p.bestTimeMs).toBe(12000);
    expect(p.bestRankIndex).toBe(0);
    expect(p.missionsDone).toBe(0);
    expect(p.dailyPlays).toBe(0);
  });

  it('新字段可完整保存并读回', () => {
    saveProgress(makeProgress({ bestRankIndex: 5, missionsDone: 12, overdrives: 7, nearMisses: 44, dailyPlays: 3 }));
    const p = loadProgress();
    expect(p.bestRankIndex).toBe(5);
    expect(p.missionsDone).toBe(12);
    expect(p.overdrives).toBe(7);
    expect(p.nearMisses).toBe(44);
    expect(p.dailyPlays).toBe(3);
  });
});

// ---- 单局评价 ----
describe('单局评价(gradeRun)', () => {
  it('短局低表现拿 D,高质量长局拿 S', () => {
    expect(gradeRun({ timeMs: 8000, dodged: 1, nearMisses: 0, overdrives: 0, hits: 1, combo: 1 }).letter).toBe('D');
    expect(gradeRun({ timeMs: 60000, dodged: 22, nearMisses: 10, overdrives: 3, hits: 0, combo: 20 }).letter).toBe('S');
  });

  it('受击会扣分,但不出现负分', () => {
    const clean = gradeRun({ timeMs: 30000, dodged: 10, nearMisses: 2, overdrives: 1, hits: 0, combo: 6 });
    const hit = gradeRun({ timeMs: 30000, dodged: 10, nearMisses: 2, overdrives: 1, hits: 2, combo: 6 });
    expect(hit.score).toBeLessThan(clean.score);
    expect(gradeRun({ timeMs: 0, dodged: 0, nearMisses: 0, overdrives: 0, hits: 9, combo: 0 }).score).toBe(0);
  });

  it('等级与文案字段完整', () => {
    for (const input of [
      { timeMs: 10000, dodged: 2, nearMisses: 0, overdrives: 0, hits: 0, combo: 2 },
      { timeMs: 50000, dodged: 18, nearMisses: 5, overdrives: 2, hits: 1, combo: 12 }
    ]) {
      const g = gradeRun(input);
      expect(g.letter).toMatch(/^[SABCD]$/);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// 完美滑铲判定:只认「起滑瞬间卡点」,提前滑下去躲掉不算完美
describe('完美滑铲时机判定', () => {
  const SPEED = 430; // 约 50 秒时的跑速(低空美女开始出现的阶段)

  it('贴脸起滑 = 完美', () => {
    // 170ms 窗口内在 430px/s 下约 73px
    expect(isPerfectSlideTiming(10, SPEED)).toBe(true);
    expect(isPerfectSlideTiming(40, SPEED)).toBe(true);
    expect(isPerfectSlideTiming(72, SPEED)).toBe(true);
  });

  it('提前很久滑下去 = 不完美', () => {
    expect(isPerfectSlideTiming(90, SPEED)).toBe(false);
    expect(isPerfectSlideTiming(150, SPEED)).toBe(false);
    expect(isPerfectSlideTiming(400, SPEED)).toBe(false);
  });

  it('窗口边界随速度换算成时间,而不是固定像素', () => {
    // 同样 60px,慢速时算卡点(139ms),高速时更宽裕
    expect(isPerfectSlideTiming(60, 430)).toBe(true);
    // 高速下 60px 只相当于 67ms,更算卡点
    expect(isPerfectSlideTiming(60, 900)).toBe(true);
    // 高速下 200px = 222ms,已超出窗口
    expect(isPerfectSlideTiming(200, 900)).toBe(false);
  });

  it('起滑时已经轻微重叠(救险滑铲)仍算完美', () => {
    expect(isPerfectSlideTiming(0, SPEED)).toBe(true);
    expect(isPerfectSlideTiming(-8, SPEED)).toBe(true);
  });

  it('障碍已经完全在身后则不归功于这次起滑', () => {
    expect(isPerfectSlideTiming(-40, SPEED)).toBe(false);
    expect(isPerfectSlideTiming(-500, SPEED)).toBe(false);
  });

  it('异常速度不判定为完美', () => {
    expect(isPerfectSlideTiming(10, 0)).toBe(false);
    expect(isPerfectSlideTiming(10, -5)).toBe(false);
  });

  it('从多个障碍里挑最近的那个卡点目标', () => {
    const far = { distanceToContact: 300, flyer: true, counted: false, hit: false };
    const tight = { distanceToContact: 30, flyer: true, counted: false, hit: false };
    const ground = { distanceToContact: 10, flyer: false, counted: false, hit: false };
    const passed = { distanceToContact: 5, flyer: true, counted: true, hit: false };
    expect(tightSlideIndex([far, tight], SPEED)).toBe(1);
    // 地面障碍不需要滑铲,不参与完美滑铲
    expect(tightSlideIndex([ground], SPEED)).toBe(null);
    // 已经计过数(过去了)的不再重复判定
    expect(tightSlideIndex([passed], SPEED)).toBe(null);
    // 全是远处的障碍:这次起滑不算卡点
    expect(tightSlideIndex([far], SPEED)).toBe(null);
    expect(tightSlideIndex([], SPEED)).toBe(null);
  });
});

// 闯关模式:星级、解锁链、速度曲线与关卡数据自洽
describe('闯关模式 · 官场现形记', () => {
  const baseStats = {
    cleared: true, timeMs: 25000, dodged: 0, nearMisses: 0,
    perfectSlides: 0, comboMax: 0, hits: 0, coins: 0
  };

  it('没通关一颗星都没有', () => {
    const l = LEVELS[0];
    expect(starCount(l, { ...baseStats, cleared: false, dodged: 999, nearMisses: 99 })).toBe(0);
  });

  it('通关 1 星,两个目标各加 1 星', () => {
    const l = LEVELS[0]; // dodge 8 + nearmiss 1
    expect(starCount(l, { ...baseStats })).toBe(1);
    expect(starCount(l, { ...baseStats, dodged: 8 })).toBe(2);
    expect(starCount(l, { ...baseStats, dodged: 8, nearMisses: 1 })).toBe(3);
    // 只达成第二个目标也是 2 星
    expect(starCount(l, { ...baseStats, nearMisses: 1 })).toBe(2);
  });

  it('无伤目标看受击次数', () => {
    const l = LEVELS.find(x => x.goals.some(g => g.kind === 'noHit'))!;
    const goal = l.goals.find(g => g.kind === 'noHit')!;
    expect(goalDone(goal, { ...baseStats, hits: 0 })).toBe(true);
    expect(goalDone(goal, { ...baseStats, hits: 1 })).toBe(false);
  });

  it('关卡按顺序解锁,第一章第一关永远开放', () => {
    expect(isLevelUnlocked('l1-1', {})).toBe(true);
    expect(isLevelUnlocked('l1-2', {})).toBe(false);
    expect(isLevelUnlocked('l1-2', { 'l1-1': 1 })).toBe(true);
    expect(isLevelUnlocked('l2-1', { 'l1-1': 3, 'l1-2': 3, 'l1-3': 1 })).toBe(true);
  });

  it('章节按累计星数解锁', () => {
    // 第一章不要星
    expect(isChapterUnlocked(0, {})).toBe(true);
    // 第二章需要 2 星,且必须打通第一章最后一关
    expect(isChapterUnlocked(1, {})).toBe(false);
    expect(isChapterUnlocked(1, { 'l1-1': 2 })).toBe(false); // 星够但没打通 l1-3
    expect(isChapterUnlocked(1, { 'l1-1': 1, 'l1-2': 1 })).toBe(false);
    expect(isChapterUnlocked(1, { 'l1-1': 1, 'l1-2': 1, 'l1-3': 1 })).toBe(true);
    // 最后一章门槛最高
    expect(isChapterUnlocked(5, { 'l1-1': 3, 'l1-2': 3, 'l1-3': 3 })).toBe(false);
  });

  it('速度曲线从起点线性升到终点', () => {
    const l = LEVELS[3];
    expect(levelSpeedAt(l, 0)).toBe(l.speedStart);
    expect(Math.round(levelSpeedAt(l, l.durationMs))).toBe(Math.round(l.speedEnd));
    const mid = levelSpeedAt(l, l.durationMs / 2);
    expect(mid).toBeGreaterThan(l.speedStart);
    expect(mid).toBeLessThan(l.speedEnd);
    // 超出时长不越界
    expect(Math.round(levelSpeedAt(l, l.durationMs * 3))).toBe(Math.round(l.speedEnd));
  });

  it('奖励:首次通关额外给一笔,重复刷只给星钱', () => {
    const l = LEVELS[0];
    const first = levelReward(l, 3, true);
    const again = levelReward(l, 3, false);
    expect(first).toBe(again + l.rewardFirst);
    expect(again).toBe(3 * l.rewardStar);
    expect(levelReward(l, 0, true)).toBe(l.rewardFirst);
  });

  it('下一关与进度统计', () => {
    expect(nextLevelId(LEVELS[LEVELS.length - 1].id)).toBe(null);
    expect(nextLevelId('l1-1')).toBe('l1-2');
    expect(totalStars({})).toBe(0);
    expect(totalStars({ 'l1-1': 3, 'l1-2': 2 })).toBe(5);
  });

  it('关卡数据自洽:id 唯一、章节连续、目标合法、首领不超时', () => {
    const ids = new Set<string>();
    LEVELS.forEach((l, i) => {
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
      expect(l.id).toBe(`l${l.chapter + 1}-${l.index + 1}`);
      expect(l.durationMs).toBeGreaterThan(10000);
      expect(l.speedEnd).toBeGreaterThan(l.speedStart);
      expect(l.goals[0].target).toBeGreaterThan(0);
      expect(l.goals[1].target).toBeGreaterThan(0);
      if (l.bossAtMs !== undefined) {
        expect(l.bossAtMs).toBeLessThan(l.durationMs);
      }
      // 章节内顺序应与全局顺序一致
      if (i > 0) {
        const prev = LEVELS[i - 1];
        expect(l.chapter >= prev.chapter).toBe(true);
      }
    });
    // 每章 3 关
    CHAPTERS.forEach(c => {
      expect(LEVELS.filter(l => l.chapter === c.index).length).toBe(3);
    });
  });
});

// 星级里程碑与结局文案
describe('星级里程碑与结局文案', () => {
  it('里程碑只发新跨过的那些,重复不会重复发', () => {
    expect(newlyReachedMilestones(0, 4).length).toBe(0);
    expect(newlyReachedMilestones(0, 5).map(m => m.stars)).toEqual([5]);
    expect(newlyReachedMilestones(4, 11).map(m => m.stars)).toEqual([5, 10]);
    // 星数没涨:不发
    expect(newlyReachedMilestones(10, 10).length).toBe(0);
    // 一次跨很多档:全部按顺序发
    expect(newlyReachedMilestones(0, 54).map(m => m.stars)).toEqual(STAR_MILESTONES.map(m => m.stars));
  });

  it('里程碑奖励是递增的,并且最后一档正好是满星', () => {
    let last = 0;
    STAR_MILESTONES.forEach(m => {
      expect(m.stars).toBeGreaterThan(last);
      expect(m.coins).toBeGreaterThan(0);
      last = m.stars;
    });
    expect(STAR_MILESTONES[STAR_MILESTONES.length - 1].stars).toBe(TOTAL_STARS);
  });

  it('下一个里程碑提示', () => {
    expect(nextMilestone(0)?.stars).toBe(5);
    expect(nextMilestone(4)?.stars).toBe(5);
    expect(nextMilestone(5)?.stars).toBe(10);
    expect(nextMilestone(TOTAL_STARS)).toBe(null);
  });

  it('通关文案按星级分档', () => {
    expect(clearLine(1)).not.toBe(clearLine(3));
    expect(clearLine(3).length).toBeGreaterThan(0);
    // 越界不崩
    expect(clearLine(0).length).toBeGreaterThan(0);
    expect(clearLine(9).length).toBeGreaterThan(0);
  });

  it('落马文案按推进程度分档,且每章都有词', () => {
    CHAPTERS.forEach(ch => {
      const level = LEVELS.find(l => l.chapter === ch.index)!;
      const early = landfallLine(level, 0.1);
      const mid = landfallLine(level, 0.6);
      const late = landfallLine(level, 0.95);
      expect(early.length).toBeGreaterThan(0);
      // 三档应当是三句不同的话
      expect(new Set([early, mid, late]).size).toBe(3);
    });
  });
});

// 章节氛围:每章一套色调,关卡内逐渐变暗
describe('章节氛围', () => {
  it('每章都有独立配色,且都是合法色值', () => {
    expect(CHAPTER_MOODS.length).toBe(CHAPTERS.length);
    CHAPTER_MOODS.forEach(m => {
      [m.skyStart, m.skyEnd].forEach(c => {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffffff);
      });
      expect(m.nightStart).toBeGreaterThanOrEqual(0);
      expect(m.nightEnd).toBeLessThanOrEqual(1);
      // 关卡内只会越来越暗
      expect(m.nightEnd).toBeGreaterThanOrEqual(m.nightStart);
    });
  });

  it('关卡开场用起始色,结束时用结束色', () => {
    LEVELS.forEach(l => {
      const mood = CHAPTER_MOODS[l.chapter];
      expect(chapterMoodAt(l, 0).sky).toBe(mood.skyStart);
      expect(chapterMoodAt(l, l.durationMs).sky).toBe(mood.skyEnd);
      expect(chapterMoodAt(l, 0).nightness).toBeCloseTo(mood.nightStart, 5);
      expect(chapterMoodAt(l, l.durationMs).nightness).toBeCloseTo(mood.nightEnd, 5);
    });
  });

  it('时间越久越暗,且超出时长不会爆掉', () => {
    const l = LEVELS[15];
    const early = chapterMoodAt(l, l.durationMs * 0.2).nightness;
    const late = chapterMoodAt(l, l.durationMs * 0.8).nightness;
    expect(late).toBeGreaterThan(early);
    expect(chapterMoodAt(l, l.durationMs * 5).nightness).toBe(CHAPTER_MOODS[l.chapter].nightEnd);
  });

  it('后面几章比第一章暗,营造递进压迫感', () => {
    expect(CHAPTER_MOODS[5].nightStart).toBeGreaterThan(CHAPTER_MOODS[0].nightStart);
    expect(CHAPTER_MOODS[5].nightEnd).toBeGreaterThan(CHAPTER_MOODS[0].nightEnd);
  });
});

// 终局双结局
describe('终局双结局', () => {
  it('星级够高才「全身而退」,否则「人赃俱获」', () => {
    expect(finalEnding(TOTAL_STARS).id).toBe('clean');
    expect(finalEnding(ENDING_CLEAN.minStars).id).toBe('clean');
    expect(finalEnding(ENDING_CLEAN.minStars - 1).id).toBe('caught');
    expect(finalEnding(0).id).toBe('caught');
  });

  it('两个结局的文案与配色完整', () => {
    [ENDING_CLEAN, ENDING_CAUGHT].forEach(e => {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.subtitle.length).toBeGreaterThan(0);
      expect(e.body.length).toBeGreaterThan(0);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
    expect(ENDING_CLEAN.color).not.toBe(ENDING_CAUGHT.color);
  });

  it('跑完最后一关才算跑完主线', () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(isCampaignFinished({})).toBe(false);
    expect(isCampaignFinished({ [last.id]: 1 })).toBe(true);
    expect(isCampaignFinished({ 'l1-1': 3 })).toBe(false);
  });
});

// 留置室横版闯关:地图解析、碰撞盒合并、实体提取与数值
describe('留置室横版闯关 · 地图解析', () => {
  it('所有关卡地图每行等宽,且只含合法字符', () => {
    DUNGEON_LEVELS.forEach(lv => {
      const widths = new Set(lv.map.map(r => r.length));
      expect(widths.size).toBe(1);
      lv.map.forEach(row => {
        Array.from(row).forEach(ch => {
          expect(DG_LEGEND.includes(ch)).toBe(true);
        });
      });
    });
  });

  it('每关都有出生点和出口,BOSS 关有 BOSS', () => {
    DUNGEON_LEVELS.forEach(lv => {
      const p = parseDungeon(lv.map);
      expect(p.playerStart.x).toBeGreaterThan(0);
      expect(p.goal).not.toBe(null);
      expect(p.widthPx).toBeGreaterThan(DG_TILE * 40);
    });
    const last = DUNGEON_LEVELS[DUNGEON_LEVELS.length - 1];
    expect(parseDungeon(last.map).boss).not.toBe(null);
    expect(parseDungeon(DUNGEON_LEVELS[0].map).boss).toBe(null);
  });

  it('水平平台被合并成一块,而不是一堆小格子', () => {
    const p = parseDungeon(DUNGEON_LEVELS[0].map);
    // 第一关只有地面 + 3 块平台,合并后碰撞体应当是十几块以内
    expect(p.colliders.length).toBeLessThan(20);
    expect(p.colliders.length).toBeGreaterThan(2);
    // 地面这一块应当横跨整个关卡宽度
    const widest = p.colliders.reduce((a, b) => (a.w > b.w ? a : b));
    expect(widest.w).toBeGreaterThanOrEqual(28 * DG_TILE);
    expect(widest.h % DG_TILE).toBe(0);
  });

  it('垂直堆叠的地块合并成同一个矩形', () => {
    const p = parseDungeon(['##', '##', '..']);
    expect(p.colliders.length).toBe(1);
    expect(p.colliders[0]).toEqual({ x: 0, y: 0, w: DG_TILE * 2, h: DG_TILE * 2 });
  });

  it('实体位置落在格子底部,便于贴地摆放', () => {
    const p = parseDungeon(['P..e', '####']);
    expect(p.playerStart).toEqual({ x: DG_TILE / 2, y: DG_TILE });
    expect(p.enemies[0]).toEqual({ x: DG_TILE * 3 + DG_TILE / 2, y: DG_TILE });
  });

  it('尖刺单独成块,不会和平台合并', () => {
    const p = parseDungeon(['.X.', '###']);
    expect(p.spikes.length).toBe(1);
    expect(p.spikes[0].w).toBeLessThan(DG_TILE);
    expect(p.colliders.length).toBe(1);
  });

  it('关卡解锁:第一层永远开放,后续需要上一层通关', () => {
    expect(isDungeonUnlocked('d1', {})).toBe(true);
    expect(isDungeonUnlocked('d2', {})).toBe(false);
    expect(isDungeonUnlocked('d2', { d1: 1 })).toBe(true);
    expect(nextDungeonId('d1')).toBe('d2');
    expect(nextDungeonId('d2')).toBe('d3');
    expect(nextDungeonId('d4')).toBe('d5');
    expect(nextDungeonId('d5')).toBe(null);
  });

  it('攻击盒朝向正确,命中判定是矩形相交', () => {
    const right = attackBox(100, 200, 1);
    const left = attackBox(100, 200, -1);
    expect(right.x).toBe(100);
    expect(left.x).toBe(100 - DG_ATTACK_RANGE);
    // 正前方 30px 的敌人应当被打到
    expect(boxesOverlap(right.x, right.y, right.w, right.h, 130, 180, 40, 40)).toBe(true);
    // 身后的敌人打不到
    expect(boxesOverlap(right.x, right.y, right.w, right.h, 40, 180, 40, 40)).toBe(false);
  });

  it('冲刺冷却判定', () => {
    expect(canDash(1000, 900)).toBe(true);
    expect(canDash(800, 900)).toBe(false);
  });

  it('数值都在可玩范围内(不会出现负血量/零速)', () => {
    expect(DG_PLAYER_MAX_HP).toBeGreaterThan(0);
    expect(DG_PLAYER_SPEED).toBeGreaterThan(0);
    expect(DG_PLAYER_JUMP).toBeGreaterThan(0);
    expect(DG_DOUBLE_JUMP_RATIO).toBeGreaterThan(0);
    expect(DG_DOUBLE_JUMP_RATIO).toBeLessThanOrEqual(1);
    expect(DG_BOSS_HP).toBeGreaterThan(DG_ATTACK_DAMAGE);
    expect(DG_DASH_MS).toBeLessThan(DG_DASH_COOLDOWN_MS);
    expect(DG_ATTACK_MS).toBeLessThan(DG_ATTACK_COOLDOWN_MS);
  });
});

// 技能与 MP
describe('留置室技能与 MP', () => {
  it('MP 不够或冷却没好都放不出技能', () => {
    expect(canUseSkill(30, 1000, 0, DG_SKILL_REPORT.cost)).toBe(true);
    expect(canUseSkill(10, 1000, 0, DG_SKILL_REPORT.cost)).toBe(false);
    expect(canUseSkill(100, 500, 800, DG_SKILL_REPORT.cost)).toBe(false);
  });

  it('回蓝按时间累加并封顶,不会超上限也不会负数', () => {
    expect(regenMp(0, 1000)).toBeCloseTo(DG_MP_REGEN_PER_SEC, 5);
    expect(regenMp(50, 0)).toBe(50);
    expect(regenMp(99, 10000)).toBe(DG_PLAYER_MAX_MP);
    expect(regenMp(-5, 100)).toBeGreaterThanOrEqual(0);
  });

  it('两段技能消耗不同,冷却时长的比例用于 HUD 遮罩', () => {
    expect(DG_SKILL_REPORT.cost).toBeLessThan(DG_SKILL_SHIELD.cost);
    expect(DG_SKILL_SHIELD.cooldownMs).toBeGreaterThan(DG_SKILL_REPORT.cooldownMs);
    expect(skillCooldownRatio(1000, 1000, 400)).toBe(0);
    expect(skillCooldownRatio(800, 1000, 400)).toBeCloseTo(0.5, 5);
    expect(skillCooldownRatio(0, 1000, 400)).toBe(1);
    expect(skillCooldownRatio(0, 1000, 0)).toBe(0);
  });

  it('圆形范围判定', () => {
    expect(inRadius(0, 0, 100, 0, 120)).toBe(true);
    expect(inRadius(0, 0, 200, 0, 120)).toBe(false);
    // 边界上算命中
    expect(inRadius(0, 0, 120, 0, 120)).toBe(true);
  });

  it('三关按顺序解锁,最终关有 BOSS', () => {
    expect(DUNGEON_LEVELS.map(l => l.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
    expect(isDungeonUnlocked('d2', {})).toBe(false);
    expect(isDungeonUnlocked('d2', { d1: 1 })).toBe(true);
    expect(isDungeonUnlocked('d3', { d1: 1, d2: 1 })).toBe(true);
    const last = DUNGEON_LEVELS[DUNGEON_LEVELS.length - 1];
    expect(parseDungeon(last.map).boss).not.toBe(null);
    expect(parseDungeon(DUNGEON_LEVELS[1].map).boss).toBe(null);
  });

  it('技能数值在合理范围', () => {
    expect(DG_SKILL_REPORT.damage).toBeGreaterThan(DG_ATTACK_DAMAGE);
    expect(DG_SKILL_REPORT.speed).toBeGreaterThan(0);
    expect(DG_SKILL_SHIELD.shieldMs).toBeGreaterThan(DG_INVULN_MS);
    expect(DG_SKILL_SHIELD.radius).toBeGreaterThan(100);
    expect(DG_MP_ON_KILL).toBeGreaterThan(0);
  });
});


// 新敌人 / 拾取 / 连击加成
describe('横版深加工:新实体与连击', () => {
  it('三关地图都包含新实体类型,且都能解析出来', () => {
    const all = DUNGEON_LEVELS.map(l => parseDungeon(l.map));
    expect(all.some(p => p.throwers.length > 0)).toBe(true);
    expect(all.some(p => p.chargers.length > 0)).toBe(true);
    expect(all.some(p => p.chests.length > 0)).toBe(true);
    expect(all.some(p => p.wines.length > 0)).toBe(true);
    expect(all.some(p => p.cards.length > 0)).toBe(true);
    expect(all.every(p => p.checkpoints.length > 0)).toBe(true);
  });

  it('远程兵与冲锋兵血量不同,各有分工', () => {
    expect(DG_THROWER_HP).toBeGreaterThan(0);
    expect(DG_CHARGER_HP).toBeGreaterThan(DG_THROWER_HP);
  });

  it('连击越高伤害越高,分两档', () => {
    expect(comboDamageBonus(0)).toBe(0);
    expect(comboDamageBonus(5)).toBe(0);
    expect(comboDamageBonus(6)).toBe(1);
    expect(comboDamageBonus(11)).toBe(1);
    expect(comboDamageBonus(12)).toBe(2);
    expect(comboDamageBonus(99)).toBe(2);
  });

  it('近战伤害 = 基础 + 连击 + 茅台增益', () => {
    expect(playerMeleeDamage(0, false)).toBe(DG_ATTACK_DAMAGE);
    expect(playerMeleeDamage(6, false)).toBe(DG_ATTACK_DAMAGE + 1);
    expect(playerMeleeDamage(12, false)).toBe(DG_ATTACK_DAMAGE + 2);
    expect(playerMeleeDamage(12, true)).toBe(DG_ATTACK_DAMAGE + 2 + DG_WINE_DAMAGE_BONUS);
  });

  it('拾取增益有实际数值', () => {
    expect(DG_CARD_MP).toBeGreaterThan(0);
    expect(DG_CHEST_COINS).toBeGreaterThan(0);
    expect(DG_WINE_DAMAGE_BONUS).toBeGreaterThan(0);
  });
});


// 房产证与关卡扩充
describe('横版:房产证与新关卡', () => {
  it('房产证出现在关卡里,解析正常', () => {
    const all = DUNGEON_LEVELS.map(l => parseDungeon(l.map));
    expect(all.some(p => p.deeds.length > 0)).toBe(true);
  });

  it('共 5 关,逐层解锁,最终关有 BOSS', () => {
    expect(DUNGEON_LEVELS.length).toBe(5);
    const ids = DUNGEON_LEVELS.map(l => l.id);
    expect(isDungeonUnlocked(ids[0], {})).toBe(true);
    for (let i = 1; i < ids.length; i++) {
      const cleared: Record<string, number> = {};
      for (let j = 0; j < i; j++) cleared[ids[j]] = 1;
      expect(isDungeonUnlocked(ids[i], cleared)).toBe(true);
      // 缺上一关就应该锁着
      delete cleared[ids[i - 1]];
      expect(isDungeonUnlocked(ids[i], cleared)).toBe(false);
    }
    const lastParsed = parseDungeon(DUNGEON_LEVELS[4].map);
    expect(lastParsed.boss).not.toBe(null);
  });

  it('每关都有独立标语,楼梯间是竖长关卡,天台有风', () => {
    const subtitles = new Set(DUNGEON_LEVELS.map(l => l.subtitle));
    expect(subtitles.size).toBe(DUNGEON_LEVELS.length);
    const stair = parseDungeon(DUNGEON_LEVELS[2].map);
    expect(stair.heightPx).toBeGreaterThan(stair.widthPx * 0.4);   // 竖长
    expect(DUNGEON_LEVELS[3].windX).toBeLessThan(0);              // 天台往左吹
    expect(DUNGEON_LEVELS[0].windX).toBeUndefined();
  });

  it('房产证上限与硬上限合理', () => {
    expect(DG_DEED_MAX_HP).toBe(1);
    expect(DG_MAX_HP_CAP).toBeGreaterThan(DG_PLAYER_MAX_HP);
  });
});

// 贪官养成:资产 / 人脉 / 审查
describe('贪官养成系统', () => {
  const empty: Holdings = { assets: {}, network: {}, laundered: 0 };

  it('造价随等级递增,满级后返回 null', () => {
    const a = ASSETS[0];
    expect(nextCost(a, 0)).toBe(a.baseCost);
    expect(nextCost(a, 1)!).toBeGreaterThan(nextCost(a, 0)!);
    expect(nextCost(a, a.maxLevel)).toBe(null);
  });

  it('收益随资产等级线性增长,人脉提供百分比加成', () => {
    expect(incomePerMin(empty)).toBe(0);
    const onePurple = { assets: { purse: 3 }, network: {}, laundered: 0 };
    expect(incomePerMin(onePurple)).toBe(ASSETS[0].incomePerMin * 3);
    // 秘书小王每级 +8% 收益
    const withSecretary = { assets: { purse: 3 }, network: { secretary: 1 }, laundered: 0 };
    expect(incomePerMin(withSecretary)).toBeGreaterThan(incomePerMin(onePurple));
  });

  it('风险 = 资产风险 - 人脉保护 - 洗白,且夹在 0~100', () => {
    const rich = { assets: { purse: 2, villa: 2 }, network: {}, laundered: 0 };
    expect(rawRisk(rich)).toBe(ASSETS[0].risk * 2 + ASSETS[1].risk * 2);
    expect(netRisk(rich)).toBe(rawRisk(rich));
    const guarded = { ...rich, network: { mentor: 2, accountant: 1 } };
    expect(netRisk(guarded)).toBe(Math.max(0, rawRisk(rich) - protection(guarded)));
    // 洗白会再把风险压下去
    expect(netRisk({ ...rich, laundered: 5 })).toBe(rawRisk(rich) - 5);
    // 保护足够多时不会出现负风险
    expect(netRisk({ assets: { purse: 1 }, network: { mentor: 5, accountant: 5 }, laundered: 0 })).toBe(0);
  });

  it('离线收益按时长结算,超过 12 小时按上限', () => {
    const h = { assets: { purse: 5 }, network: {}, laundered: 0 };
    const perMin = incomePerMin(h);
    expect(accrueOffline(h, 60000).coins).toBe(perMin);
    expect(accrueOffline(h, 0).coins).toBe(0);
    const capped = accrueOffline(h, MAX_OFFLINE_MS * 3);
    expect(capped.capped).toBe(true);
    expect(capped.coins).toBe(Math.floor((perMin * MAX_OFFLINE_MS) / 60000));
  });

  it('没有资产就不会被审查', () => {
    const r = resolveAudit(empty, 100, 0, 0);
    expect(r.triggered).toBe(false);
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('风险越高越容易被查,roll 大则蒙混过关', () => {
    const h = { assets: { estate: 2 }, network: {}, laundered: 0 };  // 44 风险
    const caught = resolveAudit(h, 1000, 0, 0);
    expect(caught.triggered).toBe(true);
    expect(caught.passed).toBe(false);
    expect(caught.seizedAssetId).toBe('estate');
    expect(caught.fine).toBeGreaterThan(0);
    const escaped = resolveAudit(h, 1000, 0.99, 0);
    expect(escaped.triggered).toBe(false);
    expect(escaped.passed).toBe(true);
  });

  it('有审查豁免时不会丢资产', () => {
    const h = { assets: { estate: 2 }, network: { inspector: 1 }, laundered: 0 };
    const r = resolveAudit(h, 1000, 0, auditShield(h));
    expect(r.triggered).toBe(true);
    expect(r.shielded).toBe(true);
    expect(r.seizedAssetId).toBe(null);
  });

  it('没收的是价值最高的一项资产', () => {
    const h = { assets: { purse: 8, mine: 1 }, network: {}, laundered: 0 };
    const r = resolveAudit(h, 500, 0, 0);
    expect(r.seizedAssetId).toBe('mine');
    expect(r.fine).toBeLessThanOrEqual(500);
  });

  it('洗白成本与效果合理', () => {
    const h = { assets: { estate: 3 }, network: {}, laundered: 0 };
    expect(launderCost(h)).toBeGreaterThan(0);
    const eff = launderEffect(h);
    expect(eff).toBeGreaterThan(0);
    expect(eff).toBeLessThan(netRisk(h));
    expect(launderEffect(empty)).toBe(0);
  });

  it('资产与人脉数据自洽', () => {
    const assetIds = new Set<string>();
    ASSETS.forEach(a => {
      expect(assetIds.has(a.id)).toBe(false);
      assetIds.add(a.id);
      expect(a.baseCost).toBeGreaterThan(0);
      expect(a.costMul).toBeGreaterThan(1);
      expect(a.incomePerMin).toBeGreaterThan(0);
      expect(a.risk).toBeGreaterThan(0);
      expect(a.maxLevel).toBeGreaterThan(0);
    });
    // 越贵的资产风险越高、收益越高
    for (let i = 1; i < ASSETS.length; i++) {
      expect(ASSETS[i].risk).toBeGreaterThan(ASSETS[i - 1].risk);
      expect(ASSETS[i].incomePerMin).toBeGreaterThan(ASSETS[i - 1].incomePerMin);
    }
    NETWORK.forEach(n => {
      expect(n.baseCost).toBeGreaterThan(0);
      expect(n.protection + n.incomeBonus + n.auditShield).toBeGreaterThan(0);
    });
  });
});

// 资产对玩法的加成
describe('资产加成与家产总值', () => {
  const empty: Holdings = { assets: {}, network: {}, laundered: 0 };

  it('空资产时所有加成都是中性值', () => {
    const p = assetPerks(empty);
    expect(p.extraLives).toBe(0);
    expect(p.coinMul).toBe(1);
    expect(p.meleeBonus).toBe(0);
    expect(p.startMp).toBe(0);
    expect(p.rewardMul).toBe(1);
    expect(p.clearBonus).toBe(0);
  });

  it('各项资产给对应加成,且随等级提升', () => {
    const one = { assets: { shell: 1, villa: 2, mine: 2, offshore: 1, estate: 1, purse: 3 }, network: {}, laundered: 0 };
    const p = assetPerks(one);
    expect(p.coinMul).toBeCloseTo(1.04, 5);
    expect(p.extraLives).toBe(1);        // 别墅 2 级 → 1 顶
    expect(p.meleeBonus).toBe(1);        // 煤矿 2 级 → +1
    expect(p.startMp).toBe(12);
    expect(p.rewardMul).toBeCloseTo(1.05, 5);
    expect(p.clearBonus).toBe(6);        // 小金库 3 级 ×2

    const many = { assets: { shell: 5, villa: 5, mine: 6, offshore: 3, estate: 3, purse: 8 }, network: {}, laundered: 0 };
    const q = assetPerks(many);
    expect(q.coinMul).toBeGreaterThan(p.coinMul);
    expect(q.extraLives).toBeGreaterThan(p.extraLives);
    expect(q.meleeBonus).toBeLessThanOrEqual(3);   // 近战加成有上限
  });

  it('家产总值随建造增长,且只算资产不算人脉', () => {
    expect(totalAssetValue(empty)).toBe(0);
    const onePurse = { assets: { purse: 1 }, network: {}, laundered: 0 };
    expect(totalAssetValue(onePurse)).toBe(ASSETS[0].baseCost);
    const twoPurse = { assets: { purse: 2 }, network: {}, laundered: 0 };
    expect(totalAssetValue(twoPurse)).toBeGreaterThan(totalAssetValue(onePurse));
    // 人脉不计入家产
    expect(totalAssetValue({ assets: { purse: 1 }, network: { mentor: 5 }, laundered: 0 }))
      .toBe(totalAssetValue(onePurse));
  });

  it('每项资产都有玩法说明文案', () => {
    ASSETS.forEach(a => {
      expect(ASSET_PERK_TEXT[a.id]).toBeTruthy();
    });
  });
});

// 风向 / 家产称号 / 新闻
describe('风向、称号与新闻', () => {
  it('风向按时间窗确定性变化,不相邻重复太多', () => {
    const a = currentWind(0);
    const b = currentWind(0 + WIND_WINDOW_MS);
    expect(a.windowIndex).toBe(0);
    expect(b.windowIndex).toBe(1);
    expect(a.wind.id).toBe(currentWind(1000).wind.id);   // 同一窗口内不变
    expect(WINDS.some(w => w.id === a.wind.id)).toBe(true);
    // 10 个连续窗口里至少出现 2 种不同风向
    const ids = new Set<number>();
    for (let i = 0; i < 10; i++) ids.add(currentWind(i * WIND_WINDOW_MS).windowIndex);
    expect(ids.size).toBe(10);
  });

  it('风向影响收益与风险', () => {
    const h: Holdings = { assets: { estate: 2 }, network: {}, laundered: 0 };
    const calm = WINDS.find(w => w.id === 'calm')!;
    const boom = WINDS.find(w => w.id === 'boom')!;
    expect(incomePerMinWithWind(h, boom)).toBeGreaterThan(incomePerMin(h));
    expect(incomePerMinWithWind(h, calm)).toBe(incomePerMin(h));
    expect(netRiskWithWind(h, calm)).toBeLessThan(netRisk(h));
    expect(netRiskWithWind(h, WINDS.find(w => w.id === 'inspection')!)).toBeGreaterThan(netRisk(h));
    // 风险仍然夹在 0~100
    const huge: Holdings = { assets: { estate: 6 }, network: {}, laundered: 0 };
    expect(netRiskWithWind(huge, WINDS.find(w => w.id === 'inspection')!)).toBeLessThanOrEqual(100);
  });

  it('家产称号随总值升级', () => {
    expect(assetTitle(0).name).toBe('白手套');
    expect(assetTitle(2999).name).toBe('白手套');
    expect(assetTitle(3000).name).toBe('操盘手');
    expect(assetTitle(60000).name).toBe('一方诸侯');
    expect(assetTitle(207_000).name).toBe('隐形富豪');
    ASSET_TITLES.forEach(t => expect(t.color).toMatch(/^#[0-9a-f]{6}$/i));
  });

  it('新闻文案分被查与过关两套', () => {
    for (const seed of [0.1, 0.5, 0.9]) {
      expect(newsFor(true, seed).length).toBeGreaterThan(6);
      expect(newsFor(false, seed).length).toBeGreaterThan(6);
    }
    expect(newsFor(true, 0.3)).not.toBe(newsFor(false, 0.3));
  });
});

// 资产相关成就
describe('贪官养成成就', () => {
  const base = () => {
    const p = JSON.parse(JSON.stringify({
      coins: 0, totalDodged: 0, owned: [], pendant: '', extraLives: 0, skin: '',
      bribeMoon: 0, saveVersion: 2, bestTimeMs: 0, bestDodged: 0, bestCombo: 0,
      totalRuns: 0, totalTimeMs: 0, totalKills: 0, totalPickups: 0, totalSpent: 0,
      inspectionsSurvived: 0, achievements: [], daily: null, lastLoginDate: '',
      loginStreak: 0, pistolLevel: 0, bribeCarryLevel: 0, tutorialDone: false,
      bestRankIndex: 0, missionsDone: 0, overdrives: 0, nearMisses: 0, dailyPlays: 0,
      levelStars: {}, levelClears: 0, perfectSlides: 0, starMilestones: [],
      dungeonCleared: {}, redeemBonus: 0,
      assets: {}, network: {}, laundered: 0, lastAccrualAt: 0, lastAuditAt: 0,
      auditsSurvived: 0, assetsSeized: 0
    }));
    return p;
  };

  it('建第一项家产就拿到「第一个抽屉」', () => {
    const p = base();
    expect(ACHIEVEMENTS.find(a => a.id === 'first-asset')!.check(p)).toBe(false);
    p.assets = { purse: 1 };
    expect(ACHIEVEMENTS.find(a => a.id === 'first-asset')!.check(p)).toBe(true);
  });

  it('家产万元与百万成就按总值判定', () => {
    const p = base();
    const a10k = ACHIEVEMENTS.find(a => a.id === 'asset-10k')!;
    const a1m = ACHIEVEMENTS.find(a => a.id === 'asset-1m')!;
    p.assets = { purse: 3 };
    expect(a10k.check(p)).toBe(false);
    p.assets = { estate: 3 };   // 2400+4080+6936 = 13416
    expect(a10k.check(p)).toBe(true);
    expect(a1m.check(p)).toBe(false);
    // 全满级约 20.8 万,应当能拿到「一方诸侯」
    p.assets = { purse: 8, villa: 8, shell: 8, mine: 8, offshore: 6, estate: 6 };
    expect(a1m.check(p)).toBe(true);
  });

  it('人脉总等级与审查统计类成就', () => {
    const p = base();
    const net = ACHIEVEMENTS.find(a => a.id === 'network-10')!;
    p.network = { mentor: 5 };
    expect(net.check(p)).toBe(false);
    p.network = { mentor: 5, accountant: 5 };
    expect(net.check(p)).toBe(true);
    expect(ACHIEVEMENTS.find(a => a.id === 'audit-5')!.check({ ...p, auditsSurvived: 5 })).toBe(true);
    expect(ACHIEVEMENTS.find(a => a.id === 'seized-3')!.check({ ...p, assetsSeized: 3 })).toBe(true);
  });

  it('新成就都有奖励且 id 唯一', () => {
    const ids = new Set<string>();
    ACHIEVEMENTS.forEach(a => {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(a.reward).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
    });
  });
});

// 离线收益结算与时长格式
describe('离线收益结算', () => {
  it('时长格式化成小时/分钟', () => {
    expect(formatDuration(0)).toBe('0 分钟');
    expect(formatDuration(45 * 60 * 1000)).toBe('45 分钟');
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2 小时');
    expect(formatDuration((2 * 60 + 30) * 60 * 1000)).toBe('2 小时 30 分');
  });
});

// 「下一步做什么」提示
describe('下一步提示', () => {
  const mk = (over: Record<string, unknown> = {}) => {
    const p = JSON.parse(JSON.stringify({
      coins: 0, totalDodged: 0, owned: [], pendant: '', extraLives: 0, skin: '',
      bribeMoon: 0, saveVersion: 2, bestTimeMs: 0, bestDodged: 0, bestCombo: 0,
      totalRuns: 0, totalTimeMs: 0, totalKills: 0, totalPickups: 0, totalSpent: 0,
      inspectionsSurvived: 0, achievements: [], daily: null, lastLoginDate: '',
      loginStreak: 0, pistolLevel: 0, bribeCarryLevel: 0, tutorialDone: false,
      bestRankIndex: 0, missionsDone: 0, overdrives: 0, nearMisses: 0, dailyPlays: 0,
      levelStars: {}, levelClears: 0, perfectSlides: 0, starMilestones: [],
      dungeonCleared: {}, redeemBonus: 0,
      assets: {}, network: {}, laundered: 0, lastAccrualAt: 0, lastAuditAt: 0,
      auditsSurvived: 0, assetsSeized: 0, assetsIntroDone: true
    }));
    return { ...p, ...over };
  };

  it('没有家产时提示去盖产业', () => {
    const r = nextStep(mk());
    expect(r?.scene).toBe('Assets');
    expect(r?.text).toContain('第一项产业');
  });

  it('风险过高优先提示洗白', () => {
    const r = nextStep(mk({ assets: { estate: 6 } }));
    expect(r?.scene).toBe('Assets');
    expect(r?.tone).toBe('urgent');
    expect(r?.text).toContain('被查风险');
  });

  it('有家产后提示去打通主线', () => {
    const r = nextStep(mk({ assets: { purse: 3 } }));
    expect(r?.scene).toBe('Campaign');
    expect(r?.text).toContain('还没过');
  });

  it('主线满星后提示清每日任务', () => {
    const stars: Record<string, number> = {};
    LEVELS.forEach(l => { stars[l.id] = 3; });
    const r = nextStep(mk({ assets: { purse: 3 }, levelStars: stars }));
    expect(r?.scene).toBe('Quest');
  });

  it('提示永远带场景与文案', () => {
    const cases = [mk(), mk({ assets: { purse: 2 } }), mk({ assets: { estate: 6 } })];
    cases.forEach(p => {
      const r = nextStep(p);
      expect(r).not.toBe(null);
      expect(r!.text.length).toBeGreaterThan(3);
      expect(['Assets', 'Campaign', 'Quest']).toContain(r!.scene);
    });
  });
});

// 官场名人堂
describe('官场名人堂', () => {
  it('玩家被正确插进名次表,名次从 1 开始连续', () => {
    const rows = assetLeaderboard({ assets: { estate: 2 }, network: {}, laundered: 0 });
    expect(rows.length).toBe(RIVALS.length + 1);
    expect(rows.filter(r => r.isPlayer).length).toBe(1);
    rows.forEach((r, i) => expect(r.rank).toBe(i + 1));
    // 按家产从高到低
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    }
  });

  it('一穷二白时排最后', () => {
    const rows = assetLeaderboard({ assets: {}, network: {}, laundered: 0 });
    const me = rows.find(r => r.isPlayer)!;
    expect(me.rank).toBe(rows.length);
  });

  it('超过所有人后排第一', () => {
    // 全满级约 20.8 万,刚好能超过榜首(20 万)
    const rows = assetLeaderboard({ assets: { purse: 8, villa: 8, shell: 8, mine: 8, offshore: 6, estate: 6 }, network: {}, laundered: 0 });
    const me = rows.find(r => r.isPlayer)!;
    expect(me.rank).toBe(1);
  });

  it('给出「下一个要超过的对手」与差额', () => {
    const h: Holdings = { assets: { purse: 2 }, network: {}, laundered: 0 };
    const r = nextRival(h);
    expect(r.ahead).not.toBe(null);
    expect(r.gap).toBeGreaterThan(0);
    expect(r.ahead!.value).toBeGreaterThan(totalAssetValue(h));
    // 已经登顶时没有对手
    const top = nextRival({ assets: { purse: 8, villa: 8, shell: 8, mine: 8, offshore: 6, estate: 6 }, network: {}, laundered: 0 });
    expect(top.ahead).toBe(null);
    expect(top.gap).toBe(0);
  });

  it('对手名单按家产升序且都有评语', () => {
    for (let i = 1; i < RIVALS.length; i++) {
      expect(RIVALS[i].value).toBeGreaterThan(RIVALS[i - 1].value);
    }
    RIVALS.forEach(r => {
      expect(r.name.length).toBeGreaterThan(1);
      expect(r.taunt.length).toBeGreaterThan(3);
    });
  });
});

// 双货币:银币(公开收入) vs 黑金(赃款)
describe('双货币体系', () => {
  const purse = ASSETS[0];

  it('首建花银币,升级花黑金', () => {
    const build = quoteCost(purse, 0)!;
    expect(build.currency).toBe('coin');
    expect(build.amount).toBe(purse.baseCost);
    const up1 = quoteCost(purse, 1)!;
    expect(up1.currency).toBe('corrupt');
    expect(up1.amount).toBeGreaterThan(nextCost(purse, 1)!);
    // 满级没有报价
    expect(quoteCost(purse, purse.maxLevel)).toBe(null);
  });

  it('银币与黑金互不通用', () => {
    const build = quoteCost(purse, 0)!;
    const up = quoteCost(purse, 1)!;
    expect(canAfford({ coins: 1000, corrupt: 0 }, build)).toBe(true);
    expect(canAfford({ coins: 1000, corrupt: 0 }, up)).toBe(false);   // 只有银币升不了级
    expect(canAfford({ coins: 0, corrupt: 100000 }, up)).toBe(true);
    expect(canAfford({ coins: 0, corrupt: 100000 }, build)).toBe(false); // 只有黑金盖不了新房
  });

  it('打点与洗白按黑金计价', () => {
    expect(bribeCost(10)).toBe(200);
    expect(bribeCost(0)).toBe(80);      // 最低 80
    const h: Holdings = { assets: { estate: 2 }, network: {}, laundered: 0 };
    expect(launderCost(h)).toBeGreaterThan(0);
  });
});
