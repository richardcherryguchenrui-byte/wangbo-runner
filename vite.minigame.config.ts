import { defineConfig } from 'vite';

// 微信小游戏构建:整个游戏打成单文件 game-bundle.js(IIFE),资源保持 assets/ 相对路径
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-minigame',
    emptyOutDir: true,
    target: 'es2018',
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'iife',
        entryFileNames: 'game-bundle.js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
