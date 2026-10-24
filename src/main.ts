
declare global {
  interface Window {
    __bootSetProgress?: (pct: number, text?: string) => void;
    __bootDone?: () => void;
    __bootFail?: (text?: string) => void;
  }
}
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import SplashScene from './scenes/SplashScene';
import GuShopScene from './scenes/GuShopScene';
import SettingsScene from './scenes/SettingsScene';
import CustomCharScene from './scenes/CustomCharScene';
import QuestScene from './scenes/QuestScene';
import CampaignScene from './scenes/CampaignScene';
import DungeonScene from './scenes/DungeonScene';
import PreloadScene from './scenes/PreloadScene';
import TitleScene from './scenes/TitleScene';
import ShopScene from './scenes/ShopScene';
import GameScene from './scenes/GameScene';
import ResultScene from './scenes/ResultScene';
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR, GRAVITY_Y, RENDER_SCALE } from './config/constants';

// 微信小游戏环境(适配层会设置 __WX_GAME__):用 Canvas 渲染器、不依赖 DOM
const isWxGame = typeof window !== 'undefined' && !!(window as any).__WX_GAME__;

// 小游戏是纯 CPU 的 Canvas 渲染,倍率保持 1,避免掉帧
const renderScale = isWxGame ? 1 : RENDER_SCALE;

const game = new Phaser.Game({
  type: isWxGame ? Phaser.CANVAS : Phaser.AUTO,
  parent: isWxGame ? undefined : 'app',
  // 画布后备缓冲按倍率放大(逻辑坐标仍由各场景相机负责映射回 960×540)
  width: GAME_WIDTH * renderScale,
  height: GAME_HEIGHT * renderScale,
  backgroundColor: BACKGROUND_COLOR,
  // 高清化:关掉像素风,开启抗锯齿与平滑缩放,不做整数像素对齐
  pixelArt: false,
  render: { pixelArt: false, antialias: true, antialiasGL: true, roundPixels: false },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY_Y },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
    // 不再用 zoom:Phaser 的 zoom 只放大 CSS 显示尺寸,画面依旧被拉伸而发糊
  },
  scene: [BootScene, PreloadScene, SplashScene, TitleScene, ShopScene, GuShopScene, SettingsScene, CustomCharScene, QuestScene, CampaignScene, DungeonScene, GameScene, ResultScene]
});

// 每个场景的相机放大 renderScale 倍,让 960×540 的逻辑坐标铺满高分辨率画布。
// 注意:相机缩放以中心为锚点,不补偿滚动量画面会偏到右下角,
// 所以同时把滚动量往回推 (GAME_WIDTH×(倍率-1)/2),让世界原点正好落在画布左上角。
const applyRenderScale = (scene: Phaser.Scene) => {
  const cam = scene.cameras.main;
  cam.setZoom(renderScale);
  cam.setScroll(
    -(GAME_WIDTH * (renderScale - 1)) / 2,
    -(GAME_HEIGHT * (renderScale - 1)) / 2
  );
};

if (renderScale !== 1) {
  game.events.on('ready', () => {
    game.scene.scenes.forEach(scene => {
      scene.events.on('create', () => applyRenderScale(scene));
      if (scene.sys.isActive()) applyRenderScale(scene);
    });
  });
}

export default game;

// 调试钩子:自动化测试/排障用(对玩家无影响)
try { (window as any).__game = game; } catch {}

// 原生 App:保持屏幕常亮,游戏进行中不自动息屏(网页/小游戏环境自动忽略)
try {
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    import('@capacitor-community/keep-awake').then(m => {
      m.KeepAwake.keepAwake().catch(() => {});
    }).catch(() => {});
  }
} catch {}




if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// 竖屏提示:可跳过;本局会话内不再打扰
try {
  const hint = document.getElementById('rotate-hint');
  if (sessionStorage.getItem('rotateHintDismissed') === '1') hint?.classList.add('hidden');
  document.getElementById('rotate-dismiss')?.addEventListener('click', () => {
    hint?.classList.add('hidden');
    sessionStorage.setItem('rotateHintDismissed', '1');
  });
} catch {}
