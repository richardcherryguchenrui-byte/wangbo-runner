import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  RUN_SPEED_BASE,
  RUN_SPEED_ACCEL,
  RUN_SPEED_MAX,
  JUMP_SPEED,
  MIN_JUMP_SPEED,
  GRAVITY_Y,
  MAX_FALL_SPEED,
  INVULNERABLE_TIME_MS,
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  GROUND_TOP,
  GROUND_HEIGHT,
  DOUBLE_JUMP_UNLOCK_MS,
  DOUBLE_JUMP_SPEED_RATIO,
  BULLET_SPEED,
  SHOOT_COOLDOWN_MS,
  FLYER_COIN_BONUS,
  COMBO_TIER_1,
  COMBO_TIER_2,
  PICKUP_COIN_BONUS,
  PICKUP_SHIELD_MS,
  PICKUP_DOUBLE_MS,
  PICKUP_SLOW_MS,
  PICKUP_SLOW_FACTOR,
  PICKUP_Y,
  INSPECTION_FIRST_MS,
  INSPECTION_MIN_GAP_MS,
  INSPECTION_MAX_GAP_MS,
  INSPECTION_DURATION_MS,
  INSPECTION_SPAWN_FACTOR,
  INSPECTION_REWARD,
  DAY_DUSK_MS,
  DAY_NIGHT_MS,
  DAY_DEEP_MS,
  BGM2_SWITCH_MS,
  FLYER_WARN_MS,
  SLIDE_DURATION_MS,
  SLIDE_COOLDOWN_MS,
  SLIDE_BODY_HEIGHT,
  PERFECT_SLIDE_COINS,
  PERFECT_SLIDE_HYPE,
  NEAR_MISS_DISTANCE,
  LEVEL_OVERTIME_MS,
  NEAR_MISS_COINS,
  NEAR_MISS_HYPE,
  HYPE_MAX,
  HYPE_PER_DODGE,
  HYPE_PER_COIN,
  HYPE_PER_PICKUP,
  HYPE_PER_KILL,
  HYPE_HIT_PENALTY,
  OVERDRIVE_MS,
  OVERDRIVE_SPEED_MULT,
  OVERDRIVE_COIN_MULT,
  WORLD_COIN_VALUE
} from '../config/constants';
import {
  loadProgress,
  saveProgress,
  hasPistol,
  bulletsPerRun,
  bribeCarryLimit,
  PENDANT_TEXTURE
} from '../systems/progress';
import { addPanel, drawBar, showToast, FONT } from '../systems/ui';
import { startBgm, playSfx, crossfadeToBgm2, pauseBgm, resumeBgm } from '../systems/audio';
import { ensureSkinTextures, playerFrameKey } from '../systems/skins';
import {
  explode,
  poof,
  dust,
  shake,
  redFlash,
  alarmPulse,
  rankBurst,
  coinPop,
  nearMissStreak,
  windStreak,
  confettiBurst,
  impactBurst
} from '../systems/effects';
import { claimNewAchievements } from '../systems/achievements';
import { updateDailyFromRun } from '../systems/daily';
import { isWx, wxVibrate, wxShare, wxUploadBestScore } from '../systems/wxapi';
import { rankAt, rankProgress, RUN_RANKS, type RunRank } from '../systems/ranks';
import {
  pickRunMission,
  missionProgressText,
  missionDone,
  missionValue,
  type RunMission,
  type MissionState
} from '../systems/missions';
import { generatePattern, FLYER_Y, type RunPattern } from '../systems/patterns';
import { tightSlideIndex, clutchIndex } from '../systems/slideJudge';
import { loadControls, type ControlSettings } from '../systems/controls';
import { assetPerks, EMPTY_PERKS, type AssetPerks } from '../systems/assets';
import {
  levelById,
  levelSpeedAt,
  starCount,
  goalValue,
  remainingMs,
  levelReward,
  nextLevelId,
  totalStars,
  newlyReachedMilestones,
  clearLine,
  landfallLine,
  chapterMoodAt,
  type LevelDef,
  type LevelStats
} from '../systems/levels';
import {
  getDailyChallenge,
  recordDailyRun,
  mulberry32,
  dailyModifierIcon,
  type DailyChallenge
} from '../systems/dailyChallenge';

interface GameData {
  daily?: boolean;
  /** 闯关模式:指定关卡 id(不带则进无尽模式) */
  levelId?: string;
}

interface HudButton {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
  icon?: Phaser.GameObjects.Image;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Hud {
  lives: Phaser.GameObjects.Text;
  coins: Phaser.GameObjects.Text;
  rank: Phaser.GameObjects.Text;
  time: Phaser.GameObjects.Text;
  best: Phaser.GameObjects.Text;
  combo: Phaser.GameObjects.Text;
  comboIcon: Phaser.GameObjects.Image;
  comboBg: Phaser.GameObjects.Graphics;
  chips: Phaser.GameObjects.Text;
  missionTitle: Phaser.GameObjects.Text;
  missionDesc: Phaser.GameObjects.Text;
  missionIcon: Phaser.GameObjects.Image;
  hypeLabel: Phaser.GameObjects.Text;
  daily: Phaser.GameObjects.Text;
  dailyIcon: Phaser.GameObjects.Image;
  rankBar: Phaser.GameObjects.Graphics;
  hypeBar: Phaser.GameObjects.Graphics;
  missionBar: Phaser.GameObjects.Graphics;
}

type PickupKind = 'coin' | 'shield' | 'double' | 'slow' | 'hype';

// 微信 onHide 钩子只注册一次(场景重启会复用实例,不能重复注册)
let wxHideHooked = false;

export default class GameScene extends Phaser.Scene {
  // ---- 平台与成长 ----
  private progress = loadProgress();
  private totalLives = 2;
  private bribeCarried = 0;
  private shieldActive = false;
  private daily = false;
  private challenge: DailyChallenge | null = null;
  private rng: () => number = () => Math.random();
  private dailySpeedMul = 1;
  private dailyCoinMul = 1;
  private assetPerks: AssetPerks = EMPTY_PERKS;

  // ---- 闯关模式 ----
  private level?: LevelDef;
  private levelFinishing = false;   // 通关演出中:世界停下等结算
  private runPerfectSlides = 0;

  // ---- 玩家 ----
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private useQiSkin = false;
  private baseScale = 1;
  private frameW = 89;
  private frameH = 128;
  private playerTex = (n: string) => `player-${n}`;
  private shareTexture = 'player-idle';
  private bobTween?: Phaser.Tweens.Tween;
  private pendantIcon?: Phaser.GameObjects.Image;
  private shieldRing!: Phaser.GameObjects.Image;
  private hypeAura!: Phaser.GameObjects.Image;
  private airborne = false;
  private runDustAcc = 0;

  // ---- 场景对象 ----
  private obstacleGroup!: Phaser.Physics.Arcade.Group;
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private pickupGroup!: Phaser.Physics.Arcade.Group;
  private coinGroup!: Phaser.Physics.Arcade.Group;
  private groundRect!: Phaser.GameObjects.Rectangle;
  private groundDetail!: Phaser.GameObjects.TileSprite;
  private mountains!: Phaser.GameObjects.TileSprite;
  private cityFar!: Phaser.GameObjects.TileSprite;
  private cityNear!: Phaser.GameObjects.TileSprite;
  private skyRect!: Phaser.GameObjects.Rectangle;
  private skyShade!: Phaser.GameObjects.Image;
  private sunRays!: Phaser.GameObjects.Image;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private goldOverlay!: Phaser.GameObjects.Rectangle;
  private inspectionOverlay!: Phaser.GameObjects.Rectangle;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private stars: { dot: Phaser.GameObjects.Rectangle; phase: number }[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private papers: { g: Phaser.GameObjects.Rectangle; speed: number; spin: number; sway: number; baseAlpha: number }[] = [];
  private landmarks: Phaser.GameObjects.Image[] = [];
  private landmarkNeons: Phaser.GameObjects.Image[] = [];

  // ---- 本局状态 ----
  private runSpeed = RUN_SPEED_BASE;
  private hits = 0;
  private dead = false;
  private ended = false;
  private invulnerable = false;
  private elapsedMs = 0;
  private distanceSinceSpawn = 0;
  private nextGapPx = 540;
  private lastPattern = '';
  private actionStreak = 0;
  private dodged = 0;
  private runCoins = 0;
  private runKills = 0;
  private runPickups = 0;
  private runNearMisses = 0;
  private runInspections = 0;
  private combo = 0;
  private comboMax = 0;
  private lastOnGroundAt = 0;
  private lastJumpPressedAt = -10000;
  private jumpsUsed = 0;
  private doubleJumpUnlocked = false;
  private bgm2Switched = false;
  private nightness = 0;
  private timeSinceHitMs = 0;

  // ---- 滑铲 ----
  private sliding = false;
  private slideUntil = 0;
  private slideCooldownUntil = 0;
  private slideQueued = false;
  private slideId = 0; // 本次滑铲编号:完美滑铲只认「起滑瞬间卡点」的那一次
  private jumpId = 0;  // 本次起跳编号:擦身只认「贴脸那一瞬起跳/起滑」的那一次
  private overtimeMs = 0;      // 本局已拿到的加时
  private overtimeUsed = false;

  // ---- 虚拟按键(触屏) ----
  private controls: ControlSettings = { virtualButtons: false };
  private padJumpBounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private padSlideBounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };

  // ---- 气势 / 高光 ----
  private hype = 0;
  private overdriveActive = false;
  private overdriveUntil = 0;
  private overdriveCount = 0;
  private lastWindAt = 0;
  private lastFlyerWarnAt = 0;
  private speedLineAcc = 0;
  private bestAtStart = 0;
  private recordBroken = false;
  private hitFreezeUntil = 0;

  // ---- 官阶 / 考核 ----
  private rank: RunRank = RUN_RANKS[0];
  private mission!: RunMission;
  private missionCompleted = false;
  private missionsCompleted = 0;
  private lastMissionTick = 0;

  // ---- 道具与增益 ----
  private bulletsLeft = 0;
  private canShootAt = 0;
  private nextPickupAt = 9000;
  private tempShieldUntil = 0;
  private doubleCoinsUntil = 0;
  private slowUntil = 0;

  // ---- 巡视 ----
  private inspectionActive = false;
  private inspectionUntil = 0;
  private nextInspectionAt = INSPECTION_FIRST_MS;
  private patrolDrone?: Phaser.GameObjects.Image;
  private searchlight?: Phaser.GameObjects.Image;
  private searchlightPool?: Phaser.GameObjects.Image;

  // ---- HUD ----
  private hud!: Hud;
  private heartIcon?: Phaser.GameObjects.Image;
  private rankIcon?: Phaser.GameObjects.Image;
  private fireBtn?: HudButton;
  private fireBounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private shieldBtn?: HudButton;
  private shieldBounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private pauseBtn!: HudButton;
  private pauseBounds: Bounds = { x: 0, y: 0, w: 0, h: 0 };

  // ---- 暂停 / 引导 / 复活 ----
  private paused = false;
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];
  private tutorialStep = -1;
  private tutorialObjects: Phaser.GameObjects.GameObject[] = [];
  private reviveUsed = false;
  private reviveObjects: Phaser.GameObjects.GameObject[] = [];
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartAt = 0;
  private swipeTriggered = false;

  constructor() {
    super('Game');
  }

  init(data: GameData) {
    this.daily = !!data?.daily;
    this.level = data?.levelId ? levelById(data.levelId) : undefined;
    if (this.daily) {
      this.challenge = getDailyChallenge();
      this.rng = mulberry32(this.challenge.seed);
    } else {
      this.challenge = null;
      this.rng = () => Math.random();
    }
  }

  create() {
    this.progress = loadProgress();
    this.dailySpeedMul = this.daily ? this.challenge?.modifier.speedMul ?? 1 : 1;
    this.dailyCoinMul = this.daily ? this.challenge?.modifier.coinMul ?? 1 : 1;
    const livesDelta = this.daily ? this.challenge?.modifier.livesDelta ?? 0 : 0;
    // 宽大处理:在留置室交代成功后攒下的额度,本局换成额外乌纱帽
    const redeemed = Math.max(0, Math.min(3, this.progress.redeemBonus ?? 0));
    if (redeemed > 0 && this.level) {
      this.progress.redeemBonus = 0;
      saveProgress(this.progress);
    }
    // 贪污资产的加成:别墅给乌纱帽,公司给银币倍率
    this.assetPerks = assetPerks({
      assets: this.progress.assets ?? {},
      network: this.progress.network ?? {},
      laundered: this.progress.laundered ?? 0
    });
    const redeemLives = this.level ? redeemed : 0;
    this.totalLives = Math.max(
      1,
      2 + this.progress.extraLives + livesDelta + redeemLives + this.assetPerks.extraLives
    );
    this.bribeCarried = Math.min(this.progress.bribeMoon, bribeCarryLimit(this.progress));

    // 场景重启复用实例:所有局内字段必须完整重置
    this.resetRunState();
    this.controls = loadControls();
    this.physics.resume();
    this.physics.world.gravity.y = GRAVITY_Y;
    this.tweens.resumeAll();
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(260, 8, 18, 34);

    this.buildBackdrop();
    this.buildGround();
    this.buildPlayer();
    this.buildGroups();
    this.buildCollisions();
    this.buildHud();
    this.buildButtons();
    this.buildInput();
    this.buildTouchPad();
    this.setupLifecycle();

    this.mission = pickRunMission(this.progress, this.rng);
    // 关卡模式:巡视组按关卡配置来袭;无尽/每日按默认节奏
    this.nextInspectionAt =
      this.level?.bossAtMs ??
      (this.daily && this.challenge?.modifier.inspectionFast ? 15000 : INSPECTION_FIRST_MS);
    this.refreshLevelHud();
    this.refreshRankHud(true);
    this.refreshLivesHud();

    if (this.daily && this.challenge) {
      this.hud.daily.setText(`每日 · ${this.challenge.modifier.name}`);
      this.hud.daily.setVisible(true);
      this.hud.dailyIcon.setTexture(dailyModifierIcon(this.challenge.modifier.id));
      this.hud.dailyIcon.setVisible(true);
    }

    startBgm(this);

    // 关卡模式只有第一关弹新手引导,免得每关都来一遍
    const needTutorial = !this.progress.tutorialDone && (!this.level || this.level.id === 'l1-1');
    if (needTutorial) {
      this.tutorialStep = 0;
      this.physics.pause();
      this.showTutorial();
    } else {
      this.announceStart();
    }
  }

  // ============================================================
  // 闯关模式
  // ============================================================

  private levelStats(cleared: boolean): LevelStats {
    return {
      cleared,
      timeMs: Math.round(this.elapsedMs),
      dodged: this.dodged,
      nearMisses: this.runNearMisses,
      perfectSlides: this.runPerfectSlides,
      comboMax: this.comboMax,
      hits: this.hits,
      coins: this.runCoins
    };
  }

  private levelGoalText(): string {
    if (!this.level) return '';
    const stats = this.levelStats(false);
    return this.level.goals
      .map(g => `${g.label} ${Math.min(goalValue(g, stats), g.target)}/${g.target}`)
      .join(' · ');
  }

  private refreshLevelHud() {
    if (!this.level) {
      this.hud.missionTitle.setText(this.mission.title);
      this.hud.missionIcon.setTexture(`mi-${this.mission.id}`);
      this.hud.missionDesc.setText(`0/${this.mission.target}${this.mission.unit} · 完成 +${this.mission.reward} 银币`);
      return;
    }
    this.hud.missionTitle.setText(this.level.name);
    this.hud.missionIcon.setTexture('mi-survive');
    this.hud.missionDesc.setText(this.levelGoalText());
  }

  // 活到关卡时长 = 通关:停世界、放演出,再结算
  private finishLevel() {
    if (!this.level || this.levelFinishing) return;
    this.levelFinishing = true;
    this.player.setVelocity(0, 0);
    this.physics.pause();
    this.hud.combo.setVisible(false);
    this.hud.comboBg.setVisible(false);
    this.showBanner('仕途通关!', '#ffe066', 44, 'ui-rank');
    confettiBurst(this, GAME_WIDTH / 2, 150, 40);
    playSfx(this, 'promote', 0.6);
    wxVibrate('medium');
    this.time.delayedCall(1400, () => this.endRun(true));
  }

  // ============================================================
  // 背景与舞台
  // ============================================================

  private buildBackdrop() {
    this.skyRect = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x5ec8f8)
      .setOrigin(0)
      .setDepth(-20);
    this.skyShade = this.add.image(0, 0, 'sky-depth').setOrigin(0).setDepth(-19).setAlpha(0.95);

    // 太阳与月亮:昼夜循环里交叉淡入
    this.sun = this.add.image(790, 94, 'sun').setDepth(-18).setAlpha(0.95).setScale(1.04);
    this.sunRays = this.add
      .image(790, 94, 'sun-rays')
      .setDepth(-17)
      .setAlpha(0.32)
      .setScale(0.92)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.sunRays, angle: 360, duration: 90000, repeat: -1 });
    this.moon = this.add.image(836, 122, 'moon').setDepth(-18).setAlpha(0).setScale(0.92);
    this.tweens.add({
      targets: this.sun,
      scale: 1.1,
      alpha: 0.7,
      duration: 3600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    this.mountains = this.add
      .tileSprite(0, GROUND_TOP - 196, GAME_WIDTH, 190, 'bg-mountains')
      .setOrigin(0, 0)
      .setDepth(-15)
      .setAlpha(0.95);
    this.cityFar = this.add
      .tileSprite(0, GROUND_TOP - 168, GAME_WIDTH, 190, 'bg-city-far')
      .setOrigin(0, 0)
      .setDepth(-13)
      .setAlpha(0.96);
    this.cityNear = this.add
      .tileSprite(0, GROUND_TOP - 152, GAME_WIDTH, 200, 'bg-city-near')
      .setOrigin(0, 0)
      .setDepth(-11);

    // 城市地标:固定 4 座,按同一视差速度循环,打破楼群贴图的重复感
    this.landmarks = [];
    this.landmarkNeons = [];
    const landmarkDefs: { key: string; x: number; scale: number; alpha: number }[] = [
      { key: 'bg-tower', x: 260, scale: 1.02, alpha: 0.9 },
      { key: 'bg-wheel', x: 700, scale: 0.94, alpha: 0.86 },
      { key: 'bg-hotel', x: 1100, scale: 0.9, alpha: 0.86 },
      { key: 'bg-tower', x: 1460, scale: 0.74, alpha: 0.8 }
    ];
    for (const d of landmarkDefs) {
      const img = this.add
        .image(d.x, GROUND_TOP + 4, d.key)
        .setOrigin(0.5, 1)
        .setScale(d.scale)
        .setDepth(-12)
        .setAlpha(d.alpha);
      this.landmarks.push(img);
      // 夜景霓虹层:只在夜间淡入,让地标从深蓝楼群里跳出来
      const neon = this.add
        .image(d.x, GROUND_TOP + 4, `${d.key}-neon`)
        .setOrigin(0.5, 1)
        .setScale(d.scale)
        .setDepth(-11.6)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.landmarkNeons.push(neon);
    }

    // 星星
    for (let i = 0; i < 28; i++) {
      const dot = this.add
        .rectangle(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(12, 300), 2, 2, 0xffffff, 0)
        .setDepth(-16);
      this.stars.push({ dot, phase: i * 1.73 });
    }

    // 云
    for (let i = 0; i < 6; i++) {
      const y = 48 + i * 37 + (i % 2) * 16;
      const baseAlpha = Phaser.Math.FloatBetween(0.5, 0.88);
      const cloud = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), y, 'cloud')
        .setDepth(-14)
        .setScale(Phaser.Math.FloatBetween(0.55, 1.15))
        .setAlpha(baseAlpha);
      cloud.setData('baseAlpha', baseAlpha);
      this.clouds.push(cloud);
    }

    // 空中飘过的文件/纸屑:增加速度感与城市层次
    for (let i = 0; i < 14; i++) {
      const w = Phaser.Math.Between(6, 14);
      const h = Phaser.Math.Between(3, 7);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.2);
      const paper = this.add
        .rectangle(
          Phaser.Math.Between(0, GAME_WIDTH),
          Phaser.Math.Between(90, 390),
          w,
          h,
          i % 3 === 0 ? 0xffd43b : 0xffffff,
          alpha
        )
        .setAngle(Phaser.Math.Between(0, 180))
        .setDepth(2);
      this.papers.push({
        g: paper,
        speed: Phaser.Math.FloatBetween(0.12, 0.32),
        spin: Phaser.Math.FloatBetween(-28, 28),
        sway: Phaser.Math.FloatBetween(0, Math.PI * 2),
        baseAlpha: alpha
      });
    }

    // 夜色滤镜、高光滤镜、巡视警报滤镜
    this.nightOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b1c3d, 0)
      .setOrigin(0)
      .setDepth(44);
    this.goldOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffc400, 0)
      .setOrigin(0)
      .setDepth(45)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.inspectionOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff2222, 0)
      .setOrigin(0)
      .setDepth(46);

    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(50).setAlpha(0.9);
  }

  private buildGround() {
    this.groundRect = this.add
      .rectangle(GAME_WIDTH / 2, GROUND_TOP, GAME_WIDTH, GROUND_HEIGHT, 0x233247)
      .setOrigin(0.5, 0);
    this.physics.add.existing(this.groundRect, true);
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP, GAME_WIDTH, 3, 0xffd43b, 0.48).setOrigin(0.5, 0).setDepth(1);
    this.groundDetail = this.add
      .tileSprite(0, GROUND_TOP + 4, GAME_WIDTH, GROUND_HEIGHT - 4, 'ground-pattern')
      .setOrigin(0, 0)
      .setDepth(1)
      .setAlpha(0.42);
    // 地面下沿的一排暗色方块,让舞台更稳
    for (let x = 0; x < GAME_WIDTH; x += 48) {
      this.add.rectangle(x + 24, GAME_HEIGHT - 3, 30, 5, 0xffffff, 0.04).setDepth(1);
    }
    this.physics.world.setBounds(0, -400, GAME_WIDTH, GAME_HEIGHT + 400);
  }

  private buildPlayer() {
    this.useQiSkin = this.progress.skin === 'qitongwei';
    const skin = this.useQiSkin ? '' : this.progress.skin;
    if (skin) ensureSkinTextures(this, skin);
    this.playerTex = (n: string) => playerFrameKey(this, skin, n);

    this.baseScale = this.useQiSkin ? 1.28 : 1;
    const idleKey = this.useQiSkin ? 'player-qi' : this.playerTex('idle');
    this.shareTexture = idleKey;
    this.player = this.physics.add.sprite(118, GROUND_TOP, this.useQiSkin ? 'player-qi' : this.playerTex('run-1'));
    this.player.setScale(this.baseScale);
    this.player.setY(GROUND_TOP - (this.player.height * this.baseScale) / 2);
    this.player.setDepth(6);
    this.frameW = this.player.width;
    this.frameH = this.player.height;
    this.applyStandingBody();
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(9999, MAX_FALL_SPEED);

    if (!this.useQiSkin) {
      this.anims.remove('player-run');
      this.anims.create({
        key: 'player-run',
        frames: [
          { key: this.playerTex('idle') },
          { key: this.playerTex('run-1') },
          { key: this.playerTex('run-2') },
          { key: this.playerTex('run-1') }
        ],
        frameRate: 10,
        repeat: -1
      });
      this.player.play('player-run');
      this.player.on('animationupdate', () => this.recenterBodyX());
      this.startBob();
    } else {
      this.startBob();
    }

    this.playerShadow = this.add
      .image(this.player.x + 4, GROUND_TOP + 2, 'shadow')
      .setDepth(4)
      .setScale(1.1, 0.8)
      .setAlpha(0.72);

    const pendantTex = PENDANT_TEXTURE[this.progress.pendant];
    if (pendantTex) {
      this.pendantIcon = this.add
        .image(this.player.x, this.player.y - 74, pendantTex)
        .setDisplaySize(26, 26)
        .setDepth(7);
    }

    this.shieldRing = this.add
      .image(this.player.x, GROUND_TOP - 4, 'shield-ring')
      .setDepth(5)
      .setTint(0xffd43b)
      .setVisible(false);

    // 气势光环:只在气势过半后淡入,给玩家一个「快满了」的体感提示
    this.hypeAura = this.add
      .image(this.player.x, this.player.y, 'hype-aura')
      .setDepth(5)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private buildGroups() {
    this.obstacleGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.bulletGroup = this.physics.add.group({ allowGravity: false });
    this.pickupGroup = this.physics.add.group({ allowGravity: false });
    this.coinGroup = this.physics.add.group({ allowGravity: false });
  }

  private buildCollisions() {
    this.physics.add.collider(this.player, this.groundRect);
    this.physics.add.overlap(this.player, this.obstacleGroup, this.handleHit, undefined, this);
    this.physics.add.overlap(this.bulletGroup, this.obstacleGroup, this.handleBulletHit, undefined, this);
    this.physics.add.overlap(this.player, this.pickupGroup, this.handlePickup, undefined, this);
    this.physics.add.overlap(this.player, this.coinGroup, this.handleCoin, undefined, this);
  }
  // ============================================================
  // HUD 与按钮
  // ============================================================

  private buildHud() {
    addPanel(this, 12, 10, 338, 82, { fill: 0x09182c, fillAlpha: 0.98, radius: 16 }).setDepth(80);
    const style = {
      fontFamily: FONT,
      fontSize: '18px',
      color: '#ffffff',
      resolution: 2,
      stroke: '#08131f',
      strokeThickness: 4
    };
    this.hud = {
      lives: this.add.text(50, 20, '', { ...style, fontStyle: 'bold' }).setDepth(81),
      coins: this.add.text(154, 20, '', { ...style, fontStyle: 'bold' }).setDepth(81),
      rank: this.add.text(48, 47, '', { ...style, fontSize: '15px', color: '#ffe066', fontStyle: 'bold' }).setDepth(81),
      time: this.add
        .text(GAME_WIDTH / 2, 13, '00.0s', {
          fontFamily: FONT, fontSize: '27px', color: '#ffffff', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 6
        })
        .setOrigin(0.5, 0)
        .setDepth(81),
      best: this.add
        .text(GAME_WIDTH - 14, 54, '', {
          fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setOrigin(1, 0)
        .setDepth(81),
      comboBg: this.add.graphics().setDepth(80).setVisible(false),
      combo: this.add
        .text(GAME_WIDTH / 2, 91, '', {
          fontFamily: FONT, fontSize: '20px', color: '#ffe066', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 5
        })
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(81),
      comboIcon: this.add
        .image(GAME_WIDTH / 2, 91, 'mi-combo')
        .setDisplaySize(18, 18)
        .setVisible(false)
        .setDepth(81),
      chips: this.add
        .text(GAME_WIDTH / 2, 118, '', {
          fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(81),
      missionTitle: this.add
        .text(48, 112, '', {
          fontFamily: FONT, fontSize: '14px', color: '#ffe066', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setDepth(81),
      missionDesc: this.add
        .text(48, 136, '', {
          fontFamily: FONT, fontSize: '11px', color: '#dbe9ff', resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setDepth(81),
      missionIcon: this.add.image(30, 118, 'mi-dodge').setScale(0.68).setDepth(81),
      hypeLabel: this.add
        .text(360, 46, '气势', {
          fontFamily: FONT, fontSize: '11px', color: '#d9c7ff', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setOrigin(0, 0)
        .setDepth(81),
      daily: this.add
        .text(40, 102, '', {
          fontFamily: FONT, fontSize: '12px', color: '#ffe066', fontStyle: 'bold',
          resolution: 2, stroke: '#08131f', strokeThickness: 3
        })
        .setVisible(false)
        .setDepth(81),
      dailyIcon: this.add
        .image(26, 108, 'ui-bolt')
        .setDisplaySize(13, 16)
        .setVisible(false)
        .setDepth(81),
      rankBar: this.add.graphics().setDepth(82),
      hypeBar: this.add.graphics().setDepth(82),
      missionBar: this.add.graphics().setDepth(82)
    };

    this.heartIcon = this.add.image(32, 31, 'dg-hat').setDisplaySize(26, 18).setDepth(81);
    this.add.image(136, 31, 'coin').setScale(0.46).setDepth(81);
    this.rankIcon = this.add.image(35, 56, 'ui-rank').setScale(0.5).setDepth(81);

    const missionY = this.daily ? 132 : 104;
    addPanel(this, 12, missionY, 252, 62, { fill: 0x09182c, fillAlpha: 0.96, radius: 12 }).setDepth(80);
    this.hud.missionTitle.setY(missionY + 8);
    this.hud.missionDesc.setY(missionY + 31);
    this.hud.missionIcon.setY(missionY + 27);
    drawBar(this.hud.missionBar, 24, missionY + 52, 228, 4, 0, 0x74c0fc);
    if (this.daily) {
      this.hud.daily.setY(101);
      addPanel(this, 12, 96, 206, 24, { fill: 0x2a1b4a, fillAlpha: 0.86, radius: 12 }).setDepth(80);
    }

    this.hud.best.setText(this.progress.bestTimeMs > 0 ? `最佳 ${(this.progress.bestTimeMs / 1000).toFixed(1)}s` : '最佳 —');
    this.hud.lives.setText(`×${this.totalLives}`);
    this.hud.coins.setText('0');
    this.refreshRankHud(true);
    drawBar(this.hud.hypeBar, 360, 62, 260, 10, 0, 0xb197fc);

    // 开局操作提示(几秒后淡出):带深色药丸底,避免和背景地标混在一起
    const hintText = this.add
      .text(0, 0, this.controls.virtualButtons ? '左下滑铲 · 右下跳跃' : '点击/空格跳跃 · ↓ 滑铲', {
        fontFamily: FONT, fontSize: '15px', color: '#ffffff', resolution: 2,
        stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5);
    const hintW = hintText.width + 38;
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x081525, 0.55);
    hintBg.fillRoundedRect(-hintW / 2, -16, hintW, 32, 16);
    hintBg.lineStyle(1.2, 0xffffff, 0.18);
    hintBg.strokeRoundedRect(-hintW / 2, -16, hintW, 32, 16);
    const hint = this.add.container(GAME_WIDTH / 2, GROUND_TOP - 58, [hintBg, hintText]).setDepth(81).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.95, duration: 400, delay: 700 });
    this.tweens.add({ targets: hint, alpha: 0, duration: 900, delay: 5200, onComplete: () => hint.destroy() });
  }

  private makeHudButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    fill = 0x10233d,
    iconKey?: string
  ): HudButton {
    const bg = this.add.graphics().setDepth(80);
    bg.fillStyle(0x06101d, 0.3);
    bg.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 3, w, h, h / 2);
    bg.fillStyle(fill, 0.9);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    bg.lineStyle(1.6, 0xffffff, 0.24);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    const hasLabel = label.length > 0;
    const text = this.add
      .text(iconKey && hasLabel ? x - w / 2 + 42 : x, y, label, {
        fontFamily: FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(iconKey && hasLabel ? 0 : 0.5, 0.5)
      .setDepth(81)
      .setVisible(hasLabel);
    let icon: Phaser.GameObjects.Image | undefined;
    if (iconKey) {
      icon = this.add
        .image(hasLabel ? x - w / 2 + 22 : x, y, iconKey)
        .setDepth(81)
        .setScale(iconKey === 'ui-bullet' ? 0.82 : 0.6);
    }
    const hit = this.add
      .rectangle(x, y, w, h, 0xffffff, 0.001)
      .setDepth(82)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      playSfx(this, 'click', 0.3);
      // 按下回弹:整组缩一下再复原
      const group = [bg, text, ...(icon ? [icon] : [])];
      this.tweens.add({ targets: group, scale: 0.93, duration: 70, yoyo: true, ease: 'Quad.out' });
      try { wxVibrate('light'); } catch {}
      onClick();
    });
    return { bg, text, hit, icon };
  }

  private buildButtons() {
    this.pauseBtn = this.makeHudButton(GAME_WIDTH - 38, 26, 52, 34, '', () => this.togglePause(), 0x10233d, 'ui-pause');
    this.pauseBounds = { x: GAME_WIDTH - 38, y: 26, w: 52, h: 34 };

    const actionX = this.hudActionX();
    if (hasPistol(this.progress)) {
      this.bulletsLeft = bulletsPerRun(this.progress);
      this.fireBtn = this.makeHudButton(
        actionX,
        GROUND_TOP - 30,
        136,
        42,
        `射击 ×${this.bulletsLeft}`,
        () => this.fire(),
        0x18324f,
        'ui-bullet'
      );
      this.fireBounds = { x: actionX, y: GROUND_TOP - 30, w: 136, h: 42 };
    }

    if (this.bribeCarried > 0) this.makeShieldBtn();
  }

  // 开了虚拟按键时,射击/贿月往左让位,避免和右下角跳跃键叠在一起
  private hudActionX(): number {
    return this.controls.virtualButtons ? GAME_WIDTH - 252 : GAME_WIDTH - 82;
  }

  // ============================================================
  // 虚拟按键(左下铲 / 右下跳)
  // ============================================================

  private buildTouchPad() {
    this.padJumpBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.padSlideBounds = { x: 0, y: 0, w: 0, h: 0 };
    if (!this.controls.virtualButtons) return;

    // 按键放大到 r=54:小屏手机按得准,手指挡住的画面也更少
    const r = 54;
    const y = GROUND_TOP - 34;
    this.makePadButton(82, y, r, 0x74c0fc, 'down', '滑铲', false);
    this.makePadButton(GAME_WIDTH - 82, y, r, 0xffd43b, 'up', '跳跃', true);
  }

  private makePadButton(
    x: number,
    y: number,
    r0: number,
    accent: number,
    dir: 'up' | 'down',
    label: string,
    isJump: boolean
  ) {
    // 深度放在地面之上、角色之下:角色永远压在按钮上面,不会被挡住
    const base = this.add.graphics().setDepth(3);
    const glyph = this.add.graphics().setDepth(3);
    const ring = this.add.graphics().setDepth(2);
    const text = this.add
      .text(x, y + r0 * 0.36, label, {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(3);
    // 按下时整体缩一点,松手弹回,手感更实
    let pressTween: Phaser.Tweens.Tween | undefined;
    const bump = (pressed: boolean) => {
      pressTween?.stop();
      const s0 = pressed ? 0.9 : 1;
      text.setScale(s0);
      pressTween = this.tweens.add({
        targets: text, scale: pressed ? 0.9 : 1, duration: 110, ease: 'Quad.out'
      });
    };
    const r = r0;

    const drawBase = (pressed: boolean) => {
      base.clear();
      base.fillStyle(accent, pressed ? 0.34 : 0.16);
      base.fillCircle(x, y, r + 6);
      base.fillStyle(0x08131f, pressed ? 0.72 : 0.42);
      base.fillCircle(x, y, pressed ? r - 2 : r);
      base.lineStyle(pressed ? 3.4 : 2.6, accent, pressed ? 1 : 0.75);
      base.strokeCircle(x, y, pressed ? r - 2 : r);
    };
    const drawGlyph = (pressed: boolean) => {
      glyph.clear();
      glyph.fillStyle(accent, pressed ? 1 : 0.9);
      const s = r * 0.3;
      const gy = y - 10;
      if (dir === 'up') glyph.fillTriangle(x - s, gy + s * 0.6, x + s, gy + s * 0.6, x, gy - s * 0.95);
      else glyph.fillTriangle(x - s, gy - s * 0.6, x + s, gy - s * 0.6, x, gy + s * 0.95);
    };
    drawBase(false);
    drawGlyph(false);

    const hitR = r + 8;
    const hit = this.add.circle(x, y, hitR, 0xffffff, 0.001).setDepth(93);
    // 用圆形命中区,手指按偏一点也能触发
    hit.setInteractive(new Phaser.Geom.Circle(hitR, hitR, hitR), Phaser.Geom.Circle.Contains);

    const press = () => {
      if (this.paused || this.dead || this.tutorialStep >= 0) return;
      drawBase(true);
      drawGlyph(true);
      text.setColor('#ffe066');
      bump(true);
      // 水波扩散:按下去的瞬间能立刻看到反馈
      ring.clear();
      ring.lineStyle(4, accent, 0.9);
      ring.strokeCircle(x, y, r - 4);
      this.tweens.add({
        targets: ring, alpha: { from: 1, to: 0 }, duration: 320, ease: 'Quad.out',
        onUpdate: (tw) => {
          const k = tw.progress;
          ring.clear();
          ring.lineStyle(4 * (1 - k) + 1, accent, 0.9 * (1 - k));
          ring.strokeCircle(x, y, r - 4 + 26 * k);
        },
        onComplete: () => ring.clear()
      });
      try { wxVibrate('light'); } catch {}
      playSfx(this, 'click', 0.24);
      if (isJump) this.onJumpInput();
      else this.trySlide();
    };
    const release = () => {
      drawBase(false);
      drawGlyph(false);
      text.setColor('#ffffff');
      bump(false);
      if (isJump) this.onJumpRelease();
    };
    hit.on('pointerdown', press);
    hit.on('pointerup', release);
    hit.on('pointerout', release);

    const bounds = { x, y, w: hitR * 2, h: hitR * 2 };
    if (isJump) this.padJumpBounds = bounds;
    else this.padSlideBounds = bounds;
  }

  private hitTouchPad(x: number, y: number): boolean {
    if (!this.controls.virtualButtons) return false;
    const inside = (b: Bounds) => !!b.w && Math.abs(x - b.x) <= b.w / 2 + 4 && Math.abs(y - b.y) <= b.h / 2 + 4;
    return inside(this.padJumpBounds) || inside(this.padSlideBounds);
  }

  private makeShieldBtn() {
    const actionX = this.hudActionX();
    this.shieldBtn = this.makeHudButton(
      actionX,
      GROUND_TOP - 84,
      136,
      42,
      `贿月 ×${this.bribeCarried}`,
      () => this.activateShield(),
      0x3a2b12,
      'ui-moon'
    );
    this.shieldBounds = { x: actionX, y: GROUND_TOP - 84, w: 136, h: 42 };
  }

  private updateBulletsHud() {
    if (this.fireBtn) {
      const enabled = this.bulletsLeft > 0;
      this.fireBtn.text.setText(enabled ? `射击 ×${this.bulletsLeft}` : '子弹耗尽');
      this.fireBtn.bg.setAlpha(enabled ? 1 : 0.55);
      this.fireBtn.text.setAlpha(enabled ? 1 : 0.6);
      this.fireBtn.icon?.setAlpha(enabled ? 1 : 0.45);
    }
  }

  private refreshShieldBtn() {
    if (this.shieldBtn) {
      const canUse = this.bribeCarried > 0 && !this.shieldActive;
      this.shieldBtn.text.setText(
        this.shieldActive ? '护体中' : this.bribeCarried > 0 ? `贿月 ×${this.bribeCarried}` : '已用完'
      );
      this.shieldBtn.bg.setAlpha(canUse ? 1 : 0.62);
      this.shieldBtn.text.setAlpha(canUse ? 1 : 0.72);
      this.shieldBtn.icon?.setAlpha(canUse ? 1 : 0.5);
    }
  }

  private removeShieldBtn() {
    if (!this.shieldBtn) return;
    this.shieldBtn.bg.destroy();
    this.shieldBtn.text.destroy();
    this.shieldBtn.hit.destroy();
    this.shieldBtn.icon?.destroy();
    this.shieldBtn = undefined;
  }

  // ============================================================
  // 输入
  // ============================================================

  private buildInput() {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointermove', this.onPointerMove, this);

    this.input.keyboard?.on('keydown-SPACE', this.onJumpInput, this);
    this.input.keyboard?.on('keyup-SPACE', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-UP', this.onJumpInput, this);
    this.input.keyboard?.on('keyup-UP', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-W', this.onJumpInput, this);
    this.input.keyboard?.on('keyup-W', this.onJumpRelease, this);
    this.input.keyboard?.on('keydown-DOWN', this.trySlide, this);
    this.input.keyboard?.on('keydown-S', this.trySlide, this);
    this.input.keyboard?.on('keydown-J', this.fire, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
  }

  private hitUI(x: number, y: number): boolean {
    const inside = (b: Bounds) => !!b.w && Math.abs(x - b.x) <= b.w / 2 + 4 && Math.abs(y - b.y) <= b.h / 2 + 4;
    return inside(this.pauseBounds) || inside(this.fireBounds) || inside(this.shieldBounds);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    // 相机放大后 pointer.x/y 是画布像素,统一换算成 960×540 的世界坐标再判定
    const x = pointer.worldX;
    const y = pointer.worldY;
    this.pointerStartX = x;
    this.pointerStartY = y;
    this.pointerStartAt = this.time.now;
    this.swipeTriggered = false;
    if (this.paused || this.dead || this.tutorialStep >= 0) return;
    if (this.hitUI(x, y) || this.hitTouchPad(x, y)) return;
    // 开了虚拟按键,动作只走左下/右下按钮;点屏不再触发,避免和按钮重复抵消
    if (this.controls.virtualButtons) return;
    // 屏幕下半区点按 = 滑铲,其余区域 = 跳跃
    if (y > GAME_HEIGHT - 100) {
      this.trySlide();
      return;
    }
    this.onJumpInput();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown || this.paused || this.dead || this.tutorialStep >= 0 || this.swipeTriggered) return;
    if (this.controls.virtualButtons) return;
    const dy = pointer.worldY - this.pointerStartY;
    const dt = this.time.now - this.pointerStartAt;
    if (dy > 42 && dt < 420) {
      this.swipeTriggered = true;
      this.trySlide();
    }
  }

  private onPointerUp() {
    this.onJumpRelease();
  }

  private onJumpInput() {
    if (this.paused || this.tutorialStep >= 0 || this.dead) return;
    this.lastJumpPressedAt = this.time.now;
  }

  private onJumpRelease() {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < -MIN_JUMP_SPEED) body.setVelocityY(-MIN_JUMP_SPEED);
  }

  // ============================================================
  // 生命周期 / 暂停 / 引导
  // ============================================================

  private setupLifecycle() {
    const onVisibility = () => {
      if (document.hidden) this.pauseGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onBlur = () => this.pauseGame();
    if (typeof window !== 'undefined') window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur);
    });
    if (isWx() && !wxHideHooked) {
      wxHideHooked = true;
      try {
        (window as any).wx?.onHide?.(() => this.pauseGame());
      } catch { /* 微信 API 不可用时忽略 */ }
    }
  }

  private announceStart() {
    // 关卡模式:横幅直接报关卡名 + 存活目标,进关就知道要干什么
    const title = this.level
      ? this.level.name
      : this.daily && this.challenge ? `今日挑战 · ${this.challenge.modifier.name}` : '开跑!';
    const baseLives = 2 + (this.progress.extraLives ?? 0);
    const extraHats = this.level ? Math.max(0, this.totalLives - baseLives) : 0;
    const perks = this.assetPerks;
    const perkBits: string[] = [];
    if (perks.extraLives > 0) perkBits.push(`别墅 +${perks.extraLives} 帽`);
    if (perks.coinMul > 1) perkBits.push(`公司 银币×${perks.coinMul.toFixed(2)}`);
    const subBase = this.level
      ? `活到 ${Math.round(this.level.durationMs / 1000)} 秒 · ${this.level.flavor}`
        + (extraHats > 0 ? `  ·  宽大处理 +${extraHats} 顶乌纱帽` : '')
      : this.daily && this.challenge ? this.challenge.modifier.desc : '一路高升,冲上厅长!';
    const sub = perkBits.length > 0 ? `${subBase}  ·  ${perkBits.join(' · ')}` : subBase;
    const c = this.add.container(GAME_WIDTH / 2, 214).setDepth(70).setAlpha(0).setScale(0.6);
    const t1 = this.add
      .text(0, 0, title, {
        fontFamily: FONT, fontSize: '42px', color: '#ffe066', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 7
      })
      .setOrigin(0.5);
    const t2 = this.add
      .text(0, 42, sub, {
        fontFamily: FONT, fontSize: '16px', color: '#ffffff', resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5);
    c.add([t1, t2]);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 320, ease: 'Back.out' });
    this.tweens.add({ targets: c, alpha: 0, y: 186, delay: 1150, duration: 420, onComplete: () => c.destroy() });
  }

  private showTutorial() {
    this.destroyOverlay(this.tutorialObjects);
    const steps = [
      {
        iconKey: 'ui-arrow-up',
        title: '跳跃',
        body: this.controls.virtualButtons
          ? '点右下「跳跃」键\n按得越久跳得越高,松手就是小跳\n存活 30 秒后解锁二段跳'
          : '点击屏幕 / 空格键跳跃\n长按跳得更高,松手就是小跳\n存活 30 秒后解锁二段跳'
      },
      {
        iconKey: 'ui-arrow-down',
        title: '滑铲',
        body: this.controls.virtualButtons
          ? '点左下「滑铲」键钻过低空美女\n贴到脸前才起滑 = 完美滑铲\n提前滑下去只是普通翻越'
          : '按 ↓ / S,或在屏幕下半部点按、向下滑动\n低空飞来的美女必须滑铲钻过去\n贴到脸前才起滑 = 完美滑铲,额外银币 + 气势'
      },
      {
        iconKey: 'mi-combo',
        title: '擦身 & 气势',
        body: '贴脸那一瞬间才跳 / 才滑 = 擦身而过,额外银币 + 气势\n提前躲开不算,滑过去也不算\n气势攒满自动进入「高光时刻」'
      },
      {
        iconKey: 'ui-rank',
        title: '官阶 & 考核',
        body: '每翻越一定数量自动升官,单局最高到「厅长」\n左侧是本局考核,完成立刻发银币\n乌纱帽掉光,本局结束'
      }
    ];
    const step = steps[this.tutorialStep];

    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020810, 0.7)
      .setDepth(300)
      .setInteractive();
    const panel = addPanel(this, GAME_WIDTH / 2 - 310, 90, 620, 360, {
      fill: 0x0d2038, fillAlpha: 0.98, stroke: 0xffd43b, strokeAlpha: 0.42, radius: 24
    }).setDepth(301);
    const tag = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 128, `新手引导 ${this.tutorialStep + 1}/${steps.length}`, {
        fontFamily: FONT, fontSize: '14px', color: '#a9c7e8', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(302);
    const icon = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 82, step.iconKey)
      .setDisplaySize(52, 52)
      .setDepth(302);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, step.title, {
        fontFamily: FONT, fontSize: '30px', color: '#ffe066', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(302);
    const body = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 46, step.body, {
        fontFamily: FONT, fontSize: '19px', color: '#ffffff', align: 'center', lineSpacing: 10, resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(302);

    const dots: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < steps.length; i++) {
      dots.push(
        this.add
          .rectangle(GAME_WIDTH / 2 - (steps.length - 1) * 9 + i * 18, GAME_HEIGHT / 2 + 118, i === this.tutorialStep ? 8 : 5, i === this.tutorialStep ? 8 : 5, i === this.tutorialStep ? 0xffd43b : 0x4b6584)
          .setDepth(302)
      );
    }

    const btn = this.makeOverlayButton(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 154,
      this.tutorialStep >= steps.length - 1 ? '开始跑!' : '知道了 →',
      () => {
        playSfx(this, 'click', 0.4);
        if (this.tutorialStep >= steps.length - 1) {
          this.tutorialStep = -1;
          this.destroyOverlay(this.tutorialObjects);
          this.progress.tutorialDone = true;
          saveProgress(this.progress);
          this.physics.resume();
          showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '跑起来!官阶在等你', '#ffe066', 'ui-rank');
          this.announceStart();
        } else {
          this.tutorialStep += 1;
          this.showTutorial();
        }
      },
      302,
      this.tutorialStep >= steps.length - 1 ? 'ui-arrow-up' : undefined
    );

    this.tutorialObjects = [dim, panel, tag, icon, title, body, ...dots, ...btn];
    dim.on('pointerdown', () => { /* 遮罩挡住跳跃输入 */ });
  }

  private makeOverlayButton(x: number, y: number, label: string, onClick: () => void, depth = 302, iconKey?: string): Phaser.GameObjects.GameObject[] {
    const iconSize = 18;
    const w = Math.max(210, Math.min(320, 60 + label.length * 20 + (iconKey ? 26 : 0)));
    const h = 50;
    const bg = this.add.graphics().setDepth(depth);
    bg.fillStyle(0x06101d, 0.4);
    bg.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, h / 2);
    bg.fillStyle(0x1d3557, 0.98);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    const text = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', fontStyle: 'bold', resolution: 2 })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    let icon: Phaser.GameObjects.Image | undefined;
    if (iconKey) {
      icon = this.add.image(0, y, iconKey).setDisplaySize(iconSize, iconSize).setDepth(depth + 1);
      const gap = 8;
      const total = iconSize + gap + text.width;
      icon.setX(x - total / 2 + iconSize / 2);
      text.setX(x - total / 2 + iconSize + gap + text.width / 2);
    }
    const hit = this.add
      .rectangle(x, y, w, h, 0xffffff, 0.001)
      .setDepth(depth + 2)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      playSfx(this, 'click', 0.35);
      this.tweens.add({ targets: icon ? [text, bg, icon] : [text, bg], scale: 0.95, duration: 70, yoyo: true });
      onClick();
    });
    return icon ? [bg, icon, text, hit] : [bg, text, hit];
  }

  private pauseGame() {
    if (this.dead || this.paused || this.tutorialStep >= 0) return;
    this.paused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    pauseBgm(this);

    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020810, 0.72)
      .setDepth(300)
      .setInteractive();
    const panel = addPanel(this, GAME_WIDTH / 2 - 230, 70, 460, 396, {
      fill: 0x0d2038, fillAlpha: 0.98, stroke: 0xffffff, strokeAlpha: 0.2, radius: 26
    }).setDepth(301);
    const titleText = this.add
      .text(0, 0, '已暂停', {
        fontFamily: FONT, fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(302);
    const titleIcon = this.add.image(0, 0, 'ui-pause').setDisplaySize(24, 24).setDepth(302);
    const titleW = 24 + 10 + titleText.width;
    titleIcon.setPosition(GAME_WIDTH / 2 - titleW / 2 + 12, 112);
    titleText.setPosition(GAME_WIDTH / 2 - titleW / 2 + 34 + titleText.width / 2, 112);
    const stats = this.add
      .text(GAME_WIDTH / 2, 158, `存活 ${(this.elapsedMs / 1000).toFixed(1)}s · 翻越 ${this.dodged} · 官阶 ${this.rank.name}`, {
        fontFamily: FONT, fontSize: '14px', color: '#a9c7e8', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(302);

    // 本局考核进度:暂停时也能看到离目标还差多少
    const missionProgress = this.missionCompleted
      ? `已完成 +${this.mission.reward} 银币`
      : `${missionProgressText(this.mission, this.getMissionState())} · 完成 +${this.mission.reward} 银币`;
    const missionText = this.add
      .text(0, 0, `本局考核「${this.mission.title}」 ${missionProgress}`, {
        fontFamily: FONT, fontSize: '12px',
        color: this.missionCompleted ? '#8ce99a' : '#cfe3ff', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(302);
    const missionIcon = this.add
      .image(0, 0, `mi-${this.mission.id}`)
      .setDisplaySize(15, 15)
      .setDepth(302);
    const missionW = 15 + 7 + missionText.width;
    missionIcon.setPosition(GAME_WIDTH / 2 - missionW / 2 + 7.5, 186);
    missionText.setPosition(GAME_WIDTH / 2 - missionW / 2 + 22 + missionText.width / 2, 186);

    this.pauseObjects = [dim, panel, titleIcon, titleText, stats, missionIcon, missionText];
    this.pauseObjects.push(...this.makeOverlayButton(GAME_WIDTH / 2, 224, '继续', () => this.resumeGame(), 302, 'ui-play'));
    this.pauseObjects.push(
      ...this.makeOverlayButton(GAME_WIDTH / 2, 284, '重新开始', () => {
        this.scene.restart({ daily: this.daily, levelId: this.level?.id });
      }, 302, 'ui-restart')
    );
    this.pauseObjects.push(
      ...this.makeOverlayButton(GAME_WIDTH / 2, 344, '主菜单', () => {
        this.scene.start('Title');
      }, 302, 'ui-home')
    );
    this.pauseObjects.push(
      ...this.makeOverlayButton(
        GAME_WIDTH / 2,
        404,
        this.daily ? '今日挑战规则' : '操作提示',
        () => {
          if (this.daily && this.challenge) {
            showToast(
              this,
              GAME_WIDTH / 2,
              210,
              `${this.challenge.modifier.name}:${this.challenge.modifier.desc}`,
              '#ffe066',
              dailyModifierIcon(this.challenge.modifier.id)
            );
          } else {
            showToast(this, GAME_WIDTH / 2, 210, this.controls.virtualButtons ? '左下滑铲 · 右下跳跃 · 右上暂停' : '点击/空格跳跃 · ↓/S 滑铲 · J 射击', '#ffe066', 'ui-tips');
          }
        },
        302,
        this.daily && this.challenge ? dailyModifierIcon(this.challenge.modifier.id) : 'ui-tips'
      )
    );
  }

  private resumeGame() {
    if (!this.paused) return;
    this.destroyOverlay(this.pauseObjects);
    this.paused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    resumeBgm(this);
  }

  private togglePause() {
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  private destroyOverlay(list: Phaser.GameObjects.GameObject[]) {
    list.forEach(o => o.destroy());
    list.length = 0;
  }

  // ============================================================
  // 主循环
  // ============================================================

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.paused || this.tutorialStep >= 0 || this.ended) return;

    if (this.dead) {
      this.updateBackdrop(dt, 52);
      return;
    }

    // 通关演出:世界停下,只留背景缓缓后退
    if (this.levelFinishing) {
      this.updateBackdrop(dt, 60);
      return;
    }

    // 命中顿帧:画面完全静止约 85ms
    if (time < this.hitFreezeUntil) return;

    this.elapsedMs += dt;

    // 关卡模式:到点先看目标做没做完 —— 没做完且还没加时过,就再给 15 秒,然后才结束
    if (this.level) {
      if (this.elapsedMs >= this.level.durationMs && !this.overtimeUsed && !this.goalsAllDone()) {
        this.overtimeUsed = true;
        this.overtimeMs = LEVEL_OVERTIME_MS;
        this.showBanner('加时 15 秒', '#8ce99a', 30, 'ui-clock');
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 250, '目标还没做完 · 再给 15 秒', '#8ce99a', 'ui-clock');
        playSfx(this, 'wave_clear', 0.4);
      }
      const limit = this.level.durationMs + this.overtimeMs;
      if (this.elapsedMs >= limit) {
        this.elapsedMs = limit;
        this.finishLevel();
        return;
      }
    }
    this.timeSinceHitMs += dt;

    // 追平生涯最佳:局内即时庆祝,不用等到结算
    if (!this.recordBroken && this.bestAtStart > 0 && this.elapsedMs > this.bestAtStart) {
      this.recordBroken = true;
      this.hud.best.setText('新纪录!').setColor('#ffe066');
      this.showBanner('新纪录!', '#ffe066', 40, 'ui-trophy');
      confettiBurst(this, GAME_WIDTH / 2, 92, 24);
      playSfx(this, 'record', 0.5);
      wxVibrate('light');
    }

    if (!this.doubleJumpUnlocked && this.elapsedMs >= DOUBLE_JUMP_UNLOCK_MS) {
      this.doubleJumpUnlocked = true;
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '二段跳解锁!空中可再跳一次', '#ffe066', 'ui-arrow-up');
      playSfx(this, 'unlock', 0.5);
      wxVibrate('light');
    }

    if (!this.bgm2Switched && this.elapsedMs >= BGM2_SWITCH_MS) {
      this.bgm2Switched = true;
      crossfadeToBgm2(this);
    }

    // 速度:关卡按配置曲线,无尽/每日按基础加速;再叠加各种修正
    let speed = this.level
      ? levelSpeedAt(this.level, this.elapsedMs)
      : Math.min(RUN_SPEED_BASE + this.elapsedMs * RUN_SPEED_ACCEL, RUN_SPEED_MAX);
    speed *= this.dailySpeedMul;
    if (this.invulnerable) speed *= 0.82;
    if (this.elapsedMs < this.slowUntil) speed *= PICKUP_SLOW_FACTOR;
    if (this.overdriveActive) speed *= OVERDRIVE_SPEED_MULT;
    this.runSpeed = Math.min(speed, RUN_SPEED_MAX * 1.2);

    this.moveWorld();
    this.spawnTick(dt);
    this.updateInspection();
    this.updatePickupTimer();
    this.updateSlideState();
    this.tryJump(time);
    this.checkNearMiss();
    this.checkDodges();
    this.updateOverdrive();
    this.updateMission();
    this.updateBackdrop(dt);
    this.updatePlayerFx(dt);
    this.updateHud();
  }

  private moveWorld() {
    this.obstacleGroup.getChildren().forEach(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      const body = o.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(-this.runSpeed);
      const sh = o.getData('shadow') as Phaser.GameObjects.Image | undefined;
      if (sh) sh.x = o.x;
      if (o.getData('warn') && !o.getData('warned') && o.x < GAME_WIDTH - 26) {
        o.setData('warned', true);
        this.showFlyerWarn();
      }
    });
    this.coinGroup.getChildren().forEach(child => {
      const c = child as Phaser.Physics.Arcade.Image;
      (c.body as Phaser.Physics.Arcade.Body).setVelocityX(-this.runSpeed);
    });
    this.pickupGroup.getChildren().forEach(child => {
      const p = child as Phaser.Physics.Arcade.Image;
      (p.body as Phaser.Physics.Arcade.Body).setVelocityX(-this.runSpeed);
    });
    this.bulletGroup.getChildren().forEach(child => {
      const b = child as Phaser.Physics.Arcade.Image;
      if (b.x > GAME_WIDTH + 60) b.destroy();
    });
    this.cleanupOffscreen();
  }

  private cleanupOffscreen() {
    this.obstacleGroup.getChildren().slice().forEach(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      if (o.x + o.width < -80) this.destroyObstacle(o);
    });
    this.coinGroup.getChildren().slice().forEach(child => {
      const c = child as Phaser.Physics.Arcade.Image;
      if (c.x < -60 || !c.active) {
        this.tweens.killTweensOf(c);
        c.destroy();
      }
    });
    this.pickupGroup.getChildren().slice().forEach(child => {
      const p = child as Phaser.Physics.Arcade.Image;
      if (p.x < -60 || !p.active) {
        this.tweens.killTweensOf(p);
        p.destroy();
      }
    });
  }

  private spawnTick(dt: number) {
    this.distanceSinceSpawn += (this.runSpeed * dt) / 1000;
    if (this.distanceSinceSpawn >= this.nextGapPx) {
      this.distanceSinceSpawn = 0;
      this.spawnPattern();
    }
  }

  private updatePickupTimer() {
    if (this.elapsedMs < this.nextPickupAt) return;
    if (this.pickupGroup.countActive(true) === 0) this.spawnPickup(GAME_WIDTH + 80);
    this.nextPickupAt = this.elapsedMs + 9000 + this.rng() * 5000;
  }

  // ============================================================
  // 背景昼夜 / 视差
  // ============================================================

  private updateBackdrop(dt: number, driftSpeed = this.runSpeed) {
    if (this.level) {
      // 关卡模式:用章节色调,并在关卡内逐渐变暗(倒计时压力)
      const mood = chapterMoodAt(this.level, this.elapsedMs);
      this.nightness = mood.nightness;
      this.skyRect.setFillStyle(mood.sky);
    } else {
      this.nightness = this.nightnessAt(this.elapsedMs);
      this.skyRect.setFillStyle(this.skyColorAt(this.elapsedMs));
    }

    const tint = (nightColor: number) => this.mixColor(0xffffff, nightColor, this.nightness);
    this.mountains.setTint(tint(0x8c9ac4));
    this.cityFar.setTint(tint(0x7b88b4));
    this.cityNear.setTint(tint(0x64729e));

    this.sun.setAlpha(0.95 * (1 - this.nightness)).setY(94 + this.nightness * 54);
    this.sunRays
      .setPosition(this.sun.x, this.sun.y)
      .setAlpha(0.32 * (1 - this.nightness))
      .setScale(0.92 + this.nightness * 0.05);
    this.moon.setAlpha(0.92 * this.nightness).setY(150 - this.nightness * 82);
    this.stars.forEach(s => {
      s.dot.setAlpha(this.nightness * (0.32 + 0.68 * Math.abs(Math.sin(this.elapsedMs * 0.0016 + s.phase))));
    });
    this.clouds.forEach(c => {
      const base = (c.getData('baseAlpha') as number) || 0.7;
      c.setAlpha(base * (1 - this.nightness * 0.45));
      c.x -= (driftSpeed * 0.1 * dt) / 1000 + 2;
      if (c.x < -80) c.x = GAME_WIDTH + 80;
    });

    this.papers.forEach(p => {
      p.g.x -= ((driftSpeed * p.speed + 26) * dt) / 1000;
      p.g.y += Math.sin(this.elapsedMs * 0.0022 + p.sway) * 0.18;
      p.g.angle += (p.spin * dt) / 1000;
      p.g.setAlpha(p.baseAlpha * (1 - this.nightness * 0.3));
      if (p.g.x < -20) {
        p.g.x = GAME_WIDTH + 20;
        p.g.y = Phaser.Math.Between(90, 390);
      }
    });

    this.mountains.tilePositionX += (driftSpeed * 0.06 * dt) / 1000;
    this.cityFar.tilePositionX += (driftSpeed * 0.16 * dt) / 1000;
    this.cityNear.tilePositionX += (driftSpeed * 0.3 * dt) / 1000;
    this.groundDetail.tilePositionX += (driftSpeed * dt) / 1000;

    const landmarkTint = tint(0x64729e);
    const neonAlpha = Math.max(0, (this.nightness - 0.2) / 0.8);
    for (let i = 0; i < this.landmarks.length; i++) {
      const lm = this.landmarks[i];
      lm.setTint(landmarkTint);
      lm.x -= (driftSpeed * 0.18 * dt) / 1000;
      if (lm.x < -160) lm.x += 1500;
      const neon = this.landmarkNeons[i];
      if (neon) {
        neon.x = lm.x;
        // 缓慢呼吸,避免夜景灯带死板;压到 0.72,保证不抢障碍物的视觉焦点
        neon.setAlpha(neonAlpha * 0.72 * (0.82 + 0.18 * Math.sin(this.elapsedMs * 0.0018 + i * 1.9)));
      }
    }

    this.nightOverlay.setAlpha(this.nightness * 0.2);
    this.updateSpeedLines(dt, driftSpeed);

    if (this.overdriveActive) {
      this.goldOverlay.setAlpha(0.07 + 0.025 * Math.abs(Math.sin(this.elapsedMs * 0.012)));
      if (this.time.now - this.lastWindAt > 80) {
        this.lastWindAt = this.time.now;
        windStreak(this, this.player.x - 20, this.player.y + 10, 2);
      }
    } else {
      this.goldOverlay.setAlpha(0);
    }

    if (this.inspectionActive) {
      this.inspectionOverlay.setAlpha(0.035 + 0.025 * Math.abs(Math.sin(this.elapsedMs * 0.009)));
    } else {
      this.inspectionOverlay.setAlpha(0);
    }
  }

  // 高速时的环境速度线:只在高处飘过,不遮挡障碍和 HUD
  private updateSpeedLines(dt: number, speed: number) {
    if (speed < 430) {
      this.speedLineAcc = 0;
      return;
    }
    this.speedLineAcc += dt;
    const interval = Math.max(48, 170 - (speed - 430) * 0.22);
    if (this.speedLineAcc < interval) return;
    this.speedLineAcc = 0;
    const line = this.add
      .rectangle(GAME_WIDTH + 24, Phaser.Math.Between(64, GROUND_TOP - 88), Phaser.Math.Between(34, 88), Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.05, 0.14))
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.tweens.add({
      targets: line,
      x: line.x - Phaser.Math.Between(220, 340),
      alpha: 0,
      duration: Phaser.Math.Between(260, 420),
      ease: 'Quad.in',
      onComplete: () => line.destroy()
    });
  }

  private skyColorAt(t: number): number {
    if (t < DAY_DUSK_MS) return 0x5ec8f8;
    if (t < DAY_NIGHT_MS) return this.mixColor(0x5ec8f8, 0xf78f5e, (t - DAY_DUSK_MS) / (DAY_NIGHT_MS - DAY_DUSK_MS));
    if (t < DAY_DEEP_MS) return this.mixColor(0xf78f5e, 0x16224a, (t - DAY_NIGHT_MS) / (DAY_DEEP_MS - DAY_NIGHT_MS));
    return 0x16224a;
  }

  private nightnessAt(t: number): number {
    if (t < DAY_NIGHT_MS) return 0;
    if (t >= DAY_DEEP_MS) return 1;
    return (t - DAY_NIGHT_MS) / (DAY_DEEP_MS - DAY_NIGHT_MS);
  }

  private mixColor(a: number, b: number, k: number): number {
    const r1 = (a >> 16) & 0xff, g1 = (a >> 8) & 0xff, b1 = a & 0xff;
    const r2 = (b >> 16) & 0xff, g2 = (b >> 8) & 0xff, b2 = b & 0xff;
    const f = (x: number, y: number) => Math.round(x + (y - x) * Phaser.Math.Clamp(k, 0, 1));
    return (f(r1, r2) << 16) | (f(g1, g2) << 8) | f(b1, b2);
  }

  private updatePlayerFx(dt: number) {
    if (this.pendantIcon) this.pendantIcon.setPosition(this.player.x, this.player.y - 74 * this.player.scaleY);

    const feetY = this.player.y + (this.frameH * this.player.scaleY) / 2;
    const lift = Math.max(0, GROUND_TOP - feetY);
    this.playerShadow
      .setPosition(this.player.x + 4, GROUND_TOP + 2)
      .setScale(Math.max(0.45, 1.1 - lift / 520), Math.max(0.35, 0.8 - lift / 900))
      .setAlpha(Math.max(0.2, 0.7 - lift / 420));

    const tempShieldOn = this.elapsedMs < this.tempShieldUntil;
    if (this.shieldActive || tempShieldOn) {
      this.shieldRing.setVisible(true);
      this.shieldRing.setTint(this.shieldActive ? 0xffd43b : 0x4dabf7);
      this.shieldRing.setPosition(this.player.x, feetY - 8);
    } else if (this.shieldRing.visible) {
      this.shieldRing.setVisible(false);
    }

    this.runDustAcc += dt;
    if (!this.airborne) {
      if (this.sliding && this.runDustAcc > 110) {
        this.runDustAcc = 0;
        dust(this, this.player.x - 24, feetY - 4, 2);
        windStreak(this, this.player.x - 14, this.player.y, 1);
      } else if (!this.sliding && this.runDustAcc > 620) {
        this.runDustAcc = 0;
        dust(this, this.player.x - 22, feetY - 4, 1);
      }
    }

    this.updateHypeAura();
  }

  private updateHypeAura() {
    if (!this.hypeAura) return;
    if (this.dead) {
      this.hypeAura.setAlpha(0);
      return;
    }
    this.hypeAura.setPosition(this.player.x, this.player.y);
    if (this.overdriveActive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedMs * 0.012);
      this.hypeAura.setTint(0xffd43b);
      this.hypeAura.setScale(1.12 + 0.1 * pulse);
      this.hypeAura.setAlpha(0.32 + 0.16 * pulse);
      return;
    }
    const t = Phaser.Math.Clamp((this.hype / HYPE_MAX - 0.55) / 0.45, 0, 1);
    if (t <= 0) {
      this.hypeAura.setAlpha(0);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedMs * 0.009);
    this.hypeAura.clearTint();
    this.hypeAura.setScale(0.84 + 0.1 * pulse + 0.14 * t);
    this.hypeAura.setAlpha(t * (0.4 + 0.24 * pulse));
  }

  // ============================================================
  // 跳跃 / 滑铲 / 身体碰撞箱
  // ============================================================

  private tryJump(now: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      if (this.airborne) {
        dust(this, this.player.x, GROUND_TOP - 4, 5);
        this.airborne = false;
      }
      this.lastOnGroundAt = now;
      this.jumpsUsed = 0;
      if (!this.sliding) {
        if (!this.useQiSkin && !this.player.anims.isPlaying) this.player.play('player-run');
        if (this.useQiSkin && this.bobTween && !this.bobTween.isPlaying()) this.startBob();
      }
    }

    const canCoyote = now - this.lastOnGroundAt <= COYOTE_TIME_MS;
    const buffered = now - this.lastJumpPressedAt <= JUMP_BUFFER_MS;

    if (buffered && (onGround || canCoyote)) {
      this.slideQueued = false;
      if (this.sliding) this.endSlide();
      this.jumpsUsed = 1;
      this.doJump(JUMP_SPEED, false);
      return;
    }
    if (buffered && this.doubleJumpUnlocked && this.jumpsUsed < 2) {
      this.jumpsUsed = 2;
      this.doJump(JUMP_SPEED * DOUBLE_JUMP_SPEED_RATIO, true);
      return;
    }
    if (onGround && this.slideQueued) {
      this.slideQueued = false;
      this.enterSlide();
    }
  }

  private doJump(speed: number, isDouble: boolean) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-speed);
    if (!isDouble) {
      this.jumpId += 1;
      this.markTightJump();
    }
    this.lastJumpPressedAt = -10000;
    this.bobTween?.stop();
    this.bobTween = undefined;
    this.player.setScale(this.baseScale);
    if (!this.useQiSkin) {
      this.player.anims.stop();
      this.player.setTexture(this.playerTex('jump'));
      this.recenterBodyX();
    }
    if (isDouble) poof(this, this.player.x, this.player.y + 30, 6);
    this.airborne = true;
    windStreak(this, this.player.x - 8, this.player.y + 16, 2);
    playSfx(this, 'jump', 0.38);
  }

  private trySlide() {
    if (this.paused || this.tutorialStep >= 0 || this.dead) return;
    if (this.elapsedMs < this.slideCooldownUntil) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (!onGround) {
      this.slideQueued = true;
      if (body.velocity.y < MAX_FALL_SPEED * 0.75) body.setVelocityY(MAX_FALL_SPEED * 0.85);
      playSfx(this, 'slide', 0.28);
      return;
    }
    if (this.sliding) return;
    this.enterSlide();
  }

  private enterSlide() {
    if (this.sliding) return;
    this.sliding = true;
    this.slideQueued = false;
    this.slideUntil = this.elapsedMs + SLIDE_DURATION_MS;
    this.slideCooldownUntil = this.elapsedMs + SLIDE_DURATION_MS + SLIDE_COOLDOWN_MS;
    this.slideId += 1;
    // 完美滑铲看的是「起滑时机」:起滑这一瞬间就决定这次算不算卡点
    this.markTightSlide();
    this.bobTween?.stop();
    this.bobTween = undefined;
    const scaleX = this.baseScale * 1.12;
    const scaleY = this.baseScale * 0.58;
    this.player.setScale(scaleX, scaleY);
    this.player.setY(GROUND_TOP - (this.frameH * scaleY) / 2);
    this.applySlideBody(scaleX, scaleY);
    this.runDustAcc = 999;
    playSfx(this, 'slide', 0.42);
    windStreak(this, this.player.x - 12, this.player.y + 6, 3);
  }

  // 起滑瞬间给最近的「卡点」低空障碍打上本次滑铲的 id,障碍过去时据此判定完美
  private markTightSlide() {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const children = this.obstacleGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    const candidates = children.map(o => {
      const ob = o.body as Phaser.Physics.Arcade.Body;
      return {
        distanceToContact: ob.left - pb.right,
        flyer: !!o.getData('flyer'),
        counted: !!o.getData('counted'),
        hit: !!o.getData('hit')
      };
    });
    const idx = tightSlideIndex(candidates, this.runSpeed);
    if (idx === null) return;
    children[idx].setData('tightSlideId', this.slideId);
  }

  // 起跳瞬间给贴脸的那个障碍打上本次起跳的 id,之后贴着它过去才算擦身
  private markTightJump() {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const children = this.obstacleGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    const candidates = children.map(o => {
      const ob = o.body as Phaser.Physics.Arcade.Body;
      return {
        distanceToContact: ob.left - pb.right,
        flyer: !!o.getData('flyer'),
        counted: !!o.getData('counted'),
        hit: !!o.getData('hit')
      };
    });
    const idx = clutchIndex(candidates, this.runSpeed);
    if (idx === null) return;
    children[idx].setData('tightJumpId', this.jumpId);
  }

  private endSlide(cooldown = true) {
    if (!this.sliding) return;
    this.sliding = false;
    if (cooldown) this.slideCooldownUntil = Math.max(this.slideCooldownUntil, this.elapsedMs + SLIDE_COOLDOWN_MS);
    this.player.setScale(this.baseScale);
    this.player.setY(Math.min(this.player.y, GROUND_TOP - (this.frameH * this.baseScale) / 2));
    this.applyStandingBody();
    this.recenterBodyX();
    if (!this.useQiSkin && !this.airborne) this.player.play('player-run');
    if (this.useQiSkin && !this.airborne) this.startBob();
  }

  private updateSlideState() {
    if (this.sliding && this.elapsedMs >= this.slideUntil) this.endSlide();
    if (this.sliding) {
      const p = this.player;
      p.setY(GROUND_TOP - (this.frameH * p.scaleY) / 2);
    }
  }

  private applyStandingBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const sourceW = this.frameW * 0.5;
    const sourceH = this.frameH * 0.72;
    body.setSize(sourceW, sourceH, false);
    body.setOffset((this.player.width - sourceW) / 2, this.frameH - sourceH);
  }

  private applySlideBody(_scaleX: number, scaleY: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const sourceW = (this.frameW * 0.5) / 1.12;
    const sourceH = SLIDE_BODY_HEIGHT / scaleY;
    body.setSize(sourceW, sourceH, false);
    body.setOffset((this.player.width - sourceW) / 2, this.frameH - sourceH);
    body.updateFromGameObject();
    body.setAllowGravity(true);
    body.setMaxVelocity(9999, MAX_FALL_SPEED);
  }

  // 奔跑帧宽度不同(47/79/89),每帧重新居中碰撞箱,避免身体左右跳动
  private recenterBodyX() {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setOffset((this.player.width - body.sourceWidth) / 2, body.offset.y);
  }

  private startBob() {
    this.bobTween?.stop();
    this.player.setScale(this.baseScale);
    this.bobTween = this.tweens.add({
      targets: this.player,
      scaleX: this.baseScale * 0.99,
      scaleY: this.baseScale * 1.03,
      duration: 210,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  // ============================================================
  // 生成 / 拾取 / 碰撞
  // ============================================================

  private spawnPattern() {
    const p: RunPattern = generatePattern({
      rng: this.rng,
      // 关卡短(20-48 秒),用 stageSpeed 压缩节奏,让低空美女/组合障碍按设计登场
      elapsedMs: this.level ? this.elapsedMs * this.level.stageSpeed : this.elapsedMs,
      speed: this.runSpeed,
      lastPattern: this.lastPattern,
      actionStreak: this.actionStreak
    });
    const baseX = GAME_WIDTH + 100;
    p.obstacles.forEach(ob => this.spawnObstacle(baseX + ob.at, ob.flyer, ob.key, !!ob.warn));
    p.coins.forEach(c => this.spawnCoin(baseX + c.at, GROUND_TOP + c.dy));
    if (p.pickupAt !== undefined) this.spawnPickup(baseX + p.pickupAt);

    this.lastPattern = p.name;
    this.actionStreak = p.obstacles.length > 0 ? this.actionStreak + 1 : 0;
    const factor = this.inspectionActive ? INSPECTION_SPAWN_FACTOR : 1;
    this.nextGapPx = p.spanPx + this.runSpeed * p.gapSec * factor;
  }

  private spawnObstacle(x: number, flyer: boolean, key: string, warn: boolean) {
    const y = GROUND_TOP + (flyer ? FLYER_Y : 0);
    const o = this.physics.add.image(x, y, key).setOrigin(0.5, 1).setDepth(5);
    const body = o.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    o.setImmovable(true);
    o.setData('flyer', flyer);
    o.setData('warn', warn);
    const w = Math.round(o.width * 0.6);
    const h = Math.round(o.height * 0.82);
    body.setSize(w, h, false);
    body.setOffset((o.width - w) / 2, o.height - h);
    this.obstacleGroup.add(o);
    if (!flyer) {
      const sh = this.add
        .image(o.x, GROUND_TOP + 2, 'shadow')
        .setDepth(4)
        .setScale((o.width / 120) * 0.9, 0.62)
        .setAlpha(0.36);
      o.setData('shadow', sh);
    }
  }

  private destroyObstacle(o: Phaser.Physics.Arcade.Image) {
    const sh = o.getData('shadow') as Phaser.GameObjects.Image | undefined;
    sh?.destroy();
    o.destroy();
  }

  private spawnCoin(x: number, y: number) {
    const c = this.physics.add.image(x, y, 'coin').setDepth(4);
    const body = c.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(13, 7, 7);
    this.coinGroup.add(c);
    const spin = this.tweens.add({
      targets: c,
      scaleX: 0.35,
      duration: 480 + Math.floor(this.rng() * 180),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    c.setData('spin', spin);
  }

  private spawnPickup(x: number) {
    const roll = this.rng();
    const kind: PickupKind = roll < 0.36 ? 'coin' : roll < 0.56 ? 'shield' : roll < 0.78 ? 'double' : roll < 0.9 ? 'slow' : 'hype';
    const keyMap: Record<PickupKind, string> = {
      coin: 'item-bag',
      shield: 'item-shield',
      double: 'item-double',
      slow: 'item-slow',
      hype: 'item-hype'
    };
    const p = this.physics.add.image(x, GROUND_TOP + PICKUP_Y, keyMap[kind]).setDepth(4);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(21, 5, 5);
    p.setData('kind', kind);
    this.pickupGroup.add(p);
    this.tweens.add({
      targets: p,
      y: p.y - 12,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  private showFlyerWarn() {
    if (this.time.now - this.lastFlyerWarnAt < 500) return;
    this.lastFlyerWarnAt = this.time.now;
    const label = this.add
      .text(0, 14, this.controls.virtualButtons ? '低空来袭 · 点左下铲' : '低空来袭 · 下滑滑铲', {
        fontFamily: FONT, fontSize: '14px', color: '#ff8787', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5);
    const bg = this.add.graphics();
    const w = Math.max(160, label.width + 34);
    bg.fillStyle(0x1a0b12, 0.82);
    bg.fillRoundedRect(-w / 2, -25, w, 52, 14);
    bg.lineStyle(1.4, 0xff8787, 0.45);
    bg.strokeRoundedRect(-w / 2, -25, w, 52, 14);
    const icon = this.add.image(0, -10, 'ui-arrow-down').setDisplaySize(22, 22);
    const c = this.add
      .container(GAME_WIDTH - 108, 178, [bg, icon, label])
      .setDepth(84)
      .setAlpha(0)
      .setScale(0.7);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 180, ease: 'Back.out' });
    this.tweens.add({
      targets: c,
      alpha: 0,
      x: GAME_WIDTH - 130,
      delay: FLYER_WARN_MS - 260,
      duration: 300,
      onComplete: () => c.destroy()
    });
    playSfx(this, 'warn', 0.42);
  }

  private handleCoin: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, coin) => {
    const c = coin as Phaser.Physics.Arcade.Image;
    if (!c.active) return;
    const spin = c.getData('spin') as Phaser.Tweens.Tween | undefined;
    spin?.stop();
    c.destroy();
    const value = this.coinAmount(WORLD_COIN_VALUE);
    this.addRunCoins(value);
    this.gainHype(HYPE_PER_COIN);
    coinPop(this, c.x, c.y, 2);
    if (value > 1) this.floatText(c.x, c.y - 18, `+${value} 银币`);
    playSfx(this, 'coin', 0.1);
  };

  private handlePickup: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, pickup) => {
    const p = pickup as Phaser.Physics.Arcade.Image;
    if (!p.active) return;
    const kind = p.getData('kind') as PickupKind;
    this.tweens.killTweensOf(p);
    p.destroy();
    this.runPickups += 1;
    playSfx(this, 'pickup', 0.52);
    wxVibrate('light');

    switch (kind) {
      case 'coin': {
        const value = this.coinAmount(PICKUP_COIN_BONUS);
        this.addRunCoins(value);
        this.floatText(this.player.x + 24, this.player.y - 84, `+${value} 银币`);
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, `银币袋 +${value}!`, '#ffe066', 'coin');
        break;
      }
      case 'shield': {
        this.tempShieldUntil = Math.max(this.tempShieldUntil, this.elapsedMs + PICKUP_SHIELD_MS);
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '临时护盾 8 秒!', '#ffe066', 'item-shield');
        break;
      }
      case 'double': {
        this.doubleCoinsUntil = Math.max(this.doubleCoinsUntil, this.elapsedMs + PICKUP_DOUBLE_MS);
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '双倍银币 10 秒!', '#ffe066', 'item-double');
        break;
      }
      case 'slow': {
        this.slowUntil = Math.max(this.slowUntil, this.elapsedMs + PICKUP_SLOW_MS);
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '缓刑!速度放缓 5 秒', '#ffe066', 'item-slow');
        break;
      }
      case 'hype': {
        this.gainHype(HYPE_PER_PICKUP + 12);
        showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '气势暴涨!', '#ffe066', 'ui-bolt');
        break;
      }
    }
  };

  private handleBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bullet, obstacle) => {
    const o = obstacle as Phaser.Physics.Arcade.Image;
    const b = bullet as Phaser.Physics.Arcade.Image;
    if (!o.active || !b.active) return;
    explode(this, o.x, o.y - o.height / 2);
    this.destroyObstacle(o);
    b.destroy();
    this.runKills += 1;
    const value = this.coinAmount(1);
    this.addRunCoins(value);
    this.gainHype(HYPE_PER_KILL);
    this.floatText(o.x, o.y - o.height - 20, `+${value} 银币`);
    playSfx(this, 'coin', 0.18);
  };

  private handleHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, obstacle) => {
    if (this.invulnerable || this.dead) return;
    if (this.time.now < this.hitFreezeUntil) return;
    const o = obstacle as Phaser.Physics.Arcade.Image;
    if (!o.active) return;
    o.setData('hit', true);

    // 高光时刻:无敌冲刺,直接撞碎
    if (this.overdriveActive) {
      explode(this, o.x, o.y - o.height / 2);
      this.destroyObstacle(o);
      const value = this.coinAmount(2);
      this.addRunCoins(value);
      this.floatText(this.player.x + 28, this.player.y - 70, `撞碎! +${value} 银币`);
      playSfx(this, 'shield', 0.3);
      return;
    }

    // 道具护盾优先
    if (this.elapsedMs < this.tempShieldUntil) {
      this.tempShieldUntil = 0;
      poof(this, this.player.x, this.player.y + 22, 8);
      this.enterInvulnerable(650);
      playSfx(this, 'shield', 0.5);
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '护盾挡下了一次!', '#ffe066', 'item-shield');
      return;
    }

    // 贿月护体
    if (this.shieldActive) {
      this.shieldActive = false;
      poof(this, this.player.x, this.player.y + 22, 9);
      this.enterInvulnerable(700);
      playSfx(this, 'shield', 0.5);
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '贿月护体挡下!', '#ffe066', 'ui-moon');
      this.refreshShieldBtn();
      if (this.bribeCarried <= 0) this.time.delayedCall(450, () => this.removeShieldBtn());
      return;
    }

    this.hits += 1;
    this.timeSinceHitMs = 0;
    this.hype = Math.max(0, this.hype - HYPE_HIT_PENALTY);
    this.refreshLivesHud();
    this.breakCombo();
    if (this.sliding) this.endSlide(false);
    redFlash(this);
    impactBurst(this, this.player.x + 20, this.player.y - 24);
    shake(this, 0.012, 210);
    wxVibrate('medium');
    this.floatText(this.player.x, this.player.y - 60, '-1 顶乌纱帽', '#ff8787');
    // 80ms 顿帧:命中瞬间世界静止,再恢复,打击更实
    this.hitFreezeUntil = this.time.now + 85;
    this.physics.pause();
    this.time.delayedCall(95, () => {
      if (!this.dead && !this.paused) this.physics.resume();
    });

    const left = this.totalLives - this.hits;
    if (left >= 1) {
      this.enterInvulnerable();
      playSfx(this, 'fail', 0.45);
    } else {
      this.dead = true;
      this.die();
    }
  };

  private enterInvulnerable(duration = INVULNERABLE_TIME_MS) {
    this.invulnerable = true;
    const old = this.player.getData('blink') as Phaser.Tweens.Tween | undefined;
    old?.stop();
    const blink = this.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.22 },
      duration: 100,
      yoyo: true,
      repeat: -1
    });
    this.player.setData('blink', blink);
    this.time.delayedCall(duration, () => {
      blink.stop();
      this.player.setAlpha(1);
      this.player.clearTint();
      this.invulnerable = false;
      this.player.setData('blink', undefined);
    });
  }

  /** 本关目标是不是都达标了(至少第一颗星的目标) */
  private goalsAllDone(): boolean {
    if (!this.level) return true;
    const stats = {
      cleared: false, timeMs: this.elapsedMs, dodged: this.dodged,
      nearMisses: this.runNearMisses, perfectSlides: this.runPerfectSlides,
      comboMax: this.comboMax, hits: this.hits, coins: this.runCoins
    };
    return this.level.goals.every(g => goalValue(g, stats) >= g.target);
  }

  private checkNearMiss() {
    if (this.overdriveActive) return;
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    this.obstacleGroup.getChildren().forEach(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      if (!o.active || o.getData('hit') || o.getData('near')) return;
      const ob = o.body as Phaser.Physics.Arcade.Body;
      const horizontal = ob.right > pb.left + 2 && ob.left < pb.right - 2;
      if (!horizontal) return;
      const gap = Math.max(0, Math.max(pb.top - ob.bottom, ob.top - pb.bottom));
      if (!(gap > 0 && gap <= NEAR_MISS_DISTANCE)) return;
      // 关键:只有「贴脸那一瞬间」做的动作才算擦身。
      // 提前起跳 / 提前滑下去、一路等障碍过去,都只是普通翻越,不再白送擦身。
      const clutch = this.sliding
        ? o.getData('tightSlideId') === this.slideId
        : o.getData('tightJumpId') === this.jumpId;
      if (!clutch) return;
      o.setData('near', true);
      this.onNearMiss(o);
    });
  }

  private onNearMiss(o: Phaser.Physics.Arcade.Image) {
    this.runNearMisses += 1;
    const value = this.coinAmount(NEAR_MISS_COINS);
    this.addRunCoins(value);
    this.gainHype(NEAR_MISS_HYPE);
    this.floatText(this.player.x + 26, this.player.y - 58, `擦身! +${value} 银币`, '#b2f2bb');
    nearMissStreak(this, this.player.x + 54, this.player.y);
    playSfx(this, 'near', 0.34);
    if (this.runNearMisses === 3) {
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '擦身大师!继续保持', '#b2f2bb', 'mi-nearmiss');
    }
    void o;
  }

  private checkDodges() {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    this.obstacleGroup.getChildren().forEach(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      if (!o.active || o.getData('counted') || o.getData('hit')) return;
      const ob = o.body as Phaser.Physics.Arcade.Body;
      if (ob.right < pb.left - 6) {
        o.setData('counted', true);
        this.dodged += 1;
        this.onDodge(o);
      }
    });
  }

  private onDodge(o: Phaser.Physics.Arcade.Image) {
    this.combo += 1;
    this.comboMax = Math.max(this.comboMax, this.combo);
    const flyer = !!o.getData('flyer');
    // 完美滑铲:必须在起滑时就已经卡点(贴脸才滑下去),提前滑着等过去只是普通翻越
    const perfectSlide =
      flyer &&
      this.sliding &&
      o.getData('tightSlideId') === this.slideId;
    const comboBonus = this.combo >= COMBO_TIER_2 ? 2 : this.combo >= COMBO_TIER_1 ? 1 : 0;
    const value = this.coinAmount(
      (flyer ? FLYER_COIN_BONUS : 1) + comboBonus + (perfectSlide ? PERFECT_SLIDE_COINS : 0)
    );
    this.addRunCoins(value);
    this.gainHype(HYPE_PER_DODGE + (perfectSlide ? PERFECT_SLIDE_HYPE : 0));
    if (perfectSlide) {
      this.runPerfectSlides += 1;
      this.floatText(this.player.x + 34, this.player.y - 76, `完美滑铲! +${value} 银币`, '#b2f2bb');
      nearMissStreak(this, this.player.x + 58, this.player.y + 4);
      playSfx(this, 'near', 0.4);
    } else {
      this.floatText(this.player.x + 30, this.player.y - 70, `+${value}`);
      playSfx(this, 'coin', 0.15);
    }

    if (this.combo === COMBO_TIER_1) showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '连翻 ×10!银币加倍', '#ffe066', 'mi-combo');
    if (this.combo === COMBO_TIER_2) showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, '连翻 ×25!银币三倍', '#ffe066', 'mi-combo');

    const info = rankProgress(this.dodged);
    this.refreshRankHud();
    if (info.current.index > this.rank.index) {
      this.rank = info.current;
      this.refreshRankHud(true);
      this.rankUp(info.current);
    }
  }

  private rankUp(rank: RunRank) {
    rankBurst(this, this.player.x, this.player.y, this.hexToNum(rank.color));
    this.showBanner(`晋升 ${rank.name}!`, rank.color, 38, 'ui-rank');
    playSfx(this, 'promote', 0.55);
    wxVibrate('medium');
    this.gainHype(10);
    this.addRunCoins(5);
    this.floatText(this.player.x, this.player.y - 100, '升官 +5 银币', '#ffe066');
  }

  private hexToNum(css: string): number {
    const v = parseInt(css.replace('#', ''), 16);
    return Number.isFinite(v) ? v : 0xffd43b;
  }

  private breakCombo() {
    if (this.combo >= 5) showToast(this, GAME_WIDTH / 2, GROUND_TOP - 230, `连击中断(×${this.combo})`, '#ffe066', 'ui-broken-heart');
    this.combo = 0;
    if (this.hud?.combo) {
      this.tweens.killTweensOf(this.hud.combo);
      this.hud.combo.setScale(1).setVisible(false);
      this.hud.comboBg.setVisible(false);
    }
  }

  // ============================================================
  // 银币 / 气势 / 高光
  // ============================================================

  private addRunCoins(n: number) {
    if (n <= 0) return;
    this.runCoins += n;
    this.hud?.coins.setText(`${this.runCoins}`);
  }

  private coinAmount(base: number): number {
    let n = base * this.dailyCoinMul * (this.assetPerks?.coinMul ?? 1);
    if (this.elapsedMs < this.doubleCoinsUntil) n *= 2;
    if (this.overdriveActive) n *= OVERDRIVE_COIN_MULT;
    return Math.max(1, Math.round(n));
  }

  private gainHype(n: number) {
    if (this.overdriveActive || n <= 0) return;
    this.hype = Math.min(HYPE_MAX, this.hype + n);
    if (this.hype >= HYPE_MAX) this.startOverdrive();
  }

  private startOverdrive() {
    if (this.overdriveActive) return;
    this.overdriveActive = true;
    this.overdriveUntil = this.elapsedMs + OVERDRIVE_MS;
    this.overdriveCount += 1;
    this.hype = HYPE_MAX;
    this.player.setTint(0xffe066);
    this.showBanner('高光时刻!', '#ffe066', 44, 'ui-bolt');
    playSfx(this, 'hype', 0.6);
    wxVibrate('medium');
    shake(this, 0.005, 220);
  }

  private updateOverdrive() {
    if (!this.overdriveActive) return;
    const remain = this.overdriveUntil - this.elapsedMs;
    if (remain <= 0) {
      this.overdriveActive = false;
      this.hype = 0;
      this.player.clearTint();
      showToast(this, GAME_WIDTH / 2, GROUND_TOP - 215, '高光结束,继续攒气势!');
      return;
    }
    this.hype = HYPE_MAX * (remain / OVERDRIVE_MS);
  }

  private floatText(x: number, y: number, msg: string, color = '#ffe066') {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: FONT, fontSize: '16px', color, fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(88);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 680,
      ease: 'Quad.out',
      onComplete: () => t.destroy()
    });
  }

  private showBanner(msg: string, color = '#ffe066', size = 40, iconKey?: string) {
    const t = this.add
      .text(0, 0, msg, {
        fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold',
        align: 'center', resolution: 2, stroke: '#08131f', strokeThickness: 7
      })
      .setOrigin(0.5);
    const iconSize = Math.round(size * 0.8);
    const icon = iconKey
      ? this.add.image(0, 0, iconKey).setDisplaySize(iconSize, iconSize)
      : undefined;
    const totalW = icon ? iconSize + 10 + t.width : t.width;
    if (icon) {
      icon.setX(-totalW / 2 + iconSize / 2);
      t.setX(-totalW / 2 + iconSize + 10 + t.width / 2);
    }
    const c = this.add
      .container(GAME_WIDTH / 2, 194, icon ? [icon, t] : [t])
      .setDepth(92)
      .setScale(0.45)
      .setAlpha(0);
    this.tweens.add({ targets: c, scale: 1.08, alpha: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({
      targets: c,
      scale: 1.22,
      alpha: 0,
      delay: 950,
      duration: 380,
      ease: 'Quad.in',
      onComplete: () => c.destroy()
    });
  }

  // ============================================================
  // 手枪 / 贿月 / 巡视组
  // ============================================================

  private fire() {
    if (!this.fireBtn || this.bulletsLeft <= 0 || this.dead || this.paused || this.tutorialStep >= 0) return;
    if (this.time.now < this.canShootAt) return;
    this.canShootAt = this.time.now + SHOOT_COOLDOWN_MS;
    this.bulletsLeft -= 1;
    this.updateBulletsHud();
    const b = this.physics.add.image(this.player.x + 46, this.player.y + 2, 'bullet');
    (b.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.bulletGroup.add(b);
    (b.body as Phaser.Physics.Arcade.Body).setVelocityX(BULLET_SPEED);
    playSfx(this, 'shoot', 0.32);
    wxVibrate('light');
  }

  private activateShield() {
    if (!this.shieldBtn || this.bribeCarried <= 0 || this.shieldActive || this.dead || this.paused || this.tutorialStep >= 0) return;
    this.bribeCarried -= 1;
    this.shieldActive = true;
    this.shieldRing.setVisible(true);
    this.shieldRing.setTint(0xffd43b);
    this.refreshShieldBtn();
    playSfx(this, 'shield', 0.5);
    showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '贿月护体!下次碰撞免伤', '#ffe066', 'ui-moon');
  }

  private updateInspection() {
    if (this.patrolDrone && this.searchlight) {
      const angle = Math.sin(this.elapsedMs * 0.0016) * 13;
      this.searchlight
        .setPosition(this.patrolDrone.x, this.patrolDrone.y + 16)
        .setAngle(angle);
      this.searchlightPool
        ?.setPosition(
          this.patrolDrone.x + Math.sin(Phaser.Math.DegToRad(angle)) * 300,
          GROUND_TOP - 4
        )
        .setAlpha(0.78);
    }
    if (!this.inspectionActive && this.elapsedMs >= this.nextInspectionAt) {
      this.startInspection();
      return;
    }
    if (this.inspectionActive && this.elapsedMs >= this.inspectionUntil) {
      this.endInspection(true);
    }
  }

  private spawnPatrol() {
    if (this.patrolDrone) return;
    const drone = this.add.image(GAME_WIDTH + 100, 66, 'patrol-drone').setDepth(3).setAlpha(0);
    const light = this.add
      .image(drone.x, drone.y + 16, 'searchlight')
      .setOrigin(0.5, 0)
      .setDepth(2)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const pool = this.add
      .image(716, GROUND_TOP - 4, 'light-pool')
      .setDepth(2)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.patrolDrone = drone;
    this.searchlight = light;
    this.searchlightPool = pool;
    this.tweens.add({ targets: [drone, light], x: 716, duration: 900, ease: 'Cubic.out' });
    this.tweens.add({ targets: drone, alpha: 1, duration: 500 });
    this.tweens.add({ targets: light, alpha: 0.28, duration: 700 });
    this.tweens.add({ targets: pool, alpha: 0.78, duration: 700 });
    this.tweens.add({ targets: drone, y: 82, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.time.delayedCall(900, () => {
      if (this.patrolDrone !== drone) return;
      this.tweens.add({ targets: drone, x: 636, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
  }

  private despawnPatrol() {
    const drone = this.patrolDrone;
    const light = this.searchlight;
    const pool = this.searchlightPool;
    this.patrolDrone = undefined;
    this.searchlight = undefined;
    this.searchlightPool = undefined;
    if (drone) {
      this.tweens.killTweensOf(drone);
      this.tweens.add({
        targets: drone, x: GAME_WIDTH + 150, alpha: 0, duration: 620, ease: 'Cubic.in',
        onComplete: () => drone.destroy()
      });
    }
    if (light) {
      this.tweens.killTweensOf(light);
      this.tweens.add({ targets: light, alpha: 0, duration: 420, onComplete: () => light.destroy() });
    }
    if (pool) {
      this.tweens.killTweensOf(pool);
      this.tweens.add({ targets: pool, alpha: 0, duration: 420, onComplete: () => pool.destroy() });
    }
  }

  private startInspection() {
    this.inspectionActive = true;
    this.inspectionUntil = this.elapsedMs + INSPECTION_DURATION_MS;
    const gapMul = this.daily && this.challenge?.modifier.inspectionFast ? 0.58 : 1;
    this.nextInspectionAt =
      this.elapsedMs +
      INSPECTION_DURATION_MS +
      Phaser.Math.Linear(INSPECTION_MIN_GAP_MS, INSPECTION_MAX_GAP_MS, this.rng()) * gapMul;
    alarmPulse(this);
    playSfx(this, 'wave_start', 0.5);
    wxVibrate('medium');
    this.showBanner('巡视组来了!', '#ff8787', 42, 'ui-siren');
    this.spawnPatrol();
  }

  private endInspection(survived: boolean) {
    this.inspectionActive = false;
    this.inspectionUntil = 0;
    this.despawnPatrol();
    if (survived && !this.dead) {
      this.runInspections += 1;
      this.addRunCoins(INSPECTION_REWARD);
      this.gainHype(10);
      playSfx(this, 'wave_clear', 0.5);
      this.showBanner(`平安度过!+${INSPECTION_REWARD} 银币`, '#8ce99a', 34, 'ui-check');
    }
  }

  // ============================================================
  // 本局考核
  // ============================================================

  private getMissionState(): MissionState {
    return {
      dodged: this.dodged,
      comboMax: this.comboMax,
      pickups: this.runPickups,
      elapsedMs: this.elapsedMs,
      kills: this.runKills,
      nearMisses: this.runNearMisses,
      timeSinceHitMs: this.timeSinceHitMs
    };
  }

  private updateMission() {
    if (this.level) {
      // 关卡模式:进度条改成整体的星级目标完成度,文案由 updateHud 负责
      if (this.elapsedMs - this.lastMissionTick < 120) return;
      this.lastMissionTick = this.elapsedMs;
      const stats = this.levelStats(false);
      const hit = this.level.goals.filter(g => goalValue(g, stats) >= g.target).length;
      const missionY = this.daily ? 132 : 104;
      drawBar(this.hud.missionBar, 24, missionY + 52, 228, 4, hit / this.level.goals.length, hit > 0 ? 0x69db7c : 0x74c0fc);
      return;
    }
    if (this.missionCompleted) return;
    if (this.elapsedMs - this.lastMissionTick < 120) return;
    this.lastMissionTick = this.elapsedMs;
    const s = this.getMissionState();
    const value = missionValue(this.mission, s);
    const done = missionDone(this.mission, s);
    const progress = missionProgressText(this.mission, s);
    const desc = `${progress} · 完成 +${this.mission.reward} 银币`;
    if (this.hud.missionDesc.text !== desc) this.hud.missionDesc.setText(desc);
    const missionY = this.daily ? 132 : 104;
    drawBar(
      this.hud.missionBar,
      24,
      missionY + 52,
      228,
      4,
      Math.min(1, value / this.mission.target),
      done ? 0x69db7c : 0x74c0fc
    );
    if (done) this.completeMission();
  }

  private completeMission() {
    if (this.missionCompleted) return;
    this.missionCompleted = true;
    this.missionsCompleted = 1;
    this.addRunCoins(this.mission.reward);
    this.gainHype(16);
    this.hud.missionTitle.setColor('#8ce99a');
    this.hud.missionDesc.setColor('#b2f2bb');
    this.hud.missionDesc.setText(`已完成 · +${this.mission.reward} 银币`);
    this.hud.missionIcon.setTint(0x8ce99a);
    this.tweens.add({ targets: this.hud.missionIcon, scale: 0.88, duration: 160, yoyo: true, ease: 'Quad.out' });
    const missionY = this.daily ? 132 : 104;
    drawBar(this.hud.missionBar, 24, missionY + 52, 228, 4, 1, 0x69db7c);
    showToast(this, GAME_WIDTH / 2, GROUND_TOP - 225, `考核完成:${this.mission.title} +${this.mission.reward} 银币`, '#8ce99a', 'ui-check');
    playSfx(this, 'mission', 0.55);
    wxVibrate('light');
  }

  // ============================================================
  // HUD 刷新
  // ============================================================

  private drawComboChip() {
    const t = this.hud.combo;
    const iconW = 18;
    const gap = 6;
    const total = iconW + gap + t.width;
    const w = Math.max(96, total + 30);
    const x = GAME_WIDTH / 2 - w / 2;
    const g = this.hud.comboBg;
    g.clear();
    g.fillStyle(0x081525, 0.62);
    g.fillRoundedRect(x, 78, w, 26, 13);
    g.lineStyle(1, 0xffffff, 0.16);
    g.strokeRoundedRect(x, 78, w, 26, 13);
    const left = GAME_WIDTH / 2 - total / 2;
    this.hud.comboIcon.setPosition(left + iconW / 2, 91);
    t.setX(left + iconW + gap + t.width / 2);
    g.setVisible(true);
  }

  private updateHud() {
    // 关卡模式显示倒计时,让「还剩几秒」成为持续压力
    const timeStr = this.level
      ? (this.elapsedMs > this.level.durationMs
        ? `加时 ${(Math.max(0, this.level.durationMs + this.overtimeMs - this.elapsedMs) / 1000).toFixed(1)}s`
        : `${(remainingMs(this.level, this.elapsedMs) / 1000).toFixed(1)}s`)
      : `${(this.elapsedMs / 1000).toFixed(1)}s`;
    if (this.hud.time.text !== timeStr) this.hud.time.setText(timeStr);

    // 关卡目标进度(擦身 / 完美滑铲 / 连击…)实时刷新
    if (this.level) {
      const goal = this.levelGoalText();
      if (this.hud.missionDesc.text !== goal) this.hud.missionDesc.setText(goal);
    }

    if (this.combo >= 5) {
      const comboStr = `连翻 ×${this.combo}`;
      const wasHidden = !this.hud.combo.visible;
      if (wasHidden) {
        this.hud.combo.setVisible(true);
        this.hud.comboIcon.setVisible(true);
      }
      if (wasHidden || this.hud.combo.text !== comboStr) {
        this.hud.combo.setText(comboStr);
        this.hud.combo.setColor(
          this.combo >= COMBO_TIER_2 ? '#ff922b' : this.combo >= COMBO_TIER_1 ? '#ffd43b' : '#ffe066'
        );
        this.drawComboChip();
        this.tweens.killTweensOf(this.hud.combo);
        this.hud.combo.setScale(1.26);
        this.tweens.add({ targets: this.hud.combo, scale: 1, duration: 190, ease: 'Back.out' });
      }
    } else if (this.hud.combo.visible) {
      this.hud.combo.setVisible(false);
      this.hud.comboIcon.setVisible(false);
      this.hud.comboBg.setVisible(false);
    }

    const chips: string[] = [];
    if (this.elapsedMs < this.doubleCoinsUntil) chips.push(`银币×2 ${Math.ceil((this.doubleCoinsUntil - this.elapsedMs) / 1000)}s`);
    if (this.elapsedMs < this.slowUntil) chips.push(`减速 ${Math.ceil((this.slowUntil - this.elapsedMs) / 1000)}s`);
    if (this.elapsedMs < this.tempShieldUntil) chips.push(`护盾 ${Math.ceil((this.tempShieldUntil - this.elapsedMs) / 1000)}s`);
    if (this.inspectionActive) chips.push(`巡视中 ${Math.ceil((this.inspectionUntil - this.elapsedMs) / 1000)}s`);
    const chipStr = chips.join('   ·   ');
    if (this.hud.chips.text !== chipStr) this.hud.chips.setText(chipStr);

    if (this.overdriveActive) {
      const remain = Math.max(0, this.overdriveUntil - this.elapsedMs);
      drawBar(this.hud.hypeBar, 360, 62, 260, 10, remain / OVERDRIVE_MS, 0xffd43b);
      const label = `高光 ${(remain / 1000).toFixed(1)}s`;
      if (this.hud.hypeLabel.text !== label) this.hud.hypeLabel.setText(label);
      this.hud.hypeLabel.setColor('#ffe066');
    } else {
      drawBar(this.hud.hypeBar, 360, 62, 260, 10, this.hype / HYPE_MAX, 0xb197fc);
      const label = `气势 ${Math.round(this.hype)}`;
      if (this.hud.hypeLabel.text !== label) this.hud.hypeLabel.setText(label);
      this.hud.hypeLabel.setColor('#d9c7ff');
    }
  }

  private refreshRankHud(force = false) {
    if (!this.hud?.rankBar) return;
    const info = rankProgress(this.dodged);
    const label = info.current.name;
    if (force || this.hud.rank.text !== label) {
      this.hud.rank.setText(label);
      this.hud.rank.setColor(info.current.color);
    }
    const color = this.hexToNum(info.current.color);
    if (this.rankIcon) {
      this.rankIcon.setTint(color);
      if (force) {
        this.rankIcon.setScale(0.5);
        this.tweens.add({ targets: this.rankIcon, scale: 0.66, duration: 180, yoyo: true, ease: 'Quad.out' });
      }
    }
    drawBar(this.hud.rankBar, 150, 51, 187, 7, info.ratio, color);
  }

  private refreshLivesHud() {
    const left = Math.max(0, this.totalLives - this.hits);
    if (this.hud?.lives) this.hud.lives.setText(`×${left}`);
    if (this.heartIcon) {
      this.heartIcon.setTint(left > 0 ? 0xffffff : 0x66788f);
      this.heartIcon.setAlpha(left > 0 ? 1 : 0.7);
    }
  }

  // ============================================================
  // 死亡 / 微信复活 / 结算
  // ============================================================

  private die() {
    if (this.ended) return;
    this.bobTween?.stop();
    this.bobTween = undefined;
    if (this.sliding) this.endSlide(false);
    this.despawnPatrol();
    this.player.setTint(0xff6666);
    this.physics.pause();
    this.hud.combo.setVisible(false);
    this.hud.comboBg.setVisible(false);
    this.hypeAura?.setAlpha(0);
    playSfx(this, 'gameover', 0.5);
    shake(this, 0.01, 260);
    wxVibrate('heavy');

    if (isWx() && !this.reviveUsed) {
      this.showReviveOverlay();
      return;
    }
    this.time.delayedCall(950, () => this.endRun());
  }

  private showReviveOverlay() {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020810, 0.75)
      .setDepth(300)
      .setInteractive();
    const panel = addPanel(this, GAME_WIDTH / 2 - 260, 86, 520, 368, {
      fill: 0x0d2038, fillAlpha: 0.98, stroke: 0xffd43b, strokeAlpha: 0.36, radius: 26
    }).setDepth(301);
    const title = this.add
      .text(GAME_WIDTH / 2, 128, '被鸡煎胃抓了!', {
        fontFamily: FONT, fontSize: '30px', color: '#ff8787', fontStyle: 'bold',
        resolution: 2, stroke: '#08131f', strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(302);
    const sub = this.add
      .text(
        GAME_WIDTH / 2,
        188,
        `已撑过 ${(this.elapsedMs / 1000).toFixed(1)} 秒 · 官阶 ${this.rank.name}\n分享给好友即可原地复活(每局限一次)`,
        { fontFamily: FONT, fontSize: '17px', color: '#ffe066', align: 'center', lineSpacing: 8, resolution: 2, stroke: '#08131f', strokeThickness: 3 }
      )
      .setOrigin(0.5)
      .setDepth(302);
    this.reviveObjects = [dim, panel, title, sub];
    this.reviveObjects.push(...this.makeOverlayButton(GAME_WIDTH / 2, 264, '分享复活', () => this.tryShareRevive(), 302, 'ui-share'));
    this.reviveObjects.push(
      ...this.makeOverlayButton(GAME_WIDTH / 2, 330, '结束本局', () => {
        this.destroyOverlay(this.reviveObjects);
        this.time.delayedCall(320, () => this.endRun());
      })
    );
  }

  private tryShareRevive() {
    wxShare(
      `我在《王博晋升之路》撑过 ${(this.elapsedMs / 1000).toFixed(1)} 秒,官阶 ${this.rank.name},你能超过我吗?`,
      () => this.revive(),
      () => showToast(this, GAME_WIDTH / 2, GROUND_TOP - 200, '分享未完成,再试一次')
    );
  }

  private revive() {
    this.reviveUsed = true;
    this.dead = false;
    this.hits = this.totalLives - 1;
    this.refreshLivesHud();
    this.player.clearTint();
    this.destroyOverlay(this.reviveObjects);
    this.physics.resume();
    this.player.setScale(this.baseScale);
    this.player.setPosition(118, GROUND_TOP - (this.frameH * this.baseScale) / 2);
    this.player.setVelocity(0, 0);
    this.applyStandingBody();
    if (!this.useQiSkin) this.player.play('player-run');
    this.startBob();
    this.hype = Math.max(this.hype, 35);
    this.enterInvulnerable(1800);
    playSfx(this, 'unlock', 0.5);
    wxVibrate('medium');
    showToast(this, GAME_WIDTH / 2, GROUND_TOP - 220, '原地复活!帽子又戴上了', '#ffe066', 'dg-hat');
  }

  private endRun(cleared = false) {
    if (this.ended) return;
    this.ended = true;
    const timeMs = Math.round(this.elapsedMs);
    const prevBest = this.progress.bestTimeMs || 0;
    const isRecord = timeMs > prevBest;
    const rankInfo = rankProgress(this.dodged);

    this.progress.coins += this.runCoins;
    this.progress.totalDodged += this.dodged;
    this.progress.bestTimeMs = Math.max(prevBest, timeMs);
    this.progress.bestDodged = Math.max(this.progress.bestDodged, this.dodged);
    this.progress.bestCombo = Math.max(this.progress.bestCombo, this.comboMax);
    this.progress.totalRuns += 1;
    this.progress.totalTimeMs += timeMs;
    this.progress.totalKills += this.runKills;
    this.progress.totalPickups += this.runPickups;
    this.progress.inspectionsSurvived += this.runInspections;
    this.progress.bestRankIndex = Math.max(this.progress.bestRankIndex || 0, rankInfo.current.index);
    this.progress.missionsDone += this.missionsCompleted;
    this.progress.overdrives += this.overdriveCount;
    this.progress.nearMisses += this.runNearMisses;

    let dailyReward = 0;
    let dailyBestMs = 0;
    let dailyRecord = false;
    let dailyFirst = false;
    if (this.daily) {
      const dr = recordDailyRun(timeMs);
      dailyReward = dr.reward;
      dailyBestMs = dr.bestMs;
      dailyRecord = dr.isRecord;
      dailyFirst = dr.firstToday;
      this.progress.coins += dailyReward;
      this.progress.dailyPlays += 1;
    }

    updateDailyFromRun(this.progress, {
      dodged: this.dodged,
      surviveMs: timeMs,
      kills: this.runKills,
      picked: this.runPickups
    });

    // ---- 闯关模式结算:星级、解锁、奖励 ----
    let levelData: {
      levelId: string;
      levelCleared: boolean;
      levelStars: number;
      levelPrevStars: number;
      levelGoals: { label: string; done: boolean; value: number; target: number }[];
      levelNextId: string | null;
      levelFirstClear: boolean;
      levelReward: number;
      levelName: string;
      levelChapter: number;
      levelEndingLine: string;
      levelStarTotal: number;
      levelMilestones: { stars: number; coins: number; bribeMoon: number; label: string }[];
    } | undefined;
    if (this.level) {
      const stats = this.levelStats(cleared);
      const stars = starCount(this.level, stats);
      const prevStars = this.progress.levelStars[this.level.id] ?? 0;
      const firstClear = cleared && prevStars === 0;
      const reward = cleared ? levelReward(this.level, stars, firstClear) : 0;
      const prevTotal = totalStars(this.progress.levelStars);
      if (cleared) {
        this.progress.levelStars[this.level.id] = Math.max(prevStars, stars);
        this.progress.levelClears += 1;
        this.progress.coins += reward;
      }
      // 累计星数跨过里程碑:当场发奖,给刷星一个即时回报
      const newTotal = totalStars(this.progress.levelStars);
      const claimed = new Set(this.progress.starMilestones ?? []);
      const crossed = newlyReachedMilestones(prevTotal, newTotal).filter(m => !claimed.has(m.stars));
      const milestoneRewards = crossed.map(m => {
        this.progress.coins += m.coins;
        if (m.bribeMoon) this.progress.bribeMoon = Math.min(bribeCarryLimit(this.progress) + 9, this.progress.bribeMoon + m.bribeMoon);
        claimed.add(m.stars);
        return { stars: m.stars, coins: m.coins, bribeMoon: m.bribeMoon ?? 0, label: m.label };
      });
      this.progress.starMilestones = Array.from(claimed).sort((a, b) => a - b);
      const ratio = this.level.durationMs > 0 ? Math.min(1, stats.timeMs / this.level.durationMs) : 0;
      const endingLine = cleared ? clearLine(stars) : landfallLine(this.level, ratio);
      levelData = {
        levelId: this.level.id,
        levelCleared: cleared,
        levelStars: stars,
        levelPrevStars: prevStars,
        levelGoals: this.level.goals.map(g => ({
          label: g.label,
          done: goalValue(g, stats) >= g.target,
          value: goalValue(g, stats),
          target: g.target
        })),
        levelNextId: cleared ? nextLevelId(this.level.id) : this.level.id,
        levelFirstClear: firstClear,
        levelReward: reward,
        levelName: this.level.name,
        levelChapter: this.level.chapter,
        levelEndingLine: endingLine,
        levelStarTotal: newTotal,
        levelMilestones: milestoneRewards
      };
    }
    this.progress.perfectSlides += this.runPerfectSlides;

    const newAch = claimNewAchievements(this.progress);
    saveProgress(this.progress);
    wxUploadBestScore(timeMs);

    this.scene.start('Result', {
      timeMs,
      dodged: this.dodged,
      coins: this.runCoins,
      combo: this.comboMax,
      isRecord,
      newAchievements: newAch.map(a => a.name),
      rankIndex: rankInfo.current.index,
      rankName: rankInfo.current.name,
      rankColor: rankInfo.current.color,
      missionTitle: this.mission.title,
      missionDone: this.missionCompleted,
      missionReward: this.missionCompleted ? this.mission.reward : 0,
      nearMisses: this.runNearMisses,
      overdrives: this.overdriveCount,
      hits: this.hits,
      missionsDone: this.missionsCompleted,
      daily: this.daily,
      dailyReward,
      dailyBestMs,
      dailyRecord,
      dailyFirst,
      dailyModifier: this.daily && this.challenge ? this.challenge.modifier.name : '',
      bestMs: this.progress.bestTimeMs,
      playerTexture: this.shareTexture,
      ...levelData
    });
  }

  // ============================================================
  // 状态重置
  // ============================================================

  private resetRunState() {
    this.tweens.killAll();
    this.bobTween = undefined;
    this.hits = 0;
    this.dead = false;
    this.ended = false;
    this.invulnerable = false;
    this.elapsedMs = 0;
    this.levelFinishing = false;
    this.runPerfectSlides = 0;
    this.distanceSinceSpawn = 0;
    this.nextGapPx = 540;
    this.lastPattern = '';
    this.actionStreak = 0;
    this.dodged = 0;
    this.runCoins = 0;
    this.runKills = 0;
    this.runPickups = 0;
    this.runNearMisses = 0;
    this.runInspections = 0;
    this.combo = 0;
    this.comboMax = 0;
    this.lastOnGroundAt = 0;
    this.lastJumpPressedAt = -10000;
    this.jumpsUsed = 0;
    this.doubleJumpUnlocked = false;
    this.bgm2Switched = false;
    this.nightness = 0;
    this.timeSinceHitMs = 0;
    this.runSpeed = RUN_SPEED_BASE;
    this.sliding = false;
    this.slideUntil = 0;
    this.slideCooldownUntil = 0;
    this.slideQueued = false;
    this.slideId = 0;
    this.airborne = false;
    this.runDustAcc = 0;
    this.hype = 0;
    this.overdriveActive = false;
    this.overdriveUntil = 0;
    this.overdriveCount = 0;
    this.lastWindAt = 0;
    this.lastFlyerWarnAt = 0;
    this.speedLineAcc = 0;
    this.bestAtStart = this.progress.bestTimeMs || 0;
    this.recordBroken = false;
    this.hitFreezeUntil = 0;
    this.patrolDrone = undefined;
    this.searchlight = undefined;
    this.searchlightPool = undefined;
    this.rank = RUN_RANKS[0];
    this.missionCompleted = false;
    this.missionsCompleted = 0;
    this.lastMissionTick = 0;
    this.bulletsLeft = 0;
    this.canShootAt = 0;
    this.nextPickupAt = 9000;
    this.tempShieldUntil = 0;
    this.doubleCoinsUntil = 0;
    this.slowUntil = 0;
    this.inspectionActive = false;
    this.inspectionUntil = 0;
    this.nextInspectionAt = INSPECTION_FIRST_MS;
    this.paused = false;
    this.tutorialStep = -1;
    this.reviveUsed = false;
    this.pointerStartX = 0;
    this.pointerStartY = 0;
    this.pointerStartAt = 0;
    this.swipeTriggered = false;
    this.shieldActive = false;
    this.fireBtn = undefined;
    this.shieldBtn = undefined;
    this.fireBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.shieldBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.stars = [];
    this.clouds = [];
    this.papers = [];
    this.landmarks = [];
    this.landmarkNeons = [];
    this.pauseObjects = [];
    this.tutorialObjects = [];
    this.reviveObjects = [];
    this.pendantIcon = undefined;
    this.heartIcon = undefined;
    this.rankIcon = undefined;
  }
}
