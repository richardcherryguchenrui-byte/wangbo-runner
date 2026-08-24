import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import {
  loadProgress,
  saveProgress,
  SHOP_ITEMS,
  nextLifeThreshold,
  MAX_EXTRA_LIVES,
  SKIN_QITONGWEI_REQUIREMENT,
  type ShopItem
} from '../systems/progress';
import { makeButton, showToast } from '../systems/ui';

export default class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    const p = loadProgress();
    this.draw(p);
  }

  private draw(p: ReturnType<typeof loadProgress>) {
    const outline = { stroke: '#1d3557', strokeThickness: 4 };
    this.add.text(GAME_WIDTH / 2, 30, '🛒 晋升商店', { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', ...outline }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 66, `余额:🪙 ${p.coins}   累计翻越:${p.totalDodged}   翻越障碍赚银币,兑换装备`, { fontFamily: 'monospace', fontSize: '15px', color: '#ffe066', ...outline }).setOrigin(0.5);

    SHOP_ITEMS.forEach((item, i) => {
      this.drawRow(item, i, p);
    });

    makeButton(this, 66, 26, 100, 36, '← 返回', () => this.scene.start('Title'), 15);
  }

  private drawRow(item: ShopItem, i: number, p: ReturnType<typeof loadProgress>) {
    const y = 104 + i * 52;
    const owned = p.owned.includes(item.id);
    const equipped = item.kind === 'pendant' && p.pendant === item.pendant;

    // 生命升级行:单独处理
    if (item.kind === 'life') {
      const threshold = nextLifeThreshold(p);
      const maxed = p.extraLives >= MAX_EXTRA_LIVES;
      const eligible = threshold !== null && p.totalDodged >= threshold;
      let statusText: string;
      let statusColor: string;
      if (maxed) { statusText = '已满级 ✓'; statusColor = '#7dffa8'; }
      else if (eligible) { statusText = '可升级!点击解锁'; statusColor = '#ffe066'; }
      else { statusText = `需累计翻越 ${threshold}(当前 ${p.totalDodged})`; statusColor = '#ff9999'; }

      const row = this.add
        .rectangle(GAME_WIDTH / 2, y, 700, 44, 0x1d3557, 0.55)
        .setStrokeStyle(1, 0xffffff, 0.4)
        .setInteractive({ useHandCursor: true });
      this.add.text(90, y, item.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5);
      this.add.text(270, y, `当前:初始生命 ${2 + p.extraLives} 条`, { fontFamily: 'monospace', fontSize: '14px', color: '#cfe3ff' }).setOrigin(0, 0.5);
      this.add.text(840, y, statusText, { fontFamily: 'monospace', fontSize: '14px', color: statusColor }).setOrigin(1, 0.5);

      row.on('pointerdown', () => {
        if (maxed) {
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, '生命已满级!');
        } else if (eligible && threshold !== null) {
          p.extraLives += 1;
          saveProgress(p);
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, `解锁成功!初始生命 +1(共 ${2 + p.extraLives} 条)`);
          this.scene.restart();
        } else {
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, `还需翻越 ${threshold! - p.totalDodged} 个障碍`);
        }
      });
      return;
    }

    // 皮肤行(祁同伟):按累计翻越数解锁
    if (item.kind === 'skin') {
      const unlocked = p.totalDodged >= SKIN_QITONGWEI_REQUIREMENT;
      const using = p.skin === 'qitongwei';
      let statusText: string;
      let statusColor: string;
      if (using) { statusText = '使用中 ✓'; statusColor = '#7dffa8'; }
      else if (unlocked) { statusText = '已解锁 · 点击使用'; statusColor = '#ffe066'; }
      else { statusText = `需累计翻越 ${SKIN_QITONGWEI_REQUIREMENT}(当前 ${p.totalDodged})`; statusColor = '#ff9999'; }

      const row = this.add
        .rectangle(GAME_WIDTH / 2, y, 700, 44, 0x1d3557, 0.55)
        .setStrokeStyle(1, 0xffffff, 0.4)
        .setInteractive({ useHandCursor: true });
      this.add.text(90, y, item.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5);
      this.add.text(270, y, item.desc, { fontFamily: 'monospace', fontSize: '14px', color: '#cfe3ff' }).setOrigin(0, 0.5);
      this.add.text(840, y, statusText, { fontFamily: 'monospace', fontSize: '14px', color: statusColor }).setOrigin(1, 0.5);

      row.on('pointerdown', () => {
        if (using) {
          p.skin = '';
          saveProgress(p);
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, '已换回原角色');
          this.scene.restart();
        } else if (unlocked) {
          p.skin = 'qitongwei';
          saveProgress(p);
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, '已装备祁同伟皮肤!');
          this.scene.restart();
        } else {
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, `还需翻越 ${SKIN_QITONGWEI_REQUIREMENT - p.totalDodged} 个障碍`);
        }
      });
      return;
    }

    const row = this.add
      .rectangle(GAME_WIDTH / 2, y, 700, 44, 0x1d3557, 0.55)
      .setStrokeStyle(1, 0xffffff, 0.4)
      .setInteractive({ useHandCursor: true });

    let statusText: string;
    if (item.kind === 'pistol' && owned) statusText = '已解锁 ✓';
    else if (equipped) statusText = '装备中 ✓';
    else if (owned) statusText = '点击装备';
    else statusText = p.coins >= item.price ? `🪙${item.price} 购买` : `🪙${item.price} 不足`;

    const statusColor = (equipped || (owned && item.kind === 'pistol')) ? '#7dffa8' : p.coins >= item.price ? '#ffe066' : '#ff9999';

    this.add.text(90, y, item.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.add.text(270, y, item.desc, { fontFamily: 'monospace', fontSize: '14px', color: '#cfe3ff' }).setOrigin(0, 0.5);
    this.add.text(840, y, statusText, { fontFamily: 'monospace', fontSize: '15px', color: statusColor }).setOrigin(1, 0.5);

    row.on('pointerdown', () => {
      if (!owned) {
        if (p.coins >= item.price) {
          p.coins -= item.price;
          p.owned.push(item.id);
          saveProgress(p);
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, `已购买:${item.name}`);
          this.scene.restart();
        } else {
          showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, '银币不足!多翻越障碍赚银币吧');
        }
      } else if (item.kind === 'pendant') {
        p.pendant = item.pendant!;
        saveProgress(p);
        this.scene.restart();
      }
    });
  }
}
