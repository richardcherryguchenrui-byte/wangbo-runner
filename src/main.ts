import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import SplashScene from './scenes/SplashScene';
import GuShopScene from './scenes/GuShopScene';
import SettingsScene from './scenes/SettingsScene';
import CustomCharScene from './scenes/CustomCharScene';
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
  scene: [BootScene, PreloadScene, SplashScene, TitleScene, ShopScene, GuShopScene, SettingsScene, CustomCharScene, GameScene, ResultScene]
});

export default game;




if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
