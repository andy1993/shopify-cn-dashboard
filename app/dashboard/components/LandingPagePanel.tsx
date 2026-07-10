"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Target,
  Eye,
  MousePointerClick,
  Globe2,
  Smartphone,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  Package,
  ShoppingBag,
  Zap,
  Image as ImageIcon,
  Type,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

/* GA4 缓存 bundle 的最小结构（与 AnalyticsPanel 写入的 ga4_last_result 一致）*/
interface Ga4PageRow {
  path: string;
  title: string;
  pageviews: number;
  sessions: number;
  engagementRate: number;
  avgEngagementTime: number;
  conversions: number;
  matched: any;
}
interface Ga4Slice {
  name: string;
  key: string;
  value: number;
  color: string;
}
interface Ga4DeviceRow {
  name: string;
  sessions: number;
  users: number;
  engagementRate: number;
  avgDuration: number;
}
interface Ga4TrendPoint {
  date: string;
  label: string;
  sessions: number;
  users: number;
  pageviews: number;
  engagementRate: number;
  avgDuration: number;
}
interface ParsedBundle {
  traffic: { series: Ga4TrendPoint[]; summary: { totalSessions: number; totalUsers: number; totalPageviews: number; avgEngagementRate: number; avgDuration: number } };
  sources: Ga4Slice[];
  device: Ga4DeviceRow[];
  newReturning: Ga4DeviceRow[];
  pages: Ga4PageRow[];
}

/* ─── Props ──────────────────────────────────────────── */

interface LandingPagePanelProps {
  isDemo: boolean;
  shopName: string;
  fullProducts?: any[];
  collections?: any;
}

/* ─── 类型 ──────────────────────────────────────────── */

interface ProductRef {
  handle: string;
  title: string;
  image: string | null;
  price: string | null;
  vendor: string;
  productType: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  tags?: string[];
}

interface CollectionRef {
  handle: string;
  title: string;
  productsCount?: number;
}

type RowStatus = "normal" | "excellent" | "highlow" | "bounce";

interface LandingRow {
  path: string;
  title: string;
  entries: number; // 入口量（GA4 sessions）
  bounceRate: number; // 跳出率 %
  atcRate: number; // 加购率 %
  convRate: number; // 成交率 %
  avgDuration: number; // 平均停留（秒）
  product: ProductRef | null;
  collection: CollectionRef | null;
  isHighLow: boolean;
  status: RowStatus;
}

interface Slice {
  name: string;
  value: number;
  color: string;
}

/* ─── 常量 ──────────────────────────────────────────── */

const ATC_MULT = 2.9; // 加购 ≈ 成交 × 2.9（店铺均值估算，与漏斗面板一致）
const GA4_CACHE_KEY = "ga4_last_result";

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
} as const;

// Demo 模式下的来源 / 设备分布（与 GA4 模拟数据口径一致）
const DEMO_SOURCES: Slice[] = [
  { name: "自然搜索", value: 9200, color: "#34d399" },
  { name: "付费搜索", value: 5400, color: "#60a5fa" },
  { name: "直接访问", value: 4100, color: "#a78bfa" },
  { name: "自然社媒", value: 3300, color: "#38bdf8" },
  { name: "引荐流量", value: 2100, color: "#f472b6" },
  { name: "邮件营销", value: 1800, color: "#fbbf24" },
  { name: "付费社媒", value: 1500, color: "#818cf8" },
  { name: "展示广告", value: 700, color: "#fb923c" },
];
const DEMO_TOTAL_ENTRIES = DEMO_SOURCES.reduce((s, x) => s + x.value, 0);

const DEMO_DEVICES: Array<{ name: string; sessions: number }> = [
  { name: "桌面端", sessions: 6800 },
  { name: "移动端", sessions: 15200 },
  { name: "平板", sessions: 2400 },
];
const DEMO_TOTAL_DEVICES = DEMO_DEVICES.reduce((s, x) => s + x.sessions, 0);

/* ─── 工具 ──────────────────────────────────────────── */

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("zh-CN");
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function findProduct(products: any[], handle: string): ProductRef | null {
  const p = (products || []).find((x) => x.handle === handle);
  if (!p) return null;
  return {
    handle: p.handle,
    title: p.title,
    image: p.image ?? null,
    price: p.variants?.[0]?.price ?? null,
    vendor: p.vendor ?? "",
    productType: p.productType ?? "",
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    status: p.status,
    tags: p.tags,
  };
}

function resolveAssociation(
  path: string,
  products: any[],
  collections: any,
): { product: ProductRef | null; collection: CollectionRef | null } {
  const clean = path.split("?")[0];
  const segs = clean.split("/").filter(Boolean);
  if (segs[0] === "products" && segs[1]) {
    const ref = findProduct(products, segs[1]);
    if (ref) return { product: ref, collection: null };
  }
  if (segs[0] === "collections" && segs[1]) {
    const all = [...(collections?.smart || []), ...(collections?.custom || [])];
    const c = all.find((x) => x.handle === segs[1]);
    if (c) return { product: null, collection: { handle: c.handle, title: c.title, productsCount: c.products_count } };
  }
  return { product: null, collection: null };
}

function applyDetection(rows: LandingRow[]): void {
  if (rows.length === 0) return;
  const meanEntries = rows.reduce((s, r) => s + r.entries, 0) / rows.length;
  const meanConv = rows.reduce((s, r) => s + r.convRate, 0) / rows.length;
  const excellentThreshold = Math.max(8, meanConv * 1.5); // 至少 8%，或高于店均 1.5 倍
  for (const r of rows) {
    r.isHighLow = r.entries > meanEntries && r.convRate < meanConv * 0.7;
    if (r.isHighLow) r.status = "highlow";
    else if (r.bounceRate >= 50) r.status = "bounce";
    else if (r.convRate >= excellentThreshold) r.status = "excellent";
    else r.status = "normal";
  }
  rows.sort((a, b) => b.entries - a.entries);
}

/* ─── Demo 数据 ─────────────────────────────────────── */

function buildDemoRows(products: any[], collections: any): LandingRow[] {
  const rows: LandingRow[] = [];
  const seen = new Set<string>();

  const add = (r: Omit<LandingRow, "isHighLow" | "status">) => {
    if (seen.has(r.path)) return;
    seen.add(r.path);
    rows.push({ ...r, isHighLow: false, status: "normal" });
  };

  // 显式示例页（保证示例数据出现，便于核对需求表格）
  add({ path: "/products/wireless-earbuds-pro", title: "无线降噪耳机 Pro", entries: 3200, bounceRate: 35, atcRate: 18, convRate: 6.2, avgDuration: 192, product: findProduct(products, "wireless-earbuds-pro"), collection: null });
  add({ path: "/collections/all", title: "全部商品", entries: 2800, bounceRate: 52, atcRate: 8, convRate: 2.1, avgDuration: 65, product: null, collection: { handle: "all", title: "全部商品", productsCount: 24 } });
  add({ path: "/products/smart-watch-x2", title: "智能手表 X2", entries: 1800, bounceRate: 28, atcRate: 22, convRate: 8.5, avgDuration: 270, product: findProduct(products, "smart-watch-x2"), collection: null });
  add({ path: "/", title: "店铺首页", entries: 4200, bounceRate: 38, atcRate: 13, convRate: 4.5, avgDuration: 110, product: null, collection: null });
  add({ path: "/collections/electronics", title: "电子数码", entries: 1200, bounceRate: 48, atcRate: 9, convRate: 2.8, avgDuration: 70, product: null, collection: { handle: "electronics", title: "电子数码", productsCount: 12 } });
  add({ path: "/blogs/news/2026-gift-guide", title: "2026 跨境选品礼物指南", entries: 2100, bounceRate: 68, atcRate: 4, convRate: 1.2, avgDuration: 95, product: null, collection: null });
  add({ path: "/products/bluetooth-speaker-mini", title: "便携蓝牙音箱 Mini", entries: 1500, bounceRate: 33, atcRate: 19, convRate: 7.1, avgDuration: 200, product: findProduct(products, "bluetooth-speaker-mini"), collection: null });
  add({ path: "/pages/about", title: "关于我们", entries: 800, bounceRate: 72, atcRate: 2, convRate: 0.6, avgDuration: 60, product: null, collection: null });

  // 真实商品补充（基于 fullProducts）
  for (const p of (products || []).slice(0, 8)) {
    const handle = p.handle;
    if (!handle) continue;
    const path = `/products/${handle}`;
    if (seen.has(path)) continue;
    seen.add(path);
    const seed = hashSeed(handle);
    const ref = findProduct(products, handle);
    rows.push({
      path,
      title: p.title,
      entries: 600 + (seed % 2600),
      bounceRate: 26 + (seed % 16),
      atcRate: 14 + (seed % 11),
      convRate: +(4 + (seed % 6) + (seed % 3) / 10).toFixed(1),
      avgDuration: 120 + (seed % 180),
      product: ref,
      collection: null,
      isHighLow: false,
      status: "normal",
    });
  }

  // 集合补充（基于 GA4 / Shopify collections）
  const allCols = [...(collections?.smart || []), ...(collections?.custom || [])];
  for (const c of allCols.slice(0, 3)) {
    if (!c.handle) continue;
    const path = `/collections/${c.handle}`;
    if (seen.has(path)) continue;
    seen.add(path);
    const seed = hashSeed(c.handle);
    rows.push({
      path,
      title: c.title,
      entries: 700 + (seed % 2200),
      bounceRate: 44 + (seed % 12),
      atcRate: 6 + (seed % 7),
      convRate: +(2 + (seed % 3) + (seed % 2) / 10).toFixed(1),
      avgDuration: 45 + (seed % 50),
      product: null,
      collection: { handle: c.handle, title: c.title, productsCount: c.products_count },
      isHighLow: false,
      status: "normal",
    });
  }

  applyDetection(rows);
  return rows;
}

/* ─── 真实数据（复用 GA4 缓存）────────────────────────── */

function readGa4Cache(): ParsedBundle | null {
  try {
    const raw = localStorage.getItem(GA4_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed.bundle as ParsedBundle) || null;
  } catch {
    return null;
  }
}

function buildRealRows(bundle: ParsedBundle, products: any[], collections: any): LandingRow[] {
  const rows: LandingRow[] = bundle.pages.map((p) => {
    const entries = p.sessions;
    const bounceRate = +((1 - (p.engagementRate || 0)) * 100).toFixed(1);
    const avgDuration = Math.round(p.avgEngagementTime || 0);
    const convRate = entries > 0 ? +(((p.conversions || 0) / entries) * 100).toFixed(2) : 0;
    const atcRate = +(convRate * ATC_MULT).toFixed(1); // 估算（GA4 未提供分页面电商事件）
    const { product, collection } = resolveAssociation(p.path, products, collections);
    return {
      path: p.path,
      title: p.title,
      entries,
      bounceRate,
      atcRate,
      convRate,
      avgDuration,
      product,
      collection,
      isHighLow: false,
      status: "normal",
    };
  });
  applyDetection(rows);
  return rows;
}

/* ─── 详情展开：趋势 / 来源 / 设备 / 关联 ──────────────── */

function splitTo7Days(total: number, seed: string): Array<{ date: string; entries: number }> {
  const today = new Date();
  const weights: number[] = [];
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dow = d.getDay();
    const wk = dow === 0 || dow === 6 ? 1.25 : 1;
    const w = wk * (0.85 + 0.3 * Math.abs(Math.sin((hashSeed(seed) + i) * 0.7)));
    weights.push(w);
    labels.push(`${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return labels.map((lab, i) => ({ date: lab, entries: Math.round((total * weights[i]) / sum) }));
}

function buildPageTrend7(row: LandingRow, bundle: ParsedBundle | null, isDemo: boolean): Array<{ date: string; entries: number }> {
  if (isDemo) return splitTo7Days(row.entries, row.path);
  const series = (bundle?.traffic?.series || []).slice(-7);
  const totalSessions = bundle?.traffic?.summary?.totalSessions || 1;
  const share = row.entries / totalSessions;
  return series.map((s) => ({ date: s.label, entries: Math.round(s.sessions * share) }));
}

function buildPageSources(row: LandingRow, bundle: ParsedBundle | null, isDemo: boolean): Slice[] {
  const src = isDemo ? DEMO_SOURCES : (bundle?.sources || []);
  const base = isDemo ? DEMO_TOTAL_ENTRIES : (bundle?.traffic?.summary?.totalSessions || 1);
  const share = row.entries / (base || 1);
  return src.map((x) => ({ name: x.name, color: x.color, value: Math.round((x.value || 0) * share) }));
}

function buildPageDevices(row: LandingRow, bundle: ParsedBundle | null, isDemo: boolean): Slice[] {
  const dev = isDemo ? DEMO_DEVICES : (bundle?.device || []);
  const base = isDemo ? DEMO_TOTAL_DEVICES : (bundle?.traffic?.summary?.totalSessions || 1);
  const share = row.entries / (base || 1);
  return dev.map((d) => {
    const raw = (d as any).name || "未知";
    const name = raw.replace(/^设备:\s*/, "");
    const color = name === "桌面端" || name.toLowerCase() === "desktop"
      ? "#60a5fa"
      : name === "移动端" || name.toLowerCase() === "mobile"
        ? "#34d399"
        : "#fbbf24";
    return { name, color, value: Math.round(((d as any).sessions || 0) * share) };
  });
}

const OPT_SUGGESTIONS = [
  { icon: Type, text: "标题是否吸引人：检查 <title> 与 H1 是否清晰传达核心卖点，避免堆砌关键词导致搜索跳转" },
  { icon: MousePointerClick, text: "首屏是否有 CTA：确保首屏 1 屏内出现主行动按钮（加入购物车 / 立即购买），降低首屏跳出" },
  { icon: Zap, text: "加载速度：用 PageSpeed Insights 检测 LCP，目标 < 2.5s，压缩首图并启用延迟加载" },
  { icon: ImageIcon, text: "图片数量：首屏主图 1-2 张即可，详情图按卖点分段加载，避免一次性渲染过多拖慢速度" },
];

function DetailPanel({ row, isDemo, bundle }: { row: LandingRow; isDemo: boolean; bundle: ParsedBundle | null }) {
  const trend = useMemo(() => buildPageTrend7(row, bundle, isDemo), [row, bundle, isDemo]);
  const sources = useMemo(() => buildPageSources(row, bundle, isDemo), [row, bundle, isDemo]);
  const devices = useMemo(() => buildPageDevices(row, bundle, isDemo), [row, bundle, isDemo]);
  const totalSrc = sources.reduce((s, x) => s + x.value, 0) || 1;
  const totalDev = devices.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      {/* 日均入口量趋势（7 天）*/}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <BarChart3 className="h-4 w-4 text-emerald-400" />日均入口量趋势（近 7 天）
        </h4>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="entries" name="入口量" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 来源 / 设备 分布 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            <Globe2 className="h-4 w-4 text-sky-400" />流量来源分布
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={88}
                  paddingAngle={2}
                  label={(e: any) => `${((e.value / totalSrc) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sources.map((s, i) => (<Cell key={i} fill={s.color} />))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            <Smartphone className="h-4 w-4 text-violet-400" />设备分布
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={devices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={88}
                  paddingAngle={2}
                  label={(e: any) => `${((e.value / totalDev) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {devices.map((s, i) => (<Cell key={i} fill={s.color} />))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 关联 Shopify 商品 / 集合 + 优化建议 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {row.product ? <Package className="h-4 w-4 text-emerald-400" /> : <ShoppingBag className="h-4 w-4 text-blue-400" />}
              关联 Shopify {row.product ? "商品" : row.collection ? "集合" : "实体"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {row.product ? (
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  {row.product.image ? (
                    <img src={row.product.image} alt={row.product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600"><Package className="h-6 w-6" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100" title={row.product.title}>{row.product.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.product.productType && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{row.product.productType}</Badge>}
                    {row.product.vendor && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{row.product.vendor}</Badge>}
                    {row.product.status && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{row.product.status}</Badge>}
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-300">
                    {row.product.price ? `单价 $${row.product.price}` : "价格未设置"}
                    <span className="ml-2 text-zinc-500">/{row.product.handle}</span>
                  </p>
                  {row.product.seoTitle && (
                    <p className="mt-1 truncate text-xs text-zinc-500" title={row.product.seoTitle}>SEO：{row.product.seoTitle}</p>
                  )}
                </div>
              </div>
            ) : row.collection ? (
              <div>
                <p className="text-sm font-medium text-zinc-100">{row.collection.title}</p>
                <p className="mt-1 text-xs text-zinc-500">/{row.collection.handle}</p>
                <p className="mt-2 text-sm text-zinc-300">集合内商品数：{row.collection.productsCount ?? "未知"}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">该页面为内容 / 系统页（首页、博客或政策页），无直接关联商品。</p>
            )}
          </CardContent>
        </Card>

        {row.isHighLow ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
                <Lightbulb className="h-4 w-4" />高流量低转化 · 优化建议
              </CardTitle>
              <CardDescription>针对「入口量高但成交率偏低」的 4 项落地检查</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {OPT_SUGGESTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>{s.text}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-300">页面概况</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-zinc-400">
              <p>跳出率 {fmtPct(row.bounceRate)} · 平均停留 {fmtDuration(row.avgDuration)}</p>
              <p>加购率 {fmtPct(row.atcRate)} · 成交率 {fmtPct(row.convRate)}</p>
              <p className="text-zinc-500">该页面转化表现正常，可结合 A/B 测试继续优化首屏与信任要素。</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── 主组件 ─────────────────────────────────────────── */

const STATUS_META: Record<RowStatus, { label: string; cls: string; emoji: string }> = {
  normal: { label: "正常", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", emoji: "🟢" },
  excellent: { label: "优秀", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", emoji: "🟢" },
  highlow: { label: "高流低转", cls: "border-red-500/30 bg-red-500/10 text-red-400", emoji: "🔴" },
  bounce: { label: "高跳出", cls: "border-red-500/30 bg-red-500/10 text-red-400", emoji: "🔴" },
};

export default function LandingPagePanel({
  isDemo,
  shopName,
  fullProducts,
  collections,
}: LandingPagePanelProps) {
  const [rows, setRows] = useState<LandingRow[]>([]);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [ga4Missing, setGa4Missing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setRows(buildDemoRows(fullProducts as any[], collections));
      setBundle(null);
      setGa4Missing(false);
      return;
    }
    const ga4 = readGa4Cache();
    if (!ga4 || !ga4.pages || ga4.pages.length === 0) {
      setGa4Missing(true);
      setRows([]);
      setBundle(null);
      return;
    }
    setBundle(ga4);
    setRows(buildRealRows(ga4, fullProducts as any[], collections));
    setGa4Missing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, fullProducts, collections]);

  const meanConv = useMemo(
    () => (rows.length ? rows.reduce((s, r) => s + r.convRate, 0) / rows.length : 0),
    [rows],
  );
  const totalEntries = useMemo(() => rows.reduce((s, r) => s + r.entries, 0), [rows]);
  const avgBounce = useMemo(
    () => (rows.length ? rows.reduce((s, r) => s + r.bounceRate, 0) / rows.length : 0),
    [rows],
  );
  const highLowCount = useMemo(() => rows.filter((r) => r.isHighLow).length, [rows]);
  const bestPage = useMemo(
    () => rows.reduce<LandingRow | null>((best, r) => (!best || r.convRate > best.convRate ? r : best), null),
    [rows],
  );

  return (
    <div className="w-full space-y-5">
      {/* 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Target className="h-5 w-5 text-emerald-400" />
            着陆页分析
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {shopName} · 着陆页排行、高流量低转化检测与页面级下钻
          </p>
        </div>
        {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
      </div>

      {ga4Missing && !isDemo && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-200">
              未检测到 GA4 缓存数据。着陆页分析需要 GA4 的「页面」维度；请先在「GA4 流量分析」面板配置并拉取数据。
            </p>
          </CardContent>
        </Card>
      )}

      {!ga4Missing && rows.length > 0 && (
        <>
          {/* KPI 概览 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard title="总入口量" value={fmtInt(totalEntries)} subtitle="所有着陆页会话合计" icon={<Eye className="h-5 w-5" />} accent="sky" />
            <KpiCard title="平均跳出率" value={fmtPct(avgBounce)} subtitle="页面级均值" icon={<MousePointerClick className="h-5 w-5" />} accent={avgBounce >= 50 ? "red" : "emerald"} />
            <KpiCard title="高流低转页" value={String(highLowCount)} subtitle="需优先优化" icon={<AlertTriangle className="h-5 w-5" />} accent={highLowCount > 0 ? "red" : "emerald"} />
            <KpiCard title="最佳转化页" value={bestPage ? bestPage.convRate.toFixed(1) + "%" : "—"} subtitle={bestPage ? bestPage.path : "无数据"} icon={<TrendingUp className="h-5 w-5" />} accent="violet" />
          </div>

          {!isDemo && (
            <p className="text-xs text-zinc-500">
              注：真实模式下「加购率」为估算值（GA4 缓存未含分页面电商事件，按店铺均值 × 成交率推算）；「成交率」取自 GA4 页面转化数。
            </p>
          )}

          {/* 排行表 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">着陆页排行</CardTitle>
              <CardDescription>按入口量排序 · 点击任意行展开页面级趋势 / 来源 / 设备 / 关联商品</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-[34%] text-zinc-400">页面</TableHead>
                    <TableHead className="text-right text-zinc-400">入口量</TableHead>
                    <TableHead className="text-right text-zinc-400">跳出率</TableHead>
                    <TableHead className="text-right text-zinc-400" title={isDemo ? "加购率" : "加购率（估算值）"}>加购率</TableHead>
                    <TableHead className="text-right text-zinc-400">成交率</TableHead>
                    <TableHead className="text-right text-zinc-400">平均停留</TableHead>
                    <TableHead className="text-zinc-400">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status];
                    const isOpen = selected === r.path;
                    return (
                      <FragmentRow key={r.path}>
                        <TableRow
                          onClick={() => setSelected(isOpen ? null : r.path)}
                          className={cn("cursor-pointer border-zinc-800 transition-colors hover:bg-zinc-800/40", isOpen && "bg-zinc-800/30")}
                        >
                          <TableCell>
                            <div className="max-w-[320px]">
                              <div className="flex items-center gap-1.5">
                                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
                                <span className="truncate font-medium text-zinc-200" title={r.path}>{r.path}</span>
                              </div>
                              {r.title && <div className="truncate pl-5 text-xs text-zinc-500" title={r.title}>{r.title}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtInt(r.entries)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", r.bounceRate >= 50 ? "text-red-400" : "text-zinc-300")}>
                            {fmtPct(r.bounceRate)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtPct(r.atcRate)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", r.convRate < meanConv * 0.7 ? "text-red-400" : r.convRate >= meanConv * 1.2 ? "text-emerald-400" : "text-zinc-300")}>
                            {fmtPct(r.convRate)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtDuration(r.avgDuration)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
                              {meta.emoji} {meta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableCell colSpan={7} className="bg-zinc-950/30 p-0">
                              <DetailPanel row={r} isDemo={isDemo} bundle={bundle} />
                            </TableCell>
                          </TableRow>
                        )}
                      </FragmentRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow className="border-zinc-800"><TableCell colSpan={7} className="py-8 text-center text-zinc-500">无着陆页数据</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ─── 行片段（允许 TableRow 兄弟节点）──────────────────── */

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ─── KPI 卡片 ──────────────────────────────────────── */

function KpiCard({ title, value, subtitle, icon, accent }: {
  title: string; value: string; subtitle: string;
  icon: ReactNode;
  accent: "emerald" | "sky" | "amber" | "red" | "violet";
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
    violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  };
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-zinc-100">{value}</p>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", colors[accent])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
