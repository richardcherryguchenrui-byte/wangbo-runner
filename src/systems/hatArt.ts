// 乌纱帽贴图:本作把「生命」具象成官帽,一顶帽子一条命。
// 放在通用模块里,跑酷模式与横版模式共用同一套图标。
import Phaser from 'phaser';

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

export function buildHatTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('dg-hat')) return;
  const t = scene.textures.createCanvas('dg-hat', 38, 26);
  if (!t) return;
  const ctx = t.getContext();
  ctx.save();
  ctx.translate(2, 1);
  // 帽翅
  ctx.fillStyle = '#12161e';
  ctx.strokeStyle = '#05080d';
  ctx.lineWidth = 1.6;
  rrect(ctx, 0, 10, 9, 5, 2.4);
  ctx.fill();
  ctx.stroke();
  rrect(ctx, 25, 10, 9, 5, 2.4);
  ctx.fill();
  ctx.stroke();
  // 帽身
  const g = ctx.createLinearGradient(0, 2, 0, 22);
  g.addColorStop(0, '#2b3648');
  g.addColorStop(1, '#0b0f16');
  ctx.fillStyle = g;
  rrect(ctx, 7, 3, 20, 17, 5);
  ctx.fill();
  ctx.stroke();
  // 帽檐
  ctx.fillStyle = '#1a2230';
  rrect(ctx, 5, 17, 24, 5, 2.4);
  ctx.fill();
  ctx.stroke();
  // 帽正
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(17, 9, 2.8, 0, Math.PI * 2);
  ctx.fill();
  // 金色描边
  ctx.strokeStyle = 'rgba(255,212,59,0.75)';
  ctx.lineWidth = 1.2;
  rrect(ctx, 7, 3, 20, 17, 5);
  ctx.stroke();
  ctx.restore();
  t.refresh();
}
