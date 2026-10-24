import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress, saveProgress, bribeCarryLimit } from '../systems/progress';
import { makeHeroButton, showToast, FONT, addPanel } from '../systems/ui';
import { startBgm } from '../systems/audio';
import { buildMenuBackdrop, buildMenuHeader, addMenuFooter } from '../systems/menu';

const BRIBE_MOON_PRICE = 500;

export default class GuShopScene extends Phaser.Scene {
  constructor() { super('GuShop'); }

  create() {
    startBgm(this);
    this.draw();
  }

  private draw() {
    const p = loadProgress();
    const maxCarry = bribeCarryLimit(p);
    buildMenuBackdrop(this, { mood: 'purple' });
    buildMenuHeader(this, '顾哥神秘商铺', '顾教授的贿月 · 只收银币,不问来路', { coins: p.coins });

    // 商品大卡
    addPanel(this, 150, 110, 660, 330, {
      fill: 0x241542, fillAlpha: 0.85, stroke: 0xc9a7ff, strokeAlpha: 0.32, radius: 26
    }).setDepth(21);

    const burst = this.add
      .image(480, 230, 'burst')
      .setScale(1.2)
      .setAlpha(0.22)
      .setTint(0xc9a7ff)
      .setDepth(22);
    this.tweens.add({ targets: burst, angle: 360, duration: 18000, repeat: -1 });

    const moon = this.add.image(480, 212, 'bribe-moon').setScale(2.3).setDepth(23);
    this.tweens.add({
      targets: moon, y: moon.y - 10, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });

    this.add
      .text(480, 294, '顾教授的贿月', {
        fontFamily: FONT, fontSize: '26px', color: '#ffe066', fontStyle: 'bold',
        resolution: 2, stroke: '#150c2b', strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(24);
    this.add
      .text(480, 326, `使用后获得一次免伤 · 可多次使用，每次消耗 1 个 · 开局最多携带 ${maxCarry} 个`, {
        fontFamily: FONT, fontSize: '12px', color: '#d8c7ff', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(24);

    // 三个小数据
    const stats: [string, string][] = [
      ['免伤', '1 次'],
      ['库存', `${p.bribeMoon}/${maxCarry} 个`],
      ['价格', `${BRIBE_MOON_PRICE} 银币`]
    ];
    stats.forEach(([label, value], i) => {
      const x = 300 + i * 180;
      const g = this.add.graphics().setDepth(23);
      g.fillStyle(0xffffff, 0.055);
      g.fillRoundedRect(x - 72, 342, 144, 32, 10);
      g.lineStyle(1, 0xffffff, 0.1);
      g.strokeRoundedRect(x - 72, 342, 144, 32, 10);
      this.add
        .text(x - 58, 358, label, { fontFamily: FONT, fontSize: '10px', color: '#a98bd0', resolution: 2 })
        .setOrigin(0, 0.5)
        .setDepth(24);
      this.add
        .text(x + 58, 358, value, { fontFamily: FONT, fontSize: '13px', color: '#ffe066', fontStyle: 'bold', resolution: 2 })
        .setOrigin(1, 0.5)
        .setDepth(24);
    });

    const full = p.bribeMoon >= maxCarry;
    const buy = makeHeroButton(this, 480, 400, 300, 50, full ? '库存已满' : `${BRIBE_MOON_PRICE} 银币购买`, () => {
      if (full) {
        showToast(this, GAME_WIDTH / 2, 486, `最多持有 ${maxCarry} 个贿月,先用掉再来`);
        return;
      }
      const cur = loadProgress();
      if (cur.bribeMoon >= maxCarry) {
        showToast(this, GAME_WIDTH / 2, 486, `最多持有 ${maxCarry} 个贿月,先用掉再来`);
        return;
      }
      if (cur.coins >= BRIBE_MOON_PRICE) {
        cur.coins -= BRIBE_MOON_PRICE;
        cur.totalSpent += BRIBE_MOON_PRICE;
        cur.bribeMoon += 1;
        saveProgress(cur);
        showToast(this, GAME_WIDTH / 2, 486, `购买成功!贿月库存 +1(共 ${cur.bribeMoon} 个)`, '#ffe066', 'ui-moon');
        this.time.delayedCall(650, () => this.scene.restart());
      } else {
        showToast(this, GAME_WIDTH / 2, 486, '银币不足!多翻越障碍赚银币吧');
      }
    }, { iconKey: full ? undefined : 'ui-moon', iconSize: 22, fontSize: 20 });
    buy.g.setDepth(26);
    buy.text.setDepth(27);
    buy.hit.setDepth(28);
    if (full) {
      buy.g.setAlpha(0.5);
      buy.text.setAlpha(0.7);
    }

    this.add
      .text(480, 466, '「有些忙,月亮会替你摆平。」—— 顾教授', {
        fontFamily: FONT, fontSize: '12px', color: '#c9a7ff', fontStyle: 'italic', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(24)
      .setAlpha(0.85);

    addMenuFooter(this, '顾哥神秘商铺 · 仅此一家 · 童叟无欺');
  }
}
