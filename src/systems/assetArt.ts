// 贪污资产专属图标:程序化绘制,避免和商店/地标图标撞脸
import Phaser from 'phaser';

function tex(
  scene: Phaser.Scene, key: string, w: number, h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const ctx = t.getContext();
  draw(ctx);
  t.refresh();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function buildAssetIcons(scene: Phaser.Scene) {
  // 小金库:保险箱
  tex(scene, 'as-purse', 32, 32, (ctx) => {
    ctx.fillStyle = '#3a4a5e';
    ctx.strokeStyle = '#0d131b';
    ctx.lineWidth = 2;
    rrect(ctx, 5, 7, 22, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(16, 17, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(9, 24, 14, 2);
  });

  // 情妇别墅:小洋楼
  tex(scene, 'as-villa', 32, 32, (ctx) => {
    ctx.fillStyle = '#e8d5c0';
    ctx.strokeStyle = '#6a4520';
    ctx.lineWidth = 1.8;
    rrect(ctx, 8, 14, 16, 13, 2);
    ctx.fill();
    ctx.stroke();
    // 屋顶
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.moveTo(4, 15);
    ctx.lineTo(16, 5);
    ctx.lineTo(28, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 门
    ctx.fillStyle = '#6a4520';
    ctx.fillRect(14, 20, 4, 7);
  });

  // 关联公司:写字楼
  tex(scene, 'as-shell', 32, 32, (ctx) => {
    ctx.fillStyle = '#2b3d55';
    ctx.strokeStyle = '#0d131b';
    ctx.lineWidth = 1.8;
    rrect(ctx, 7, 6, 18, 22, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8fd0ff';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(10 + c * 7, 9 + r * 5, 4, 3);
      }
    }
  });

  // 干股煤矿:矿镐 + 煤块
  tex(scene, 'as-mine', 32, 32, (ctx) => {
    ctx.fillStyle = '#20262e';
    ctx.beginPath();
    ctx.ellipse(12, 24, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 22);
    ctx.lineTo(26, 8);
    ctx.stroke();
    ctx.strokeStyle = '#b9c6d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 6);
    ctx.quadraticCurveTo(27, 4, 30, 11);
    ctx.stroke();
  });

  // 海外账户:地球 + 卡片
  tex(scene, 'as-offshore', 32, 32, (ctx) => {
    ctx.fillStyle = '#1c4f7c';
    ctx.beginPath();
    ctx.arc(14, 14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(14, 14, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 14);
    ctx.lineTo(24, 14);
    ctx.moveTo(14, 4);
    ctx.quadraticCurveTo(20, 14, 14, 24);
    ctx.stroke();
    // 卡片
    ctx.fillStyle = '#ffd43b';
    rrect(ctx, 16, 20, 14, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#8a5200';
    ctx.fillRect(18, 23, 10, 1.6);
  });

  // 学区房炒房团:一排楼房 + 涨价箭头
  tex(scene, 'as-estate', 32, 32, (ctx) => {
    const bars = [[6, 18], [12, 12], [18, 8], [24, 4]];
    bars.forEach(([x, top]) => {
      ctx.fillStyle = '#33465e';
      ctx.fillRect(x, top + 6, 5, 24 - top - 6);
      ctx.strokeStyle = '#0d131b';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, top + 6, 5, 24 - top - 6);
    });
    // 上升箭头
    ctx.strokeStyle = '#8ce99a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(16, 8);
    ctx.lineTo(26, 2);
    ctx.stroke();
    ctx.fillStyle = '#8ce99a';
    ctx.beginPath();
    ctx.moveTo(26, 1);
    ctx.lineTo(29, 6);
    ctx.lineTo(23, 6);
    ctx.closePath();
    ctx.fill();
  });
}
