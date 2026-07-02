"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCny } from "../helpers";
import {
  EXCHANGE_RATE,
  DEMO_LOOKBACK_DAYS,
  DEMO_GROWTH_FACTOR,
} from "../config";

// ─── Types ────────────────────────────────────────────

type TimeRange = "yesterday" | "7days" | "30days";

interface PeriodData {
  gmv: number;
  orderCount: number;
  aov: number;
}

interface DayPoint {
  date: string;
  currentSales: number;
  previousSales: number;
  currentOrders: number;
  previousOrders: number;
}

interface TrendAnalysisPanelProps {
  shopName: string;
  isDemo: boolean;
  exchangeRate?: number;
  currency: string;
  shopId?: string;
}

// ─── Helpers ──────────────────────────────────────────

const RANGE_CONFIG: Record<TimeRange, { days: number; format: string }> = {
  yesterday: { days: 1, format: "HH:00" },
  "7days": { days: 7, format: "MM-DD" },
  "30days": { days: 30, format: "MM-DD" },
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── API Integration Comment ──────────────────────────
/*
 * ── 后端接口适配说明 ───────────────────────────────────
 *
 * 本组件支持两种数据模式：
 * 1. Demo 模式：前端 Mock 数据自动生成（14 天回溯，15% 增长）
 * 2. 真实模式：需后端提供以下数据结构：
 *
 * // 当前周期
 * GET https://{shopUrl}/admin/api/2026-04/orders.json
 *   ?created_at_min={currentStart}T00:00:00+08:00
 *   &created_at_max={currentEnd}T23:59:59+08:00
 *   &status=any&limit=250&fields=id,created_at,total_price
 *
 * // 上期周期
 * GET https://{shopUrl}/admin/api/2026-04/orders.json
 *   ?created_at_min={previousStart}T00:00:00+08:00
 *   &created_at_max={previousEnd}T23:59:59+08:00
 *   &status=any&limit=250&fields=id,created_at,total_price
 *
 * 后端返回格式：
 * interface TrendResponse {
 *   currentPeriod: { orders: Array<{ created_at: string; total_price: string }> };
 *   previousPeriod: { orders: Array<{ created_at: string; total_price: string }> };
 * }
 *
 * 本组件自动计算 GMV / orderCount / AOV / dayPoints。
 * ───────────────────────────────────────────────────────
 */

// ─── 14-Day Demo Data Generator ──────────────────────

/**
 * Generate 14 days of mock order data with ~15% growth in week 2.
 * Returns per-day aggregations for the full lookback window.
 */
function generateDemoOrders(
  baseDate: Date,
  shopId: string,
  exchangeRate: number,
): Map<string, { sales: number; orders: number; shopId: string }> {
  const seed = shopId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const map = new Map<string, { sales: number; orders: number; shopId: string }>();

  // Hourly traffic weights for realistic intra-day patterns
  const HOURLY_WEIGHTS = [
    0.05, 0.02, 0.02, 0.02, 0.05, 0.1, 0.2, 0.35, 0.55, 0.8,
    1.0, 0.9, 0.7, 0.55, 0.65, 0.8, 0.75, 0.6, 0.55, 0.65,
    0.75, 0.55, 0.35, 0.15,
  ];

  const today = new Date(baseDate);
  const range = DEMO_LOOKBACK_DAYS;
  const currentHour = new Date().getHours();

  for (let d = range - 1; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const dayKey = formatDate(day);

    // Week 2 (days 0-6 = most recent) gets DEMO_GROWTH_FACTOR boost
    const isRecentWeek = d < 7;
    const growthMultiplier = isRecentWeek ? DEMO_GROWTH_FACTOR : 1.0;

    // For today (d=0 = most recent day): only count hours up to currentHour
    const isToday = d === 0;

    let totalSales = 0;
    let totalOrders = 0;

    for (let h = 0; h < 24; h++) {
      // Skip future hours for today only; historical days are complete
      if (isToday && h > currentHour) break;

      const weight = HOURLY_WEIGHTS[h];
      const baseOrders = Math.max(1, Math.round(weight * 4 * (0.7 + rand() * 0.6)));
      const aov = 45 + rand() * 90;
      const sales = baseOrders * aov * exchangeRate * growthMultiplier;

      totalOrders += baseOrders;
      totalSales += sales;
    }

    map.set(dayKey, {
      sales: Math.round(totalSales * 100) / 100,
      orders: totalOrders,
      shopId,
    });
  }

  return map;
}

/** Build chart data from two date-ranges and mock data */
function buildChartData(
  demoMap: Map<string, { sales: number; orders: number; shopId: string }>,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  timeRange: TimeRange,
): { currentPeriod: PeriodData; previousPeriod: PeriodData; chartData: DayPoint[] } {
  const fmt = RANGE_CONFIG[timeRange].format;

  /** Collect daily points for a range */
  function collect(start: Date, end: Date): { sales: number; orders: number; points: Array<{ date: string; sales: number; orders: number }> } {
    let totalSales = 0;
    let totalOrders = 0;
    const points: Array<{ date: string; sales: number; orders: number }> = [];

    const cur = new Date(start);

    if (timeRange === "yesterday") {
      for (let h = 0; h < 24; h++) {
        const key = `${String(h).padStart(2, "0")}:00`;
        const entry = demoMap.get(formatDate(start));
        // Distribute evenly across hours for yesterday mode
        const hourVal = entry ? entry.sales / 24 : 0;
        const hourOrders = entry ? Math.round(entry.orders / 24) : 0;
        points.push({ date: key, sales: Math.round(hourVal * 100) / 100, orders: hourOrders });
        totalSales += hourVal;
        totalOrders += hourOrders;
      }
    } else {
      while (cur <= end) {
        const key = formatDate(cur);
        const entry = demoMap.get(key);
        const s = entry ? entry.sales : 0;
        const o = entry ? entry.orders : 0;
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        points.push({ date: `${m}-${d}`, sales: Math.round(s * 100) / 100, orders: o });
        totalSales += s;
        totalOrders += o;
        cur.setDate(cur.getDate() + 1);
      }
    }

    return { sales: totalSales, orders: totalOrders, points };
  }

  const cur = collect(currentStart, currentEnd);
  const prev = collect(previousStart, previousEnd);

  // Merge into dual-line chart data
  const prevMap = new Map<string, number>();
  for (const p of prev.points) prevMap.set(p.date, p.sales);

  const chartData: DayPoint[] = cur.points.map((p) => ({
    date: p.date,
    currentSales: p.sales,
    previousSales: prevMap.get(p.date) ?? 0,
    currentOrders: p.orders,
    previousOrders: prev.points.find((pp) => pp.date === p.date)?.orders ?? 0,
  }));

  return {
    currentPeriod: {
      gmv: Math.round(cur.sales * 100) / 100,
      orderCount: cur.orders,
      aov: cur.orders > 0 ? Math.round((cur.sales / cur.orders) * 100) / 100 : 0,
    },
    previousPeriod: {
      gmv: Math.round(prev.sales * 100) / 100,
      orderCount: prev.orders,
      aov: prev.orders > 0 ? Math.round((prev.sales / prev.orders) * 100) / 100 : 0,
    },
    chartData,
  };
}

// ─── Growth KPI Card ──────────────────────────────────

function GrowthKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  growth,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  growth: number;
  accent: "emerald" | "sky" | "amber";
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  };
  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60">
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <div className="flex items-center gap-1.5">
              {growth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-semibold ${growth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${colors[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chart Tooltip ────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCny(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

export default function TrendAnalysisPanel({
  shopName,
  isDemo,
  exchangeRate = EXCHANGE_RATE,
  currency,
  shopId = "default",
}: TrendAnalysisPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7days");

  // Dynamic base date (never hardcoded)
  const today = useMemo(() => new Date(), []);

  // Compute date ranges based on dynamic today
  const { currentStart, currentEnd, previousStart, previousEnd } = useMemo(() => {
    const numDays = RANGE_CONFIG[timeRange].days;
    const cEnd = new Date(today);
    cEnd.setHours(23, 59, 59, 999);
    const cStart = new Date(cEnd);
    cStart.setDate(cStart.getDate() - numDays + 1);
    cStart.setHours(0, 0, 0, 0);

    const pEnd = new Date(cStart);
    pEnd.setDate(pEnd.getDate() - 1);
    pEnd.setHours(23, 59, 59, 999);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - numDays + 1);
    pStart.setHours(0, 0, 0, 0);

    return { currentStart: cStart, currentEnd: cEnd, previousStart: pStart, previousEnd: pEnd };
  }, [timeRange, today]);

  // Generate data — demo mode uses 14-day growth flow
  const { currentPeriod, previousPeriod, chartData } = useMemo(() => {
    if (isDemo) {
      const demoMap = generateDemoOrders(today, shopId, exchangeRate);
      return buildChartData(demoMap, currentStart, currentEnd, previousStart, previousEnd, timeRange);
    }
    return {
      currentPeriod: { gmv: 0, orderCount: 0, aov: 0 } as PeriodData,
      previousPeriod: { gmv: 0, orderCount: 0, aov: 0 } as PeriodData,
      chartData: [] as DayPoint[],
    };
  }, [isDemo, today, shopId, exchangeRate, currentStart, currentEnd, previousStart, previousEnd, timeRange]);

  // Growth calculations
  const gmvGrowth = previousPeriod.gmv > 0
    ? ((currentPeriod.gmv - previousPeriod.gmv) / previousPeriod.gmv) * 100
    : 0;
  const orderGrowth = previousPeriod.orderCount > 0
    ? ((currentPeriod.orderCount - previousPeriod.orderCount) / previousPeriod.orderCount) * 100
    : 0;
  const aovGrowth = previousPeriod.aov > 0
    ? ((currentPeriod.aov - previousPeriod.aov) / previousPeriod.aov) * 100
    : 0;

  const rangeLabel: Record<TimeRange, string> = {
    yesterday: "昨日",
    "7days": "近 7 天",
    "30days": "近 30 天",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <BarChart3 className="h-6 w-6 text-sky-400" />
            趋势同比 / 环比分析
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {shopName} · 多维度历史数据动态对比
            {isDemo && <span className="ml-2 text-xs text-amber-400">(模拟 14 天数据流)</span>}
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yesterday">昨日对比</SelectItem>
            <SelectItem value="7days">近 7 天</SelectItem>
            <SelectItem value="30days">近 30 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Period Info Bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border/30 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{rangeLabel[timeRange]}对比</span>
        <span>当前：{formatDate(currentStart)} ~ {formatDate(currentEnd)}</span>
        <span className="text-muted-foreground/50">vs</span>
        <span>上期：{formatDate(previousStart)} ~ {formatDate(previousEnd)}</span>
        <span className="ml-auto text-emerald-400">
          汇率 1 {currency} = ¥{exchangeRate}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GrowthKpiCard
          title="GMV 环比"
          value={formatCny(currentPeriod.gmv)}
          subtitle="较上期"
          icon={DollarSign}
          growth={gmvGrowth}
          accent="emerald"
        />
        <GrowthKpiCard
          title="订单量环比"
          value={`${currentPeriod.orderCount} 单`}
          subtitle="较上期"
          icon={ShoppingCart}
          growth={orderGrowth}
          accent="sky"
        />
        <GrowthKpiCard
          title="客单价环比"
          value={formatCny(currentPeriod.aov)}
          subtitle="较上期"
          icon={TrendingUp}
          growth={aovGrowth}
          accent="amber"
        />
      </div>

      {/* Dual-line Chart */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-base">GMV 趋势对比</CardTitle>
          <CardDescription>
            实线 = {rangeLabel[timeRange]} (本周{isDemo ? " +15% 增长" : ""}) · 虚线 = 上期同期
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }}
                    tickLine={false}
                    axisLine={false}
                    interval={timeRange === "30days" ? 2 : 0}
                    angle={timeRange === "30days" ? -30 : 0}
                    textAnchor={timeRange === "30days" ? "end" : "middle"}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `¥${v}`}
                    width={65}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(v: string) => (
                      <span style={{ color: "oklch(0.708 0 0)", fontSize: "12px" }}>{v}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="currentSales"
                    name="当前周期"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "#10b981", stroke: "oklch(0.145 0 0)", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previousSales"
                    name="上期同期"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 5, fill: "#6366f1", stroke: "oklch(0.145 0 0)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {isDemo
                  ? "正在生成 14 天趋势数据..."
                  : "连接真实店铺后，系统将自动拉取历史订单生成同比/环比趋势图"}
              </p>
              {!isDemo && (
                <div className="mt-2 w-full max-w-lg rounded-lg border border-border/30 bg-muted/20 p-4 text-left">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    📡 后端 API 接入说明
                  </p>
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/70">
{`// GET /admin/api/{year}-04/orders.json?created_at_min=X&created_at_max=Y&status=any&limit=250`}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
