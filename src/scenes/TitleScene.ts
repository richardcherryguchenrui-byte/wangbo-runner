import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP, GAME_VERSION } from '../config/constants';
import { loadProgress, getTitle, TITLE_MILESTONES } from '../systems/progress';
import { makeButton } from '../systems/ui';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const p = loadProgress();

    // 背景:天空 + 云朵 + 地面(与游戏一致)
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP, 0xe8d9b8).setOrigin(0.5, 0);
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP - 1, GAME_WIDTH, 2, 0x535353).setOrigin(0.5, 0);
    for (let i = 0; i < 4; i++) {
      this.add.image(Phaser.Math.Between(80, GAME_WIDTH - 80), Phaser.Math.Between(50, 220), 'cloud');
    }

    const outline = { stroke: '#1d3557', strokeThickness: 5 };

    this.add
      .text(GAME_WIDTH / 2, 84, '王博晋升之路跑酷', { fontFamily: 'monospace', fontSize: '42px', color: '#ffffff', ...outline })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 132, '躲开百元大钞 · 撑满60秒晋升', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', ...outline })
      .setOrigin(0.5);

    // 玩家数据
    const best = Number(localStorage.getItem('bestTimeMs') || '0');
    const next = TITLE_MILESTONES.find(m => p.totalDodged < m[0]);
    this.add
      .text(GAME_WIDTH / 2, 190,
        `称号:${getTitle(p.totalDodged)}   🪙 ${p.coins}   累计翻越:${p.totalDodged}${next ? `(再翻 ${next[0] - p.totalDodged} 个升${next[1]})` : ''}${best ? `   最佳:${(best / 1000).toFixed(1)}s` : ''}`,
        { fontFamily: 'monospace', fontSize: '17px', color: '#ffe066', ...outline })
      .setOrigin(0.5);

    // 角色立绘展示
    this.add.image(GAME_WIDTH / 2, 320, 'player');

    makeButton(this, GAME_WIDTH / 2, 430, 300, 64, '▶ 开始游戏', () => this.scene.start('Game'), 26);
    makeButton(this, GAME_WIDTH / 2, 496, 220, 42, '🛒 晋升商店', () => this.scene.start('Shop'), 18);

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));

    // ---- 左侧:顾哥神秘商铺招牌(30° 倾斜,五彩爆炸底色) ----
    this.makeGuSign();

    // ---- 右下角:工作室署名 + 当前版本 ----
    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 6, `nmjdzmy反贪工作室出品/v${GAME_VERSION}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#dce8f5', stroke: '#1d3557', strokeThickness: 2
      })
      .setOrigin(1, 1)
      .setAlpha(0.85);
  }

  private makeGuSign() {
    const x = 130;
    const y = 300;

    // 五彩爆炸底色(放射状星形贴图)
    const burst = this.add.image(0, 0, 'burst').setScale(1);
    // 旋转动画,更有「爆炸」感
    this.tweens.add({ targets: burst, angle: 360, duration: 6000, repeat: -1 });

    const label = this.add
      .text(0, 0, '顾哥\n神秘商铺', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
        stroke: '#c2255c', strokeThickness: 5, align: 'center'
      })
      .setOrigin(0.5);
    const spark = this.add.text(44, -40, '✨', { fontSize: '22px' }).setOrigin(0.5);

    const sign = this.add.container(x, y, [burst, label, spark]);
    sign.setAngle(-30); // 偏转 30 度
    sign.setSize(190, 140);
    sign.setInteractive({ useHandCursor: true });
    sign.on('pointerdown', () => this.scene.start('GuShop'));

    // 招牌呼吸缩放
    this.tweens.add({ targets: sign, scale: 1.06, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
