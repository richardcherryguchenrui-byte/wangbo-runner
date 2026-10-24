import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP } from '../config/constants';
import { loadProgress, getTitle } from '../systems/progress';
import { addPanel, makeButton, makeHeroButton, showToast, FONT } from '../systems/ui';
import { stopBgm, playSfx } from '../systems/audio';
import { confettiBurst } from '../systems/effects';
import { isWx, wxShare } from '../systems/wxapi';
import { buildShareCard, buildLevelShareCard, downloadCanvas } from '../systems/sharecard';
import { rankProgress } from '../systems/ranks';
import { gradeRun } from '../systems/grade';
import { CHAPTERS, TOTAL_STARS } from '../systems/levels';

interface ResultData {
  timeMs?: number;
  dodged?: number;
  coins?: number;
  combo?: number;
  isRecord?: boolean;
  newAchievements?: string[];
  rankIndex?: number;
  rankName?: string;
  rankColor?: string;
  missionTitle?: string;
  missionDone?: boolean;
  missionReward?: number;
  nearMisses?: number;
  overdrives?: number;
  hits?: number;
  missionsDone?: number;
  daily?: boolean;
  dailyReward?: number;
  dailyBestMs?: number;
  dailyRecord?: boolean;
  dailyFirst?: boolean;
  dailyModifier?: string;
  bestMs?: number;
  playerTexture?: string;
  // ---- 闯关模式 ----
  levelId?: string;
  levelCleared?: boolean;
  levelStars?: number;
  levelPrevStars?: number;
  levelGoals?: { label: string; done: boolean; value: number; target: number }[];
  levelNextId?: string | null;
  levelFirstClear?: boolean;
  levelReward?: number;
  levelName?: string;
  levelChapter?: number;
  levelEndingLine?: string;
  levelStarTotal?: number;
  levelMilestones?: { stars: number; coins: number; bribeMoon: number; label: string }[];
}

export default class ResultScene extends Phaser.Scene {
  private daily = false;
  private timeMs = 0;
  private dodged = 0;
  private coins = 0;
  private combo = 0;
  private isRecord = false;
  private newAch: string[] = [];
  private rankName = '科员';
  private rankColor = '#cfe3ff';
  private rankIndex = 0;
  private missionTitle = '';
  private missionDone = false;
  private missionReward = 0;
  private nearMisses = 0;
  private overdrives = 0;
  private hits = 0;
  private dailyReward = 0;
  private dailyBestMs = 0;
  private dailyRecord = false;
  private dailyFirst = false;
  private dailyModifier = '';
  private bestMs = 0;
  private playerTexture = 'player-idle';
  private leaving = false;
  // ---- 闯关模式 ----
  private levelId: string | null = null;
  private levelCleared = false;
  private levelStars = 0;
  private levelPrevStars = 0;
  private levelGoals: { label: string; done: boolean; value: number; target: number }[] = [];
  private levelNextId: string | null = null;
  private levelFirstClear = false;
  private levelReward = 0;
  private levelName = '';
  private levelChapter = 0;
  private levelEndingLine = '';
  private levelStarTotal = 0;
  private levelMilestones: { stars: number; coins: number; bribeMoon: number; label: string }[] = [];

  constructor() {
    super('Result');
  }

  init(data: ResultData) {
    this.timeMs = data?.timeMs ?? 0;
    this.dodged = data?.dodged ?? 0;
    this.coins = data?.coins ?? 0;
    this.combo = data?.combo ?? 0;
    this.isRecord = !!data?.isRecord;
    this.newAch = data?.newAchievements ?? [];
    this.rankName = data?.rankName ?? '科员';
    this.rankColor = data?.rankColor ?? '#cfe3ff';
    this.rankIndex = data?.rankIndex ?? 0;
    this.missionTitle = data?.missionTitle ?? '';
    this.missionDone = !!data?.missionDone;
    this.missionReward = data?.missionReward ?? 0;
    this.nearMisses = data?.nearMisses ?? 0;
    this.overdrives = data?.overdrives ?? 0;
    this.hits = data?.hits ?? 0;
    this.daily = !!data?.daily;
    this.dailyReward = data?.dailyReward ?? 0;
    this.dailyBestMs = data?.dailyBestMs ?? 0;
    this.dailyRecord = !!data?.dailyRecord;
    this.dailyFirst = !!data?.dailyFirst;
    this.dailyModifier = data?.dailyModifier ?? '';
    this.bestMs = data?.bestMs ?? 0;
    this.playerTexture = data?.playerTexture ?? 'player-idle';
    this.levelId = data?.levelId ?? null;
    this.levelCleared = !!data?.levelCleared;
    this.levelStars = data?.levelStars ?? 0;
    this.levelPrevStars = data?.levelPrevStars ?? 0;
    this.levelGoals = data?.levelGoals ?? [];
    this.levelNextId = data?.levelNextId ?? null;
    this.levelFirstClear = !!data?.levelFirstClear;
    this.levelReward = data?.levelReward ?? 0;
    this.levelName = data?.levelName ?? '';
    this.levelChapter = data?.levelChapter ?? 0;
    this.levelEndingLine = data?.levelEndingLine ?? '';
    this.levelStarTotal = data?.levelStarTotal ?? 0;
    this.levelMilestones = data?.levelMilestones ?? [];
  }

  create() {
    stopBgm(this);
    const p = loadProgress();
    this.buildBackdrop();

    // 闯关模式:走专属结算(星级 + 目标清单 + 下一关)
    if (this.levelId) {
      this.createLevelResult();
      return;
    }

    if (this.isRecord && this.timeMs > 0) {
      playSfx(this, 'record', 0.6);
      confettiBurst(this, GAME_WIDTH / 2, 100, 34);
      this.time.delayedCall(900, () => confettiBurst(this, GAME_WIDTH / 2, 30, 22));
    }

    // 主卡片
    addPanel(this, 120, 54, 720, 430, {
      fill: 0x0a1930,
      fillAlpha: 0.96,
      stroke: 0xffffff,
      strokeAlpha: 0.14,
      radius: 24
    }).setDepth(20);
    this.add
      .text(150, 72, '本局成绩单', {
        fontFamily: FONT, fontSize: '13px', color: '#9db8d8', fontStyle: 'bold', resolution: 2
      })
      .setDepth(21);
    this.add
      .text(150, 92, this.timeMs > 0 ? `${(this.timeMs / 1000).toFixed(1)}s` : '0.0s', {
        fontFamily: FONT, fontSize: '58px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 7
      })
      .setDepth(22);
    this.add
      .text(150, 164, this.timeMs > 0 ? `最佳 ${(this.bestMs / 1000).toFixed(1)}s · 生涯称号 ${getTitle(p.totalDodged)}` : `生涯称号 ${getTitle(p.totalDodged)}`, {
        fontFamily: FONT, fontSize: '13px', color: '#8ce99a', resolution: 2
      })
      .setDepth(21);

    // 本局评价:S/A/B/C/D,给「这局打得怎么样」一个即时答案
    const grade = gradeRun({
      timeMs: this.timeMs,
      dodged: this.dodged,
      nearMisses: this.nearMisses,
      overdrives: this.overdrives,
      hits: this.hits,
      combo: this.combo
    });
    const gradeColor = parseInt(grade.color.slice(1), 16);
    const gradeG = this.add.graphics();
    gradeG.fillStyle(0x0b1a2e, 0.92);
    gradeG.fillCircle(0, 0, 33);
    gradeG.lineStyle(3, gradeColor, 0.95);
    gradeG.strokeCircle(0, 0, 33);
    gradeG.lineStyle(1, 0xffffff, 0.16);
    gradeG.strokeCircle(0, 0, 26);
    gradeG.fillStyle(gradeColor, 0.12);
    gradeG.fillCircle(0, 0, 26);
    const gradeText = this.add
      .text(0, -3, grade.letter, {
        fontFamily: FONT, fontSize: '34px', color: grade.color, fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5);
    const labelBg = this.add.graphics();
    const gradeLabel = this.add
      .text(0, 46, `本局评价 · ${grade.label}`, {
        fontFamily: FONT, fontSize: '11px', color: grade.color, resolution: 2
      })
      .setOrigin(0.5);
    const labelW = Math.max(144, gradeLabel.width + 26);
    labelBg.fillStyle(0x08131f, 0.88);
    labelBg.fillRoundedRect(-labelW / 2, 36, labelW, 20, 10);
    labelBg.lineStyle(1, 0xffffff, 0.14);
    labelBg.strokeRoundedRect(-labelW / 2, 36, labelW, 20, 10);
    const gradeBadge = this.add.container(468, 116, [gradeG, gradeText, labelBg, gradeLabel]).setDepth(40);
    this.tweens.add({ targets: gradeBadge, scale: 1.05, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // 下一官阶目标:给「再来一局」一个明确的短期理由
    const rp = rankProgress(this.dodged);
    const nextText = rp.next
      ? `再翻越 ${rp.remain} 个障碍晋升 ${rp.next.name}`
      : '已到顶 · 本局厅长';
    const nearNext = !!rp.next && rp.remain <= 3;
    addPanel(this, 150, 184, 368, 28, {
      fill: nearNext ? 0xffd43b : 0x8ecae6,
      fillAlpha: nearNext ? 0.12 : 0.07,
      stroke: nearNext ? 0xffd43b : 0x8ecae6,
      strokeAlpha: nearNext ? 0.4 : 0.2,
      radius: 14,
      shadow: false
    }).setDepth(21);
    this.add.image(168, 198, 'ui-target').setDisplaySize(17, 17).setDepth(22);
    const nextLabel = this.add
      .text(183, 198, nextText, {
        fontFamily: FONT, fontSize: '12px', color: nearNext ? '#ffe066' : '#cfe3ff',
        fontStyle: nearNext ? 'bold' : 'normal', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(22);
    if (rp.next) {
      const barX = nextLabel.x + nextLabel.width + 14;
      const barW = Math.min(96, 502 - barX);
      if (barW >= 30) {
        const bar = this.add.graphics().setDepth(22);
        bar.fillStyle(0x000000, 0.38);
        bar.fillRoundedRect(barX, 195, barW, 6, 3);
        if (rp.ratio > 0) {
          bar.fillStyle(nearNext ? 0xffd43b : 0x74c0fc, 1);
          bar.fillRoundedRect(barX, 195, Math.max(4, barW * rp.ratio), 6, 3);
        }
      }
    }

    // 主角
    const hero = this.add
      .image(578, 205, this.playerTexture)
      .setOrigin(0.5, 1)
      .setScale(1.35)
      .setDepth(22);
    this.tweens.add({ targets: hero, scaleY: 1.39, scaleX: 1.32, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.image(582, 208, 'shadow').setDepth(21).setScale(1.35, 0.72).setAlpha(0.6);

    // 官阶印章
    const stamp = this.add.container(718, 132).setDepth(23).setAngle(4);
    const sg = this.add.graphics();
    sg.fillStyle(0x8f1d1d, 1);
    sg.fillRoundedRect(-84, -38, 168, 76, 14);
    sg.fillStyle(0xb02525, 1);
    sg.fillRoundedRect(-80, -34, 160, 64, 11);
    sg.lineStyle(2.5, 0xffd43b, 0.95);
    sg.strokeRoundedRect(-84, -38, 168, 76, 14);
    sg.lineStyle(1, 0xffe8a3, 0.45);
    sg.strokeRoundedRect(-77, -31, 154, 58, 9);
    for (const [cx, cy] of [[-72, -26], [72, -26], [-72, 26], [72, 26]] as const) {
      sg.fillStyle(0xffd43b, 0.9);
      sg.fillCircle(cx, cy, 2.2);
    }
    const sIcon = this.add.image(-50, 0, 'ui-rank').setDisplaySize(30, 30).setTint(0xffd43b);
    const st = this.add
      .text(12, 0, this.rankName, {
        fontFamily: FONT, fontSize: '25px', color: '#fff3bf', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0.5);
    stamp.add([sg, sIcon, st]);
    this.tweens.add({ targets: stamp, angle: 1.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add
      .text(718, 182, '本局官阶', { fontFamily: FONT, fontSize: '11px', color: '#a9c7e8', resolution: 2 })
      .setOrigin(0.5)
      .setDepth(22);

    if (this.isRecord && this.timeMs > 0) {
      const recordText = this.add
        .text(0, 0, '新纪录!', {
          fontFamily: FONT, fontSize: '26px', color: '#ffe066', fontStyle: 'bold',
          resolution: 2, stroke: '#c2255c', strokeThickness: 5
        })
        .setOrigin(0.5);
      const recordIcon = this.add.image(0, 0, 'ui-trophy').setDisplaySize(27, 27);
      const totalW = 27 + 9 + recordText.width;
      recordIcon.setX(-totalW / 2 + 13.5);
      recordText.setX(-totalW / 2 + 36 + recordText.width / 2);
      const badge = this.add
        .container(GAME_WIDTH / 2, 30, [recordIcon, recordText])
        .setDepth(30)
        .setScale(0.4);
      this.tweens.add({ targets: badge, scale: 1.08, duration: 380, ease: 'Back.out', yoyo: true, repeat: 1, hold: 300 });
    }

    // 数据格
    const stats: [string, string, string][] = [
      ['翻越障碍', `${this.dodged}`, '#ffffff'],
      ['本局银币', `+${this.coins}`, '#ffd43b'],
      ['最高连击', `×${this.combo}`, '#ffa94d'],
      ['擦身而过', `${this.nearMisses}`, '#8ce99a']
    ];
    stats.forEach(([label, value, color], i) => {
      const x = 150 + i * 168;
      const g = this.add.graphics().setDepth(21);
      g.fillStyle(0xffffff, 0.055);
      g.fillRoundedRect(x, 226, 156, 62, 12);
      g.lineStyle(1, 0xffffff, 0.1);
      g.strokeRoundedRect(x, 226, 156, 62, 12);
      this.add
        .text(x + 12, 236, label, { fontFamily: FONT, fontSize: '11px', color: '#9db8d8', resolution: 2 })
        .setDepth(22);
      this.add
        .text(x + 12, 254, value, { fontFamily: FONT, fontSize: '23px', color, fontStyle: 'bold', resolution: 2 })
        .setDepth(22);
    });

    // 本局考核
    this.add
      .image(159, 309, this.missionDone ? 'ui-check' : 'ui-clipboard')
      .setDisplaySize(17, 17)
      .setDepth(22);
    this.add
      .text(176, 301, this.missionTitle ? `本局考核「${this.missionTitle}」${this.missionDone ? `完成 +${this.missionReward} 银币` : '未完成'}` : '本局考核已完成', {
        fontFamily: FONT, fontSize: '14px', color: this.missionDone ? '#8ce99a' : '#cfe3ff', fontStyle: 'bold', resolution: 2
      })
      .setDepth(22);
    this.add.image(158, 335, 'ui-bolt').setDisplaySize(13, 17).setDepth(22);
    if (this.overdrives > 0) {
      this.add
        .text(176, 330, `高光时刻 ×${this.overdrives} · 芸芸众生,唯你高光`, {
          fontFamily: FONT, fontSize: '12px', color: '#d0bfff', resolution: 2
        })
        .setDepth(22);
    } else {
      this.add
        .text(176, 330, '擦身、连翻、银币都能攒气势,满槽自动进入高光时刻', {
          fontFamily: FONT, fontSize: '12px', color: '#93b5d6', resolution: 2
        })
        .setDepth(22);
    }

    // 每日挑战
    if (this.daily) {
      const reward = this.dailyReward > 0 ? ` · +${this.dailyReward} 银币` : '';
      const best = this.dailyBestMs > 0 ? ` · 今日最佳 ${(this.dailyBestMs / 1000).toFixed(1)}s` : '';
      this.add.image(158, 361, 'ui-envelope').setDisplaySize(16, 16).setDepth(22);
      this.add
        .text(176, 354, `今日挑战${this.dailyModifier ? ` · ${this.dailyModifier}` : ''}${best}${reward}`, {
          fontFamily: FONT, fontSize: '13px', color: '#ffe066', fontStyle: 'bold', resolution: 2
        })
        .setDepth(22);
      if (this.dailyRecord && !this.dailyFirst) {
        this.add.image(670, 362, 'ui-trophy').setDisplaySize(13, 13).setDepth(22);
        this.add
          .text(684, 355, '今日新纪录', { fontFamily: FONT, fontSize: '12px', color: '#8ce99a', resolution: 2 })
          .setOrigin(0, 0)
          .setDepth(22);
      }
    }

    // 新成就
    if (this.newAch.length > 0) {
      this.add.image(158, 385, 'ui-trophy').setDisplaySize(14, 14).setDepth(22);
      this.add
        .text(176, 378, `新成就:${this.newAch.slice(0, 3).join('、')}${this.newAch.length > 3 ? ` 等${this.newAch.length}项` : ''}`, {
          fontFamily: FONT, fontSize: '12px', color: '#7dffa8', resolution: 2
        })
        .setDepth(22);
    }

    // 按钮
    const replay = makeHeroButton(this, 300, 438, 224, 54, '再来一局', () => this.replay(), { iconKey: 'ui-play', iconSize: 21, fontSize: 23 });
    replay.g.setDepth(24);
    replay.text.setDepth(25);
    replay.hit.setDepth(26);

    const cardLabel = isWx() ? '分享成绩' : '保存战绩卡';
    const cardBtn = makeButton(this, 550, 438, 188, 46, cardLabel, () => this.shareOrSave(), 16, {
      iconKey: isWx() ? 'ui-share' : 'ui-image',
      iconSize: 17
    });
    cardBtn.rect.setDepth(24);
    cardBtn.text.setDepth(25);
    cardBtn.icon?.setDepth(25);

    const homeBtn = makeButton(this, 740, 438, 140, 46, '主菜单', () => this.scene.start('Title'), 15, {
      iconKey: 'ui-home',
      iconSize: 16
    });
    homeBtn.rect.setDepth(24);
    homeBtn.text.setDepth(25);
    homeBtn.icon?.setDepth(25);

    const hint = this.add
      .text(GAME_WIDTH / 2, 499, this.daily ? '空格再来一局(保持今日挑战) · ESC 回主菜单' : '空格再来一局 · ESC 回主菜单', {
        fontFamily: FONT, fontSize: '10px', color: '#9db8d8', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(22);
    addPanel(this, GAME_WIDTH / 2 - hint.width / 2 - 13, 489, hint.width + 26, 20, {
      fill: 0x08131f,
      fillAlpha: 0.55,
      stroke: 0xffffff,
      strokeAlpha: 0.08,
      radius: 10,
      shadow: false
    }).setDepth(21);

    this.add
      .text(GAME_WIDTH - 14, GAME_HEIGHT - 8, 'nmjdzmy 反弹工作室', {
        fontFamily: FONT, fontSize: '10px', color: '#dce8f5', stroke: '#10233d', strokeThickness: 2
      })
      .setOrigin(1, 1)
      .setDepth(30)
      .setAlpha(0.7);

    this.input.keyboard?.once('keydown-SPACE', () => this.replay());
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Title'));
    this.cameras.main.fadeIn(240, 8, 18, 34);
  }

  // ============================================================
  // 闯关结算:星级 + 目标清单 + 下一关
  // ============================================================

  private createLevelResult() {
    const chapterName = CHAPTERS[this.levelChapter]?.name ?? '';
    const hasNext = !!this.levelNextId && this.levelNextId !== this.levelId;
    const isFinalLevel = this.levelCleared && !hasNext;

    addPanel(this, 120, 46, 720, 448, {
      fill: 0x0a1930, fillAlpha: 0.96, stroke: 0xffffff, strokeAlpha: 0.14, radius: 24
    }).setDepth(20);

    this.add
      .text(150, 64, `${chapterName} · ${this.levelName}`, {
        fontFamily: FONT, fontSize: '13px', color: '#9db8d8', fontStyle: 'bold', resolution: 2
      })
      .setDepth(21);

    // 结论
    const verdict = this.levelCleared
      ? this.levelStars >= 3 ? '完美通关!' : '仕途通关!'
      : '落马了…';
    const verdictColor = this.levelCleared ? '#ffe066' : '#ff8787';
    const verdictSub = this.levelEndingLine
      || (this.levelCleared
        ? isFinalLevel ? '全书终 · 这一路都走过来了' : '下一关已解锁'
        : '账本还差最后一页,再来一次');

    if (this.levelCleared) {
      playSfx(this, 'promote', 0.55);
      confettiBurst(this, GAME_WIDTH / 2, 96, this.levelStars >= 3 ? 44 : 26);
      if (this.levelStars >= 3) {
        this.time.delayedCall(500, () => confettiBurst(this, GAME_WIDTH / 2, 40, 24));
        playSfx(this, 'record', 0.5);
      }
    } else {
      playSfx(this, 'fail', 0.45);
    }

    this.add
      .text(GAME_WIDTH / 2, 104, verdict, {
        fontFamily: FONT, fontSize: '40px', color: verdictColor, fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.add
      .text(GAME_WIDTH / 2, 138, verdictSub, {
        fontFamily: FONT, fontSize: '13px', color: this.levelCleared ? '#8ce99a' : '#b7cfe8', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);

    // 星级:亮起的逐颗弹出
    const starY = 186;
    const starSrc = this.textures.get('pendant-star').getSourceImage() as HTMLImageElement;
    const starScale = 46 / Math.max(1, starSrc.width);
    for (let i = 0; i < 3; i++) {
      const earned = i < this.levelStars;
      const star = this.add
        .image(GAME_WIDTH / 2 + (i - 1) * 84, starY, 'pendant-star')
        .setDepth(22);
      if (!earned) {
        star.setScale(starScale * 0.66);
        star.setTint(0x33465e);
        star.setAlpha(0.85);
      } else {
        star.setScale(0);
        this.tweens.add({
          targets: star,
          scaleX: starScale,
          scaleY: starScale,
          duration: 320,
          delay: 200 + i * 170,
          ease: 'Back.out',
          onStart: () => playSfx(this, 'coin', 0.3)
        });
      }
    }

    // 目标清单
    this.levelGoals.forEach((g, i) => {
      const y = starY + 52 + i * 34;
      if (g.done) {
        this.add.image(268, y, 'ui-check').setDisplaySize(16, 16).setDepth(22);
      } else {
        this.add.image(268, y, 'ui-close').setDisplaySize(16, 16).setDepth(22).setAlpha(0.75);
      }
      this.add
        .text(292, y, g.label, {
          fontFamily: FONT, fontSize: '14px',
          color: g.done ? '#8ce99a' : '#93b5d6', fontStyle: g.done ? 'bold' : 'normal', resolution: 2
        })
        .setOrigin(0, 0.5)
        .setDepth(22);
      this.add
        .text(720, y, `${Math.min(g.value, g.target)}/${g.target}`, {
          fontFamily: FONT, fontSize: '13px', color: g.done ? '#8ce99a' : '#93b5d6', resolution: 2
        })
        .setOrigin(1, 0.5)
        .setDepth(22);
    });

    // 奖励
    if (this.levelReward > 0) {
      const rewardText = this.levelFirstClear
        ? `首通奖励 +${this.levelReward} 银币`
        : `星级奖励 +${this.levelReward} 银币`;
      this.add
        .text(GAME_WIDTH / 2, starY + 52 + this.levelGoals.length * 34 + 6, rewardText, {
          fontFamily: FONT, fontSize: '15px', color: '#ffe066', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(22);
    } else if (!this.levelCleared) {
      this.add
        .text(GAME_WIDTH / 2, starY + 52 + this.levelGoals.length * 34 + 6, '通关才有星级奖励,先活到最后', {
          fontFamily: FONT, fontSize: '13px', color: '#93b5d6', resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);
    }

    // 星级里程碑:跨档时当场报喜,给刷星一个即时回报
    if (this.levelMilestones.length > 0) {
      const m = this.levelMilestones[this.levelMilestones.length - 1];
      const extra = m.bribeMoon > 0 ? ` + 贿月 ×${m.bribeMoon}` : '';
      this.add
        .text(GAME_WIDTH / 2, starY + 52 + this.levelGoals.length * 34 + 32, `★ 累计 ${m.stars} 星达成「${m.label}」  +${m.coins} 银币${extra}`, {
          fontFamily: FONT, fontSize: '14px', color: '#ffd43b', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(22);
      playSfx(this, 'record', 0.5);
      confettiBurst(this, GAME_WIDTH / 2, 300, 20);
    }

    // 本局数据条:填补空白,也给「这一把到底干了什么」一个交代
    const statsY = starY + 52 + this.levelGoals.length * 34 + 62;
    const stats = [
      `存活 ${(this.timeMs / 1000).toFixed(1)}s`,
      `翻越 ${this.dodged}`,
      `擦身 ${this.nearMisses}`,
      `连击 ×${this.combo}`,
      `银币 ${this.coins}`
    ];
    addPanel(this, GAME_WIDTH / 2 - 300, statsY - 20, 600, 40, {
      fill: 0x0d1f33, fillAlpha: 0.8, stroke: 0xffffff, strokeAlpha: 0.1, radius: 12
    }).setDepth(21);
    stats.forEach((t, i) => {
      this.add
        .text(GAME_WIDTH / 2 - 240 + i * 120, statsY, t, {
          fontFamily: FONT, fontSize: '12px', color: '#b7cfe8', resolution: 2
        })
        .setOrigin(0, 0.5)
        .setDepth(22);
    });

    // 按钮
    const btnY = 436;
    const goCampaign = () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.start('Campaign');
    };
    const goReplay = () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.start('Game', { levelId: this.levelId });
    };
    const goShare = () => this.shareLevelCard();

    if (hasNext) {
      makeButton(this, 196, btnY, 118, 46, '关卡列表', goCampaign, 13, { depth: 22, iconKey: 'ui-clipboard', iconSize: 14 });
      makeButton(this, 326, btnY, 118, 46, '重玩', goReplay, 13, { depth: 22, iconKey: 'ui-restart', iconSize: 14 });
      makeButton(this, 456, btnY, 118, 46, '分享', goShare, 13, { depth: 22, iconKey: 'ui-share', iconSize: 14 });
      makeHeroButton(this, 654, btnY, 190, 50, '下一关', () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('Game', { levelId: this.levelNextId });
      }, { iconKey: 'ui-play', iconSize: 20, fontSize: 20, depth: 22 });
    } else if (this.levelCleared) {
      makeButton(this, 206, btnY, 118, 46, '关卡列表', goCampaign, 13, { depth: 22, iconKey: 'ui-clipboard', iconSize: 14 });
      makeButton(this, 336, btnY, 118, 46, '重玩', goReplay, 13, { depth: 22, iconKey: 'ui-restart', iconSize: 14 });
      makeButton(this, 466, btnY, 118, 46, '分享', goShare, 13, { depth: 22, iconKey: 'ui-share', iconSize: 14 });
      makeHeroButton(this, 664, btnY, 190, 50, '回主菜单', () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('Title');
      }, { iconKey: 'ui-home', iconSize: 20, fontSize: 20, depth: 22 });
    } else {
      makeButton(this, 240, btnY, 130, 46, '关卡列表', goCampaign, 13, { depth: 22, iconKey: 'ui-clipboard', iconSize: 14 });
      makeButton(this, 400, btnY, 130, 46, '分享', goShare, 13, { depth: 22, iconKey: 'ui-share', iconSize: 14 });
      makeHeroButton(this, 620, btnY, 200, 50, '再试一次', goReplay, { iconKey: 'ui-restart', iconSize: 20, fontSize: 20, depth: 22 });
    }

    this.add
      .text(GAME_WIDTH / 2, 470, `累计 ★${this.levelStarTotal} / ${TOTAL_STARS}`, {
        fontFamily: FONT, fontSize: '12px', color: '#ffe066', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.add
      .text(GAME_WIDTH / 2, 500, '按 R 重玩 · 按 ESC 回关卡列表', {
        fontFamily: FONT, fontSize: '11px', color: '#93b5d6', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.input.keyboard?.once('keydown-R', () => this.scene.start('Game', { levelId: this.levelId }));
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Campaign'));
  }

  private replay() {
    if (this.leaving) return;
    this.leaving = true;
    playSfx(this, 'click', 0.4);
    this.cameras.main.fadeOut(180, 8, 18, 34);
    this.time.delayedCall(190, () => this.scene.start('Game', { daily: this.daily }));
  }

  // 关卡战绩卡:通关晒星、落马晒梗,都是可传播的素材
  private shareLevelCard() {
    const chapterName = CHAPTERS[this.levelChapter]?.name ?? '';
    const text = this.levelCleared
      ? `我在《官场现形记》${chapterName}·${this.levelName} 拿了 ${this.levelStars} 星,累计 ${this.levelStarTotal} 星,你能比我升得快吗?`
      : `我在《官场现形记》${chapterName}·${this.levelName} 落马了:${this.levelEndingLine || '这一关没过'}。`;
    if (isWx()) {
      wxShare(text);
      return;
    }
    try {
      const canvas = buildLevelShareCard(this, {
        chapterName,
        levelName: this.levelName,
        cleared: this.levelCleared,
        stars: this.levelStars,
        endingLine: this.levelEndingLine || (this.levelCleared ? '平安落地' : '这一关没过'),
        starTotal: this.levelStarTotal,
        totalStarsMax: TOTAL_STARS,
        dodged: this.dodged,
        nearMisses: this.nearMisses,
        coins: this.coins,
        timeMs: this.timeMs
      });
      const ok = downloadCanvas(canvas, `官场现形记-${this.levelName}.png`);
      showToast(
        this,
        GAME_WIDTH / 2,
        152,
        ok ? '战绩卡已保存,发群里吧!' : '保存失败,直接截图也行',
        ok ? '#8ce99a' : '#ff8787',
        'ui-image'
      );
      if (ok) playSfx(this, 'record', 0.35);
    } catch {
      showToast(this, GAME_WIDTH / 2, 152, '保存失败,直接截图也行', '#ff8787');
    }
  }

  private shareOrSave() {
    const grade = gradeRun({
      timeMs: this.timeMs,
      dodged: this.dodged,
      nearMisses: this.nearMisses,
      overdrives: this.overdrives,
      hits: this.hits,
      combo: this.combo
    });
    const text = this.daily
      ? `我在《王博晋升之路》今日挑战撑过 ${(this.timeMs / 1000).toFixed(1)} 秒,官阶 ${this.rankName},评价 ${grade.letter},来比比?`
      : `我在《王博晋升之路》撑过 ${(this.timeMs / 1000).toFixed(1)} 秒,官阶 ${this.rankName},本局评价 ${grade.letter},翻越 ${this.dodged} 个障碍,你能超过我吗?`;
    if (isWx()) {
      wxShare(text);
      return;
    }
    try {
      const canvas = buildShareCard(this, {
        timeMs: this.timeMs,
        dodged: this.dodged,
        coins: this.coins,
        combo: this.combo,
        nearMisses: this.nearMisses,
        overdrives: this.overdrives,
        hits: this.hits,
        rankName: this.rankName,
        bestMs: this.bestMs,
        playerTexture: this.playerTexture,
        daily: this.daily
      });
      const ok = downloadCanvas(canvas, `王博晋升之路-${(this.timeMs / 1000).toFixed(1)}s.png`);
      showToast(this, GAME_WIDTH / 2, 138, ok ? '战绩卡已保存,发群里炫耀吧!' : '保存失败,请截图分享', ok ? '#8ce99a' : '#ff8787', 'ui-image');
      if (ok) playSfx(this, 'record', 0.35);
    } catch {
      showToast(this, GAME_WIDTH / 2, 138, '保存失败,请截图分享', '#ff8787');
    }
  }

  private buildBackdrop() {
    const bg = this.add.graphics().setDepth(-20);
    bg.fillGradientStyle(0x07142a, 0x07142a, 0x1d3557, 0x3b2340, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.image(790, 84, 'sun').setScale(1.15).setDepth(-18).setAlpha(0.75);
    this.add.image(240, 118, 'moon').setScale(0.7).setDepth(-18).setAlpha(0.35);

    const mountains = this.add.tileSprite(0, GROUND_TOP - 196, GAME_WIDTH, 190, 'bg-mountains').setOrigin(0, 0).setDepth(-15).setAlpha(0.72);
    const far = this.add.tileSprite(0, GROUND_TOP - 168, GAME_WIDTH, 190, 'bg-city-far').setOrigin(0, 0).setDepth(-13).setAlpha(0.8);
    const near = this.add.tileSprite(0, GROUND_TOP - 152, GAME_WIDTH, 200, 'bg-city-near').setOrigin(0, 0).setDepth(-11).setAlpha(0.9);
    mountains.tilePositionX = 40;
    far.tilePositionX = 100;
    near.tilePositionX = 170;

    this.add.rectangle(0, GROUND_TOP, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP, 0x1d3557, 0.8).setOrigin(0).setDepth(-6);
    this.add.rectangle(0, GROUND_TOP, GAME_WIDTH, 2, 0xffd43b, 0.45).setOrigin(0).setDepth(-5);

    for (let i = 0; i < 18; i++) {
      const s = this.add
        .image(Phaser.Math.Between(20, 940), Phaser.Math.Between(40, 470), 'spark')
        .setScale(Phaser.Math.FloatBetween(0.15, 0.45))
        .setAlpha(Phaser.Math.FloatBetween(0.12, 0.45))
        .setDepth(-4);
      this.tweens.add({
        targets: s,
        y: s.y - Phaser.Math.Between(16, 50),
        alpha: 0,
        duration: Phaser.Math.Between(2400, 4800),
        delay: Phaser.Math.Between(0, 1600),
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }

    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(10).setAlpha(0.85);
  }
}
