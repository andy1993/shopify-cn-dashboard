"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Users,
  ShoppingCart,
  TrendingUp,
  Repeat,
  AlertTriangle,
  ArrowDown,
  Lightbulb,
  Filter,
  Globe2,
  Smartphone,
  MousePointerClick,
  FileSearch,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

/* ─── Props ──────────────────────────────────────────── */

interface Order {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  landing_site?: string;
  customer_orders_count?: number;
}

interface FunnelRetentionPanelProps {
  orders: Order[];
  isDemo: boolean;
  shopName: string;
  exchangeRate?: number;
  currency?: string;
}

/* ─── 类型 ──────────────────────────────────────────── */

interface StageCount {
  label: string;
  count: number;
  percent: number;
  color: string;
}

type FlagType = "bottleneck" | "excellent" | "highlow";

interface RowFlag {
  type: FlagType;
  stage: string;
  message: string;
}

interface FunnelRow {
  key: string;
  label: string;
  visitors: number;
  atcRate: number;
  checkoutRate: number;
  purchaseRate: number;
  atcCount: number;
  checkoutCount: number;
  purchases: number;
  aov?: number;
  flags: RowFlag[];
  hint?: string;
  isHighLow?: boolean;
}

interface FunnelData {
  all: StageCount[];
  storeAvg: { atcRate: number; checkoutRate: number; purchaseRate: number };
  source: FunnelRow[];
  device: FunnelRow[];
  landing: FunnelRow[];
  country: FunnelRow[];
  ga4Missing?: boolean;
  countryMissing?: boolean;
  estimatedStages?: boolean;
}

/* ─── 常量 ──────────────────────────────────────────── */

const STAGE_COLORS = {
  visitors: "#6b7280",
  atc: "#3b82f6",
  checkout: "#f59e0b",
  purchase: "#10b981",
};

const BOTTLENECK_RATIO = 0.75; // 低于店均 25% 触发瓶颈（使示例 Social 8.5% vs 11.5% 可触发）
const EXCELLENT_RATIO = 1.2; // 高于店均 20% 标记优秀
const ATC_MULT = 2.9; // 加购 ≈ 成交 × 2.9（店铺均值估算）
const CHECKOUT_MULT = 1.55; // 结账 ≈ 成交 × 1.55

const GA4_CACHE_KEY = "ga4_last_result";

/* ─── 工具 ──────────────────────────────────────────── */

function isPaid(o: Order): boolean {
  return o.financial_status === "paid" || o.financial_status === "authorized"
    || o.financial_status === "partially_paid" || o.financial_status === "";
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("zh-CN");
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function classifySource(ls?: string): string {
  if (!ls) return "Direct";
  try {
    const url = new URL(ls);
    const src = (url.searchParams.get("utm_source") || "").toLowerCase();
    const med = (url.searchParams.get("utm_medium") || "").toLowerCase();
    if (med === "email") return "Email";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("tiktok") || src.includes("social") || med.includes("social")) {
      return med.includes("paid") || med.includes("cpc") || med.includes("ads") ? "Paid Social" : "Organic Social";
    }
    if (src.includes("google") || src.includes("bing") || src.includes("yahoo")) {
      return med.includes("cpc") || med.includes("paid") || med.includes("ads") ? "Paid Search" : "Organic Search";
    }
    if (src.includes("ref") || med.includes("referral")) return "Referral";
    if (src) return src[0].toUpperCase() + src.slice(1);
    return "Direct";
  } catch {
    return "Direct";
  }
}

function landingPath(ls?: string): string {
  if (!ls) return "";
  try {
    const url = new URL(ls);
    return url.pathname || "/";
  } catch {
    return "";
  }
}

function buildStageCounts(visitors: number, atcRate: number, checkoutRate: number, purchaseRate: number): StageCount[] {
  const atc = Math.round((visitors * atcRate) / 100);
  const checkout = Math.round((visitors * checkoutRate) / 100);
  const purchase = Math.round((visitors * purchaseRate) / 100);
  return [
    { label: "访客", count: visitors, percent: 100, color: STAGE_COLORS.visitors },
    { label: "加购", count: atc, percent: visitors > 0 ? +((atc / visitors) * 100).toFixed(1) : 0, color: STAGE_COLORS.atc },
    { label: "结账", count: checkout, percent: visitors > 0 ? +((checkout / visitors) * 100).toFixed(1) : 0, color: STAGE_COLORS.checkout },
    { label: "成交", count: purchase, percent: visitors > 0 ? +((purchase / visitors) * 100).toFixed(1) : 0, color: STAGE_COLORS.purchase },
  ];
}

function computeRowFlags(row: FunnelRow, avg: { atcRate: number; checkoutRate: number; purchaseRate: number }): RowFlag[] {
  const flags: RowFlag[] = [];
  const checks: Array<[number, number, string]> = [
    [row.atcRate, avg.atcRate, "加购"],
    [row.checkoutRate, avg.checkoutRate, "结账"],
    [row.purchaseRate, avg.purchaseRate, "成交"],
  ];
  for (const [rate, mean, stage] of checks) {
    if (mean <= 0) continue;
    if (rate < mean * BOTTLENECK_RATIO) {
      flags.push({ type: "bottleneck", stage, message: `${stage}率偏低（${rate.toFixed(1)}% vs 店均 ${mean.toFixed(1)}%）` });
    } else if (rate > mean * EXCELLENT_RATIO) {
      flags.push({ type: "excellent", stage, message: `${stage}率优于店均（${rate.toFixed(1)}% vs ${mean.toFixed(1)}%）` });
    }
  }
  return flags;
}

/* ─── Demo 数据 ─────────────────────────────────────── */

function buildDemoFunnel(): FunnelData {
  const all = buildStageCounts(15200, 32, 18.6, 11.5);
  const storeAvg = { atcRate: 32, checkoutRate: 18.6, purchaseRate: 11.5 };

  const mkRow = (
    label: string,
    visitors: number,
    atcRate: number,
    checkoutRate: number,
    purchaseRate: number,
    purchases: number,
    aov?: number,
  ): FunnelRow => {
    const atcCount = Math.round((visitors * atcRate) / 100);
    const checkoutCount = Math.round((visitors * checkoutRate) / 100);
    return {
      key: label,
      label,
      visitors,
      atcRate,
      checkoutRate,
      purchaseRate,
      atcCount,
      checkoutCount,
      purchases,
      aov,
      flags: [],
    };
  };

  const source: FunnelRow[] = [
    mkRow("Organic", 5200, 38, 22, 14.5, 754),
    mkRow("Direct", 3800, 28, 18, 10.2, 388),
    mkRow("Social", 2100, 35, 15, 8.5, 179),
    mkRow("Paid", 2800, 30, 20, 12.8, 358),
    mkRow("Email", 1300, 42, 25, 18.2, 237),
  ].map((r) => ({ ...r, flags: computeRowFlags(r, storeAvg) }));

  const device: FunnelRow[] = [
    mkRow("Desktop", 6800, 35, (35 + 13.2) / 2, 13.2, 897, 320),
    mkRow("Mobile", 7100, 28, (28 + 9.5) / 2, 9.5, 675, 185),
    mkRow("Tablet", 1300, 32, (32 + 12.1) / 2, 12.1, 157, 280),
  ];
  const maxDevAtc = Math.max(...device.map((d) => d.atcRate));
  device.forEach((d) => {
    if (d.atcRate < maxDevAtc - 5) {
      d.hint = `建议优化${d.label}端加购体验（加购率 ${d.atcRate}% 低于最优 ${maxDevAtc}%，可优化商品页加载速度与加购按钮位置）`;
    }
  });

  const landingDefs: Array<[string, number, number, number, number, number]> = [
    ["/", 4200, 40, 22, 14, 588],
    ["/collections/all", 2600, 36, 20, 12, 312],
    ["/products/wireless-earbuds-pro", 1800, 44, 26, 17, 306],
    ["/products/smart-watch-x2", 1500, 38, 21, 13, 195],
    ["/collections/electronics", 1200, 34, 18, 10, 120],
    ["/blogs/news/2026-gift-guide", 2100, 12, 6, 3, 63],
    ["/products/bluetooth-speaker-mini", 900, 41, 23, 15, 135],
    ["/pages/about", 800, 8, 4, 1.5, 12],
    ["/products/thermal-mug-500", 700, 39, 22, 14, 98],
    ["/products/mechanical-keyboard-tkl", 650, 37, 20, 12, 78],
  ];
  const landingVisitors = landingDefs.map((d) => d[1]).sort((a, b) => b - a);
  const topThreshold = landingVisitors[2]; // TOP 3 流量门槛
  const landing: FunnelRow[] = landingDefs.map(([path, vis, atcR, coR, prR, pur]) => {
    const row = mkRow(path, vis, atcR, coR, prR, pur);
    if (vis >= topThreshold && prR < storeAvg.purchaseRate * BOTTLENECK_RATIO) {
      row.isHighLow = true;
    }
    return row;
  });

  const country: FunnelRow[] = [
    mkRow("US", 6200, 34, 20, 13, 806),
    mkRow("CN", 3400, 30, 17, 10, 340),
    mkRow("DE", 2100, 36, 22, 15, 315),
    mkRow("JP", 1800, 33, 19, 12, 216),
    mkRow("GB", 1500, 35, 21, 14, 210),
  ].map((r) => ({ ...r, flags: computeRowFlags(r, storeAvg) }));

  return { all, storeAvg, source, device, landing, country };
}

/* ─── 真实数据（复用 GA4 缓存 + Shopify 订单）────────── */

function readGa4Cache(): any | null {
  try {
    const raw = localStorage.getItem(GA4_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.bundle || null;
  } catch {
    return null;
  }
}

function buildRealFunnel(ga4: any, orders: Order[], rate: number): FunnelData {
  const paid = orders.filter(isPaid);
  const totalPurchases = paid.length;

  const ga4Sources = Array.isArray(ga4?.sources) ? ga4.sources : [];
  const ga4Device = Array.isArray(ga4?.device) ? ga4.device : [];
  const ga4Pages = Array.isArray(ga4?.pages) ? ga4.pages : [];

  const totalSessions = ga4Sources.reduce((s: number, x: any) => s + (Number(x.value) || 0), 0)
    || (ga4?.traffic?.summary?.totalSessions || 0);

  if (totalSessions === 0) {
    return {
      all: [],
      storeAvg: { atcRate: 0, checkoutRate: 0, purchaseRate: 0 },
      source: [], device: [], landing: [], country: [],
      ga4Missing: true,
    };
  }

  const purchaseRate = totalPurchases / totalSessions;
  const atcRate = purchaseRate * ATC_MULT;
  const checkoutRate = purchaseRate * CHECKOUT_MULT;
  const storeAvg = {
    atcRate: +(atcRate * 100).toFixed(1),
    checkoutRate: +(checkoutRate * 100).toFixed(1),
    purchaseRate: +(purchaseRate * 100).toFixed(2),
  };
  const all = buildStageCounts(totalSessions, storeAvg.atcRate, storeAvg.checkoutRate, storeAvg.purchaseRate);

  // 订单归因
  const sourceCount: Record<string, number> = {};
  const landingCount: Record<string, number> = {};
  for (const o of paid) {
    const s = classifySource(o.landing_site);
    sourceCount[s] = (sourceCount[s] || 0) + 1;
    const p = landingPath(o.landing_site);
    if (p) landingCount[p] = (landingCount[p] || 0) + 1;
  }

  const storeAovUsd = paid.length > 0
    ? paid.reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0) / paid.length
    : 0;
  const deviceFactor: Record<string, number> = { desktop: 1, mobile: 0.58, tablet: 0.875 };

  const mkRealRow = (
    label: string,
    visitors: number,
    attributedPurchases: number,
    aovFactor = 1,
  ): FunnelRow => {
    const purchases = attributedPurchases;
    const atcCount = Math.round(purchases * ATC_MULT);
    const checkoutCount = Math.round(purchases * CHECKOUT_MULT);
    const atcR = visitors > 0 ? (atcCount / visitors) * 100 : 0;
    const coR = visitors > 0 ? (checkoutCount / visitors) * 100 : 0;
    const prR = visitors > 0 ? (purchases / visitors) * 100 : 0;
    return {
      key: label,
      label,
      visitors,
      atcRate: +atcR.toFixed(1),
      checkoutRate: +coR.toFixed(1),
      purchaseRate: +prR.toFixed(2),
      atcCount,
      checkoutCount,
      purchases,
      aov: Math.round(storeAovUsd * aovFactor * rate),
      flags: [],
    };
  };

  const source: FunnelRow[] = ga4Sources
    .map((s: any) => {
      const label = String(s.name);
      const visitors = Number(s.value) || 0;
      if (visitors === 0) return null;
      const row = mkRealRow(label, visitors, sourceCount[label] || 0);
      row.flags = computeRowFlags(row, storeAvg);
      return row;
    })
    .filter(Boolean) as FunnelRow[];

  const totalDeviceVisitors = ga4Device.reduce((s: number, d: any) => s + (Number(d.sessions) || 0), 0) || 1;
  const device: FunnelRow[] = ga4Device
    .map((d: any) => {
      const label = String(d.name);
      const visitors = Number(d.sessions) || 0;
      if (visitors === 0) return null;
      const purchases = Math.round((totalPurchases * visitors) / totalDeviceVisitors);
      const factor = deviceFactor[label.toLowerCase()] ?? 1;
      const row = mkRealRow(label, visitors, purchases, factor);
      return row;
    })
    .filter(Boolean) as FunnelRow[];
  const maxDevAtc = device.length ? Math.max(...device.map((d) => d.atcRate)) : 0;
  device.forEach((d) => {
    if (d.atcRate < maxDevAtc - 5) {
      d.hint = `建议优化${d.label}端加购体验（加购率 ${d.atcRate}% 低于最优 ${maxDevAtc}%，可优化商品页加载速度与加购按钮位置）`;
    }
  });

  const topPages = [...ga4Pages].sort((a: any, b: any) => (b.pageviews || 0) - (a.pageviews || 0)).slice(0, 10);
  const landingVisitorsSorted = topPages.map((p: any) => p.pageviews || 0).sort((a: number, b: number) => b - a);
  const topThreshold = landingVisitorsSorted[2] ?? 0;
  const landing: FunnelRow[] = topPages
    .map((p: any) => {
      const visitors = Number(p.pageviews) || Number(p.sessions) || 0;
      if (visitors === 0) return null;
      const path = String(p.path || "/");
      const purchases = landingCount[path] || 0;
      const row = mkRealRow(path, visitors, purchases);
      const prR = row.purchaseRate;
      if (visitors >= topThreshold && prR < storeAvg.purchaseRate * BOTTLENECK_RATIO) {
        row.isHighLow = true;
      }
      return row;
    })
    .filter(Boolean) as FunnelRow[];

  return {
    all,
    storeAvg,
    source,
    device,
    landing,
    country: [],
    countryMissing: true,
    estimatedStages: true,
  };
}

/* ─── 迷你漏斗（4 段渐变条形）──────────────────────────── */

function MiniFunnel({ row }: { row: FunnelRow }) {
  const segs: Array<[number, string]> = [
    [100, STAGE_COLORS.visitors],
    [row.atcRate, STAGE_COLORS.atc],
    [row.checkoutRate, STAGE_COLORS.checkout],
    [row.purchaseRate, STAGE_COLORS.purchase],
  ];
  return (
    <div className="flex h-7 w-40 flex-col justify-center gap-0.5">
      {segs.map(([w, c], i) => (
        <div
          key={i}
          className="h-1.5 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, w))}%`, backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/* ─── 主组件 ─────────────────────────────────────────── */

export default function FunnelRetentionPanel({
  orders,
  isDemo,
  shopName,
  exchangeRate = EXCHANGE_RATE,
}: FunnelRetentionPanelProps) {
  const rate = exchangeRate;
  const [tab, setTab] = useState<string>("all");
  const [data, setData] = useState<FunnelData | null>(null);
  const [ga4Missing, setGa4Missing] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setData(buildDemoFunnel());
      setGa4Missing(false);
      return;
    }
    const ga4 = readGa4Cache();
    if (!ga4) {
      setGa4Missing(true);
      setData(null);
      return;
    }
    setData(buildRealFunnel(ga4, orders, rate));
    setGa4Missing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  /* 复购健康（保留 Retention 能力）*/
  const retention = useMemo(() => {
    const paidOrders = orders.filter(isPaid);
    let repeat = 0;
    let repeatRev = 0;
    let newRev = 0;
    paidOrders.forEach((o, i) => {
      const price = parseFloat(o.total_price) || 0;
      let cnt = o.customer_orders_count ?? 0;
      if (isDemo && cnt === 0) cnt = i % 4 === 0 ? 2 : 1;
      if (cnt > 1) {
        repeat++;
        repeatRev += price;
      } else {
        newRev += price;
      }
    });
    const repeatRate = paidOrders.length > 0 ? (repeat / paidOrders.length) * 100 : 0;
    const totalRev = repeatRev + newRev;
    const repeatRevPct = totalRev > 0 ? (repeatRev / totalRev) * 100 : 0;
    const grade = repeatRate >= 25 ? { label: "优秀", color: "text-emerald-400" }
      : repeatRate >= 15 ? { label: "良好", color: "text-sky-400" }
      : repeatRate >= 5 ? { label: "一般", color: "text-amber-400" }
      : { label: "偏低", color: "text-red-400" };
    return { repeatRate, repeatRevPct, grade, totalRev };
  }, [orders, isDemo]);

  const all = data?.all ?? [];
  const drops: number[] = [];
  for (let i = 0; i < all.length - 1; i++) {
    drops.push(all.length > 1 && all[i].count > 0 ? +(((all[i + 1].count / all[i].count) - 1) * 100).toFixed(0) : 0);
  }

  const overallCvr = all.length === 4 && all[0].count > 0 ? ((all[3].count / all[0].count) * 100).toFixed(2) + "%" : "—";
  const totalVisitors = all[0]?.count ?? 0;
  const totalPurchases = all[3]?.count ?? 0;

  const renderFlags = (flags: RowFlag[]) =>
    flags.map((f, i) => (
      <Badge
        key={i}
        variant="outline"
        className={cn(
          "mr-1 mt-1 text-[10px]",
          f.type === "bottleneck" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        )}
        title={f.message}
      >
        {f.type === "bottleneck" ? "🔴 瓶颈" : "🟢 优秀"} · {f.stage}
      </Badge>
    ));

  return (
    <div className="w-full space-y-5">
      {/* 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Filter className="h-5 w-5 text-violet-400" />
            多维转化漏斗分析
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {shopName} · 按来源 / 设备 / 着陆页 / 国家下钻，定位转化瓶颈
          </p>
        </div>
        {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
      </div>

      {ga4Missing && !isDemo && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-200">
              未检测到 GA4 缓存数据。漏斗各维度需要 GA4 的「流量来源 / 设备 / 着陆页」维度；请先在「GA4 流量分析」面板配置并拉取数据。
            </p>
          </CardContent>
        </Card>
      )}

      {!ga4Missing && data && (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-lg bg-zinc-800/60 p-1 sm:grid-cols-5">
            <TabsTrigger value="all" className="gap-1.5"><TrendingUp className="h-4 w-4" />全部</TabsTrigger>
            <TabsTrigger value="source" className="gap-1.5"><Globe2 className="h-4 w-4" />按来源</TabsTrigger>
            <TabsTrigger value="device" className="gap-1.5"><Smartphone className="h-4 w-4" />按设备</TabsTrigger>
            <TabsTrigger value="landing" className="gap-1.5"><FileSearch className="h-4 w-4" />按着陆页</TabsTrigger>
            <TabsTrigger value="country" className="gap-1.5"><MousePointerClick className="h-4 w-4" />按国家</TabsTrigger>
          </TabsList>

          {/* ── 全部：汇总漏斗 ── */}
          <TabsContent value="all" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard title="总访客" value={fmtInt(totalVisitors)} subtitle="GA4 会话数" icon={<Users className="h-5 w-5" />} accent="sky" />
              <KpiCard title="总成交" value={fmtInt(totalPurchases)} subtitle="Shopify 订单" icon={<ShoppingCart className="h-5 w-5" />} accent="emerald" />
              <KpiCard title="整体转化率" value={overallCvr} subtitle={`加购率 ${data.storeAvg.atcRate}%`} icon={<TrendingUp className="h-5 w-5" />} accent="violet" />
              <KpiCard title="复购率" value={retention.repeatRate.toFixed(1) + "%"} subtitle={`复购贡献 ${retention.repeatRevPct.toFixed(0)}%`} icon={<Repeat className="h-5 w-5" />} accent="amber" />
            </div>

            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">全店转化漏斗</CardTitle>
                <CardDescription>访客 → 加购 → 结账 → 成交，每段标注环比流失</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {all.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-200">{s.label}</span>
                      <span className="tabular-nums text-zinc-300">
                        {fmtInt(s.count)} <span className="text-zinc-500">· {s.percent}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-7 w-full overflow-hidden rounded bg-zinc-800/50">
                      <div className="h-full rounded transition-all" style={{ width: `${s.percent}%`, backgroundColor: s.color }} />
                    </div>
                    {i < drops.length && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-red-400">
                        <ArrowDown className="h-3 w-3" />
                        环比 {drops[i]}%
                      </div>
                    )}
                  </div>
                ))}
                {data.estimatedStages && (
                  <p className="pt-1 text-xs text-zinc-500">
                    注：真实模式下加购 / 结账阶段为店铺均值估算（GA4 缓存未含分维度电商事件），成交数由 Shopify 订单按来源 / 着陆页归因。
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 按来源 ── */}
          <TabsContent value="source" className="mt-4 space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">来源</TableHead>
                      <TableHead className="text-right text-zinc-400">访客</TableHead>
                      <TableHead className="text-right text-zinc-400">加购率</TableHead>
                      <TableHead className="text-right text-zinc-400">结账率</TableHead>
                      <TableHead className="text-right text-zinc-400">成交率</TableHead>
                      <TableHead className="text-right text-zinc-400">成交数</TableHead>
                      <TableHead className="text-zinc-400">迷你漏斗 / 异常</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.source.map((r) => (
                      <TableRow key={r.key} className="border-zinc-800">
                        <TableCell className="font-medium text-zinc-200">{r.label}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtInt(r.visitors)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(r.atcRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(r.checkoutRate)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", r.purchaseRate < data.storeAvg.purchaseRate * BOTTLENECK_RATIO ? "text-red-400" : r.purchaseRate > data.storeAvg.purchaseRate * EXCELLENT_RATIO ? "text-emerald-400" : "text-zinc-300")}>{fmtPct(r.purchaseRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtInt(r.purchases)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <MiniFunnel row={r} />
                            <div className="flex flex-wrap max-w-[180px]">{renderFlags(r.flags)}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.source.length === 0 && (
                      <TableRow className="border-zinc-800"><TableCell colSpan={7} className="py-8 text-center text-zinc-500">无来源数据</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 按设备 ── */}
          <TabsContent value="device" className="mt-4 space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">设备</TableHead>
                      <TableHead className="text-right text-zinc-400">访客</TableHead>
                      <TableHead className="text-right text-zinc-400">加购率</TableHead>
                      <TableHead className="text-right text-zinc-400">成交率</TableHead>
                      <TableHead className="text-right text-zinc-400">客单价</TableHead>
                      <TableHead className="text-zinc-400">优化建议</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.device.map((r) => (
                      <TableRow key={r.key} className="border-zinc-800">
                        <TableCell className="font-medium text-zinc-200">{r.label}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtInt(r.visitors)}</TableCell>
                        <TableCell className={cn("text-right", r.atcRate < (Math.max(...data.device.map((d) => d.atcRate)) - 5) ? "text-red-400" : "text-zinc-300")}>{fmtPct(r.atcRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(r.purchaseRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{r.aov ? formatCny(r.aov) : "—"}</TableCell>
                        <TableCell className="max-w-[260px]">
                          {r.hint ? (
                            <span className="flex items-start gap-1.5 text-xs text-amber-300">
                              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r.hint}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.device.length === 0 && (
                      <TableRow className="border-zinc-800"><TableCell colSpan={6} className="py-8 text-center text-zinc-500">无设备数据</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 按着陆页 ── */}
          <TabsContent value="landing" className="mt-4 space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">入口页面</TableHead>
                      <TableHead className="text-right text-zinc-400">访客</TableHead>
                      <TableHead className="text-right text-zinc-400">加购率</TableHead>
                      <TableHead className="text-right text-zinc-400">结账率</TableHead>
                      <TableHead className="text-right text-zinc-400">成交率</TableHead>
                      <TableHead className="text-right text-zinc-400">成交数</TableHead>
                      <TableHead className="text-zinc-400">标记</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.landing.map((r) => (
                      <TableRow key={r.key} className="border-zinc-800">
                        <TableCell>
                          <div className="max-w-[240px] truncate font-medium text-zinc-200" title={r.label}>{r.label}</div>
                        </TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtInt(r.visitors)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(r.atcRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(r.checkoutRate)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", r.purchaseRate < data.storeAvg.purchaseRate * BOTTLENECK_RATIO ? "text-red-400" : "text-zinc-300")}>{fmtPct(r.purchaseRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtInt(r.purchases)}</TableCell>
                        <TableCell>
                          {r.isHighLow ? (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">高流量低转化</Badge>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.landing.length === 0 && (
                      <TableRow className="border-zinc-800"><TableCell colSpan={7} className="py-8 text-center text-zinc-500">无着陆页数据</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 按国家 ── */}
          <TabsContent value="country" className="mt-4 space-y-4">
            {data.countryMissing ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="flex items-center gap-3 p-4">
                  <Globe2 className="h-5 w-5 text-amber-400" />
                  <p className="text-sm text-amber-200">
                    按国家维度需要 GA4 的「国家 / 地区」维度数据，当前 GA4 缓存未包含该维度。Demo 模式可查看预置国家分布。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400">国家 / 地区</TableHead>
                        <TableHead className="text-right text-zinc-400">访客</TableHead>
                        <TableHead className="text-right text-zinc-400">加购率</TableHead>
                        <TableHead className="text-right text-zinc-400">结账率</TableHead>
                        <TableHead className="text-right text-zinc-400">成交率</TableHead>
                        <TableHead className="text-right text-zinc-400">成交数</TableHead>
                        <TableHead className="text-zinc-400">异常</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.country.map((r) => (
                        <TableRow key={r.key} className="border-zinc-800">
                          <TableCell className="font-medium text-zinc-200">{r.label}</TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtInt(r.visitors)}</TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtPct(r.atcRate)}</TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtPct(r.checkoutRate)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", r.purchaseRate < data.storeAvg.purchaseRate * BOTTLENECK_RATIO ? "text-red-400" : "text-zinc-300")}>{fmtPct(r.purchaseRate)}</TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtInt(r.purchases)}</TableCell>
                          <TableCell><div className="flex flex-wrap max-w-[180px]">{renderFlags(r.flags)}</div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* 复购健康（Retention）*/}
      {!ga4Missing && data && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat className="h-4 w-4 text-amber-400" />复购健康度
            </CardTitle>
            <CardDescription>基于 Shopify 订单的复购率与复购贡献占比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-zinc-500">复购率</p>
                <p className={cn("text-2xl font-bold", retention.grade.color)}>{retention.repeatRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">复购贡献</p>
                <p className="text-2xl font-bold text-zinc-100">{retention.repeatRevPct.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">评级</p>
                <p className={cn("text-2xl font-bold", retention.grade.color)}>{retention.grade.label}</p>
              </div>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, retention.repeatRevPct)}%` }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── 子组件 ──────────────────────────────────────── */

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
