// 闯关模式关卡选择 ·「官场现形记」
// 6 章 × 3 关:显示星级、锁定状态、章节星数门槛,并提供「继续闯关」一把梭入口。
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { loadProgress } from '../systems/progress';
import { buildMenuBackdrop, buildMenuHeader, addMenuFooter } from '../systems/menu';
import { makeHeroButton, showToast, FONT, addPanel } from '../systems/ui';
import { startBgm, playSfx } from '../systems/audio';
import {
  CHAPTERS,
  LEVELS,
  TOTAL_STARS,
  MAX_STARS_PER_LEVEL,
  isLevelUnlocked,
  isChapterUnlocked,
  totalStars,
  type LevelDef
} from '../systems/levels';

const ROW_Y0 = 108;
const ROW_H = 60;
const CHIP_W = 196;
const CHIP_H = 50;
const CHIP_X = [432, 640, 848];

export default class CampaignScene extends Phaser.Scene {
  constructor() {
    super('Campaign');
  }

  create() {
    startBgm(this);
    const p = loadProgress();
    const stars = p.levelStars ?? {};
    const sum = totalStars(stars);

    buildMenuBackdrop(this, { mood: 'night' });
    buildMenuHeader(this, '官场现形记', '六章十八关 · 从科员一路跑到厅长', { coins: p.coins });

    // 累计星数
    const starPanel = addPanel(this, GAME_WIDTH - 210, 62, 186, 34, {
      fill: 0x0b1a2e, fillAlpha: 0.86, stroke: 0xffd43b, strokeAlpha: 0.32, radius: 17
    }).setDepth(21);
    void starPanel;
    this.add
      .image(GAME_WIDTH - 188, 79, 'pendant-star')
      .setDisplaySize(19, 19)
      .setDepth(22);
    this.add
      .text(GAME_WIDTH - 172, 79, `${sum} / ${TOTAL_STARS}`, {
        fontFamily: FONT, fontSize: '15px', color: '#ffe066', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    CHAPTERS.forEach((ch, i) => {
      const rowY = ROW_Y0 + i * ROW_H;
      const chapterOpen = isChapterUnlocked(ch.index, stars);
      const chapterLevels = LEVELS.filter(l => l.chapter === ch.index);
      const chapterStars = chapterLevels.reduce((s, l) => s + (stars[l.id] ?? 0), 0);

      // 章节名 + 标语
      this.add
        .text(44, rowY + 14, `第${['一', '二', '三', '四', '五', '六'][i]}章 · ${ch.name}`, {
          fontFamily: FONT, fontSize: '16px', color: chapterOpen ? '#ffe066' : '#5c7089', fontStyle: 'bold', resolution: 2
        })
        .setOrigin(0, 0.5)
        .setDepth(22);
      this.add
        .text(44, rowY + 36, chapterOpen ? ch.tagline : `需 ${ch.requireStars} 星解锁`, {
          fontFamily: FONT, fontSize: '11px', color: chapterOpen ? '#93b5d6' : '#7a5a5a', resolution: 2
        })
        .setOrigin(0, 0.5)
        .setDepth(22);
      // 章节星数
      this.add
        .image(214, rowY + 20, 'pendant-star')
        .setDisplaySize(13, 13)
        .setDepth(22)
        .setAlpha(chapterOpen ? 0.95 : 0.4);
      this.add
        .text(226, rowY + 20, `${chapterStars}/${chapterLevels.length * MAX_STARS_PER_LEVEL}`, {
          fontFamily: FONT, fontSize: '11px', color: chapterOpen ? '#ffe066' : '#5c7089', resolution: 2
        })
        .setOrigin(0, 0.5)
        .setDepth(22);

      chapterLevels.forEach((level, j) => {
        this.makeLevelChip(CHIP_X[j], rowY + 26, level, stars[level.id] ?? 0, chapterOpen && isLevelUnlocked(level.id, stars));
      });
    });

    // 继续闯关:第一个「已解锁但没通关」的关卡,全部通关则回到最后一关
    const resume = LEVELS.find(l => isLevelUnlocked(l.id, stars) && (stars[l.id] ?? 0) === 0)
      ?? LEVELS.filter(l => (stars[l.id] ?? 0) > 0).slice(-1)[0]
      ?? LEVELS[0];
    const allCleared = LEVELS.every(l => (stars[l.id] ?? 0) > 0);

    makeHeroButton(this, GAME_WIDTH / 2, 486, 300, 50, allCleared ? '再刷一遍' : '继续闯关', () => {
      playSfx(this, 'click', 0.4);
      this.startLevel(resume.id);
    }, { iconKey: 'ui-play', iconSize: 20, fontSize: 22, depth: 24 });

    this.add
      .text(GAME_WIDTH / 2 + 172, 486, resume.name, {
        fontFamily: FONT, fontSize: '13px', color: '#93b5d6', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(24);

    addMenuFooter(this, '打通一关即可解锁下一关 · 星级越高奖励越多');
  }

  private makeLevelChip(x: number, y: number, level: LevelDef, stars: number, unlocked: boolean) {
    const cleared = stars > 0;
    const fill = !unlocked ? 0x131f2e : cleared ? 0x14304a : 0x0d2038;
    const stroke = !unlocked ? 0x2a3a4d : stars >= 3 ? 0xffd43b : cleared ? 0x69db7c : 0x4dabf7;

    const panel = addPanel(this, x - CHIP_W / 2, y - CHIP_H / 2, CHIP_W, CHIP_H, {
      fill, fillAlpha: unlocked ? 0.94 : 0.7, stroke, strokeAlpha: unlocked ? 0.55 : 0.2, radius: 14
    }).setDepth(21);

    // 关卡名
    this.add
      .text(x - CHIP_W / 2 + 14, y - 7, level.name, {
        fontFamily: FONT, fontSize: '15px', color: unlocked ? '#ffffff' : '#6b829c', fontStyle: 'bold', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    // 时长
    this.add
      .text(x - CHIP_W / 2 + 14, y + 12, `${Math.round(level.durationMs / 1000)} 秒`, {
        fontFamily: FONT, fontSize: '10px', color: unlocked ? '#8ba9c7' : '#556b80', resolution: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(22);

    // 星级(锁定时不画星,避免和锁图标打架)
    if (unlocked) {
      for (let i = 0; i < MAX_STARS_PER_LEVEL; i++) {
        const star = this.add
          .image(x + 56 + i * 20, y + 2, 'pendant-star')
          .setDisplaySize(15, 15)
          .setDepth(22);
        if (i < stars) {
          star.setTint(0xffd43b);
        } else {
          star.setTint(0x33465e);
          star.setAlpha(0.9);
        }
      }
    } else {
      this.add
        .image(x + CHIP_W / 2 - 24, y + 2, 'ui-lock')
        .setDisplaySize(18, 18)
        .setDepth(22)
        .setAlpha(0.85);
    }

    const hit = this.add
      .rectangle(x, y, CHIP_W, CHIP_H, 0xffffff, 0.001)
      .setDepth(23)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (!unlocked) {
        playSfx(this, 'click', 0.25);
        showToast(this, GAME_WIDTH / 2, 96, '先打通上一关才能进这一关', '#ff9999', 'ui-lock');
        return;
      }
      playSfx(this, 'click', 0.4);
      this.startLevel(level.id);
    });

    // 通关关卡轻微呼吸,给「还能刷星」一点提示
    if (cleared && stars < MAX_STARS_PER_LEVEL) {
      this.tweens.add({
        targets: panel,
        alpha: { from: 0.94, to: 1 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  private startLevel(levelId: string) {
    this.cameras.main.fadeOut(160, 7, 20, 42);
    this.time.delayedCall(170, () => this.scene.start('Game', { levelId }));
  }
}
