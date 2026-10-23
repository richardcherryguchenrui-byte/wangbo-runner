import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP } from '../config/constants';
import { addPanel, makeButton, FONT } from './ui';

export type MenuMood = 'night' | 'purple' | 'dawn';

interface BackdropOptions {
  mood?: MenuMood;
  /** 是否绘制底部城市,默认 true */
  city?: boolean;
}

/**
 * 菜单类场景统一背景:夜色渐变 + 月光/日光 + 视差城市 + 漂浮光点 + 暗角。
 * 所有元素都在深度 -30 ~ 5 之间,内容请使用 >= 10 的深度。
 */
export function buildMenuBackdrop(scene: Phaser.Scene, opts: BackdropOptions = {}) {
  const mood = opts.mood ?? 'night';
  const palette = {
    night: { top: 0x07142a, mid: 0x0d2440, low: 0x17314f, horizon: 0x2a3550, accent: 0x8ecae6 },
    purple: { top: 0x150c2b, mid: 0x241542, low: 0x35204f, horizon: 0x4a2a55, accent: 0xc9a7ff },
    dawn: { top: 0x13213d, mid: 0x233a5c, low: 0x4b3d5c, horizon: 0x7a4a52, accent: 0xffd43b }
  }[mood];

  const sky = scene.add.graphics().setDepth(-30);
  sky.fillGradientStyle(palette.top, palette.top, palette.low, palette.horizon, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 顶部品牌光晕
  const glow = scene.add.image(GAME_WIDTH / 2, 84, 'spark').setScale(10, 7).setAlpha(0.09).setDepth(-29);
  if (mood === 'purple') glow.setTint(0xc9a7ff);
  scene.tweens.add({ targets: glow, alpha: 0.03, scaleX: 13, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

  // 日/月
  if (mood === 'purple') {
    scene.add.image(790, 92, 'moon').setScale(1.35).setAlpha(0.88).setDepth(-28);
  } else if (mood === 'dawn') {
    scene.add.image(788, 104, 'sun').setScale(1.4).setAlpha(0.55).setDepth(-28);
  } else {
    scene.add.image(792, 104, 'moon').setScale(1.1).setAlpha(0.62).setDepth(-28);
    scene.add.image(792, 104, 'sun').setScale(1.6).setAlpha(0.08).setDepth(-28);
  }

  // 城市剪影
  if (opts.city !== false) {
    const mountainAlpha = mood === 'purple' ? 0.5 : 0.7;
    scene.add
      .tileSprite(0, GROUND_TOP - 190, GAME_WIDTH, 190, 'bg-mountains')
      .setOrigin(0, 0)
      .setDepth(-24)
      .setAlpha(mountainAlpha)
      .setTint(mood === 'purple' ? 0x9f86c0 : 0x7b88b4);
    scene.add
      .tileSprite(0, GROUND_TOP - 164, GAME_WIDTH, 190, 'bg-city-far')
      .setOrigin(0, 0)
      .setDepth(-23)
      .setAlpha(0.85)
      .setTint(mood === 'purple' ? 0x8d76b3 : 0x6f7ba6);
    scene.add
      .tileSprite(0, GROUND_TOP - 148, GAME_WIDTH, 200, 'bg-city-near')
      .setOrigin(0, 0)
      .setDepth(-22)
      .setAlpha(1)
      .setTint(mood === 'purple' ? 0x6b5592 : 0x5f6c96);
  }

  // 地平线暖光
  const horizon = scene.add.graphics().setDepth(-21);
  horizon.fillGradientStyle(palette.accent, palette.accent, palette.accent, palette.accent, 0.2, 0.2, 0, 0);
  horizon.fillRect(0, GROUND_TOP - 150, GAME_WIDTH, 150);

  // 地面
  scene.add.rectangle(0, GROUND_TOP, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP, 0x131f33).setOrigin(0).setDepth(-20);
  scene.add.rectangle(0, GROUND_TOP, GAME_WIDTH, 2, mood === 'purple' ? 0xc9a7ff : 0xffd43b, 0.4).setOrigin(0).setDepth(-19);

  // 漂浮光点
  for (let i = 0; i < 20; i++) {
    const spark = scene.add
      .image(Phaser.Math.Between(30, 930), Phaser.Math.Between(70, 500), 'spark')
      .setDepth(-10)
      .setScale(Phaser.Math.FloatBetween(0.12, 0.4))
      .setAlpha(Phaser.Math.FloatBetween(0.1, 0.4));
    if (mood === 'purple') spark.setTint(0xd0bfff);
    scene.tweens.add({
      targets: spark,
      y: spark.y - Phaser.Math.Between(18, 60),
      alpha: 0,
      duration: Phaser.Math.Between(2400, 5200),
      delay: Phaser.Math.Between(0, 2200),
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  // 轻雾
  for (let i = 0; i < 3; i++) {
    const fog = scene.add
      .image(Phaser.Math.Between(100, 860), GROUND_TOP - 40 - i * 26, 'cloud')
      .setDepth(-9)
      .setScale(2.4 + i * 0.6, 0.8)
      .setAlpha(0.045)
      .setTint(mood === 'purple' ? 0xc9a7ff : 0xdce8f5);
    scene.tweens.add({
      targets: fog,
      x: fog.x - 60,
      duration: 9000 + i * 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  scene.add.image(0, 0, 'vignette').setOrigin(0).setDepth(5).setAlpha(0.8);
}

/**
 * 菜单页通用页头:返回、居中标题/副标题、右上银币胶囊。
 */
export function buildMenuHeader(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  opts: { coins?: number; back?: boolean; accent?: string; depth?: number } = {}
) {
  const depth = opts.depth ?? 20;
  if (opts.back !== false) {
    makeButton(scene, 68, 35, 104, 38, '← 返回', () => {
      scene.cameras.main.fadeOut(160, 7, 20, 42);
      scene.time.delayedCall(170, () => scene.scene.start('Title'));
    }, 15, { depth: depth + 2 });
  }

  scene.add
    .text(GAME_WIDTH / 2, 22, title, {
      fontFamily: FONT, fontSize: '31px', color: '#ffffff', fontStyle: 'bold',
      resolution: 2, stroke: '#08131f', strokeThickness: 6
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 2);

  scene.add
    .text(GAME_WIDTH / 2, 62, subtitle, {
      fontFamily: FONT, fontSize: '12px', color: opts.accent ?? '#a9c7e8', resolution: 2
    })
    .setOrigin(0.5, 0)
    .setDepth(depth + 1)
    .setAlpha(0.9);

  if (opts.coins !== undefined) addCoinChip(scene, GAME_WIDTH - 24, 38, opts.coins, depth);

  // 页头分隔线
  const line = scene.add.graphics().setDepth(depth);
  line.fillStyle(0xffffff, 0.1);
  line.fillRect(32, 86, GAME_WIDTH - 64, 1);
  line.fillStyle(0xffd43b, 0.55);
  line.fillRect(GAME_WIDTH / 2 - 26, 86, 52, 2);
}

export function addCoinChip(scene: Phaser.Scene, rightX: number, centerY: number, coins: number, depth = 20) {
  const label = `🪙 ${coins}`;
  const t = scene.add
    .text(0, 0, label, {
      fontFamily: FONT, fontSize: '15px', color: '#ffe066', fontStyle: 'bold', resolution: 2
    })
    .setDepth(depth + 2);
  const w = t.width + 30;
  const h = 34;
  const g = addPanel(scene, rightX - w, centerY - h / 2, w, h, {
    fill: 0x0b1a2e, fillAlpha: 0.85, stroke: 0xffd43b, strokeAlpha: 0.3, radius: h / 2
  }).setDepth(depth + 1);
  t.setPosition(rightX - w / 2, centerY).setOrigin(0.5);
  return { g, text: t };
}

/** 内容卡:统一圆角、描边和轻微内高光 */
export function addMenuCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { highlight?: boolean; warn?: boolean; depth?: number; radius?: number } = {}
) {
  const fill = opts.warn ? 0x2a1b22 : opts.highlight ? 0x12352a : 0x0b1b31;
  const stroke = opts.warn ? 0xff8787 : opts.highlight ? 0x69db7c : 0xffffff;
  const g = addPanel(scene, x, y, w, h, {
    fill,
    fillAlpha: 0.82,
    stroke,
    strokeAlpha: opts.highlight || opts.warn ? 0.34 : 0.1,
    radius: opts.radius ?? 14
  }).setDepth(opts.depth ?? 10);
  const gloss = scene.add.graphics().setDepth((opts.depth ?? 10) + 1);
  gloss.fillStyle(0xffffff, 0.035);
  gloss.fillRoundedRect(x + 2, y + 2, w - 4, Math.min(18, h * 0.3), (opts.radius ?? 14) - 2);
  return g;
}

export function addSectionTitle(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffe066', depth = 20) {
  scene.add
    .text(x, y, text, {
      fontFamily: FONT, fontSize: '15px', color, fontStyle: 'bold',
      resolution: 2, stroke: '#08131f', strokeThickness: 4
    })
    .setOrigin(0, 0.5)
    .setDepth(depth);
}

export function addMenuFooter(scene: Phaser.Scene, text: string) {
  scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT - 14, text, {
      fontFamily: FONT, fontSize: '10px', color: '#9db8d8', resolution: 2
    })
    .setOrigin(0.5, 1)
    .setDepth(20)
    .setAlpha(0.75);
}
