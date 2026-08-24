import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import GameScene from './scenes/GameScene';
import ResultScene from './scenes/ResultScene';
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR, GRAVITY_Y } from './config/constants';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
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
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, PreloadScene, GameScene, ResultScene]
});

export default game;



if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
