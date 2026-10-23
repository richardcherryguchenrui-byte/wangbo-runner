// 存档导出/导入:把进度+音量设置+自定义头像打包成一段文本
// 三端通用:网页用剪贴板,微信小游戏用 wx 剪贴板,都不行时手动展示文本
import { loadProgress, saveProgress, type Progress } from './progress';
import { loadAudioSettings, saveAudioSettings } from './audio';
import { getCustomHeadData, saveCustomHead, clearCustomHead } from './customhead';

const MAGIC = 'WANGBO2.';

// ---- UTF-8 Base64:微信小游戏环境没有 btoa/atob,手写一套 ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64encode(s: string): string {
  if (typeof btoa !== 'undefined') {
    try { return btoa(unescape(encodeURIComponent(s))); } catch { /* 走手写实现 */ }
  }
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.codePointAt(i)!;
    if (code > 0xffff) i++; // 代理对,两个字节一起处理
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)] + (i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=') + (i + 2 < bytes.length ? B64[b2 & 63] : '=');
  }
  return out;
}

function b64decode(s: string): string | null {
  try {
    if (typeof atob !== 'undefined') return decodeURIComponent(escape(atob(s)));
  } catch { /* 走手写实现 */ }
  try {
    const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      const c0 = B64.indexOf(clean[i]), c1 = B64.indexOf(clean[i + 1]);
      const c2 = clean[i + 2] === '=' ? 0 : B64.indexOf(clean[i + 2]);
      const c3 = clean[i + 3] === '=' ? 0 : B64.indexOf(clean[i + 3]);
      if (c0 < 0 || c1 < 0) return null;
      bytes.push((c0 << 2) | (c1 >> 4));
      if (clean[i + 2] !== '=') bytes.push(((c1 & 15) << 4) | (c2 >> 2));
      if (clean[i + 3] !== '=') bytes.push(((c2 & 3) << 6) | c3);
    }
    // UTF-8 解码
    let out = '';
    for (let i = 0; i < bytes.length;) {
      const b = bytes[i];
      let len = 1, code = b;
      if (b >= 0xf0) { len = 4; code = b & 7; }
      else if (b >= 0xe0) { len = 3; code = b & 15; }
      else if (b >= 0xc0) { len = 2; code = b & 31; }
      for (let j = 1; j < len; j++) code = (code << 6) | (bytes[i + j] & 63);
      out += String.fromCodePoint(code);
      i += len;
    }
    return out;
  } catch { return null; }
}

// ---- 导出/导入 ----
export function exportSaveText(): string {
  const data = {
    v: 1,
    progress: loadProgress(),
    audio: loadAudioSettings(),
    head: getCustomHeadData() // 可能为 null
  };
  return MAGIC + b64encode(JSON.stringify(data));
}

export function importSaveText(text: string): string | null {
  if (typeof text !== 'string' || !text.trim()) return '文本为空,请先复制存档文本再导入';
  if (!text.startsWith(MAGIC)) return '格式不对:这不是本游戏的存档文本';
  let data: any;
  try {
    const json = b64decode(text.slice(MAGIC.length));
    if (!json) return '存档文本解析失败';
    data = JSON.parse(json);
  } catch {
    return '存档文本已损坏,无法解析';
  }
  const p = data?.progress;
  if (!p || typeof p !== 'object' || typeof p.coins !== 'number' || typeof p.totalDodged !== 'number') {
    return '存档内容不完整,导入已取消';
  }
  // 旧版本存档导入后自动补全新字段
  saveProgress({ ...loadProgress(), ...p });
  if (data.audio && typeof data.audio === 'object' && typeof data.audio.mute === 'boolean') {
    saveAudioSettings(data.audio);
  }
  if (typeof data.head === 'string' && data.head) {
    try { saveCustomHead(data.head); } catch { /* 头像可能过大,忽略不影响主存档 */ }
  }
  return null; // null = 成功
}

export function resetAllSaves() {
  try {
    localStorage.removeItem('wangboProgress');
    localStorage.removeItem('bestTimeMs');
    localStorage.removeItem('wangboCustomHead');
  } catch {}
}

// ---- 剪贴板(三端) ----
function isWx(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__WX_GAME__;
}

// 复制文本:返回 true=成功,false=失败(调用方给出兜底提示)
export function copyToClipboard(text: string): Promise<boolean> {
  // 网页:优先 Clipboard API(需 https/localhost)
  if (!isWx() && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
  }
  // 微信小游戏:wx 剪贴板
  if (isWx()) {
    return new Promise(resolve => {
      const wx = (window as any).wx;
      if (!wx?.setClipboardData) { resolve(false); return; }
      try {
        wx.setClipboardData({ data: text, success: () => resolve(true), fail: () => resolve(false) });
      } catch { resolve(false); }
    });
  }
  return Promise.resolve(legacyCopy(text));
}

// 旧式复制:临时 textarea + execCommand(兼容 http 局域网预览)
function legacyCopy(text: string): Promise<boolean> {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch { return Promise.resolve(false); }
}

// 从剪贴板读取文本:返回 null=不可用
export function readFromClipboard(): Promise<string | null> {
  if (!isWx() && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    return navigator.clipboard.readText().catch(() => null);
  }
  if (isWx()) {
    return new Promise(resolve => {
      const wx = (window as any).wx;
      if (!wx?.getClipboardData) { resolve(null); return; }
      try {
        wx.getClipboardData({ success: (res: any) => resolve(typeof res?.data === 'string' ? res.data : null), fail: () => resolve(null) });
      } catch { resolve(null); }
    });
  }
  return Promise.resolve(null);
}
