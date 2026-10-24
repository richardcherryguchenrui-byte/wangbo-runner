// 操作方式设置:虚拟按键开关
// 默认跟随设备:触屏设备开着,桌面默认关(键盘/鼠标操作)。

const KEY = 'wangbo.controls.v1';

export interface ControlSettings {
  /** 是否显示左下铲 / 右下跳的虚拟按键 */
  virtualButtons: boolean;
}

export function isTouchCapable(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    const maxPoints = navigator.maxTouchPoints || 0;
    const coarse =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return maxPoints > 0 || coarse || 'ontouchstart' in window;
  } catch {
    return false;
  }
}

export function loadControls(): ControlSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ControlSettings>;
      if (typeof parsed.virtualButtons === 'boolean') {
        return { virtualButtons: parsed.virtualButtons };
      }
    }
  } catch {
    // 读不到就用设备默认值
  }
  return { virtualButtons: isTouchCapable() };
}

export function saveControls(settings: ControlSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 存档失败不影响本次游戏
  }
}
