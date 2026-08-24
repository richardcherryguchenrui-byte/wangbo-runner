// 存档成长系统:金币、累计翻越、称号、皮肤、挂件、手枪
// 所有数据保存在 localStorage,跨局持久

export type PendantId = '' | 'star' | 'crown' | 'briefcase';

export interface Progress {
  coins: number;          // 金币(翻越障碍获得)
  totalDodged: number;    // 累计翻越障碍数(决定称号)
  owned: string[];        // 已拥有物品 id
  pendant: PendantId;     // 当前装备的挂件
  extraLives: number;     // 已解锁的额外初始生命(0~3)
  skin: string;           // 当前使用的主角皮肤:''=原角色,'qitongwei'=祁同伟
}

const KEY = 'wangboProgress';

// 初始生命升级:每级需要的累计翻越数逐级递增
export const LIFE_UPGRADE_THRESHOLDS = [100, 300, 600];
export const MAX_EXTRA_LIVES = LIFE_UPGRADE_THRESHOLDS.length;

export function nextLifeThreshold(p: Progress): number | null {
  return p.extraLives < MAX_EXTRA_LIVES ? LIFE_UPGRADE_THRESHOLDS[p.extraLives] : null;
}

// 祁同伟皮肤:需要累计翻越 1000 个障碍解锁
export const SKIN_QITONGWEI_REQUIREMENT = 1000;

function defaults(): Progress {
  return { coins: 0, totalDodged: 0, owned: [], pendant: '', extraLives: 0, skin: '' };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {}
  return defaults();
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// 称号:按累计翻越数解锁
export function getTitle(totalDodged: number): string {
  if (totalDodged >= 500) return '厅长';
  if (totalDodged >= 300) return '局长';
  if (totalDodged >= 150) return '处长';
  if (totalDodged >= 50) return '科长';
  return '科员';
}

// 称号里程碑(用于展示下一级目标)
export const TITLE_MILESTONES: [number, string][] = [
  [50, '科长'], [150, '处长'], [300, '局长'], [500, '厅长']
];

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'pistol' | 'pendant' | 'life' | 'skin';
  pendant?: PendantId;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'life', name: '❤️ 初始生命 +1', desc: '每级需更多累计翻越', price: 0, kind: 'life' },
  { id: 'skin-qitongwei', name: '👤 皮肤·祁同伟', desc: '更换主角皮肤', price: 0, kind: 'skin' },
  { id: 'pistol', name: '🔫 反腐手枪', desc: '每局 3 发子弹,射击摧毁障碍', price: 30, kind: 'pistol' },
  { id: 'pendant-star', name: '挂件·星星', desc: '头顶 ⭐', price: 25, kind: 'pendant', pendant: 'star' },
  { id: 'pendant-briefcase', name: '挂件·公文包', desc: '头顶 💼', price: 35, kind: 'pendant', pendant: 'briefcase' },
  { id: 'pendant-crown', name: '挂件·皇冠', desc: '头顶 👑', price: 60, kind: 'pendant', pendant: 'crown' }
];

export const PENDANT_EMOJI: Record<PendantId, string> = {
  '': '', star: '⭐', crown: '👑', briefcase: '💼'
};

export function hasPistol(p: Progress): boolean {
  return p.owned.includes('pistol');
}
