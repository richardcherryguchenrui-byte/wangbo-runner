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
    // 顾哥神秘商铺商品贴图
    this.load.image('bribe-moon', 'assets/bribe-moon.png');
  }

  create() {
    this.makeCloud();
    this.makeGroundPattern();
    this.makeBullet();
    this.makeBurst();
    this.makeRing();

    this.scene.start('Splash');
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

  // 五彩爆炸星形:顾哥神秘商铺招牌底色(12 根彩色尖刺)
  private makeBurst() {
    const canvas = this.textures.createCanvas('burst', 190, 140);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const colors = ['#ff5a5a', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc', '#ff922b'];
    const cx = 95, cy = 70;
    for (let i = 0; i < 12; i++) {
      const a1 = (i / 12) * Math.PI * 2;
      const a2 = ((i + 0.5) / 12) * Math.PI * 2;
      const a3 = ((i + 1) / 12) * Math.PI * 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a1) * 92, cy + Math.sin(a1) * 66);
      ctx.lineTo(cx + Math.cos(a2) * 40, cy + Math.sin(a2) * 30);
      ctx.lineTo(cx + Math.cos(a3) * 92, cy + Math.sin(a3) * 66);
      ctx.closePath();
      ctx.fill();
    }
    // 中央深色圆底,放文字
    ctx.fillStyle = '#2a1b4a';
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fill();
    canvas.refresh();
  }

  // 护体光环:白色椭圆环(游戏中按需染色为金色)
  private makeRing() {
    const canvas = this.textures.createCanvas('shield-ring', 88, 30);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(44, 15, 36, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
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
