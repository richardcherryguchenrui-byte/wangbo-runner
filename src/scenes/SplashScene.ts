import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

// 开场介绍页:彩色标题展示 3 秒后进入主页面(点击可跳过)
export default class SplashScene extends Phaser.Scene {
  constructor() { super('Splash'); }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0e1a2f);

    const text = '你们觉得怎么样反贪工作室出品';
    const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#f783ac'];
    const fontSize = 34;
    const totalWidth = text.length * fontSize; // 等宽字体近似
    let x = GAME_WIDTH / 2 - totalWidth / 2 + fontSize / 2;

    const chars: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < text.length; i++) {
      const c = this.add
        .text(x, GAME_HEIGHT / 2, text[i], {
          fontFamily: 'monospace',
          fontSize: `${fontSize}px`,
          color: colors[i % colors.length],
          stroke: '#ffffff',
          strokeThickness: 2
        })
        .setOrigin(0.5)
        .setScale(0);
      chars.push(c);
      x += fontSize;
    }

    // 逐字弹入
    chars.forEach((c, i) => {
      this.tweens.add({
        targets: c,
        scale: 1,
        duration: 220,
        delay: i * 70,
        ease: 'Back.out'
      });
    });

    // 整体呼吸
    this.tweens.add({
      targets: chars,
      scale: 1.06,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      delay: text.length * 70 + 200
    });

    // 3 秒后进入主页面;点击可跳过
    const goTitle = () => this.scene.start('Title');
    this.time.delayedCall(3000, goTitle);
    this.input.once('pointerdown', goTitle);
  }
}
