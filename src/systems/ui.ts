import Phaser from 'phaser';

// 通用按钮:深蓝底 + 白描边 + 文字,点击回调
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 22
) {
  const rect = scene.add
    .rectangle(x, y, w, h, 0x1d3557, 0.88)
    .setStrokeStyle(2, 0xffffff)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffffff' })
    .setOrigin(0.5);
  rect.on('pointerdown', onClick);
  return { rect, text };
}

// 短暂提示:浮起渐隐
export function showToast(scene: Phaser.Scene, x: number, y: number, msg: string, color = '#ffe066') {
  const t = scene.add
    .text(x, y, msg, { fontFamily: 'monospace', fontSize: '20px', color, stroke: '#1d3557', strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(100);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 1400,
    onComplete: () => t.destroy()
  });
}
