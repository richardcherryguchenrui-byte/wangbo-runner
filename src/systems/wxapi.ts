// 微信小游戏平台 API:所有调用都带 try/catch 与存在性检查,
// 在网页/安卓环境调用是安全的空操作
export function isWx(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__WX_GAME__;
}

function wxApi(): any {
  return (window as any).wx ?? null;
}

export function wxVibrate(type: 'light' | 'medium' | 'heavy' = 'light') {
  try { wxApi()?.vibrateShort?.({ type }); } catch {}
}

// 主动分享(分享成功后回调,用于「分享复活」)
export function wxShare(title: string, onSuccess?: () => void, onFail?: () => void) {
  const wx = wxApi();
  if (!wx?.shareAppMessage) { onFail?.(); return; }
  try {
    wx.shareAppMessage({
      title,
      success: () => onSuccess?.(),
      fail: () => onFail?.(),
      cancel: () => onFail?.()
    });
  } catch { onFail?.(); }
}

export function wxSetClipboard(text: string, cb: (ok: boolean) => void) {
  const wx = wxApi();
  if (!wx?.setClipboardData) { cb(false); return; }
  try {
    wx.setClipboardData({ data: text, success: () => cb(true), fail: () => cb(false) });
  } catch { cb(false); }
}

export function wxGetClipboard(cb: (text: string | null) => void) {
  const wx = wxApi();
  if (!wx?.getClipboardData) { cb(null); return; }
  try {
    wx.getClipboardData({ success: (res: any) => cb(typeof res?.data === 'string' ? res.data : null), fail: () => cb(null) });
  } catch { cb(null); }
}

// 选择图片(小游戏自定义头像用):返回临时文件路径或 null
export function wxChooseImage(): Promise<string | null> {
  const wx = wxApi();
  if (!wx?.chooseImage) return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res: any) => resolve(res?.tempFilePaths?.[0] ?? null),
        fail: () => resolve(null)
      });
    } catch { resolve(null); }
  });
}

// 上传最佳成绩到微信好友排行(KV 格式为官方约定)
export function wxUploadBestScore(scoreMs: number) {
  const wx = wxApi();
  if (!wx?.setUserCloudStorage) return;
  try {
    wx.setUserCloudStorage({
      KVDataList: [{
        key: 'bestTimeMs',
        value: JSON.stringify({ wxgame: { score: Math.round(scoreMs), update_time: Date.now() } })
      }],
      success: () => {}, fail: () => {}
    });
  } catch {}
}

// 通知开放数据域刷新好友排行榜(渲染在 sharedCanvas 上)
export function wxPostLeaderboard() {
  try {
    wxApi()?.getOpenDataContext?.()?.postMessage?.({ type: 'show' });
  } catch {}
}
