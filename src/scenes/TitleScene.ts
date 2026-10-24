import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP, GAME_VERSION } from '../config/constants';
import { loadProgress, saveProgress, getTitle, TITLE_MILESTONES } from '../systems/progress';
import { makeHeroButton, showToast, FONT, addPanel } from '../systems/ui';
import { startBgm, playSfx } from '../systems/audio';
import { ensureSkinTextures, playerFrameKey } from '../systems/skins';
import { loadControls } from '../systems/controls';
import { LEVELS, totalStars } from '../systems/levels';
import { totalAssetValue, formatValue } from '../systems/assets';
import { collectOfflineIncome, formatDuration } from '../systems/offline';
import { nextStep } from '../systems/hints';
import { checkIn } from '../systems/daily';
import { hasCustomHead } from '../systems/customhead';
import { RUN_RANKS } from '../systems/ranks';
import { getDailyChallenge, dailyModifierIcon } from '../systems/dailyChallenge';

export default class TitleScene extends Phaser.Scene {
  private guSign?: Phaser.GameObjects.Container;
  private leaving = false;

  constructor() { super('Title'); }

  create() {
    startBgm(this);
    // 先结算离线家产收益,再读存档,保证界面上的银币是结算后的数字
    this.settleOffline();
    const p = loadProgress();

    // 每日签到
    const sign = checkIn(p);
    if (sign.signed) {
      saveProgress(p);
      this.time.delayedCall(650, () => {
        showToast(this, GAME_WIDTH / 2, 76, `签到 +${sign.coins} 银币 · 连续 ${sign.streak} 天`, '#ffe066', 'ui-calendar');
      });
    }

    this.buildBackdrop();
    this.buildLogo(p);
    this.buildTopStats(p);
    this.buildCharacter(p);
    this.buildMenu(p);
    this.buildFooter(p);

    this.cameras.main.fadeIn(280, 10, 22, 40);

    this.input.keyboard?.once('keydown-SPACE', () => this.startGame(false));
    this.input.keyboard?.once('keydown-D', () => this.startGame(true));
  }

  private startGame(daily: boolean) {
    if (this.leaving) return;
    this.leaving = true;
    playSfx(this, 'click', 0.45);
    this.cameras.main.fadeOut(200, 10, 22, 40);
    this.time.delayedCall(210, () => this.scene.start('Game', { daily }));
  }

  // ---- 背景:天空、太阳、云、三层城市、光斑 ----
  private buildBackdrop() {
    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x2e86c8, 0x2e86c8, 0xa9e2ff, 0xffe4b5, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // 地平线暖光
    sky.fillGradientStyle(0xffd79a, 0xffd79a, 0xfff2cf, 0xfff2cf, 0);
    sky.fillRect(0, GROUND_TOP - 120, GAME_WIDTH, 120);

    this.add.image(792, 92, 'sun').setScale(1.15).setDepth(-18).setAlpha(0.95);
    const sun = this.add.image(792, 92, 'sun').setScale(1.2).setDepth(-18).setAlpha(0.55);
    this.tweens.add({ targets: sun, scale: 1.4, alpha: 0.25, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const mountains = this.add.tileSprite(0, GROUND_TOP - 196, GAME_WIDTH, 190, 'bg-mountains').setOrigin(0, 0).setDepth(-15).setAlpha(0.9);
    const far = this.add.tileSprite(0, GROUND_TOP - 168, GAME_WIDTH, 190, 'bg-city-far').setOrigin(0, 0).setDepth(-13).setAlpha(0.92);
    const near = this.add.tileSprite(0, GROUND_TOP - 152, GAME_WIDTH, 200, 'bg-city-near').setOrigin(0, 0).setDepth(-11);
    this.tweens.add({ targets: mountains, tilePositionX: 40, duration: 24000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: far, tilePositionX: 70, duration: 18000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: near, tilePositionX: 110, duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // 云
    for (let i = 0; i < 5; i++) {
      const y = 58 + i * 34 + (i % 2) * 18;
      const cloud = this.add.image(Phaser.Math.Between(30, 900), y, 'cloud').setDepth(-16)
        .setScale(Phaser.Math.FloatBetween(0.55, 1.1)).setAlpha(0.85);
      this.tweens.add({
        targets: cloud, x: cloud.x - 80, duration: Phaser.Math.Between(18000, 30000),
        yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });
    }

    // 地面舞台
    this.add.rectangle(0, GROUND_TOP, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP, 0x233247).setOrigin(0, 0).setDepth(-5);
    this.add.rectangle(0, GROUND_TOP, GAME_WIDTH, 3, 0xffd43b, 0.55).setOrigin(0, 0).setDepth(-4);
    const floor = this.add.tileSprite(0, GROUND_TOP + 4, GAME_WIDTH, 24, 'ground-pattern').setOrigin(0, 0).setDepth(-4).setAlpha(0.35);
    this.tweens.add({ targets: floor, tilePositionX: 240, duration: 2600, repeat: -1 });

    // 漂浮金色光点
    for (let i = 0; i < 16; i++) {
      const spark = this.add.image(Phaser.Math.Between(40, 920), Phaser.Math.Between(80, 500), 'spark')
        .setDepth(-7).setScale(Phaser.Math.FloatBetween(0.2, 0.55)).setAlpha(Phaser.Math.FloatBetween(0.15, 0.5));
      this.tweens.add({
        targets: spark, y: spark.y - Phaser.Math.Between(20, 70), alpha: 0,
        duration: Phaser.Math.Between(2600, 5200), delay: Phaser.Math.Between(0, 2000),
        repeat: -1, ease: 'Sine.inOut'
      });
    }

    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(6).setAlpha(0.55);
  }

  // ---- 标题 logo 与数据 ----
  private buildLogo(p: ReturnType<typeof loadProgress>) {
    // 品牌小胶囊
    const pill = addPanel(this, 28, 24, 210, 34, { fill: 0x0b1a2e, fillAlpha: 0.6, stroke: 0xffffff, strokeAlpha: 0.16, radius: 17 });
    pill.setDepth(10);
    this.add.text(133, 41, '反弹工作室 · REBOUND', {
      fontFamily: FONT, fontSize: '13px', color: '#ffe8a3', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    const title = this.add.text(34, 66, '王博', {
      fontFamily: FONT, fontSize: '82px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(10);
    title.setStroke('#10233d', 10);
    title.setShadow(0, 8, 'rgba(4,12,24,0.35)', 8, false, true);

    const title2 = this.add.text(34, 148, '晋升之路', {
      fontFamily: FONT, fontSize: '62px', color: '#ffd43b', fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(10);
    title2.setStroke('#10233d', 9);
    title2.setShadow(0, 7, 'rgba(4,12,24,0.35)', 7, false, true);

    // 红色印章:跑酷
    const stamp = this.add.container(420, 178).setDepth(12).setAngle(-9);
    const sg = this.add.graphics();
    sg.fillStyle(0xc92a2a, 1);
    sg.fillRoundedRect(-58, -27, 116, 54, 10);
    sg.lineStyle(3, 0xffe3a3, 0.95);
    sg.strokeRoundedRect(-58, -27, 116, 54, 10);
    const st = this.add.text(0, 0, '跑 酷', { fontFamily: FONT, fontSize: '28px', color: '#fff3bf', fontStyle: 'bold' }).setOrigin(0.5);
    stamp.add([sg, st]);
    this.tweens.add({ targets: stamp, angle: -6, scale: 1.04, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(36, 225, 'PROMOTION  RUNNER  ·  无限生存挑战', {
      fontFamily: FONT, fontSize: '13px', color: '#d6ecff', fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(10).setAlpha(0.8);

    // 称号进度提示
    const next = TITLE_MILESTONES.find(m => p.totalDodged < m[0]);
    this.add.text(36, 250, next
      ? `当前称号:${getTitle(p.totalDodged)} · 再翻 ${next[0] - p.totalDodged} 个升${next[1]}`
      : `当前称号:${getTitle(p.totalDodged)} · 已到顶!`, {
      fontFamily: FONT, fontSize: '13px', color: '#e6f0ff'
    }).setOrigin(0, 0).setDepth(10).setAlpha(0.8);

    // 生涯进度条:把「再翻 N 个」变成看得见的进度
    if (next) {
      const idx = TITLE_MILESTONES.indexOf(next);
      const prev = idx > 0 ? TITLE_MILESTONES[idx - 1][0] : 0;
      const span = next[0] - prev;
      const ratio = span > 0 ? Math.min(1, Math.max(0, (p.totalDodged - prev) / span)) : 0;
      const barX = 36;
      const barY = 274;
      const barW = 240;
      const bar = this.add.graphics().setDepth(10);
      bar.fillStyle(0x08131f, 0.55);
      bar.fillRoundedRect(barX, barY, barW, 7, 3.5);
      if (ratio > 0) {
        bar.fillStyle(0xffd43b, 0.95);
        bar.fillRoundedRect(barX, barY, Math.max(5, barW * ratio), 7, 3.5);
        bar.fillStyle(0xffffff, 0.25);
        bar.fillRoundedRect(barX + 1, barY + 1, Math.max(3, barW * ratio - 2), 2, 1);
      }
      bar.lineStyle(1, 0xffffff, 0.12);
      bar.strokeRoundedRect(barX, barY, barW, 7, 3.5);
      this.add.text(barX + barW + 8, barY + 3.5, `${p.totalDodged}/${next[0]}`, {
        fontFamily: FONT, fontSize: '10px', color: '#ffe066', resolution: 2
      }).setOrigin(0, 0.5).setDepth(10).setAlpha(0.9);
    }
  }

  // ---- 顶部右侧数据 ----
  private buildTopStats(p: ReturnType<typeof loadProgress>) {
    const best = p.bestTimeMs || 0;
    const bestRank = RUN_RANKS[Math.min(p.bestRankIndex || 0, RUN_RANKS.length - 1)];
    const items: { icon: string; text: string; color: string; tint?: number }[] = [
      { icon: 'coin', text: `${p.coins}`, color: '#ffe066' },
      { icon: 'as-purse', text: formatValue(p.corrupt ?? 0), color: '#ffd43b' },
      { icon: 'ui-clock', text: best ? (best / 1000).toFixed(1) + 's' : '—', color: '#ffffff' },
      { icon: 'ui-rank', text: bestRank.short, color: bestRank.color, tint: parseInt(bestRank.color.slice(1), 16) }
    ];
    let x = GAME_WIDTH - 20;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const t = this.add.text(0, 0, item.text, {
        fontFamily: FONT, fontSize: '13px', color: item.color, fontStyle: 'bold'
      }).setDepth(11);
      const padX = 10;
      const iconW = 18;
      const gap = 5;
      const w = padX * 2 + iconW + gap + t.width;
      x -= w;
      const bg = this.add.graphics().setDepth(10);
      bg.fillStyle(0x0b1a2e, 0.6);
      bg.fillRoundedRect(x, 24, w, 28, 14);
      bg.lineStyle(1.2, 0xffffff, 0.16);
      bg.strokeRoundedRect(x, 24, w, 28, 14);
      const icon = this.add.image(x + padX + iconW / 2, 38, item.icon).setDisplaySize(18, 18).setDepth(11);
      if (item.tint) icon.setTint(item.tint);
      t.setPosition(x + padX + iconW + gap, 38).setOrigin(0, 0.5);
      x -= 7;
    }
  }

  // ---- 主角与聚光灯 ----
  private buildCharacter(p: ReturnType<typeof loadProgress>) {
    // 舞台聚光
    const spot = this.add.image(228, 182, 'spotlight').setOrigin(0.5, 0).setDepth(7).setAlpha(0.5);
    this.tweens.add({ targets: spot, alpha: 0.28, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // 舞台圆台
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(0x0f1f33, 0.6); g.fillEllipse(228, GROUND_TOP + 4, 300, 34);
    g.fillStyle(0xffd43b, 0.14); g.fillEllipse(228, GROUND_TOP + 2, 250, 20);
    g.lineStyle(2, 0xffd43b, 0.4); g.strokeEllipse(228, GROUND_TOP + 2, 250, 20);

    let key = 'player-idle';
    if (p.skin && p.skin !== 'qitongwei') {
      ensureSkinTextures(this, p.skin);
      key = playerFrameKey(this, p.skin, 'idle');
    } else if (p.skin === 'qitongwei') {
      key = 'player-qi';
    } else if (hasCustomHead()) {
      key = playerFrameKey(this, '', 'idle');
    }
    const hero = this.add.image(228, GROUND_TOP, key).setOrigin(0.5, 1).setDepth(9);
    hero.setScale(1.68);
    // 呼吸 + 轻微摇摆
    this.tweens.add({ targets: hero, scaleY: 1.71, scaleX: 1.66, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: hero, angle: 1.4, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // 脚下阴影
    const shadow = this.add.image(228, GROUND_TOP + 2, 'shadow').setDepth(8).setScale(1.55, 0.68).setAlpha(0.8);

    // 角色旁边的小气泡
    const bubble = this.add.container(330, 330).setDepth(13).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.96);
    bg.fillRoundedRect(-62, -24, 124, 48, 14);
    bg.fillStyle(0xffffff, 0.96);
    bg.fillTriangle(-8, 24, 10, 24, -2, 36);
    const bt = this.add.text(0, 0, '这次一定升!', { fontFamily: FONT, fontSize: '16px', color: '#1d3557', fontStyle: 'bold' }).setOrigin(0.5);
    bubble.add([bg, bt]);
    this.time.delayedCall(1400, () => {
      this.tweens.add({ targets: bubble, alpha: 1, y: 322, duration: 320, ease: 'Back.out' });
      this.time.delayedCall(2600, () => this.tweens.add({ targets: bubble, alpha: 0, y: 310, duration: 300 }));
    });

    // 顾哥神秘商铺招牌
    const burst = this.add.image(0, 0, 'burst').setScale(0.66);
    const label = this.add.text(0, 0, '顾哥\n神秘商铺', {
      fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#c2255c', strokeThickness: 4,
      align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5);
    const spark = this.add.image(30, -27, 'spark').setDisplaySize(15, 15).setTint(0xffd43b);
    const sign = this.add.container(538, 392, [burst, label, spark]).setDepth(12).setAngle(-24);
    sign.setSize(130, 100).setInteractive({ useHandCursor: true });
    sign.on('pointerdown', () => { playSfx(this, 'click', 0.4); this.scene.start('GuShop'); });
    this.tweens.add({ targets: burst, angle: 360, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: sign, scale: 1.05, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.guSign = sign;
  }

  // ---- 右侧菜单 ----
  private buildMenu(p: ReturnType<typeof loadProgress>) {
    const dc = getDailyChallenge();
    const px = 620;
    const pw = 312;

    const panel = addPanel(this, px, 84, pw, 384, { fill: 0x0b1b31, fillAlpha: 0.72, stroke: 0xffffff, strokeAlpha: 0.14, radius: 22 });
    panel.setDepth(9);

    // ===== 右侧面板:纵向分区,每块各占一行,互不遮挡 =====
    // 1) 标题行
    this.add.text(px + 20, 100, '目标:一路高升', {
      fontFamily: FONT, fontSize: '13px', color: '#a9c7e8', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(10);

    // 2) 主按钮:闯关模式
    makeHeroButton(this, px + pw / 2, 148, 268, 58, '继续闯关', () => {
      playSfx(this, 'click', 0.45);
      this.scene.start('Campaign');
    }, { iconKey: 'ui-play', iconSize: 22, fontSize: 24 });

    // 3) 仕途进度条(独立一行,带底板,不会再被按钮压住)
    {
      const clearedCount = LEVELS.filter(l => (p.levelStars[l.id] ?? 0) > 0).length;
      const starSum = totalStars(p.levelStars);
      const rowY = 188;
      const rowH = 30;
      const g = this.add.graphics().setDepth(10);
      g.fillStyle(0x0a1728, 0.9);
      g.fillRoundedRect(px + 16, rowY, pw - 32, rowH, 10);
      g.lineStyle(1, 0xffd43b, 0.28);
      g.strokeRoundedRect(px + 16, rowY, pw - 32, rowH, 10);
      // 进度条本体
      const barW = 86;
      const ratio = LEVELS.length > 0 ? clearedCount / LEVELS.length : 0;
      g.fillStyle(0x1d3350, 1);
      g.fillRoundedRect(px + pw - 16 - barW, rowY + rowH / 2 - 3, barW, 6, 3);
      g.fillStyle(0xffd43b, 0.95);
      g.fillRoundedRect(px + pw - 16 - barW, rowY + rowH / 2 - 3, Math.max(4, barW * ratio), 6, 3);
      this.add.image(px + 32, rowY + rowH / 2, 'pendant-star').setDisplaySize(15, 15).setDepth(11).setTint(0xffd43b);
      this.add.text(px + 46, rowY + rowH / 2, `官场现形记 ${clearedCount}/${LEVELS.length} 关 · ★${starSum}`, {
        fontFamily: FONT, fontSize: '12px', color: '#ffe066', fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(11);
    }

    // 4) 每日挑战卡
    const dy = 228;
    const dcBg = this.add.graphics().setDepth(10);
    dcBg.fillStyle(0x2a1b4a, 0.9);
    dcBg.fillRoundedRect(px + 16, dy, pw - 32, 62, 12);
    dcBg.lineStyle(1.5, 0xc9a7ff, 0.5);
    dcBg.strokeRoundedRect(px + 16, dy, pw - 32, 62, 12);
    this.add.image(px + 38, dy + 30, dailyModifierIcon(dc.modifier.id)).setDisplaySize(20, 20).setDepth(11);
    this.add.text(px + 54, dy + 10, `今日挑战 · ${dc.modifier.name}`, {
      fontFamily: FONT, fontSize: '15px', color: '#ffe066', fontStyle: 'bold'
    }).setDepth(11);
    this.add.text(px + 54, dy + 34, `${dc.modifier.desc}`, {
      fontFamily: FONT, fontSize: '11px', color: '#d8c7ff'
    }).setDepth(11);
    const dcHit = this.add.rectangle(px + pw / 2, dy + 31, pw - 32, 62, 0xffffff, 0.001).setDepth(12).setInteractive({ useHandCursor: true });
    dcHit.on('pointerdown', () => { playSfx(this, 'click', 0.4); this.startGame(true); });

    // 5) 次级入口:3 行 × 2 列
    const items: { icon: string; label: string; sub: string; onClick: () => void }[] = [
      { icon: 'ui-shop', label: '晋升商店', sub: '皮肤 · 手枪', onClick: () => this.scene.start('Shop') },
      {
        icon: 'ui-home', label: '我的家',
        sub: (() => {
          const v = totalAssetValue({
            assets: p.assets ?? {}, network: p.network ?? {}, laundered: p.laundered ?? 0
          });
          const pv = p.prestige ?? 0;
          if (pv > 0) return v > 0 ? `家产 ${formatValue(v)} · Lv.${pv}` : `海外身份 Lv.${pv}`;
          return v > 0 ? `家产 ${formatValue(v)}` : '进屋看看';
        })(),
        onClick: () => this.scene.start('Assets')
      },
      { icon: 'ui-clipboard', label: '任务成就', sub: '签到 · 排行', onClick: () => this.scene.start('Quest') },
      { icon: 'ui-palette', label: '自定义', sub: '换上你的脸', onClick: () => this.scene.start('CustomChar') },
      { icon: 'ui-clock', label: '无尽模式', sub: '能撑多久', onClick: () => this.startGame(false) },
      { icon: 'ui-gear', label: '设置', sub: '声音 · 存档', onClick: () => this.scene.start('Settings') }
    ];
    items.forEach((it, i) => {
      const gap = 7;
      const bw = (pw - 32 - gap) / 2;
      const bh = 44;
      const bx = px + 16 + (i % 2) * (bw + gap);
      const by = 288 + Math.floor(i / 2) * (bh + gap);
      const bg = this.add.graphics().setDepth(10);
      bg.fillStyle(0x16324f, 0.85);
      bg.fillRoundedRect(bx, by, bw, bh, 10);
      bg.lineStyle(1.2, 0xffffff, 0.12);
      bg.strokeRoundedRect(bx, by, bw, bh, 10);
      this.add.image(bx + 17, by + bh / 2, it.icon).setDisplaySize(15, 15).setDepth(11);
      this.add.text(bx + 30, by + 6, it.label, { fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setDepth(11);
      this.add.text(bx + 30, by + 24, it.sub, { fontFamily: FONT, fontSize: '9px', color: '#93b5d6' }).setDepth(11);
      const hit = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, 0xffffff, 0.001).setDepth(12).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => bg.setAlpha(0.95));
      hit.on('pointerout', () => bg.setAlpha(1));
      hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); it.onClick(); });
    });

    // 下一步提示:点一下直接去该去的地方
    {
      const step = nextStep(p);
      if (step) {
        const y = 450;
        const w = pw - 32;
        const g = this.add.graphics().setDepth(10);
        g.fillStyle(step.tone === 'urgent' ? 0x3a1a20 : 0x122c40, 0.92);
        g.fillRoundedRect(px + 16, y - 15, w, 30, 10);
        g.lineStyle(1.2, step.tone === 'urgent' ? 0xff8787 : 0x74c0fc, 0.4);
        g.strokeRoundedRect(px + 16, y - 15, w, 30, 10);
        this.add.image(px + 32, y, step.tone === 'urgent' ? 'ui-siren' : 'ui-tips')
          .setDisplaySize(14, 14).setDepth(11);
        const t = this.add
          .text(px + 46, y, step.text, {
            fontFamily: FONT, fontSize: '11px',
            color: step.tone === 'urgent' ? '#ff8787' : '#b7cfe8', resolution: 2
          })
          .setOrigin(0, 0.5)
          .setDepth(11);
        const hit = this.add
          .rectangle(px + pw / 2, y, w, 30, 0xffffff, 0.001)
          .setDepth(12)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => t.setColor('#ffe066'));
        hit.on('pointerout', () => t.setColor(step.tone === 'urgent' ? '#ff8787' : '#b7cfe8'));
        hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); this.scene.start(step.scene); });
      }
    }
  }

  // 回访钩子:一进游戏先把离线期间的家产收益结算掉并报喜
  private settleOffline() {
    const r = collectOfflineIncome();
    if (r.corrupt <= 0) return;
    const dur = formatDuration(r.elapsedMs);
    this.time.delayedCall(600, () => {
      showToast(
        this,
        GAME_WIDTH / 2,
        168,
        `离线 ${dur} · 家产进账 +${formatValue(r.corrupt)} 黑金${r.capped ? '(封顶)' : ''}`,
        '#ffd43b',
        'as-purse'
      );
    });
  }

  private buildFooter(p: ReturnType<typeof loadProgress>) {
    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 7, `nmjdzmy 反弹工作室 / v${GAME_VERSION}`, {
      fontFamily: FONT, fontSize: '11px', color: '#dce8f5', stroke: '#10233d', strokeThickness: 2
    }).setOrigin(1, 1).setDepth(20).setAlpha(0.8);
    this.add.text(14, GAME_HEIGHT - 7, '无限生存 · 越跑越快 · 官阶越升越高', {
      fontFamily: FONT, fontSize: '11px', color: '#cfe3ff', stroke: '#10233d', strokeThickness: 2
    }).setOrigin(0, 1).setDepth(20).setAlpha(0.82);
  }
}
