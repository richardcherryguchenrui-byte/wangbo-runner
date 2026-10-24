import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import {
  hasCustomHead, saveCustomHead, clearCustomHead, rebuildCustomTextures
} from '../systems/customhead';
import { makeButton, makeHeroButton, showToast, FONT } from '../systems/ui';
import { buildMenuBackdrop, buildMenuHeader, addMenuCard, addMenuFooter } from '../systems/menu';
import { wxChooseImage } from '../systems/wxapi';

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
    buildMenuBackdrop(this, { mood: 'night' });
    buildMenuHeader(this, '自定义人物', '上传一张照片,把主角的脸换成你的', {});

    // 左侧舞台
    addMenuCard(this, 120, 120, 360, 340, { depth: 21, radius: 22 });
    this.add.image(300, 138, 'spotlight').setOrigin(0.5, 0).setDepth(22).setAlpha(0.3).setScale(0.9);
    this.add.image(300, 438, 'shadow').setDepth(22).setScale(2.0, 0.7).setAlpha(0.7);
    this.add.ellipse(300, 436, 230, 22, 0xffd43b, 0.08).setDepth(22);
    const previewKey = custom ? 'player-custom-run-1' : 'player-run-1';
    const hero = this.add.image(300, 430, previewKey).setOrigin(0.5, 1).setDepth(23).setScale(1.9);
    this.tweens.add({ targets: hero, scaleY: 1.94, scaleX: 1.88, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add
      .text(300, 456, custom ? '当前:你的自定义头像' : '当前:默认主角', {
        fontFamily: FONT, fontSize: '12px', color: custom ? '#8ce99a' : '#93b5d6', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0.5, 1)
      .setDepth(24);

    // 右侧说明
    addMenuCard(this, 510, 120, 410, 210, { depth: 21 });
    this.add
      .text(532, 142, '三步换脸', {
        fontFamily: FONT, fontSize: '18px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      })
      .setDepth(22);
    const steps = [
      '1  点击「上传照片」,选择一张清晰的正面照',
      '2  拖动白色选框框住头部,右下手柄可缩放',
      '3  确认后立即生效,游戏里和结算页同步换脸'
    ];
    steps.forEach((line, i) => {
      this.add
        .text(532, 178 + i * 34, line, {
          fontFamily: FONT, fontSize: '12px', color: '#cfe3ff', resolution: 2, lineSpacing: 4
        })
        .setDepth(22);
    });
    this.add
      .text(532, 300, '小提示:正脸、光线均匀、头部占画面一半效果最好', {
        fontFamily: FONT, fontSize: '10px', color: '#7f9cbd', resolution: 2
      })
      .setDepth(22);

    makeHeroButton(this, 715, 372, 300, 56, '上传照片', () => this.pickFile(), { iconKey: 'ui-camera', iconSize: 23, fontSize: 19, depth: 22 });
    if (custom) {
      makeButton(this, 715, 440, 300, 42, '恢复默认主角', () => {
        clearCustomHead();
        showToast(this, GAME_WIDTH / 2, 500, '已恢复默认主角');
        this.scene.restart();
      }, 14, { depth: 22, iconKey: 'ui-restart', iconSize: 15 });
    } else {
      this.add
        .text(715, 440, '只有你自己能看到这个头像,本机保存', {
          fontFamily: FONT, fontSize: '10px', color: '#7f9cbd', resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);
    }

    addMenuFooter(this, '头像只保存在本机,不会上传服务器');
  }

  // 选择图片:网页用文件选择,微信小游戏用 wx.chooseImage
  private async pickFile() {
    if ((window as any).__WX_GAME__) {
      const path = await wxChooseImage();
      if (!path) return; // 用户取消
      const img = document.createElement('img') as any;
      img.onload = () => {
        try {
          const c = document.createElement('canvas') as HTMLCanvasElement;
          c.width = img.width || 256;
          c.height = img.height || 256;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('no ctx');
          ctx.drawImage(img, 0, 0);
          const dataUrl = c.toDataURL('image/png');
          if (this.textures.exists(UPLOAD_TEX)) this.textures.remove(UPLOAD_TEX);
          this.textures.addBase64(UPLOAD_TEX, dataUrl);
          this.scene.restart({ mode: 'crop' });
        } catch {
          showToast(this, GAME_WIDTH / 2, 120, '图片处理失败,换一张试试');
        }
      };
      img.onerror = () => showToast(this, GAME_WIDTH / 2, 120, '图片加载失败,换一张试试');
      img.src = path;
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
      showToast(this, GAME_WIDTH / 2, 120, '当前环境不支持上传', '#ff9999', 'ui-close');
    }
  }

  // ---- 裁剪模式 ----
  private drawCropMode() {
    buildMenuBackdrop(this, { mood: 'night' });
    buildMenuHeader(this, '调整头像', '拖动选框框住头部 · 右下角手柄缩放', {});

    const tex = this.textures.get(UPLOAD_TEX);
    const dispW = 480;
    const dispH = 320;
    const scale = Math.min(dispW / tex.getSourceImage().width, dispH / tex.getSourceImage().height);
    this.imgBounds = {
      x: GAME_WIDTH / 2 - (tex.getSourceImage().width * scale) / 2,
      y: 252 - (tex.getSourceImage().height * scale) / 2,
      w: tex.getSourceImage().width * scale,
      h: tex.getSourceImage().height * scale
    };

    this.add.image(GAME_WIDTH / 2, 252, UPLOAD_TEX).setDisplaySize(this.imgBounds.w, this.imgBounds.h).setDepth(21);
    // 图片外框
    const frame = this.add.graphics().setDepth(22);
    frame.lineStyle(2, 0xffffff, 0.25);
    frame.strokeRect(this.imgBounds.x - 2, this.imgBounds.y - 2, this.imgBounds.w + 4, this.imgBounds.h + 4);

    // 初始选区:图像中央,边长取图像短边的一半(不小于 80)
    this.sel = {
      size: Math.max(80, Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.5)),
      x: GAME_WIDTH / 2 - Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.25),
      y: 252 - Math.round(Math.min(this.imgBounds.w, this.imgBounds.h) * 0.25)
    };

    this.selGraphics = this.add.graphics().setDepth(30);
    this.drawSelection();

    // 拖动:框内移动,右下角手柄缩放
    // 相机放大后 pointer.x/y 是画布像素,这里一律用世界坐标
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = this.sel;
      const px = p.worldX;
      const py = p.worldY;
      const inBox = px >= s.x && px <= s.x + s.size && py >= s.y && py <= s.y + s.size;
      const inHandle = Math.abs(px - (s.x + s.size)) <= 18 && Math.abs(py - (s.y + s.size)) <= 18;
      if (inHandle) { this.resizing = true; this.dragging = false; }
      else if (inBox) { this.dragging = true; this.resizing = false; this.dragOffset = { x: px - s.x, y: py - s.y }; }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const px = p.worldX;
      const py = p.worldY;
      if (this.resizing) {
        const b = this.imgBounds;
        this.sel.size = Phaser.Math.Clamp(Math.max(px - this.sel.x, py - this.sel.y), 60, Math.min(b.x + b.w - this.sel.x, b.y + b.h - this.sel.y));
        this.drawSelection();
      } else if (this.dragging && this.dragOffset) {
        const b = this.imgBounds;
        this.sel.x = Phaser.Math.Clamp(px - this.dragOffset.x, b.x, b.x + b.w - this.sel.size);
        this.sel.y = Phaser.Math.Clamp(py - this.dragOffset.y, b.y, b.y + b.h - this.sel.size);
        this.drawSelection();
      }
    });
    this.input.on('pointerup', () => { this.dragging = false; this.resizing = false; });

    makeButton(this, GAME_WIDTH / 2 - 130, 480, 200, 48, '确认替换头部', () => this.confirm(), 17, { depth: 40, iconKey: 'ui-check', iconSize: 16 });
    makeButton(this, GAME_WIDTH / 2 + 130, 480, 200, 48, '取消', () => this.scene.restart(), 17, { depth: 40, iconKey: 'ui-close', iconSize: 16 });
    addMenuFooter(this, '建议只框住头部 · 可随时重新上传');
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
    showToast(this, GAME_WIDTH / 2, 120, '已替换主角头部!', '#8ce99a', 'ui-check');
    this.scene.restart();
  }
}
