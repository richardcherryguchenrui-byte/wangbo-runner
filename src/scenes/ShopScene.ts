import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import {
  loadProgress,
  saveProgress,
  SHOP_ITEMS,
  nextLifeThreshold,
  MAX_EXTRA_LIVES,
  SKIN_QITONGWEI_REQUIREMENT,
  PISTOL_UPGRADE_PRICES,
  BRIBE_UPGRADE_PRICES,
  type ShopItem,
  type Progress
} from '../systems/progress';
import { showToast } from '../systems/ui';
import { startBgm } from '../systems/audio';
import { buildMenuBackdrop, buildMenuHeader, addMenuCard, addMenuFooter } from '../systems/menu';

const FONT = "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";
const CARD_X = [38, 502];
const CARD_W = 420;
const CARD_H = 46;
const FIRST_Y = 112;
const ROW_STEP = 50;

export default class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    startBgm(this);
    const p = loadProgress();
    this.draw(p);
  }

  private draw(p: Progress) {
    buildMenuBackdrop(this, { mood: 'dawn' });
    buildMenuHeader(this, '🛒 晋升商店', '皮肤 · 挂件 · 装备,一次购买永久生效', { coins: p.coins });
    addMenuFooter(this, `累计翻越 ${p.totalDodged} 个障碍 · 每翻越一个都能攒银币`);

    // 顶部信息条
    this.add
      .text(38, 102, `已拥有 ${p.owned.length} 件 · 累计消费 🪙${p.totalSpent}`, {
        fontFamily: FONT, fontSize: '11px', color: '#93b5d6', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(21);
    this.add
      .text(922, 102, '点击卡片购买 / 装备', {
        fontFamily: FONT, fontSize: '11px', color: '#ffe066', resolution: 2
      })
      .setOrigin(1, 0.5)
      .setDepth(21)
      .setAlpha(0.8);

    SHOP_ITEMS.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.drawRow(item, i, CARD_X[col], FIRST_Y + row * ROW_STEP, p);
    });
  }

  private rowStatus(item: ShopItem, p: Progress): { text: string; color: string } {
    const owned = p.owned.includes(item.id);
    if (item.kind === 'life') {
      const threshold = nextLifeThreshold(p);
      if (p.extraLives >= MAX_EXTRA_LIVES) return { text: '已满级 ✓', color: '#7dffa8' };
      if (threshold !== null && p.totalDodged >= threshold) return { text: '可升级!点击解锁', color: '#ffe066' };
      return { text: `需累计翻越 ${threshold}(当前 ${p.totalDodged})`, color: '#ff9999' };
    }
    if (item.kind === 'skin' && item.skin === 'qitongwei') {
      const unlocked = p.totalDodged >= SKIN_QITONGWEI_REQUIREMENT;
      if (p.skin === 'qitongwei') return { text: '使用中 ✓', color: '#7dffa8' };
      if (unlocked) return { text: '已解锁 · 点击使用', color: '#ffe066' };
      return { text: `需累计翻越 ${SKIN_QITONGWEI_REQUIREMENT}(当前 ${p.totalDodged})`, color: '#ff9999' };
    }
    if (item.kind === 'pistolup') {
      if (!p.owned.includes('pistol')) return { text: '需先购买手枪', color: '#ff9999' };
      const level = p.pistolLevel;
      if (level >= PISTOL_UPGRADE_PRICES.length) return { text: '已满级 ✓', color: '#7dffa8' };
      const price = PISTOL_UPGRADE_PRICES[level];
      return p.coins >= price ? { text: `🪙${price} 升级`, color: '#ffe066' } : { text: `🪙${price} 不足`, color: '#ff9999' };
    }
    if (item.kind === 'bribeup') {
      if (p.bribeCarryLevel >= BRIBE_UPGRADE_PRICES.length) return { text: '已满级 ✓', color: '#7dffa8' };
      const price = BRIBE_UPGRADE_PRICES[0];
      return p.coins >= price ? { text: `🪙${price} 升级`, color: '#ffe066' } : { text: `🪙${price} 不足`, color: '#ff9999' };
    }
    if (item.kind === 'skin') {
      if (p.skin === item.skin) return { text: '使用中 ✓', color: '#7dffa8' };
      if (owned) return { text: '已拥有 · 点击装备', color: '#ffe066' };
      return p.coins >= item.price ? { text: `🪙${item.price} 购买`, color: '#ffe066' } : { text: `🪙${item.price} 不足`, color: '#ff9999' };
    }
    // pistol / pendant
    if (item.kind === 'pistol' && owned) return { text: '已解锁 ✓', color: '#7dffa8' };
    if (item.kind === 'pendant' && p.pendant === item.pendant) return { text: '装备中 ✓', color: '#7dffa8' };
    if (owned) return { text: '点击装备', color: '#ffe066' };
    return p.coins >= item.price ? { text: `🪙${item.price} 购买`, color: '#ffe066' } : { text: `🪙${item.price} 不足`, color: '#ff9999' };
  }

  private drawRow(item: ShopItem, index: number, x: number, y: number, p: Progress) {
    const status = this.rowStatus(item, p);
    const using = status.text.includes('使用中') || status.text.includes('装备中') || status.text.includes('已解锁') || status.text.includes('已满级');
    addMenuCard(this, x, y, CARD_W, CARD_H, { highlight: using });

    this.add
      .text(x + 14, y + 12, item.name, {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.add
      .text(x + 14, y + 33, item.desc, {
        fontFamily: FONT, fontSize: '10px', color: '#7f9cbd', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.add
      .text(x + CARD_W - 14, y + CARD_H / 2, status.text, {
        fontFamily: FONT, fontSize: '12px', color: status.color, fontStyle: 'bold', resolution: 2
      })
      .setOrigin(1, 0.5)
      .setDepth(12);

    const hit = this.add
      .rectangle(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(13);
    hit.on('pointerdown', () => this.handleClick(item, p, index));
  }

  private handleClick(item: ShopItem, p: Progress, index: number) {
    const owned = p.owned.includes(item.id);

    // 生命升级:按累计翻越解锁
    if (item.kind === 'life') {
      const threshold = nextLifeThreshold(p);
      if (p.extraLives >= MAX_EXTRA_LIVES) {
        showToast(this, GAME_WIDTH / 2, 486, '生命已满级!');
      } else if (threshold !== null && p.totalDodged >= threshold) {
        p.extraLives += 1;
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, `解锁成功!初始生命 +1(共 ${2 + p.extraLives} 条)`);
        this.scene.restart();
      } else {
        showToast(this, GAME_WIDTH / 2, 486, `还需翻越 ${threshold! - p.totalDodged} 个障碍`);
      }
      return;
    }

    // 祁同伟皮肤:累计翻越里程碑解锁
    if (item.kind === 'skin' && item.skin === 'qitongwei') {
      const unlocked = p.totalDodged >= SKIN_QITONGWEI_REQUIREMENT;
      if (p.skin === 'qitongwei') {
        p.skin = '';
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, '已换回原角色');
      } else if (unlocked) {
        p.skin = 'qitongwei';
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, '已装备祁同伟皮肤!');
      } else {
        showToast(this, GAME_WIDTH / 2, 486, `还需翻越 ${SKIN_QITONGWEI_REQUIREMENT - p.totalDodged} 个障碍`);
        return;
      }
      this.scene.restart();
      return;
    }

    // 弹容量升级
    if (item.kind === 'pistolup') {
      if (!p.owned.includes('pistol')) {
        showToast(this, GAME_WIDTH / 2, 486, '先购买反腐手枪才能升级');
        return;
      }
      if (p.pistolLevel >= PISTOL_UPGRADE_PRICES.length) {
        showToast(this, GAME_WIDTH / 2, 486, '弹容量已满级!');
        return;
      }
      const price = PISTOL_UPGRADE_PRICES[p.pistolLevel];
      if (p.coins < price) {
        showToast(this, GAME_WIDTH / 2, 486, '银币不足!多翻越障碍赚银币吧');
        return;
      }
      p.coins -= price;
      p.totalSpent += price;
      p.pistolLevel += 1;
      saveProgress(p);
      showToast(this, GAME_WIDTH / 2, 486, `升级成功!每局子弹 ${3 + p.pistolLevel * 2} 发`);
      this.scene.restart();
      return;
    }

    // 贿月携带扩容
    if (item.kind === 'bribeup') {
      if (p.bribeCarryLevel >= BRIBE_UPGRADE_PRICES.length) {
        showToast(this, GAME_WIDTH / 2, 486, '携带上限已满级!');
        return;
      }
      const price = BRIBE_UPGRADE_PRICES[p.bribeCarryLevel];
      if (p.coins < price) {
        showToast(this, GAME_WIDTH / 2, 486, '银币不足!多翻越障碍赚银币吧');
        return;
      }
      p.coins -= price;
      p.totalSpent += price;
      p.bribeCarryLevel += 1;
      saveProgress(p);
      showToast(this, GAME_WIDTH / 2, 486, `扩容成功!每局可携带 5 个贿月`);
      this.scene.restart();
      return;
    }

    // 普通皮肤(银币购买)
    if (item.kind === 'skin') {
      if (p.skin === item.skin) {
        p.skin = '';
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, '已换回原角色');
      } else if (owned) {
        p.skin = item.skin!;
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, `已装备「${item.name.replace('👤 皮肤·', '')}」!`);
      } else if (p.coins >= item.price) {
        p.coins -= item.price;
        p.totalSpent += item.price;
        p.owned.push(item.id);
        p.skin = item.skin!; // 购买即装备,立竿见影
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, `已购买并装备:${item.name}`);
      } else {
        showToast(this, GAME_WIDTH / 2, 486, '银币不足!多翻越障碍赚银币吧');
        return;
      }
      this.scene.restart();
      return;
    }

    // 手枪 / 挂件
    if (!owned) {
      if (p.coins >= item.price) {
        p.coins -= item.price;
        p.totalSpent += item.price;
        p.owned.push(item.id);
        saveProgress(p);
        showToast(this, GAME_WIDTH / 2, 486, `已购买:${item.name}`);
        this.scene.restart();
      } else {
        showToast(this, GAME_WIDTH / 2, 486, '银币不足!多翻越障碍赚银币吧');
      }
    } else if (item.kind === 'pendant') {
      p.pendant = item.pendant!;
      saveProgress(p);
      this.scene.restart();
    }
  }
}
