// ─── Global Dashboard Configuration ──────────────────
// All magic numbers extracted into a single source of truth.

/** 美元兑人民币汇率 — 可通过 .env.local 覆盖 */
export const EXCHANGE_RATE: number =
  Number(process.env.NEXT_PUBLIC_EXCHANGE_RATE) || 7.25;

/** 当前系统年份（动态获取，拒绝硬编码 2026） */
export const CURRENT_YEAR: number = new Date().getFullYear();

/** 默认供应链成本费率（%） */
export const DEFAULT_COGS_RATE = 30;
export const DEFAULT_SHIPPING_RATE = 20;
export const DEFAULT_MARKETING_RATE = 25;

/** 退货风险阈值 (%) */
export const REFUND_LOW_THRESHOLD = 1.0;
export const REFUND_HIGH_THRESHOLD = 1.5;

/** 演示数据覆盖天数 */
export const DEMO_LOOKBACK_DAYS = 14;

/** 近 7 天增长系数（本周比上周高 ~15%） */
export const DEMO_GROWTH_FACTOR = 1.15;
