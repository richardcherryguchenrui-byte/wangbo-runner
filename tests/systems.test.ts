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
  DAILY_TASKS
} from '../src/systems/daily';
import { exportSaveText, importSaveText, resetAllSaves } from '../src/systems/savebackup';
import { RUN_RANKS, rankAt, rankProgress } from '../src/systems/ranks';
import {
  MISSIONS, pickRunMission, missionDone, missionValue, missionProgressText,
  type MissionId, type MissionState
} from '../src/systems/missions';
import { generatePattern, stageFor, FLYER_Y } from '../src/systems/patterns';
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
