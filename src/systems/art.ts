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
