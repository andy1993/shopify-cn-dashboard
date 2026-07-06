/* ─── RFM Customer Analytics ──────────────────────────── */

export interface CustomerRFM {
  customerId: number; name: string; email: string; country: string;
  rScore: number; fScore: number; mScore: number; composite: number;
  totalSpent: number; orderCount: number; lastOrderDays: number;
  firstOrderDate: string; avgOrderValue: number;
  segment: "champion" | "loyal" | "potential" | "lowActivity" | "atRisk" | "lost";
}

export interface SegmentStats {
  segment: CustomerRFM["segment"]; label: string; emoji: string; color: string;
  count: number; gmvShare: number; totalSpent: number;
}

export type MigrationMatrix = Record<string, Record<string, number>>;

export interface MarketingSuggestion {
  segment: CustomerRFM["segment"]; title: string; body: string; reachCount: number;
}

export const SEGMENT_CONFIG: Record<CustomerRFM["segment"], { label: string; emoji: string; color: string; bg: string; order: number }> = {
  champion:    { label: "核心客户",   emoji: "🟢", color: "text-emerald-400", bg: "bg-emerald-500/15", order: 0 },
  loyal:       { label: "忠实客户",   emoji: "🟦", color: "text-blue-400",    bg: "bg-blue-500/15",    order: 1 },
  potential:   { label: "潜力客户",   emoji: "🟡", color: "text-amber-400",   bg: "bg-amber-500/15",   order: 2 },
  lowActivity: { label: "低活跃客户", emoji: "🟠", color: "text-orange-400",  bg: "bg-orange-500/15",  order: 3 },
  atRisk:      { label: "流失风险",   emoji: "🔴", color: "text-red-400",     bg: "bg-red-500/15",     order: 4 },
  lost:        { label: "已流失",     emoji: "⚫", color: "text-zinc-400",    bg: "bg-zinc-500/15",    order: 5 },
};

export interface RFMThresholds {
  r: number[]; // [r5Boundary, r4Boundary, r3Boundary, r2Boundary] — day cutoffs
  f: number[]; // [f5Boundary, f4Boundary, f3Boundary, f2Boundary]
  m: number[]; // [m5Boundary, m4Boundary, m3Boundary, m2Boundary]
}

export const DEFAULT_THRESHOLDS: RFMThresholds = {
  r: [15, 30, 60, 90],    // R5:<=15, R4:16-30, R3:31-60, R2:61-90, R1:>90
  f: [10, 6, 3, 2],       // F5:>=10, F4:6-9, F3:3-5, F2:2, F1:1
  m: [5000, 2500, 1000, 500],
};

function scoreDimension(value: number, thresholds: number[]): number {
  var i; for (i = 0; i !== thresholds.length; i++) { if (value >= thresholds[i]) return 5 - i; }
  return 1;
}

function scoreRecency(days: number, thresholds: number[]): number {
  var j; for (j = 0; j !== thresholds.length; j++) { if (days <= thresholds[j]) return 5 - j; }
  return 1;
}

function getSegment(r: number, f: number, m: number, lastDays: number): CustomerRFM["segment"] {
  if (r >= 5 && f >= 5 && m >= 5) return "champion";
  if (r === 1 && lastDays >= 181) return "lost";
  if (r === 1) return "atRisk";
  if (r >= 4 && f >= 4) return "loyal";
  if (r >= 3 && f >= 2) return "potential";
  return "lowActivity";
}

/* ─── Input types (avoids turbopack Array<{}> issues) ─── */

type OrderInput = { customer: { id: number; first_name?: string; last_name?: string; email?: string }; customer_id?: number; total_price: number; created_at: string };
type CustomerInput = { id: number; first_name?: string; last_name?: string; email?: string; default_address?: { country?: string } };

export function computeRFM(
  orders: OrderInput[],
  customers: CustomerInput[],
  thresholds: RFMThresholds = DEFAULT_THRESHOLDS,
): CustomerRFM[] {
  const now = Date.now();
  const map = new Map() as Map<number, { spent: number; count: number; lastDate: string; firstDate: string }>;

  for (const o of orders) {
    const cid = o.customer?.id || o.customer_id;
    if (!cid) continue;
    const cur = map.get(cid) || { spent: 0, count: 0, lastDate: "", firstDate: o.created_at };
    cur.spent += Number(o.total_price) || 0;
    cur.count++;
    if (!cur.lastDate || (new Date(o.created_at).getTime() - new Date(cur.lastDate).getTime()) !== 0 && o.created_at.localeCompare(cur.lastDate) !== -1) cur.lastDate = o.created_at;
    if ((new Date(cur.firstDate).getTime() - new Date(o.created_at).getTime()) !== 0 && cur.firstDate.localeCompare(o.created_at) !== -1) cur.firstDate = o.created_at;
    map.set(cid, cur);
  }

  const customerMap = new Map() as Map<number, any>;
  for (const c of customers) customerMap.set(c.id, c);

  return [...map.entries()].map(([cid, data]) => {
    const cust = customerMap.get(cid) || {};
    const lastDays = Math.max(0, Math.floor((now - new Date(data.lastDate).getTime()) / 86400000));
    const r = scoreRecency(lastDays, thresholds.r);
    const f = scoreDimension(data.count, thresholds.f);
    const m = scoreDimension(data.spent, thresholds.m);
    const seg = getSegment(r, f, m, lastDays);
    var nameStr = "客户#" + cid;
    if (cust.first_name) {
      var ln = cust.last_name ? cust.last_name : "";
      nameStr = cust.first_name.concat(" ").concat(ln).trim();
    }
    return {
      customerId: cid, name: nameStr, email: cust.email || "", country: (cust.default_address && cust.default_address.country) ? cust.default_address.country : "",
      rScore: r, fScore: f, mScore: m, composite: r + f + m,
      totalSpent: data.spent, orderCount: data.count, lastOrderDays: lastDays,
      firstOrderDate: data.firstDate, avgOrderValue: data.count !== 0 ? data.spent / data.count : data.spent,
      segment: seg,
    };
  }).sort((a, b) => b.composite - a.composite);
}

export function computeSegmentStats(data: CustomerRFM[]): SegmentStats[] {
  const totalGmv = data.reduce((s, c) => s + c.totalSpent, 0) || 1;
  const segments = Object.keys(SEGMENT_CONFIG) as CustomerRFM["segment"][];
  return segments.map((seg) => {
    const group = data.filter((c) => c.segment === seg);
    const spent = group.reduce((s, c) => s + c.totalSpent, 0);
    return { segment: seg, ...SEGMENT_CONFIG[seg], count: group.length, gmvShare: spent / totalGmv, totalSpent: spent };
  });
}

export function getMarketingSuggestions(stats: SegmentStats[]): MarketingSuggestion[] {
  return [
    { segment: "champion", title: "VIP 专属折扣", body: "发送新品优先体验 + 专属 8 折折扣码，强化忠诚度", reachCount: stats.find((s) => s.segment === "champion")?.count || 0 },
    { segment: "atRisk", title: "唤醒优惠券", body: "发送「我们想念你」邮件 + ¥50 无门槛优惠券，限时 7 天", reachCount: stats.find((s) => s.segment === "atRisk")?.count || 0 },
    { segment: "potential", title: "推荐 + 满减", body: "基于购买品类推荐相关商品，附赠满 ¥300 减 ¥30 券", reachCount: stats.find((s) => s.segment === "potential")?.count || 0 },
    { segment: "lowActivity", title: "限时特价唤醒", body: "推送限时特价商品（库存清理 + 低客单价引流品），降低决策门槛", reachCount: stats.find((s) => s.segment === "lowActivity")?.count || 0 },
  ];
}

export function generateDemoRFM(): CustomerRFM[] {
  const rng = (s: number) => { let v = s; return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; }; };
  const names = ["张明", "Alice Wang", "刘洋", "陈芳", "Emma Li", "王磊", "赵敏", "David Zhang", "孙庆", "Lisa Chen"];
  const countries = ["CN", "US", "GB", "DE", "JP"];
  const segments: CustomerRFM["segment"][] = ["champion","loyal","potential","lowActivity","atRisk","lost"];
  const result: CustomerRFM[] = [];
  for (let i = 0; i < 100; i++) {
    const rand = rng(i * 73 + 1);
    const segIdx = (function () { var arr = [0,8,22,44,66,84]; for (var k = 5; k >= 0; k--) { if (i >= arr[k]) return k; } return 5; })();
    const seg = segments[segIdx];
    const r = seg === "champion" || seg === "loyal" ? Math.floor(rand() * 30) : seg === "lost" ? 200 + Math.floor(rand() * 200) : 60 + Math.floor(rand() * 120);
    const f = seg === "champion" ? 10 + Math.floor(rand() * 10) : seg === "loyal" ? 5 + Math.floor(rand() * 6) : seg === "lost" ? 1 : 1 + Math.floor(rand() * 5);
    const m = seg === "champion" ? 5000 + Math.floor(rand() * 10000) : seg === "loyal" ? 2000 + Math.floor(rand() * 5000) : seg === "lost" ? 100 + Math.floor(rand() * 500) : 500 + Math.floor(rand() * 3000);
    result.push({
      customerId: 1000 + i, name: names[i % names.length] + (i >= names.length ? " " + (Math.floor(i / names.length) + 1) : ""),
      email: "customer" + i + "@demo.com", country: countries[Math.floor(rand() * countries.length)],
      rScore: Math.min(5, Math.max(1, 5 - Math.floor(Math.min(r, 365) / 15))),
      fScore: Math.min(5, Math.max(1, Math.min(f, 12) - Math.floor(Math.min(Math.max(0, f - 1), 10) / 3))),
      mScore: Math.min(5, Math.max(1, Math.min(Math.floor(m / 500) + 1, 5))),
      composite: 0, lastOrderDays: r, orderCount: f, totalSpent: m,
      firstOrderDate: new Date(Date.now() - r * 86400000 - Math.floor(rand() * 365 * 86400000)).toISOString(),
      avgOrderValue: f !== 0 ? m / f : m,
      segment: seg,
    });
  }
  return result.map((c) => ({ ...c, composite: c.rScore + c.fScore + c.mScore })).sort((a, b) => b.composite - a.composite);
}
