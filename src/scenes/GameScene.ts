import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  RUN_SPEED_BASE,
  RUN_SPEED_STEP,
  JUMP_SPEED,
  GRAVITY_Y,
  INVULNERABLE_TIME_MS,
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  OBSTACLE_GAP_MIN,
  OBSTACLE_GAP_MAX,
  SPAWN_INTERVAL_MS,
  PLAYER_DISPLAY_HEIGHT,
  PLAYER_HITBOX_SIZE,
  LEVEL_DURATION_MS
} from '../config/constants';

type HUDText = { lives: Phaser.GameObjects.Text; time: Phaser.GameObjects.Text; tip: Phaser.GameObjects.Text };

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup;
  private obstacleGroup!: Phaser.Physics.Arcade.Group;
  private runSpeed = RUN_SPEED_BASE;
  private hits = 0;
  private invulnerable = false;
  private lastOnGroundAt = 0;
  private lastJumpPressedAt = -10000;
  private elapsedMs = 0;
  private hud!: HUDText;

  constructor() { super('Game'); }

  create() {
    this.physics.world.gravity.y = GRAVITY_Y;

    const groundY = GAME_HEIGHT - 24;

    // ground tiles
    this.groundGroup = this.physics.add.staticGroup();
    for (let x = 0; x < GAME_WIDTH + 16; x += 16) {
      const tile = this.add.image(x, groundY, 'ground').setOrigin(0, 0);
      this.physics.add.existing(tile, true);
      this.groundGroup.add(tile);
    }

    // player：用原图，按目标显示高度缩放
    this.player = this.physics.add.sprite(64, groundY, 'player');
    const targetH = PLAYER_DISPLAY_HEIGHT;
    const scale = targetH / this.player.height;
    this.player.setScale(scale);
    this.player.setY(groundY - this.player.height / 2);
    // 缩小玩家碰撞箱：与障碍物接近大小，并将碰撞箱贴底对齐
    {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const hitW = PLAYER_HITBOX_SIZE;
      const hitH = PLAYER_HITBOX_SIZE;
      body.setSize(hitW, hitH, false);
      body.setOffset((this.player.width - hitW) / 2, this.player.height - hitH);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(999, 700);
    this.player.setDepth(5);

    // obstacles
    this.obstacleGroup = this.physics.add.group({ allowGravity: false, immovable: true });

    // collisions
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.overlap(this.player, this.obstacleGroup, this.handleHit, undefined, this);

    // input
    this.input.on('pointerdown', this.onJumpInput, this);
    this.input.keyboard?.on('keydown-SPACE', this.onJumpInput, this);

    // spawner
    this.time.addEvent({
      delay: SPAWN_INTERVAL_MS,
      loop: true,
      callback: () => this.spawnObstacle(groundY)
    });

    // HUD
    this.hud = {
      lives: this.add
        .text(8, 6, '生命: 2', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
        .setScrollFactor(0),
      time: this.add
        .text(GAME_WIDTH - 8, 6, '00.0s', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
        .setOrigin(1, 0)
        .setScrollFactor(0),
      tip: this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, '点击屏幕跳跃 · 撑过60秒晋升!', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 2 })
        .setOrigin(0.5)
        .setScrollFactor(0)
    };

    // cleanup
    this.physics.world.on('worldstep', () => {
      this.obstacleGroup.getChildren().forEach(child => {
        const o = child as Phaser.Physics.Arcade.Image;
        if (o.x + o.width < 0) o.destroy();
      });
    });
  }

  private spawnObstacle(groundY: number) {
    const gap = Phaser.Math.Between(OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX);
    const x = GAME_WIDTH + gap;
    const y = groundY - 16;
    const o = this.physics.add.image(x, y, 'obstacle').setOrigin(0, 0);
    o.setImmovable(true);
    (o.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.obstacleGroup.add(o);
    (o.body as Phaser.Physics.Arcade.Body).setVelocityX(-this.runSpeed);
  }

  private onJumpInput() {
    const now = this.time.now;
    this.lastJumpPressedAt = now;
  }

  private tryJump(now: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.lastOnGroundAt = now;

    const canCoyote = now - this.lastOnGroundAt <= COYOTE_TIME_MS;
    const buffered = now - this.lastJumpPressedAt <= JUMP_BUFFER_MS;

    if (buffered && (onGround || canCoyote)) {
      body.setVelocityY(-JUMP_SPEED);
      this.lastJumpPressedAt = -10000;
      this.hud.tip.setVisible(false);
    }
  }

  private handleHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = () => {
    if (this.invulnerable) return;
    this.hits += 1;
    this.updateLivesHud();

    if (this.hits === 1) {
      this.enterInvulnerable();
    } else {
      this.endRun(false);
    }
  };

  private enterInvulnerable() {
    this.invulnerable = true;
    const originalSpeed = this.runSpeed;
    this.runSpeed = Math.max(60, Math.floor(originalSpeed * 0.7));
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
      this.runSpeed = originalSpeed;
    });
  }

  private updateLivesHud() {
    const left = Math.max(0, 2 - this.hits);
    this.hud.lives.setText(left === 1 ? '生命: 1（已双规）' : `生命: ${left}`);
  }

  // 结束本局：win=true 表示撑满 60 秒晋升成功，false 表示被抓
  private endRun(win: boolean) {
    try {
      const prev = Number(localStorage.getItem('bestTimeMs') || '0');
      // 生存类游戏：活得越久越好，取最大值
      if (!prev || this.elapsedMs > prev) {
        localStorage.setItem('bestTimeMs', String(Math.round(this.elapsedMs)));
      }
    } catch {}
    this.scene.start('Result', { timeMs: this.elapsedMs, win });
  }

  update(time: number, delta: number) {
    this.elapsedMs += delta;

    // 撑满一关时长即晋升成功
    if (this.elapsedMs >= LEVEL_DURATION_MS) {
      this.endRun(true);
      return;
    }

    if (!this.invulnerable) {
      this.runSpeed = RUN_SPEED_BASE + Math.floor(this.elapsedMs / 10000) * RUN_SPEED_STEP;
    }

    this.obstacleGroup.getChildren().forEach(child => {
      const body = (child as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(-this.runSpeed);
    });

    this.tryJump(time);

    this.hud.time.setText(`${(this.elapsedMs / 1000).toFixed(1)}s`);
  }
}


