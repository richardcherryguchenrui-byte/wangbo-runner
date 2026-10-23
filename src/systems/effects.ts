// 局内特效工具:爆炸、爆点、落地灰尘、彩带、震屏、红闪
// 全部以 scene 为参数,GameScene 与结算场景共用
import Phaser from 'phaser';

// 爆炸特效:闪光 + 扩散火球 + 飞溅火星
export function explode(scene: Phaser.Scene, x: number, y: number) {
  const flash = scene.add.circle(x, y, 10, 0xfff3c4).setDepth(15);
  scene.tweens.add({ targets: flash, scale: 3.2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
  for (const [color, delay, size] of [[0xffb347, 0, 26], [0xff6a3d, 60, 40]] as const) {
    const ring = scene.add.circle(x, y, 6, color, 0.9).setDepth(14);
    scene.tweens.add({
      targets: ring, scale: size / 6, alpha: 0, duration: 320, delay,
      onComplete: () => ring.destroy()
    });
  }
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
    const d = Phaser.Math.Between(30, 70);
    const dot = scene.add
      .circle(x, y, Phaser.Math.Between(3, 6), i % 2 ? 0xffd54a : 0xff6a6a)
      .setDepth(15);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * d,
      y: y + Math.sin(angle) * d,
      alpha: 0,
      duration: 380,
      onComplete: () => dot.destroy()
    });
  }
}

// 小爆点(二段跳/护盾/落地)
export function poof(scene: Phaser.Scene, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const c = scene.add
      .circle(x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-18, 18), Phaser.Math.Between(4, 9), i % 2 ? 0xffd54a : 0xff6a6a)
      .setDepth(10);
    scene.tweens.add({ targets: c, scale: 2.4, alpha: 0, duration: 280, onComplete: () => c.destroy() });
  }
}

// 落地/奔跑灰尘(沙色小圆点)
export function dust(scene: Phaser.Scene, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const c = scene.add
      .circle(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-6, 2), Phaser.Math.Between(3, 7), 0xd6bf94, 0.85)
      .setDepth(9);
    scene.tweens.add({
      targets: c,
      x: c.x - Phaser.Math.Between(15, 40),
      y: c.y - Phaser.Math.Between(4, 16),
      alpha: 0,
      duration: Phaser.Math.Between(250, 420),
      onComplete: () => c.destroy()
    });
  }
}

// 彩带雨(破纪录庆祝)
export function confettiBurst(scene: Phaser.Scene, x: number, y: number, count = 26) {
  const colors = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xff922b];
  for (let i = 0; i < count; i++) {
    const c = scene.add
      .rectangle(x, y, Phaser.Math.Between(6, 10), Phaser.Math.Between(6, 12), Phaser.Utils.Array.GetRandom(colors))
      .setDepth(30)
      .setAngle(Phaser.Math.Between(0, 180));
    const vx = Phaser.Math.Between(-260, 260);
    const vy = Phaser.Math.Between(-420, -140);
    scene.tweens.add({
      targets: c,
      x: c.x + vx * 0.5,
      y: c.y + vy * 0.55 + 220,
      angle: c.angle + Phaser.Math.Between(180, 420),
      alpha: 0,
      duration: Phaser.Math.Between(900, 1400),
      ease: 'Quad.out',
      onComplete: () => c.destroy()
    });
  }
}

// 受击震屏(轻微)
export function shake(scene: Phaser.Scene, intensity = 0.004, duration = 120) {
  try { scene.cameras.main.shake(duration, intensity); } catch {}
}

// 全屏红色闪光(受击反馈)
export function redFlash(scene: Phaser.Scene) {
  const rect = scene.add
    .rectangle(0, 0, 2000, 2000, 0xff0000, 0.35)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(200);
  scene.tweens.add({ targets: rect, alpha: 0, duration: 260, onComplete: () => rect.destroy() });
}

// 全屏脉冲提示(巡视组来袭)
export function alarmPulse(scene: Phaser.Scene, color = 0xff2222) {
  const rect = scene.add
    .rectangle(0, 0, 2000, 2000, color, 0.25)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(199);
  scene.tweens.add({
    targets: rect, alpha: 0.04, duration: 500, yoyo: true, repeat: 2,
    onComplete: () => rect.destroy()
  });
}

// 升官/高光:金色冲击波 + 星星飞散
export function rankBurst(scene: Phaser.Scene, x: number, y: number, color = 0xffd43b) {
  const ring = scene.add.circle(x, y, 18, color, 0).setStrokeStyle(4, color, 0.9).setDepth(30);
  scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 520, ease: 'Cubic.out', onComplete: () => ring.destroy() });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = Phaser.Math.Between(50, 130);
    const s = scene.add.image(x, y, 'spark').setDepth(31).setScale(Phaser.Math.FloatBetween(0.5, 1.1)).setAngle(Phaser.Math.Between(0, 360));
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d - 20,
      alpha: 0,
      scale: 0.15,
      angle: s.angle + Phaser.Math.Between(90, 260),
      duration: Phaser.Math.Between(420, 720),
      ease: 'Quad.out',
      onComplete: () => s.destroy()
    });
  }
}

// 拾取银币:朝玩家飞的小金币 + 小火花
export function coinPop(scene: Phaser.Scene, x: number, y: number, count = 3) {
  for (let i = 0; i < count; i++) {
    const c = scene.add.image(x, y, 'coin').setDepth(30).setScale(0.6);
    scene.tweens.add({
      targets: c,
      x: x + Phaser.Math.Between(-26, 26),
      y: y - Phaser.Math.Between(34, 76),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(320, 520),
      ease: 'Quad.out',
      onComplete: () => c.destroy()
    });
  }
}

// 擦身而过:在玩家身侧闪一道白色速度线
export function nearMissStreak(scene: Phaser.Scene, x: number, y: number) {
  const line = scene.add.rectangle(x, y, 90, 3, 0xffffff, 0.9).setOrigin(1, 0.5).setDepth(18);
  scene.tweens.add({ targets: line, x: x - 80, alpha: 0, scaleX: 1.8, duration: 240, onComplete: () => line.destroy() });
  for (let i = 0; i < 4; i++) {
    const s = scene.add.image(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-26, 26), 'spark')
      .setDepth(19).setScale(0.6).setTint(0xffffff);
    scene.tweens.add({ targets: s, x: s.x - Phaser.Math.Between(30, 70), alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }
}

// 滑铲/起跳时向后的速度线
export function windStreak(scene: Phaser.Scene, x: number, y: number, count = 3) {
  for (let i = 0; i < count; i++) {
    const line = scene.add.rectangle(x + Phaser.Math.Between(-10, 20), y + Phaser.Math.Between(-24, 24), Phaser.Math.Between(40, 90), 2, 0xffffff, 0.5)
      .setOrigin(1, 0.5).setDepth(9);
    scene.tweens.add({ targets: line, x: line.x - 120, alpha: 0, duration: 260, onComplete: () => line.destroy() });
  }
}

