"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Wallet,
  Receipt,
  Package,
  Store,
  LogOut,
  RefreshCw,
  Download,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Flame,
  Calendar,
  Clock,
  Coins,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { formatCny, formatTimeAgo, getInventoryBadge } from "../helpers";

// ─── Types ────────────────────────────────────────────

interface StoreEntry {
  id: string; shopUrl: string; accessToken: string; shopName: string; isDemo?: boolean;
}

interface ChartPoint { hour: string; count?: number; sales: number; }

interface Order {
  id: number; created_at: string; total_price: string; financial_status: string;
  productId?: number;
  shippingCountry?: string;
}

interface Product {
  id: number; title: string; image: string | null;
  totalSold: number; totalRevenue: number; inventory: number;
}

interface Holiday { date: string; localName: string; name: string; countryCode: string; }
interface DiagnosisReport { overview: string; conversionAnalysis: string; inventoryAlerts: string[]; recommendations: string[]; riskLevel: "low" | "medium" | "high"; }

interface DashboardData {
  success: true; shopName: string; domain: string; currency: string; exchangeRate: number;
  gmv: number; orderCount: number;
  charts: ChartPoint[]; products: Product[]; orders: Order[];
  holidaysData: Record<string, Array<{ date: string; localName: string; name: string; countryCode: string }>>;
  topCountries: string[]; lastUpdated: string;
}

interface OverviewPanelProps {
  data: DashboardData;
  currentStore: StoreEntry | null; stores: StoreEntry[];
  cogsRate: number; setCogsRate: (v: number) => void;
  shippingRate: number; setShippingRate: (v: number) => void;
  marketingRate: number; setMarketingRate: (v: number) => void;
  totalCostRate: number; profit: number; profitMargin: number;
  refundRate: number; refundedOrders: Order[]; refundAmount: number;
  pieData: Array<{ name: string; value: number; color: string }>;
  productRiskMap: Map<number, { level: string }>;
  countryHolidays: Record<string, Holiday | null>;
  activeCountry: string; setActiveCountry: (v: string) => void;
  countdown: { days: number; hours: number; minutes: number; seconds: number };
  fetchData: (store: StoreEntry) => void;
  handleStoreChange: (id: string | null) => void;
  handleRemoveStore: () => void;
  handleAddStore: () => void;
  handleStartDiagnosis: () => void;
  sheetOpen: boolean; setSheetOpen: (v: boolean) => void;
  diagnosing: boolean; diagnosis: DiagnosisReport | null; typewriterText: string;
}

// ─── Sub-components ───────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, trend, trendValue, accent, flash }: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: "up" | "down" | "neutral"; trendValue: string;
  accent?: "emerald" | "sky" | "amber" | "violet"; flash?: boolean;
}) {
  const a = { emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20", amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20", violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20" };
  return (
    <Card className={`group relative overflow-hidden border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60 hover:shadow-xl ${flash ? "animate-[gmv-flash_0.6s_ease-in-out]" : ""}`}>
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold tracking-tight text-foreground transition-all duration-300 ${flash ? "text-emerald-400 scale-105" : ""}`}>{value}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>{trendValue}</span>
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${a[accent ?? "emerald"]}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatCny(payload[0].value)}</p>
    </div>
  );
}

// ─── Polling tick: generate new orders with product linkage ──

interface TickResult {
  orders: Order[];
  /** Map of productId → quantity sold in this tick */
  productSales: Map<number, number>;
}

function generateDemoTickOrders(
  startId: number,
  exchangeRate: number,
  currentHour: number,
  products: Product[],
): TickResult {
  if (Math.random() >= 0.5) return { orders: [], productSales: new Map() };
  if (products.length === 0) return { orders: [], productSales: new Map() };

  // Destination countries for multi-market linkage (US/GB/DE)
  const DEST_COUNTRIES = ["US", "US", "GB", "DE", "US"]; // US 60%, GB 20%, DE 20%

  const count = Math.random() < 0.5 ? 1 : 2;
  const orders: Order[] = [];
  const productSales = new Map<number, number>();

  for (let i = 0; i < count; i++) {
    const product = products[Math.floor(Math.random() * products.length)];
    const qty = Math.random() < 0.3 ? 2 : 1;
    const unitPrice = 20 + Math.random() * 200;
    const totalPrice = (unitPrice * qty).toFixed(2);
    const destCountry = DEST_COUNTRIES[Math.floor(Math.random() * DEST_COUNTRIES.length)];
    const now = new Date();

    orders.push({
      id: startId + i,
      created_at: now.toISOString(),
      total_price: totalPrice,
      financial_status: Math.random() < 0.85 ? "paid" : "pending",
      productId: product.id,
      shippingCountry: destCountry,
    });

    const existing = productSales.get(product.id) || 0;
    productSales.set(product.id, existing + qty);
  }
  return { orders, productSales };
}

// ─── Main Component ───────────────────────────────────

export default function OverviewPanel(props: OverviewPanelProps) {
  const { data: initialData, currentStore, stores, cogsRate, shippingRate, marketingRate, setCogsRate, setShippingRate, setMarketingRate, totalCostRate, profit, profitMargin, refundRate, refundedOrders, refundAmount, pieData, productRiskMap, countryHolidays, activeCountry, setActiveCountry, countdown, fetchData, handleStoreChange, handleRemoveStore, handleAddStore, handleStartDiagnosis, sheetOpen, setSheetOpen, diagnosing, diagnosis, typewriterText } = props;

  // ── Local reactive state ──
  const [localGmv, setLocalGmv] = useState(initialData.gmv);
  const [localOrderCount, setLocalOrderCount] = useState(initialData.orderCount);
  const [localOrders, setLocalOrders] = useState<Order[]>(initialData.orders);
  const [chartData, setChartData] = useState<ChartPoint[]>(initialData.charts);
  const [localProducts, setLocalProducts] = useState<Product[]>(initialData.products.map((p) => ({ ...p })));
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());

  const nextOrderIdRef = useRef(Math.max(...initialData.orders.map((o) => o.id), 0) + 1);
  const localProductsRef = useRef(localProducts);
  localProductsRef.current = localProducts;

  // Sync from parent on initial data change (store switch / first load)
  const dataRef = useRef(initialData);
  useEffect(() => {
    if (dataRef.current !== initialData) {
      dataRef.current = initialData;
      setLocalGmv(initialData.gmv);
      setLocalOrderCount(initialData.orderCount);
      setLocalOrders(initialData.orders);
      setLocalProducts(initialData.products.map((p) => ({ ...p })));

      // Cap initial chart data at current hour (no future data leak)
      const currentHour = new Date().getHours();
      const capped = initialData.charts.filter(
        (p) => parseInt(p.hour, 10) <= currentHour,
      );
      setChartData(capped);

      nextOrderIdRef.current = Math.max(...initialData.orders.map((o) => o.id), 0) + 1;
      setFlashIds(new Set());
    }
  }, [initialData]);

  // ── 30s heartbeat polling ──
  const chartDataRef = useRef(chartData);
  chartDataRef.current = chartData;

  useEffect(() => {
    const isDemo = !!currentStore?.isDemo;
    const exchangeRate = initialData.exchangeRate;

    const tick = () => {
      // ── Strict current-hour hardware lock ──
      const currentHour = new Date().getHours();

      if (isDemo) {
        const { orders: newOrders, productSales } = generateDemoTickOrders(
          nextOrderIdRef.current, exchangeRate, currentHour,
          localProductsRef.current,
        );
        if (newOrders.length === 0) return;

        nextOrderIdRef.current += newOrders.length;

        // ── Build fresh chart array capped at currentHour ──
        const prevChart = chartDataRef.current;

        // Determine new order sales total added to current hour
        const addedSales = newOrders.reduce(
          (sum, o) => sum + parseFloat(o.total_price) * exchangeRate, 0,
        );

        // Build chart: keep all hours 0..currentHour, zero out future hours
        const updatedChart: ChartPoint[] = [];
        let foundCurrent = false;

        for (let h = 0; h <= currentHour; h++) {
          const existing = prevChart.find((p) => parseInt(p.hour, 10) === h);
          if (h === currentHour) {
            foundCurrent = true;
            updatedChart.push({
              hour: `${String(h).padStart(2, "0")}:00`,
              sales: Math.round(((existing?.sales ?? 0) + addedSales) * 100) / 100,
              count: (existing?.count ?? 0) + newOrders.length,
            });
          } else if (existing) {
            updatedChart.push({ ...existing });
          }
        }

        // If currentHour bucket didn't exist, create it
        if (!foundCurrent) {
          updatedChart.push({
            hour: `${String(currentHour).padStart(2, "0")}:00`,
            sales: Math.round(addedSales * 100) / 100,
            count: newOrders.length,
          });
        }

        setChartData(updatedChart);

        // Update orders: prepend new ones
        const addedGmv = newOrders.reduce(
          (s, o) => s + parseFloat(o.total_price) * exchangeRate, 0,
        );

        setLocalOrders((prev) => [...newOrders, ...prev]);
        setLocalGmv((prev) => prev + addedGmv);
        setLocalOrderCount((prev) => prev + newOrders.length);

        // ── Product sales + inventory live update ──
        if (productSales.size > 0) {
          setLocalProducts((prev) => {
            const updated = prev.map((p) => {
              const qty = productSales.get(p.id);
              if (!qty) return p;
              return {
                ...p,
                totalSold: p.totalSold + qty,
                totalRevenue: p.totalRevenue + (parseFloat(newOrders.find((o) => o.productId === p.id)?.total_price ?? "0") * exchangeRate),
                inventory: Math.max(0, p.inventory - qty),
              };
            });
            // Sort by totalSold descending for live leaderboard
            return [...updated].sort((a, b) => b.totalSold - a.totalSold);
          });
        }

        // Flash tracking
        const ids = new Set<number>();
        for (const o of newOrders) ids.add(o.id);
        setFlashIds(ids);
        setTimeout(() => setFlashIds(new Set()), 1200);
      } else {
        if (currentStore) fetchData(currentStore);
      }
    };

    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [currentStore, initialData.exchangeRate, fetchData]);

  // ── Derived props from data ──
  const { domain, currency, exchangeRate, products, holidaysData, topCountries, lastUpdated } = initialData;

  return (
    <div className="w-full space-y-6">
      {/* Demo Alert */}
      {currentStore?.isDemo && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 backdrop-blur-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm font-medium text-amber-200"><span className="font-semibold">当前处于【演示体验模式】</span>，数据均为虚拟生成。点击右上角「添加新店铺」可以切换到您的真实店铺。</p>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">数据看板</h1>
            <p className="text-sm text-muted-foreground">{domain} &middot; {formatTimeAgo(lastUpdated)}</p>
          </div>
          {stores.length > 0 && (
            <div className="ml-4">
              <Select value={currentStore?.id ?? ""} onValueChange={handleStoreChange}>
                <SelectTrigger size="sm" className="min-w-[200px]">
                  <SelectValue>
                    <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-emerald-400" />{currentStore?.shopName ?? "—"}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (<SelectItem key={s.id} value={s.id}><span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate max-w-[180px]">{s.shopName || s.shopUrl}</span></span></SelectItem>))}
                  <SelectSeparator />
                  <SelectItem value="__add__"><span className="flex items-center gap-2 text-emerald-500"><span>+</span> 添加新店铺</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setSheetOpen(true)} className="relative gap-1.5 overflow-hidden border border-amber-500/40 bg-gradient-to-r from-amber-600/20 to-yellow-600/20 text-amber-300 backdrop-blur-sm hover:from-amber-600/30 hover:text-amber-200">
            <Sparkles className="relative h-3.5 w-3.5" /><span className="relative">AI 智能诊断</span>
          </Button>
          <Button size="sm" onClick={() => exportCSV(localOrders, exchangeRate, initialData.shopName)} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"><Download className="h-3.5 w-3.5" />导出报表</Button>
          <Button variant="outline" size="sm" onClick={handleRemoveStore} className="gap-1.5 text-muted-foreground hover:text-red-500"><LogOut className="h-3.5 w-3.5" />移除店铺</Button>
          <Button variant="outline" size="sm" onClick={() => currentStore && fetchData(currentStore)} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />刷新</Button>

          {/* Heartbeat */}
          <div className="ml-2 flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] text-emerald-400 font-medium whitespace-nowrap">Live · 30s 同步</span>
          </div>
        </div>
      </header>

      {/* Cost Settings Bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-end gap-4 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Coins className="h-3.5 w-3.5" />成本配置 (%)</p>
          {[{ label: "采购成本", value: cogsRate, set: setCogsRate }, { label: "物流运费", value: shippingRate, set: setShippingRate }, { label: "广告成本", value: marketingRate, set: setMarketingRate }].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">{item.label}</label>
              <Input type="number" min={0} max={100} value={item.value} onChange={(e) => item.set(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="h-8 w-16 text-center text-sm" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>合计：{totalCostRate}%</span><span className="text-muted-foreground/50">|</span>
            <span className={profit >= 0 ? "text-emerald-400" : "text-red-400"}>利润率：{totalCostRate < 100 ? profitMargin.toFixed(1) : "—"}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Risk Radar */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm ${refundRate < 1 ? "border-emerald-500/30 bg-emerald-500/10" : refundRate < 1.5 ? "border-amber-500/30 bg-amber-500/10" : "relative overflow-hidden border-red-500/40 bg-red-500/10"}`}>
        {refundRate >= 1.5 && <span className="absolute inset-0 animate-[ai-pulse_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-red-400/5 to-transparent" />}
        {refundRate < 1 ? <ShieldCheck className="relative h-5 w-5 text-emerald-400" /> : refundRate < 1.5 ? <ShieldAlert className="relative h-5 w-5 text-amber-400" /> : <Flame className="relative h-5 w-5 animate-pulse text-red-400" />}
        <div className="relative flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm font-medium ${refundRate < 1 ? "text-emerald-300" : refundRate < 1.5 ? "text-amber-300" : "text-red-300"}`}>
            {refundRate < 1 ? "✓ 今日账户健康度：优秀" : refundRate < 1.5 ? `⚠ 警告：退款率 ${refundRate.toFixed(1)}%，接近风险红线` : `🔥 极高风险：退款率 ${refundRate.toFixed(1)}%！暂停广告自查刷单！`}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>退款 {refundedOrders.length}/{localOrderCount} 单</span><span>¥{(refundAmount * exchangeRate).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="今日 GMV（人民币）" value={formatCny(localGmv)} subtitle={`原始货币 ${currency}`} icon={DollarSign} trend="neutral" trendValue={`1 ${currency} = ${formatCny(exchangeRate)}`} accent="emerald" flash={flashIds.size > 0} />
        <KpiCard title="今日订单数" value={`${localOrderCount} 单`} subtitle={`1 ${currency} = ¥${exchangeRate}`} icon={ShoppingCart} trend="neutral" trendValue="" accent="sky" />
        <KpiCard title="预计纯利润" value={formatCny(profit)} subtitle={`成本 ${totalCostRate}%`} icon={Wallet} trend={profit >= 0 ? "up" : "down"} trendValue={profit >= 0 ? "盈利中" : "亏损"} accent={profit >= 0 ? "emerald" : "violet"} />
        <KpiCard title="预计毛利率" value={totalCostRate < 100 ? `${profitMargin.toFixed(1)}%` : "—"} subtitle="扣除采购/物流/广告" icon={Receipt} trend={profit >= 0 ? "up" : "down"} trendValue={`${currency} ${(profit / exchangeRate).toFixed(2)}`} accent={profit >= 0 ? "emerald" : "violet"} />
      </div>

      {/* Holiday Countdown */}
      {topCountries.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-lg backdrop-blur-lg ring-1 ring-amber-500/10">
          <CardContent className="py-4">
            <Tabs value={activeCountry} onValueChange={setActiveCountry}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Calendar className="h-4 w-4 text-amber-400" />全球商机倒计时</p>
                  <TabsList className="mt-2 h-8">
                    {topCountries.map((code) => (
                      <TabsTrigger key={code} value={code} className="gap-1.5 px-3 text-xs">
                        {code === "US" ? "🇺🇸" : code === "GB" ? "🇬🇧" : code === "DE" ? "🇩🇪" : code === "JP" ? "🇯🇵" : code === "SE" ? "🇸🇪" : code === "FR" ? "🇫🇷" : code === "CA" ? "🇨🇦" : code === "AU" ? "🇦🇺" : code === "CN" ? "🇨🇳" : ""} {code}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {countryHolidays[activeCountry] ? (
                  <div className="flex items-center gap-4">
                    <div className="text-right"><p className="text-sm font-semibold text-amber-300">{countryHolidays[activeCountry]!.localName} ({countryHolidays[activeCountry]!.name})</p><p className="text-xs text-muted-foreground">{countryHolidays[activeCountry]!.date}</p></div>
                    <Clock className="h-5 w-5 animate-pulse text-amber-400" />
                    <div className="flex items-center gap-3">
                      {[{ label: "天", value: countdown.days }, { label: "时", value: countdown.hours }, { label: "分", value: countdown.minutes }, { label: "秒", value: countdown.seconds }].map((u, i, arr) => (
                        <span key={u.label} className="flex items-center gap-3">
                          {i > 0 && <span className="text-lg font-light text-muted-foreground">:</span>}
                          <div className="text-center"><span className="block text-2xl font-bold tabular-nums text-amber-300">{String(u.value).padStart(2, "0")}</span><span className="text-xs text-muted-foreground">{u.label}</span></div>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">当前国家近期无重大节日，建议保持日常广告投放预算</p>}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader><CardTitle>当天实时销量走势</CardTitle><CardDescription>展示今日 00:00 截止当前时间点的实时销售额波动，未来时段保持留白</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs><linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `¥${v}`} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} fill="url(#salesGradient)" dot={false} isAnimationActive={true} animationDuration={600} activeDot={{ r: 5, fill: "#10b981", stroke: "oklch(0.145 0 0)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader><CardTitle className="text-base">利润构成</CardTitle><CardDescription>成本 + 利润占比</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">{pieData.map((e, i) => (<Cell key={`c-${i}`} fill={e.color} />))}</Pie>
                  <Tooltip formatter={(v: unknown) => formatCny(Number(v) || 0)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: "oklch(0.708 0 0)", fontSize: "12px" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-muted-foreground" />热销商品 Top {localProducts.length}</CardTitle>
          <CardDescription>今日销量排名 · 新订单实时置顶插入</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-12">#</TableHead><TableHead>商品</TableHead><TableHead className="text-right">销量</TableHead><TableHead className="text-right">销售额 (CNY)</TableHead><TableHead className="text-right">库存</TableHead><TableHead className="text-right w-24">库存状态</TableHead><TableHead className="text-right w-28">风控评级</TableHead></TableRow></TableHeader>
            <TableBody>
              {localProducts.map((p, i) => {
                const badge = getInventoryBadge(p.inventory);
                const risk = productRiskMap.get(p.id);
                const isFlash = flashIds.size > 0 && i < 2;
                return (
                  <TableRow key={p.id} className={`group transition-all duration-700 hover:bg-muted/30 ${isFlash ? "animate-pulse bg-emerald-500/10" : ""}`}>
                    <TableCell className="font-medium text-muted-foreground">{String(i + 1).padStart(2, "0")}</TableCell>
                    <TableCell><div className="flex items-center gap-3">{p.image ? <img src={p.image} alt={p.title} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/30" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-border/30"><Package className="h-4 w-4 text-muted-foreground" /></div>}<span className="max-w-[220px] truncate font-medium text-foreground">{p.title}</span></div></TableCell>
                    <TableCell className="text-right tabular-nums">{p.totalSold}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-500">{formatCny(p.totalRevenue * exchangeRate)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.inventory}</TableCell>
                    <TableCell className="text-right">{badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <span className="text-xs text-muted-foreground">库存充足</span>}</TableCell>
                    <TableCell className="text-right">
                      {risk?.level === "高危欺诈" ? <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-red-400 bg-red-500/10 ring-red-500/20"><ShieldX className="h-3 w-3" />高危欺诈</span>
                        : risk?.level === "需关注" ? <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-amber-400 bg-amber-500/10 ring-amber-500/20"><ShieldAlert className="h-3 w-3" />需关注</span>
                        : <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-emerald-400 bg-emerald-500/10 ring-emerald-500/20"><ShieldCheck className="h-3 w-3" />低风险</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Diagnosis Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg border-l border-border/40 bg-card/95 backdrop-blur-xl">
          <SheetHeader className="border-b border-border/30 pb-4">
            <SheetTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-amber-400" />AI 跨境操盘手智能诊断</SheetTitle>
            <SheetDescription>{currentStore?.isDemo ? "演示模式" : "基于今日数据的智能分析"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {!diagnosing && !diagnosis && (
              <div className="flex flex-col items-center gap-6 py-10">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20"><span className="text-3xl">🧠</span></div>
                <p className="text-base font-medium text-foreground">准备分析 {initialData.shopName}</p>
                <Button size="lg" onClick={handleStartDiagnosis} className="gap-2 bg-amber-600 text-white hover:bg-amber-500"><Sparkles className="h-4 w-4" />开始诊断</Button>
                {!currentStore?.isDemo && (
                  <div className="mt-4 w-full rounded-lg border border-border/30 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">💡 想要真正的 AI 实时诊断？</p>
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/70">{"// .env.local\nDEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx"}</pre>
                  </div>
                )}
              </div>
            )}
            {diagnosing && (
              <div className="flex flex-col items-center gap-5 py-16">
                <div className="relative flex h-16 w-16 items-center justify-center"><div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-500" /><span className="relative text-2xl">🤖</span></div>
                <p className="text-sm font-medium text-foreground">{typewriterText}</p>
              </div>
            )}
            {!diagnosing && diagnosis && (
              <div className="space-y-6">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">风险等级：</span><Badge variant={diagnosis.riskLevel === "high" ? "destructive" : diagnosis.riskLevel === "medium" ? "default" : "outline"} className={diagnosis.riskLevel === "high" ? "bg-red-500/20 text-red-400" : diagnosis.riskLevel === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}>{diagnosis.riskLevel === "high" ? "高风险" : diagnosis.riskLevel === "medium" ? "中等风险" : "低风险"}</Badge></div>
                <div className="rounded-lg border border-border/30 bg-muted/20 p-4">{diagnosis.overview.split("\n").map((l, i) => l.startsWith("## ") ? <h3 key={i} className="mb-2 text-sm font-semibold text-foreground">{l.replace("## ", "")}</h3> : <p key={i} className="my-1 text-sm text-muted-foreground">{l}</p>)}</div>
                <div className="rounded-lg border border-border/30 bg-muted/20 p-4">{diagnosis.conversionAnalysis.split("\n").map((l, i) => l.startsWith("## ") ? <h3 key={i} className="mb-2 text-sm font-semibold text-foreground">{l.replace("## ", "")}</h3> : <p key={i} className="my-1 text-sm text-muted-foreground">{l}</p>)}</div>
                {diagnosis.inventoryAlerts.map((a, i) => <div key={i} className={`rounded-lg border p-4 ${a.startsWith("## 🔴") ? "border-red-500/20 bg-red-500/5" : a.startsWith("## 🟡") ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>{a.split("\n").map((l, j) => l.startsWith("## ") ? <h3 key={j} className="mb-2 text-sm font-semibold text-foreground">{l.replace(/^##\s*/, "")}</h3> : l.startsWith("> ") ? <p key={j} className="my-1 border-l-2 border-border/30 pl-3 text-sm italic text-muted-foreground">{l.replace("> ", "")}</p> : l ? <p key={j} className="my-1 text-sm text-muted-foreground">{l}</p> : null)}</div>)}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">{diagnosis.recommendations.map((r, i) => <div key={i} className="mb-4 last:mb-0">{r.split("\n").map((l, j) => l.startsWith("## ") ? <h3 key={j} className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">{l.replace(/^##\s*/, "")}</h3> : l.startsWith("### ") ? <h4 key={j} className="mb-1 mt-2 text-sm font-medium text-amber-300">{l.replace("### ", "")}</h4> : l.startsWith("> ") ? <p key={j} className="my-1 border-l-2 border-amber-500/20 pl-3 text-sm italic text-muted-foreground">{l.replace("> ", "")}</p> : <p key={j} className="my-1 text-sm text-muted-foreground">{l}</p>)}</div>)}</div>
              </div>
            )}
          </div>
          <SheetFooter className="border-t border-border/30 pt-4">
            <p className="text-center text-xs text-muted-foreground">{currentStore?.isDemo ? "演示数据仅供体验" : "Powered by DeepSeek · 本地运行"}</p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────

function exportCSV(orders: Order[], rate: number, shopName: string) {
  const PAY: Record<string, string> = { paid: "已支付", pending: "待处理", authorized: "已授权", refunded: "已退款", voided: "已作废" };
  const header = ["订单ID", "下单时间（北京时间）", "美元金额 (USD)", "人民币金额 (CNY)", "付款状态"];
  const rows = orders.map((o) => {
    const t = new Date(new Date(o.created_at).getTime() + 8 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
    return [String(o.id), t, parseFloat(o.total_price).toFixed(2), (parseFloat(o.total_price) * rate).toFixed(2), (PAY[o.financial_status] ?? o.financial_status) || "未知"].join(",");
  });
  const blob = new Blob(["\uFEFF" + [header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const d = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `Shopify_今日财务报表_${shopName}_${d}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
