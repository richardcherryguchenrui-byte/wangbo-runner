# 王博晋升之路跑酷 🏃

给王博定制的横版跑酷小游戏:点击屏幕跳跃躲避障碍,撑过 60 秒即可「晋升成功」;被纪检委(鸡煎胃)抓两次就「进局子」。

## 玩法

- 点击屏幕 / 按空格键跳跃(支持连跳缓冲与土狼时间)
- 每存活 10 秒,速度加快一档
- 第一次被抓:1 秒无敌 + 减速,第二次被抓:游戏结束
- 撑满 60 秒:🎉 晋升成功!
- 最佳成绩自动保存在本机

## 技术栈

- [Phaser 3](https://phaser.io/) 游戏引擎 + TypeScript + Vite
- [Capacitor](https://capacitorjs.com/):安卓 / iOS 打包
- [Tauri](https://tauri.app/):桌面版打包(macOS 已可出包)
- GitHub Actions:每次推送自动部署网页版、自动打包安卓 APK

## 本地开发

```bash
npm install
npm run dev        # 浏览器打开游戏
npm run build      # 构建网页版到 dist/
```

## 打包

- **安卓 APK**:推送代码后 GitHub Actions 自动打包,产物在仓库 Actions 页面下载(`wangbo-runner-apk`)
- **桌面版**:`npm run tauri:build`

## 目录结构

```
src/
  scenes/        Boot → Preload → Game → Result 四个场景
  config/        游戏参数常量(速度、跳跃、障碍等)
android/ ios/    Capacitor 移动端工程
src-tauri/       Tauri 桌面端工程
.github/workflows/  网页部署 + APK 打包工作流
```
