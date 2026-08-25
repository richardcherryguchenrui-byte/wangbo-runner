// 一键构建微信小游戏:产物在 dist-minigame/,用微信开发者工具导入该目录即可
import { execSync } from 'child_process';
import { cpSync, rmSync, existsSync } from 'fs';

const OUT = 'dist-minigame';
rmSync(OUT, { recursive: true, force: true });

execSync('npx vite build --config vite.minigame.config.ts', { stdio: 'inherit' });

cpSync('minigame/adapter.js', `${OUT}/adapter.js`);
cpSync('minigame/game.js', `${OUT}/game.js`);
cpSync('minigame/game.json', `${OUT}/game.json`);
cpSync('minigame/project.config.json', `${OUT}/project.config.json`);

if (!existsSync(`${OUT}/game-bundle.js`)) {
  console.error('❌ 构建失败:未找到 game-bundle.js');
  process.exit(1);
}

console.log('');
console.log('✅ 微信小游戏构建完成 → dist-minigame/');
console.log('   在微信开发者工具中「导入项目」选择此目录即可预览;');
console.log('   正式使用前请把 project.config.json 里的 appid 换成你自己的小游戏 AppID。');
