import Phaser from 'phaser';
import { playSfx } from './audio';

export const FONT = "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";

export interface PanelStyle {
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  radius?: number;
  shadow?: boolean;
}

// 圆角面板 + 投影:统一 HUD / 卡片视觉
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {}
): Phaser.GameObjects.Graphics {
  const {
    fill = 0x10233d,
    fillAlpha = 0.82,
    stroke = 0xffffff,
    strokeAlpha = 0.16,
    radius = 14,
    shadow = true
  } = style;
  const g = scene.add.graphics();
  if (shadow) {
    g.fillStyle(0x06101d, 0.28);
    g.fillRoundedRect(x + 3, y + 4, w, h, radius);
  }
  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (strokeAlpha > 0) {
    g.lineStyle(2, stroke, strokeAlpha);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
  return g;
}

// 通用按钮:深蓝底 + 白描边 + 文字,点击回调 + 点击音效 + 按压动画
// 返回的 rect 实为 Graphics(圆角药丸),保留旧字段名以兼容现有调用
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 22,
  options: { fill?: number; textColor?: string; depth?: number; disabled?: boolean; iconKey?: string; iconSize?: number } = {}
) {
  const { fill = 0x16324f, textColor = '#ffffff', depth = 20, disabled = false, iconKey, iconSize = 18 } = options;
  const g = scene.add.graphics().setDepth(depth);
  const r = h / 2;
  const draw = (hover = false, lift = 0) => {
    g.clear();
    g.fillStyle(0x06101d, 0.35);
    g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, r);
    g.fillStyle(fill, hover ? 1 : 0.92);
    g.fillRoundedRect(x - w / 2, y - h / 2 + lift, w, h, r);
    g.lineStyle(1.8, 0xffffff, hover ? 0.42 : 0.22);
    g.strokeRoundedRect(x - w / 2, y - h / 2 + lift, w, h, r);
    if (hover) {
      g.fillStyle(0xffffff, 0.06);
      g.fillRoundedRect(x - w / 2 + 8, y - h / 2 + 8 + lift, w - 16, h * 0.32, r * 0.6);
    }
  };
  draw();
  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT, fontSize: `${fontSize}px`, color: disabled ? '#7f9cbd' : textColor,
      fontStyle: 'bold', resolution: 2
    })
    .setOrigin(0.5)
    .setDepth(depth + 1);
  let icon: Phaser.GameObjects.Image | undefined;
  if (iconKey) {
    icon = scene.add
      .image(0, y, iconKey)
      .setDisplaySize(iconSize, iconSize)
      .setDepth(depth + 1)
      .setAlpha(disabled ? 0.55 : 1);
    const gap = 8;
    const total = iconSize + gap + text.width;
    icon.setX(x - total / 2 + iconSize / 2);
    text.setX(x - total / 2 + iconSize + gap + text.width / 2);
  }
  const hit = scene.add.rectangle(x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: !disabled }).setDepth(depth + 2);
  if (!disabled) {
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      playSfx(scene, 'click', 0.35);
      draw(true, 2);
      text.setY(y + 2);
      icon?.setY(y + 2);
      scene.time.delayedCall(90, () => { draw(true, 0); text.setY(y); icon?.setY(y); });
      onClick();
    });
  } else {
    g.setAlpha(0.55);
    text.setAlpha(0.7);
  }
  return { rect: g, text, hit, icon };
}

// 强调按钮:渐变金/红底、圆角、光晕,用于「开始游戏」「再来一局」
export function makeHeroButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: {
    color1?: number; color2?: number; fontSize?: number; icon?: string;
    iconKey?: string; iconSize?: number; depth?: number;
  } = {}
) {
  const { color1 = 0xffb703, color2 = 0xe8590c, fontSize = 27, icon = '', iconKey, iconSize = 24, depth = 20 } = options;
  const g = scene.add.graphics().setDepth(depth);
  const r = h / 2;
  const draw = (lift = 0) => {
    g.clear();
    // 底部厚边,像实体按钮
    g.fillStyle(0x5c2a00, 0.85);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 7, w, h, r);
    g.fillStyle(color2, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2 + lift, w, h, r);
    g.fillStyle(color1, 1);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3 + lift, w - 6, h - 9, r - 3);
    g.lineStyle(2.5, 0xfff3c4, 0.85);
    g.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3 + lift, w - 6, h - 9, r - 3);
    // 高光
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(x - w / 2 + 14, y - h / 2 + 8 + lift, w - 28, h * 0.32, r * 0.6);
  };
  draw();
  const text = scene.add
    .text(x, y + 1, `${icon ? icon + ' ' : ''}${label}`, {
      fontFamily: FONT, fontSize: `${fontSize}px`, color: '#3d1c00', fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setStroke('#ffecb3', 3)
    .setShadow(0, 2, 'rgba(80,35,0,0.4)', 2, false, true)
    .setDepth(depth + 1);
  let iconImage: Phaser.GameObjects.Image | undefined;
  if (iconKey) {
    iconImage = scene.add
      .image(0, y + 1, iconKey)
      .setDisplaySize(iconSize, iconSize)
      .setDepth(depth + 1);
    const gap = 10;
    const total = iconSize + gap + text.width;
    iconImage.setX(x - total / 2 + iconSize / 2);
    text.setX(x - total / 2 + iconSize + gap + text.width / 2);
  }
  const hit = scene.add.rectangle(x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
  hit.on('pointerdown', () => {
    playSfx(scene, 'click', 0.45);
    draw(3);
    text.setY(y + 3);
    iconImage?.setY(y + 3);
    scene.time.delayedCall(80, () => { draw(0); text.setY(y + 1); iconImage?.setY(y + 1); });
    scene.tweens.add({
      targets: iconImage ? [g, text, iconImage] : [g, text],
      scale: 0.97,
      duration: 80,
      yoyo: true
    });
    onClick();
  });
  scene.tweens.add({ targets: g, alpha: { from: 0.92, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return { g, text, hit, icon: iconImage };
}

// 短暂提示:深色药丸底 + 浮起渐隐;可选左侧图标,避免依赖 emoji
export function showToast(scene: Phaser.Scene, x: number, y: number, msg: string, color = '#ffe066', iconKey?: string) {
  const text = scene.add
    .text(0, 0, msg, {
      fontFamily: FONT, fontSize: '20px', color, stroke: '#10233d', strokeThickness: 4,
      align: 'center', lineSpacing: 4
    })
    .setOrigin(0.5);
  const iconSize = 20;
  const iconGap = 8;
  const totalW = iconKey ? iconSize + iconGap + text.width : text.width;
  const padX = 22;
  const w = Math.max(120, totalW + padX * 2);
  const h = Math.max(text.height + 18, iconKey ? 40 : 0);
  const bg = scene.add.graphics();
  bg.fillStyle(0x081525, 0.93);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  bg.fillStyle(0xffffff, 0.07);
  bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, h * 0.3);
  bg.lineStyle(1.5, 0xffffff, 0.2);
  bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const children: Phaser.GameObjects.GameObject[] = [bg];
  if (iconKey) {
    const icon = scene.add.image(-totalW / 2 + iconSize / 2, 0, iconKey).setDisplaySize(iconSize, iconSize);
    text.setX(-totalW / 2 + iconSize + iconGap + text.width / 2);
    children.push(icon);
  }
  children.push(text);
  const c = scene.add.container(x, y, children).setDepth(100);
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, y: y - 8, duration: 140, ease: 'Quad.out' });
  scene.tweens.add({
    targets: c,
    y: y - 48,
    alpha: 0,
    delay: 1250,
    duration: 520,
    ease: 'Quad.in',
    onComplete: () => c.destroy()
  });
}

// 横向进度条(XP / 官阶 / 气势)
export function drawBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: number,
  bgAlpha = 0.45
) {
  g.clear();
  g.fillStyle(0x000000, bgAlpha);
  g.fillRoundedRect(x, y, w, h, h / 2);
  if (ratio > 0) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, Math.max(h, w * Math.min(1, ratio)), h, h / 2);
  }
}
