import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress, saveProgress } from '../systems/progress';
import { makeButton, makeHeroButton, showToast, FONT } from '../systems/ui';
import { startBgm } from '../systems/audio';
import { DAILY_TASKS, getDaily, claimDailyReward, dailyCompletedCount, dailyAllDone, DAILY_ALL_BONUS } from '../systems/daily';
import { ACHIEVEMENTS, claimNewAchievements } from '../systems/achievements';
import { isWx, wxPostLeaderboard } from '../systems/wxapi';
import { buildMenuBackdrop, buildMenuHeader, addMenuCard, addMenuFooter } from '../systems/menu';

type Tab = 'daily' | 'achieve' | 'rank';

export default class QuestScene extends Phaser.Scene {
  private tab: Tab = 'daily';

  constructor() { super('Quest'); }

  init(data: { tab?: Tab }) {
    this.tab = data?.tab ?? 'daily';
  }

  create() {
    startBgm(this);
    const p = loadProgress();
    buildMenuBackdrop(this, { mood: 'night' });
    buildMenuHeader(this, '任务 · 成就 · 排行', '每天都有新目标,别让仕途停下来', { coins: p.coins });

    const tabs: { id: Tab; label: string; icon: string }[] = [
      { id: 'daily', label: '每日任务', icon: 'ui-calendar' },
      { id: 'achieve', label: '成就', icon: 'ui-trophy' },
      { id: 'rank', label: '排行', icon: 'ui-rank' }
    ];
    tabs.forEach((t, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * 168;
      const active = this.tab === t.id;
      const g = this.add.graphics().setDepth(21);
      const w = 154;
      const h = 36;
      g.fillStyle(active ? 0xffd43b : 0x0b1b31, active ? 1 : 0.82);
      g.fillRoundedRect(x - w / 2, 106 - h / 2, w, h, h / 2);
      g.lineStyle(1.6, active ? 0xfff3c4 : 0xffffff, active ? 0.9 : 0.18);
      g.strokeRoundedRect(x - w / 2, 106 - h / 2, w, h, h / 2);
      const label = this.add
        .text(0, 106, t.label, {
          fontFamily: FONT, fontSize: '15px', color: active ? '#3d2a00' : '#cfe3ff',
          fontStyle: 'bold', resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);
      const iconSize = 16;
      const gap = 6;
      const total = iconSize + gap + label.width;
      this.add
        .image(x - total / 2 + iconSize / 2, 106, t.icon)
        .setDisplaySize(iconSize, iconSize)
        .setAlpha(active ? 1 : 0.72)
        .setDepth(22);
      label.setX(x - total / 2 + iconSize + gap + label.width / 2);
      const hit = this.add
        .rectangle(x, 106, w, h, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(23);
      hit.on('pointerdown', () => { if (this.tab !== t.id) this.scene.restart({ tab: t.id }); });
    });

    if (this.tab === 'daily') this.drawDaily();
    else if (this.tab === 'achieve') this.drawAchievements();
    else this.drawRank();
  }

  // ---- 每日任务 ----
  private drawDaily() {
    const p = loadProgress();
    const d = getDaily(p);
    saveProgress(p); // 跨天翻转写回

    addMenuCard(this, 170, 136, 620, 30, { depth: 21 });
    const streakText = this.add
      .text(0, 151, `连续签到 ${p.loginStreak} 天 · 每日 +20 银币 · 连签 7 天 +100`, {
        fontFamily: FONT, fontSize: '12px', color: '#ffe066', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(22);
    const streakIcon = 14;
    const streakGap = 6;
    const streakTotal = streakIcon + streakGap + streakText.width;
    this.add
      .image(GAME_WIDTH / 2 - streakTotal / 2 + streakIcon / 2, 151, 'ui-calendar')
      .setDisplaySize(streakIcon, streakIcon)
      .setDepth(22);
    streakText.setX(GAME_WIDTH / 2 - streakTotal / 2 + streakIcon + streakGap + streakText.width / 2);

    DAILY_TASKS.forEach((task, i) => {
      const x = 170;
      const y = 180 + i * 60;
      const w = 620;
      const h = 50;
      const value = task.get(d);
      const done = value >= task.target;
      const pct = Math.min(1, value / task.target);
      addMenuCard(this, x, y, w, h, { highlight: done, depth: 21 });

      const taskIcon: Record<string, string> = {
        dodge: 'mi-dodge', survive: 'mi-survive', kill: 'mi-kill', pickup: 'mi-pickup'
      };
      this.add
        .image(x + 20, y + 25, done ? 'ui-check' : (taskIcon[task.id] ?? 'ui-target'))
        .setDisplaySize(17, 17)
        .setDepth(22);
      this.add
        .text(x + 40, y + 16, task.name, {
          fontFamily: FONT, fontSize: '14px', color: done ? '#8ce99a' : '#ffffff', fontStyle: 'bold', resolution: 2
        })
        .setDepth(22);

      // 进度条
      const barX = x + 168;
      const barW = 262;
      const barY = y + 24;
      const bg = this.add.graphics().setDepth(22);
      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(barX, barY, barW, 10, 5);
      if (pct > 0) {
        bg.fillStyle(done ? 0x69db7c : 0xffa94d, 1);
        bg.fillRoundedRect(barX, barY, Math.max(10, barW * pct), 10, 5);
      }

      const shown = task.unit === '秒' ? Math.floor(value / 1000) : value;
      this.add
        .text(barX + barW / 2, y + 16, `${shown}/${task.target}${task.unit}`, {
          fontFamily: FONT, fontSize: '10px', color: '#cfe3ff', resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);

      const rewardText = this.add
        .text(x + w - 18, y + h / 2, done ? '已达成' : `+${task.reward}`, {
          fontFamily: FONT, fontSize: '14px', color: done ? '#8ce99a' : '#ffe066', fontStyle: 'bold', resolution: 2
        })
        .setOrigin(1, 0.5)
        .setDepth(22);
      if (!done) {
        this.add
          .image(rewardText.x - rewardText.width - 12, y + h / 2, 'coin')
          .setDisplaySize(14, 14)
          .setDepth(22);
      }
    });

    const allDone = dailyAllDone(d);
    const total = DAILY_TASKS.reduce((s, t) => s + t.reward, 0) + DAILY_ALL_BONUS;
    const doneCount = dailyCompletedCount(d);
    const label = d.claimed
      ? '今日已领取'
      : allDone
        ? `领取全部奖励 ${total} 银币`
        : `完成 ${doneCount}/${DAILY_TASKS.length} · 全完成领 ${total} 银币`;
    const btn = makeHeroButton(this, GAME_WIDTH / 2, 446, 400, 56, label, () => {
      const cur = loadProgress();
      const reward = claimDailyReward(cur);
      if (reward > 0) {
        saveProgress(cur);
        showToast(this, GAME_WIDTH / 2, 504, `领取成功 +${reward} 银币!`, '#ffe066', 'ui-gift');
        this.scene.restart({ tab: 'daily' });
      } else {
        showToast(this, GAME_WIDTH / 2, 504, d.claimed ? '今天已领取过啦,明天再来!' : '还有任务未完成,继续加油!', '#ffe066', d.claimed ? 'ui-check' : 'ui-tips');
      }
    }, { fontSize: 19, iconKey: d.claimed ? undefined : 'ui-gift', iconSize: 24 });
    if (d.claimed) {
      btn.g.setAlpha(0.45);
      btn.text.setAlpha(0.7);
      btn.hit.disableInteractive();
    }

    addMenuFooter(this, '任务数据每局结束自动记录 · 跨天自动重置');
  }

  // ---- 成就 ----
  private drawAchievements() {
    const p = loadProgress();
    // 打开面板时补领遗漏的成就(判定为纯函数,安全)
    const newAch = claimNewAchievements(p);
    saveProgress(p);
    if (newAch.length > 0) {
      this.time.delayedCall(400, () => {
        showToast(this, GAME_WIDTH / 2, 500, `解锁 ${newAch.length} 项新成就!银币已入账`, '#ffe066', 'ui-trophy');
      });
    }

    const unlocked = new Set(p.achievements);
    this.add
      .text(GAME_WIDTH / 2, 133, `已解锁 ${unlocked.size}/${ACHIEVEMENTS.length} · 每项成就都会发放银币`, {
        fontFamily: FONT, fontSize: '11px', color: '#93b5d6', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);

    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 172 + col * 316;
      const y = 146 + row * 42;
      const got = unlocked.has(a.id);
      addMenuCard(this, x, y, 300, 38, { highlight: got, depth: 21 });
      this.add
        .image(x + 14, y + 19, got ? 'ui-check' : 'ui-lock')
        .setDisplaySize(14, 14)
        .setDepth(22);
      this.add
        .text(x + 30, y + 12, a.name, {
          fontFamily: FONT, fontSize: '12px', color: got ? '#8ce99a' : '#ffffff', fontStyle: 'bold', resolution: 2
        })
        .setDepth(22);
      const achReward = this.add
        .text(x + 288, y + 12, got ? '已获得' : `+${a.reward}`, {
          fontFamily: FONT, fontSize: '11px', color: got ? '#69db7c' : '#ffe066', resolution: 2
        })
        .setOrigin(1, 0)
        .setDepth(22);
      if (!got) {
        this.add
          .image(x + 288 - achReward.width - 10, y + 18, 'coin')
          .setDisplaySize(11, 11)
          .setDepth(22);
      }
      this.add
        .text(x + 30, y + 27, a.desc, {
          fontFamily: FONT, fontSize: '10px', color: '#8faecb', resolution: 2
        })
        .setDepth(22);
    });

    addMenuFooter(this, '成就进度自动保存 · 打开本页时自动补发奖励');
  }

  // ---- 排行 ----
  private drawRank() {
    const p = loadProgress();
    if (isWx()) {
      // 微信好友排行榜:开放数据域渲染到 sharedCanvas
      try {
        const oc = (window as any).wx?.getOpenDataContext?.();
        const sharedCanvas = oc?.canvas;
        if (sharedCanvas && this.textures.exists('leaderboard')) this.textures.remove('leaderboard');
        if (sharedCanvas && !this.textures.exists('leaderboard')) {
          this.textures.addCanvas('leaderboard', sharedCanvas);
        }
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'leaderboard').setDisplaySize(620, 340).setDepth(21);
        wxPostLeaderboard();
        // 定期刷新开放数据域画面
        this.time.addEvent({
          delay: 800,
          loop: true,
          callback: () => {
            try {
              const tex = this.textures.get('leaderboard') as Phaser.Textures.CanvasTexture;
              tex?.refresh();
            } catch { /* 刷新失败不影响游戏 */ }
          }
        });
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, '好友排行由微信提供,需好友也玩过本游戏', { fontFamily: FONT, fontSize: '12px', resolution: 2, color: '#cfe3ff' }).setOrigin(0.5).setDepth(21);
      } catch {
        this.drawLocalRank(p);
      }
    } else {
      this.drawLocalRank(p);
    }
  }

  private drawLocalRank(p: ReturnType<typeof loadProgress>) {
    const rankTitle = this.add
      .text(0, 138, '本机战绩', {
        fontFamily: FONT, fontSize: '16px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);
    const rankIcon = 18;
    const rankGap = 7;
    const rankTotal = rankIcon + rankGap + rankTitle.width;
    this.add
      .image(GAME_WIDTH / 2 - rankTotal / 2 + rankIcon / 2, 138, 'ui-rank')
      .setDisplaySize(rankIcon, rankIcon)
      .setDepth(21);
    rankTitle.setX(GAME_WIDTH / 2 - rankTotal / 2 + rankIcon + rankGap + rankTitle.width / 2);
    const rows: [string, string, string][] = [
      ['最佳存活', p.bestTimeMs ? `${(p.bestTimeMs / 1000).toFixed(1)} 秒` : '—', 'ui-clock'],
      ['单局最多翻越', p.bestDodged ? `${p.bestDodged} 个` : '—', 'mi-dodge'],
      ['最高连击', p.bestCombo ? `×${p.bestCombo}` : '—', 'mi-combo'],
      ['累计局数', `${p.totalRuns} 局`, 'ui-play'],
      ['累计游玩', `${Math.floor(p.totalTimeMs / 60000)} 分钟`, 'ui-clock'],
      ['累计翻越', `${p.totalDodged} 个`, 'ui-arrow-up'],
      ['累计击毁', `${p.totalKills} 个`, 'mi-kill'],
      ['巡视通过', `${p.inspectionsSurvived} 次`, 'ui-siren']
    ];
    rows.forEach(([name, val, icon], i) => {
      const y = 160 + i * 36;
      addMenuCard(this, 230, y, 500, 30, { depth: 21 });
      this.add
        .image(250, y + 15, icon)
        .setDisplaySize(16, 16)
        .setDepth(22)
        .setAlpha(0.9);
      this.add
        .text(268, y + 15, name, { fontFamily: FONT, fontSize: '13px', color: '#cfe3ff', resolution: 2 })
        .setOrigin(0, 0.5)
        .setDepth(22);
      this.add
        .text(710, y + 15, val, { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', resolution: 2 })
        .setOrigin(1, 0.5)
        .setDepth(22);
    });
    addMenuFooter(this, '微信小游戏版可查看好友排行榜');
  }
}
