import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径,兼容 GitHub Pages 子目录与 Capacitor/Tauri 本地加载
  base: './',
  server: {
    open: true
  },
  build: {
    target: 'es2020'
  }
});


