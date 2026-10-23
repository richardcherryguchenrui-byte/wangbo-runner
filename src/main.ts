import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import SplashScene from './scenes/SplashScene';
import GuShopScene from './scenes/GuShopScene';
import SettingsScene from './scenes/SettingsScene';
import CustomCharScene from './scenes/CustomCharScene';
import QuestScene from './scenes/QuestScene';
import PreloadScene from './scenes/PreloadScene';
import TitleScene from './scenes/TitleScene';
import ShopScene from './scenes/ShopScene';
import GameScene from './scenes/GameScene';
import ResultScene from './scenes/ResultScene';
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR, GRAVITY_Y } from './config/constants';

// 微信小游戏环境(适配层会设置 __WX_GAME__):用 Canvas 渲染器、不依赖 DOM
const isWxGame = typeof window !== 'undefined' && !!(window as any).__WX_GAME__;

const game = new Phaser.Game({
  type: isWxGame ? Phaser.CANVAS : Phaser.AUTO,
  parent: isWxGame ? undefined : 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  pixelArt: true,
  render: { pixelArt: true, antialias: false, roundPixels: true },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY_Y },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2 // 画布 2x 渲染,文字与画面高清
  },
  scene: [BootScene, PreloadScene, SplashScene, TitleScene, ShopScene, GuShopScene, SettingsScene, CustomCharScene, QuestScene, GameScene, ResultScene]
});

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
