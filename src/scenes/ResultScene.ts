import Phaser from 'phaser';
import { GAME_WIDTH, GROUND_TOP } from '../config/constants';
import { loadProgress, getTitle } from '../systems/progress';
import { makeButton } from '../systems/ui';

export default class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data: { timeMs?: number; win?: boolean; dodged?: number; coins?: number }) {
    this.data.set('timeMs', data?.timeMs ?? 0);
    this.data.set('win', data?.win ?? false);
    this.data.set('dodged', data?.dodged ?? 0);
    this.data.set('coins', data?.coins ?? 0);
  }

  create() {
    const timeMs = this.data.get('timeMs') as number;
    const win = this.data.get('win') as boolean;
    const dodged = this.data.get('dodged') as number;
    const coins = this.data.get('coins') as number;
    const p = loadProgress();
    const best = Number(localStorage.getItem('bestTimeMs') || '0');
    const timeText = `用时:${(timeMs / 1000).toFixed(1)}s`;
    const bestText = best ? `最佳:${(best / 1000).toFixed(1)}s` : '最佳:—';

    const centerY = GROUND_TOP / 2;
    const outline = { stroke: '#1d3557', strokeThickness: 4 };

    const headline = win ? '🎉 晋升成功!' : '被鸡煎胃抓进局子';
    this.add
      .text(GAME_WIDTH / 2, centerY - 78, headline, {
        fontFamily: 'monospace', fontSize: '32px',
        color: win ? '#ffe066' : '#ffffff', ...outline
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, centerY - 24, `${timeText}  |  ${bestText}`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', ...outline
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, centerY + 16, `本局翻越:${dodged} 个障碍   银币 +${coins}${win ? '(含晋升奖金5)' : ''}`, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffe066', ...outline
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, centerY + 52, `当前称号:${getTitle(p.totalDodged)}   累计翻越:${p.totalDodged}   🪙 ${p.coins}`, {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', ...outline
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, centerY + 116, 240, 56, '▶ 再来一局', () => this.scene.start('Game'), 22);
    makeButton(this, GAME_WIDTH / 2, centerY + 170, 180, 40, '🏠 主菜单', () => this.scene.start('Title'), 16);

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
  }
}
