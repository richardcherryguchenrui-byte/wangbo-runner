// 分辨率:960×540(16:9,在 1080p/4K 屏幕上均为整数倍缩放,像素清晰)
// 游戏版本号(标题页右下角展示)
export const GAME_VERSION = '2.1';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const BACKGROUND_COLOR = 0x5ec8f8; // sky blue

// ---- 渲染分辨率 ----
// 画布后备缓冲 = 逻辑分辨率 × RENDER_SCALE,每个场景的相机同步放大同样倍数。
// 逻辑坐标仍然是 960×540,所以所有布局代码不用动;
// 但真正参与绘制的像素翻倍(960×540 → 1920×1080),
// 不再是「960×540 硬拉到 2 倍」那种马赛克感。
// 文本的 resolution: 2 正好匹配这个倍率,调大倍率要同步调整文字,否则会发糊。
export const RENDER_SCALE = 2;

// 地面:24px 厚的沙地(足够厚,高速下落不会穿透)
export const GROUND_HEIGHT = 24;
export const GROUND_TOP = GAME_HEIGHT - GROUND_HEIGHT;

// 跑动速度:280 px/s 起步,每 10 秒 +30 px/s(约 3.5 分钟到达上限)
// 注意:0.003 px/s² 每毫秒 = 3 px/s 每秒 = 30 px/s 每 10 秒
export const RUN_SPEED_BASE = 280;
export const RUN_SPEED_ACCEL = 0.003;
// 无限时间模式下速度封顶,避免后期快到无法反应
export const RUN_SPEED_MAX = 900;

// 跳跃手感:Chrome 恐龙为 重力0.6/帧²、初速12/帧,换算到本分辨率后微调
export const GRAVITY_Y = 2600;
export const JUMP_SPEED = 1050;
// 松手时若仍快速上升,钳制到该速度 → 短跳(Chrome 恐龙同款可变跳跃高度)
export const MIN_JUMP_SPEED = 400;
export const MAX_FALL_SPEED = 1300;

export const INVULNERABLE_TIME_MS = 1000;
export const COYOTE_TIME_MS = 120;
export const JUMP_BUFFER_MS = 120;

// 障碍间距:按「当前速度 × 随机时间」生成,速度越快间距自动拉大
export const GAP_TIME_MIN = 0.95;
export const GAP_TIME_MAX = 1.65;

// ---- 滑铲:下滑 / ↓ / S,降低身位从低空障碍下钻过 ----
export const SLIDE_DURATION_MS = 620;
export const SLIDE_COOLDOWN_MS = 140;
export const SLIDE_BODY_HEIGHT = 48;

// ---- 完美滑铲:只有「卡点」滑铲才算,提前滑下去躲掉只是普通翻越 ----
// 起滑瞬间,低空障碍前沿到玩家前沿的剩余时间 ≤ 该值 → 判定完美
export const PERFECT_SLIDE_ETA_MS = 170;
// 起滑时障碍已经贴到身上(甚至轻微重叠)仍算卡点,留一帧左右的容差
export const PERFECT_SLIDE_OVERLAP_TOL_PX = 16;
export const PERFECT_SLIDE_COINS = 2;
export const PERFECT_SLIDE_HYPE = 6;

// ---- 关卡加时:到点时目标没做完,再给一段,别让玩家白跑 ----
export const LEVEL_OVERTIME_MS = 15000;

// ---- 擦身而过:极限躲避奖励 + 气势 ----
export const NEAR_MISS_DISTANCE = 26;
// 擦身也要求「卡点」:跳/滑必须发生在接触前这么多毫秒内,提前躲开只算普通翻越
export const NEAR_MISS_CLUTCH_ETA_MS = 170;
export const NEAR_MISS_COINS = 2;
export const NEAR_MISS_HYPE = 14;

// ---- 气势 / 高光时刻:攒满自动进入无敌冲刺 ----
export const HYPE_MAX = 100;
export const HYPE_PER_DODGE = 2;
export const HYPE_PER_COIN = 1.2;
export const HYPE_PER_PICKUP = 18;
export const HYPE_PER_KILL = 5;
export const HYPE_HIT_PENALTY = 30;
export const OVERDRIVE_MS = 4200;
export const OVERDRIVE_SPEED_MULT = 1.06;
export const OVERDRIVE_COIN_MULT = 2;

// ---- 世界里的普通银币(成串出现,鼓励跳高线) ----
export const WORLD_COIN_VALUE = 1;
export const WORLD_COIN_HYPE = 1.2;

// ---- 每日挑战 ----
export const DAILY_REWARD_FIRST = 40;
export const DAILY_REWARD_RECORD = 40;

// ---- 障碍出场曲线:按存活时间分阶段解锁种类(新手保护) ----
export const STAGE_BEAUTY_MS = 25000;  // 25 秒后才出现地面美女
export const STAGE_FLYER_MS = 50000;   // 50 秒后才出现半空飞来的美女
export const FLYER_COIN_BONUS = 2;     // 飞来的美女难度高,翻越多给 1 银币

// 二段跳:单局存活 30 秒解锁,第二跳力度为第一跳的 85%
export const DOUBLE_JUMP_UNLOCK_MS = 30000;
export const DOUBLE_JUMP_SPEED_RATIO = 0.85;

// 手枪:商店兑换解锁,每局起始 3 发(升级后 5/7 发)
export const PISTOL_BULLETS_PER_RUN = 3;
export const PISTOL_BULLETS_PER_LEVEL = 2; // 每级 +2 发
export const BULLET_SPEED = 900;
export const SHOOT_COOLDOWN_MS = 250;

// ---- 连击系统:连续翻越不受伤,银币加成 ----
export const COMBO_TIER_1 = 10;  // 连击 ≥10 → 每个障碍 +1 银币(×2)
export const COMBO_TIER_2 = 25;  // 连击 ≥25 → 每个障碍 +2 银币(×3)

// ---- 空中道具:随机掉落,跳起拾取 ----
export const PICKUP_MIN_GAP_MS = 6000;   // 两次道具至少间隔
export const PICKUP_MAX_GAP_MS = 12000;  // 最多间隔
export const PICKUP_Y = -130;            // 道具高度(相对地面)
export const PICKUP_COIN_BONUS = 10;     // 银币袋直接 +10
export const PICKUP_SHIELD_MS = 8000;    // 护盾持续
export const PICKUP_DOUBLE_MS = 10000;   // 双倍银币持续
export const PICKUP_SLOW_MS = 5000;      // 缓刑(减速)持续
export const PICKUP_SLOW_FACTOR = 0.6;   // 缓刑期间速度系数

// ---- 巡视组事件:随机来袭,存活有奖励 ----
export const INSPECTION_FIRST_MS = 45000;  // 第一次来袭
export const INSPECTION_MIN_GAP_MS = 50000; // 之后每隔 50~80 秒
export const INSPECTION_MAX_GAP_MS = 80000;
export const INSPECTION_DURATION_MS = 10000; // 持续 10 秒
export const INSPECTION_SPAWN_FACTOR = 0.35; // 期间障碍密度 ×3
export const INSPECTION_REWARD = 20;         // 平安度过奖励

// ---- 昼夜循环:随存活时间过渡(秒) ----
export const DAY_DUSK_MS = 60000;   // 60 秒黄昏
export const DAY_NIGHT_MS = 90000;  // 90 秒入夜
export const DAY_DEEP_MS = 150000;  // 150 秒深夜

// ---- 其他 ----
export const BGM2_SWITCH_MS = 30000;       // 30 秒后切第二首 BGM
export const FLYER_WARN_MS = 900;          // 空中美女预警提示时长
