import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import {
  hasCustomHead, saveCustomHead, clearCustomHead, rebuildCustomTextures
} from '../systems/customhead';
import { makeButton, showToast } from '../systems/ui';

const FONT = "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";
const UPLOAD_TEX = 'upload-src';

export default class CustomCharScene extends Phaser.Scene {
  private mode: 'preview' | 'crop' = 'preview';
  private imgBounds = { x: 0, y: 0, w: 0, h: 0 };
  private sel = { x: 0, y: 0, size: 140 };
  private dragging = false;
  private resizing = false;
  private selGraphics?: Phaser.GameObjects.Graphics;

  constructor() { super('CustomChar'); }

  init(data: { mode?: 'preview' | 'crop' }) {
    this.mode = data?.mode ?? 'preview';
  }

  create() {
    if (this.mode === 'crop') {
      this.drawCropMode();
    } else {
      this.drawPreview();
    }
  }

  // ---- 预览模式 ----
  private drawPreview() {
    const custom = hasCustomHead();
    const outline = { stroke: '#1d3557', strokeThickness: 4 };
    this.add.text(GAME_WIDTH / 2, 40, '🎨 自定义人物', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', ...outline, resolution: 2 }).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 84, '上传一张照片,拖动选框选中区域,即可替换主角头部', { fontFamily: FONT, fontSize: '15px', color: '#ffe066', ...outline, resolution: 2 })
      .setOrigin(0.5);

    const previewKey = custom ? 'player-custom-run-1' : 'player-run-1';
    this.add.image(GAME_WIDTH / 2, 290, previewKey).setScale(1.6);

    makeButton(this, GAME_WIDTH / 2, 440, 260, 56, '📷 上传照片', () => this.pickFile(), 20);
    if (custom) {
      makeButton(this, GAME_WIDTH / 2, 500, 260, 44, '↩ 恢复默认主角', () => {
        clearCustomHead();
        showToast(this, GAME_WIDTH / 2, 120, '已恢复默认主角');
        this.scene.restart();
      }, 16);
    }
    makeButton(this, 66, 26, 100, 36, '← 返回', () => this.scene.start('Title'), 15);
  }

  // 浏览器选择文件(小游戏环境不支持,给出提示)
  private pickFile() {
    if ((window as any).__WX_GAME__) {
      showToast(this, GAME_WIDTH / 2, 120, '微信小游戏暂不支持上传,请用网页版或 APP');
      return;
    }
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          try {
            if (this.textures.exists(UPLOAD_TEX)) this.textures.remove(UPLOAD_TEX);
            this.textures.addBase64(UPLOAD_TEX, dataUrl);
          } catch { return; }
          this.scene.restart({ mode: 'crop' });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } catch {
      showToast(this, GAME_WIDTH / 2, 120, '当前环境不支持上传');
    }
  }

  // ---- 裁剪模式 ----
  private drawCropMode() {
    const outline = { stroke: '#1d3557', strokeThickness: 4 };
    this.add.text(GAME_WIDTH / 2, 26, '拖动选框选择头部区域(右下角手柄调大小)', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', ...outline, resolution: 2 }).setOrigin(0.5);

    const tex = this.textures.get(UPLOAD_TEX);
    const dispW = 480;
    const dispH = 340;
    const scale = Math.min(dispW / tex.getSourceImage().width, dispH / tex.getSourceImage().height);
    this.imgBounds = {
      x: GAME_WIDTH / 2 - (tex.getSourceImage().width * scale) / 2,
      y: 250 - (tex.getSourceImage().height * scale) / 2,
      w: tex.getSourceImage().width * scale,
      h: tex.getSourceImage().height * scale
    };

    this.add.image(GAME_WIDTH / 2, 250, UPLOAD_TEX).setDisplaySize(this.imgBounds.w, this.imgBounds.h);

    // 初始选区:图像中央,边长取图像短边的一半(不小于 80)
    this.sel = {
      size: Math.max(80, Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.5)),
      x: GAME_WIDTH / 2 - Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.25),
      y: 250 - Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.25)
    };

    this.selGraphics = this.add.graphics().setDepth(10);
    this.drawSelection();

    // 拖动:框内移动,右下角手柄缩放
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = this.sel;
      const inBox = p.x >= s.x && p.x <= s.x + s.size && p.y >= s.y && p.y <= s.y + s.size;
      const inHandle = Math.abs(p.x - (s.x + s.size)) <= 18 && Math.abs(p.y - (s.y + s.size)) <= 18;
      if (inHandle) { this.resizing = true; this.dragging = false; }
      else if (inBox) { this.dragging = true; this.resizing = false; this.dragOffset = { x: p.x - s.x, y: p.y - s.y }; }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.resizing) {
        const b = this.imgBounds;
        this.sel.size = Phaser.Math.Clamp(Math.max(p.x - this.sel.x, p.y - this.sel.y), 60, Math.min(b.x + b.w - this.sel.x, b.y + b.h - this.sel.y));
        this.drawSelection();
      } else if (this.dragging && this.dragOffset) {
        const b = this.imgBounds;
        this.sel.x = Phaser.Math.Clamp(p.x - this.dragOffset.x, b.x, b.x + b.w - this.sel.size);
        this.sel.y = Phaser.Math.Clamp(p.y - this.dragOffset.y, b.y, b.y + b.h - this.sel.size);
        this.drawSelection();
      }
    });
    this.input.on('pointerup', () => { this.dragging = false; this.resizing = false; });

    makeButton(this, GAME_WIDTH / 2 - 130, 490, 200, 48, '✓ 确认替换头部', () => this.confirm(), 17);
    makeButton(this, GAME_WIDTH / 2 + 130, 490, 200, 48, '✗ 取消', () => this.scene.restart(), 17);
  }

  private dragOffset?: { x: number; y: number };

  private drawSelection() {
    const g = this.selGraphics;
    if (!g) return;
    g.clear();
    const s = this.sel;
    const b = this.imgBounds;
    // 选区外半透明遮罩
    g.fillStyle(0x000000, 0.45);
    g.fillRect(b.x, b.y, b.w, s.y - b.y);
    g.fillRect(b.x, s.y + s.size, b.w, b.y + b.h - (s.y + s.size));
    g.fillRect(b.x, s.y, s.x - b.x, s.size);
    g.fillRect(s.x + s.size, s.y, b.x + b.w - (s.x + s.size), s.size);
    // 选框
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(s.x, s.y, s.size, s.size);
    // 右下角手柄
    g.fillStyle(0xffffff, 1);
    g.fillRect(s.x + s.size - 9, s.y + s.size - 9, 18, 18);
  }

  private confirm() {
    const tex = this.textures.get(UPLOAD_TEX);
    const ix = ((this.sel.x - this.imgBounds.x) / this.imgBounds.w) * tex.getSourceImage().width;
    const iy = ((this.sel.y - this.imgBounds.y) / this.imgBounds.h) * tex.getSourceImage().height;
    const isz = (this.sel.size / this.imgBounds.w) * tex.getSourceImage().width;
    const src = tex.getSourceImage() as HTMLImageElement;

    const crop = this.textures.createCanvas('__crop', 120, 120);
    if (!crop) return;
    const ctx = crop.getContext();
    ctx.drawImage(src, ix, iy, isz, isz, 0, 0, 120, 120);
    crop.refresh();
    const dataUrl = (crop.getSourceImage() as HTMLCanvasElement).toDataURL('image/png');
    this.textures.remove('__crop');

    saveCustomHead(dataUrl);
    rebuildCustomTextures(this);
    showToast(this, GAME_WIDTH / 2, 120, '✅ 已替换主角头部!');
    this.scene.restart();
  }
}
