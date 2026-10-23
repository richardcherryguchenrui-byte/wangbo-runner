// 战绩卡:纯 Canvas 生成 1080×1440 PNG,可保存/发群
// 不依赖网络与截图权限,网页/桌面端通用。
import Phaser from 'phaser';
import { GAME_VERSION } from '../config/constants';
import { gradeRun } from './grade';

export interface ShareCardData {
  timeMs: number;
  dodged: number;
  coins: number;
  combo: number;
  nearMisses: number;
  overdrives?: number;
  hits?: number;
  rankName: string;
  bestMs: number;
  playerTexture: string;
  daily?: boolean;
}

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export function buildShareCard(scene: Phaser.Scene, d: ShareCardData): HTMLCanvasElement {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  // 背景:深夜蓝 → 紫,底部暖金
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1a34');
  bg.addColorStop(0.55, '#142b52');
  bg.addColorStop(1, '#3b2340');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 放射光
  ctx.save();
  ctx.translate(W / 2, 420);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const g = ctx.createLinearGradient(0, 0, 0, -720);
    g.addColorStop(0, 'rgba(255,212,59,0.12)');
    g.addColorStop(1, 'rgba(255,212,59,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(0, -720);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 装饰圆与星点
  for (let i = 0; i < 46; i++) {
    const x = pseudo(i * 7.13) * W;
    const y = pseudo(i * 3.77 + 9) * H;
    const r = 1 + pseudo(i * 1.9 + 3) * 3;
    ctx.fillStyle = `rgba(255,240,180,${0.12 + pseudo(i * 2.2) * 0.4})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 顶部品牌
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd43b';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('王博晋升之路跑酷', 70, 110);
  ctx.fillStyle = 'rgba(220,235,255,0.6)';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`反弹工作室 · v${GAME_VERSION}`, 70, 152);

  // 单局评价:顶部左侧印章,与右侧官阶印章形成对称
  const grade = gradeRun({
    timeMs: d.timeMs,
    dodged: d.dodged,
    nearMisses: d.nearMisses,
    overdrives: d.overdrives ?? 0,
    hits: d.hits ?? 0,
    combo: d.combo
  });

  // 主卡
  roundRect(ctx, 60, 200, 960, 980, 42);
  const cardBg = ctx.createLinearGradient(60, 200, 1020, 1180);
  cardBg.addColorStop(0, 'rgba(18,42,76,0.92)');
  cardBg.addColorStop(1, 'rgba(12,28,54,0.92)');
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,59,0.42)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 官阶印章
  ctx.save();
  ctx.translate(862, 286);
  ctx.rotate(0.08);
  ctx.fillStyle = '#c92a2a';
  roundRect(ctx, -105, -52, 210, 104, 18);
  ctx.fill();
  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff3bf';
  ctx.font = `bold 46px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.rankName, 0, 2);
  ctx.restore();

  // 评价印章:大字母 + 本局评价,发群时一眼看到水平
  ctx.save();
  ctx.translate(196, 274);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = grade.color;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,20,38,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = grade.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  // 外圈刻度
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,255,255,${i % 3 === 0 ? 0.4 : 0.18})`;
    ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 64, Math.sin(a) * 64);
    ctx.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = grade.color;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(grade.letter, 0, -4);
  ctx.fillStyle = 'rgba(210,230,255,0.72)';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('本局评价', 0, 37);
  ctx.restore();

  // 角色
  try {
    const tex = scene.textures.get(d.playerTexture);
    const img = tex?.getSourceImage() as CanvasImageSource | undefined;
    if (img && (img as any).width) {
      const iw = (img as any).width as number;
      const ih = (img as any).height as number;
      const targetH = 320;
      const targetW = iw * (targetH / ih);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, 690, 670 - targetH, targetW, targetH);
      ctx.restore();
    }
  } catch { /* 头像缺失不影响卡片 */ }

  // 标题
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(210,230,255,0.78)';
  ctx.font = `26px ${FONT}`;
  ctx.fillText(d.daily ? '今日挑战 · 成绩单' : '本局成绩单', 118, 384);

  // 大数字存活时间
  const sec = (d.timeMs / 1000).toFixed(1);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 150px ${FONT}`;
  ctx.fillText(sec, 108, 552);
  const numW = ctx.measureText(sec).width;
  ctx.fillStyle = '#ffd43b';
  ctx.font = `bold 50px ${FONT}`;
  ctx.fillText('s', 118 + numW + 8, 552);

  ctx.fillStyle = '#8ce99a';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(`最佳 ${(d.bestMs / 1000).toFixed(1)}s`, 122, 600);

  // 数据格
  const stats: [string, string][] = [
    ['翻越障碍', `${d.dodged}`],
    ['本局银币', `+${d.coins}`],
    ['最高连击', `×${d.combo}`],
    ['擦身而过', `${d.nearMisses}`]
  ];
  stats.forEach(([label, value], i) => {
    const x = 118 + (i % 2) * 400;
    const y = 730 + Math.floor(i / 2) * 128;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y, 360, 104, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,222,248,0.7)';
    ctx.font = `23px ${FONT}`;
    ctx.fillText(label, x + 26, y + 39);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 42px ${FONT}`;
    ctx.fillText(value, x + 26, y + 85);
  });

  // 生存评价
  ctx.fillStyle = 'rgba(255,212,59,0.09)';
  roundRect(ctx, 220, 986, 640, 64, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,59,0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = grade.color;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(`本局评价 · ${grade.letter} · ${grade.label}`, W / 2, 1028);

  // 底部挑衅
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = `bold 32px ${FONT}`;
  ctx.fillText('你能撑过我吗?', W / 2, 1106);
  ctx.fillStyle = 'rgba(210,230,255,0.55)';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('打开游戏,来比比谁升得快', W / 2, 1146);

  // 页脚
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(60, 1230, 960, 2);
  ctx.fillStyle = 'rgba(210,230,255,0.55)';
  ctx.font = `22px ${FONT}`;
  ctx.fillText('王博晋升之路跑酷 · 无限生存挑战', W / 2, 1295);
  ctx.fillStyle = 'rgba(255,212,59,0.8)';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText('nmjdzmy 反弹工作室', W / 2, 1340);

  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function pseudo(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): boolean {
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}
