import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径,兼容 GitHub Pages 子目录与 Capacitor/Tauri 本地加载
  base: './',
  server: {
    open: false // 不自动打开浏览器,避免后台标签页偷偷播 BGM
  },
  build: {
    target: 'es2020'
  }
});


