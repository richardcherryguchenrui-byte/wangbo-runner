/**
 * 微信小游戏最小适配层:为 Phaser 提供浏览器环境(window/document/canvas/触屏/存储/RAF)
 * 游戏在小游戏环境强制使用 Canvas 渲染器(微信 2D 画布接口与标准一致)
 */
/* eslint-disable */
// 注意:不能用 var GameGlobal,否则模块作用域会遮蔽全局对象
var G = (function () {
  if (typeof globalThis !== 'undefined' && globalThis.GameGlobal) return globalThis.GameGlobal;
  if (typeof GameGlobal !== 'undefined') return GameGlobal; // eslint-disable-line
  return {};
})();

var sysInfo = {};
try {
  sysInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : wx.getWindowInfo();
} catch (e) {
  sysInfo = { screenWidth: 375, screenHeight: 667, pixelRatio: 2, platform: 'devtools' };
}

// ---- window / navigator ----
G.window = G;
G.window.innerWidth = sysInfo.screenWidth;
G.window.innerHeight = sysInfo.screenHeight;
G.window.devicePixelRatio = sysInfo.pixelRatio || 2;
G.window.screen = { width: sysInfo.screenWidth, height: sysInfo.screenHeight };
G.window.ontouchstart = null; // 标记支持触屏,Phaser 据此启用触摸输入
G.window.addEventListener = function () {};
G.window.removeEventListener = function () {};
G.window.__WX_GAME__ = true; // 游戏代码据此切换渲染器与 DOM 逻辑

G.navigator = { userAgent: 'minigame/' + (sysInfo.platform || ''), platform: sysInfo.platform || '' };

if (!G.performance) {
  G.performance = { now: function () { return Date.now(); } };
}

// ---- localStorage → wx 同步存储(游戏存档用它) ----
G.localStorage = {
  get length() { try { return wx.getStorageInfoSync().keys.length; } catch (e) { return 0; } },
  key: function (i) { try { return wx.getStorageInfoSync().keys[i] || null; } catch (e) { return null; } },
  getItem: function (k) { try { var v = wx.getStorageSync(k); return (v === '' || v == null) ? null : String(v); } catch (e) { return null; } },
  setItem: function (k, v) { try { wx.setStorageSync(k, String(v)); } catch (e) {} },
  removeItem: function (k) { try { wx.removeStorageSync(k); } catch (e) {} },
  clear: function () { try { wx.clearStorageSync(); } catch (e) {} }
};

// ---- requestAnimationFrame ----
G.requestAnimationFrame = function (cb) {
  return setTimeout(function () { cb(Date.now()); }, 16);
};
G.cancelAnimationFrame = function (id) { clearTimeout(id); };

// ---- 触摸事件:wx 触摸 → 标准 TouchEvent 派发给画布监听器 ----
var touchHandlers = { start: [], move: [], end: [], cancel: [] };

function makeTouch(t) {
  return {
    identifier: t.identifier || 0,
    clientX: t.clientX, clientY: t.clientY,
    pageX: t.pageX || t.clientX, pageY: t.pageY || t.clientY,
    screenX: t.clientX, screenY: t.clientY,
    target: null
  };
}
function dispatchTouch(type, e) {
  var ev = {
    type: type,
    touches: (e.touches || []).map(makeTouch),
    changedTouches: (e.changedTouches || []).map(makeTouch),
    targetTouches: (e.touches || []).map(makeTouch),
    timeStamp: Date.now(),
    target: null,
    preventDefault: function () {},
    stopPropagation: function () {}
  };
  var list = touchHandlers[type === 'touchstart' ? 'start' : type === 'touchmove' ? 'move' : type === 'touchend' ? 'end' : 'cancel'] || [];
  list.slice().forEach(function (fn) { try { fn.call(null, ev); } catch (err) {} });
}

if (typeof wx !== 'undefined') {
  try { wx.onTouchStart(function (e) { dispatchTouch('touchstart', e); }); } catch (e) {}
  try { wx.onTouchMove(function (e) { dispatchTouch('touchmove', e); }); } catch (e) {}
  try { wx.onTouchEnd(function (e) { dispatchTouch('touchend', e); }); } catch (e) {}
  try { wx.onTouchCancel(function (e) { dispatchTouch('touchcancel', e); }); } catch (e) {}
}

// ---- canvas 包装:直接在 wx 原生画布对象上补 DOM 风格接口 ----
function wrapCanvas(c) {
  if (!c) return c;
  if (c.__wrapped) return c;
  c.__wrapped = true;
  c.style = {};
  if (!c.addEventListener) {
    c.addEventListener = function (type, fn) {
      if (type === 'touchstart') touchHandlers.start.push(fn);
      else if (type === 'touchmove') touchHandlers.move.push(fn);
      else if (type === 'touchend') touchHandlers.end.push(fn);
      else if (type === 'touchcancel') touchHandlers.cancel.push(fn);
    };
  }
  if (!c.removeEventListener) c.removeEventListener = function () {};
  if (!c.getBoundingClientRect) {
    c.getBoundingClientRect = function () {
      return { left: 0, top: 0, right: c.width || 0, bottom: c.height || 0, width: c.width || 0, height: c.height || 0 };
    };
  }
  if (!c.focus) c.focus = function () {};
  if (!c.setAttribute) c.setAttribute = function () {};
  return c;
}

// ---- Image:加载包内图片资源 ----
function WxImage() {
  this._img = (typeof wx !== 'undefined') ? wx.createImage() : null;
  this.width = 0;
  this.height = 0;
  this.onload = null;
  this.onerror = null;
  var self = this;
  if (this._img) {
    this._img.onload = function () {
      self.width = self._img.width;
      self.height = self._img.height;
      if (self.onload) self.onload();
    };
    this._img.onerror = function () { if (self.onerror) self.onerror(); };
  }
}
Object.defineProperty(WxImage.prototype, 'src', {
  get: function () { return this._img ? this._img.src : ''; },
  set: function (v) { if (this._img) this._img.src = v; }
});

// ---- document ----
var documentObj = {
  readyState: 'complete',
  documentElement: { style: {} },
  body: {
    appendChild: function () {},
    removeChild: function () {},
    style: {}
  },
  createElement: function (tag) {
    if (tag === 'canvas') {
      return wrapCanvas((typeof wx !== 'undefined') ? wx.createCanvas() : {});
    }
    if (tag === 'img' || tag === 'image') return new WxImage();
    return {};
  },
  createElementNS: function (_ns, tag) {
    return documentObj.createElement(tag);
  },
  getElementById: function () { return null; },
  addEventListener: function () {},
  removeEventListener: function () {}
};
G.document = documentObj;
G.Image = WxImage;
