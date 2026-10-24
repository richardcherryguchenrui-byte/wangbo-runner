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
  DUNGEON_LEVELS,
  boxOverlapRect,
  attackBox,
  dungeonLevelById,
  nextDungeonId,
  isDungeonUnlocked,
  parseDungeon,
  type DungeonLevelDef,
  type ParsedDungeon,
  type DGRect
} from '../systems/dungeon';

interface DGData {
  levelId?: string;
}

interface EnemyUnit {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  minX: number;
  maxX: number;
  dir: number;
  isBoss: boolean;
  nextChargeAt: number;
  chargingUntil: number;
}

const PLAYER_BODY_W = 44;
const PLAYER_BODY_H = 116;

export default class DungeonScene extends Phaser.Scene {
  private levelId = DUNGEON_LEVELS[0].id;
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
    const wanted = data?.levelId ?? '';
    const p = loadProgress();
    this.levelId = dungeonLevelById(wanted) && isDungeonUnlocked(wanted, p.dungeonCleared ?? {})
      ? wanted
      : DUNGEON_LEVELS.find(l => isDungeonUnlocked(l.id, p.dungeonCleared ?? {}))?.id ?? DUNGEON_LEVELS[0].id;
  }

  create() {
    this.over = false;
    this.cleared = false;
    this.level = dungeonLevelById(this.levelId) ?? DUNGEON_LEVELS[0];
    this.parsed = parseDungeon(this.level.map);

    this.hp = DG_PLAYER_MAX_HP;
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
    this.buildEntities();
    this.buildCamera();
    this.ui = this.add.container(0, 0).setDepth(90);
    this.uiTop = this.add.container(0, 0).setDepth(200);
    this.buildHud();
    this.buildInput();
    this.buildTouchPad();

    this.physics.world.setBounds(0, 0, this.parsed.widthPx, this.parsed.heightPx);
    startBgm(this);

    this.hudLevelText.setText(`${this.level.name}`);
    this.time.delayedCall(120, () => {
      showToast(this, GAME_WIDTH / 2, 92, this.level.subtitle, '#cfe3ff', 'ui-tips');
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
      this.hp = Math.min(DG_PLAYER_MAX_HP, this.hp + 1);
      this.refreshHeartHud();
      playSfx(this, 'hype', 0.4);
      poof(this, heart.x, heart.y, 6);
      showToast(this, GAME_WIDTH / 2, 120, '补一格血', '#8ce99a', 'ui-heart');
    });

    // 出口
    if (this.parsed.goal) {
      this.goalSprite = this.add
        .image(this.parsed.goal.x, this.parsed.goal.y - 60, 'dg-door')
        .setDepth(4)
        .setDisplaySize(84, 120);
    }

    // 敌人
    this.parsed.enemies.forEach(e => this.spawnEnemy(e.x, e.y, false));
    if (this.parsed.boss) this.spawnEnemy(this.parsed.boss.x, this.parsed.boss.y, true);
  }

  private spawnEnemy(feetX: number, feetY: number, isBoss: boolean) {
    const tex = isBoss ? 'dg-boss' : 'dg-enemy';
    const sprite = this.physics.add.sprite(feetX, feetY - (isBoss ? 62 : 32), tex).setDepth(8);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (isBoss) {
      body.setSize(72, 110, false);
      body.setOffset((sprite.width - 72) / 2, sprite.height - 110);
    } else {
      body.setSize(40, 54, false);
      body.setOffset((sprite.width - 40) / 2, sprite.height - 54);
    }
    this.physics.add.collider(sprite, this.platforms);

    const unit: EnemyUnit = {
      sprite,
      hp: isBoss ? DG_BOSS_HP : this.level.enemyHp,
      maxHp: isBoss ? DG_BOSS_HP : this.level.enemyHp,
      minX: feetX - DG_TILE * 2.4,
      maxX: feetX + DG_TILE * 2.4,
      dir: -1,
      isBoss,
      nextChargeAt: 0,
      chargingUntil: 0
    };
    this.enemies.push(unit);

    // 接触伤害
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

    for (let i = 0; i < DG_PLAYER_MAX_HP; i++) {
      const h = this.add.image(44 + i * 30, 40, 'ui-heart').setDisplaySize(22, 22);
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

    this.ui.add([hudBg, ...this.hudHearts, coinIcon, this.hudCoinText, this.hudLevelText, hintBg, this.hudHint]);
    if (this.hudBossBar) this.ui.add(this.hudBossBar);
    if (this.hudBossLabel) this.ui.add(this.hudBossLabel);

    this.refreshHeartHud();
    this.refreshCoinHud();
    this.refreshBossBar();
  }

  private refreshHeartHud() {
    this.hudHearts.forEach((h, i) => {
      h.setAlpha(i < this.hp ? 1 : 0.22);
      h.setTint(i < this.hp ? 0xffffff : 0x44546a);
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
    this.enemies.forEach(u => {
      if (u.hp <= 0) return;
      const b = u.sprite.body as Phaser.Physics.Arcade.Body;
      if (!boxOverlapRect(box, b.x, b.y, b.width, b.height)) return;
      hitAny = true;
      this.damageEnemy(u, DG_ATTACK_DAMAGE);
    });
    if (hitAny) shake(this, 0.006, 110);
  }

  private damageEnemy(u: EnemyUnit, amount: number) {
    u.hp -= amount;
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

    add(this.add
      .text(GAME_WIDTH / 2, 168, win ? '闯过去了!' : '被按住了…', {
        fontFamily: FONT, fontSize: '38px', color: win ? '#ffe066' : '#ff8787',
        fontStyle: 'bold', resolution: 2, stroke: '#08131f', strokeThickness: 6
      })
      .setOrigin(0.5));

    add(this.add
      .text(GAME_WIDTH / 2, 212, win
        ? `${this.level.name} · 拾到银币 ${this.runCoins}`
        : this.level.subtitle, {
        fontFamily: FONT, fontSize: '14px', color: '#cfe3ff', resolution: 2
      })
      .setOrigin(0.5));

    const nextId = win ? nextDungeonId(this.levelId) : null;
    const buttons: { label: string; primary?: boolean; x: number; fn: () => void }[] = [];
    if (win && nextId) {
      buttons.push({ label: '下一层', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.scene.restart({ levelId: nextId }) });
      buttons.push({ label: '重玩', x: GAME_WIDTH / 2 - 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
    } else if (win) {
      buttons.push({ label: '再走一遍', primary: true, x: GAME_WIDTH / 2 + 130, fn: () => this.scene.restart({ levelId: this.levelId }) });
      buttons.push({ label: '返回', x: GAME_WIDTH / 2 - 130, fn: () => this.leave() });
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
      .text(GAME_WIDTH / 2, 392, '提示:冲刺可以穿过攻击,落地再跳能触发二段跳', {
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
      if (left && !right) {
        body.setVelocityX(-DG_PLAYER_SPEED);
        this.facing = -1;
        this.player.setFlipX(true);
      } else if (right && !left) {
        body.setVelocityX(DG_PLAYER_SPEED);
        this.facing = 1;
        this.player.setFlipX(false);
      } else {
        body.setVelocityX(0);
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
      } else {
        if (b.blocked.left || u.sprite.x <= u.minX) u.dir = 1;
        if (b.blocked.right || u.sprite.x >= u.maxX) u.dir = -1;
        b.setVelocityX(u.dir * DG_ENEMY_SPEED);
        u.sprite.setFlipX(u.dir === -1);
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
