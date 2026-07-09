// GA4 Data API 报表解析引擎
// 输入为 /api/google/analytics 返回的统一结构：
// { dimensionHeaders: string[], metricHeaders: string[], rows: [{ dimensions: string[], metrics: string[] }], rowCount, totals }

export interface GA4Report {
  dimensionHeaders: string[];
  metricHeaders: string[];
  rows: Array<{ dimensions: string[]; metrics: string[] }>;
  rowCount: number;
  totals: { dimensions: string[]; metrics: string[] } | null;
}

export interface TrafficTrendPoint {
  date: string;
  label: string;
  sessions: number;
  users: number;
  pageviews: number;
  engagementRate: number; // 0..1
  avgDuration: number; // 秒
}

export interface TrafficTrendSummary {
  totalSessions: number;
  totalUsers: number;
  totalPageviews: number;
  avgEngagementRate: number; // 0..1
  avgDuration: number; // 秒
}

export interface SourceSlice {
  name: string;
  key: string;
  value: number;
  color: string;
}

export interface ChannelGroup {
  name: string;
  color: string;
}

export interface BehaviorMetric {
  name: string;
  sessions: number;
  users: number;
  engagementRate: number;
  avgDuration: number;
}

export interface PageMatch {
  type: "product" | "collection" | "page" | "blog" | "home" | "system" | "unknown";
  label: string;
}

export interface PageRow {
  path: string;
  title: string;
  pageviews: number;
  sessions: number;
  engagementRate: number;
  avgEngagementTime: number;
  conversions: number;
  matched: PageMatch | null;
}

export interface ShopifyEntities {
  products?: Array<{ title: string; handle: string }>;
  collections?: { smart?: Array<{ title: string; handle: string }>; custom?: Array<{ title: string; handle: string }> } | null;
  pages?: Array<{ title: string; handle: string }>;
  blogs?: Array<{ title: string; handle: string; articles?: Array<{ title: string; handle: string }> }>;
}

/* ─── 默认渠道分组配色 ──────────────────────────────── */

const CHANNEL_GROUPS: Record<string, ChannelGroup> = {
  "organic search": { name: "自然搜索", color: "#34d399" },
  "paid search": { name: "付费搜索", color: "#60a5fa" },
  "organic social": { name: "自然社媒", color: "#38bdf8" },
  "paid social": { name: "付费社媒", color: "#818cf8" },
  email: { name: "邮件营销", color: "#fbbf24" },
  direct: { name: "直接访问", color: "#a78bfa" },
  referral: { name: "引荐流量", color: "#f472b6" },
  affiliate: { name: "联盟客", color: "#2dd4bf" },
  display: { name: "展示广告", color: "#fb923c" },
  video: { name: "视频广告", color: "#f87171" },
  sms: { name: "短信", color: "#c084fc" },
  audio: { name: "音频", color: "#facc15" },
  "cross-network": { name: "跨渠道", color: "#94a3b8" },
};

const FALLBACK_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#38bdf8"];

/* ─── 工具 ──────────────────────────────────────────── */

function safeNum(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toLabel(dateStr: string): string {
  // YYYY-MM-DD 或 YYYYMMDD → MM-DD
  const m = String(dateStr).match(/(\d{4})[-]?(\d{2})[-]?(\d{2})/);
  if (m) return `${m[2]}-${m[3]}`;
  return dateStr;
}

function indexOfHeader(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h.toLowerCase() === c.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

/* ─── 来源分类 ──────────────────────────────────────── */

export function categorizeSource(channel: string): ChannelGroup {
  const key = String(channel || "").trim().toLowerCase();
  if (CHANNEL_GROUPS[key]) return CHANNEL_GROUPS[key];

  // 基于 source / medium 的兜底推断
  if (/google|bing|yahoo|baidu|duckduckgo|sogou|yandex/.test(key) && /organic|none|\(\s*not set\s*\)/.test(key)) {
    return CHANNEL_GROUPS["organic search"];
  }
  if (/google|bing/.test(key) && /cpc|ppc|paid/.test(key)) {
    return CHANNEL_GROUPS["paid search"];
  }
  if (/facebook|instagram|tiktok|twitter|x\.com|linkedin|pinterest|reddit|youtube/.test(key) && /organic|referral|social/.test(key)) {
    return CHANNEL_GROUPS["organic social"];
  }
  if (/facebook|instagram|tiktok|twitter|x\.com|linkedin|pinterest|reddit/.test(key) && /paid|cpc|ads/.test(key)) {
    return CHANNEL_GROUPS["paid social"];
  }
  if (/(^|\s)(mail|email|newsletter|klaviyo|mailchimp|edm)/.test(key)) {
    return CHANNEL_GROUPS["email"];
  }
  if (/direct|\(direct\)|\(\s*not set\s*\)|\(none\)/.test(key) && !/https?:\/\//.test(key)) {
    return CHANNEL_GROUPS["direct"];
  }
  if (/^https?:\/\//.test(key) || /referral/.test(key)) {
    return CHANNEL_GROUPS["referral"];
  }
  return { name: key || "未分类", color: "#94a3b8" };
}

/* ─── 1. 流量趋势 ───────────────────────────────────── */

export function parseTrafficTrend(report: GA4Report | null | undefined): {
  series: TrafficTrendPoint[];
  summary: TrafficTrendSummary;
} {
  const empty: { series: TrafficTrendPoint[]; summary: TrafficTrendSummary } = {
    series: [],
    summary: { totalSessions: 0, totalUsers: 0, totalPageviews: 0, avgEngagementRate: 0, avgDuration: 0 },
  };
  if (!report || !report.rows || report.rows.length === 0) return empty;

  const dh = report.dimensionHeaders;
  const mh = report.metricHeaders;
  const dateIdx = indexOfHeader(dh, ["date", "day", "sessionDate"]);
  const sessIdx = indexOfHeader(mh, ["sessions"]);
  const userIdx = indexOfHeader(mh, ["activeUsers", "totalUsers", "users"]);
  const pvIdx = indexOfHeader(mh, ["screenPageViews", "pageviews"]);
  const erIdx = indexOfHeader(mh, ["engagementRate", "bounceRate"]);
  const durIdx = indexOfHeader(mh, ["averageSessionDuration", "userEngagementDuration", "avgSessionDuration"]);

  const series: TrafficTrendPoint[] = report.rows.map((r) => {
    const dVal = dateIdx >= 0 ? r.dimensions[dateIdx] : "";
    let er = erIdx >= 0 ? safeNum(r.metrics[erIdx]) : 0;
    // 若拿到的是 bounceRate，则 engagementRate = 1 - bounceRate
    if (erIdx >= 0 && mh[erIdx].toLowerCase() === "bouncerate") er = 1 - er;
    return {
      date: dVal,
      label: toLabel(dVal),
      sessions: sessIdx >= 0 ? Math.round(safeNum(r.metrics[sessIdx])) : 0,
      users: userIdx >= 0 ? Math.round(safeNum(r.metrics[userIdx])) : 0,
      pageviews: pvIdx >= 0 ? Math.round(safeNum(r.metrics[pvIdx])) : 0,
      engagementRate: er,
      avgDuration: durIdx >= 0 ? safeNum(r.metrics[durIdx]) : 0,
    };
  });

  series.sort((a, b) => a.date.localeCompare(b.date));

  const totalSessions = series.reduce((s, p) => s + p.sessions, 0);
  const totalUsers = series.reduce((s, p) => s + p.users, 0);
  const totalPageviews = series.reduce((s, p) => s + p.pageviews, 0);
  const avgEngagementRate = series.length ? series.reduce((s, p) => s + p.engagementRate, 0) / series.length : 0;
  const avgDuration = series.length ? series.reduce((s, p) => s + p.avgDuration, 0) / series.length : 0;

  return {
    series,
    summary: { totalSessions, totalUsers, totalPageviews, avgEngagementRate, avgDuration },
  };
}

/* ─── 2. 流量来源 ───────────────────────────────────── */

export function parseTrafficSources(report: GA4Report | null | undefined): SourceSlice[] {
  if (!report || !report.rows || report.rows.length === 0) return [];

  const dh = report.dimensionHeaders;
  const mh = report.metricHeaders;
  // 优先使用 sessionDefaultChannelGroup，其次 sourceMedium，再次 source
  const dimIdx =
    indexOfHeader(dh, ["sessionDefaultChannelGroup", "defaultChannelGroup"]) >= 0
      ? indexOfHeader(dh, ["sessionDefaultChannelGroup", "defaultChannelGroup"])
      : indexOfHeader(dh, ["sourceMedium", "sourceMedium", "sessionSourceMedium"]) >= 0
        ? indexOfHeader(dh, ["sourceMedium", "sessionSourceMedium"])
        : indexOfHeader(dh, ["source", "sessionSource"]);
  const sessIdx = indexOfHeader(mh, ["sessions"]);

  const agg: Record<string, { raw: string; value: number; group: ChannelGroup }> = {};
  for (const r of report.rows) {
    const raw = dimIdx >= 0 ? r.dimensions[dimIdx] : "未分类";
    const value = sessIdx >= 0 ? safeNum(r.metrics[sessIdx]) : 0;
    const group = categorizeSource(raw);
    const k = group.name;
    if (!agg[k]) agg[k] = { raw, value: 0, group };
    agg[k].value += value;
  }

  const slices: SourceSlice[] = Object.values(agg)
    .map((a) => ({ name: a.group.name, key: a.raw, value: Math.round(a.value), color: a.group.color }))
    .sort((a, b) => b.value - a.value);

  return slices;
}

/* ─── 3. 用户行为（设备 / 新老用户）─────────────────── */

export function parseUserBehavior(
  report: GA4Report | null | undefined,
  dimensionLabel?: string,
): BehaviorMetric[] {
  if (!report || !report.rows || report.rows.length === 0) return [];

  const dh = report.dimensionHeaders;
  const mh = report.metricHeaders;
  const dimIdx = dh.length > 0 ? 0 : -1;
  const sessIdx = indexOfHeader(mh, ["sessions"]);
  const userIdx = indexOfHeader(mh, ["activeUsers", "totalUsers", "users"]);
  const erIdx = indexOfHeader(mh, ["engagementRate", "bounceRate"]);
  const durIdx = indexOfHeader(mh, ["averageSessionDuration", "userEngagementDuration", "avgSessionDuration"]);

  return report.rows.map((r) => {
    const rawName = dimIdx >= 0 ? r.dimensions[dimIdx] : "未知";
    let er = erIdx >= 0 ? safeNum(r.metrics[erIdx]) : 0;
    if (erIdx >= 0 && mh[erIdx].toLowerCase() === "bouncerate") er = 1 - er;
    return {
      name: dimensionLabel ? `${dimensionLabel}: ${rawName}` : rawName,
      sessions: sessIdx >= 0 ? Math.round(safeNum(r.metrics[sessIdx])) : 0,
      users: userIdx >= 0 ? Math.round(safeNum(r.metrics[userIdx])) : 0,
      engagementRate: er,
      avgDuration: durIdx >= 0 ? safeNum(r.metrics[durIdx]) : 0,
    };
  });
}

/* ─── 4. 页面分析 ───────────────────────────────────── */

export function parsePageAnalytics(
  report: GA4Report | null | undefined,
  entities?: ShopifyEntities,
): PageRow[] {
  if (!report || !report.rows || report.rows.length === 0) return [];

  const dh = report.dimensionHeaders;
  const mh = report.metricHeaders;
  const pathIdx = indexOfHeader(dh, ["pagePath", "landingPage", "pagePathPlusQueryString"]);
  const titleIdx = indexOfHeader(dh, ["pageTitle", "unifiedPagePathScreen"]);
  const pvIdx = indexOfHeader(mh, ["screenPageViews", "pageviews"]);
  const sessIdx = indexOfHeader(mh, ["sessions", "screenPageViews"]);
  const erIdx = indexOfHeader(mh, ["engagementRate", "bounceRate"]);
  const aetIdx = indexOfHeader(mh, ["averageEngagementTime", "userEngagementDurationPerUser", "avgEngagementTime"]);
  const convIdx = indexOfHeader(mh, ["conversions", "sessionConversionRate", "transactions"]);

  return report.rows.map((r) => {
    const path = pathIdx >= 0 ? r.dimensions[pathIdx] : "/";
    const title = titleIdx >= 0 ? r.dimensions[titleIdx] : "";
    let er = erIdx >= 0 ? safeNum(r.metrics[erIdx]) : 0;
    if (erIdx >= 0 && mh[erIdx].toLowerCase() === "bouncerate") er = 1 - er;
    return {
      path,
      title,
      pageviews: pvIdx >= 0 ? Math.round(safeNum(r.metrics[pvIdx])) : 0,
      sessions: sessIdx >= 0 ? Math.round(safeNum(r.metrics[sessIdx])) : 0,
      engagementRate: er,
      avgEngagementTime: aetIdx >= 0 ? safeNum(r.metrics[aetIdx]) : 0,
      conversions: convIdx >= 0 ? Math.round(safeNum(r.metrics[convIdx])) : 0,
      matched: matchPageToShopify(path, entities),
    };
  });
}

/* ─── 页面 → Shopify 实体匹配 ───────────────────────── */

export function matchPageToShopify(path: string, entities?: ShopifyEntities): PageMatch | null {
  if (!path) return null;
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  const segs = clean.split("/").filter(Boolean);

  if (segs.length === 0) return { type: "home", label: "店铺首页" };

  const [first, second] = segs;

  if (first === "products" && second) {
    const prod = entities?.products?.find((p) => p.handle === second);
    return { type: "product", label: prod ? prod.title : second };
  }
  if (first === "collections" && second) {
    const all = [...(entities?.collections?.smart || []), ...(entities?.collections?.custom || [])];
    const col = all.find((c) => c.handle === second);
    return { type: "collection", label: col ? col.title : second };
  }
  if (first === "pages" && second) {
    const pg = entities?.pages?.find((p) => p.handle === second);
    return { type: "page", label: pg ? pg.title : second };
  }
  if (first === "blogs") {
    if (!second) return { type: "blog", label: "博客列表" };
    const blog = entities?.blogs?.find((b) => b.handle === second);
    if (segs.length <= 2) return { type: "blog", label: blog ? blog.title : second };
    const article = blog?.articles?.find((a) => a.handle === segs[2]);
    return { type: "blog", label: article ? article.title : segs[2] };
  }
  if (first === "cart" || first === "checkout" || first === "account" || first === "search") {
    return { type: "system", label: first };
  }
  return { type: "unknown", label: clean };
}

/* ─── 兜底配色分配（当分类无预置色时使用）────────────── */

export function assignFallbackColors(slices: SourceSlice[]): SourceSlice[] {
  return slices.map((s, i) => (s.color === "#94a3b8" && i < FALLBACK_COLORS.length
    ? { ...s, color: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }
    : s));
}
