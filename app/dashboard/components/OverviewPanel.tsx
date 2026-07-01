"use client";

import { useState } from "react";
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
  id: string;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  isDemo?: boolean;
}

interface DashboardData {
  success: true;
  shopName: string;
  domain: string;
  currency: string;
  exchangeRate: number;
  gmv: number;
  orderCount: number;
  charts: Array<{ hour: string; sales: number }>;
  products: Array<{
    id: number; title: string; image: string | null;
    totalSold: number; totalRevenue: number; inventory: number;
  }>;
  orders: Array<{ id: number; created_at: string; total_price: string; financial_status: string }>;
  holidaysData: Record<string, Array<{ date: string; localName: string; name: string; countryCode: string }>>;
  topCountries: string[];
  lastUpdated: string;
}

interface Holiday { date: string; localName: string; name: string; countryCode: string; }
interface DiagnosisReport { overview: string; conversionAnalysis: string; inventoryAlerts: string[]; recommendations: string[]; riskLevel: "low" | "medium" | "high"; }

interface OverviewPanelProps {
  data: DashboardData;
  currentStore: StoreEntry | null;
  stores: StoreEntry[];
  // Cost
  cogsRate: number; shippingRate: number; marketingRate: number;
  setCogsRate: (v: number) => void; setShippingRate: (v: number) => void; setMarketingRate: (v: number) => void;
  totalCostRate: number; profit: number; profitMargin: number;
  // Refund
  refundRate: number; refundedOrders: Array<{ id: number; total_price: string }>; refundAmount: number;
  // Charts
  computedCharts: Array<{ hour: string; count: number; sales: number }>;
  pieData: Array<{ name: string; value: number; color: string }>;
  // Risk map
  productRiskMap: Map<number, { level: string }>;
  // Holiday
  countryHolidays: Record<string, Holiday | null>;
  activeCountry: string; setActiveCountry: (v: string) => void;
  countdown: { days: number; hours: number; minutes: number; seconds: number };
  // Handlers
  fetchData: (store: StoreEntry) => void;
  handleStoreChange: (id: string | null) => void;
  handleRemoveStore: () => void;
  handleAddStore: () => void;
  handleStartDiagnosis: () => void;
  // Sheet
  sheetOpen: boolean; setSheetOpen: (v: boolean) => void;
  diagnosing: boolean;
  diagnosis: DiagnosisReport | null;
  typewriterText: string;
}

// ─── Sub-components ───────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, trend, trendValue, accent }: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: "up" | "down" | "neutral"; trendValue: string;
  accent?: "emerald" | "sky" | "amber" | "violet";
}) {
  const a = { emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20", amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20", violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20" };
  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card/60 shadow-lg shadow-black/5 backdrop-blur-lg transition-all hover:border-border/60 hover:shadow-xl">
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatCny(payload[0].value)}</p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────

export default function OverviewPanel(props: OverviewPanelProps) {
  const { data, currentStore, stores, cogsRate, shippingRate, marketingRate, setCogsRate, setShippingRate, setMarketingRate, totalCostRate, profit, profitMargin, refundRate, refundedOrders, refundAmount, computedCharts, pieData, productRiskMap, countryHolidays, activeCountry, setActiveCountry, countdown, fetchData, handleStoreChange, handleRemoveStore, handleAddStore, handleStartDiagnosis, sheetOpen, setSheetOpen, diagnosing, diagnosis, typewriterText } = props;
  const { domain, currency, exchangeRate, gmv, orderCount, products, orders, holidaysData, topCountries, lastUpdated } = data;

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
          <Button size="sm" onClick={() => exportCSV(orders, exchangeRate, data.shopName)} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"><Download className="h-3.5 w-3.5" />导出报表</Button>
          <Button variant="outline" size="sm" onClick={handleRemoveStore} className="gap-1.5 text-muted-foreground hover:text-red-500"><LogOut className="h-3.5 w-3.5" />移除店铺</Button>
          <Button variant="outline" size="sm" onClick={() => currentStore && fetchData(currentStore)} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
        </div>
      </header>

      {/* Cost Settings Bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-end gap-4 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Coins className="h-3.5 w-3.5" />成本配置 (%)</p>
          {[{ label: "采购成本", value: cogsRate, set: setCogsRate }, { label: "物流运费", value: shippingRate, set: setShippingRate }, { label: "广告成本", value: marketingRate, set: setMarketingRate }].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">{item.label}</label>
              <Input type="number" min={0} max={100} value={item.value} onChange={(e) => item.set(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="h-8 w-16 text-center text-sm" /><span className="text-xs text-muted-foreground">%</span>
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
            <span>退款 {refundedOrders.length}/{orderCount} 单</span><span>¥{(refundAmount * exchangeRate).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="今日 GMV（人民币）" value={formatCny(gmv)} subtitle={`原始货币 ${currency}`} icon={DollarSign} trend="neutral" trendValue={`1 ${currency} = ${formatCny(exchangeRate)}`} accent="emerald" />
        <KpiCard title="今日订单数" value={`${orderCount} 单`} subtitle={`1 ${currency} = ¥${exchangeRate}`} icon={ShoppingCart} trend="neutral" trendValue="" accent="sky" />
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
                      {[{ label: "天", value: countdown.days }, { label: "时", value: countdown.hours }, { label: "分", value: countdown.minutes }, { label: "秒", value: countdown.seconds }].map((unit, i, arr) => (
                        <span key={unit.label} className="flex items-center gap-3">
                          {i > 0 && <span className="text-lg font-light text-muted-foreground">:</span>}
                          <div className="text-center"><span className="block text-2xl font-bold tabular-nums text-amber-300">{String(unit.value).padStart(2, "0")}</span><span className="text-xs text-muted-foreground">{unit.label}</span></div>
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
          <CardHeader><CardTitle>24 小时销量走势</CardTitle><CardDescription>北京时间 (UTC+8) 每小时分组 &middot; 金额已换算人民币</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={computedCharts} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs><linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 12, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `¥${v}`} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} fill="url(#salesGradient)" dot={false} activeDot={{ r: 4, fill: "#10b981", stroke: "oklch(0.145 0 0)", strokeWidth: 2 }} />
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
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-muted-foreground" />热销商品 Top {products.length}</CardTitle>
          <CardDescription>今日销量排名前 {products.length} 的商品</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-12">#</TableHead><TableHead>商品</TableHead><TableHead className="text-right">销量</TableHead><TableHead className="text-right">销售额 (CNY)</TableHead><TableHead className="text-right">库存</TableHead><TableHead className="text-right w-24">库存状态</TableHead><TableHead className="text-right w-28">风控评级</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.map((p, i) => {
                const badge = getInventoryBadge(p.inventory);
                const risk = productRiskMap.get(p.id);
                return (
                  <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
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
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <span className="text-3xl">🧠</span>
                </div>
                <p className="text-base font-medium text-foreground">准备分析 {data.shopName}</p>
                <Button size="lg" onClick={handleStartDiagnosis} className="gap-2 bg-amber-600 text-white hover:bg-amber-500"><Sparkles className="h-4 w-4" />开始诊断</Button>
                {!currentStore?.isDemo && (
                  <div className="mt-4 w-full rounded-lg border border-border/30 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">💡 想要真正的 AI 实时诊断？</p>
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/70">{"// .env.local\nDEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx\n// POST /api/ai/diagnose"}</pre>
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

// ─── CSV Export (inline) ───────────────────────────────

function exportCSV(orders: Array<{ id: number; created_at: string; total_price: string; financial_status: string }>, rate: number, shopName: string) {
  const PAY: Record<string, string> = { paid: "已支付", pending: "待处理", authorized: "已授权", partially_paid: "部分支付", partially_refunded: "部分退款", refunded: "已退款", voided: "已作废" };
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
