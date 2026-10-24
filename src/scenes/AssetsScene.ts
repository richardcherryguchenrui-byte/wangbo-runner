// 家产与人脉:贪官养成界面
// 左边建造贪污资产(随时间产钱),右边经营人脉(降风险/提收益/审查保命),
// 顶部红色风险条 + 洗白按钮,进入界面时结算离线收益并可能撞上纪检委审查。
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress, saveProgress } from '../systems/progress';
import { buildMenuBackdrop, buildMenuHeader, addMenuCard, addMenuFooter } from '../systems/menu';
import { showToast, FONT, makeButton } from '../systems/ui';
import { startBgm, playSfx } from '../systems/audio';
import { confettiBurst, shake, redFlash } from '../systems/effects';
import {
  ASSETS,
  NETWORK,
  nextCost,
  incomePerMin,
  netRisk,
  rawRisk,
  protection,
  auditShield,
  accrueOffline,
  resolveAudit,
  launderCost,
  launderEffect,
  type Holdings
} from '../systems/assets';

const ASSET_ICONS: Record<string, string> = {
  purse: 'coin', villa: 'bg-hotel', shell: 'ui-shop',
  mine: 'ui-bolt', offshore: 'ui-share', estate: 'bg-tower'
};
const NETWORK_ICONS: Record<string, string> = {
  mentor: 'ui-person', secretary: 'ui-clipboard', accountant: 'ui-save',
  inspector: 'ui-siren', cadre: 'ui-rank'
};

const LEFT_X = 20;
const LEFT_W = 452;
const RIGHT_X = 488;
const RIGHT_W = 452;
const ROW_H = 54;

export default class AssetsScene extends Phaser.Scene {
  private holdings: Holdings = { assets: {}, network: {}, laundered: 0 };
  private coins = 0;
  private rowRefs: { refresh: () => void }[] = [];
  private coinText?: Phaser.GameObjects.Text;
  private incomeText?: Phaser.GameObjects.Text;
  private protectText?: Phaser.GameObjects.Text;

  constructor() {
    super('Assets');
  }

  create() {
    startBgm(this);
    const p = loadProgress();
    this.holdings = {
      assets: { ...(p.assets ?? {}) },
      network: { ...(p.network ?? {}) },
      laundered: p.laundered ?? 0
    };
    this.coins = p.coins;
    this.rowRefs = [];

    buildMenuBackdrop(this, { mood: 'night' });
    const header = buildMenuHeader(this, '家产与人脉', '钱要生钱,关系也要养', { coins: this.coins });
    const maybeCoin = (header as { text?: Phaser.GameObjects.Text } | undefined)?.text;
    this.coinText = maybeCoin;

    this.collectOffline(p);
    this.drawAssetColumn();
    this.drawNetworkColumn();
    this.drawRiskPanel();
    addMenuFooter(this, '资产越肥风险越高 · 洗白能压风险,人脉能保命');
    this.refreshAll();
    this.maybeAudit(p);
  }

  // ---- 离线收益 ----
  private collectOffline(p: ReturnType<typeof loadProgress>) {
    const now = Date.now();
    const last = p.lastAccrualAt || 0;
    const elapsed = last > 0 ? now - last : 0;
    const r = accrueOffline(this.holdings, elapsed);
    p.lastAccrualAt = now;
    if (r.coins > 0) {
      this.coins += r.coins;
      p.coins = this.coins;
      const tip = r.capped ? '(离线收益按 12 小时封顶)' : '';
      this.time.delayedCall(320, () => {
        showToast(this, GAME_WIDTH / 2, 150, `离线进账 +${r.coins} 银币 ${tip}`, '#ffe066', 'coin');
      });
      playSfx(this, 'coin', 0.4);
    }
    saveProgress(p);
  }

  // ---- 纪检委审查 ----
  private maybeAudit(p: ReturnType<typeof loadProgress>) {
    const now = Date.now();
    const last = p.lastAuditAt || 0;
    // 至少隔 2 分钟才可能被查,避免每次点进来都提心吊胆
    if (last > 0 && now - last < 120000) return;
    p.lastAuditAt = now;
    const risk = netRisk(this.holdings);
    if (risk <= 0) {
      saveProgress(p);
      return;
    }
    const shieldLeft = Math.max(0, auditShield(this.holdings) - (p.auditsSurvived > 0 ? 0 : 0));
    const r = resolveAudit(this.holdings, this.coins, Math.random(), shieldLeft);
    if (!r.triggered) {
      saveProgress(p);
      return;
    }
    this.time.delayedCall(700, () => {
      if (r.shielded) {
        p.auditsSurvived += 1;
        showToast(this, GAME_WIDTH / 2, 190, `巡视组来了 · ${r.message}`, '#8ce99a', 'ui-siren');
        playSfx(this, 'shield', 0.5);
      } else if (r.passed) {
        p.auditsSurvived += 1;
        showToast(this, GAME_WIDTH / 2, 190, `纪检委来了 · ${r.message}`, '#ffe066', 'ui-siren');
      } else {
        // 没收资产 + 罚款
        if (r.seizedAssetId) {
          const cur = this.holdings.assets[r.seizedAssetId] ?? 0;
          this.holdings.assets[r.seizedAssetId] = Math.max(0, cur - 1);
        }
        this.coins = Math.max(0, this.coins - r.fine);
        p.assetsSeized += r.seizedAssetId ? 1 : 0;
        redFlash(this);
        shake(this, 0.014, 300);
        playSfx(this, 'gameover', 0.5);
        showToast(this, GAME_WIDTH / 2, 190, `被查了 · ${r.message}${r.fine > 0 ? ` · 罚款 ${r.fine}` : ''}`, '#ff8787', 'ui-siren');
      }
      p.coins = this.coins;
      p.assets = this.holdings.assets;
      p.network = this.holdings.network;
      p.laundered = this.holdings.laundered ?? 0;
      saveProgress(p);
      this.time.delayedCall(500, () => this.scene.restart());
    });
  }

  // ---- 资产列表 ----
  private drawAssetColumn() {
    this.add.text(LEFT_X + 8, 78, '贪污资产', {
      fontFamily: FONT, fontSize: '14px', color: '#ffe066', fontStyle: 'bold', resolution: 2
    }).setDepth(21);
    this.incomeText = this.add.text(LEFT_X + LEFT_W - 8, 78, '', {
      fontFamily: FONT, fontSize: '12px', color: '#8ce99a', resolution: 2
    }).setOrigin(1, 0).setDepth(21);

    ASSETS.forEach((a, i) => {
      const y = 100 + i * ROW_H;
      const level = this.holdings.assets[a.id] ?? 0;
      addMenuCard(this, LEFT_X, y, LEFT_W, ROW_H - 6, { depth: 20 });
      this.add.image(LEFT_X + 24, y + (ROW_H - 6) / 2, ASSET_ICONS[a.id] ?? 'coin')
        .setDisplaySize(22, 22).setDepth(22);
      const name = this.add.text(LEFT_X + 44, y + 8, a.name, {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold', resolution: 2
      }).setDepth(22);
      const info = this.add.text(LEFT_X + 44, y + 27, '', {
        fontFamily: FONT, fontSize: '10px', color: '#93b5d6', resolution: 2
      }).setDepth(22);
      const lv = this.add.text(LEFT_X + LEFT_W - 122, y + 8, '', {
        fontFamily: FONT, fontSize: '12px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      }).setOrigin(1, 0).setDepth(22);

      const btn = makeButton(this, LEFT_X + LEFT_W - 66, y + (ROW_H - 6) / 2, 96, 30, '', () => this.buyAsset(a.id), 12, {
        depth: 22, fill: 0x1d4a2f
      });

      const refresh = () => {
        const cur = this.holdings.assets[a.id] ?? 0;
        const cost = nextCost(a, cur);
        lv.setText(cur > 0 ? `Lv.${cur}` : '未建');
        info.setText(cur > 0
          ? `+${a.incomePerMin * cur}/分 · 风险 ${a.risk * cur}`
          : `${a.desc}`);
        if (cost === null) {
          btn.text.setText('已满级');
          btn.rect.setAlpha(0.6);
        } else {
          btn.text.setText(`${cost}`);
          btn.rect.setAlpha(this.coins >= cost ? 1 : 0.55);
        }
        name.setColor(cur > 0 ? '#ffe066' : '#ffffff');
      };
      refresh();
      this.rowRefs.push({ refresh });
    });
  }

  // ---- 人脉列表 ----
  private drawNetworkColumn() {
    this.add.text(RIGHT_X + 8, 78, '人脉关系', {
      fontFamily: FONT, fontSize: '14px', color: '#b197fc', fontStyle: 'bold', resolution: 2
    }).setDepth(21);
    this.protectText = this.add.text(RIGHT_X + RIGHT_W - 8, 78, '', {
      fontFamily: FONT, fontSize: '12px', color: '#8ce99a', resolution: 2
    }).setOrigin(1, 0).setDepth(21);

    NETWORK.forEach((n, i) => {
      const y = 172 + i * ROW_H;
      addMenuCard(this, RIGHT_X, y, RIGHT_W, ROW_H - 6, { depth: 20 });
      this.add.image(RIGHT_X + 24, y + (ROW_H - 6) / 2, NETWORK_ICONS[n.id] ?? 'ui-person')
        .setDisplaySize(22, 22).setDepth(22);
      this.add.text(RIGHT_X + 44, y + 8, n.name, {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold', resolution: 2
      }).setDepth(22);
      const info = this.add.text(RIGHT_X + 44, y + 27, '', {
        fontFamily: FONT, fontSize: '10px', color: '#93b5d6', resolution: 2
      }).setDepth(22);
      const lv = this.add.text(RIGHT_X + RIGHT_W - 122, y + 8, '', {
        fontFamily: FONT, fontSize: '12px', color: '#b197fc', fontStyle: 'bold', resolution: 2
      }).setOrigin(1, 0).setDepth(22);
      const btn = makeButton(this, RIGHT_X + RIGHT_W - 66, y + (ROW_H - 6) / 2, 96, 30, '', () => this.buyNetwork(n.id), 12, {
        depth: 22, fill: 0x2d2350
      });

      const refresh = () => {
        const cur = this.holdings.network[n.id] ?? 0;
        const cost = nextCost(n, cur);
        lv.setText(cur > 0 ? `Lv.${cur}` : '未结交');
        const perks: string[] = [];
        if (n.protection > 0) perks.push(`风险 -${n.protection * cur}`);
        if (n.incomeBonus > 0) perks.push(`收益 +${n.incomeBonus * cur}%`);
        if (n.auditShield > 0) perks.push(`豁免 ×${n.auditShield * cur}`);
        info.setText(cur > 0 ? perks.join(' · ') : n.desc);
        if (cost === null) {
          btn.text.setText('已满级');
          btn.rect.setAlpha(0.6);
        } else {
          btn.text.setText(`${cost}`);
          btn.rect.setAlpha(this.coins >= cost ? 1 : 0.55);
        }
      };
      refresh();
      this.rowRefs.push({ refresh });
    });
  }

  // ---- 风险面板 ----
  private drawRiskPanel() {
    const y = 96;
    const h = 62;
    const g = this.add.graphics().setDepth(21);
    g.fillStyle(0x2a0f14, 0.92);
    g.fillRoundedRect(RIGHT_X, y, RIGHT_W, h, 12);
    g.lineStyle(1.5, 0xff6b6b, 0.45);
    g.strokeRoundedRect(RIGHT_X, y, RIGHT_W, h, 12);

    this.add.image(RIGHT_X + 24, y + 22, 'ui-siren').setDisplaySize(18, 18).setDepth(22);
    const riskText = this.add.text(RIGHT_X + 42, y + 14, '', {
      fontFamily: FONT, fontSize: '13px', color: '#ff8787', fontStyle: 'bold', resolution: 2
    }).setDepth(22);
    const bar = this.add.graphics().setDepth(22);
    const detail = this.add.text(RIGHT_X + 42, y + 34, '', {
      fontFamily: FONT, fontSize: '10px', color: '#e2b6b6', resolution: 2
    }).setDepth(22);

    const cleanBtn = makeButton(this, RIGHT_X + RIGHT_W - 78, y + h / 2, 132, 32, '', () => this.doLaunder(), 12, {
      depth: 23, fill: 0x4a2b12
    });

    const refresh = () => {
      const risk = netRisk(this.holdings);
      riskText.setText(`被查风险 ${risk} / 100`);
      detail.setText(`资产风险 ${rawRisk(this.holdings)} - 人脉保护 ${protection(this.holdings)}`
        + (this.holdings.laundered ? ` - 已洗白 ${this.holdings.laundered}` : ''));
      bar.clear();
      const bw = RIGHT_W - 100;
      const bx = RIGHT_X + 42;
      const by = y + 30;
      bar.fillStyle(0x3a1a20, 1);
      bar.fillRoundedRect(bx, by, bw, 6, 3);
      bar.fillStyle(risk > 60 ? 0xff3b3b : risk > 25 ? 0xff922b : 0x69db7c, 0.95);
      bar.fillRoundedRect(bx, by, Math.max(3, bw * (risk / 100)), 6, 3);
      const cost = launderCost(this.holdings);
      const eff = launderEffect(this.holdings);
      cleanBtn.text.setText(risk > 0 ? `洗白 -${eff} · ${cost}` : '暂无风险');
      cleanBtn.rect.setAlpha(risk > 0 && this.coins >= cost ? 1 : 0.55);
    };
    refresh();
    this.rowRefs.push({ refresh });
  }

  private refreshAll() {
    this.incomeText?.setText(`+${incomePerMin(this.holdings)} 银币/分`);
    this.protectText?.setText(`风险保护 -${protection(this.holdings)}`);
    this.coinText?.setText(String(this.coins));
    this.rowRefs.forEach(r => r.refresh());
  }

  // ---- 购买 ----
  private buyAsset(id: string) {
    const a = ASSETS.find(x => x.id === id);
    if (!a) return;
    const cur = this.holdings.assets[id] ?? 0;
    const cost = nextCost(a, cur);
    if (cost === null) return;
    if (this.coins < cost) {
      showToast(this, GAME_WIDTH / 2, 150, '银币不够 · 先去跑两圈', '#ff8787', 'coin');
      return;
    }
    this.coins -= cost;
    this.holdings.assets[id] = cur + 1;
    playSfx(this, cur === 0 ? 'unlock' : 'coin', 0.45);
    if (cur === 0) {
      confettiBurst(this, GAME_WIDTH / 2, 150, 16);
      showToast(this, GAME_WIDTH / 2, 150, `建好了「${a.name}」· 开始生钱`, '#ffe066', 'ui-shop');
    }
    this.persist();
  }

  private buyNetwork(id: string) {
    const n = NETWORK.find(x => x.id === id);
    if (!n) return;
    const cur = this.holdings.network[id] ?? 0;
    const cost = nextCost(n, cur);
    if (cost === null) return;
    if (this.coins < cost) {
      showToast(this, GAME_WIDTH / 2, 150, '银币不够 · 关系也是要花钱的', '#ff8787', 'coin');
      return;
    }
    this.coins -= cost;
    this.holdings.network[id] = cur + 1;
    playSfx(this, 'unlock', 0.4);
    showToast(this, GAME_WIDTH / 2, 150, `和「${n.name}」吃上了饭`, '#b197fc', 'ui-person');
    this.persist();
  }

  private doLaunder() {
    const risk = netRisk(this.holdings);
    const cost = launderCost(this.holdings);
    if (risk <= 0) {
      showToast(this, GAME_WIDTH / 2, 150, '干干净净,不用洗', '#8ce99a', 'ui-check');
      return;
    }
    if (this.coins < cost) {
      showToast(this, GAME_WIDTH / 2, 150, `洗白要 ${cost} 银币,不够`, '#ff8787', 'coin');
      return;
    }
    const eff = launderEffect(this.holdings);
    this.coins -= cost;
    this.holdings.laundered = (this.holdings.laundered ?? 0) + eff;
    playSfx(this, 'shield', 0.45);
    showToast(this, GAME_WIDTH / 2, 150, `账做平了 · 风险 -${eff}`, '#8ce99a', 'ui-check');
    this.persist();
  }

  private persist() {
    const p = loadProgress();
    p.coins = this.coins;
    p.assets = this.holdings.assets;
    p.network = this.holdings.network;
    p.laundered = this.holdings.laundered ?? 0;
    p.lastAccrualAt = Date.now();
    saveProgress(p);
    this.refreshAll();
    // 顶部银币显示同步
    if (this.coinText) this.coinText.setText(String(this.coins));
  }
}
