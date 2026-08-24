import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    // 用户提供的角色图片（原图直接使用）
    this.load.image('player', '像素角色.jpeg');

    // 生成占位障碍与地面贴图
    const g = this.add.graphics();
    g.fillStyle(0x8e5a2b, 1);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture('obstacle', 16, 16);
    g.clear();
    g.fillStyle(0x3f9f2f, 1);
    g.fillRect(0, 0, 16, 8);
    g.generateTexture('ground', 16, 8);
    g.destroy();
  }

  create() {
    this.scene.start('Game');
  }
}


