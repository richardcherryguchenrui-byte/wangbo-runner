// 「留置室」横版闯关 —— 造梦西游 / 空洞骑士式的平台动作玩法
// 自由左右移动、二段跳、冲刺、近战、BOSS 战;镜头跟随,关卡由 ASCII 地图构建。
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { loadProgress, saveProgress } from '../systems/progress';
import { startBgm, playSfx } from '../systems/audio';
import { showToast, FONT } from '../systems/ui';
import { explode, poof, dust, shake, redFlash, confettiBurst, impactBurst } from '../systems/effects';
import { buildDungeonTextures } from '../systems/dungeonArt';
import { loadControls } from '../systems/controls';
import {
  DG_TILE,
  DG_PLAYER_MAX_HP,
  DG_PLAYER_SPEED,
  DG_PLAYER_JUMP,
  DG_DOUBLE_JUMP_RATIO,
  DG_DASH_SPEED,
  DG_DASH_MS,
  DG_DASH_COOLDOWN_MS,
  DG_ATTACK_MS,
  DG_ATTACK_COOLDOWN_MS,
  DG_ATTACK_DAMAGE,
  DG_ATTACK_RANGE,
  DG_INVULN_MS,
  DG_ENEMY_SPEED,
  DG_BOSS_HP,
  DG_BOSS_SPEED,
  DG_BOSS_TOUCH_DAMAGE,
  DG_PLAYER_MAX_MP,
  DG_MP_ON_KILL,
  DG_DEED_MAX_HP,
  DG_MAX_HP_CAP,
  DG_THROWER_HP,
  DG_THROWER_RANGE,
  DG_THROWER_COOLDOWN_MS,
  DG_THROWER_WINDUP_MS,
  DG_ENEMY_LETTER_SPEED,
  DG_ENEMY_LETTER_DAMAGE,
  DG_ENEMY_LETTER_LIFE_MS,
  DG_CHARGER_HP,
  DG_CHARGER_TRIGGER,
  DG_CHARGER_WINDUP_MS,
  DG_CHARGER_DASH_SPEED,
  DG_CHARGER_DASH_MS,
  DG_WINE_BUFF_MS,
  DG_CARD_MP,
  DG_CHEST_COINS,
  playerMeleeDamage,
  DG_SKILL_REPORT,
  DG_SKILL_SHIELD,
  canUseSkill,
  regenMp,
  skillCooldownRatio,
  inRadius,
  DUNGEON_LEVELS,
  boxOverlapRect,
  attackBox,
  dungeonLevelById,
  nextDungeonId,
  isDungeonUnlocked,
  parseDungeon,
  type DungeonLevelDef,
  type ParsedDungeon,
  type DGRect,
  type DGPoint
} from '../systems/dungeon';

interface DGData {
  levelId?: string;
  /** 交代模式:从主线关卡落马进来,交代成功后回这一关 */
  returnLevelId?: string;
}

type EnemyKind = 'walker' | 'thrower' | 'charger' | 'boss';

interface EnemyUnit {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  minX: number;
  maxX: number;
  dir: number;
  isBoss: boolean;
  nextChargeAt: number;
  chargingUntil: number;
  /** 远程/冲锋的抬手预警结束时间 */
  windupUntil: number;
  nextActionAt: number;
}

const PLAYER_BODY_W = 44;
const PLAYER_BODY_H = 116;

export default class DungeonScene extends Phaser.Scene {
  private levelId = DUNGEON_LEVELS[0].id;
  /** 交代模式的目标关卡(为空则是自由挑战) */
  private returnLevelId?: string;
  private level!: DungeonLevelDef;
  private parsed!: ParsedDungeon;

  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: EnemyUnit[] = [];
  private coins!: Phaser.Physics.Arcade.Group;
  private hearts!: Phaser.Physics.Arcade.Group;
  private hazards: DGRect[] = [];
  private goalSprite?: Phaser.GameObjects.Image;

  private hp = DG_PLAYER_MAX_HP;
  /** 本局乌纱帽上限(房产证可加) */
  private maxHp = DG_PLAYER_MAX_HP;
  private mp = DG_PLAYER_MAX_MP;
  private reportReadyAt = 0;
  private shieldReadyAt = 0;
  private shieldUntil = 0;
  private letters!: Phaser.Physics.Arcade.Group;
  private combo = 0;
  private wineUntil = 0;
  private respawnPoint: DGPoint = { x: 0, y: 0 };
  private respawnAt: DGPoint | null = null;
  private enemyLetters!: Phaser.Physics.Arcade.Group;
  private comboUntil = 0;
  private hitstopUntil = 0;
  private hudMpBar!: Phaser.GameObjects.Graphics;
  private hudSkillIcons: { icon: Phaser.GameObjects.Image; mask: Phaser.GameObjects.Graphics; key: Phaser.GameObjects.Text }[] = [];
  private hudCombo?: Phaser.GameObjects.Text;
  private runCoins = 0;
  private facing: 1 | -1 = 1;
  private jumpsUsed = 0;
  private lastJumpPressedAt = -10000;
  private dashReadyAt = 0;
  private dashingUntil = 0;
  private lastGhostAt = 0;
  private attackReadyAt = 0;
  private attackUntil = 0;
  private invulnUntil = 0;
  private lastGroundAt = 0;
  private useQiSkin = false;

  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private holdLeft = false;
  private holdRight = false;
  private jumpHeld = false;

  private hudHearts: Phaser.GameObjects.Image[] = [];
  private hudCoinText!: Phaser.GameObjects.Text;
  private hudLevelText!: Phaser.GameObjects.Text;
  private hudBossBar?: Phaser.GameObjects.Graphics;
  private hudBossLabel?: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;

  private over = false;
  private leaving = false;
  private cleared = false;
  private touchButtons: { obj: Phaser.GameObjects.GameObject; bounds: DGRect }[] = [];
  /** HUD / 触屏按钮层:每帧贴到相机视口左上角(zoom 放大后 scrollFactor=0 不可靠) */
  private ui!: Phaser.GameObjects.Container;
  /** 覆盖层(死亡/通关) */
  private uiTop!: Phaser.GameObjects.Container;

  constructor() {
    super('Dungeon');
  }

  init(data: DGData) {
    this.returnLevelId = data?.returnLevelId;
    const wanted = data?.levelId ?? '';
    const p = loadProgress();
    this.levelId = dungeonLevelById(wanted) && isDungeonUnlocked(wanted, p.dungeonCleared ?? {})
      ? wanted
      : DUNGEON_LEVELS.find(l => isDungeonUnlocked(l.id, p.dungeonCleared ?? {}))?.id ?? DUNGEON_LEVELS[0].id;
  }

  create() {
    this.over = false;
    this.cleared = false;
    this.leaving = false;
    this.level = dungeonLevelById(this.levelId) ?? DUNGEON_LEVELS[0];
    this.parsed = parseDungeon(this.level.map);

    this.hp = DG_PLAYER_MAX_HP;
    this.maxHp = DG_PLAYER_MAX_HP;
    this.mp = DG_PLAYER_MAX_MP;
    this.reportReadyAt = 0;
    this.shieldReadyAt = 0;
    this.shieldUntil = 0;
    this.combo = 0;
    this.comboUntil = 0;
    this.wineUntil = 0;
    this.respawnAt = null;
    this.hitstopUntil = 0;
    this.hudSkillIcons = [];
    // BOSS 血条/出口是可选的:从有 BOSS 的关卡切到没 BOSS 的关卡时,
    // 这些字段会残留上一次已销毁的对象,必须显式清空,否则对已销毁对象
    // 调用 clear() 会抛异常,场景会卡在 CREATING 状态再也起不来。
    this.hudBossBar = undefined;
    this.hudBossLabel = undefined;
    this.goalSprite = undefined;
    this.hudCombo = undefined;
    this.runCoins = 0;
    this.jumpsUsed = 0;
    this.facing = 1;
    this.hazards = this.parsed.spikes;
    this.enemies = [];
    this.hudHearts = [];
    this.touchButtons = [];
    this.dashReadyAt = 0;
    this.dashingUntil = 0;
    this.attackReadyAt = 0;
    this.attackUntil = 0;
    this.invulnUntil = 0;
    this.holdLeft = false;
    this.holdRight = false;
    this.jumpHeld = false;

    buildDungeonTextures(this);
    this.buildBackdrop();
    this.buildPlatforms();
    this.buildPlayer();
    this.buildProjectiles();
    this.buildEntities();
    this.buildCamera();
    this.ui = this.add.container(0, 0).setDepth(90);
    this.uiTop = this.add.container(0, 0).setDepth(200);
    this.buildHud();
    this.buildInput();
    this.buildTouchPad();

    this.physics.world.setBounds(0, 0, this.parsed.widthPx, this.parsed.heightPx);
    startBgm(this);

    this.hudLevelText.setText(this.returnLevelId ? `${this.level.name} · 交代问题` : this.level.name);
    this.time.delayedCall(120, () => {
      showToast(this, GAME_WIDTH / 2, 190, this.level.subtitle, '#cfe3ff', 'ui-tips');
    });
  }

  // ============================================================
  // 场景构建
  // ============================================================

  private buildBackdrop() {
    const w = this.parsed.widthPx;
    const h = this.parsed.heightPx;
    const g = this.add.graphics().setScrollFactor(1).setDepth(-30);
    // 竖向渐变:走廊深处越来越黑
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const c = this.mix(0x0a1220, 0x03060b, t);
      g.fillStyle(c, 1);
      g.fillRect(0, (h / 12) * i, w, h / 12 + 1);
    }
    // 背景网格,暗示这是一栋办公楼
    g.lineStyle(2, 0x18263a, 0.5);
    for (let x = 0; x < w; x += DG_TILE * 4) {
      g.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += DG_TILE * 4) {
      g.lineBetween(0, y, w, y);
    }
    // 走廊背景:一排办公室门 + 门牌,填补空白墙面
    const doorG = this.add.graphics().setDepth(-24);
    for (let x = DG_TILE * 2; x < w; x += DG_TILE * 7) {
      doorG.fillStyle(0x16233a, 0.95);
      doorG.fillRoundedRect(x, h - DG_TILE * 5.2, DG_TILE * 2.2, DG_TILE * 3.2, 6);
      doorG.lineStyle(2, 0x2b4260, 0.9);
      doorG.strokeRoundedRect(x, h - DG_TILE * 5.2, DG_TILE * 2.2, DG_TILE * 3.2, 6);
      doorG.fillStyle(0x0f1a2b, 1);
      doorG.fillRoundedRect(x + 8, h - DG_TILE * 4.9, DG_TILE * 1.6, DG_TILE * 1.4, 3);
      doorG.fillStyle(0xffd43b, 0.5);
      doorG.fillCircle(x + DG_TILE * 1.9, h - DG_TILE * 3.6, 4);
    }

    // 顶部吊灯
    for (let x = DG_TILE * 3; x < w; x += DG_TILE * 9) {
      const lamp = this.add.graphics().setDepth(-20);
      lamp.fillStyle(0x0b1017, 1);
      lamp.fillRect(x - 16, 0, 32, 14);
      lamp.fillStyle(0xffe066, 0.9);
      lamp.fillRoundedRect(x - 12, 12, 24, 8, 4);
      const glow = this.add.image(x, 26, 'spark').setDepth(-19).setScale(3.4, 2.2).setAlpha(0.16).setTint(0xffe066);
      this.tweens.add({ targets: glow, alpha: 0.08, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private mix(a: number, b: number, k: number): number {
    const r1 = (a >> 16) & 0xff, g1 = (a >> 8) & 0xff, b1 = a & 0xff;
    const r2 = (b >> 16) & 0xff, g2 = (b >> 8) & 0xff, b2 = b & 0xff;
    const f = (x: number, y: number) => Math.round(x + (y - x) * Phaser.Math.Clamp(k, 0, 1));
    return (f(r1, r2) << 16) | (f(g1, g2) << 8) | f(b1, b2);
  }

  private buildPlatforms() {
    const g = this.add.graphics().setDepth(-5);
    this.platforms = this.physics.add.staticGroup();

    this.parsed.colliders.forEach(r => {
      // 视觉:深色混凝土 + 顶面高光 + 砖缝,和背景拉开层次
      g.fillStyle(0x2b3d55, 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(0x35496a, 1);
      g.fillRect(r.x, r.y, r.w, 12);
      g.fillStyle(0x8fd0ff, 0.75);
      g.fillRect(r.x, r.y, r.w, 4);
      // 砖缝
      g.lineStyle(1, 0x1a2536, 0.5);
      for (let bx = r.x + DG_TILE; bx < r.x + r.w; bx += DG_TILE) {
        g.lineBetween(bx, r.y + 12, bx, r.y + r.h);
      }
      for (let by = r.y + 12 + DG_TILE; by < r.y + r.h; by += DG_TILE) {
        g.lineBetween(r.x, by, r.x + r.w, by);
      }
      g.lineStyle(2, 0x0f1826, 1);
      g.strokeRect(r.x, r.y, r.w, r.h);

      // 碰撞体:静态矩形
      const zone = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0);
      this.physics.add.existing(zone, true);
      this.platforms.add(zone);
    });

    // 尖刺
    this.hazards.forEach(s => {
      const spikes = Math.max(1, Math.floor(s.w / 18));
      for (let i = 0; i < spikes; i++) {
        this.add
          .image(s.x + (i + 0.5) * (s.w / spikes), s.y + s.h - 10, 'dg-spike')
          .setDepth(-4)
          .setDisplaySize(s.w / spikes, 22);
      }
    });
  }

  private buildPlayer() {
    const p = loadProgress();
    const useQi = p.skin === 'qitongwei';
    this.useQiSkin = useQi;
    const tex = useQi ? 'player-qi' : 'player-run-1';
    this.player = this.physics.add.sprite(
      this.parsed.playerStart.x,
      this.parsed.playerStart.y - 64,
      tex
    );
    this.player.setDepth(10);
    if (useQi) this.player.setScale(0.92);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY_W, PLAYER_BODY_H, false);
    body.setOffset((this.player.width - PLAYER_BODY_W) / 2, this.player.height - PLAYER_BODY_H);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(9999, 1400);
    this.player.setDragX(0);

    this.physics.add.collider(this.player, this.platforms);

    if (!useQi) {
      this.anims.remove('dg-run');
      this.anims.create({
        key: 'dg-run',
        frames: [{ key: 'player-idle' }, { key: 'player-run-1' }, { key: 'player-run-2' }, { key: 'player-run-1' }],
        frameRate: 11,
        repeat: -1
      });
    }
  }

  private buildEntities() {
    // 银币
    this.coins = this.physics.add.group({ allowGravity: false });
    this.parsed.coins.forEach(c => {
      const coin = this.physics.add.image(c.x, c.y, 'coin').setDepth(6);
      (coin.body as Phaser.Physics.Arcade.Body).setCircle(13, 7, 7);
      this.tweens.add({
        targets: coin,
        scaleX: 0.4,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
      this.coins.add(coin);
    });
    this.physics.add.overlap(this.player, this.coins, (_p, obj) => {
      const coin = obj as Phaser.Physics.Arcade.Image;
      if (!coin.active) return;
      coin.destroy();
      this.runCoins += 1;
      playSfx(this, 'coin', 0.22);
      poof(this, coin.x, coin.y, 3);
      this.refreshCoinHud();
    });

    // 回血
    this.hearts = this.physics.add.group({ allowGravity: false });
    this.parsed.hearts.forEach(h => {
      const heart = this.physics.add.image(h.x, h.y - 20, 'ui-heart').setDepth(6).setDisplaySize(30, 30);
      (heart.body as Phaser.Physics.Arcade.Body).setCircle(15, 0, 0);
      this.tweens.add({ targets: heart, y: heart.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.hearts.add(heart);
    });
    this.physics.add.overlap(this.player, this.hearts, (_p, obj) => {
      const heart = obj as Phaser.Physics.Arcade.Image;
      if (!heart.active) return;
      heart.destroy();
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.refreshHeartHud();
      playSfx(this, 'hype', 0.4);
      poof(this, heart.x, heart.y, 6);
      showToast(this, GAME_WIDTH / 2, 120, '补一顶乌纱帽', '#8ce99a', 'ui-heart');
    });

    // 出口
    if (this.parsed.goal) {
      this.goalSprite = this.add
        .image(this.parsed.goal.x, this.parsed.goal.y - 60, 'dg-door')
        .setDepth(4)
        .setDisplaySize(84, 120);
    }

    // 敌人:巡逻 / 远程 / 冲锋
    this.parsed.enemies.forEach(e => this.spawnEnemy(e.x, e.y, 'walker'));
    this.parsed.throwers.forEach(e => this.spawnEnemy(e.x, e.y, 'thrower'));
    this.parsed.chargers.forEach(e => this.spawnEnemy(e.x, e.y, 'charger'));
    if (this.parsed.boss) this.spawnEnemy(this.parsed.boss.x, this.parsed.boss.y, 'boss');

    // 宝箱 / 梗向拾取 / 检查点
    this.buildPickups();
  }

  private buildProjectiles() {
    this.enemyLetters = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.enemyLetters, (_p, obj) => {
      const letter = obj as Phaser.Physics.Arcade.Image;
      if (!letter.active) return;
      const fromX = letter.x;
      letter.destroy();
      poof(this, fromX, letter.y, 4);
      this.hurtPlayer(DG_ENEMY_LETTER_DAMAGE, fromX);
    });
    this.physics.add.overlap(this.enemyLetters, this.platforms, (obj) => {
      const letter = obj as Phaser.Physics.Arcade.Image;
      if (letter.active) {
        poof(this, letter.x, letter.y, 2);
        letter.destroy();
      }
    });

    this.letters = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.letters, this.platforms, (obj) => {
      const letter = obj as Phaser.Physics.Arcade.Image;
      if (letter.active) {
        poof(this, letter.x, letter.y, 3);
        letter.destroy();
      }
    });
  }

  // 宝箱 / 茅台 / 购物卡 / 检查点:全部用 overlap 拾取
  private buildPickups() {
    const mk = (
      tex: string, x: number, y: number, size: [number, number], bob: number,
      onPick: (self: Phaser.Physics.Arcade.Image) => void
    ) => {
      const img = this.physics.add.image(x, y - size[1] / 2, tex).setDepth(6).setDisplaySize(size[0], size[1]);
      const b = img.body as Phaser.Physics.Arcade.Body;
      b.setAllowGravity(false);
      b.setSize(size[0] * 0.9, size[1] * 0.9, true);
      this.tweens.add({ targets: img, y: img.y - bob, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.physics.add.overlap(this.player, img, () => {
        if (!img.active) return;
        onPick(img);
      });
    };

    this.parsed.chests.forEach(c => mk('dg-chest', c.x, c.y, [56, 48], 4, img => {
      img.destroy();
      this.runCoins += DG_CHEST_COINS;
      this.refreshCoinHud();
      playSfx(this, 'unlock', 0.5);
      poof(this, img.x, img.y, 12);
      confettiBurst(this, img.x, img.y, 10);
      this.floatText(img.x, img.y - 20, `小金库 +${DG_CHEST_COINS}`, '#ffe066');
    }));

    this.parsed.wines.forEach(c => mk('dg-wine', c.x, c.y, [30, 44], 6, img => {
      img.destroy();
      this.wineUntil = this.time.now + DG_WINE_BUFF_MS;
      playSfx(this, 'hype', 0.45);
      poof(this, img.x, img.y, 8);
      this.floatText(img.x, img.y - 20, '茅台下肚 · 攻击 +1', '#ffa94d');
      showToast(this, GAME_WIDTH / 2, 150, '茅台下肚:12 秒内攻击力 +1', '#ffa94d', 'ui-bolt');
    }));

    this.parsed.cards.forEach(c => mk('dg-card', c.x, c.y, [40, 28], 5, img => {
      img.destroy();
      this.mp = Math.min(DG_PLAYER_MAX_MP, this.mp + DG_CARD_MP);
      this.refreshMpHud();
      playSfx(this, 'coin', 0.4);
      poof(this, img.x, img.y, 6);
      this.floatText(img.x, img.y - 20, `购物卡 · 人脉 +${DG_CARD_MP}`, '#74c0fc');
    }));

    this.parsed.deeds.forEach(d => mk('dg-deed', d.x, d.y, [44, 34], 5, img => {
      img.destroy();
      if (this.maxHp < DG_MAX_HP_CAP) {
        this.maxHp = Math.min(DG_MAX_HP_CAP, this.maxHp + DG_DEED_MAX_HP);
        this.hp = Math.min(this.maxHp, this.hp + DG_DEED_MAX_HP);
      } else {
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
      this.refreshHeartHud();
      playSfx(this, 'unlock', 0.5);
      poof(this, img.x, img.y, 10);
      this.floatText(img.x, img.y - 20, '房产证到手 · 乌纱帽 +1', '#ff8787');
      showToast(this, GAME_WIDTH / 2, 150, '房产证到手:本局乌纱帽 +1', '#ff8787', 'ui-heart');
    }));

    this.parsed.checkpoints.forEach((c, i) => mk('dg-flag', c.x, c.y, [36, 56], 0, img => {
      if (this.respawnAt) return;
      this.respawnAt = { x: c.x, y: c.y };
      img.setTint(0x8ce99a);
      playSfx(this, 'unlock', 0.4);
      showToast(this, GAME_WIDTH / 2, 190, '打点好了 · 死了从这儿接着来', '#8ce99a', 'ui-check');
      void i;
    }));
  }

  // 伤害飘字
  private floatText(x: number, y: number, msg: string, color: string) {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: FONT, fontSize: '15px', color, fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t, y: y - 42, alpha: 0, duration: 720, ease: 'Quad.out',
      onComplete: () => t.destroy()
    });
  }

  // 敌人扔出的举报信
  private throwEnemyLetter(fromX: number, fromY: number, toX: number, toY: number) {
    const letter = this.enemyLetters.create(fromX, fromY, 'dg-enemy-letter') as Phaser.Physics.Arcade.Image;
    letter.setDepth(12).setDisplaySize(36, 26);
    const b = letter.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(false);
    const ang = Math.atan2(toY - fromY, toX - fromX);
    b.setVelocityX(Math.cos(ang) * DG_ENEMY_LETTER_SPEED);
    b.setVelocityY(Math.sin(ang) * DG_ENEMY_LETTER_SPEED);
    playSfx(this, 'near', 0.22);
    this.time.delayedCall(DG_ENEMY_LETTER_LIFE_MS, () => {
      if (letter.active) letter.destroy();
    });
  }

  private spawnEnemy(feetX: number, feetY: number, kind: EnemyKind) {
    const isBoss = kind === 'boss';
    const tex = isBoss ? 'dg-boss' : kind === 'thrower' ? 'dg-thrower' : kind === 'charger' ? 'dg-charger' : 'dg-enemy';
    const halfH = isBoss ? 62 : 32;
    const sprite = this.physics.add.sprite(feetX, feetY - halfH, tex).setDepth(8);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (isBoss) {
      body.setSize(72, 110, false);
      body.setOffset((sprite.width - 72) / 2, sprite.height - 110);
    } else if (kind === 'charger') {
      body.setSize(44, 56, false);
      body.setOffset((sprite.width - 44) / 2, sprite.height - 56);
    } else {
      body.setSize(40, 54, false);
      body.setOffset((sprite.width - 40) / 2, sprite.height - 54);
    }
    this.physics.add.collider(sprite, this.platforms);

    const hp = isBoss ? DG_BOSS_HP
      : kind === 'thrower' ? DG_THROWER_HP
      : kind === 'charger' ? DG_CHARGER_HP
      : this.level.enemyHp;
    const patrol = kind === 'thrower' ? DG_TILE * 1.2 : DG_TILE * 2.4;
    const unit: EnemyUnit = {
      sprite,
      kind,
      hp,
      maxHp: hp,
      minX: feetX - patrol,
      maxX: feetX + patrol,
      dir: -1,
      isBoss,
      nextChargeAt: 0,
      chargingUntil: 0,
      windupUntil: 0,
      nextActionAt: 0
    };
    this.enemies.push(unit);

    this.physics.add.overlap(this.player, sprite, () => this.hurtPlayer(isBoss ? DG_BOSS_TOUCH_DAMAGE : 1, sprite.x));
    return unit;
  }

  private buildCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.parsed.widthPx, this.parsed.heightPx);
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.setDeadzone(120, 80);
    cam.fadeIn(240, 4, 8, 16);
  }

  private buildHud() {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x060d16, 0.72);
    hudBg.fillRoundedRect(16, 14, 300, 52, 14);
    hudBg.lineStyle(1.5, 0xffffff, 0.12);
    hudBg.strokeRoundedRect(16, 14, 300, 52, 14);

    // 预留到上限的心位,房产证加血时逐颗点亮
    for (let i = 0; i < DG_MAX_HP_CAP; i++) {
      const h = this.add.image(44 + i * 27, 40, 'dg-hat').setDisplaySize(28, 19);
      this.hudHearts.push(h);
    }

    const coinIcon = this.add.image(214, 40, 'coin').setDisplaySize(20, 20);
    this.hudCoinText = this.add
      .text(232, 40, '0', { fontFamily: FONT, fontSize: '17px', color: '#ffe066', fontStyle: 'bold', resolution: 2 })
      .setOrigin(0, 0.5);

    this.hudLevelText = this.add
      .text(GAME_WIDTH / 2, 30, '', {
        fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#060d16', strokeThickness: 5
      })
      .setOrigin(0.5);

    const hintW = 340;
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x060d16, 0.66);
    hintBg.fillRoundedRect(GAME_WIDTH / 2 - hintW / 2, GAME_HEIGHT - 106, hintW, 26, 13);
    this.hudHint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 93, 'A/D 移动 · 空格跳 · J 攻击 · K 冲刺', {
        fontFamily: FONT, fontSize: '12px', color: '#b7cfe8', resolution: 2
      })
      .setOrigin(0.5);
    if (loadControls().virtualButtons) this.hudHint.setVisible(false);

    // BOSS 血条
    if (this.parsed.boss) {
      this.hudBossLabel = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '巡视组长', {
          fontFamily: FONT, fontSize: '13px', color: '#ff8787', fontStyle: 'bold', resolution: 2
        })
        .setOrigin(0.5);
      this.hudBossBar = this.add.graphics();
    }

    // MP 条(血条下方)
    this.hudMpBar = this.add.graphics();
    const skillHint = loadControls().virtualButtons ? '技能键' : 'Q 举报 / E 护体';
    const skillLabels: { icon: string; x: number }[] = [
      { icon: 'dg-letter', x: 214 },
      { icon: 'dg-skill-shield', x: 252 }
    ];
    this.hudSkillIcons = skillLabels.map(({ icon, x }) => {
      const img = this.add.image(x, 76, icon).setDisplaySize(26, icon === 'dg-skill-shield' ? 26 : 22);
      const mask = this.add.graphics();
      const key = this.add
        .text(x + 15, 62, '', { fontFamily: FONT, fontSize: '10px', color: '#93b5d6', resolution: 2 })
        .setOrigin(0, 0.5);
      return { icon: img, mask, key };
    });
    const skillHintText = this.add.text(284, 76, skillHint, {
      fontFamily: FONT, fontSize: '10px', color: '#8ba9c7', resolution: 2
    }).setOrigin(0, 0.5);

    const mpLabel = this.add
      .text(34, 50, '人脉', { fontFamily: FONT, fontSize: '9px', color: '#9db8d8', resolution: 2 })
      .setOrigin(0, 1);
    this.ui.add([hudBg, ...this.hudHearts, coinIcon, this.hudCoinText, this.hudLevelText, hintBg, this.hudHint, mpLabel]);
    this.ui.add(this.hudMpBar);
    this.hudSkillIcons.forEach(sk => this.ui.add([sk.icon, sk.mask, sk.key]));
    this.ui.add(skillHintText);

    // 连击计数
    this.hudCombo = this.add
      .text(GAME_WIDTH - 40, 96, '', {
        fontFamily: FONT, fontSize: '22px', color: '#ffd43b', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 5
      })
      .setOrigin(1, 0.5)
      .setVisible(false);
    this.ui.add(this.hudCombo);
    this.refreshMpHud();
    if (this.hudBossBar) this.ui.add(this.hudBossBar);
    if (this.hudBossLabel) this.ui.add(this.hudBossLabel);

    this.refreshHeartHud();
    this.refreshCoinHud();
    this.refreshBossBar();
  }

  private refreshHeartHud() {
    this.hudHearts.forEach((h, i) => {
      const exists = i < this.maxHp;
      h.setVisible(exists);
      h.setAlpha(i < this.hp ? 1 : 0.22);
      h.setTint(i < this.hp ? 0xffffff : 0x44546a);
    });
  }

  private refreshMpHud() {
    if (!this.hudMpBar) return;
    const x = 30;
    const y = 52;
    const w = 160;
    const h = 8;
    this.hudMpBar.clear();
    this.hudMpBar.fillStyle(0x0a1a2e, 0.95);
    this.hudMpBar.fillRoundedRect(x, y, w, h, 4);
    const ratio = Math.max(0, Math.min(1, this.mp / DG_PLAYER_MAX_MP));
    this.hudMpBar.fillStyle(0x74c0fc, 0.95);
    this.hudMpBar.fillRoundedRect(x, y, Math.max(3, w * ratio), h, 4);
    this.hudMpBar.lineStyle(1, 0xffffff, 0.18);
    this.hudMpBar.strokeRoundedRect(x, y, w, h, 4);

    // 技能冷却遮罩 + 可用高亮
    const now = this.time.now;
    const slots = [
      { readyAt: this.reportReadyAt, cd: DG_SKILL_REPORT.cooldownMs, cost: DG_SKILL_REPORT.cost },
      { readyAt: this.shieldReadyAt, cd: DG_SKILL_SHIELD.cooldownMs, cost: DG_SKILL_SHIELD.cost }
    ];
    this.hudSkillIcons.forEach((sk, i) => {
      const slot = slots[i];
      const cdRatio = skillCooldownRatio(now, slot.readyAt, slot.cd);
      const affordable = this.mp >= slot.cost;
      sk.icon.setAlpha(affordable && cdRatio === 0 ? 1 : 0.45);
      sk.icon.setTint(affordable && cdRatio === 0 ? 0xffffff : 0x7f93ab);
      sk.mask.clear();
      if (cdRatio > 0) {
        sk.mask.fillStyle(0x02060c, 0.66);
        sk.mask.fillRoundedRect(sk.icon.x - 13, 63, 26, 26 * cdRatio, 6);
      }
      sk.key.setText(loadControls().virtualButtons ? '' : (i === 0 ? 'Q' : 'E'));
    });
  }

  private refreshCoinHud() {
    this.hudCoinText.setText(String(this.runCoins));
  }

  private refreshBossBar() {
    if (!this.hudBossBar) return;
    const boss = this.enemies.find(e => e.isBoss);
    if (!boss || boss.hp <= 0) {
      this.hudBossBar.clear();
      this.hudBossLabel?.setVisible(false);
      return;
    }
    const w = 460;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = GAME_HEIGHT - 34;
    this.hudBossBar.clear();
    this.hudBossBar.fillStyle(0x1a0b12, 0.9);
    this.hudBossBar.fillRoundedRect(x, y, w, 14, 7);
    this.hudBossBar.fillStyle(0xff5c5c, 0.95);
    this.hudBossBar.fillRoundedRect(x, y, Math.max(6, w * (boss.hp / boss.maxHp)), 14, 7);
    this.hudBossBar.lineStyle(1.5, 0xffffff, 0.28);
    this.hudBossBar.strokeRoundedRect(x, y, w, 14, 7);
    this.hudBossLabel?.setVisible(true);
  }

  // ============================================================
  // 输入
  // ============================================================

  private buildInput() {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    kb.on('keydown-SPACE', () => this.pressJump());
    kb.on('keydown-UP', () => this.pressJump());
    kb.on('keydown-W', () => this.pressJump());
    kb.on('keyup-SPACE', () => this.releaseJump());
    kb.on('keyup-UP', () => this.releaseJump());
    kb.on('keyup-W', () => this.releaseJump());
    kb.on('keydown-J', () => this.pressAttack());
    kb.on('keydown-Z', () => this.pressAttack());
    kb.on('keydown-K', () => this.pressDash());
    kb.on('keydown-Q', () => this.pressReport());
    kb.on('keydown-E', () => this.pressShield());
    kb.on('keydown-SHIFT', () => this.pressDash());
    kb.on('keydown-ESC', () => this.leave());

    // 鼠标/触摸点空白处也能攻击,方便桌面试玩
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isOnTouchButton(p)) return;
      this.pressAttack();
    });
  }

  private makePadButton(
    x: number, y: number, r: number, accent: number, glyph: 'left' | 'right' | 'up' | 'hit' | 'dash', label: string,
    onDown: () => void, onUp?: () => void
  ) {
    const base = this.add.graphics();
    const glyphG = this.add.graphics();
    const text = this.add
      .text(x, y + r - 12, label, {
        fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#060d16', strokeThickness: 4
      })
      .setOrigin(0.5);

    const draw = (pressed: boolean) => {
      base.clear();
      base.fillStyle(accent, pressed ? 0.34 : 0.16);
      base.fillCircle(x, y, r + 5);
      base.fillStyle(0x060d16, pressed ? 0.74 : 0.46);
      base.fillCircle(x, y, r);
      base.lineStyle(2.4, accent, pressed ? 1 : 0.75);
      base.strokeCircle(x, y, r);

      glyphG.clear();
      glyphG.fillStyle(accent, pressed ? 1 : 0.9);
      const s = r * 0.3;
      const cy = y - 8;
      if (glyph === 'left') glyphG.fillTriangle(x + s, cy - s, x + s, cy + s, x - s, cy);
      else if (glyph === 'right') glyphG.fillTriangle(x - s, cy - s, x - s, cy + s, x + s, cy);
      else if (glyph === 'up') glyphG.fillTriangle(x - s, cy + s * 0.6, x + s, cy + s * 0.6, x, cy - s);
      else if (glyph === 'hit') {
        glyphG.lineStyle(4, accent, pressed ? 1 : 0.9);
        glyphG.lineBetween(x - s * 0.9, cy + s * 0.9, x + s * 0.9, cy - s * 0.9);
        glyphG.lineBetween(x - s * 0.9, cy - s * 0.9, x + s * 0.9, cy + s * 0.9);
      } else {
        // dash:双向箭头
        glyphG.fillTriangle(x - s * 1.3, cy, x - s * 0.2, cy - s, x - s * 0.2, cy + s);
        glyphG.fillTriangle(x + s * 1.3, cy, x + s * 0.2, cy - s, x + s * 0.2, cy + s);
      }
    };
    draw(false);

    const hitR = r + 10;
    const hit = this.add.circle(x, y, hitR, 0xffffff, 0.001);
    hit.setInteractive(new Phaser.Geom.Circle(hitR, hitR, hitR), Phaser.Geom.Circle.Contains);
    hit.on('pointerdown', () => {
      if (this.over) return;
      draw(true);
      onDown();
    });
    const up = () => {
      draw(false);
      onUp?.();
    };
    hit.on('pointerup', up);
    hit.on('pointerout', up);

    this.ui.add([base, glyphG, text, hit]);
    this.touchButtons.push({ obj: hit, bounds: { x: x - hitR, y: y - hitR, w: hitR * 2, h: hitR * 2 } });
  }

  private buildTouchPad() {
    if (!loadControls().virtualButtons) return;
    const y = GAME_HEIGHT - 74;
    const r = 44;
    // 左手:左右移动
    this.makePadButton(78, y, r, 0x74c0fc, 'left', '左', () => { this.holdLeft = true; this.holdRight = false; },
      () => { this.holdLeft = false; });
    this.makePadButton(178, y, r, 0x74c0fc, 'right', '右', () => { this.holdRight = true; this.holdLeft = false; },
      () => { this.holdRight = false; });
    // 右手:跳 / 攻击 / 冲刺
    this.makePadButton(GAME_WIDTH - 74, y, r, 0xffd43b, 'up', '跳', () => this.pressJump(), () => this.releaseJump());
    this.makePadButton(GAME_WIDTH - 172, y, r - 4, 0xff8787, 'hit', '攻击', () => this.pressAttack());
    this.makePadButton(GAME_WIDTH - 262, y, r - 8, 0xb197fc, 'dash', '冲刺', () => this.pressDash());
    // 技能键:放在移动键上方,避免和右手三键打架
    this.makePadButton(78, y - 104, r - 12, 0xffd43b, 'hit', '举报', () => this.pressReport());
    this.makePadButton(178, y - 104, r - 12, 0x8ce99a, 'up', '护体', () => this.pressShield());
  }

  private isOnTouchButton(p: Phaser.Input.Pointer): boolean {
    const x = p.worldX - this.ui.x;
    const y = p.worldY - this.ui.y;
    return this.touchButtons.some(b =>
      x >= b.bounds.x && x <= b.bounds.x + b.bounds.w && y >= b.bounds.y && y <= b.bounds.y + b.bounds.h
    );
  }

  // ============================================================
  // 动作
  // ============================================================

  private pressJump() {
    if (this.over) return;
    this.jumpHeld = true;
    this.lastJumpPressedAt = this.time.now;
  }

  private releaseJump() {
    this.jumpHeld = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < -420) body.setVelocityY(-420);
  }

  private pressAttack() {
    if (this.over || this.time.now < this.attackReadyAt) return;
    this.attackReadyAt = this.time.now + DG_ATTACK_COOLDOWN_MS;
    this.attackUntil = this.time.now + DG_ATTACK_MS;
    playSfx(this, 'shoot', 0.24);

    // 挥击特效
    const box = attackBox(this.player.x, this.player.y, this.facing, DG_ATTACK_RANGE, 56);
    const slash = this.add
      .rectangle(box.x + (this.facing === 1 ? box.w / 2 : -box.w / 2), box.y + box.h / 2, box.w * 0.8, 10, 0xd8f0ff, 0.85)
      .setDepth(11)
      .setScale(0.4, 1);
    this.tweens.add({ targets: slash, scaleX: 1.1, alpha: 0, duration: 170, onComplete: () => slash.destroy() });

    // 命中判定
    let hitAny = false;
    const dmg = playerMeleeDamage(this.combo, this.time.now < this.wineUntil);
    this.enemies.forEach(u => {
      if (u.hp <= 0) return;
      const b = u.sprite.body as Phaser.Physics.Arcade.Body;
      if (!boxOverlapRect(box, b.x, b.y, b.width, b.height)) return;
      hitAny = true;
      this.damageEnemy(u, dmg);
    });
    if (hitAny) shake(this, 0.006, 110);
  }

  private damageEnemy(u: EnemyUnit, amount: number) {
    u.hp -= amount;
    const heavy = amount > DG_ATTACK_DAMAGE;
    this.floatText(
      u.sprite.x, u.sprite.y - 26,
      heavy ? `${amount}!` : `${amount}`,
      heavy ? '#ffa94d' : '#ffffff'
    );
    const s = u.sprite;
    s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (s.active) s.clearTint(); });
    impactBurst(this, s.x, s.y - 20);
    // 击退
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX((this.player.x < s.x ? 1 : -1) * 220);
    if (u.hp <= 0) {
      this.killEnemy(u);
    } else if (u.isBoss) {
      this.refreshBossBar();
    }
  }

  private killEnemy(u: EnemyUnit) {
    this.mp = Math.min(DG_PLAYER_MAX_MP, this.mp + DG_MP_ON_KILL);
    this.combo += 1;
    this.comboUntil = this.time.now + 3200;
    this.refreshMpHud();
    if (this.hudCombo) {
      this.hudCombo.setText(`×${this.combo}`).setVisible(this.combo >= 2);
    }
    this.hitstop(u.isBoss ? 90 : 45);

    const s = u.sprite;
    const x = s.x;
    const y = s.y;
    s.destroy();
    explode(this, x, y - 16);
    playSfx(this, u.isBoss ? 'gameover' : 'wave_clear', 0.4);
    if (u.isBoss) {
      shake(this, 0.02, 420);
      confettiBurst(this, x, y - 40, 40);
      this.refreshBossBar();
      showToast(this, GAME_WIDTH / 2, 140, '巡视组长被拖走了!出口解锁', '#8ce99a', 'ui-check');
      if (this.goalSprite) this.goalSprite.clearTint();
    } else {
      this.runCoins += 2;
      this.refreshCoinHud();
    }
  }

  // 「实名举报」:远程投掷,命中即造成伤害
  private pressReport() {
    if (this.over) return;
    if (!canUseSkill(this.mp, this.time.now, this.reportReadyAt, DG_SKILL_REPORT.cost)) {
      if (this.mp < DG_SKILL_REPORT.cost) showToast(this, GAME_WIDTH / 2, 130, '人脉不够 · 先去认识几个人', '#b197fc', 'ui-bolt');
      return;
    }
    this.mp -= DG_SKILL_REPORT.cost;
    this.reportReadyAt = this.time.now + DG_SKILL_REPORT.cooldownMs;
    playSfx(this, 'shoot', 0.4);

    // 注意:必须先用组 create 再设速度 —— Arcade Group 的 defaults 会在 add 时把速度清零
    // 发射高度对准胸口:小兵碰撞盒在身体下半部,平射高度太低会从头顶飞过
    const letter = this.letters.create(
      this.player.x + this.facing * 40,
      this.player.y + 18,
      'dg-letter'
    ) as Phaser.Physics.Arcade.Image;
    letter.setDepth(12).setDisplaySize(44, 32).setFlipX(this.facing === -1);
    const lb0 = letter.body as Phaser.Physics.Arcade.Body;
    lb0.setAllowGravity(false);
    lb0.setVelocityX(this.facing * DG_SKILL_REPORT.speed);

    let hits = 0;
    const until = this.time.now + DG_SKILL_REPORT.lifeMs;
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!letter.active || this.time.now > until || hits >= DG_SKILL_REPORT.pierce + 1) {
          if (letter.active) letter.destroy();
          tick.remove();
          return;
        }
        const lb = letter.body as Phaser.Physics.Arcade.Body;
        for (const u of this.enemies) {
          if (u.hp <= 0 || !u.sprite.active) continue;
          const b = u.sprite.body as Phaser.Physics.Arcade.Body;
          if (!boxOverlapRect({ x: lb.x, y: lb.y, w: lb.width, h: lb.height }, b.x, b.y, b.width, b.height)) continue;
          hits += 1;
          this.damageEnemy(u, DG_SKILL_REPORT.damage);
          letter.setTint(0xffd43b);
          break;
        }
      }
    });
    this.refreshMpHud();
  }

  // 「金句护体」:短暂无敌 + 范围震开
  private pressShield() {
    if (this.over) return;
    if (!canUseSkill(this.mp, this.time.now, this.shieldReadyAt, DG_SKILL_SHIELD.cost)) {
      if (this.mp < DG_SKILL_SHIELD.cost) showToast(this, GAME_WIDTH / 2, 130, '人脉不够 · 先去认识几个人', '#b197fc', 'ui-bolt');
      return;
    }
    this.mp -= DG_SKILL_SHIELD.cost;
    this.shieldReadyAt = this.time.now + DG_SKILL_SHIELD.cooldownMs;
    this.shieldUntil = this.time.now + DG_SKILL_SHIELD.shieldMs;
    this.invulnUntil = Math.max(this.invulnUntil, this.shieldUntil);
    playSfx(this, 'shield', 0.5);

    const burst = this.add
      .image(this.player.x, this.player.y, 'dg-burst')
      .setDepth(11)
      .setDisplaySize(DG_SKILL_SHIELD.radius * 2.2, DG_SKILL_SHIELD.radius * 2.2)
      .setAlpha(0.95);
    this.tweens.add({ targets: burst, scale: burst.scale * 1.25, alpha: 0, duration: 380, onComplete: () => burst.destroy() });

    this.enemies.forEach(u => {
      if (u.hp <= 0 || !u.sprite.active) return;
      if (!inRadius(this.player.x, this.player.y, u.sprite.x, u.sprite.y, DG_SKILL_SHIELD.radius)) return;
      this.damageEnemy(u, DG_SKILL_SHIELD.damage);
      const b = u.sprite.body as Phaser.Physics.Arcade.Body;
      b.setVelocityX((u.sprite.x < this.player.x ? -1 : 1) * 320);
    });
    this.refreshMpHud();
    showToast(this, GAME_WIDTH / 2, 150, '金句护体:组织上已经了解情况了', '#ffe066', 'ui-shield');
  }

  // 命中顿帧:短暂停住世界,打击更实
  private hitstop(ms: number) {
    if (this.over) return;
    this.hitstopUntil = this.time.now + ms;
    this.physics.pause();
    this.time.delayedCall(ms, () => {
      if (!this.over) this.physics.resume();
    });
  }

  private pressDash() {
    if (this.over || this.time.now < this.dashReadyAt) return;
    this.dashReadyAt = this.time.now + DG_DASH_COOLDOWN_MS;
    this.dashingUntil = this.time.now + DG_DASH_MS;
    playSfx(this, 'jump', 0.3);
    const ghost = this.add
      .image(this.player.x, this.player.y, 'dg-ghost')
      .setDepth(9)
      .setDisplaySize(70, 110)
      .setFlipX(this.facing === -1);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
    dust(this, this.player.x, this.player.y + 50, 5);
  }

  private hurtPlayer(amount: number, fromX: number) {
    if (this.over || this.time.now < this.invulnUntil) return;
    this.hp -= amount;
    this.invulnUntil = this.time.now + DG_INVULN_MS;
    redFlash(this);
    shake(this, 0.012, 200);
    playSfx(this, 'fail', 0.34);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((this.player.x < fromX ? -1 : 1) * 260, -420);
    this.player.setTint(0xff8080);
    this.time.delayedCall(160, () => { if (this.player.active) this.player.clearTint(); });
    this.refreshHeartHud();
    if (this.hp <= 0) this.onDeath();
  }

  private onDeath() {
    if (this.over) return;
    this.over = true;
    this.physics.pause();
    playSfx(this, 'gameover', 0.55);
    this.showOverlay(false);
  }

  // 从检查点继续:保留已吃到的银币,清屏敌人举报信,满血复活
  private respawnAtCheckpoint() {
    if (!this.respawnAt) return;
    this.over = false;
    this.uiTop.removeAll(true);
    this.physics.resume();
    this.hp = this.maxHp;
    this.refreshHeartHud();
    this.player.clearTint();
    this.player.setPosition(this.respawnAt.x, this.respawnAt.y - 64);
    this.player.setVelocity(0, 0);
    this.invulnUntil = this.time.now + 1600;
    this.mpHudSafeRefresh();
    this.enemyLetters.getChildren().slice().forEach(o => o.destroy());
    showToast(this, GAME_WIDTH / 2, 190, '打点处接着来 · 组织上还没定论', '#8ce99a', 'ui-check');
  }

  private mpHudSafeRefresh() {
    this.refreshMpHud();
  }

  private onClear() {
    if (this.over || this.cleared) return;
    this.cleared = true;
    this.over = true;
    this.physics.pause();
    playSfx(this, 'promote', 0.6);
    confettiBurst(this, GAME_WIDTH / 2, 140, 48);

    const p = loadProgress();
    p.dungeonCleared = p.dungeonCleared ?? {};
    p.dungeonCleared[this.levelId] = (p.dungeonCleared[this.levelId] ?? 0) + 1;
    p.coins += this.runCoins;
    p.totalRuns += 1;
    if (this.returnLevelId) {
      // 交代成功:记一笔「宽大处理」,下次回到主线那关多一顶乌纱帽
      p.redeemBonus = Math.min(3, (p.redeemBonus ?? 0) + 1);
    }
    saveProgress(p);

    this.showOverlay(true);
  }

  private showOverlay(win: boolean) {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.uiTop.add(o);
      return o;
    };

    add(this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060c, 0.78)
      .setInteractive());

    const panel = add(this.add.graphics());
    panel.fillStyle(0x0a1930, 0.98);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 260, 120, 520, 300, 24);
    panel.lineStyle(2, win ? 0xffd43b : 0xff8787, 0.5);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 260, 120, 520, 300, 24);

    const redeem = !!this.returnLevelId;
    add(this.add
      .text(GAME_WIDTH / 2, 168, redeem
        ? (win ? '交代清楚了' : '还没交代明白')
        : (win ? '闯过去了!' : '被按住了…'), {
        fontFamily: FONT, fontSize: '38px', color: win ? '#ffe066' : '#ff8787',
        fontStyle: 'bold', resolution: 2, stroke: '#08131f', strokeThickness: 6
      })
      .setOrigin(0.5));

    if (!redeem) {
      add(this.add
        .text(GAME_WIDTH / 2, 212, win
          ? `${this.level.name} · 拾到银币 ${this.runCoins}`
          : this.level.subtitle, {
          fontFamily: FONT, fontSize: '14px', color: '#cfe3ff', resolution: 2
        })
        .setOrigin(0.5));
    }

    // 交代模式:成功后回主线那关;失败就地再交代
    if (this.returnLevelId) {
      const back = () => {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('Game', { levelId: this.returnLevelId });
      };
      const again = () => this.scene.restart({ levelId: this.levelId, returnLevelId: this.returnLevelId });
      add(this.add
        .text(GAME_WIDTH / 2, 212, win
          ? `交代清楚 · 争取到宽大处理 · 银币 ${this.runCoins}`
          : '没交代明白,还得再谈一次', {
          fontFamily: FONT, fontSize: '14px', color: win ? '#8ce99a' : '#cfe3ff', resolution: 2
        })
        .setOrigin(0.5));
      const btns = win
        ? [{ label: '回那一关', primary: true, x: GAME_WIDTH / 2 + 130, fn: back },
           { label: '再交代一次', x: GAME_WIDTH / 2 - 130, fn: again }]
        : [{ label: '再谈一次', primary: true, x: GAME_WIDTH / 2 + 130, fn: again },
           { label: '回主菜单', x: GAME_WIDTH / 2 - 130, fn: () => this.leave() }];
      btns.forEach(b => {
        const w = 200; const h = 48; const y = 340;
        const g = add(this.add.graphics());
        const fill = b.primary ? 0xffb703 : 0x16324f;
        g.fillStyle(fill, 0.95);
        g.fillRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
        g.lineStyle(2, b.primary ? 0xffecb3 : 0xffffff, b.primary ? 0.9 : 0.2);
        g.strokeRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
        add(this.add.text(b.x, y, b.label, {
          fontFamily: FONT, fontSize: '18px', color: b.primary ? '#3a2400' : '#cfe3ff',
          fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5));
        const hit = add(this.add.rectangle(b.x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
        hit.on('pointerdown', () => { playSfx(this, 'click', 0.35); b.fn(); });
      });
      add(this.add
        .text(GAME_WIDTH / 2, 392, win ? '宽大处理已记账:回到主线那关会多一顶乌纱帽' : '交代不彻底,组织上不会放你走', {
          fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', resolution: 2
        })
        .setOrigin(0.5));
      return;
    }

    const nextId = win ? nextDungeonId(this.levelId) : null;
    const buttons: { label: string; primary?: boolean; x: number; fn: () => void }[] = [];
    if (win && nextId) {
      buttons.push({ label: '下一层', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.scene.restart({ levelId: nextId }) });
      buttons.push({ label: '重玩', x: GAME_WIDTH / 2 - 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
    } else if (win) {
      buttons.push({ label: '再走一遍', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
      buttons.push({ label: '返回', x: GAME_WIDTH / 2 - 130, fn: () => this.leave() });
    } else if (this.respawnAt) {
      buttons.push({ label: '从打点处继续', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.respawnAtCheckpoint() });
      buttons.push({ label: '重头再来', x: GAME_WIDTH / 2 - 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
    } else {
      buttons.push({ label: '再来一次', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
      buttons.push({ label: '返回', x: GAME_WIDTH / 2 - 130, fn: () => this.leave() });
    }

    buttons.forEach(b => {
      const w = 200;
      const h = 48;
      const y = 340;
      const g = add(this.add.graphics());
      const fill = b.primary ? 0xffb703 : 0x16324f;
      g.fillStyle(fill, 0.95);
      g.fillRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
      g.lineStyle(2, b.primary ? 0xffecb3 : 0xffffff, b.primary ? 0.9 : 0.2);
      g.strokeRoundedRect(b.x - w / 2, y - h / 2, w, h, h / 2);
      add(this.add
        .text(b.x, y, b.label, {
          fontFamily: FONT, fontSize: '19px', color: b.primary ? '#3a2400' : '#cfe3ff',
          fontStyle: 'bold', resolution: 2
        })
        .setOrigin(0.5));
      const hit = add(this.add
        .rectangle(b.x, y, w, h, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true }));
      hit.on('pointerdown', () => {
        playSfx(this, 'click', 0.35);
        b.fn();
      });
    });

    add(this.add
      .text(GAME_WIDTH / 2, 392, '提示:冲刺可以躲开攻击,落地再跳能触发二段跳', {
        fontFamily: FONT, fontSize: '11px', color: '#8ba9c7', resolution: 2
      })
      .setOrigin(0.5));
  }

  private leave() {
    this.cameras.main.fadeOut(180, 4, 8, 16);
    this.time.delayedCall(200, () => this.scene.start('Title'));
  }

  // ============================================================
  // 主循环
  // ============================================================

  update(time: number, delta: number) {
    // UI 层跟随相机视口(zoom 放大下 scrollFactor=0 会错位)
    const view = this.cameras.main.worldView;
    this.ui.setPosition(view.x, view.y);
    this.uiTop.setPosition(view.x, view.y);
    if (this.over) return;
    const dt = Math.min(delta, 50);
    // 命中顿帧:世界静止,输入也不推进
    if (time < this.hitstopUntil) return;

    // MP 自然回复
    const mpBefore = Math.floor(this.mp);
    this.mp = regenMp(this.mp, dt);
    if (Math.floor(this.mp) !== mpBefore) this.refreshMpHud();

    // 连击超时清零
    if (this.combo > 0 && time > this.comboUntil) {
      this.combo = 0;
      this.hudCombo?.setVisible(false);
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundAt = time;
      this.jumpsUsed = 0;
    }

    // ---- 水平移动 ----
    const left = this.holdLeft || !!this.keyLeft?.isDown || !!this.cursors?.left.isDown;
    const right = this.holdRight || !!this.keyRight?.isDown || !!this.cursors?.right.isDown;
    const dashing = time < this.dashingUntil;
    if (dashing) {
      body.setVelocityX(this.facing * DG_DASH_SPEED);
      body.setAllowGravity(false);
      if (time - this.lastGhostAt > 45) {
        this.lastGhostAt = time;
        const g = this.add.image(this.player.x, this.player.y, 'dg-ghost').setDepth(9).setDisplaySize(66, 104).setAlpha(0.5);
        this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      }
    } else {
      body.setAllowGravity(true);
      // 天台的风:直接把速度整体偏移,逆风跑得慢、站着会被吹走
      const wind = this.level.windX ?? 0;
      if (left && !right) {
        body.setVelocityX(-DG_PLAYER_SPEED + wind);
        this.facing = -1;
        this.player.setFlipX(true);
      } else if (right && !left) {
        body.setVelocityX(DG_PLAYER_SPEED + wind);
        this.facing = 1;
        this.player.setFlipX(false);
      } else {
        body.setVelocityX(wind);
      }
    }

    // ---- 跳跃(含二段跳 / 输入缓冲 / 土狼时间) ----
    const buffered = time - this.lastJumpPressedAt <= 130;
    const coyote = time - this.lastGroundAt <= 110;
    if (buffered && !dashing) {
      if (onGround || coyote) {
        body.setVelocityY(-DG_PLAYER_JUMP);
        this.jumpsUsed = 1;
        this.lastJumpPressedAt = -10000;
        this.lastGroundAt = -10000;
        playSfx(this, 'jump', 0.3);
        dust(this, this.player.x, this.player.y + 52, 5);
      } else if (this.jumpsUsed < 2) {
        body.setVelocityY(-DG_PLAYER_JUMP * DG_DOUBLE_JUMP_RATIO);
        this.jumpsUsed = 2;
        this.lastJumpPressedAt = -10000;
        playSfx(this, 'jump', 0.34);
        poof(this, this.player.x, this.player.y + 30, 5);
      }
    }

    // ---- 朝向表现 ----
    if (!dashing) {
      if (onGround) {
        if (!this.useQiSkin && !this.player.anims.isPlaying) this.player.play('dg-run');
      } else {
        this.player.anims.stop();
        this.player.setTexture('player-jump');
      }
    }

    // ---- 护体金光 ----
    if (time < this.shieldUntil) {
      this.player.setTint(0xffe066);
    } else if (time >= this.invulnUntil) {
      this.player.clearTint();
    }

    // ---- 无敌闪烁 ----
    this.player.setAlpha(time < this.invulnUntil ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1);

    // ---- 尖刺 ----
    if (time >= this.invulnUntil) {
      const px = this.player.x - PLAYER_BODY_W / 2;
      const py = this.player.y + 58 - PLAYER_BODY_H;
      for (const s of this.hazards) {
        if (boxOverlapRect(s, px, py, PLAYER_BODY_W, PLAYER_BODY_H - 8)) {
          this.hurtPlayer(1, this.player.x - this.facing * 40);
          break;
        }
      }
    }

    // ---- 敌人 AI ----
    this.enemies.forEach(u => {
      if (u.hp <= 0 || !u.sprite.active) return;
      const b = u.sprite.body as Phaser.Physics.Arcade.Body;
      if (u.isBoss) {
        const distToPlayer = Math.abs(this.player.x - u.sprite.x);
        if (time > u.nextChargeAt && distToPlayer < 460) {
          u.nextChargeAt = time + 2200;
          u.chargingUntil = time + 460;
          playSfx(this, 'warn', 0.35);
        }
        if (time < u.chargingUntil) {
          b.setVelocityX((this.player.x < u.sprite.x ? -1 : 1) * (DG_BOSS_SPEED * 3.4));
        } else {
          b.setVelocityX((this.player.x < u.sprite.x ? -1 : 1) * DG_BOSS_SPEED * 0.7);
        }
        u.sprite.setFlipX(this.player.x < u.sprite.x);
      } else if (u.kind === 'thrower') {
        // 远程:站住不动,进射程先抬手(变色预警)再扔举报信
        b.setVelocityX(0);
        const dx = this.player.x - u.sprite.x;
        const dy = Math.abs(this.player.y - u.sprite.y);
        u.sprite.setFlipX(dx < 0);
        if (time > u.nextActionAt && Math.abs(dx) < DG_THROWER_RANGE && dy < 240) {
          u.windupUntil = time + DG_THROWER_WINDUP_MS;
          u.nextActionAt = u.windupUntil + DG_THROWER_COOLDOWN_MS;
          u.sprite.setTint(0xffd43b);
          this.time.delayedCall(DG_THROWER_WINDUP_MS, () => {
            if (u.hp > 0 && u.sprite.active) {
              u.sprite.clearTint();
              this.throwEnemyLetter(u.sprite.x, u.sprite.y - 10, this.player.x, this.player.y - 6);
            }
          });
        }
      } else if (u.kind === 'charger') {
        // 冲锋:靠近 → 抬手预警 → 突进撞击 → 硬直
        const dx = this.player.x - u.sprite.x;
        const dist = Math.abs(dx);
        u.sprite.setFlipX(dx < 0);
        if (time < u.windupUntil) {
          b.setVelocityX(0);
        } else if (time < u.chargingUntil) {
          b.setVelocityX(u.dir * DG_CHARGER_DASH_SPEED);
        } else {
          if (dist < DG_CHARGER_TRIGGER && Math.abs(this.player.y - u.sprite.y) < 130 && time > u.nextActionAt) {
            u.dir = dx > 0 ? 1 : -1;
            u.windupUntil = time + DG_CHARGER_WINDUP_MS;
            u.chargingUntil = u.windupUntil + DG_CHARGER_DASH_MS;
            u.nextActionAt = u.chargingUntil + 800;
            u.sprite.setTint(0xff6b6b);
            this.time.delayedCall(DG_CHARGER_WINDUP_MS, () => { if (u.sprite.active) u.sprite.clearTint(); });
            playSfx(this, 'warn', 0.28);
          } else {
            if (b.blocked.left) u.dir = 1;
            if (b.blocked.right) u.dir = -1;
            b.setVelocityX(dist > 170 ? (dx > 0 ? 1 : -1) * DG_ENEMY_SPEED * 0.75 : 0);
          }
        }
      } else {
        if (b.blocked.left || u.sprite.x <= u.minX) u.dir = 1;
        if (b.blocked.right || u.sprite.x >= u.maxX) u.dir = -1;
        b.setVelocityX(u.dir * DG_ENEMY_SPEED);
        u.sprite.setFlipX(u.dir === -1);
      }
    });

    // 技能冷却指示
    if (time < this.reportReadyAt || time < this.shieldReadyAt) this.refreshMpHud();

    // 敌人掉出世界(比如冲锋兵冲进坑里):移除,避免留下僵尸单位
    this.enemies.forEach(u => {
      if (u.hp <= 0 || !u.sprite.active) return;
      if (u.sprite.y > this.parsed.heightPx + 160) {
        u.hp = 0;
        u.sprite.destroy();
        if (u.isBoss) this.refreshBossBar();
      }
    });

    // ---- 掉出世界 ----
    if (this.player.y > this.parsed.heightPx + 200) {
      this.hp = 0;
      this.refreshHeartHud();
      this.onDeath();
    }

    // ---- 出口 ----
    if (this.goalSprite) {
      const boss = this.enemies.find(e => e.isBoss);
      const bossAlive = !!boss && boss.hp > 0;
      this.goalSprite.setTint(bossAlive ? 0xff6b6b : 0xffffff);
      const near = Math.abs(this.player.x - this.goalSprite.x) < 52
        && Math.abs((this.player.y + 58) - this.goalSprite.y) < 90;
      if (near) {
        if (bossAlive) {
          if (time % 900 < 20) showToast(this, GAME_WIDTH / 2, 120, '先把巡视组长解决掉', '#ff8787', 'ui-lock');
        } else {
          this.onClear();
        }
      }
    }

    void dt;
  }
}
