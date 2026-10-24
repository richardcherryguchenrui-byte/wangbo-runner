// 离线收益结算:统一入口,主界面和家产界面都走这里,避免重复领取
// 家产产出的是黑金(赃款),和跑酷赚的银币分开记账
import { loadProgress, saveProgress } from './progress';
import { accrueOffline, incomePerMin } from './assets';

export interface OfflineIncome {
  /** 黑金(赃款):产业产出,只用于升级产业/打点/洗白 */
  corrupt: number;
  capped: boolean;
  perMin: number;
  elapsedMs: number;
}

/**
 * 结算离线期间的家产收益并写回存档。
 * 幂等:调用后 lastAccrualAt 会更新,重复调用只会拿到 0。
 */
export function collectOfflineIncome(nowMs = Date.now()): OfflineIncome {
  const p = loadProgress();
  const h = {
    assets: p.assets ?? {},
    network: p.network ?? {},
    laundered: p.laundered ?? 0
  };
  const last = p.lastAccrualAt || 0;
  const elapsed = last > 0 ? nowMs - last : 0;
  const r = accrueOffline(h, elapsed);
  p.lastAccrualAt = nowMs;
  if (r.coins > 0) p.corrupt = (p.corrupt ?? 0) + r.coins;
  saveProgress(p);
  return { corrupt: r.coins, capped: r.capped, perMin: incomePerMin(h), elapsedMs: r.elapsedMs };
}

/** 只读预览(不写存档),用于主界面展示「大约能领多少」 */
export function peekOfflineIncome(nowMs = Date.now()): OfflineIncome {
  const p = loadProgress();
  const h = {
    assets: p.assets ?? {},
    network: p.network ?? {},
    laundered: p.laundered ?? 0
  };
  const last = p.lastAccrualAt || 0;
  const elapsed = last > 0 ? nowMs - last : 0;
  const r = accrueOffline(h, elapsed);
  return { corrupt: r.coins, capped: r.capped, perMin: incomePerMin(h), elapsedMs: r.elapsedMs };
}

/** 把毫秒格式化成「X 小时 Y 分」 */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin} 分钟`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}
