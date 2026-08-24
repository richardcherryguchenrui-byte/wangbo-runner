import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_TOP } from '../config/constants';
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
  }
}
