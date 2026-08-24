import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    // 玩家角色:照片裁剪去背景后的精灵图
    this.load.image('player', 'assets/player-sprite.png');
    // 祁同伟皮肤
    this.load.image('player-qi', 'assets/player-qi.png');
    // 障碍物:用户提供的图片,已去背景
    this.load.image('ob-gold', 'assets/ob-gold.png');
    this.load.image('ob-redpacket', 'assets/ob-redpacket.png');
    this.load.image('ob-treasure', 'assets/ob-treasure.png');
    this.load.image('ob-beauty-1', 'assets/ob-beauty-1.png');
    this.load.image('ob-beauty-2', 'assets/ob-beauty-2.png');
    this.load.image('ob-beauty-3', 'assets/ob-beauty-3.png');
    this.load.image('ob-beauty-4', 'assets/ob-beauty-4.png');
  }

  create() {
    this.makeCloud();
    this.makeGroundPattern();
    this.makeBullet();

    this.scene.start('Title');
  }

  // 简单像素云朵:三个圆叠加
  private makeCloud() {
    const canvas = this.textures.createCanvas('cloud', 96, 32);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(26, 20, 13, 0, Math.PI * 2);
    ctx.arc(52, 15, 16, 0, Math.PI * 2);
    ctx.arc(78, 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(20, 20, 64, 12);
    canvas.refresh();
  }

  // 地面花纹贴图:240×24,每 48px 一颗沙点
  private makeGroundPattern() {
    const canvas = this.textures.createCanvas('ground-pattern', 240, 24);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.fillStyle = '#d6bf94';
    for (let x = 24; x < 240; x += 48) {
      ctx.fillRect(x, 14, 4, 4);
    }
    canvas.refresh();
  }

  // 子弹:金色光弹(较高,确保能命中所有高度的障碍)
  private makeBullet() {
    const canvas = this.textures.createCanvas('bullet', 14, 28);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(1, 1, 12, 26);
    ctx.strokeStyle = '#a87f0f';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, 12, 26);
    // 尾焰
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(2, 20, 5, 6);
    canvas.refresh();
  }

}
