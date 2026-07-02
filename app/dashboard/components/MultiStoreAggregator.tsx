"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Globe,
  ShoppingCart,
  DollarSign,
  Store,
  TrendingUp,
  Layers,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import {
  EXCHANGE_RATE,
  DEMO_LOOKBACK_DAYS,
  DEMO_GROWTH_FACTOR,
} from "../config";

// ─── Types ────────────────────────────────────────────

interface StoreEntry {
  id: string;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  isDemo?: boolean;
}

interface StoreAggData {
  id: string;
  shopId: string;
  name: string;
  domain: string;
  gmv: number;
  orderCount: number;
  hourlySales: number[];
  contribution: number;
  color: string;
  isDemo: boolean;
}

interface CurrentStoreData {
  gmv: number;
  orderCount: number;
  shopName: string;
  domain?: string;
  orders: Array<{
    id: number;
    created_at: string;
    total_price: string;
    financial_status: string;
  }>;
  exchangeRate: number;
}

// ─── Color palette ────────────────────────────────────

const STORE_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

// ─── PRNG ─────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Demo data generator ──────────────────────────────

function generateStoreMockData(
  store: StoreEntry,
  colorIndex: number,
  today: Date,
  exchangeRate: number,
): StoreAggData {
  const color = STORE_COLORS[colorIndex % STORE_COLORS.length];
  const seed = store.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const HOURLY_WEIGHTS = [
    0.05, 0.02, 0.02, 0.02, 0.05, 0.1, 0.2, 0.35, 0.55, 0.8,
    1.0, 0.9, 0.7, 0.55, 0.65, 0.8, 0.75, 0.6, 0.55, 0.65,
    0.75, 0.55, 0.35, 0.15,
  ];

  const dailyGmv: number[] = new Array(DEMO_LOOKBACK_DAYS).fill(0);
  const dailyOrders: number[] = new Array(DEMO_LOOKBACK_DAYS).fill(0);
  const baseRevenue = 500 + rand() * 2000;

  for (let d = 0; d < DEMO_LOOKBACK_DAYS; d++) {
    const isRecent = d >= DEMO_LOOKBACK_DAYS / 2;
    const growthFactor = isRecent ? DEMO_GROWTH_FACTOR : 1.0;
    const dayOfWeek = (today.getDay() - (DEMO_LOOKBACK_DAYS - 1 - d) + 7) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.7 : 1.0;
    let dayGmv = 0;
    let dayOrders = 0;
    for (let h = 0; h < 24; h++) {
      const weight = HOURLY_WEIGHTS[h];
      const variance = 0.7 + rand() * 0.6;
      const hourRev = baseRevenue * weight * variance * weekendFactor * growthFactor * exchangeRate;
      const hourOrders = Math.max(1, Math.round(weight * 3 * variance * weekendFactor * growthFactor));
      dayGmv += hourRev;
      dayOrders += hourOrders;
    }
    dailyGmv[d] = Math.round(dayGmv * 100) / 100;
    dailyOrders[d] = dayOrders;
  }

  const hourlySales: number[] = new Array(24).fill(0);
  let totalGmv = 0;
  let totalOrders = 0;
  const currentHour = new Date().getHours();
  const startDay = Math.max(0, DEMO_LOOKBACK_DAYS - 7);

  for (let d = startDay; d < DEMO_LOOKBACK_DAYS; d++) {
    const dayGmv = dailyGmv[d];
    const dayOrders = dailyOrders[d];
    const isToday = d === DEMO_LOOKBACK_DAYS - 1;
    for (let h = 0; h < 24; h++) {
      if (isToday && h > currentHour) break;
      const weight = HOURLY_WEIGHTS[h];
      const hourFraction = weight / HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);
      hourlySales[h] += Math.round(dayGmv * hourFraction * 100) / 100;
    }
    totalGmv += isToday ? dayGmv * ((currentHour + 1) / 24) : dayGmv;
    totalOrders += isToday ? Math.round(dayOrders * ((currentHour + 1) / 24)) : dayOrders;
  }

  return {
    id: store.id,
    shopId: store.id,
    name: store.shopName || store.shopUrl.replace(".myshopify.com", ""),
    domain: store.shopUrl,
    gmv: Math.round(totalGmv * 100) / 100,
    orderCount: totalOrders,
    hourlySales,
    contribution: 0,
    color,
    isDemo: true,
  };
}

// ─── Real store data fetcher ──────────────────────────

async function fetchRealStoreData(
  store: StoreEntry,
  exchangeRate: number,
): Promise<StoreAggData | null> {
  try {
    const res = await fetch(
      `/api/shopify/dashboard?${new URLSearchParams({
        shopUrl: store.shopUrl,
        accessToken: store.accessToken,
      })}`,
    );
    const json = await res.json();
    if (!json.success) return null;

    const orders: Array<{ created_at: string; total_price: string }> = json.orders ?? [];
    const currentHour = new Date().getHours();
    const hourlySales = new Array(24).fill(0);

    for (const order of orders) {
      const h = (new Date(order.created_at).getUTCHours() + 8) % 24;
      if (h > currentHour) continue;
      hourlySales[h] += (parseFloat(order.total_price) || 0) * (json.exchangeRate || exchangeRate);
    }
    for (let h = 0; h < 24; h++) {
      hourlySales[h] = Math.round(hourlySales[h] * 100) / 100;
    }

    return {
      id: store.id,
      shopId: store.id,
      name: json.shopName || store.shopName || store.shopUrl.replace(".myshopify.com", ""),
      domain: store.shopUrl,
      gmv: json.gmv || 0,
      orderCount: json.orderCount || 0,
      hourlySales,
      contribution: 0,
      color: STORE_COLORS[0],
      isDemo: false,
    };
  } catch {
    return null;
  }
}

// ─── Build stacked chart data ─────────────────────────

function buildStackedChartData(stores: StoreAggData[]) {
  const currentHour = new Date().getHours();
  const hours: Array<Record<string, number | string>> = [];
  for (let h = 0; h <= currentHour; h++) {
    const point: Record<string, number | string> = { hour: `${String(h).padStart(2, "0")}:00` };
    for (const s of stores) {
      point[`bar_${s.id}`] = s.hourlySales[h] || 0;
    }
    hours.push(point);
  }
  return hours;
}

// ─── Summary Card ─────────────────────────────────────

function SummaryCard({
  title, value, subtitle, icon: Icon, accent,
}: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
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
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${colors[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StackedTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.filter((e) => e.value > 0).map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatCny(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Single-store bypass: build aggregator data from current page props ──

function buildSingleStoreData(currentData: CurrentStoreData): StoreAggData {
  const currentHour = new Date().getHours();
  const hourlySales = new Array(24).fill(0);
  for (const order of currentData.orders) {
    const h = (new Date(order.created_at).getUTCHours() + 8) % 24;
    if (h > currentHour) continue;
    hourlySales[h] += (parseFloat(order.total_price) || 0) * (currentData.exchangeRate || EXCHANGE_RATE);
  }
  return {
    id: "single",
    shopId: "single",
    name: currentData.shopName,
    domain: currentData.domain || "",
    gmv: currentData.gmv,
    orderCount: currentData.orderCount,
    hourlySales: hourlySales.map((v) => Math.round(v * 100) / 100),
    contribution: 100,
    color: STORE_COLORS[0],
    isDemo: false,
  };
}

// ─── Main Component ───────────────────────────────────

export default function MultiStoreAggregator({
  currentData,
}: {
  currentData?: CurrentStoreData;
}) {
  const [showChart, setShowChart] = useState(true);
  const [loading, setLoading] = useState(true);
  const [aggregated, setAggregated] = useState<{
    data: StoreAggData[]; totalGmv: number; totalOrders: number; chartData: Array<Record<string, number | string>>;
  }>({ data: [], totalGmv: 0, totalOrders: 0, chartData: [] });

  const isFetching = useRef(false);
  const storesSnapshotRef = useRef(0); // track stores.length to prevent re-fetch
  const today = useMemo(() => new Date(), []);

  const stores: StoreEntry[] = useMemo(() => {
    try {
      const raw = localStorage.getItem("shopify_stores");
      return raw ? (JSON.parse(raw) as StoreEntry[]) : [];
    } catch {
      return [];
    }
  }, []);

  // ── Core: smart fetch — single-store bypass + multi-store guarded ──
  useEffect(() => {
    // Re-fetch only when store count changes
    if (stores.length === 0) {
      setLoading(false);
      setAggregated({ data: [], totalGmv: 0, totalOrders: 0, chartData: [] });
      storesSnapshotRef.current = 0;
      return;
    }

    if (stores.length === storesSnapshotRef.current) return; // skip if count unchanged
    storesSnapshotRef.current = stores.length;

    if (isFetching.current) return;
    isFetching.current = true;

    let cancelled = false;

    async function load() {
      // ── Single store: bypass API, use current page props ──
      if (stores.length === 1 && currentData) {
        const single = buildSingleStoreData(currentData);
        const data = [single];
        const totalGmv = single.gmv;
        const totalOrders = single.orderCount;
        const chartData = buildStackedChartData(data);
        if (!cancelled) {
          setAggregated({ data, totalGmv, totalOrders, chartData });
          setLoading(false);
        }
        isFetching.current = false;
        return;
      }

      // ── Multiple stores: fetch via API (real) + mock (demo) ──
      const realStores = stores.filter((s) => !s.isDemo);
      const demoStores = stores.filter((s) => s.isDemo);

      let storeDatas: StoreAggData[] = [];
      let colorIdx = 0;

      for (const store of demoStores) {
        storeDatas.push(generateStoreMockData(store, colorIdx, today, EXCHANGE_RATE));
        colorIdx++;
      }

      if (realStores.length > 0) {
        const results = await Promise.all(
          realStores.map((store) => fetchRealStoreData(store, EXCHANGE_RATE)),
        );
        for (const result of results) {
          if (result) {
            result.color = STORE_COLORS[colorIdx % STORE_COLORS.length];
            storeDatas.push(result);
            colorIdx++;
          }
        }
      }

      if (cancelled) { isFetching.current = false; return; }

      const totalGmv = storeDatas.reduce((sum, s) => sum + s.gmv, 0);
      const totalOrders = storeDatas.reduce((sum, s) => sum + s.orderCount, 0);
      for (const s of storeDatas) {
        s.contribution = totalGmv > 0 ? (s.gmv / totalGmv) * 100 : 0;
      }
      storeDatas.sort((a, b) => b.gmv - a.gmv);

      const chartData = buildStackedChartData(storeDatas);
      setAggregated({ data: storeDatas, totalGmv, totalOrders, chartData });
      setLoading(false);
      isFetching.current = false;
    }

    load();
    return () => { cancelled = true; };
  }, [stores.length, currentData]);

  const { data: storeData, totalGmv, totalOrders, chartData } = aggregated;
  const demoCount = stores.filter((s) => s.isDemo).length;
  const realCount = stores.filter((s) => !s.isDemo).length;
  const avgOrdersPerStore = stores.length > 0 ? Math.round(totalOrders / stores.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 px-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-muted-foreground">
              {stores.length === 1 ? "正在读取当前店铺数据..." : `正在拉取 ${realCount} 家真实店铺数据...`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Layers className="h-6 w-6 text-sky-400" />
          全店聚合大盘
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stores.length > 1 ? `${DEMO_LOOKBACK_DAYS} 天` : "今日"}综合数据汇总
          {demoCount > 0 && realCount > 0 && <span className="text-amber-400"> (含演示店铺)</span>}
          {demoCount > 0 && realCount === 0 && <span className="text-amber-400"> (演示模式)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard title="聚合总营收" value={formatCny(totalGmv)} subtitle={`${stores.length} 家店铺合计 · 汇率 ¥${EXCHANGE_RATE}`} icon={DollarSign} accent="emerald" />
        <SummaryCard title="聚合总单量" value={`${totalOrders} 单`} subtitle={`平均 ${avgOrdersPerStore} 单/店`} icon={ShoppingCart} accent="sky" />
        <SummaryCard title="已连接站点" value={`${stores.length} 家`} subtitle={`${demoCount} 演示 · ${realCount} 真实`} icon={Store} accent="amber" />
      </div>

      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">多店铺营收堆叠分布</CardTitle>
            <CardDescription>北京时间每小时堆叠 · 每种颜色代表一家店铺 · 无未来数据泄漏</CardDescription>
          </div>
          <button onClick={() => setShowChart(!showChart)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showChart ? "隐藏" : "显示"}
          </button>
        </CardHeader>
        {showChart && (
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `¥${v}`} width={60} />
                    <Tooltip content={<StackedTooltip />} />
                    <Legend formatter={(value: string) => (<span style={{ color: "oklch(0.708 0 0)", fontSize: "11px" }}>{value}</span>)} />
                    {storeData.map((store) => (
                      <Bar key={store.id} dataKey={`bar_${store.id}`} name={store.name} stackId="a" fill={store.color} radius={[0, 0, 0, 0]} maxBarSize={32} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">暂无数据，请添加店铺后重试</div>
            )}
          </CardContent>
        )}
      </Card>

      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            店铺战力排行榜
          </CardTitle>
          <CardDescription>按营收降序 · 贡献率含进度条</CardDescription>
        </CardHeader>
        <CardContent>
          {storeData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>店铺</TableHead>
                  <TableHead className="text-right">订单</TableHead>
                  <TableHead className="text-right">营收 (CNY)</TableHead>
                  <TableHead className="text-right w-64">贡献率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeData.map((store, index) => (
                  <TableRow key={store.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="text-center">
                      {index === 0 ? (<Badge className="bg-amber-500/20 text-amber-400 px-1.5 py-0 text-xs">🥇</Badge>)
                      : index === 1 ? (<Badge className="bg-sky-500/20 text-sky-400 px-1.5 py-0 text-xs">🥈</Badge>)
                      : index === 2 ? (<Badge className="bg-orange-500/20 text-orange-400 px-1.5 py-0 text-xs">🥉</Badge>)
                      : <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: store.color }} />
                        <span className="font-medium text-foreground">{store.name}</span>
                        <span className="text-xs text-muted-foreground">({store.domain})</span>
                        {store.isDemo
                          ? <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-400">演示</Badge>
                          : <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/30 text-emerald-400">真实</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{store.orderCount} 单</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-emerald-400">{formatCny(store.gmv)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, store.contribution)}%`, backgroundColor: store.color }} />
                        </div>
                        <span className="w-14 text-right text-xs font-semibold tabular-nums text-muted-foreground">{store.contribution.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Store className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无已绑定店铺数据</p>
              <p className="text-xs text-muted-foreground/60">请前往配置页添加店铺以启用聚合面板</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
