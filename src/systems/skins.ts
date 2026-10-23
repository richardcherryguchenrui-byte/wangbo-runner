// 程序化皮肤:基于默认主角四帧染色生成新贴图(三端通用,无需外部素材)
// 生成结果 'player-{skinId}-{frame}',只在贴图缺失时生成一次
import Phaser from 'phaser';

export interface SkinDef {
  id: string;
  name: string;
  color: number;  // 染色(叠加色)
  alpha: number;  // 染色强度 0~1
}

export const SKINS: SkinDef[] = [
  { id: 'night', name: '夜行侠', color: 0x2b4a9e, alpha: 0.6 },
  { id: 'gold', name: '金身王博', color: 0xffc400, alpha: 0.55 },
  { id: 'inferno', name: '赤焰王博', color: 0xd9480f, alpha: 0.55 }
];

const FRAMES = ['idle', 'run-1', 'run-2', 'jump'] as const;

export function skinIdToDef(id: string): SkinDef | null {
  return SKINS.find(s => s.id === id) ?? null;
}

// 为指定皮肤生成四帧染色贴图(已存在则跳过);返回是否可用
export function ensureSkinTextures(scene: Phaser.Scene, skinId: string): boolean {
  const def = skinIdToDef(skinId);
  if (!def) return false;
  const colorStr = '#' + def.color.toString(16).padStart(6, '0');
  let ok = true;
  for (const frame of FRAMES) {
    const outKey = `player-${skinId}-${frame}`;
    if (scene.textures.exists(outKey)) continue;
    const base = scene.textures.get(`player-${frame}`);
    if (!base || !base.getSourceImage()) { ok = false; continue; }
    try {
      const src = base.getSourceImage() as HTMLImageElement;
      const w = base.getSourceImage().width;
      const h = base.getSourceImage().height;
      const out = scene.textures.createCanvas(outKey, w, h);
      if (!out) { ok = false; continue; }
      const ctx = out.getContext();
      ctx.drawImage(src, 0, 0);
      // 染色:source-atop 只覆盖不透明像素,保留明暗细节
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = def.alpha;
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      out.refresh();
    } catch { ok = false; }
  }
  return ok;
}

// 取当前应显示的玩家帧贴图键(皮肤 → 自定义头像 → 默认),缺失时安全回退
export function playerFrameKey(scene: Phaser.Scene, skin: string, frame: string): string {
  if (skin && skin !== 'qitongwei') {
    const key = `player-${skin}-${frame}`;
    if (scene.textures.exists(key)) return key;
  }
  // 自定义头像只作用于默认皮肤
  if (!skin) {
    try {
      const custom = `player-custom-${frame}`;
      if (scene.textures.exists(custom)) return custom;
    } catch { /* 回退默认 */ }
  }
  return `player-${frame}`;
}
