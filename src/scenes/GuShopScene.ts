import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress, saveProgress } from '../systems/progress';
import { makeButton, showToast } from '../systems/ui';

const BRIBE_MOON_PRICE = 500;
const BRIBE_MOON_MAX_CARRY = 3;

export default class GuShopScene extends Phaser.Scene {
  constructor() { super('GuShop'); }

  create() {
    this.draw();
  }

  private draw() {
    const p = loadProgress();
    const outline = { stroke: '#1d3557', strokeThickness: 4 };

    // 神秘紫色背景
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x2a1b4a);

    this.add.text(GAME_WIDTH / 2, 40, '🌙 顾哥神秘商铺', { fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif", fontSize: '30px', resolution: 2, color: '#ffd43b', ...outline }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 82, `余额:🪙 ${p.coins}   已持有贿月:${p.bribeMoon} 个`, { fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif", fontSize: '16px', resolution: 2, color: '#cfe3ff', ...outline }).setOrigin(0.5);

    // 商品展示
    this.add.image(GAME_WIDTH / 2, 250, 'bribe-moon').setScale(1.3);
    this.add
      .text(GAME_WIDTH / 2, 352, '顾教授的贿月', { fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif", fontSize: '26px', resolution: 2, color: '#ffe066', ...outline })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 392, `使用后获得一次免伤效果(开局最多携带 ${BRIBE_MOON_MAX_CARRY} 个)`, { fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif", fontSize: '15px', resolution: 2, color: '#ffffff', ...outline })
      .setOrigin(0.5);

    const buyBtn = makeButton(this, GAME_WIDTH / 2, 452, 260, 56, `🪙${BRIBE_MOON_PRICE} 购买一个`, () => {
      const cur = loadProgress();
      if (cur.coins >= BRIBE_MOON_PRICE) {
        cur.coins -= BRIBE_MOON_PRICE;
        cur.bribeMoon += 1;
        saveProgress(cur);
        showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, `购买成功!贿月库存 +1(共 ${cur.bribeMoon} 个)`);
        this.scene.restart();
      } else {
        showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 70, '银币不足!多翻越障碍赚银币吧');
      }
    }, 20);

    makeButton(this, 66, 26, 100, 36, '← 返回', () => this.scene.start('Title'), 15);
  }
}
