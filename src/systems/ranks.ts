// 单局官阶:翻越障碍数达到阈值就升一级,给一局之内持续的正反馈
// 与存档里的累计称号(progress.getTitle)相互独立:官阶是本局成就,称号是生涯成就。

export interface RunRank {
  index: number;
  dodged: number;
  name: string;
  short: string;
  color: string;
}

export const RUN_RANKS: RunRank[] = [
  { index: 0, dodged: 0, name: '科员', short: '科员', color: '#cfe3ff' },
  { index: 1, dodged: 10, name: '副科长', short: '副科', color: '#8ce99a' },
  { index: 2, dodged: 24, name: '科长', short: '科长', color: '#74c0fc' },
  { index: 3, dodged: 42, name: '副处长', short: '副处', color: '#b197fc' },
  { index: 4, dodged: 65, name: '处长', short: '处长', color: '#ffd43b' },
  { index: 5, dodged: 95, name: '副局长', short: '副局', color: '#ffa94d' },
  { index: 6, dodged: 130, name: '局长', short: '局长', color: '#ff8787' },
  { index: 7, dodged: 180, name: '厅长', short: '厅长', color: '#ff6b6b' }
];

export function rankAt(dodged: number): RunRank {
  let current = RUN_RANKS[0];
  for (const r of RUN_RANKS) {
    if (dodged >= r.dodged) current = r;
    else break;
  }
  return current;
}

export function nextRank(dodged: number): RunRank | null {
  return RUN_RANKS.find(r => r.dodged > dodged) ?? null;
}

export function rankProgress(dodged: number): { current: RunRank; next: RunRank | null; ratio: number; remain: number } {
  const current = rankAt(dodged);
  const next = nextRank(dodged);
  if (!next) return { current, next: null, ratio: 1, remain: 0 };
  const span = next.dodged - current.dodged;
  const ratio = span <= 0 ? 1 : Math.min(1, (dodged - current.dodged) / span);
  return { current, next, ratio, remain: next.dodged - dodged };
}
