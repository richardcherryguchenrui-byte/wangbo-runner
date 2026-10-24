// 「留置室」横版闯关专用贴图:全部用 Canvas 程序化绘制,
// 保证任何分辨率下都清晰,也不额外增加资源体积。
import Phaser from 'phaser';

function tex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const ctx = t.getContext();
  draw(ctx, w, h);
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

export function buildDungeonTextures(scene: Phaser.Scene) {
  // ---- 小兵:黑西装、红眼、揣着手,一看就是跑腿的 ----
  tex(scene, 'dg-enemy', 56, 64, (ctx) => {
    // 身体
    const body = ctx.createLinearGradient(0, 16, 0, 64);
    body.addColorStop(0, '#3b4a5e');
    body.addColorStop(1, '#1d2733');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#0d131b';
    ctx.lineWidth = 3;
    rrect(ctx, 10, 18, 36, 44, 10);
    ctx.fill();
    ctx.stroke();
    // 头
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(28, 16, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 头发
    ctx.fillStyle = '#151c25';
    ctx.beginPath();
    ctx.arc(28, 12, 13, Math.PI, 0);
    ctx.fill();
    // 红眼
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.arc(23, 17, 2.6, 0, Math.PI * 2);
    ctx.arc(33, 17, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // 领带
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.moveTo(28, 28);
    ctx.lineTo(23, 36);
    ctx.lineTo(28, 52);
    ctx.lineTo(33, 36);
    ctx.closePath();
    ctx.fill();
    // 手
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(9, 44, 5, 0, Math.PI * 2);
    ctx.arc(47, 44, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- BOSS:巡视组长,大头、领章、举着文件夹 ----
  tex(scene, 'dg-boss', 108, 124, (ctx) => {
    // 大衣
    const coat = ctx.createLinearGradient(0, 40, 0, 124);
    coat.addColorStop(0, '#2b3648');
    coat.addColorStop(1, '#12161e');
    ctx.fillStyle = coat;
    ctx.strokeStyle = '#05080d';
    ctx.lineWidth = 4;
    rrect(ctx, 18, 44, 72, 78, 16);
    ctx.fill();
    ctx.stroke();
    // 头
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(54, 38, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 帽子
    ctx.fillStyle = '#0f1620';
    rrect(ctx, 24, 10, 60, 20, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f1620';
    rrect(ctx, 16, 26, 76, 9, 4);
    ctx.fill();
    // 眼睛(凶)
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(44, 42, 4.4, 0, Math.PI * 2);
    ctx.arc(64, 42, 4.4, 0, Math.PI * 2);
    ctx.fill();
    // 眉毛
    ctx.strokeStyle = '#0b1017';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(37, 33);
    ctx.lineTo(49, 37);
    ctx.moveTo(71, 33);
    ctx.lineTo(59, 37);
    ctx.stroke();
    // 领章
    ctx.fillStyle = '#c92a2a';
    rrect(ctx, 40, 66, 28, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    rrect(ctx, 48, 69, 12, 6, 2);
    ctx.fill();
    // 文件夹
    ctx.fillStyle = '#8a5200';
    rrect(ctx, 78, 66, 26, 34, 4);
    ctx.fill();
    ctx.strokeStyle = '#2a1800';
    ctx.lineWidth = 2;
    rrect(ctx, 78, 66, 26, 34, 4);
    ctx.stroke();
    ctx.fillStyle = '#ffe8b3';
    rrect(ctx, 82, 72, 18, 20, 2);
    ctx.fill();
  });

  // ---- 出口门 ----
  tex(scene, 'dg-door', 84, 120, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#2a3d57');
    g.addColorStop(1, '#101a26');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#6ea8e0';
    ctx.lineWidth = 3;
    rrect(ctx, 4, 4, 76, 116, 10);
    ctx.fill();
    ctx.stroke();
    // 玻璃格
    ctx.fillStyle = 'rgba(120,190,255,0.35)';
    rrect(ctx, 16, 18, 52, 40, 6);
    ctx.fill();
    // 把手
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(66, 78, 5, 0, Math.PI * 2);
    ctx.fill();
    // 门牌
    ctx.fillStyle = '#c92a2a';
    rrect(ctx, 22, 70, 40, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('出口', 42, 78);
  });

  // ---- 尖刺 ----
  tex(scene, 'dg-spike', 36, 26, (ctx) => {
    ctx.fillStyle = '#b9c6d4';
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const x = i * 12;
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x + 6, 2);
      ctx.lineTo(x + 12, 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });

  // ---- 冲刺残影 ----
  tex(scene, 'dg-ghost', 64, 96, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, 'rgba(120,200,255,0.55)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    rrect(ctx, 4, 4, 56, 88, 14);
    ctx.fill();
  });

  // ---- 平台边缘高光条 ----
  tex(scene, 'dg-edge', 8, 8, (ctx) => {
    ctx.fillStyle = 'rgba(150,220,255,0.55)';
    ctx.fillRect(0, 0, 8, 3);
  });
}
