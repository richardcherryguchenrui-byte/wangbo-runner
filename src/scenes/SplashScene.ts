import Phaser from 'phaser';
import { loadBgmAsync, startBgm } from '../systems/audio';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP } from '../config/constants';
import { FONT } from '../systems/ui';

// 品牌开场:约 1.6 秒,点击可跳过
export default class SplashScene extends Phaser.Scene {
  constructor() { super('Splash'); }

  create() {
    // 游戏首帧已经能画出来了,收起 HTML 加载页
    window.__bootDone?.();
    // 首屏已经出来了,后台补上千秋乐的 BGM
    loadBgmAsync(this, () => startBgm(this));
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x07142a, 0x0b1d36, 0x16324f, 0x2b1e3a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.image(790, 96, 'sun').setScale(1.3).setAlpha(0.18);
    this.add.tileSprite(0, GROUND_TOP - 160, GAME_WIDTH, 190, 'bg-city-far').setOrigin(0).setAlpha(0.16);
    this.add.tileSprite(0, GROUND_TOP - 126, GAME_WIDTH, 190, 'bg-city-near').setOrigin(0).setAlpha(0.22);
    this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.8);

    const glow = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, 'spark').setScale(9).setAlpha(0.12);
    this.tweens.add({ targets: glow, scale: 12, alpha: 0.04, duration: 1400, ease: 'Quad.out' });

    const studio = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 34, '反弹工作室', {
        fontFamily: FONT, fontSize: '64px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 8
      })
      .setOrigin(0.5)
      .setScale(0.72)
      .setAlpha(0);
    studio.setShadow(0, 8, 'rgba(0,0,0,0.35)', 10, false, true);

    const en = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 26, 'R E B O U N D   S T U D I O', {
        fontFamily: FONT, fontSize: '15px', color: '#ffd43b', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const line = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 56, 0, 3, 0xffd43b, 0.8);
    const tag = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 86, '王博晋升之路 · 跑酷', {
        fontFamily: FONT, fontSize: '18px', color: '#cfe3ff', resolution: 2
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: studio, scale: 1, alpha: 1, duration: 420, ease: 'Back.out' });
    this.tweens.add({ targets: en, alpha: 1, y: en.y - 6, duration: 360, delay: 180, ease: 'Quad.out' });
    this.tweens.add({ targets: line, width: 210, duration: 420, delay: 260, ease: 'Cubic.out' });
    this.tweens.add({ targets: tag, alpha: 1, duration: 320, delay: 380, ease: 'Quad.out' });

    // 细小的上扬光点
    for (let i = 0; i < 10; i++) {
      const s = this.add
        .image(Phaser.Math.Between(300, 660), Phaser.Math.Between(330, 470), 'spark')
        .setScale(Phaser.Math.FloatBetween(0.15, 0.4))
        .setAlpha(0);
      this.tweens.add({
        targets: s,
        alpha: { from: 0, to: 0.7 },
        y: s.y - Phaser.Math.Between(40, 110),
        duration: Phaser.Math.Between(700, 1300),
        delay: Phaser.Math.Between(200, 700),
        ease: 'Quad.out'
      });
    }

    let leaving = false;
    const goTitle = () => {
      if (leaving) return;
      leaving = true;
      this.cameras.main.fadeOut(220, 7, 20, 42);
      this.time.delayedCall(230, () => this.scene.start('Title'));
    };
    this.time.delayedCall(1600, goTitle);
    this.input.once('pointerdown', goTitle);
    this.input.keyboard?.once('keydown-SPACE', goTitle);
  }
}
