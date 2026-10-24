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


  // ---- 举报信:技能「实名举报」的投掷物 ----
  tex(scene, 'dg-letter', 44, 32, (ctx) => {
    ctx.save();
    ctx.translate(22, 16);
    ctx.rotate(-0.12);
    // 信封
    const g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, '#f5f0e2');
    g.addColorStop(1, '#d8cdb2');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 2;
    rrect(ctx, -20, -13, 40, 26, 3);
    ctx.fill();
    ctx.stroke();
    // 封口三角
    ctx.strokeStyle = '#a8763a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -13);
    ctx.lineTo(0, 2);
    ctx.lineTo(20, -13);
    ctx.stroke();
    // 红色「举报」章
    ctx.fillStyle = '#c92a2a';
    ctx.beginPath();
    ctx.arc(9, 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('举', 9, 6);
    ctx.restore();
  });

  // ---- 护体光环:技能「金句护体」 ----
  tex(scene, 'dg-burst', 320, 320, (ctx) => {
    const g = ctx.createRadialGradient(160, 160, 20, 160, 160, 160);
    g.addColorStop(0, 'rgba(255,236,160,0.85)');
    g.addColorStop(0.45, 'rgba(255,212,59,0.34)');
    g.addColorStop(1, 'rgba(255,212,59,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(160, 160, 160, 0, Math.PI * 2);
    ctx.fill();
    // 外圈虚线
    ctx.strokeStyle = 'rgba(255,236,160,0.9)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = a0 + 0.12;
      ctx.beginPath();
      ctx.arc(160, 160, 142, a0, a1);
      ctx.stroke();
    }
  });


  // ---- 技能图标:护体(金印) ----
  tex(scene, 'dg-skill-shield', 40, 40, (ctx) => {
    const g = ctx.createRadialGradient(20, 20, 4, 20, 20, 20);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.6, '#ffd43b');
    g.addColorStop(1, '#e8a100');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(20, 20, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(20, 20, 17, 0, Math.PI * 2);
    ctx.stroke();
    // 四道光芒
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(20 + Math.cos(a) * 10, 20 + Math.sin(a) * 10);
      ctx.lineTo(20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a1414';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('护', 20, 21);
  });


  // ---- 远程兵:戴眼镜拿手机,专门打小报告 ----
  tex(scene, 'dg-thrower', 56, 64, (ctx) => {
    const body = ctx.createLinearGradient(0, 18, 0, 64);
    body.addColorStop(0, '#4a3f5e');
    body.addColorStop(1, '#221c30');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#0d131b';
    ctx.lineWidth = 3;
    rrect(ctx, 11, 20, 34, 42, 9);
    ctx.fill();
    ctx.stroke();
    // 头
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(28, 17, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1428';
    ctx.beginPath();
    ctx.arc(28, 13, 13, Math.PI, 0);
    ctx.fill();
    // 眼镜
    ctx.strokeStyle = '#8ce99a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(23, 18, 4, 0, Math.PI * 2);
    ctx.arc(33, 18, 4, 0, Math.PI * 2);
    ctx.moveTo(27, 18);
    ctx.lineTo(29, 18);
    ctx.stroke();
    // 手机(举起来)
    ctx.fillStyle = '#cfe3ff';
    rrect(ctx, 40, 24, 12, 20, 2);
    ctx.fill();
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = 1.5;
    rrect(ctx, 40, 24, 12, 20, 2);
    ctx.stroke();
    ctx.fillStyle = '#69db7c';
    ctx.fillRect(42, 28, 8, 12);
    // 手
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(38, 34, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 冲锋兵:壮汉,肩膀上扛着东西 ----
  tex(scene, 'dg-charger', 62, 68, (ctx) => {
    const body = ctx.createLinearGradient(0, 16, 0, 68);
    body.addColorStop(0, '#5a3a3a');
    body.addColorStop(1, '#2a1414');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#0d131b';
    ctx.lineWidth = 3;
    rrect(ctx, 8, 20, 46, 46, 12);
    ctx.fill();
    ctx.stroke();
    // 头(小,脖子粗)
    ctx.fillStyle = '#d9a97a';
    ctx.beginPath();
    ctx.arc(31, 15, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a0f0f';
    ctx.beginPath();
    ctx.arc(31, 11, 12, Math.PI, 0);
    ctx.fill();
    // 怒眉 + 眼
    ctx.strokeStyle = '#1a0f0f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.lineTo(28, 16);
    ctx.moveTo(40, 12);
    ctx.lineTo(34, 16);
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(26, 19, 2.6, 0, Math.PI * 2);
    ctx.arc(36, 19, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // 肩上的麻袋
    ctx.fillStyle = '#8a6a3a';
    rrect(ctx, 34, 6, 26, 18, 6);
    ctx.fill();
    ctx.strokeStyle = '#3a2a12';
    ctx.lineWidth = 2;
    rrect(ctx, 34, 6, 26, 18, 6);
    ctx.stroke();
  });

  // ---- 宝箱 ----
  tex(scene, 'dg-chest', 56, 48, (ctx) => {
    const g = ctx.createLinearGradient(0, 10, 0, 48);
    g.addColorStop(0, '#a8763a');
    g.addColorStop(1, '#6a4520');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2a1800';
    ctx.lineWidth = 2.5;
    rrect(ctx, 4, 14, 48, 32, 5);
    ctx.fill();
    ctx.stroke();
    // 盖
    ctx.fillStyle = '#c08a44';
    ctx.beginPath();
    ctx.moveTo(4, 16);
    ctx.quadraticCurveTo(28, -2, 52, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 锁扣
    ctx.fillStyle = '#ffd43b';
    rrect(ctx, 23, 22, 10, 12, 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.5;
    rrect(ctx, 23, 22, 10, 12, 2);
    ctx.stroke();
    // 铁箍
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(16, 46);
    ctx.moveTo(40, 16);
    ctx.lineTo(40, 46);
    ctx.stroke();
  });

  // ---- 茅台:攻击力提升 ----
  tex(scene, 'dg-wine', 30, 44, (ctx) => {
    ctx.fillStyle = '#f5f0e2';
    rrect(ctx, 6, 10, 18, 32, 4);
    ctx.fill();
    ctx.strokeStyle = '#b0a488';
    ctx.lineWidth = 2;
    rrect(ctx, 6, 10, 18, 32, 4);
    ctx.stroke();
    // 瓶颈
    ctx.fillStyle = '#f5f0e2';
    ctx.fillRect(11, 2, 8, 9);
    ctx.strokeRect(11, 2, 8, 9);
    // 红标
    ctx.fillStyle = '#c92a2a';
    rrect(ctx, 8, 18, 14, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('茅', 15, 26);
  });

  // ---- 购物卡:回人脉 ----
  tex(scene, 'dg-card', 40, 28, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 40, 28);
    g.addColorStop(0, '#ffd43b');
    g.addColorStop(1, '#e8590c');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 2;
    rrect(ctx, 2, 3, 36, 22, 4);
    ctx.fill();
    ctx.stroke();
    // 芯片
    ctx.fillStyle = '#fff3bf';
    rrect(ctx, 6, 8, 8, 6, 1.5);
    ctx.fill();
    // 磁条
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(2, 17, 36, 4);
    ctx.fillStyle = '#7a1414';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('购物卡', 24, 10);
  });

  // ---- 检查点:小红旗 ----
  tex(scene, 'dg-flag', 36, 56, (ctx) => {
    ctx.strokeStyle = '#9db8d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(8, 54);
    ctx.stroke();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.lineTo(32, 12);
    ctx.lineTo(9, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 底座
    ctx.fillStyle = '#4a5a6a';
    rrect(ctx, 2, 50, 14, 6, 2);
    ctx.fill();
  });

  // ---- 敌人举报信(飞行道具) ----
  tex(scene, 'dg-enemy-letter', 36, 26, (ctx) => {
    ctx.fillStyle = '#f0e8d8';
    ctx.strokeStyle = '#c92a2a';
    ctx.lineWidth = 2;
    rrect(ctx, -16, -11, 32, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#c92a2a';
    ctx.beginPath();
    ctx.moveTo(-16, -11);
    ctx.lineTo(0, 1);
    ctx.lineTo(16, -11);
    ctx.stroke();
  });


  // ---- 房产证:红皮本子,拿到乌纱帽上限 +1 ----
  tex(scene, 'dg-deed', 44, 34, (ctx) => {
    // 封皮
    const g = ctx.createLinearGradient(0, 0, 0, 34);
    g.addColorStop(0, '#c92a2a');
    g.addColorStop(1, '#8a1414');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#4a0808';
    ctx.lineWidth = 2;
    rrect(ctx, 3, 4, 38, 26, 3);
    ctx.fill();
    ctx.stroke();
    // 内页边缘
    ctx.fillStyle = '#f5f0e2';
    ctx.fillRect(6, 28, 32, 3);
    // 国徽感圆章
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(14, 17, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a1414';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('房', 14, 17);
    // 文字
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('房产证', 22, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '7px sans-serif';
    ctx.fillText('不动产权证', 22, 24);
  });


  // ---- 人脉:名片(技能资源图标) ----
  tex(scene, 'dg-renmai', 30, 22, (ctx) => {
    ctx.fillStyle = '#e7f5ff';
    ctx.strokeStyle = '#4a90c2';
    ctx.lineWidth = 1.8;
    rrect(ctx, 2, 3, 26, 16, 3);
    ctx.fill();
    ctx.stroke();
    // 头像
    ctx.fillStyle = '#74c0fc';
    ctx.beginPath();
    ctx.arc(9, 11, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // 文字线
    ctx.fillStyle = '#9db8d8';
    ctx.fillRect(15, 8, 10, 1.8);
    ctx.fillRect(15, 13, 8, 1.8);
  });

  // ---- 平台边缘高光条 ----
  tex(scene, 'dg-edge', 8, 8, (ctx) => {
    ctx.fillStyle = 'rgba(150,220,255,0.55)';
    ctx.fillRect(0, 0, 8, 3);
  });
}
