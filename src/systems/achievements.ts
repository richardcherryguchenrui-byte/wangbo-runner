// 成就系统:基于存档统计字段判定,领取时发放银币奖励
// 判定是纯函数,方便单元测试;展示在「任务·成就」面板
import type { Progress } from './progress';
import { totalAssetValue, NETWORK } from './assets';

/** 存档里的家产总值 */
function assetValueOf(p: Progress): number {
  return totalAssetValue({
    assets: p.assets ?? {}, network: p.network ?? {}, laundered: p.laundered ?? 0
  });
}

/** 人脉总等级 */
function networkLevels(p: Progress): number {
  const n = p.network ?? {};
  return NETWORK.reduce((sum, def) => sum + (n[def.id] ?? 0), 0);
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
  check(p: Progress): boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-run', name: '初入仕途', desc: '完成第一局游戏', reward: 20, check: p => p.totalRuns >= 1 },
  { id: 'survivor-60', name: '站稳脚跟', desc: '单局存活 60 秒', reward: 50, check: p => p.bestTimeMs >= 60000 },
  { id: 'survivor-120', name: '老油条', desc: '单局存活 120 秒', reward: 150, check: p => p.bestTimeMs >= 120000 },
  { id: 'dodger-50', name: '身轻如燕', desc: '单局翻越 50 个障碍', reward: 50, check: p => p.bestDodged >= 50 },
  { id: 'runner-100', name: '百炼成钢', desc: '累计翻越 100 个障碍', reward: 50, check: p => p.totalDodged >= 100 },
  { id: 'runner-1000', name: '晋升骨干', desc: '累计翻越 1000 个障碍', reward: 150, check: p => p.totalDodged >= 1000 },
  { id: 'combo-20', name: '一气呵成', desc: '单局连击达到 20', reward: 80, check: p => p.bestCombo >= 20 },
  { id: 'sharpshooter', name: '反腐神枪手', desc: '累计击毁 30 个障碍', reward: 80, check: p => p.totalKills >= 30 },
  { id: 'collector-30', name: '拾荒者', desc: '累计拾取 30 个道具', reward: 60, check: p => p.totalPickups >= 30 },
  { id: 'inspection-10', name: '巡视组克星', desc: '平安度过 10 次巡视检查', reward: 100, check: p => p.inspectionsSurvived >= 10 },
  { id: 'rich', name: '腰缠万贯', desc: '银币余额达到 500', reward: 50, check: p => p.coins >= 500 },
  { id: 'spender', name: '拉动内需', desc: '累计消费 500 银币', reward: 80, check: p => p.totalSpent >= 500 },
  { id: 'qitongwei', name: '拜入祁门', desc: '解锁祁同伟皮肤', reward: 50, check: p => p.skin === 'qitongwei' || p.owned.includes('skin-qitongwei') },
  { id: 'full-lives', name: '命硬', desc: '初始生命升级到满级', reward: 100, check: p => p.extraLives >= 3 },
  { id: 'magnate', name: '大收藏家', desc: '集齐全部挂件', reward: 120, check: p =>
    ['star', 'briefcase', 'crown', 'medal', 'scale', 'trophy'].every(id => p.owned.includes('pendant-' + id)) },
  // ---- 贪污资产与审查 ----
  { id: 'first-asset', name: '第一个抽屉', desc: '建起第一项家产', reward: 40, check: p => assetValueOf(p) > 0 },
  { id: 'asset-10k', name: '白手套起步', desc: '家产总值达到 1 万', reward: 120, check: p => assetValueOf(p) >= 10000 },
  { id: 'asset-1m', name: '一方诸侯', desc: '家产总值达到 15 万', reward: 400, check: p => assetValueOf(p) >= 150000 },
  { id: 'network-10', name: '关系户', desc: '人脉总等级达到 10', reward: 150, check: p => networkLevels(p) >= 10 },
  { id: 'audit-5', name: '蒙混过关', desc: '累计躲过 5 次审查', reward: 200, check: p => (p.auditsSurvived ?? 0) >= 5 },
  { id: 'seized-3', name: '家破人亡', desc: '被没收 3 次资产', reward: 60, check: p => (p.assetsSeized ?? 0) >= 3 }
];

// 检测并领取新成就:返回新获得的成就,同时写入存档并发放奖励
export function claimNewAchievements(p: Progress): AchievementDef[] {
  const earned: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (p.achievements.includes(def.id)) continue;
    try {
      if (def.check(p)) {
        p.achievements.push(def.id);
        p.coins += def.reward;
        earned.push(def);
      }
    } catch { /* 判定出错不影响游戏 */ }
  }
  return earned;
}

export function isAchievementUnlocked(p: Progress, id: string): boolean {
  return p.achievements.includes(id);
}
