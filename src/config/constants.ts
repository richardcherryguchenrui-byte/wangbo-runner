// 分辨率:960×540(16:9,在 1080p/4K 屏幕上均为整数倍缩放,像素清晰)
// 游戏版本号(标题页右下角展示)
export const GAME_VERSION = '1.7';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const BACKGROUND_COLOR = 0x5ec8f8; // sky blue

// 地面:24px 厚的沙地(足够厚,高速下落不会穿透)
export const GROUND_HEIGHT = 24;
export const GROUND_TOP = GAME_HEIGHT - GROUND_HEIGHT;

// 跑动速度:280 px/s 起步,每 10 秒 +20 px/s(放缓,保证看清障碍物)
export const RUN_SPEED_BASE = 280;
export const RUN_SPEED_ACCEL = 0.02;

// 跳跃手感:Chrome 恐龙为 重力0.6/帧²、初速12/帧,换算到本分辨率后微调
export const GRAVITY_Y = 2600;
export const JUMP_SPEED = 1050;
// 松手时若仍快速上升,钳制到该速度 → 短跳(Chrome 恐龙同款可变跳跃高度)
export const MIN_JUMP_SPEED = 400;
export const MAX_FALL_SPEED = 1300;

export const INVULNERABLE_TIME_MS = 1000;
export const COYOTE_TIME_MS = 120;
export const JUMP_BUFFER_MS = 120;

export const LEVEL_DURATION_MS = 60000;

// 障碍间距:按「当前速度 × 随机时间」生成,速度越快间距自动拉大
export const GAP_TIME_MIN = 0.8;
export const GAP_TIME_MAX = 1.6;

// 二段跳:单局存活 30 秒解锁,第二跳力度为第一跳的 85%
export const DOUBLE_JUMP_UNLOCK_MS = 30000;
export const DOUBLE_JUMP_SPEED_RATIO = 0.85;

// 手枪:商店兑换解锁,每局起始 3 发
export const PISTOL_BULLETS_PER_RUN = 3;
export const BULLET_SPEED = 900;
export const SHOOT_COOLDOWN_MS = 250;
