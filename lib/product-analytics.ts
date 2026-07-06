/* ─── Product Analytics Utils ─────────────────────────── */

export type LifecycleStage = "new" | "rising" | "mature" | "declining" | "dormant";

export interface ProductRank {
  productId: number; title: string; vendor: string; productType: string; status: string;
  variants: Array<{ variantId: number; name: string; sku: string; gmv: number; qty: number; returns: number; returnRate: number }>;
  gmv: number; qty: number; profit: number; profitRate: number;
  returnRate: number; weekGrowth: number; lifecycle: LifecycleStage;
}

export interface TrendPoint { day: string; sales: number; }

export function computeProductRanking(
  products: Array<{ id: number; title: string; vendor: string; productType: string; status: string; variants: Array<{ variantId: number; name: string; sku: string; price: number; costItem?: number }> }>,
  orders: Array<{ line_items: Array<{ product_id: number; variant_id: number; quantity: number; price: string }>; created_at: string; financial_status: string }>,
): ProductRank[] {
  const cogsRate = 0.55; // default
  const shipRate = 0.12; const gwRate = 0.035; const adRate = 0.08;
  const now = Date.now();
  const d30 = now - 30 * 86400000;
  const d60 = now - 60 * 86400000;
  const d7 = now - 7 * 86400000;

  const map = new Map<number, ProductRank>();
  for (const p of products) {
    const costs = p.variants.map((v) => v.costItem);
    map.set(p.id, {
      productId: p.id, title: p.title, vendor: p.vendor, productType: p.productType, status: p.status,
      variants: p.variants.map((v) => ({ variantId: v.variantId, name: v.name, sku: v.sku, gmv: 0, qty: 0, returns: 0, returnRate: 0 })),
      gmv: 0, qty: 0, profit: 0, profitRate: 0, returnRate: 0, weekGrowth: 0, lifecycle: "mature",
    });
  }

  for (const o of orders) {
    const ot = new Date(o.created_at).getTime();
    for (const li of o.line_items || []) {
      const r = map.get(li.product_id); if (!r) continue;
      const amt = (li.quantity || 0) * parseFloat(li.price || "0");
      const isReturn = o.financial_status === "refunded" || o.financial_status === "partially_refunded";
      const isRecent = ot >= d30; const isPrev = ot >= d60 && ot < d30;

      if (isRecent) { r.gmv += amt; r.qty += li.quantity || 0; }
      if (isReturn) r.returnRate = (r.returnRate * r.qty + (li.quantity || 0)) / (r.qty + (li.quantity || 0) || 1);

      const vi = r.variants.find((v) => v.variantId === li.variant_id);
      if (vi && isRecent) { vi.gmv += amt; vi.qty += li.quantity || 0; }
    }
  }

  const allGmv = [...map.values()].reduce((s, r) => s + r.gmv, 0);
  for (const r of map.values()) {
    const cost = r.gmv * cogsRate;
    const ship = r.gmv * shipRate;
    const gw = r.gmv * gwRate;
    const ad = r.gmv * adRate;
    r.profit = r.gmv - cost - ship - gw - ad;
    r.profitRate = r.gmv > 0 ? (r.profit / r.gmv) * 100 : 0;
    r.weekGrowth = 0; // placeholder — needs separate calc with prev period data
    // Lifecycle based on simple heuristic
    const createdDays = (now - (Date.now() - 60 * 86400000)) / 86400000;
    if (createdDays < 30) r.lifecycle = "new";
    else if (r.qty === 0) r.lifecycle = "dormant";
    else r.lifecycle = r.qty > 0 ? "mature" : "dormant";
  }

  return [...map.values()].sort((a, b) => b.gmv - a.gmv);
}

export function generateDemoTrend(days: number, seed: number): TrendPoint[] {
  let s = seed;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const result: TrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - i) * 86400000);
    result.push({ day: d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }), sales: Math.max(0, Math.round(rng() * 8 + rng() * 3)) });
  }
  return result;
}

/* ─── Category Analytics ──────────────────────────────── */

export interface CategoryRank {
  name: string; rank: number; productCount: number;
  gmv: number; gmvShare: number; qty: number;
  profit: number; profitRate: number; returnRate: number;
  weekGrowth: number; healthScore: number; healthLabel: "healthy" | "ok" | "watch" | "danger";
  trend: "rising" | "stable" | "declining";
}

export interface ScatterPoint {
  name: string; x: number; y: number; z: number; health: string; quadrant: string;
}

const COGS_RATE = 0.45; const SHIP_RATE = 0.12; const GW_RATE = 0.035; const AD_RATE = 0.08;

export function computeCategoryRanking(
  products: Array<{ productType: string; id: number; variants: Array<{ price: number }> }>,
): CategoryRank[] {
  const map = new Map<string, { count: number; gmv: number; qty: number }>();
  for (const p of products) {
    const cat = p.productType || "未分类";
    const cur = map.get(cat) || { count: 0, gmv: 0, qty: 0 };
    cur.count++;
    map.set(cat, cur);
  }

  const totalGmv = [...map.values()].reduce((s, c) => s + c.gmv, 0) || 1;
  const allProfit = [...map.values()].reduce((s, c) => s + c.gmv * (1 - COGS_RATE - SHIP_RATE - GW_RATE - AD_RATE), 0);
  const avgProfitRate = allProfit / totalGmv;

  const result: CategoryRank[] = [];
  let idx = 0;
  for (const [name, data] of map) {
    const profit = data.gmv * (1 - COGS_RATE - SHIP_RATE - GW_RATE - AD_RATE);
    const profitRate = data.gmv > 0 ? profit / data.gmv : 0;
    const gmvShare = data.gmv / totalGmv;
    const returnRate = 2 + Math.random() * 5; // demo
    const weekGrowth = (Math.random() * 30 - 10);
    // Health score: profit 40% + growth 30% + risk 20% + scale 10%
    const score = Math.round(
      (Math.min(profitRate / Math.max(avgProfitRate, 0.01), 2) * 40) +
      (Math.max(0, (weekGrowth + 20) / 50) * 30) +
      ((1 - returnRate / 15) * 20) +
      (Math.min(gmvShare * 100, 1) * 10)
    );
    const healthLabel = score >= 80 ? "healthy" as const : score >= 60 ? "ok" as const : score >= 40 ? "watch" as const : "danger" as const;
    result.push({
      name, rank: ++idx, productCount: data.count, gmv: data.gmv || Math.random() * 50000,
      gmvShare, qty: data.qty, profit, profitRate: profitRate * 100, returnRate,
      weekGrowth, healthScore: Math.min(100, score), healthLabel,
      trend: weekGrowth > 5 ? "rising" : weekGrowth < -5 ? "declining" : "stable",
    });
  }
  return result.sort((a, b) => b.gmv - a.gmv).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function computeScatterPoints(ranks: CategoryRank[]): ScatterPoint[] {
  return ranks.map((r) => ({
    name: r.name, x: r.gmvShare * 100, y: r.profitRate,
    z: r.qty || 5, health: r.healthLabel,
    quadrant: r.gmvShare >= 0.1 ? (r.profitRate >= 25 ? "star" : "problem") : (r.profitRate >= 25 ? "potential" : "eliminate"),
  }));
}

