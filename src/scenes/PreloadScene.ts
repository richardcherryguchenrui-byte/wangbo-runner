import Phaser from 'phaser';
import { hasCustomHead, rebuildCustomTextures } from '../systems/customhead';
import { buildArtTextures } from '../systems/art';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    // 主角素材包:站立/跑步×2/跳跃 四帧
    this.load.image('player-idle', 'assets/player-idle.png');
    this.load.image('player-run-1', 'assets/player-run-1.png');
    this.load.image('player-run-2', 'assets/player-run-2.png');
    this.load.image('player-jump', 'assets/player-jump.png');
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
    // 音效与 BGM(原创芯片音乐风格;小游戏环境自动静音兜底)
    this.load.audio('bgm', 'assets/bgm.wav');
    this.load.audio('bgm2', 'assets/bgm2.wav');
    this.load.audio('jump', 'assets/jump.wav');
    this.load.audio('fail', 'assets/fail.wav');
    this.load.audio('shield', 'assets/shield.wav');
    this.load.audio('gameover', 'assets/gameover.wav');
    this.load.audio('coin', 'assets/coin.wav');
    this.load.audio('shoot', 'assets/shoot.wav');
    this.load.audio('pickup', 'assets/pickup.wav');
    this.load.audio('unlock', 'assets/unlock.wav');
    this.load.audio('click', 'assets/click.wav');
    this.load.audio('record', 'assets/record.wav');
    this.load.audio('warn', 'assets/warn.wav');
    this.load.audio('wave_start', 'assets/wave_start.wav');
    this.load.audio('wave_clear', 'assets/wave_clear.wav');
    this.load.audio('slide', 'assets/slide.wav');
    this.load.audio('near', 'assets/near.wav');
    this.load.audio('promote', 'assets/promote.wav');
    this.load.audio('hype', 'assets/hype.wav');
    this.load.audio('mission', 'assets/mission.wav');
  }

  create() {
    // 照片/AI 素材在 2x 画布下用线性过滤保持平滑;像素风小件保持最近邻
    const smoothKeys = [
      'player-idle', 'player-run-1', 'player-run-2', 'player-jump', 'player-qi',
      'ob-gold', 'ob-redpacket', 'ob-treasure',
      'ob-beauty-1', 'ob-beauty-2', 'ob-beauty-3', 'ob-beauty-4',
      'bribe-moon', 'cloud',
      'bg-mountains', 'bg-city-far', 'bg-city-near', 'sun', 'moon', 'vignette',
      'coin', 'item-bag', 'item-shield', 'item-double', 'item-slow', 'item-hype',
      'shadow', 'spark', 'spotlight'
    ];
    smoothKeys.forEach(key => {
      const tex = this.textures.get(key);
      if (tex) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });

    // 自定义人物:合成玩家四帧的「换头」贴图
    if (hasCustomHead()) rebuildCustomTextures(this);

    this.makeCloud();
    this.makeGroundPattern();
    this.makeBullet();
    this.makeBurst();
    this.makeRing();
    this.makeSkyline();
    // 视差城市、日月、暗角、银币与道具图标
    buildArtTextures(this);

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

  // 城市天际线剪影:远山 + 楼群(含一栋「纪委大楼」),作为背景视差层
  private makeSkyline() {
    const canvas = this.textures.createCanvas('skyline', 240, 140);
    if (!canvas) return;
    const ctx = canvas.getContext();
    // 远山
    ctx.fillStyle = '#4d79b8';
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.quadraticCurveTo(60, 20, 120, 60);
    ctx.quadraticCurveTo(180, 100, 240, 60);
    ctx.lineTo(240, 140);
    ctx.lineTo(0, 140);
    ctx.closePath();
    ctx.fill();
    // 楼群剪影
    ctx.fillStyle = '#2f5e9e';
    const buildings: [number, number, number][] = [
      [0, 40, 70], [24, 30, 58], [52, 26, 80], [84, 34, 64], [112, 24, 96], [142, 36, 60], [168, 28, 74], [200, 38, 56], [226, 32, 66]
    ];
    for (const [x, w, h] of buildings) {
      ctx.fillRect(x, 140 - h, w, h);
    }
    // 窗口灯点
    ctx.fillStyle = '#ffd43b';
    for (const [x, w, h] of buildings) {
      for (let wy = 140 - h + 8; wy < 136; wy += 12) {
        for (let wx = x + 5; wx < x + w - 4; wx += 10) {
          if ((wx * 7 + wy * 13) % 3 !== 0) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    // 纪委大楼:最高一栋 + 天线 + ⚖ 标识
    ctx.fillStyle = '#27437a';
    ctx.fillRect(112, 44, 96, 96);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(156, 30, 4, 16);
    ctx.fillRect(150, 34, 16, 3);
    ctx.fillStyle = '#ffd43b';
    for (let wy = 52; wy < 136; wy += 12) {
      for (let wx = 120; wx < 202; wx += 10) {
        if ((wx * 5 + wy * 11) % 4 !== 0) ctx.fillRect(wx, wy, 3, 4);
      }
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
