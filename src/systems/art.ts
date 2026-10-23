// 程序化美术:视差城市、日月、道具图标、暗角等
// 全部用 Canvas 生成,不依赖外部图片,网页/小游戏/桌面端一致。
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 兼容性圆角矩形(微信小游戏 / 老 Safari 不一定有 ctx.roundRect)
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function buildArtTextures(scene: Phaser.Scene) {
  // ---- 远山:两层柔和山脊 ----
  makeCanvas(scene, 'bg-mountains', 480, 190, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#7db4dc');
    bg.addColorStop(1, '#4f82b8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#3d6da5';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, 118);
    ctx.quadraticCurveTo(60, 54, 130, 108);
    ctx.quadraticCurveTo(190, 150, 250, 92);
    ctx.quadraticCurveTo(320, 34, 390, 108);
    ctx.quadraticCurveTo(440, 154, 480, 104);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4b7fb4';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, 148);
    ctx.quadraticCurveTo(80, 116, 150, 146);
    ctx.quadraticCurveTo(230, 180, 310, 138);
    ctx.quadraticCurveTo(390, 96, 480, 148);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 山顶亮边
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 148);
    ctx.quadraticCurveTo(80, 116, 150, 146);
    ctx.quadraticCurveTo(230, 180, 310, 138);
    ctx.quadraticCurveTo(390, 96, 480, 148);
    ctx.stroke();
  });

  // ---- 远景城市:低对比度楼群 + 灯光 ----
  makeCanvas(scene, 'bg-city-far', 480, 190, (ctx, w, h) => {
    const r = rnd(9021);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const bw = 14 + r() * 30;
      const bh = 40 + r() * 112;
      const x = r() * w;
      const y = h - bh;
      ctx.fillStyle = `rgba(35,78,124,${0.72 + r() * 0.25})`;
      ctx.fillRect(x, y, bw, bh);
      if (r() > 0.55) ctx.fillRect(x + bw / 2 - 1, y - 10, 2, 10);
      // 窗灯
      ctx.fillStyle = `rgba(255,222,140,${0.36 + r() * 0.3})`;
      for (let wy = y + 9; wy < h - 6; wy += 11) {
        for (let wx = x + 4; wx < x + bw - 3; wx += 8) {
          if (r() > 0.42) ctx.fillRect(wx, wy, 2, 3);
        }
      }
    }
    // 底部雾
    const fog = ctx.createLinearGradient(0, h - 60, 0, h);
    fog.addColorStop(0, 'rgba(160,205,235,0)');
    fog.addColorStop(1, 'rgba(160,205,235,0.48)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, h - 60, w, 60);
  });

  // ---- 近景城市:更深的剪影,含纪委大楼和红旗 ----
  makeCanvas(scene, 'bg-city-near', 480, 200, (ctx, w, h) => {
    const r = rnd(7733);
    ctx.clearRect(0, 0, w, h);
    const buildings: [number, number, number][] = [
      [-10, 54, 86], [50, 40, 116], [96, 58, 70], [160, 48, 138], [214, 62, 92],
      [284, 38, 122], [328, 54, 78], [386, 46, 108], [438, 58, 92]
    ];
    for (const [x, bw, bh] of buildings) {
      const y = h - bh;
      const g = ctx.createLinearGradient(0, y, 0, h);
      g.addColorStop(0, '#1e3f66');
      g.addColorStop(1, '#132c4c');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, bw, bh);
      // 楼顶造型
      if (r() > 0.5) {
        ctx.fillStyle = '#16304f';
        ctx.fillRect(x + 6, y - 7, bw - 12, 7);
      }
      // 窗灯
      for (let wy = y + 12; wy < h - 8; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 5; wx += 11) {
          if (r() > 0.46) {
            ctx.fillStyle = r() > 0.8 ? 'rgba(255,236,170,0.9)' : 'rgba(255,214,120,0.55)';
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
    // 主楼(纪委大楼):更高,带天线与红色标牌
    ctx.fillStyle = '#17395e';
    ctx.fillRect(160, 18, 96, h - 18);
    ctx.fillStyle = '#112c4a';
    ctx.fillRect(160, 18, 96, 12);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(205, 0, 4, 20);
    ctx.beginPath();
    ctx.moveTo(209, 2);
    ctx.lineTo(236, 9);
    ctx.lineTo(209, 16);
    ctx.closePath();
    ctx.fill();
    for (let wy = 38; wy < h - 10; wy += 15) {
      for (let wx = 170; wx < 246; wx += 12) {
        if (r() > 0.4) {
          ctx.fillStyle = r() > 0.82 ? '#ffe9a8' : 'rgba(255,216,130,0.48)';
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
    // 底部道路暗影
    ctx.fillStyle = 'rgba(8,20,38,0.55)';
    ctx.fillRect(0, h - 10, w, 10);
  });

  // ---- 太阳 / 月亮(带光晕)----
  makeCanvas(scene, 'sun', 240, 240, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 118);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.22, 'rgba(255,236,150,0.95)');
    g.addColorStop(0.5, 'rgba(255,200,90,0.26)');
    g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff9dc';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'moon', 200, 200, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 98);
    g.addColorStop(0, 'rgba(240,248,255,0.95)');
    g.addColorStop(0.3, 'rgba(190,220,255,0.28)');
    g.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 98, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef6ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,190,225,0.45)';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 6, 7, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy + 8, 5, 0, Math.PI * 2);
    ctx.arc(cx + 2, cy - 14, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 暗角:让画面中心更聚焦 ----
  makeCanvas(scene, 'vignette', GAME_WIDTH, GAME_HEIGHT, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.86);
    g.addColorStop(0, 'rgba(8,18,34,0)');
    g.addColorStop(0.72, 'rgba(8,18,34,0.08)');
    g.addColorStop(1, 'rgba(5,12,24,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // ---- 银币 ----
  makeCanvas(scene, 'coin', 40, 40, (ctx, w, h) => {
    const cx = 20, cy = 20;
    const g = ctx.createRadialGradient(14, 13, 3, cx, cy, 19);
    g.addColorStop(0, '#fff5b0');
    g.addColorStop(0.45, '#ffd43b');
    g.addColorStop(1, '#f08c00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b36b00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,220,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8a5200';
    ctx.font = 'bold 17px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¥', cx, cy + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(13, 11, 5, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 道具图标 ----
  makeCanvas(scene, 'item-bag', 52, 52, (ctx) => {
    ctx.save();
    ctx.translate(26, 28);
    // 袋身
    const g = ctx.createLinearGradient(-18, -10, 18, 20);
    g.addColorStop(0, '#a5673f');
    g.addColorStop(1, '#6b3f24');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.quadraticCurveTo(-22, 22, 0, 22);
    ctx.quadraticCurveTo(22, 22, 18, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a2a16';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 袋口
    ctx.fillStyle = '#c98d55';
    ctx.beginPath();
    ctx.ellipse(0, -7, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 金币
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#b36b00';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-4, -16, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(8, -18, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a5200';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('¥', -4, -13);
    ctx.restore();
  });

  makeCanvas(scene, 'item-shield', 52, 52, (ctx) => {
    ctx.save();
    ctx.translate(26, 26);
    const g = ctx.createLinearGradient(0, -20, 0, 22);
    g.addColorStop(0, '#8ed7ff');
    g.addColorStop(1, '#2f86d6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(19, -13);
    ctx.quadraticCurveTo(18, 11, 0, 22);
    ctx.quadraticCurveTo(-18, 11, -19, -13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8f7ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
    ctx.restore();
  });

  makeCanvas(scene, 'item-double', 52, 52, (ctx) => {
    ctx.save();
    ctx.translate(26, 26);
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#ff922b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b35a00';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#7a3b00';
    ctx.font = 'bold 17px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', 0, 1);
    ctx.restore();
  });

  makeCanvas(scene, 'item-slow', 52, 52, (ctx) => {
    ctx.save();
    ctx.translate(26, 26);
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24);
    g.addColorStop(0, '#b2f2bb');
    g.addColorStop(1, '#2f9e44');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c6b2d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -13);
    ctx.moveTo(0, 0); ctx.lineTo(10, 5);
    ctx.stroke();
    ctx.restore();
  });

  makeCanvas(scene, 'item-hype', 52, 52, (ctx) => {
    ctx.save();
    ctx.translate(26, 26);
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24);
    g.addColorStop(0, '#e5c6ff');
    g.addColorStop(1, '#7048e8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a2a9e';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath();
    ctx.moveTo(4, -19);
    ctx.lineTo(-11, 3);
    ctx.lineTo(-1, 3);
    ctx.lineTo(-5, 20);
    ctx.lineTo(12, -5);
    ctx.lineTo(1, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // ---- 天空景深:顶部压暗、地平线微暖,让纯色天空不再平 ----
  makeCanvas(scene, 'sky-depth', GAME_WIDTH, GAME_HEIGHT, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(5,18,38,0.30)');
    g.addColorStop(0.42, 'rgba(5,18,38,0.03)');
    g.addColorStop(0.68, 'rgba(255,240,200,0.06)');
    g.addColorStop(1, 'rgba(255,240,200,0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // ---- HUD 图标:统一跨平台字形,避免 emoji 在 Windows / 安卓上变灰块 ----
  makeCanvas(scene, 'ui-heart', 36, 34, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 30);
    g.addColorStop(0, '#ff9a9a');
    g.addColorStop(1, '#c92a2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(18, 30);
    ctx.bezierCurveTo(2, 19, 2, 7, 10, 7);
    ctx.bezierCurveTo(14, 7, 17, 9, 18, 12);
    ctx.bezierCurveTo(19, 9, 22, 7, 26, 7);
    ctx.bezierCurveTo(34, 7, 34, 19, 18, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.ellipse(12, 12, 4.2, 2.4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'ui-moon', 36, 36, (ctx) => {
    ctx.save();
    const g = ctx.createRadialGradient(14, 13, 3, 18, 18, 16);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.55, '#ffd43b');
    g.addColorStop(1, '#e8a100');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(18, 18, 15, 0, Math.PI * 2);
    ctx.fill();
    // 挖出月牙,透出按钮底色
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(25, 13, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff9db';
    ctx.beginPath();
    ctx.arc(9, 9, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  makeCanvas(scene, 'ui-bullet', 30, 16, (ctx) => {
    ctx.save();
    const g = ctx.createLinearGradient(0, 2, 0, 14);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.45, '#ffd43b');
    g.addColorStop(1, '#e8a100');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.lineTo(20, 4);
    ctx.lineTo(28, 8);
    ctx.lineTo(20, 12);
    ctx.lineTo(2, 12);
    ctx.quadraticCurveTo(0, 8, 2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(5, 5, 11, 2);
    ctx.restore();
  });

  // ---- 通用 UI 图标:时钟 / 官阶星章 / 完成勾 / 目标 / 闪电 / 奖杯 / 红包 ----
  makeCanvas(scene, 'ui-clock', 36, 36, (ctx) => {
    // 干净表盘:小尺寸下也能一眼读出「时间」
    ctx.fillStyle = '#f8fbff';
    ctx.beginPath();
    ctx.arc(18, 19, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c4f7c';
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.strokeStyle = '#1c4f7c';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(18 + Math.cos(a) * 9.5, 19 + Math.sin(a) * 9.5);
      ctx.lineTo(18 + Math.cos(a) * 11.5, 19 + Math.sin(a) * 11.5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#10233d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 19);
    ctx.lineTo(18, 11.5);
    ctx.moveTo(18, 19);
    ctx.lineTo(24, 22.5);
    ctx.stroke();
    ctx.fillStyle = '#e03131';
    ctx.beginPath();
    ctx.arc(18, 19, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'ui-rank', 40, 40, (ctx) => {
    // 星章:去掉外圈,只留带柔光的五角星,小尺寸下更干净
    const glow = ctx.createRadialGradient(20, 20, 3, 20, 20, 19);
    glow.addColorStop(0, 'rgba(255,255,255,0.34)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(20, 20, 19, 0, Math.PI * 2);
    ctx.fill();
    const star = (r1: number, r2: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? r1 : r2;
        const x = 20 + Math.cos(a) * r;
        const y = 20 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, 5, 0, 35);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#f1f7ff');
    g.addColorStop(1, '#cfe3ff');
    ctx.fillStyle = g;
    star(15, 6.2);
    ctx.fill();
    ctx.strokeStyle = '#0d2038';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // 左上高光,让星章有金属感
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(20, 7);
    ctx.lineTo(23, 14);
    ctx.lineTo(20, 13);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'ui-check', 32, 32, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 28);
    g.addColorStop(0, '#8ce99a');
    g.addColorStop(1, '#2f9e44');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(9.5, 16.5);
    ctx.lineTo(14, 21);
    ctx.lineTo(22.5, 11);
    ctx.stroke();
  });

  makeCanvas(scene, 'ui-clipboard', 32, 32, (ctx) => {
    ctx.fillStyle = '#8a6a43';
    ctx.fillRect(7, 6, 18, 23);
    ctx.fillStyle = '#f1e3c8';
    ctx.fillRect(9, 8, 14, 19);
    ctx.fillStyle = '#c9b28c';
    ctx.fillRect(12, 4, 8, 5);
    ctx.fillStyle = '#8a6a43';
    ctx.fillRect(12, 3, 8, 4);
    ctx.strokeStyle = '#6b5738';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 13); ctx.lineTo(20, 13);
    ctx.moveTo(12, 17); ctx.lineTo(20, 17);
    ctx.moveTo(12, 21); ctx.lineTo(17, 21);
    ctx.stroke();
  });

  makeCanvas(scene, 'ui-target', 36, 36, (ctx) => {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(18, 18, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff5f5';
    ctx.beginPath(); ctx.arc(18, 18, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(18, 18, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff5f5';
    ctx.beginPath(); ctx.arc(18, 18, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(18, 18, 15, 0, Math.PI * 2); ctx.stroke();
  });

  makeCanvas(scene, 'ui-bolt', 30, 38, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 34);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.5, '#ffd43b');
    g.addColorStop(1, '#f59f00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(5, 21);
    ctx.lineTo(13, 21);
    ctx.lineTo(10, 36);
    ctx.lineTo(25, 15);
    ctx.lineTo(16, 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  makeCanvas(scene, 'ui-trophy', 38, 38, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 30);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.5, '#ffd43b');
    g.addColorStop(1, '#e8a100');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.8;
    // 杯身
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(28, 6);
    ctx.quadraticCurveTo(28, 24, 19, 26);
    ctx.quadraticCurveTo(10, 24, 10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 杯把
    ctx.beginPath();
    ctx.arc(9, 12, 6, Math.PI * 0.5, Math.PI * 1.5, true);
    ctx.arc(29, 12, 6, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.stroke();
    // 底座
    ctx.fillStyle = '#c98d55';
    ctx.fillRect(15, 26, 8, 5);
    ctx.fillStyle = '#8a5200';
    ctx.fillRect(10, 31, 18, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(13, 9, 3, 9);
  });

  makeCanvas(scene, 'ui-envelope', 36, 36, (ctx) => {
    ctx.fillStyle = '#c92a2a';
    roundRectPath(ctx, 3, 8, 30, 21, 3);
    ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ff8787';
    ctx.beginPath();
    ctx.moveTo(4, 9);
    ctx.lineTo(18, 21);
    ctx.lineTo(32, 9);
    ctx.lineTo(32, 13);
    ctx.lineTo(18, 24);
    ctx.lineTo(4, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(18, 20, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5200';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('¥', 18, 22);
  });

  // ---- 单局考核图标:统一为手绘徽章,避免 emoji 跨平台差异 ----
  const miGold = (ctx: CanvasRenderingContext2D, y0 = 4, y1 = 28) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#fff3bf');
    g.addColorStop(0.55, '#ffd43b');
    g.addColorStop(1, '#f0a500');
    return g;
  };

  makeCanvas(scene, 'mi-dodge', 32, 32, (ctx) => {
    // 跨栏 + 金色弧线箭头
    ctx.strokeStyle = '#cfe3ff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5, 25); ctx.lineTo(27, 25);
    ctx.moveTo(7.5, 25); ctx.lineTo(7.5, 30);
    ctx.moveTo(24.5, 25); ctx.lineTo(24.5, 30);
    ctx.stroke();
    ctx.strokeStyle = miGold(ctx, 3, 21);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(5, 21);
    ctx.bezierCurveTo(8, 4, 23, 3, 27, 16);
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(28, 19.5);
    ctx.lineTo(21.5, 14);
    ctx.lineTo(29, 12.5);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'mi-survive', 32, 32, (ctx) => {
    // 秒表
    ctx.fillStyle = '#cfe3ff';
    ctx.fillRect(14, 2.5, 4, 3);
    ctx.fillRect(2.5, 13, 2.5, 4);
    const g = miGold(ctx, 5, 30);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(16, 18, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#fffdf5';
    ctx.beginPath(); ctx.arc(16, 18, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a8794';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(16 + Math.cos(a) * 6, 18 + Math.sin(a) * 6);
      ctx.lineTo(16 + Math.cos(a) * 7.4, 18 + Math.sin(a) * 7.4);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e03131';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(16, 12.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(20.4, 20); ctx.stroke();
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(16, 18, 1.6, 0, Math.PI * 2); ctx.fill();
  });

  makeCanvas(scene, 'mi-pickup', 32, 32, (ctx) => {
    // 礼盒
    const box = ctx.createLinearGradient(0, 12, 0, 29);
    box.addColorStop(0, '#ff8787');
    box.addColorStop(1, '#c92a2a');
    ctx.fillStyle = box;
    roundRectPath(ctx, 6, 13, 20, 15, 2.5);
    ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#ff6b6b';
    roundRectPath(ctx, 4, 9, 24, 6, 2);
    ctx.fill();
    ctx.stroke();
    const g = miGold(ctx, 9, 28);
    ctx.fillStyle = g;
    ctx.fillRect(14, 9, 4, 19);
    ctx.beginPath();
    ctx.ellipse(11.5, 7, 5.5, 3.2, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20.5, 7, 5.5, 3.2, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(11.5, 7, 5.5, 3.2, -0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(20.5, 7, 5.5, 3.2, 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(9, 16, 2, 8);
  });

  makeCanvas(scene, 'mi-combo', 32, 32, (ctx) => {
    // 火焰
    const outer = ctx.createLinearGradient(0, 2, 0, 30);
    outer.addColorStop(0, '#ff922b');
    outer.addColorStop(1, '#e03131');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(17, 2);
    ctx.bezierCurveTo(24, 9, 28, 13, 27, 20);
    ctx.bezierCurveTo(26, 27, 21, 30, 16, 30);
    ctx.bezierCurveTo(9, 30, 5, 25, 6, 18);
    ctx.bezierCurveTo(6.5, 14, 9, 11, 11, 9);
    ctx.bezierCurveTo(11.5, 14, 13, 16, 15, 17);
    ctx.bezierCurveTo(15, 12, 16, 7, 17, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a2c00';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const inner = ctx.createLinearGradient(0, 12, 0, 29);
    inner.addColorStop(0, '#fff3bf');
    inner.addColorStop(1, '#ffd43b');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(16, 12);
    ctx.bezierCurveTo(21, 17, 23, 21, 21, 25);
    ctx.bezierCurveTo(20, 28, 17, 29, 15, 27);
    ctx.bezierCurveTo(12, 24, 13, 19, 16, 12);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'mi-kill', 32, 32, (ctx) => {
    // 准星
    ctx.strokeStyle = '#cfe3ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(16, 16, 9.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(16, 16, 4.4, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 1.5); ctx.lineTo(16, 5);
    ctx.moveTo(16, 27); ctx.lineTo(16, 30.5);
    ctx.moveTo(1.5, 16); ctx.lineTo(5, 16);
    ctx.moveTo(27, 16); ctx.lineTo(30.5, 16);
    ctx.stroke();
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(16, 16, 2.3, 0, Math.PI * 2); ctx.fill();
  });

  makeCanvas(scene, 'mi-nearmiss', 32, 32, (ctx) => {
    // 警告三角 + 速度线
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.5, 12); ctx.lineTo(4.5, 12);
    ctx.moveTo(0, 17); ctx.lineTo(4, 17);
    ctx.stroke();
    ctx.fillStyle = miGold(ctx, 4, 29);
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 3.5);
    ctx.lineTo(29, 27);
    ctx.lineTo(3, 27);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3d2a00';
    roundRectPath(ctx, 14.6, 11, 2.8, 9, 1.4);
    ctx.fill();
    ctx.beginPath(); ctx.arc(16, 23.4, 1.6, 0, Math.PI * 2); ctx.fill();
  });

  makeCanvas(scene, 'mi-flawless', 32, 32, (ctx) => {
    // 盾牌 + 对勾(绿色,和无伤语义一致)
    const g = ctx.createLinearGradient(0, 3, 0, 30);
    g.addColorStop(0, '#d3f9d8');
    g.addColorStop(0.5, '#69db7c');
    g.addColorStop(1, '#2f9e44');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 2.5);
    ctx.lineTo(27, 6.5);
    ctx.lineTo(27, 15);
    ctx.bezierCurveTo(27, 23, 21, 28, 16, 30);
    ctx.bezierCurveTo(11, 28, 5, 23, 5, 15);
    ctx.lineTo(5, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath();
    ctx.moveTo(16, 5);
    ctx.lineTo(24, 8);
    ctx.lineTo(24, 13);
    ctx.lineTo(16, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(27,94,32,0.8)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(10.5, 16);
    ctx.lineTo(14.5, 20);
    ctx.lineTo(22, 11.5);
    ctx.stroke();
  });

  makeCanvas(scene, 'bg-tower-neon', 150, 250, (ctx) => {
    ctx.save();
    // 观景台轮廓 + 暖色窗灯
    ctx.shadowColor = 'rgba(120,220,255,0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(130,225,255,0.9)';
    ctx.lineWidth = 1.6;
    roundRectPath(ctx, 48, 58, 54, 18, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,160,0.95)';
    for (let x = 53; x < 98; x += 8) ctx.fillRect(x, 63, 3, 4);
    // 天线与航标灯
    ctx.shadowColor = 'rgba(255,80,80,0.95)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(75, 12, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'rgba(140,225,255,0.8)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(150,230,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(75, 20); ctx.lineTo(75, 58); ctx.stroke();
    // 塔腿灯点
    ctx.fillStyle = 'rgba(140,225,255,0.7)';
    for (let y = 150; y < 242; y += 16) {
      const spread = (y - 132) * 0.08;
      ctx.fillRect(62 - spread, y, 2, 3);
      ctx.fillRect(86 + spread, y, 2, 3);
    }
    ctx.restore();
  });

  makeCanvas(scene, 'bg-wheel-neon', 230, 230, (ctx) => {
    const cx = 115, cy = 98, r = 76;
    ctx.save();
    // 外圈冷光
    ctx.shadowColor = 'rgba(90,220,255,0.95)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(120,235,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,220,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.stroke();
    // 辐条
    ctx.shadowBlur = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? 'rgba(120,210,255,0.32)' : 'rgba(150,240,255,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    // 座舱灯
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * (r + 7);
      const y = cy + Math.sin(a) * (r + 7);
      const warm = i % 3 === 0;
      ctx.shadowColor = warm ? 'rgba(255,220,120,1)' : 'rgba(255,120,220,0.9)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = warm ? 'rgba(255,238,160,1)' : 'rgba(255,150,230,0.9)';
      roundRectPath(ctx, x - 5, y - 4, 10, 8, 2.5);
      ctx.fill();
    }
    // 中心轴
    ctx.shadowColor = 'rgba(255,235,150,1)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  makeCanvas(scene, 'bg-hotel-neon', 190, 270, (ctx, w, h) => {
    ctx.save();
    // 窗灯
    ctx.shadowColor = 'rgba(255,210,120,0.9)';
    ctx.shadowBlur = 5;
    for (let y = 78; y < h - 14; y += 15) {
      for (let x = 52; x < 142; x += 12) {
        if ((x * 7 + y * 13) % 5 === 0) continue;
        ctx.fillStyle = (x + y) % 3 === 0 ? 'rgba(255,240,180,0.95)' : 'rgba(255,220,140,0.7)';
        ctx.fillRect(x, y, 3, 4);
      }
    }
    // 竖向霓虹灯带
    ctx.shadowColor = 'rgba(255,90,120,0.95)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,120,150,0.9)';
    ctx.fillRect(46, 72, 2.2, h - 88);
    ctx.fillRect(146, 90, 2, h - 106);
    // 招牌描边
    ctx.strokeStyle = 'rgba(255,110,110,0.95)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 36, 26, 118, 30, 6);
    ctx.stroke();
    // 入口暖光
    ctx.shadowColor = 'rgba(255,220,140,1)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,225,160,0.8)';
    ctx.beginPath();
    ctx.moveTo(82, h);
    ctx.lineTo(82, h - 26);
    ctx.quadraticCurveTo(82, h - 32, 88, h - 32);
    ctx.lineTo(102, h - 32);
    ctx.quadraticCurveTo(108, h - 32, 108, h - 26);
    ctx.lineTo(108, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // ---- 菜单 / 每日规则图标:统一手绘,避免 emoji 跨平台差异 ----
  makeCanvas(scene, 'ui-shop', 32, 32, (ctx) => {
    const g = ctx.createLinearGradient(0, 10, 0, 30);
    g.addColorStop(0, '#ffe066');
    g.addColorStop(1, '#e8a100');
    ctx.fillStyle = g;
    roundRectPath(ctx, 6, 11, 20, 18, 3);
    ctx.fill();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = '#8a5200';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(16, 11, 6, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(9, 15, 3, 8);
    ctx.fillStyle = '#8a5200';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¥', 16, 21);
  });

  makeCanvas(scene, 'ui-palette', 32, 32, (ctx) => {
    ctx.fillStyle = '#f1e3c8';
    ctx.beginPath();
    ctx.ellipse(16, 17, 13, 10, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a43';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#0d2038';
    ctx.beginPath();
    ctx.ellipse(22, 22, 4, 3, -0.18, 0, Math.PI * 2);
    ctx.fill();
    const colors = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'];
    const spots: [number, number][] = [[9, 13], [15, 9], [22, 13], [12, 20]];
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(spots[i][0], spots[i][1], 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  makeCanvas(scene, 'ui-gear', 32, 32, (ctx) => {
    ctx.save();
    ctx.translate(16, 16);
    const gear = (toothR: number, bodyR: number, paint: string | CanvasGradient) => {
      ctx.fillStyle = paint;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        roundRectPath(ctx, -3, -toothR, 6, toothR - bodyR + 3, 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
      ctx.fill();
    };
    gear(15, 12, '#1c4f7c');
    const g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, '#e7f5ff');
    g.addColorStop(1, '#74c0fc');
    gear(14, 11, g);
    ctx.fillStyle = '#0d2038';
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  makeCanvas(scene, 'ui-siren', 32, 32, (ctx) => {
    ctx.fillStyle = '#1c4f7c';
    roundRectPath(ctx, 6, 24, 20, 4, 2);
    ctx.fill();
    // 左红右蓝的警灯
    ctx.fillStyle = '#e03131';
    ctx.beginPath();
    ctx.arc(16, 20, 10, Math.PI, Math.PI * 1.5);
    ctx.lineTo(16, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4dabf7';
    ctx.beginPath();
    ctx.arc(16, 20, 10, Math.PI * 1.5, Math.PI * 2);
    ctx.lineTo(16, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#10233d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(16, 20, 10, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, 10);
    ctx.lineTo(16, 20);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(11.5, 15, 3, 1.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 顶部光芒
    ctx.strokeStyle = 'rgba(255,212,59,0.85)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 9); ctx.lineTo(6, 11);
    ctx.moveTo(29, 9); ctx.lineTo(26, 11);
    ctx.stroke();
  });

  makeCanvas(scene, 'ui-broken-heart', 36, 34, (ctx) => {
    const g = ctx.createLinearGradient(0, 4, 0, 30);
    g.addColorStop(0, '#ff9a9a');
    g.addColorStop(1, '#c92a2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(18, 30);
    ctx.bezierCurveTo(2, 19, 2, 7, 10, 7);
    ctx.bezierCurveTo(14, 7, 17, 9, 18, 12);
    ctx.bezierCurveTo(19, 9, 22, 7, 26, 7);
    ctx.bezierCurveTo(34, 7, 34, 19, 18, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(12, 12, 4.2, 2.4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // 裂痕
    ctx.strokeStyle = '#3d0a0a';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 8);
    ctx.lineTo(15, 14);
    ctx.lineTo(19, 17);
    ctx.lineTo(15, 22);
    ctx.lineTo(17, 27);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,220,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(19, 8);
    ctx.lineTo(16, 14);
    ctx.lineTo(20, 17);
    ctx.lineTo(16, 22);
    ctx.stroke();
  });

  // ---- 气势光环:气势接近满槽时在角色周围呼吸,提示即将进入高光 ----
  makeCanvas(scene, 'hype-aura', 160, 160, (ctx) => {
    const g = ctx.createRadialGradient(80, 80, 22, 80, 80, 78);
    g.addColorStop(0, 'rgba(177,151,252,0)');
    g.addColorStop(0.45, 'rgba(177,151,252,0.1)');
    g.addColorStop(0.75, 'rgba(198,178,255,0.5)');
    g.addColorStop(1, 'rgba(177,151,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(80, 80, 78, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 太阳光芒:旋转叠加,让白天天空更有层次 ----
  makeCanvas(scene, 'sun-rays', 440, 440, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 20; i++) {
      ctx.save();
      ctx.rotate((i / 20) * Math.PI * 2);
      const g = ctx.createLinearGradient(0, -42, 0, -208);
      g.addColorStop(0, 'rgba(255,240,170,0.20)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-3, -42);
      ctx.lineTo(-11, -208);
      ctx.lineTo(11, -208);
      ctx.lineTo(3, -42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });

  // ---- 巡视组探照灯:从机腹向下的柔和光锥 ----
  makeCanvas(scene, 'searchlight', 520, 380, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,245,190,0.34)');
    g.addColorStop(0.35, 'rgba(255,240,170,0.13)');
    g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, 0);
    ctx.lineTo(w / 2 + 12, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,210,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, 0);
    ctx.lineTo(0, h);
    ctx.moveTo(w / 2 + 12, 0);
    ctx.lineTo(w, h);
    ctx.stroke();
  });

  // ---- 探照灯落点光斑 ----
  makeCanvas(scene, 'light-pool', 240, 70, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 112);
    g.addColorStop(0, 'rgba(255,248,200,0.55)');
    g.addColorStop(0.45, 'rgba(255,235,150,0.22)');
    g.addColorStop(1, 'rgba(255,225,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 112, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- 城市地标:电视塔 / 摩天轮 / 顾哥大厦,打断楼群重复感 ----
  makeCanvas(scene, 'bg-tower', 150, 250, (ctx, w, h) => {
    ctx.save();
    // 塔身:两条外扩的腿
    ctx.fillStyle = '#17395e';
    ctx.beginPath();
    ctx.moveTo(52, h);
    ctx.lineTo(64, 132);
    ctx.lineTo(86, 132);
    ctx.lineTo(98, h);
    ctx.closePath();
    ctx.fill();
    // 交叉桁架
    ctx.strokeStyle = 'rgba(120,170,215,0.22)';
    ctx.lineWidth = 2;
    for (let y = 146; y < h - 8; y += 20) {
      ctx.beginPath();
      ctx.moveTo(63 + (y - 132) * 0.03, y);
      ctx.lineTo(87 - (y - 132) * 0.03, y + 20);
      ctx.moveTo(87 - (y - 132) * 0.03, y);
      ctx.lineTo(63 + (y - 132) * 0.03, y + 20);
      ctx.stroke();
    }
    // 塔身中段
    ctx.fillStyle = '#1b4068';
    ctx.fillRect(70, 70, 10, 64);
    // 观景台
    ctx.fillStyle = '#214c78';
    roundRectPath(ctx, 48, 58, 54, 18, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,222,140,0.85)';
    for (let x = 53; x < 98; x += 8) ctx.fillRect(x, 63, 3, 4);
    // 天线与航标灯
    ctx.fillStyle = '#1b4068';
    ctx.fillRect(73, 14, 4, 46);
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(75, 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,107,107,0.22)';
    ctx.beginPath();
    ctx.arc(75, 12, 11, 0, Math.PI * 2);
    ctx.fill();
    // 塔腿窗灯
    ctx.fillStyle = 'rgba(255,222,140,0.55)';
    for (let y = 150; y < h - 16; y += 16) {
      const spread = (y - 132) * 0.08;
      ctx.fillRect(62 - spread, y, 2, 3);
      ctx.fillRect(86 + spread, y, 2, 3);
    }
    ctx.restore();
  });

  makeCanvas(scene, 'bg-wheel', 230, 230, (ctx, w, h) => {
    const cx = 115, cy = 98, r = 76;
    // 支架
    ctx.strokeStyle = '#17395e';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(68, h - 8);
    ctx.moveTo(cx, cy);
    ctx.lineTo(162, h - 8);
    ctx.stroke();
    ctx.fillStyle = '#17395e';
    ctx.fillRect(48, h - 12, 134, 10);
    // 外圈与内圈
    ctx.strokeStyle = '#1b4068';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,170,215,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.stroke();
    // 辐条
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? 'rgba(120,170,215,0.24)' : '#1b4068';
      ctx.lineWidth = i % 2 ? 1.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    // 座舱
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * (r + 7);
      const y = cy + Math.sin(a) * (r + 7);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,222,140,0.95)' : '#214c78';
      roundRectPath(ctx, x - 6, y - 5, 12, 10, 3);
      ctx.fill();
      ctx.strokeStyle = '#102b47';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // 中心轴
    ctx.fillStyle = '#214c78';
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,222,140,0.8)';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  });

  makeCanvas(scene, 'bg-hotel', 190, 270, (ctx, w, h) => {
    // 主楼
    const g = ctx.createLinearGradient(0, 60, 0, h);
    g.addColorStop(0, '#204a76');
    g.addColorStop(1, '#132c4c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(40, h);
    ctx.lineTo(40, 80);
    ctx.quadraticCurveTo(40, 62, 58, 62);
    ctx.lineTo(132, 62);
    ctx.quadraticCurveTo(150, 62, 150, 80);
    ctx.lineTo(150, h);
    ctx.closePath();
    ctx.fill();
    // 侧翼
    ctx.fillStyle = '#17395e';
    ctx.fillRect(22, 118, 24, h - 118);
    ctx.fillRect(144, 104, 22, h - 104);
    // 顶部招牌
    ctx.fillStyle = '#0d2038';
    roundRectPath(ctx, 36, 26, 118, 30, 6);
    ctx.fill();
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 17px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,80,80,0.85)';
    ctx.shadowBlur = 10;
    ctx.fillText('顾哥大厦', 95, 42);
    ctx.shadowBlur = 0;
    // 楼体窗灯
    for (let y = 78; y < h - 14; y += 15) {
      for (let x = 52; x < 142; x += 12) {
        if ((x * 7 + y * 13) % 5 === 0) continue;
        ctx.fillStyle = (x + y) % 3 === 0 ? 'rgba(255,236,170,0.9)' : 'rgba(255,214,120,0.5)';
        ctx.fillRect(x, y, 3, 4);
      }
    }
    // 竖向霓虹灯带
    ctx.fillStyle = 'rgba(255,107,107,0.7)';
    ctx.fillRect(46, 72, 2, h - 88);
    // 入口
    ctx.fillStyle = '#0d2038';
    ctx.beginPath();
    ctx.moveTo(80, h);
    ctx.lineTo(80, h - 28);
    ctx.quadraticCurveTo(80, h - 34, 86, h - 34);
    ctx.lineTo(104, h - 34);
    ctx.quadraticCurveTo(110, h - 34, 110, h - 28);
    ctx.lineTo(110, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,222,140,0.8)';
    ctx.fillRect(86, h - 28, 18, 3);
  });

  // ---- 巡视无人机 ----
  makeCanvas(scene, 'patrol-drone', 120, 64, (ctx) => {
    ctx.save();
    // 机臂
    ctx.strokeStyle = '#22344a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(42, 34); ctx.lineTo(22, 20);
    ctx.moveTo(78, 34); ctx.lineTo(98, 20);
    ctx.stroke();
    // 旋翼虚影
    ctx.strokeStyle = 'rgba(200,225,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(22, 18, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(98, 18, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
    // 机身
    const body = ctx.createLinearGradient(0, 24, 0, 48);
    body.addColorStop(0, '#3c5674');
    body.addColorStop(1, '#15283f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(60, 36, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a1726';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 驾驶舱
    const glass = ctx.createLinearGradient(48, 26, 72, 40);
    glass.addColorStop(0, '#9fe2ff');
    glass.addColorStop(1, '#2f86d6');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(58, 34, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(54, 31, 4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 警灯
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(38, 42, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4dabf7';
    ctx.beginPath(); ctx.arc(82, 42, 3.2, 0, Math.PI * 2); ctx.fill();
    // 起落架
    ctx.strokeStyle = '#22344a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(48, 47); ctx.lineTo(44, 56);
    ctx.moveTo(72, 47); ctx.lineTo(76, 56);
    ctx.stroke();
    ctx.restore();
  });

  // ---- 圆形投影 ----
  makeCanvas(scene, 'shadow', 120, 30, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(10,20,35,0.4)');
    g.addColorStop(0.7, 'rgba(10,20,35,0.16)');
    g.addColorStop(1, 'rgba(10,20,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // ---- 星星/火花 ----
  makeCanvas(scene, 'spark', 24, 24, (ctx) => {
    ctx.translate(12, 12);
    ctx.fillStyle = '#fff6c7';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const b = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(b) * 3.2, Math.sin(b) * 3.2);
    }
    ctx.closePath();
    ctx.fill();
  });

  // ---- 标题页聚光灯光束 ----
  makeCanvas(scene, 'spotlight', 420, 320, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, h);
    g.addColorStop(0, 'rgba(255,245,190,0.4)');
    g.addColorStop(0.6, 'rgba(255,245,190,0.09)');
    g.addColorStop(1, 'rgba(255,245,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 30, 0);
    ctx.lineTo(w / 2 + 30, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  });
}

// 把一组成长线画到场景里:用于标题/结算页的氛围
export function addBackdrop(scene: Phaser.Scene, scroll = 0) {
  scene.add.image(0, 0, 'vignette').setOrigin(0).setDepth(50).setAlpha(0.75);
  const mountains = scene.add.tileSprite(0, GAME_HEIGHT - 300, GAME_WIDTH, 190, 'bg-mountains').setOrigin(0, 0).setDepth(-8);
  const far = scene.add.tileSprite(0, GAME_HEIGHT - 250, GAME_WIDTH, 190, 'bg-city-far').setOrigin(0, 0).setDepth(-7);
  const near = scene.add.tileSprite(0, GAME_HEIGHT - 200, GAME_WIDTH, 200, 'bg-city-near').setOrigin(0, 0).setDepth(-6);
  mountains.tilePositionX = scroll;
  far.tilePositionX = scroll * 1.6;
  near.tilePositionX = scroll * 2.4;
  return { mountains, far, near };
}
