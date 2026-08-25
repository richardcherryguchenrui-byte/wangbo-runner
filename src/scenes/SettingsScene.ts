import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadAudioSettings, saveAudioSettings, soundMult, startBgm, stopBgm } from '../systems/audio';
import { makeButton, showToast } from '../systems/ui';

const FONT = "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";
const LEVELS = ['低', '中', '高'] as const;
const BAR_X = GAME_WIDTH / 2 - 150; // 音量条左端
const SEG_W = 100;                  // 每段宽度

export default class SettingsScene extends Phaser.Scene {
  private knob!: Phaser.GameObjects.Arc;
  private levelText!: Phaser.GameObjects.Text;
  private muteLabel!: Phaser.GameObjects.Text;
  private dragging = false;
  private settings = loadAudioSettings();

  constructor() { super('Settings'); }

  create() {
    const outline = { stroke: '#1d3557', strokeThickness: 4 };
    this.add.text(GAME_WIDTH / 2, 60, '⚙️ 设置', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', ...outline, resolution: 2 }).setOrigin(0.5);

    // ---- 音量:低/中/高三段拖动条 ----
    const barY = 260;
    this.add.text(GAME_WIDTH / 2, 180, '音量(拖动选择)', { fontFamily: FONT, fontSize: '20px', color: '#ffe066', ...outline, resolution: 2 }).setOrigin(0.5);

    // 三段底色
    const segColors = [0x4dabf7, 0x69db7c, 0xff922b];
    const segRects = LEVELS.map((label, i) => {
      const rect = this.add
        .rectangle(BAR_X + i * SEG_W + SEG_W / 2, barY, SEG_W - 6, 36, segColors[i], 0.9)
        .setStrokeStyle(2, 0xffffff, 0.6)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(BAR_X + i * SEG_W + SEG_W / 2, barY, label, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', resolution: 2 })
        .setOrigin(0.5);
      rect.on('pointerdown', () => this.setLevel(i));
      return rect;
    });

    // 滑块
    this.knob = this.add
      .circle(BAR_X + this.settings.volume * SEG_W + SEG_W / 2, barY, 16, 0xffffff)
      .setStrokeStyle(4, 0x1d3557)
      .setDepth(10)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.knob.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const rel = Phaser.Math.Clamp(dragX - BAR_X, 0, SEG_W * 3 - 1);
      this.setLevel(Math.floor(rel / SEG_W));
    });
    this.knob.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const rel = Phaser.Math.Clamp(pointer.x - BAR_X, 0, SEG_W * 3 - 1);
      this.setLevel(Math.floor(rel / SEG_W));
    });

    this.levelText = this.add
      .text(GAME_WIDTH / 2, 320, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', ...outline, resolution: 2 })
      .setOrigin(0.5);

    // ---- 静音开关 ----
    this.muteLabel = this.add
      .text(GAME_WIDTH / 2, 390, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', ...outline, resolution: 2 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.muteLabel.on('pointerdown', () => {
      this.settings.mute = !this.settings.mute;
      saveAudioSettings(this.settings);
      this.refreshLabels();
      // 立即生效:静音则停掉正在播的 BGM,开启则按新音量继续
      if (this.settings.mute) stopBgm(this);
      else startBgm(this);
      showToast(this, GAME_WIDTH / 2, GAME_HEIGHT - 80, this.settings.mute ? '🔇 已静音' : '🔊 声音已开启');
    });
    this.refreshLabels();

    makeButton(this, GAME_WIDTH / 2, 470, 220, 52, '← 返回主界面', () => this.scene.start('Title'), 18);
  }

  private setLevel(level: number) {
    const l = Math.min(2, Math.max(0, Math.round(level))) as 0 | 1 | 2;
    if (this.settings.volume === l) return;
    this.settings.volume = l;
    saveAudioSettings(this.settings);
    this.refreshLabels();
    // 立即生效:按新音量重新应用正在播的 BGM
    startBgm(this);
  }

  private refreshLabels() {
    this.knob.setPosition(BAR_X + this.settings.volume * SEG_W + SEG_W / 2, 260);
    this.levelText.setText(`当前音量:${LEVELS[this.settings.volume]}(${Math.round(soundMult() * 100)}%)`);
    this.muteLabel.setText(this.settings.mute ? '🔇 已静音(点击开启)' : '🔊 声音开启(点击静音)');
  }
}
