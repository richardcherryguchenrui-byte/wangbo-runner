import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data: { timeMs?: number; win?: boolean }) {
    this.data.set('timeMs', data?.timeMs ?? 0);
    this.data.set('win', data?.win ?? false);
  }

  create() {
    const timeMs = this.data.get('timeMs') as number;
    const win = this.data.get('win') as boolean;
    const best = Number(localStorage.getItem('bestTimeMs') || '0');
    const timeText = `用时：${(timeMs / 1000).toFixed(1)}s`;
    const bestText = best ? `最佳：${(best / 1000).toFixed(1)}s` : '最佳：—';

    const headline = win ? '🎉 晋升成功!' : '被鸡煎胃抓进局子';
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, headline, { fontFamily: 'monospace', fontSize: '14px', color: win ? '#ffe066' : '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 4, `${timeText}  |  ${bestText}`, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32, '点击任意处再来一局', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('Game'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
  }
}


