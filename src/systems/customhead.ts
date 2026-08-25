// 自定义人物:上传照片裁剪区域后,替换主角头部(四帧合成,持久化)
import Phaser from 'phaser';

const KEY = 'wangboCustomHead';

export function hasCustomHead(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveCustomHead(dataUrl: string) {
  try { localStorage.setItem(KEY, dataUrl); } catch {}
}

export function clearCustomHead() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function getCustomHeadData(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

// 把自定义头部合成到基础帧上,生成 player-custom-*(idle/run-1/run-2/jump)
export function rebuildCustomTextures(scene: Phaser.Scene) {
  const data = getCustomHeadData();
  if (!data) return;
  try {
    if (scene.textures.exists('custom-head-src')) scene.textures.remove('custom-head-src');
    scene.textures.addBase64('custom-head-src', data);
  } catch { return; }
  const headTex = scene.textures.get('custom-head-src');
  const headImg = headTex.getSourceImage() as HTMLImageElement;

  (['idle', 'run-1', 'run-2', 'jump'] as const).forEach(name => {
    const base = scene.textures.get('player-' + name);
    if (!base) return;
    const src = base.getSourceImage() as HTMLImageElement;
    const w = base.getSourceImage().width;
    const h = base.getSourceImage().height;
    // 头部区域:约 55% 宽,位于精灵顶部
    const hw = Math.max(16, Math.round(w * 0.55));
    const hx = Math.round((w - hw) / 2);
    const hy = Math.max(0, Math.round(h * 0.04));
    const hh = Math.min(hw, h - hy - 4);

    const outKey = 'player-custom-' + name;
    if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
    const out = scene.textures.createCanvas(outKey, w, h);
    if (!out) return;
    const ctx = out.getContext();
    ctx.drawImage(src, 0, 0);

    // 羽化椭圆遮罩
    const mask = scene.textures.createCanvas('__mask', hw, hh);
    if (mask) {
      const mctx = mask.getContext();
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, hw, hh);
      try { (mctx as any).filter = 'blur(4px)'; } catch {}
      mctx.fillStyle = '#fff';
      mctx.beginPath();
      mctx.ellipse(hw / 2, hh / 2, hw * 0.42, hh * 0.42, 0, 0, Math.PI * 2);
      mctx.fill();
      try { (mctx as any).filter = 'none'; } catch {}
      mask.refresh();
    }

    // 头图画布 + 遮罩合成
    const head = scene.textures.createCanvas('__head', hw, hh);
    if (head) {
      const hctx = head.getContext();
      hctx.drawImage(headImg, 0, 0, hw, hh);
      if (mask) {
        hctx.globalCompositeOperation = 'destination-in';
        hctx.drawImage(mask.getSourceImage() as HTMLImageElement, 0, 0);
      }
      head.refresh();
    }

    if (head) ctx.drawImage(head.getSourceImage() as HTMLImageElement, hx, hy);
    out.refresh();
    if (mask) scene.textures.remove('__mask');
    if (head) scene.textures.remove('__head');
  });
}
