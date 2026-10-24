// 我的家:可走动的小家模式
// 贪污产业以家具模块摆在房间里(靠近按 E 升级),人脉以客人站在屋里,
// 玩家角色在房间里自由走动。货币拆成两套:
//   银币(明面收入,跑酷闯关赚)→ 首次置办产业/结交人脉
//   黑金(赃款,产业产出)     → 升级产业、打点、洗白
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress, saveProgress, type Progress } from '../systems/progress';
import { buildMenuBackdrop, addMenuFooter } from '../systems/menu';
import { showToast, FONT } from '../systems/ui';
import { startBgm, playSfx } from '../systems/audio';
import { confettiBurst, shake, redFlash } from '../systems/effects';
import { ensureSkinTextures, playerFrameKey } from '../systems/skins';
import {
  ASSETS,
  NETWORK,
  quoteCost,
  canAfford,
  incomePerMinWithWind,
  netRiskWithWind,
  netRisk,
  auditShield,
  resolveAudit,
  launderCost,
  launderEffect,
  launderYield,
  currentWind,
  assetTitle,
  assetTier,
  totalAssetValue,
  formatValue,
  newsFor,
  assetLeaderboard,
  nextRival,
  bribeCost,
  canPrestige,
  PRESTIGE_MIN_VALUE,
  PRESTIGE_BONUS,
  prestigeIncomeMul,
  ASSET_PERK_SHORT,
  type WindDef,
  type Holdings
} from '../systems/assets';
import { buildAssetShareCard, downloadCanvas } from '../systems/sharecard';
import { isWx, wxShare } from '../systems/wxapi';
import { collectOfflineIncome } from '../systems/offline';
import { noteAssetBuild, noteAuditHandled, getDaily, dailyCompletedCount, DAILY_TASKS } from '../systems/daily';

const ASSET_ICONS: Record<string, string> = {
  purse: 'as-purse', villa: 'as-villa', shell: 'as-shell',
  mine: 'as-mine', offshore: 'as-offshore', estate: 'as-estate'
};
/** 客人染色:每个人看着都不一样 */
const NETWORK_TINT: Record<string, number> = {
  mentor: 0x9aa4b2, secretary: 0xf2c9a0, accountant: 0x8fd0e8,
  inspector: 0xff9b9b, cadre: 0xc3a8ff
};

/** 房间几何:墙 58~440,地板 440~540 */
const WALL_TOP = 58;
const FLOOR_TOP = 440;
const FLOOR_BOTTOM = 540;
/** 家具(产业)沿地板前沿一字排开,纵向锚点在底边 */
const FURNITURE_X = [108, 246, 384, 522, 660, 798];
const FURNITURE_BASE = 470;
/** 客人(人脉)站在靠里的地板上 */
const NPC_X = [150, 300, 450, 600, 750];
const NPC_BASE = 440;
/** 交互提示气泡的纵向位置 */
const PROMPT_Y = 366;
/** 角色站位(脚底) */
const PLAYER_BASE = 500;

interface Interactable {
  kind: 'asset' | 'network' | 'visitor';
  id: string;
  x: number;
  y: number;
  prompt: string;
  action: () => void;
  label: Phaser.GameObjects.Text;
  highlight: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Image;
  maxLevel: number;
}

export default class AssetsScene extends Phaser.Scene {
  private holdings: Holdings = { assets: {}, network: {}, laundered: 0 };
  private coins = 0;
  private corrupt = 0;
  private wind!: WindDef;
  private savedSurvived = 0;
  private savedSeized = 0;
  private pendingBuilds = 0;
  private pendingAudits = 0;

  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private idleKey = 'player-idle';
  private moveLeft = false;
  private moveRight = false;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private runAnim = false;

  private interactables: Interactable[] = [];
  private activeIdx = -1;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Graphics;
  private hudCoins!: Phaser.GameObjects.Text;
  private hudCorrupt!: Phaser.GameObjects.Text;
  private hudIncome!: Phaser.GameObjects.Text;
  private hudRisk!: Phaser.GameObjects.Text;
  private riskBar!: Phaser.GameObjects.Graphics;
  private hudTitle!: Phaser.GameObjects.Text;
  private overlayDepth = 120;
  private pendingAuditShow: (() => void) | null = null;
  private visitorUsed = false;
  /** 客人用的主角贴图皮肤(默认就是 player-idle) */
  private npcSkin = '';
  /** 地上散落的黑金:产业每次进账会掉一点,走过去就捡起来 */
  private drops: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; amount: number }[] = [];
  private tvText?: Phaser.GameObjects.Text;
  private newsIndex = 0;
  private dangerVignette?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Assets');
  }

  create() {
    startBgm(this);
    const p = loadProgress();
    this.holdings = {
      assets: { ...(p.assets ?? {}) },
      network: { ...(p.network ?? {}) },
      laundered: p.laundered ?? 0,
      prestige: p.prestige ?? 0
    };
    this.coins = p.coins;
    this.corrupt = p.corrupt ?? 0;
    this.savedSurvived = p.auditsSurvived ?? 0;
    this.savedSeized = p.assetsSeized ?? 0;
    this.pendingBuilds = 0;
    this.pendingAudits = 0;
    this.interactables = [];
    this.activeIdx = -1;
    this.runAnim = false;
    this.moveLeft = false;
    this.moveRight = false;

    this.wind = currentWind(Date.now()).wind;

    buildMenuBackdrop(this, { mood: 'night' });
    this.buildRoom(assetTier(totalAssetValue(this.holdings)));
    this.buildHud();
    this.buildFurniture();
    this.buildNpcs();
    this.buildPlayer(p);
    this.buildInput();
    this.drawRoomButtons();
    // 多了「跑路上岸」按钮时,今日任务面板往下让一格
    this.buildDailyPanel(canPrestige(this.holdings) ? 40 : 0);

    this.collectOffline();
    this.refreshAll();
    addMenuFooter(this, 'A/D 走动 · 地上掉的黑金走过去就捡 · 靠近家具/客人按 E 交互');
    this.homeGift();
    this.maybeShowIntro(p);
    this.maybeAudit(p);
    this.time.delayedCall(2200, () => this.maybeVisitor());
    this.time.addEvent({ delay: 7600, loop: true, callback: () => this.spawnDrop() });
    this.time.addEvent({ delay: 13000, loop: true, callback: () => this.guestChatter() });
  }

  // ============================================================
  // 房间
  // ============================================================

  private buildRoom(tier: number) {
    const g = this.add.graphics().setDepth(-20);
    const wallH = FLOOR_TOP - WALL_TOP;
    for (let i = 0; i < 12; i++) {
      g.fillStyle(this.mix(0x1c2436, 0x0b1119, i / 11), 1);
      g.fillRect(0, WALL_TOP + (wallH / 12) * i, GAME_WIDTH, wallH / 12 + 1);
    }
    // 地板:近深远浅,拉出一点透视(家产越高,地板越讲究)
    const floorA = this.mix(0x2c1f12, 0x3d2a12, tier / 4);
    const floorB = this.mix(0x4d3821, 0x6b4a1c, tier / 4);
    g.fillStyle(floorA, 1);
    g.fillRect(0, FLOOR_TOP, GAME_WIDTH, FLOOR_BOTTOM - FLOOR_TOP);
    g.fillStyle(floorB, 1);
    g.fillRect(0, FLOOR_TOP, GAME_WIDTH, 4);
    g.fillStyle(floorA, 1);
    g.fillRect(0, FLOOR_TOP + 4, GAME_WIDTH, 26);
    if (tier >= 3) {
      // 高级木地板:打蜡反光
      g.fillStyle(0xffd43b, 0.05);
      g.fillEllipse(GAME_WIDTH / 2, FLOOR_TOP + 46, 700, 40);
    }
    g.lineStyle(1, 0x221708, 0.55);
    for (let x = -40; x < GAME_WIDTH + 40; x += 64) {
      g.lineBetween(x, FLOOR_TOP, x + 14, FLOOR_BOTTOM);
    }
    g.lineStyle(1, 0x1c1208, 0.5);
    for (let y = FLOOR_TOP + 30; y < FLOOR_BOTTOM; y += 22) g.lineBetween(0, y, GAME_WIDTH, y);

    // 窗户 + 夜景
    const wx = 604, wy = 100, ww = 236, wh = 132;
    g.fillStyle(0x0a1424, 1);
    g.fillRoundedRect(wx, wy, ww, wh, 8);
    g.lineStyle(4, 0x2b3448, 1);
    g.strokeRoundedRect(wx, wy, ww, wh, 8);
    g.lineBetween(wx + ww / 2, wy, wx + ww / 2, wy + wh);
    g.lineBetween(wx, wy + wh / 2, wx + ww, wy + wh / 2);
    for (let i = 0; i < 9; i++) {
      const bw = 16 + (i % 3) * 10;
      const bh = 26 + ((i * 37) % 58);
      const bx = wx + 8 + i * 25;
      g.fillStyle(0x14243a, 1);
      g.fillRect(bx, wy + wh - bh - 6, bw, bh);
      g.fillStyle(0xffe066, 0.4);
      for (let r = 0; r < Math.floor(bh / 14); r++) {
        // 越有钱,窗外的楼越亮(城市在你脚下)
        if ((i + r) % (5 - Math.min(3, tier)) === 0) continue;
        g.fillRect(bx + 3, wy + wh - bh - 2 + r * 14, 4, 5);
      }
    }
    g.fillStyle(0xf5f0e2, 0.9);
    g.fillCircle(wx + ww - 38, wy + 30, 14);

    // 吊灯
    g.lineStyle(2, 0x2b3448, 1);
    g.lineBetween(474, WALL_TOP, 474, 84);
    g.fillStyle(0x2b3448, 1);
    g.fillRoundedRect(450, 84, 48, 10, 4);
    const glow = this.add.image(474, 98, 'spark').setDepth(-18).setScale(3.4, 2.1).setAlpha(0.14).setTint(0xffe066);
    this.tweens.add({ targets: glow, alpha: 0.07, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // 墙上挂的乌纱帽(装框)
    g.fillStyle(0x3a2a18, 1);
    g.fillRect(160, 104, 96, 68);
    g.lineStyle(3, 0xffd43b, 0.4);
    g.strokeRect(160, 104, 96, 68);
    this.add.image(208, 138, 'dg-hat').setDisplaySize(56, 38).setDepth(-17);

    // 挂钟
    g.fillStyle(0x22303f, 1);
    g.fillCircle(348, 132, 24);
    g.lineStyle(3, 0x3d566d, 1);
    g.strokeCircle(348, 132, 24);
    g.fillStyle(0xe8f1f8, 0.9);
    g.fillCircle(348, 132, 18);
    g.lineStyle(2, 0x1a2431, 0.9);
    g.lineBetween(348, 132, 348, 120);
    g.lineBetween(348, 132, 358, 136);

    // 锦旗:民间送来的「为民服务」
    g.fillStyle(0x7a1f24, 1);
    g.fillRoundedRect(268, 196, 150, 68, 6);
    g.lineStyle(2, 0xffd43b, 0.55);
    g.strokeRoundedRect(268, 196, 150, 68, 6);
    g.fillStyle(0xffd43b, 0.8);
    for (let i = 0; i < 4; i++) g.fillRect(276 + i * 36, 252, 22, 5);
    this.add.text(343, 230, '为民服务', {
      fontFamily: FONT, fontSize: '17px', color: '#ffe8a3', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5).setDepth(-17).setAngle(-4);

    // 客厅电视:滚动播本市新闻(有梗也提示风险)
    g.fillStyle(0x11181f, 1);
    g.fillRoundedRect(852, 148, 100, 64, 5);
    g.fillStyle(0x0a1622, 1);
    g.fillRoundedRect(857, 153, 90, 54, 3);
    g.fillStyle(0xff5c5c, 0.85);
    g.fillRect(857, 153, 90, 4);
    this.tvText = this.add.text(902, 178, '', {
      fontFamily: FONT, fontSize: '8px', color: '#e2e8f0', align: 'center',
      lineSpacing: 2, wordWrap: { width: 80, useAdvancedWrap: true }, resolution: 2
    }).setOrigin(0.5).setDepth(-16);
    this.time.addEvent({ delay: 6200, loop: true, callback: () => this.rotateNews() });
    this.rotateNews();

    // 红头文件(装框挂墙)
    g.fillStyle(0x2a3448, 1);
    g.fillRect(452, 202, 128, 86);
    g.fillStyle(0xf3ece0, 1);
    g.fillRect(458, 208, 116, 74);
    g.fillStyle(0xb3261e, 1);
    g.fillRect(458, 208, 116, 9);
    g.lineStyle(1, 0x9aa3ad, 0.8);
    for (let i = 0; i < 5; i++) g.lineBetween(466, 228 + i * 10, 566 - (i % 2) * 26, 228 + i * 10);

    // 落地绿植
    g.fillStyle(0x2b3f2c, 1);
    g.fillRoundedRect(896, 436, 32, 30, 5);
    g.fillStyle(0x3f7a45, 1);
    for (let i = 0; i < 5; i++) {
      const a = -1.3 + i * 0.65;
      g.fillEllipse(912 + Math.cos(a) * 16, 422 + Math.sin(a) * 12, 16, 22);
    }

    // 地毯(角色活动区):家产越高越红金
    g.fillStyle(this.mix(0x5a2230, 0x7a1f24, tier / 4), 0.34 + tier * 0.03);
    g.fillEllipse(GAME_WIDTH / 2, 500, 640, 46);
    g.fillStyle(0x6b2a3a, 0.18 + tier * 0.02);
    g.fillEllipse(GAME_WIDTH / 2, 500, 560, 34);
    if (tier >= 1) {
      g.lineStyle(2, 0xffd43b, 0.18 + tier * 0.04);
      g.strokeEllipse(GAME_WIDTH / 2, 500, 640, 46);
    }
    if (tier >= 3) {
      g.lineStyle(2, 0xffd43b, 0.22);
      g.strokeEllipse(GAME_WIDTH / 2, 500, 520, 32);
    }

    // 壁灯:幕后老板以上才装得起
    if (tier >= 2) {
      [372, 574].forEach(sx => {
        g.fillStyle(0x3a2a18, 1);
        g.fillRoundedRect(sx - 6, 150, 12, 34, 4);
        g.fillStyle(0xffe066, 0.85);
        g.fillRoundedRect(sx - 14, 182, 28, 8, 4);
        const halo = this.add.image(sx, 190, 'spark').setDepth(-18).setTint(0xffe066)
          .setAlpha(0.16).setDisplaySize(120, 130);
        this.tweens.add({ targets: halo, alpha: 0.08, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
    }
    // 水晶吊灯:一方诸侯以上
    if (tier >= 4) {
      g.fillStyle(0xffe066, 0.9);
      g.fillRect(456, 94, 36, 4);
      for (let i = 0; i < 5; i++) {
        g.fillStyle(0xfff3bf, 0.85);
        g.fillTriangle(462 + i * 6, 98, 466 + i * 6, 112 + (i % 2) * 4, 458 + i * 6, 112 + (i % 2) * 4);
      }
    }
  }

  private mix(a: number, b: number, k: number): number {
    const r1 = (a >> 16) & 0xff, g1 = (a >> 8) & 0xff, b1 = a & 0xff;
    const r2 = (b >> 16) & 0xff, g2 = (b >> 8) & 0xff, b2 = b & 0xff;
    const f = (x: number, y: number) => Math.round(x + (y - x) * Phaser.Math.Clamp(k, 0, 1));
    return (f(r1, r2) << 16) | (f(g1, g2) << 8) | f(b1, b2);
  }

  // ============================================================
  // HUD
  // ============================================================

  private buildHud() {
    const header = this.add.graphics().setDepth(20);
    header.fillStyle(0x060d16, 0.94);
    header.fillRect(0, 0, GAME_WIDTH, 58);
    header.lineStyle(1, 0xffffff, 0.1);
    header.lineBetween(0, 58, GAME_WIDTH, 58);

    const back = this.add.rectangle(64, 29, 104, 34, 0x16324f, 0.95).setDepth(21).setInteractive({ useHandCursor: true });
    this.add.text(64, 29, '返回', {
      fontFamily: FONT, fontSize: '14px', color: '#cfe3ff', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5).setDepth(22);
    back.on('pointerdown', () => { playSfx(this, 'click', 0.35); this.scene.start('Title'); });

    this.add.text(GAME_WIDTH / 2, 17, '我的家', {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      resolution: 2, stroke: '#08131f', strokeThickness: 4
    }).setOrigin(0.5).setDepth(22);
    this.hudTitle = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontFamily: FONT, fontSize: '11px', color: '#ffe066', resolution: 2
    }).setOrigin(0.5).setDepth(22);

    // 双货币:银币(明面) / 黑金(赃款)
    this.add.image(GAME_WIDTH - 254, 20, 'coin').setDisplaySize(15, 15).setDepth(22);
    this.hudCoins = this.add.text(GAME_WIDTH - 242, 20, '0', {
      fontFamily: FONT, fontSize: '14px', color: '#cfe3ff', fontStyle: 'bold', resolution: 2
    }).setOrigin(0, 0.5).setDepth(22);
    this.add.text(GAME_WIDTH - 242, 38, '银币·明面', {
      fontFamily: FONT, fontSize: '9px', color: '#8ba9c7', resolution: 2
    }).setOrigin(0, 0.5).setDepth(22);

    this.add.image(GAME_WIDTH - 136, 20, 'as-purse').setDisplaySize(15, 15).setDepth(22);
    this.hudCorrupt = this.add.text(GAME_WIDTH - 124, 20, '0', {
      fontFamily: FONT, fontSize: '14px', color: '#ffd43b', fontStyle: 'bold', resolution: 2
    }).setOrigin(0, 0.5).setDepth(22);
    this.add.text(GAME_WIDTH - 124, 38, '黑金·赃款', {
      fontFamily: FONT, fontSize: '9px', color: '#b9a05a', resolution: 2
    }).setOrigin(0, 0.5).setDepth(22);

    this.hudIncome = this.add.text(16, 66, '', {
      fontFamily: FONT, fontSize: '12px', color: '#8ce99a', fontStyle: 'bold', resolution: 2
    }).setDepth(22);
    this.hudRisk = this.add.text(GAME_WIDTH - 16, 66, '', {
      fontFamily: FONT, fontSize: '12px', color: '#ff8787', fontStyle: 'bold', resolution: 2
    }).setOrigin(1, 0).setDepth(22);
    this.riskBar = this.add.graphics().setDepth(22);

    this.promptBg = this.add.graphics().setDepth(40);
    this.promptText = this.add.text(GAME_WIDTH / 2, PROMPT_Y, '', {
      fontFamily: FONT, fontSize: '12px', color: '#ffe066', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5).setDepth(41).setVisible(false);
  }

  private drawPromptBg(width: number) {
    this.promptBg.clear();
    const w = Math.max(220, width);
    this.promptBg.fillStyle(0x060d16, 0.9);
    this.promptBg.fillRoundedRect(GAME_WIDTH / 2 - w / 2, PROMPT_Y - 14, w, 28, 14);
    this.promptBg.lineStyle(1.4, 0xffd43b, 0.45);
    this.promptBg.strokeRoundedRect(GAME_WIDTH / 2 - w / 2, PROMPT_Y - 14, w, 28, 14);
  }

  // ============================================================
  // 家具(产业)与客人(人脉)
  // ============================================================

  private buildFurniture() {
    ASSETS.forEach((a, i) => {
      const x = FURNITURE_X[i];
      const level = this.holdings.assets[a.id] ?? 0;
      const g = this.add.graphics().setDepth(5);
      g.fillStyle(0x1a1208, 0.55);
      g.fillEllipse(x, FURNITURE_BASE + 2, 88, 14);
      if (level <= 0) {
        g.lineStyle(2, 0x7f93ab, 0.32);
        for (let d = 0; d < 4; d++) g.lineBetween(x - 26 + d * 15, FURNITURE_BASE + 8, x - 14 + d * 15, FURNITURE_BASE + 8);
      } else {
        g.fillStyle(0xffd43b, 0.1);
        g.fillEllipse(x, FURNITURE_BASE - 6, 82, 30);
      }
      const icon = this.add.image(x, FURNITURE_BASE, ASSET_ICONS[a.id] ?? 'coin')
        .setOrigin(0.5, 1)
        .setDisplaySize(level > 0 ? 54 : 30, level > 0 ? 54 : 30)
        .setDepth(6)
        .setAlpha(level > 0 ? 1 : 0.3);
      const name = this.add.text(x, FURNITURE_BASE + 6, '', {
        fontFamily: FONT, fontSize: '11px', color: level > 0 ? '#ffe066' : '#7f93ab', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5, 0).setDepth(7);
      const glow = this.add.image(x, FURNITURE_BASE - 24, 'spark')
        .setDepth(6).setTint(0xffd43b).setAlpha(level > 0 ? 0.16 : 0)
        .setDisplaySize(78 + level * 4, 60 + level * 3);
      const highlight = this.add.graphics().setDepth(8);
      this.interactables.push({
        kind: 'asset', id: a.id, x, y: FURNITURE_BASE,
        prompt: '', action: () => this.buyAsset(a.id), label: name, highlight, icon,
        glow, maxLevel: a.maxLevel
      });
    });
  }

  private buildNpcs() {
    NETWORK.forEach((n, i) => {
      const x = NPC_X[i];
      const level = this.holdings.network[n.id] ?? 0;
      this.add.graphics().setDepth(4).fillStyle(0x1a2233, 0.5).fillEllipse(x, NPC_BASE, 38, 9);
      // 客人用主角贴图染色,看上去是屋里站着的人,而不是一个图标
      ensureSkinTextures(this, this.npcSkin);
      const guestKey = playerFrameKey(this, this.npcSkin, 'idle');
      const icon = this.add.sprite(x, NPC_BASE, guestKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(28, level > 0 ? 48 : 42)
        .setDepth(4)
        .setTint(NETWORK_TINT[n.id] ?? 0xffffff)
        .setFlipX(i % 2 === 0)
        .setAlpha(level > 0 ? 1 : 0.3);
      this.tweens.add({
        targets: icon, y: NPC_BASE - 2, duration: 1200 + i * 180,
        yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });
      const name = this.add.text(x, NPC_BASE - 52, '', {
        fontFamily: FONT, fontSize: '10px', color: level > 0 ? '#b197fc' : '#66788f', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5, 1).setDepth(7);
      const glow = this.add.image(x, NPC_BASE - 16, 'spark')
        .setDepth(3).setTint(0xb197fc).setAlpha(level > 0 ? 0.14 : 0)
        .setDisplaySize(44 + level * 3, 40 + level * 2);
      const highlight = this.add.graphics().setDepth(8);
      this.interactables.push({
        kind: 'network', id: n.id, x, y: NPC_BASE,
        prompt: '', action: () => this.buyNetwork(n.id), label: name, highlight, icon,
        glow, maxLevel: n.maxLevel
      });
    });
  }

  private buildPlayer(p: Progress) {
    const keyFor = (frame: string): string => {
      if (p.skin === 'qitongwei') return 'player-qi';
      if (p.skin) ensureSkinTextures(this, p.skin);
      return playerFrameKey(this, p.skin ?? '', frame);
    };
    const idle = keyFor('idle');
    const run1 = keyFor('run-1');
    const run2 = keyFor('run-2');
    this.idleKey = idle;
    this.playerShadow = this.add.image(GAME_WIDTH / 2, PLAYER_BASE, 'shadow').setDepth(11).setScale(1.15, 0.55).setAlpha(0.5);
    this.player = this.add.sprite(GAME_WIDTH / 2, PLAYER_BASE, idle).setOrigin(0.5, 1).setDepth(12).setScale(0.95);
    if (this.anims.exists('home-run')) this.anims.remove('home-run');
    this.anims.create({
      key: 'home-run',
      frames: [{ key: idle }, { key: run1 }, { key: run2 }, { key: run1 }],
      frameRate: 9,
      repeat: -1
    });
  }

  private buildInput() {
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      kb.on('keydown-E', () => this.interact());
      kb.on('keydown-SPACE', () => this.interact());
      kb.on('keydown-ESC', () => this.scene.start('Title'));
    }

    const mkBtn = (x: number, y: number, r: number, label: string, onDown: () => void, onUp?: () => void) => {
      const g = this.add.graphics().setDepth(60);
      g.fillStyle(0x060d16, 0.55);
      g.fillCircle(x, y, r);
      g.lineStyle(2.2, 0xffd43b, 0.6);
      g.strokeCircle(x, y, r);
      this.add.text(x, y, label, {
        fontFamily: FONT, fontSize: r > 32 ? '18px' : '16px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5).setDepth(61);
      const hit = this.add.circle(x, y, r + 10, 0xffffff, 0.001).setDepth(62).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', onDown);
      if (onUp) { hit.on('pointerup', onUp); hit.on('pointerout', onUp); }
    };
    const y = GAME_HEIGHT - 26;
    mkBtn(52, y, 26, '◀', () => { this.moveLeft = true; this.moveRight = false; }, () => { this.moveLeft = false; });
    mkBtn(118, y, 26, '▶', () => { this.moveRight = true; this.moveLeft = false; }, () => { this.moveRight = false; });
    mkBtn(GAME_WIDTH - 46, y, 30, 'E', () => this.interact());
  }

  private washLabel!: Phaser.GameObjects.Text;
  private dailyText!: Phaser.GameObjects.Text;
  private dailyPanelTop = 190;
  private dailyBar!: Phaser.GameObjects.Graphics;

  private drawRoomButtons() {
    // 墙面左侧竖排三个功能入口
    const items: [string, number, () => void][] = [
      ['洗白账目', 0x4a2b12, () => this.doLaunder()],
      ['名人堂', 0x2d2350, () => this.showHall()],
      ['晒家产', 0x1d3350, () => this.shareAssets()]
    ];
    if (canPrestige(this.holdings)) {
      items.push(['跑路上岸', 0x5a1b1b, () => this.showPrestige()]);
    }
    items.forEach(([label, color, fn], i) => {
      const x = 80;
      const y = 96 + i * 40;
      const g = this.add.graphics().setDepth(24);
      g.fillStyle(0x060d16, 0.72);
      g.fillRoundedRect(x - 58, y - 14, 116, 28, 14);
      g.fillStyle(color, 0.95);
      g.fillRoundedRect(x - 56, y - 12, 112, 24, 12);
      g.lineStyle(1.2, 0xffffff, 0.2);
      g.strokeRoundedRect(x - 58, y - 14, 116, 28, 14);
      const txt = this.add.text(x, y, label, {
        fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5).setDepth(25);
      if (i === 0) this.washLabel = txt;
      const hit = this.add.rectangle(x, y, 116, 28, 0xffffff, 0.001).setDepth(26).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => { playSfx(this, 'click', 0.3); fn(); });
    });
  }

  /** 房间里的小目标面板:今天该干什么,一眼看见 */
  private buildDailyPanel(offset = 0) {
    const cx = 80;
    const top = 190 + offset;
    this.dailyPanelTop = top;
    const g = this.add.graphics().setDepth(24);
    g.fillStyle(0x060d16, 0.72);
    g.fillRoundedRect(cx - 58, top, 116, 94, 12);
    g.lineStyle(1.2, 0xffffff, 0.14);
    g.strokeRoundedRect(cx - 58, top, 116, 94, 12);
    this.add.text(cx, top + 13, '今日任务', {
      fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5).setDepth(25);
    this.dailyBar = this.add.graphics().setDepth(25);
    this.dailyText = this.add.text(cx, top + 30, '', {
      fontFamily: FONT, fontSize: '11px', color: '#ffe066', fontStyle: 'bold', resolution: 2,
      align: 'center', lineSpacing: 5
    }).setOrigin(0.5, 0).setDepth(25);
    const hit = this.add.rectangle(cx, top + 47, 116, 94, 0xffffff, 0.001).setDepth(26)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => { playSfx(this, 'click', 0.3); this.scene.start('Quest'); });
    this.refreshDailyPanel();
  }

  private refreshDailyPanel() {
    if (!this.dailyText) return;
    const p = loadProgress();
    const d = getDaily(p);
    const build = DAILY_TASKS.find(t => t.id === 'build')!;
    const audit = DAILY_TASKS.find(t => t.id === 'audit')!;
    const bHave = Math.min(build.get(d), build.target);
    const aHave = Math.min(audit.get(d), audit.target);
    const done = dailyCompletedCount(d);
    this.dailyText.setText(`添置 ${bHave}/${build.target}\n摆平 ${aHave}/${audit.target}\n完成 ${done}/${DAILY_TASKS.length}`);
    this.dailyBar.clear();
    this.dailyBar.fillStyle(0x1b2b3d, 0.95);
    const barY = this.dailyPanelTop + 84;
    this.dailyBar.fillRoundedRect(32, barY, 96, 4, 2);
    this.dailyBar.fillStyle(done >= DAILY_TASKS.length ? 0x69db7c : 0xffd43b, 0.95);
    this.dailyBar.fillRoundedRect(32, barY, Math.max(3, 96 * (done / DAILY_TASKS.length)), 4, 2);
  }

  // ============================================================
  // 交互
  // ============================================================

  /** 当前打开的弹窗数量(用 setData('ov') 标记) */
  private overlayOpenCount(): number {
    return this.children.list.filter(o => o.type === 'Container' && !!o.getData && o.getData('ov')).length;
  }

  private markOverlay(c: Phaser.GameObjects.Container) {
    c.setData('ov', true);
    return c;
  }

  private interact() {
    if (this.activeIdx < 0) return;
    playSfx(this, 'click', 0.3);
    this.interactables[this.activeIdx].action();
  }

  private updateNearest() {
    let best = -1;
    let bestDist = 999;
    this.interactables.forEach((it, i) => {
      // 人脉站在靠里一排,给一点距离惩罚,优先选中面前的家具
      const d = Math.abs(it.x - this.player.x) + (it.kind === 'network' ? 30 : 0);
      if (d < bestDist && d <= 110) { bestDist = d; best = i; }
    });
    if (best !== this.activeIdx) {
      this.interactables.forEach(it => it.highlight.clear());
      this.activeIdx = best;
      if (best >= 0) {
        const t = this.interactables[best];
        t.highlight.lineStyle(2.4, 0xffd43b, 0.85);
        t.highlight.strokeEllipse(t.x, t.y + 2, t.kind === 'asset' ? 84 : 44, t.kind === 'asset' ? 18 : 12);
      }
    }
    const t = this.interactables[this.activeIdx];
    if (t) {
      this.promptText.setText(t.prompt).setVisible(true);
      this.drawPromptBg(this.promptText.width + 48);
    } else {
      this.promptText.setVisible(false);
      this.promptBg.clear();
    }
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    const left = this.moveLeft || !!this.keyA?.isDown || !!this.cursors?.left.isDown;
    const right = this.moveRight || !!this.keyD?.isDown || !!this.cursors?.right.isDown;
    let moving = false;
    if (left && !right) {
      this.player.x = Math.max(48, this.player.x - (250 * dt) / 1000);
      this.player.setFlipX(true);
      moving = true;
    } else if (right && !left) {
      this.player.x = Math.min(GAME_WIDTH - 48, this.player.x + (250 * dt) / 1000);
      this.player.setFlipX(false);
      moving = true;
    }
    this.playerShadow.x = this.player.x;
    this.collectDrops();
    this.updateDanger();
    if (moving && !this.runAnim) {
      this.runAnim = true;
      if (this.anims.exists('home-run')) this.player.play('home-run');
    } else if (!moving && this.runAnim) {
      this.runAnim = false;
      this.player.anims.stop();
      this.player.setTexture(this.idleKey);
    }
    this.updateNearest();
    if (this.pendingAuditShow && this.overlayOpenCount() === 0) {
      const fn = this.pendingAuditShow;
      this.pendingAuditShow = null;
      fn();
    }
  }

  // ============================================================
  // 买卖
  // ============================================================

  private toast(msg: string, color = '#ffe066', icon?: string) {
    showToast(this, GAME_WIDTH / 2, 300, msg, color, icon);
  }

  /** 在某个交互物头上冒一句话 */
  private sayAbove(it: Interactable, line: string) {
    const bubble = this.add.text(it.x, it.y - (it.kind === 'asset' ? 76 : 66), line, {
      fontFamily: FONT, fontSize: '11px', color: '#0b1220', fontStyle: 'bold', resolution: 2,
      backgroundColor: '#ffe8a3', padding: { x: 7, y: 4 }
    }).setOrigin(0.5, 1).setDepth(50).setAlpha(0);
    this.tweens.add({ targets: bubble, alpha: 1, y: bubble.y - 6, duration: 200 });
    this.time.delayedCall(1800, () => {
      this.tweens.add({ targets: bubble, alpha: 0, duration: 260, onComplete: () => bubble.destroy() });
    });
  }

  private itemAt(kind: Interactable['kind'], id: string): Interactable | undefined {
    return this.interactables.find(it => it.kind === kind && it.id === id);
  }

  private buyAsset(id: string) {
    const a = ASSETS.find(x => x.id === id);
    if (!a) return;
    const cur = this.holdings.assets[id] ?? 0;
    const q = quoteCost(a, cur);
    if (!q) { this.toast(`「${a.name}」到顶了 · ${ASSET_PERK_SHORT[a.id] ?? ''}`, '#8ce99a', 'ui-check'); return; }
    if (!canAfford({ coins: this.coins, corrupt: this.corrupt }, q)) {
      this.toast(
        q.currency === 'coin'
          ? `银币不够(${q.amount})· 回主界面跑两圈挣`
          : `黑金不够(${formatValue(q.amount)})· 等产业再攒攒`,
        '#ff8787', 'coin'
      );
      return;
    }
    if (q.currency === 'coin') this.coins -= q.amount;
    else this.corrupt -= q.amount;
    this.holdings.assets[id] = cur + 1;
    this.pendingBuilds += 1;
    playSfx(this, cur === 0 ? 'unlock' : 'coin', 0.45, cur === 0 ? 1 : 1.12);
    const idx = ASSETS.indexOf(a);
    const it = this.itemAt('asset', id);
    if (cur === 0) {
      confettiBurst(this, FURNITURE_X[idx], FURNITURE_BASE, 16);
      this.toast(`置办了「${a.name}」· 开始产黑金`, '#ffe066', 'ui-shop');
      if (it) {
        // 家具从天上落地
        const targetY = it.icon.y;
        it.icon.setY(targetY - 60).setAlpha(1);
        this.tweens.add({ targets: it.icon, y: targetY, duration: 420, ease: 'Bounce.out' });
        this.sayAbove(it, a.desc);
      }
    } else {
      confettiBurst(this, FURNITURE_X[idx], FURNITURE_BASE, 8);
      this.toast(`「${a.name}」升到 Lv.${cur + 1} · 产出更高`, '#ffe066', ASSET_ICONS[id]);
      if (it) {
        this.tweens.add({ targets: it.icon, scale: it.icon.scale * 1.18, duration: 110, yoyo: true, ease: 'Quad.out' });
        this.sayAbove(it, ASSET_PERK_SHORT[id] ? `干得更大了 · ${ASSET_PERK_SHORT[id]}` : a.desc);
      }
    }
    this.persist();
  }

  private buyNetwork(id: string) {
    const n = NETWORK.find(x => x.id === id);
    if (!n) return;
    const cur = this.holdings.network[id] ?? 0;
    const q = quoteCost(n, cur);
    if (!q) { this.toast(`「${n.name}」关系已经很铁了`, '#8ce99a', 'ui-check'); return; }
    if (!canAfford({ coins: this.coins, corrupt: this.corrupt }, q)) {
      this.toast(
        q.currency === 'coin' ? `银币不够(${q.amount})` : `黑金不够(${formatValue(q.amount)})`,
        '#ff8787', 'coin'
      );
      return;
    }
    if (q.currency === 'coin') this.coins -= q.amount;
    else this.corrupt -= q.amount;
    this.holdings.network[id] = cur + 1;
    this.pendingBuilds += 1;
    playSfx(this, 'unlock', 0.4);
    this.toast(`和「${n.name}」吃上了饭 · Lv.${cur + 1}`, '#b197fc', 'ui-person');
    const it = this.itemAt('network', id);
    if (it) {
      const lines = ['有事您说话', '这不算什么,应该的', '我记着您的好', '下回还得请您喝酒', '放心,我嘴严'];
      this.sayAbove(it, lines[Math.min(lines.length - 1, cur)]);
      this.tweens.add({ targets: it.icon, y: it.icon.y - 6, duration: 160, yoyo: true, ease: 'Quad.out' });
    }
    this.persist();
  }

  private doLaunder() {
    const risk = netRisk(this.holdings);
    const cost = launderCost(this.holdings);
    if (risk <= 0) { this.toast('账很干净,不用洗', '#8ce99a', 'ui-check'); return; }
    if (this.corrupt < cost) {
      this.toast(`洗白要 ${formatValue(cost)} 黑金,还差一些`, '#ff8787', 'coin');
      return;
    }
    const eff = launderEffect(this.holdings);
    const clean = launderYield(this.holdings);
    this.corrupt -= cost;
    this.coins += clean;
    this.holdings.laundered = (this.holdings.laundered ?? 0) + eff;
    playSfx(this, 'shield', 0.45);
    playSfx(this, 'coin', 0.35, 1.2);
    this.toast(`账做平了 · 风险 -${eff} · 洗出 ${clean} 银币`, '#8ce99a', 'ui-check');
    this.persist();
  }

  // ============================================================
  // 刷新与存档
  // ============================================================

  private persist() {
    const p = loadProgress();
    p.coins = this.coins;
    p.corrupt = this.corrupt;
    p.assets = this.holdings.assets;
    p.network = this.holdings.network;
    p.laundered = this.holdings.laundered ?? 0;
    p.prestige = this.holdings.prestige ?? 0;
    p.lastAccrualAt = Date.now();
    if (this.pendingBuilds > 0) { noteAssetBuild(p, this.pendingBuilds); this.pendingBuilds = 0; }
    if (this.pendingAudits > 0) { noteAuditHandled(p, this.pendingAudits); this.pendingAudits = 0; }
    saveProgress(p);
    this.refreshAll();
    this.refreshDailyPanel();
  }

  private refreshAll() {
    const value = totalAssetValue(this.holdings);
    const title = assetTitle(value);
    this.hudCoins.setText(String(Math.round(this.coins)));
    this.hudCorrupt.setText(formatValue(this.corrupt));
    this.hudIncome.setText(`${this.wind.name} · 黑金 +${incomePerMinWithWind(this.holdings, this.wind)}/分`);
    const pv = this.holdings.prestige ?? 0;
    this.hudTitle.setText(`${title.name} · 家产 ${formatValue(value)}${pv > 0 ? ` · 海外身份 Lv.${pv}` : ''}`);
    if (this.washLabel) {
      const risk0 = netRisk(this.holdings);
      this.washLabel.setText(risk0 > 0 ? `洗白 -${formatValue(launderCost(this.holdings))} 黑金` : '洗白账目');
    }

    const risk = netRiskWithWind(this.holdings, this.wind);
    this.hudRisk.setText(`被查风险 ${risk}/100`);
    this.hudRisk.setColor(risk >= 60 ? '#ff6b6b' : risk >= 30 ? '#ffa94d' : '#8ce99a');
    this.riskBar.clear();
    this.riskBar.fillStyle(0x3a1a20, 0.9);
    this.riskBar.fillRoundedRect(GAME_WIDTH - 216, 82, 200, 5, 2.5);
    this.riskBar.fillStyle(risk >= 60 ? 0xff3b3b : risk >= 30 ? 0xff922b : 0x69db7c, 0.95);
    this.riskBar.fillRoundedRect(GAME_WIDTH - 216, 82, Math.max(3, 200 * (risk / 100)), 5, 2.5);

    this.interactables.forEach(it => {
      if (it.kind === 'visitor') return;
      const isAsset = it.kind === 'asset';
      const def = isAsset ? ASSETS.find(x => x.id === it.id)! : NETWORK.find(x => x.id === it.id)!;
      const lv = isAsset ? (this.holdings.assets[it.id] ?? 0) : (this.holdings.network[it.id] ?? 0);
      const q = quoteCost(def, lv);
      const money = q ? (q.currency === 'coin' ? `${q.amount} 银币` : `${formatValue(q.amount)} 黑金`) : '';
      if (isAsset) {
        const a = def as typeof ASSETS[number];
        const per = Math.round(a.incomePerMin * lv * (1 + NETWORK.reduce((sum, n) => sum + n.incomeBonus * (this.holdings.network[n.id] ?? 0), 0) / 100));
        it.label.setText(lv > 0 ? `${def.name} Lv.${lv} · ${per}/分` : def.name);
      } else {
        const n = def as typeof NETWORK[number];
        it.label.setText(lv > 0 ? `${def.name} Lv.${lv} · 护${n.protection * lv}` : def.name);
      }
      it.label.setColor(lv > 0 ? (isAsset ? '#ffe066' : '#b197fc') : '#66788f');
      it.icon.setAlpha(lv > 0 ? 1 : 0.3);
      if (isAsset) {
        const size = lv > 0 ? 54 : 30;
        it.icon.setDisplaySize(size, size);
      } else {
        const hPx = lv > 0 ? 48 : 42;
        it.icon.setDisplaySize(hPx * 0.58, hPx);
      }
      it.glow.setAlpha(lv > 0 ? Math.min(0.34, 0.1 + lv * 0.03) : 0);
      it.glow.setVisible(lv > 0);
      if (lv >= it.maxLevel) it.glow.setTint(0xff8787);
      else it.glow.setTint(isAsset ? 0xffd43b : 0xb197fc);
      if (isAsset) {
        it.prompt = q
          ? `${lv > 0 ? '升级' : '置办'}「${def.name}」· ${money} · E`
          : `「${def.name}」已满级 · ${ASSET_PERK_SHORT[it.id] ?? ''}`;
      } else {
        it.prompt = q ? `结交「${def.name}」· ${money} · E` : `「${def.name}」关系已固`;
      }
    });
    this.updateNearest();
  }

  // ============================================================
  // 离线 / 审查 / 引导 / 名人堂 / 分享
  // ============================================================

  private rotateNews() {
    if (!this.tvText) return;
    const risk = netRiskWithWind(this.holdings, this.wind);
    if (risk >= 70) {
      const hot = [
        '突发\n某干部被带走',
        '突发\n巡视组连夜进驻',
        '突发\n项目账目被调走',
        '突发\n实名举报已受理'
      ];
      this.tvText.setColor('#ff8787');
      this.tvText.setText(hot[this.newsIndex % hot.length]);
      this.newsIndex += 1;
      return;
    }
    const lines = [
      '新闻\n经济持续向好',
      '新闻\n又有人主动投案',
      '新闻\n巡视组明日进驻',
      '新闻\n重点项目开工'
    ];
    this.tvText.setColor('#e2e8f0');
    this.tvText.setText(lines[this.newsIndex % lines.length]);
    this.newsIndex += 1;
  }

  /** 客人偶尔自己嘀咕一句,让屋子有点人味 */
  private guestChatter() {
    if (this.overlayOpenCount() > 0) return;
    const guests = this.interactables.filter(it => it.kind === 'network' && (this.holdings.network[it.id] ?? 0) > 0);
    if (guests.length === 0) return;
    const it = guests[Phaser.Math.Between(0, guests.length - 1)];
    const lines = ['这事儿我给您办了', '最近风声紧,少见面', '材料我都备齐了', '上面有人问了句', '钱的事别提,走账就行'];
    this.sayAbove(it, lines[Phaser.Math.Between(0, lines.length - 1)]);
  }

  /** 风险爆表时画面边缘泛红,提醒该洗白了 */
  private updateDanger() {
    const risk = netRiskWithWind(this.holdings, this.wind);
    if (!this.dangerVignette) {
      const g = this.add.graphics().setDepth(90);
      g.fillStyle(0xff2b2b, 0.5);
      g.fillRect(0, 0, GAME_WIDTH, 8);
      g.fillRect(0, GAME_HEIGHT - 8, GAME_WIDTH, 8);
      g.fillRect(0, 0, 8, GAME_HEIGHT);
      g.fillRect(GAME_WIDTH - 8, 0, 8, GAME_HEIGHT);
      g.setAlpha(0);
      this.dangerVignette = g;
    }
    const target = risk >= 80 ? 0.16 + Math.sin(this.time.now / 420) * 0.07 : 0;
    this.dangerVignette.setAlpha(target);
  }

  // ---- 地上的钱:走动就能捡,主动玩比干等着赚得快 ----
  private moneyPerDrop(): number {
    return Math.max(25, Math.round(incomePerMinWithWind(this.holdings, this.wind) * 0.08));
  }

  private spawnDrop() {
    if (this.overlayOpenCount() > 0) return;
    if (this.drops.length >= 5) return;
    if (incomePerMinWithWind(this.holdings, this.wind) <= 0) return;
    const x = Phaser.Math.Between(70, GAME_WIDTH - 70);
    const y = 508;
    const glow = this.add.image(x, y, 'spark').setDepth(10).setTint(0xffd43b)
      .setDisplaySize(34, 22).setAlpha(0.32);
    const img = this.add.image(x, y, 'coin').setDisplaySize(18, 18).setDepth(11);
    this.tweens.add({ targets: [img, glow], y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.drops.push({ img, glow, amount: this.moneyPerDrop() });
  }

  private collectDrops() {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.abs(d.img.x - this.player.x) > 24) continue;
      this.corrupt += d.amount;
      this.drops.splice(i, 1);
      this.tweens.killTweensOf([d.img, d.glow]);
      this.tweens.add({
        targets: [d.img, d.glow], y: d.img.y - 26, alpha: 0, duration: 320,
        onComplete: () => { d.img.destroy(); d.glow.destroy(); }
      });
      const pop = this.add.text(d.img.x, d.img.y - 18, `+${formatValue(d.amount)}`, {
        fontFamily: FONT, fontSize: '13px', color: '#ffe066', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: pop, y: pop.y - 26, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
      playSfx(this, 'coin', 0.3, 1.25);
      this.persistLight();
    }
  }

  /** 轻量存档:只写黑金,不整页刷新(捡钱太频繁) */
  private persistLight() {
    const p = loadProgress();
    p.coins = this.coins;
    p.corrupt = this.corrupt;
    p.assets = this.holdings.assets;
    p.network = this.holdings.network;
    p.laundered = this.holdings.laundered ?? 0;
    p.lastAccrualAt = Date.now();
    saveProgress(p);
    this.hudCoins.setText(String(Math.round(this.coins)));
    this.hudCorrupt.setText(formatValue(this.corrupt));
  }

  // ---- 随机事件:上门送礼的老板(赌一把) ----
  private maybeVisitor() {
    if (this.visitorUsed) return;
    if (totalAssetValue(this.holdings) < 300) return;
    if (Math.random() > 0.6) return;
    this.visitorUsed = true;
    const names: [string, string][] = [
      ['开发区的赵总', '提着两箱茅台,说箱子底下压着一张卡'],
      ['给煤矿送过礼的刘老板', '开口就是「一点土特产,不值钱」'],
      ['城投的钱经理', '说是来汇报工作,手里却提着旅行箱'],
      ['隔壁市的王总', '带着一幅画,说是「朋友画的」']
    ];
    const [who, line] = names[Phaser.Math.Between(0, names.length - 1)];
    // 站在两件家具之间的空档里,别把家具挡住
    const slots = [177, 315, 453, 591, 729];
    const x = slots[Phaser.Math.Between(0, slots.length - 1)];
    const base = 452;
    this.add.graphics().setDepth(9).fillStyle(0x1a2233, 0.5).fillEllipse(x, base, 42, 10);
    const glow = this.add.image(x, base - 20, 'spark')
      .setDepth(9).setTint(0xffd43b).setAlpha(0.32).setDisplaySize(64, 56);
    this.tweens.add({ targets: glow, alpha: 0.14, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const icon = this.add.image(x, base, 'ui-gift').setOrigin(0.5, 1).setDepth(10).setDisplaySize(36, 36);
    this.tweens.add({ targets: icon, y: base - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const label = this.add.text(x, base - 44, `${who} · 送礼`, {
      fontFamily: FONT, fontSize: '11px', color: '#ffd43b', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5, 1).setDepth(10);
    const bang = this.add.text(x + 22, base - 54, '!', {
      fontFamily: FONT, fontSize: '18px', color: '#ff8787', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: bang, scale: 1.3, duration: 520, yoyo: true, repeat: -1 });
    const highlight = this.add.graphics().setDepth(11);
    const it: Interactable = {
      kind: 'visitor', id: 'visitor', x, y: base,
      prompt: `${who} 在门口等你 · E`,
      action: () => this.showVisitorOffer(who, line, x, base),
      label, highlight, glow, icon, maxLevel: 1
    };
    this.interactables.push(it);
    this.time.delayedCall(260, () => this.toast(`「${who}」上门了 · 走过去按 E`, '#ffd43b', 'ui-gift'));
    playSfx(this, 'pickup', 0.4);
  }

  private showVisitorOffer(who: string, line: string, x: number, base: number) {
    const amt = Math.max(600, Math.round(incomePerMinWithWind(this.holdings, this.wind) * 30));
    const risk = netRisk(this.holdings);
    const shieldNow = auditShield(this.holdings);
    const caught = Math.min(85, Math.round(risk + 8));
    const layer = this.markOverlay(this.add.container(0, 0).setDepth(this.overlayDepth + 20));
    layer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x03070d, 0.82).setInteractive());
    const panel = this.add.graphics();
    panel.fillStyle(0x16210f, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 250, 120, 500, 286, 22);
    panel.lineStyle(2, 0xffd43b, 0.55);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 250, 120, 500, 286, 22);
    layer.add(panel);
    layer.add(this.add.text(GAME_WIDTH / 2, 154, `${who} 上门了`, {
      fontFamily: FONT, fontSize: '24px', color: '#ffe066', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 192, line, {
      fontFamily: FONT, fontSize: '13px', color: '#dce8f5', resolution: 2, align: 'center', wordWrap: { width: 440 }
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 236, `收下 → 黑金 +${formatValue(amt)}`, {
      fontFamily: FONT, fontSize: '15px', color: '#8ce99a', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 264,
      `有人可能写举报信 · 被查概率约 ${caught}%`
      + (shieldNow > 0 ? ` · 人脉豁免还有 ${shieldNow} 次` : ''), {
      fontFamily: FONT, fontSize: '12px', color: '#ff8787', resolution: 2
    }).setOrigin(0.5));

    const mk = (bx: number, label: string, primary: boolean, fn: () => void) => {
      const w = 200; const h = 46; const by = 322;
      const g = this.add.graphics();
      g.fillStyle(primary ? 0xffb703 : 0x16324f, 0.95);
      g.fillRoundedRect(bx - w / 2, by - h / 2, w, h, h / 2);
      g.lineStyle(2, primary ? 0xffecb3 : 0xffffff, primary ? 0.9 : 0.2);
      g.strokeRoundedRect(bx - w / 2, by - h / 2, w, h, h / 2);
      layer.add(g);
      layer.add(this.add.text(bx, by, label, {
        fontFamily: FONT, fontSize: '15px', color: primary ? '#3a2400' : '#cfe3ff', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5));
      const hit = this.add.rectangle(bx, by, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      layer.add(hit);
      hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); layer.destroy(true); fn(); });
    };
    mk(GAME_WIDTH / 2 - 112, '收下', true, () => this.takeGift(amt, x, base));
    mk(GAME_WIDTH / 2 + 112, '推回去', false, () => {
      this.removeVisitor(x);
      this.toast('他把箱子提走了,楼道里骂了一句', '#8ce99a', 'ui-check');
      playSfx(this, 'click', 0.4);
    });
    layer.add(this.add.text(GAME_WIDTH / 2, 380, '收下是白得的钱,也是别人手里的把柄', {
      fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', resolution: 2
    }).setOrigin(0.5));
  }

  private takeGift(amt: number, x: number, base: number) {
    this.removeVisitor(x);
    if (base > 0) confettiBurst(this, x, base - 20, 14);
    this.corrupt += amt;
    this.persist();
    playSfx(this, 'coin', 0.5);
    this.toast(`收下了 ${formatValue(amt)} 黑金 · 箱子太沉了`, '#ffd43b', 'as-purse');
    this.time.delayedCall(1200, () => {
      const shield = auditShield(this.holdings);
      const roll = Math.random();
      const risk = netRiskWithWind(this.holdings, this.wind);
      const r = resolveAudit(this.holdings, this.corrupt, roll, shield);
      if (r.triggered) {
        this.toast('有人把今晚的事写出去了…', '#ff8787', 'ui-siren');
        this.time.delayedCall(900, () => this.showAuditOverlay(Math.min(100, risk + 18), roll, shield));
      } else {
        this.toast('钱揣兜里了 · 今晚没人看见', '#8ce99a', 'ui-check');
      }
    });
  }

  private removeVisitor(x: number) {
    const idx = this.interactables.findIndex(it => it.kind === 'visitor');
    if (idx < 0) return;
    const it = this.interactables[idx];
    [it.label, it.highlight, it.glow, it.icon].forEach(o => o.destroy());
    this.interactables.splice(idx, 1);
    if (this.activeIdx === idx) this.activeIdx = -1;
    else if (this.activeIdx > idx) this.activeIdx -= 1;
    void x;
  }

  private collectOffline() {
    const r = collectOfflineIncome();
    const fresh = loadProgress();
    this.coins = fresh.coins;
    this.corrupt = fresh.corrupt ?? 0;
    if (r.corrupt <= 0) return;
    playSfx(this, 'coin', 0.4);
    this.time.delayedCall(400, () => {
      this.toast(`离线进账 +${formatValue(r.corrupt)} 黑金${r.capped ? '(按 12 小时封顶)' : ''}`, '#ffd43b', 'as-purse');
    });
  }

  private maybeAudit(p: Progress) {
    const now = Date.now();
    const last = p.lastAuditAt || 0;
    if (last > 0 && now - last < 120000) return;
    p.lastAuditAt = now;
    const risk = netRiskWithWind(this.holdings, this.wind);
    if (risk <= 0) { saveProgress(p); return; }
    const roll = Math.random();
    const shieldLeft = auditShield(this.holdings);
    const r = resolveAudit(this.holdings, this.corrupt, roll, shieldLeft);
    if (!r.triggered) { saveProgress(p); return; }
    saveProgress(p);
    this.time.delayedCall(700, () => {
      if (this.overlayOpenCount() > 0) {
        // 玩家正在看名人堂/引导,等关掉再弹,免得被盖住
        this.pendingAuditShow = () => this.showAuditOverlay(risk, roll, shieldLeft);
      } else {
        this.showAuditOverlay(risk, roll, shieldLeft);
      }
    });
  }

  private showAuditOverlay(risk: number, roll: number, shieldLeft: number) {
    const bribe = bribeCost(risk);
    const layer = this.markOverlay(this.add.container(0, 0).setDepth(this.overlayDepth + 30));
    layer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.84).setInteractive());
    const panel = this.add.graphics();
    panel.fillStyle(0x1a0b12, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 260, 108, 520, 306, 22);
    panel.lineStyle(2, 0xff5c5c, 0.6);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 260, 108, 520, 306, 22);
    layer.add(panel);
    layer.add(this.add.text(GAME_WIDTH / 2, 146, '纪检委来了', {
      fontFamily: FONT, fontSize: '34px', color: '#ff8787', fontStyle: 'bold',
      resolution: 2, stroke: '#08131f', strokeThickness: 6
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 184, '有人把你的名字写进了举报信', {
      fontFamily: FONT, fontSize: '13px', color: '#e2b6b6', resolution: 2
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 214, `被查风险 ${risk}/100`
      + (shieldLeft > 0 ? ` · 人脉豁免 ×${shieldLeft}` : ''), {
      fontFamily: FONT, fontSize: '12px', color: '#ffe066', resolution: 2
    }).setOrigin(0.5));

    const btns = [
      {
        label: `打点 -${formatValue(bribe)} 黑金`, primary: false, x: GAME_WIDTH / 2 - 132, fn: () => {
          layer.destroy(true);
          if (this.corrupt >= bribe) {
            this.corrupt -= bribe;
            this.savedSurvived += 1;
            this.pendingAudits += 1;
            playSfx(this, 'coin', 0.45);
            this.toast(`打点出去了 ${formatValue(bribe)} 黑金 · 这次没人再提`, '#8ce99a', 'ui-check');
            this.persist();
          } else {
            this.toast('黑金不够打点,只能硬扛', '#ff8787', 'coin');
            this.applyPenalty(roll, shieldLeft);
          }
        }
      },
      {
        label: '硬扛着', primary: true, x: GAME_WIDTH / 2 + 132, fn: () => {
          layer.destroy(true);
          this.applyPenalty(roll, shieldLeft);
        }
      }
    ];
    btns.forEach(b => {
      const w = 232; const h = 48; const y = 338;
      const g = this.add.graphics();
      g.fillStyle(b.primary ? 0xffb703 : 0x16324f, 0.95);
      g.fillRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
      g.lineStyle(2, b.primary ? 0xffecb3 : 0xffffff, b.primary ? 0.9 : 0.2);
      g.strokeRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
      layer.add(g);
      layer.add(this.add.text(b.x, y, b.label, {
        fontFamily: FONT, fontSize: '15px', color: b.primary ? '#3a2400' : '#cfe3ff',
        fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5));
      const hit = this.add.rectangle(b.x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      layer.add(hit);
      hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); b.fn(); });
    });
    layer.add(this.add.text(GAME_WIDTH / 2, 382, '打点必胜但花黑金 · 硬扛省钱,赌你运气', {
      fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', resolution: 2
    }).setOrigin(0.5));
    playSfx(this, 'warn', 0.5);
    shake(this, 0.008, 240);
  }

  private applyPenalty(roll: number, shieldLeft: number) {
    const r = resolveAudit(this.holdings, this.corrupt, roll, shieldLeft);
    if (r.shielded || r.passed) {
      this.savedSurvived += 1;
      this.pendingAudits += 1;
      this.toast(
        r.shielded ? `巡视组的熟人咳嗽了一声 · ${r.message}` : `查了一圈 · ${r.message}`,
        '#8ce99a', 'ui-siren'
      );
      playSfx(this, r.shielded ? 'shield' : 'record', 0.5);
    } else {
      if (r.seizedAssetId) {
        const cur = this.holdings.assets[r.seizedAssetId] ?? 0;
        this.holdings.assets[r.seizedAssetId] = Math.max(0, cur - 1);
        this.savedSeized += 1;
      }
      this.corrupt = Math.max(0, this.corrupt - r.fine);
      redFlash(this);
      shake(this, 0.014, 300);
      playSfx(this, 'gameover', 0.5);
      this.toast(`被查了 · ${r.message}${r.fine > 0 ? ` · 罚款 ${formatValue(r.fine)} 黑金` : ''}`, '#ff8787', 'ui-siren');
      this.showNewsTicker(newsFor(true, Math.random()));
    }
    this.persist();
  }

  private showNewsTicker(text: string) {
    const y = 100;
    const g = this.add.graphics().setDepth(110);
    g.fillStyle(0x2a0f14, 0.96);
    g.fillRoundedRect(24, y, GAME_WIDTH - 48, 26, 8);
    g.lineStyle(1.2, 0xff5c5c, 0.5);
    g.strokeRoundedRect(24, y, GAME_WIDTH - 48, 26, 8);
    const tag = this.add.text(38, y + 13, '本市新闻', {
      fontFamily: FONT, fontSize: '11px', color: '#ff8787', fontStyle: 'bold', resolution: 2
    }).setOrigin(0, 0.5).setDepth(111);
    const line = this.add.text(110, y + 13, text, {
      fontFamily: FONT, fontSize: '12px', color: '#e2e8f0', resolution: 2
    }).setOrigin(0, 0.5).setDepth(111);
    [g, tag, line].forEach(o => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 220 }); });
    this.time.delayedCall(2800, () => {
      [g, tag, line].forEach(o => this.tweens.add({ targets: o, alpha: 0, duration: 320, onComplete: () => o.destroy() }));
    });
  }

  /** 每天第一次进屋:门口的快递箱里有点东西 */
  private homeGift() {
    const p = loadProgress();
    const now = Date.now();
    const last = p.lastHomeGiftAt || 0;
    if (last > 0 && now - last < 20 * 3600 * 1000) return;
    p.lastHomeGiftAt = now;
    const gift = Math.max(200, Math.round(incomePerMinWithWind(this.holdings, this.wind) * 12));
    p.corrupt = (p.corrupt ?? 0) + gift;
    saveProgress(p);
    this.coins = p.coins;
    this.corrupt = p.corrupt;
    this.time.delayedCall(900, () => {
      this.toast(`门口快递箱:今天的「土特产」 +${formatValue(gift)} 黑金`, '#ffd43b', 'ui-gift');
      playSfx(this, 'coin', 0.45, 1.1);
      confettiBurst(this, GAME_WIDTH / 2, FLOOR_TOP - 10, 12);
    });
  }

  private maybeShowIntro(p: Progress) {
    if (p.assetsIntroDone) return;
    p.assetsIntroDone = true;
    saveProgress(p);
    const layer = this.markOverlay(this.add.container(0, 0).setDepth(this.overlayDepth + 10));
    layer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.86).setInteractive());
    const panel = this.add.graphics();
    panel.fillStyle(0x0a1930, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 300, 92, 600, 356, 22);
    panel.lineStyle(2, 0xffd43b, 0.45);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 300, 92, 600, 356, 22);
    layer.add(panel);
    layer.add(this.add.text(GAME_WIDTH / 2, 132, '这就是你的家', {
      fontFamily: FONT, fontSize: '26px', color: '#ffe066', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    const steps: [string, string][] = [
      ['① 走动、捡钱、谈事', 'A/D 走动,地上的黑金走过去自动捡;靠近家具或客人按 E 交互'],
      ['② 两套钱', '银币(跑酷挣)置办新产业/结交人脉;黑金(产业产出)升级产业'],
      ['③ 别被查', '风险高了就洗白:花黑金降风险,还能洗出一笔明面银币']
    ];
    steps.forEach(([title, body], i) => {
      const y = 182 + i * 72;
      layer.add(this.add.text(GAME_WIDTH / 2 - 268, y, title, {
        fontFamily: FONT, fontSize: '16px', color: '#8ce99a', fontStyle: 'bold', resolution: 2
      }));
      layer.add(this.add.text(GAME_WIDTH / 2 - 268, y + 24, body, {
        fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2, wordWrap: { width: 536 }
      }));
    });
    const g = this.add.graphics();
    g.fillStyle(0xffb703, 0.95);
    g.fillRoundedRect(GAME_WIDTH / 2 - 100, 384, 200, 44, 22);
    layer.add(g);
    layer.add(this.add.text(GAME_WIDTH / 2, 406, '进屋', {
      fontFamily: FONT, fontSize: '18px', color: '#3a2400', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    const hit = this.add.rectangle(GAME_WIDTH / 2, 406, 200, 44, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    layer.add(hit);
    hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); layer.destroy(true); });
  }

  /** 跑路上岸:清盘换海外身份,永久 +25% 产出 —— 长线追求 */
  private showPrestige() {
    const value = totalAssetValue(this.holdings);
    const pv = this.holdings.prestige ?? 0;
    const layer = this.markOverlay(this.add.container(0, 0).setDepth(this.overlayDepth + 15));
    layer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.88).setInteractive());
    const panel = this.add.graphics();
    panel.fillStyle(0x140a1c, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 280, 96, 560, 344, 22);
    panel.lineStyle(2, 0xffa8a8, 0.6);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 280, 96, 560, 344, 22);
    layer.add(panel);
    layer.add(this.add.text(GAME_WIDTH / 2, 132, '跑路上岸', {
      fontFamily: FONT, fontSize: '28px', color: '#ff8787', fontStyle: 'bold',
      resolution: 2, stroke: '#08131f', strokeThickness: 5
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 168, '护照、机票、海外账户都备好了', {
      fontFamily: FONT, fontSize: '13px', color: '#e2b6b6', resolution: 2
    }).setOrigin(0.5));
    const rows: [string, string][] = [
      ['清空', `全部产业与人脉(家产 ${formatValue(value)} 归零)`],
      ['保留', `银币 ${Math.round(this.coins)} 与所有闯关进度`],
      ['换到', `海外身份 Lv.${pv + 1} · 产出永久 +${Math.round(PRESTIGE_BONUS * 100)}%`]
    ];
    rows.forEach(([k, v], i) => {
      const y = 208 + i * 34;
      layer.add(this.add.text(GAME_WIDTH / 2 - 244, y, k, {
        fontFamily: FONT, fontSize: '13px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      }));
      layer.add(this.add.text(GAME_WIDTH / 2 - 190, y, v, {
        fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2
      }));
    });
    layer.add(this.add.text(GAME_WIDTH / 2, 322, `海外身份每级 +${Math.round(PRESTIGE_BONUS * 100)}% 产出,下一轮攒得更快`, {
      fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', resolution: 2
    }).setOrigin(0.5));

    const mk = (bx: number, label: string, primary: boolean, fn: () => void) => {
      const w = 190; const h = 46; const by = 374;
      const g = this.add.graphics();
      g.fillStyle(primary ? 0xd9480f : 0x16324f, 0.95);
      g.fillRoundedRect(bx - w / 2, by - h / 2, w, h, h / 2);
      g.lineStyle(2, primary ? 0xffd8a8 : 0xffffff, primary ? 0.9 : 0.2);
      g.strokeRoundedRect(bx - w / 2, by - h / 2, w, h, h / 2);
      layer.add(g);
      layer.add(this.add.text(bx, by, label, {
        fontFamily: FONT, fontSize: '15px', color: primary ? '#fff3e0' : '#cfe3ff', fontStyle: 'bold', resolution: 2
      }).setOrigin(0.5));
      const hit = this.add.rectangle(bx, by, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      layer.add(hit);
      hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); layer.destroy(true); fn(); });
    };
    const backdrop = layer.list[0] as Phaser.GameObjects.Rectangle;
    backdrop.on('pointerdown', () => layer.destroy(true));
    mk(GAME_WIDTH / 2 - 104, '再等等', false, () => {});
    mk(GAME_WIDTH / 2 + 104, '走', true, () => this.doPrestige());
    playSfx(this, 'warn', 0.4);
  }

  private doPrestige() {
    const pv = (this.holdings.prestige ?? 0) + 1;
    this.holdings = { assets: {}, network: {}, laundered: 0, prestige: pv };
    this.corrupt = 0;
    const p = loadProgress();
    p.assets = {};
    p.network = {};
    p.laundered = 0;
    p.corrupt = 0;
    p.prestige = pv;
    p.coins = this.coins;
    p.lastAccrualAt = Date.now();
    saveProgress(p);
    playSfx(this, 'promote', 0.5);
    shake(this, 0.01, 320);
    confettiBurst(this, GAME_WIDTH / 2, FLOOR_TOP - 30, 24);
    this.toast(`跑路成功 · 海外身份 Lv.${pv} · 产出 +${Math.round(pv * PRESTIGE_BONUS * 100)}%`, '#ff8787', 'ui-image');
    this.scene.restart();
  }

  private showHall() {
    const rows = assetLeaderboard(this.holdings);
    const nr = nextRival(this.holdings);
    const layer = this.markOverlay(this.add.container(0, 0).setDepth(this.overlayDepth + 5));
    const backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.86)
      .setInteractive({ useHandCursor: true });
    backdrop.on('pointerdown', () => { playSfx(this, 'click', 0.25); layer.destroy(true); });
    layer.add(backdrop);
    const panel = this.add.graphics();
    panel.fillStyle(0x120b22, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 300, 54, 600, 442, 22);
    panel.lineStyle(2, 0xb197fc, 0.5);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 300, 54, 600, 442, 22);
    layer.add(panel);
    layer.add(this.add.text(GAME_WIDTH / 2, 86, '官场名人堂', {
      fontFamily: FONT, fontSize: '26px', color: '#b197fc', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 114, nr.ahead
      ? `下一个要超过:${nr.ahead.name} · 还差 ${formatValue(nr.gap)}`
      : '这条街上你已经最有钱了', {
      fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2
    }).setOrigin(0.5));
    rows.slice(0, 8).forEach((r, i) => {
      const y = 152 + i * 38;
      const g = this.add.graphics();
      g.fillStyle(r.isPlayer ? 0x3a2b12 : 0x0d1a2b, r.isPlayer ? 0.95 : 0.7);
      g.fillRoundedRect(GAME_WIDTH / 2 - 270, y - 16, 540, 34, 9);
      if (r.isPlayer) {
        g.lineStyle(1.4, 0xffd43b, 0.7);
        g.strokeRoundedRect(GAME_WIDTH / 2 - 270, y - 16, 540, 34, 9);
      }
      layer.add(g);
      layer.add(this.add.text(GAME_WIDTH / 2 - 252, y, `${r.rank}`, {
        fontFamily: FONT, fontSize: '14px', color: r.rank <= 3 ? '#ffd43b' : '#93b5d6', fontStyle: 'bold', resolution: 2
      }).setOrigin(0, 0.5));
      layer.add(this.add.text(GAME_WIDTH / 2 - 232, y, r.name, {
        fontFamily: FONT, fontSize: '13px', color: r.isPlayer ? '#ffe066' : '#ffffff', fontStyle: 'bold', resolution: 2
      }).setOrigin(0, 0.5));
      layer.add(this.add.text(GAME_WIDTH / 2 + 20, y, r.taunt, {
        fontFamily: FONT, fontSize: '10px', color: '#8ba9c7', resolution: 2
      }).setOrigin(0, 0.5));
      layer.add(this.add.text(GAME_WIDTH / 2 + 258, y, formatValue(r.value), {
        fontFamily: FONT, fontSize: '13px', color: r.isPlayer ? '#ffe066' : '#cfe3ff', fontStyle: 'bold', resolution: 2
      }).setOrigin(1, 0.5));
    });
    const by = 468;
    const g2 = this.add.graphics();
    g2.fillStyle(0x16324f, 0.95);
    g2.fillRoundedRect(GAME_WIDTH / 2 - 80, by - 18, 160, 36, 18);
    layer.add(g2);
    layer.add(this.add.text(GAME_WIDTH / 2, by, '知道了', {
      fontFamily: FONT, fontSize: '16px', color: '#cfe3ff', fontStyle: 'bold', resolution: 2
    }).setOrigin(0.5));
    const hit = this.add.rectangle(GAME_WIDTH / 2, by, 160, 36, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    layer.add(hit);
    hit.on('pointerdown', () => { playSfx(this, 'click', 0.3); layer.destroy(true); });
  }

  private shareAssets() {
    const value = totalAssetValue(this.holdings);
    const title = assetTitle(value);
    const text = `我的家产 ${formatValue(value)},头衔「${title.name}」,躲过 ${this.savedSurvived} 次审查。敢不敢跟我比?《王博晋升之路》`;
    if (isWx()) { wxShare(text); return; }
    try {
      const topAssets = ASSETS
        .map(a => ({ name: a.name, level: this.holdings.assets[a.id] ?? 0 }))
        .filter(a => a.level > 0)
        .sort((a, b) => b.level - a.level);
      const canvas = buildAssetShareCard(this, {
        valueText: formatValue(value),
        titleName: title.name,
        titleColor: title.color,
        incomePerMin: incomePerMinWithWind(this.holdings, this.wind),
        risk: netRiskWithWind(this.holdings, this.wind),
        auditsSurvived: this.savedSurvived,
        assetsSeized: this.savedSeized,
        windName: this.wind.name,
        windDesc: this.wind.desc,
        topAssets: topAssets.length > 0 ? topAssets : [{ name: '还没有产业', level: 0 }]
      });
      const ok = downloadCanvas(canvas, `我的家产-${formatValue(value)}.png`);
      this.toast(ok ? '家产卡已保存,发群里吧!' : '保存失败,截图也行', ok ? '#8ce99a' : '#ff8787', 'ui-image');
      if (ok) playSfx(this, 'record', 0.35);
    } catch {
      this.toast('保存失败,截图也行', '#ff8787');
    }
  }
}
