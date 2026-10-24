import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GAME_VERSION } from '../config/constants';
import { loadAudioSettings, saveAudioSettings, soundMult, startBgm, stopBgm } from '../systems/audio';
import { makeButton, showToast, FONT } from '../systems/ui';
import { buildMenuBackdrop, buildMenuHeader, addMenuCard, addMenuFooter, addSectionTitle } from '../systems/menu';
import { exportSaveText, importSaveText, copyToClipboard, readFromClipboard, resetAllSaves } from '../systems/savebackup';

const LEVELS = ['低', '中', '高'] as const;
const BAR_X = 330; // 音量条左端
const SEG_W = 100; // 每段宽度

export default class SettingsScene extends Phaser.Scene {
  private knob!: Phaser.GameObjects.Arc;
  private volumeTrack!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private muteLabel!: Phaser.GameObjects.Text;
  private muteIcon!: Phaser.GameObjects.Image;
  private muteTrack!: Phaser.GameObjects.Graphics;
  private muteKnob!: Phaser.GameObjects.Arc;
  private segGraphics: Phaser.GameObjects.Graphics[] = [];
  private dragging = false;
  private settings = loadAudioSettings();
  private confirmReset = false;

  constructor() { super('Settings'); }

  create() {
    buildMenuBackdrop(this, { mood: 'night' });
    buildMenuHeader(this, '设置', '声音、存档与重置,都在这里', { coins: undefined });

    this.add
      .text(GAME_WIDTH - 24, 35, `v${GAME_VERSION}`, {
        fontFamily: FONT, fontSize: '13px', color: '#93b5d6', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(1, 0.5)
      .setDepth(22);

    // ---- 音量 ----
    addSectionTitle(this, 230, 116, '音量', '#ffe066', 20, 'ui-speaker');
    addMenuCard(this, 220, 128, 520, 128, { depth: 21 });
    this.add
      .text(GAME_WIDTH / 2, 146, '拖动滑块或点击档位,立即生效', {
        fontFamily: FONT, fontSize: '11px', color: '#93b5d6', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(22);

    const barY = 186;
    const segColors = [0x4dabf7, 0x69db7c, 0xff922b];
    LEVELS.forEach((label, i) => {
      const cx = BAR_X + i * SEG_W + SEG_W / 2;
      const active = this.settings.volume === i;
      const g = this.add.graphics().setDepth(22);
      this.segGraphics.push(g);
      g.fillStyle(segColors[i], active ? 0.95 : 0.32);
      g.fillRoundedRect(BAR_X + i * SEG_W + 3, barY - 19, SEG_W - 6, 38, 12);
      g.lineStyle(1.5, 0xffffff, active ? 0.7 : 0.16);
      g.strokeRoundedRect(BAR_X + i * SEG_W + 3, barY - 19, SEG_W - 6, 38, 12);
      this.add
        .text(cx, barY, label, {
          fontFamily: FONT, fontSize: '17px', color: '#ffffff', fontStyle: 'bold', resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(23);
      const hit = this.add
        .rectangle(cx, barY, SEG_W - 6, 38, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(24);
      hit.on('pointerdown', () => this.setLevel(i));
    });

    // 滑块:放在档位下方,不遮挡文字;轨道让拖动范围一眼可见
    this.volumeTrack = this.add.graphics().setDepth(21);
    this.knob = this.add
      .circle(BAR_X + this.settings.volume * SEG_W + SEG_W / 2, 212, 5.5, 0xfff3c4)
      .setStrokeStyle(2, 0x7a4a00)
      .setDepth(25)
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
      .text(GAME_WIDTH / 2, 232, '', { fontFamily: FONT, fontSize: '13px', color: '#cfe3ff', resolution: 2 })
      .setOrigin(0.5)
      .setDepth(22);

    // ---- 静音 ----
    addSectionTitle(this, 230, 276, '声音开关', '#ffe066', 20, 'ui-bell');
    addMenuCard(this, 220, 288, 520, 52, { depth: 21 });
    this.muteIcon = this.add
      .image(252, 314, 'ui-speaker')
      .setDisplaySize(20, 20)
      .setDepth(23);
    this.muteLabel = this.add
      .text(270, 314, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold', resolution: 2 })
      .setOrigin(0, 0.5)
      .setDepth(23);
    this.muteTrack = this.add.graphics().setDepth(22);
    this.muteKnob = this.add.circle(0, 314, 11, 0xffffff).setDepth(23);
    const muteHit = this.add
      .rectangle(GAME_WIDTH / 2 - 20, 314, 500, 52, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(24);
    muteHit.on('pointerdown', () => this.toggleMute());
    this.refreshLabels();

    // ---- 存档备份 ----
    addSectionTitle(this, 230, 366, '存档备份', '#ffe066', 20, 'ui-save');
    addMenuCard(this, 220, 378, 520, 84, { depth: 21 });
    this.add
      .text(730, 366, '换设备 / 防丢失', { fontFamily: FONT, fontSize: '10px', color: '#b7cfe8', resolution: 2 })
      .setOrigin(1, 0.5)
      .setDepth(21);
    makeButton(this, 330, 410, 140, 42, '导出存档', () => this.doExport(), 13, { depth: 22, iconKey: 'ui-share', iconSize: 15 });
    makeButton(this, 480, 410, 140, 42, '导入存档', () => this.doImport(), 13, { depth: 22, iconKey: 'ui-download', iconSize: 15 });
    makeButton(this, 630, 410, 140, 42, '重置进度', () => this.doReset(), 13, { fill: 0x4a1f2a, depth: 22, iconKey: 'ui-trash', iconSize: 15 });
    this.add
      .text(GAME_WIDTH / 2, 444, '导出会复制一段存档文本,粘贴到备忘录保存;导入时再粘贴回来', {
        fontFamily: FONT, fontSize: '10px', color: '#9db8d8', resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(21);

    makeButton(this, GAME_WIDTH / 2, 488, 240, 46, '返回主界面', () => this.scene.start('Title'), 16, { depth: 22, iconKey: 'ui-home', iconSize: 16 });
    addMenuFooter(this, '设置只影响本机,不会上传任何数据');
  }

  private toggleMute() {
    this.settings.mute = !this.settings.mute;
    saveAudioSettings(this.settings);
    this.refreshLabels();
    if (this.settings.mute) stopBgm(this);
    else startBgm(this);
    showToast(this, GAME_WIDTH / 2, 504, this.settings.mute ? '已静音' : '声音已开启', '#ffe066', this.settings.mute ? 'ui-mute' : 'ui-speaker');
  }

  private doExport() {
    const text = exportSaveText();
    copyToClipboard(text).then(ok => {
      if (ok) {
        showToast(this, GAME_WIDTH / 2, 504, '存档已复制!粘贴保存到备忘录即可', '#8ce99a', 'ui-check');
      } else {
        showToast(this, GAME_WIDTH / 2, 504, '复制失败:请用 https 网页版或微信小游戏导出', '#ff9999');
      }
    });
  }

  private doImport() {
    readFromClipboard().then(text => {
      if (text === null) {
        showToast(this, GAME_WIDTH / 2, 504, '无法读取剪贴板(需 https 网页版或微信小游戏)', '#ff9999');
        return;
      }
      const err = importSaveText(text);
      if (err) {
        showToast(this, GAME_WIDTH / 2, 504, err, '#ff9999', 'ui-close');
      } else {
        showToast(this, GAME_WIDTH / 2, 504, '导入成功!存档已恢复', '#8ce99a', 'ui-check');
        this.time.delayedCall(1200, () => this.scene.start('Title'));
      }
    });
  }

  private doReset() {
    if (!this.confirmReset) {
      this.confirmReset = true;
      showToast(this, GAME_WIDTH / 2, 504, '再点一次将清空全部进度!', '#ff9999', 'ui-tips');
      this.time.delayedCall(3000, () => { this.confirmReset = false; });
      return;
    }
    resetAllSaves();
    showToast(this, GAME_WIDTH / 2, 504, '已重置全部进度');
    this.time.delayedCall(1000, () => this.scene.start('Title'));
  }

  private setLevel(level: number) {
    const l = Math.min(2, Math.max(0, Math.round(level))) as 0 | 1 | 2;
    if (this.settings.volume === l) return;
    this.settings.volume = l;
    saveAudioSettings(this.settings);
    this.refreshLabels();
    startBgm(this);
  }

  private refreshLabels() {
    this.knob.setPosition(BAR_X + this.settings.volume * SEG_W + SEG_W / 2, 212);
    this.levelText.setText(`当前音量:${LEVELS[this.settings.volume]}(${Math.round(soundMult() * 100)}%)`);
    this.volumeTrack.clear();
    this.volumeTrack.fillStyle(0x08131f, 0.55);
    this.volumeTrack.fillRoundedRect(BAR_X, 210, SEG_W * 3, 4, 2);
    this.volumeTrack.fillStyle(0xffd43b, 0.9);
    this.volumeTrack.fillRoundedRect(BAR_X, 210, this.settings.volume * SEG_W + SEG_W / 2, 4, 2);

    const segColors = [0x4dabf7, 0x69db7c, 0xff922b];
    this.segGraphics.forEach((g, i) => {
      const active = this.settings.volume === i;
      g.clear();
      g.fillStyle(segColors[i], active ? 0.95 : 0.32);
      g.fillRoundedRect(BAR_X + i * SEG_W + 3, 167, SEG_W - 6, 38, 12);
      g.lineStyle(1.5, 0xffffff, active ? 0.7 : 0.16);
      g.strokeRoundedRect(BAR_X + i * SEG_W + 3, 167, SEG_W - 6, 38, 12);
    });

    this.muteIcon.setTexture(this.settings.mute ? 'ui-mute' : 'ui-speaker');
    this.muteLabel.setText(this.settings.mute ? '已静音 · 点击开启声音' : '声音开启 · 点击静音');
    const trackX = 660;
    const trackY = 314;
    this.muteTrack.clear();
    this.muteTrack.fillStyle(this.settings.mute ? 0x3a4a5e : 0x2b8a3e, 0.95);
    this.muteTrack.fillRoundedRect(trackX - 32, trackY - 14, 64, 28, 14);
    this.muteTrack.lineStyle(1.4, 0xffffff, 0.24);
    this.muteTrack.strokeRoundedRect(trackX - 32, trackY - 14, 64, 28, 14);
    this.muteKnob.setPosition(trackX + (this.settings.mute ? -16 : 16), trackY);
    this.muteKnob.setFillStyle(this.settings.mute ? 0x9db8d8 : 0xffffff);
  }
}
