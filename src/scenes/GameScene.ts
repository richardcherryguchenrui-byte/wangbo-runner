import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  RUN_SPEED_BASE,
  RUN_SPEED_ACCEL,
  JUMP_SPEED,
  MIN_JUMP_SPEED,
  GRAVITY_Y,
  MAX_FALL_SPEED,
  INVULNERABLE_TIME_MS,
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  GROUND_TOP,
  GROUND_HEIGHT,
  GAP_TIME_MIN,
  GAP_TIME_MAX,
  LEVEL_DURATION_MS,
  DOUBLE_JUMP_UNLOCK_MS,
  DOUBLE_JUMP_SPEED_RATIO,
  PISTOL_BULLETS_PER_RUN,
  BULLET_SPEED,
  SHOOT_COOLDOWN_MS
} from '../config/constants';
import {
  loadProgress,
  saveProgress,
  hasPistol,
  PENDANT_EMOJI
} from '../systems/progress';
import { showToast } from '../systems/ui';

type HUDText = {
  lives: Phaser.GameObjects.Text;
  time: Phaser.GameObjects.Text;
  tip: Phaser.GameObjects.Text;
  coins: Phaser.GameObjects.Text;
  bullets: Phaser.GameObjects.Text;
};

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bobTween?: Phaser.Tweens.Tween;
  private pendantText?: Phaser.GameObjects.Text;
  private groundDetail!: Phaser.GameObjects.TileSprite;
  private obstacleGroup!: Phaser.Physics.Arcade.Group;
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private clouds: Phaser.GameObjects.Image[] = [];
  private runSpeed = RUN_SPEED_BASE;
  private hits = 0;
  private dead = false;
  private invulnerable = false;
  private lastOnGroundAt = 0;
  private lastJumpPressedAt = -10000;
  private jumpsUsed = 0;
  private doubleJumpUnlocked = false;
  private elapsedMs = 0;
  private distanceSinceSpawn = 0;
  private nextGapPx = 500;
  private hud!: HUDText;
  // 成长系统(每次开局重新加载,确保商店购买后立即生效)
  private progress = loadProgress();
  private totalLives = 2;
  private dodged = 0;
  private runCoins = 0;
  private bulletsLeft = 0;
  private canShootAt = 0;
  private fireBtn?: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private fireBtnBounds = { x: 0, y: 0, w: 0, h: 0 };

  constructor() { super('Game'); }

  create() {
    this.progress = loadProgress(); // 开局重新读档
    this.totalLives = 2 + this.progress.extraLives;
    // 关键:Phaser 场景重启复用同一个场景实例,类字段不会自动重置。
    // 必须在这里完整重置局内状态,否则上一局的死亡标记/计时会带进新一局
    // (表现为:无敌、不计费、秒进结算并重复加金币)。
    this.resetRunState();
    // 上一局死亡时 physics.pause() 冻结了物理世界(场景重启复用它),这里强制恢复
    this.physics.resume();
    this.physics.world.gravity.y = GRAVITY_Y;

    // ---- 地面 ----
    const ground = this.add
      .rectangle(GAME_WIDTH / 2, GROUND_TOP, GAME_WIDTH, GROUND_HEIGHT, 0xe8d9b8)
      .setOrigin(0.5, 0);
    this.physics.add.existing(ground, true);
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP - 1, GAME_WIDTH, 2, 0x535353).setOrigin(0.5, 0).setDepth(1);
    this.groundDetail = this.add
      .tileSprite(0, GROUND_TOP, GAME_WIDTH, GROUND_HEIGHT, 'ground-pattern')
      .setOrigin(0, 0)
      .setDepth(1);

    // ---- 云朵 ----
    for (let i = 0; i < 3; i++) {
      this.clouds.push(
        this.add.image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(40, 220), 'cloud').setDepth(0)
      );
    }

    // ---- 玩家角色(祁同伟皮肤替换贴图,碰撞箱公式通用) ----
    const skinKey = this.progress.skin === 'qitongwei' ? 'player-qi' : 'player';
    this.player = this.physics.add.sprite(120, GROUND_TOP, skinKey);
    this.player.setY(GROUND_TOP - this.player.height / 2);
    this.player.setDepth(5);
    {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const w = Math.round(this.player.width * 0.42);
      const h = Math.round(this.player.height * 0.65);
      body.setSize(w, h, false);
      body.setOffset((this.player.width - w) / 2, this.player.height - h);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(9999, MAX_FALL_SPEED);

    // 挂件(头顶表情)
    if (PENDANT_EMOJI[this.progress.pendant]) {
      this.pendantText = this.add
        .text(this.player.x, this.player.y - 72, PENDANT_EMOJI[this.progress.pendant], { fontSize: '24px' })
        .setOrigin(0.5)
        .setDepth(6);
    }
    this.startBob();

    // ---- 障碍组与子弹组 ----
    this.obstacleGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.bulletGroup = this.physics.add.group({ allowGravity: false });

    // ---- 碰撞 ----
    this.physics.add.collider(this.player, ground);
    this.physics.add.overlap(this.player, this.obstacleGroup, this.handleHit, undefined, this);
    this.physics.add.overlap(this.bulletGroup, this.obstacleGroup, this.handleBulletHit, undefined, this);

    // ---- 输入 ----
    this.input.on('pointerdown', this.onJumpInput, this);
    this.input.on('pointerup', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-SPACE', this.onJumpInput, this);
    this.input.keyboard?.on('keyup-SPACE', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-UP', this.onJumpInput, this);
    this.input.keyboard?.on('keyup-UP', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-J', this.fire, this);

    // ---- 手枪射击按钮(已解锁才显示) ----
    if (hasPistol(this.progress)) {
      this.bulletsLeft = PISTOL_BULLETS_PER_RUN;
      const btn = this.add
        .rectangle(GAME_WIDTH - 90, GROUND_TOP - 30, 130, 44, 0x1d3557, 0.85)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
        .setDepth(20);
      const label = this.add
        .text(GAME_WIDTH - 90, GROUND_TOP - 30, `🔫 射击 ×${this.bulletsLeft}`, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(21);
      btn.on('pointerdown', this.fire, this);
      this.fireBtn = { rect: btn, text: label };
      this.fireBtnBounds = { x: GAME_WIDTH - 90, y: GROUND_TOP - 30, w: 130, h: 44 };
    }

    // ---- HUD ----
    const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 4 };
    this.hud = {
      lives: this.add.text(14, 12, `生命: ${this.totalLives}`, style).setScrollFactor(0),
      time: this.add.text(GAME_WIDTH - 14, 12, '00.0s', style).setOrigin(1, 0).setScrollFactor(0),
      tip: this.add
        .text(GAME_WIDTH / 2, GROUND_TOP - 150, '点击跳跃(松手小跳)· 30秒解锁二段跳!', { ...style, fontSize: '18px' })
        .setOrigin(0.5)
        .setScrollFactor(0),
      coins: this.add.text(14, 44, '🪙 0', { ...style, fontSize: '18px' }).setScrollFactor(0),
      bullets: this.add.text(GAME_WIDTH - 14, 44, '', { ...style, fontSize: '18px' }).setOrigin(1, 0).setScrollFactor(0)
    };
    if (this.fireBtn) this.updateBulletsHud();

    // ---- 出屏回收 ----
    this.physics.world.on('worldstep', () => {
      this.obstacleGroup.getChildren().forEach(child => {
        const o = child as Phaser.Physics.Arcade.Image;
        if (o.x + o.width < -60) o.destroy();
      });
      this.bulletGroup.getChildren().forEach(child => {
        const b = child as Phaser.Physics.Arcade.Image;
        if (b.x > GAME_WIDTH + 60) b.destroy();
      });
    });
  }

  // ---- 障碍生成:金币堆 / 红包 / 财宝 / 美女×4 / 飞来的美女 ----
  private spawnObstacle() {
    const roll = Math.random();
    if (roll < 0.2) this.spawnOne('ob-gold', 0);
    else if (roll < 0.35) this.spawnOne('ob-redpacket', 0);
    else if (roll < 0.47) this.spawnOne('ob-treasure', 0);
    else if (roll < 0.59) this.spawnOne('ob-beauty-1', 0);
    else if (roll < 0.71) this.spawnOne('ob-beauty-2', 0);
    else if (roll < 0.83) this.spawnOne('ob-beauty-3', 0);
    else if (roll < 0.95) this.spawnOne('ob-beauty-4', 0);
    else this.spawnOne('ob-beauty-' + Phaser.Math.Between(1, 4), -50); // 半空飞来的美女
  }

  private spawnOne(key: string, yOffset: number) {
    const y = GROUND_TOP + yOffset;
    const o = this.physics.add.image(GAME_WIDTH + 80, y, key).setOrigin(0.5, 1);
    (o.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    o.setImmovable(true);
    this.obstacleGroup.add(o);
    // 碰撞箱:图片形状不规则,取中间 60% 宽、82% 高、底部对齐(宽容判定)
    {
      const body = o.body as Phaser.Physics.Arcade.Body;
      const w = Math.round(o.width * 0.6);
      const h = Math.round(o.height * 0.82);
      body.setSize(w, h, false);
      body.setOffset((o.width - w) / 2, o.height - h);
    }
  }

  // ---- 跳跃 ----
  // 重置本局所有状态(场景重启复用实例,必须显式归零)
  private resetRunState() {
    this.hits = 0;
    this.dead = false;
    this.invulnerable = false;
    this.elapsedMs = 0;
    this.jumpsUsed = 0;
    this.doubleJumpUnlocked = false;
    this.dodged = 0;
    this.runCoins = 0;
    this.distanceSinceSpawn = 0;
    this.nextGapPx = 500;
    this.lastOnGroundAt = 0;
    this.lastJumpPressedAt = -10000;
    this.bulletsLeft = 0;
    this.canShootAt = 0;
    this.runSpeed = RUN_SPEED_BASE;
    this.fireBtn = undefined;
    this.tweens.killAll(); // 清掉上一局遗留的闪烁/颠动补间
  }

  private onJumpInput(pointer?: Phaser.Input.Pointer) {
    // 点在射击按钮上时不触发跳跃
    if (pointer && this.fireBtn) {
      const b = this.fireBtnBounds;
      if (Math.abs(pointer.x - b.x) <= b.w / 2 && Math.abs(pointer.y - b.y) <= b.h / 2) return;
    }
    this.lastJumpPressedAt = this.time.now;
  }

  private onJumpRelease() {
    // 上升中松手 → 截断上升速度,实现短跳
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < -MIN_JUMP_SPEED) body.setVelocityY(-MIN_JUMP_SPEED);
  }

  private doJump(speed: number, isDouble: boolean) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-speed);
    this.lastJumpPressedAt = -10000;
    this.bobTween?.stop();
    this.player.setScale(1, 1);
    this.hud.tip.setVisible(false);
    if (isDouble) this.poof(this.player.x, this.player.y + this.player.height / 2, 5);
  }

  private tryJump(now: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastOnGroundAt = now;
      this.jumpsUsed = 0;
      if (this.bobTween && !this.bobTween.isPlaying()) this.startBob();
    }

    const canCoyote = now - this.lastOnGroundAt <= COYOTE_TIME_MS;
    const buffered = now - this.lastJumpPressedAt <= JUMP_BUFFER_MS;

    if (!buffered) return;
    if (onGround || canCoyote) {
      this.jumpsUsed = 1;
      this.doJump(JUMP_SPEED, false);
    } else if (this.doubleJumpUnlocked && this.jumpsUsed < 2) {
      this.jumpsUsed = 2;
      this.doJump(JUMP_SPEED * DOUBLE_JUMP_SPEED_RATIO, true);
    }
  }

  // ---- 手枪 ----
  private fire() {
    if (!this.fireBtn || this.bulletsLeft <= 0 || this.dead) return;
    if (this.time.now < this.canShootAt) return;
    this.canShootAt = this.time.now + SHOOT_COOLDOWN_MS;
    this.bulletsLeft -= 1;
    this.updateBulletsHud();
    const b = this.physics.add.image(this.player.x + 46, GROUND_TOP - 40, 'bullet');
    (b.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.bulletGroup.add(b);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityX(BULLET_SPEED);
  }

  private updateBulletsHud() {
    if (this.fireBtn) {
      this.fireBtn.text.setText(this.bulletsLeft > 0 ? `🔫 射击 ×${this.bulletsLeft}` : '🔫 子弹耗尽');
      this.hud.bullets.setText(this.bulletsLeft > 0 ? `🔫 ×${this.bulletsLeft}` : '');
    }
  }

  private handleBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bullet, obstacle) => {
    const o = obstacle as Phaser.Physics.Arcade.Image;
    const b = bullet as Phaser.Physics.Arcade.Image;
    this.explode(o.x, o.y - o.height / 2);
    o.destroy();
    b.destroy();
  };

  // 爆炸特效:闪光 + 扩散火球 + 飞溅火星
  private explode(x: number, y: number) {
    // 中央闪光(快速放大淡出)
    const flash = this.add.circle(x, y, 10, 0xfff3c4).setDepth(15);
    this.tweens.add({ targets: flash, scale: 3.2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    // 两圈扩散火球
    for (const [color, delay, size] of [[0xffb347, 0, 26], [0xff6a3d, 60, 40]] as const) {
      const ring = this.add.circle(x, y, 6, color, 0.9).setDepth(14);
      this.tweens.add({
        targets: ring, scale: size / 6, alpha: 0, duration: 320, delay,
        onComplete: () => ring.destroy()
      });
    }
    // 飞溅火星
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const d = Phaser.Math.Between(30, 70);
      const dot = this.add
        .circle(x, y, Phaser.Math.Between(3, 6), i % 2 ? 0xffd54a : 0xff6a6a)
        .setDepth(15);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * d,
        y: y + Math.sin(angle) * d,
        alpha: 0,
        duration: 380,
        onComplete: () => dot.destroy()
      });
    }
  }

  // 命中特效:爆开的小圆点
  private poof(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const c = this.add
        .circle(x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-18, 18), Phaser.Math.Between(4, 9), i % 2 ? 0xffd54a : 0xff6a6a)
        .setDepth(10);
      this.tweens.add({ targets: c, scale: 2.4, alpha: 0, duration: 280, onComplete: () => c.destroy() });
    }
  }

  // ---- 跑步颠动 ----
  private startBob() {
    this.bobTween?.stop();
    this.player.setScale(1, 1);
    this.bobTween = this.tweens.add({
      targets: this.player,
      scaleY: 1.03,
      scaleX: 0.99,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  // ---- 碰撞与死亡 ----
  private handleHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, obstacle) => {
    if (this.invulnerable || this.dead) return;
    // 撞上的障碍不算「翻越」
    (obstacle as Phaser.GameObjects.GameObject).setData('hit', true);
    this.hits += 1;
    this.updateLivesHud();

    const left = this.totalLives - this.hits;
    if (left >= 1) {
      this.enterInvulnerable();
    } else {
      this.dead = true;
      this.die();
    }
  };

  private enterInvulnerable() {
    this.invulnerable = true;
    const blink = this.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.2 },
      duration: 100,
      yoyo: true,
      repeat: -1
    });

    this.time.delayedCall(INVULNERABLE_TIME_MS, () => {
      blink.stop();
      this.player.setAlpha(1);
      this.invulnerable = false;
    });
  }

  private die() {
    this.bobTween?.stop();
    this.player.setTint(0xff6666);
    this.physics.pause();
    this.time.delayedCall(500, () => this.endRun(false));
  }

  private updateLivesHud() {
    const left = Math.max(0, this.totalLives - this.hits);
    this.hud.lives.setText(left === 1 ? '生命: 1(已双规)' : `生命: ${left}`);
  }

  // ---- 结算与存档 ----
  private endRun(win: boolean) {
    const winBonus = win ? 5 : 0;
    this.progress.coins += this.runCoins + winBonus;
    this.progress.totalDodged += this.dodged;
    saveProgress(this.progress);
    try {
      const prev = Number(localStorage.getItem('bestTimeMs') || '0');
      if (!prev || this.elapsedMs > prev) {
        localStorage.setItem('bestTimeMs', String(Math.round(this.elapsedMs)));
      }
    } catch {}
    this.scene.start('Result', { timeMs: this.elapsedMs, win, dodged: this.dodged, coins: this.runCoins + winBonus });
  }

  update(time: number, delta: number) {
    this.elapsedMs += delta;

    // 撑满一关时长即晋升成功
    if (this.elapsedMs >= LEVEL_DURATION_MS) {
      this.endRun(true);
      return;
    }

    // 二段跳解锁:存活 30 秒
    if (!this.doubleJumpUnlocked && this.elapsedMs >= DOUBLE_JUMP_UNLOCK_MS) {
      this.doubleJumpUnlocked = true;
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 200, '✨ 二段跳解锁!空中可再跳一次');
    }

    // 速度曲线(放缓:每 10 秒 +30 px/s);被撞无敌期间减速
    this.runSpeed = this.invulnerable
      ? RUN_SPEED_BASE * 0.7
      : RUN_SPEED_BASE + this.elapsedMs * RUN_SPEED_ACCEL;

    // 障碍移动
    this.obstacleGroup.getChildren().forEach(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      const body = o.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(-this.runSpeed);
    });

    // 按间距生成障碍
    this.distanceSinceSpawn += (this.runSpeed * delta) / 1000;
    if (this.distanceSinceSpawn >= this.nextGapPx) {
      this.spawnObstacle();
      this.distanceSinceSpawn = 0;
      const gapTime = Phaser.Math.FloatBetween(GAP_TIME_MIN, GAP_TIME_MAX);
      this.nextGapPx = this.runSpeed * gapTime;
    }

    // 翻越计数:障碍完全越过玩家 + 金币奖励
    if (!this.dead) {
      this.obstacleGroup.getChildren().forEach(child => {
        const o = child as Phaser.Physics.Arcade.Image;
        if (!o.getData('counted') && !o.getData('hit') && o.x + o.width < this.player.x - 14) {
          o.setData('counted', true);
          this.dodged += 1;
          this.runCoins += 1;
          this.hud.coins.setText(`🪙 ${this.runCoins}`);
          const t = this.add
            .text(this.player.x + 30, this.player.y - 70, '+1🪙', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe066', stroke: '#1d3557', strokeThickness: 3 })
            .setOrigin(0.5)
            .setDepth(20);
          this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 650, onComplete: () => t.destroy() });
        }
      });
    }

    // 地面花纹滚动 + 云朵视差
    this.groundDetail.tilePositionX -= (this.runSpeed * delta) / 1000;
    this.clouds.forEach(c => {
      c.x -= (this.runSpeed * 0.15 * delta) / 1000;
      if (c.x < -60) c.x = GAME_WIDTH + 60;
    });

    // 挂件跟随
    if (this.pendantText) this.pendantText.setPosition(this.player.x, this.player.y - 74);

    this.tryJump(time);

    this.hud.time.setText(`${(this.elapsedMs / 1000).toFixed(1)}s`);
  }
}
