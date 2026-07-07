"use client";

import { useToast } from "../hooks/useToast";
import ToastBar from "./ToastBar";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  TrendingUp,
  DollarSign,
  Percent,
  BarChart3,
  Activity,
  Banknote,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

// ─── Types ────────────────────────────────────────────

interface Order {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
}

interface AdPerformancePanelProps {
  orders: Order[];
  exchangeRate?: number;
  currency: string;
  isDemo: boolean;
  shopName: string;
}

// ─── KPI Card ─────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  highlight,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "amber" | "sky" | "red";
  highlight?: boolean;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
  };
  return (
    <Card className={`group relative overflow-hidden border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60 ${highlight ? "ring-1 ring-amber-500/20" : ""}`}>
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-base font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${colors[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Combo chart tooltip ──────────────────────────────

function ComboTooltip({
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
      <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-base font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.name === "广告费累计 (RMB)" ? formatCny(entry.value) : formatCny(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

export default function AdPerformancePanel({
  orders,
  exchangeRate = EXCHANGE_RATE,
  currency,
  isDemo,
  shopName,
}: AdPerformancePanelProps) {
  // ── Ad spend state ──
  const [metaSpend, setMetaSpend] = useState(isDemo ? 350 : 0);
  const [googleSpend, setGoogleSpend] = useState(isDemo ? 150 : 0);

  const { toast, showToast } = useToast();

  const totalAdSpendUsd = metaSpend + googleSpend;
  const totalAdSpendCny = totalAdSpendUsd * exchangeRate;

  // ── Sales from real orders ──
  const totalSalesUsd = useMemo(() => {
    return orders
      .filter((o) => o.financial_status === "paid" || o.financial_status === "authorized" || o.financial_status === "")
      .reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
  }, [orders]);

  const totalSalesCny = totalSalesUsd * exchangeRate;

  // ── ROAS & MER ──
  const roas = totalAdSpendUsd > 0 ? (totalSalesUsd / totalAdSpendUsd).toFixed(2) : "—";
  const merPercent = totalAdSpendUsd > 0 ? ((totalAdSpendCny / totalSalesCny) * 100).toFixed(1) : "—";

  // ── Per-hour data for combo chart ──
  const hourlyChartData = useMemo(() => {
    const currentHour = new Date().getHours();
    const salesBuckets = new Array(24).fill(0);
    for (const order of orders) {
      if (order.financial_status !== "paid" && order.financial_status !== "authorized" && order.financial_status !== "") continue;
      const h = (new Date(order.created_at).getUTCHours() + 8) % 24;
      if (h > currentHour) continue;
      salesBuckets[h] += (parseFloat(order.total_price) || 0) * exchangeRate;
    }

    // Distribute ad spend proportionally across passing hours
    const totalHourlySales = salesBuckets.reduce((a, b) => a + b, 0);
    let cumulativeAd = 0;
    return Array.from({ length: currentHour + 1 }, (_, h) => {
      const hourFraction = totalHourlySales > 0 ? salesBuckets[h] / totalHourlySales : 1 / (currentHour + 1);
      cumulativeAd += totalAdSpendCny * hourFraction;
      return {
        hour: `${String(h).padStart(2, "0")}:00`,
        sales: Math.round(salesBuckets[h] * 100) / 100,
        adCumulative: Math.round(cumulativeAd * 100) / 100,
      };
    });
  }, [orders, totalAdSpendCny, exchangeRate]);

  // ── Demo heartbeat: random ad spend increase ──
  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;

  useEffect(() => {
    if (!isDemo) return;
    const tick = () => {
      if (Math.random() >= 0.5) return;
      const amount = 3 + Math.random() * 2; // $3-$5
      if (Math.random() < 0.5) {
        setMetaSpend((prev) => prev + amount);
      } else {
        setGoogleSpend((prev) => prev + amount);
      }
    };
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [isDemo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <BarChart3 className="h-6 w-6 text-amber-400" />
          广告成效分析
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          {shopName} · Meta / Google 多渠道投放成效与 MER 营销效率追踪
          {isDemo && <span className="ml-2 text-sm text-amber-400">(Demo: 广告费每 30s 随机上涨 $3-$5)</span>}
        </p>
      </div>

      {/* Ad Spend Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-sky-500/20 bg-sky-500/5 shadow-lg backdrop-blur-lg ring-1 ring-sky-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-sky-400" />
              Meta Ads 广告消耗
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-sky-400">$</span>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={Math.round(metaSpend)}
                  onChange={(e) => setMetaSpend(Number(e.target.value) || 0)}
                  disabled={isDemo}
                  className="h-12 w-32 text-center text-2xl font-bold tabular-nums"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {isDemo ? "Demo 自动递增" : "手动输入今日消耗"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg backdrop-blur-lg ring-1 ring-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-400" />
              Google Ads 广告消耗
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold tabular-nums text-emerald-400">$</span>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={Math.round(googleSpend)}
                  onChange={(e) => setGoogleSpend(Number(e.target.value) || 0)}
                  disabled={isDemo}
                  className="h-12 w-32 text-center text-2xl font-bold tabular-nums"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {isDemo ? "Demo 自动递增" : "手动输入今日消耗"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="广告总消耗 (RMB)"
          value={formatCny(totalAdSpendCny)}
          subtitle={`$${totalAdSpendUsd.toFixed(0)} USD × ¥${exchangeRate}`}
          icon={DollarSign}
          accent="amber"
        />
        <KpiCard
          title="实时综合 ROAS"
          value={roas === "—" ? "—" : `${roas}x`}
          subtitle={roas === "—" ? "广告费为 0，无法计算" : `投入 $1 产出 $${roas}`}
          icon={TrendingUp}
          accent="emerald"
          highlight={roas !== "—" && Number(roas) >= 2}
        />
        <KpiCard
          title="营销 MER %"
          value={merPercent === "—" ? "—" : `${merPercent}%`}
          subtitle={merPercent === "—" ? "广告费为 0" : merPercent && Number(merPercent) < 30 ? "预算利用健康" : "广告成本占比偏高"}
          icon={Percent}
          accent={merPercent === "—" ? "sky" : Number(merPercent) < 30 ? "emerald" : "red"}
        />
      </div>

      {/* Combo Chart */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-base">每小时营收 vs 累计广告费</CardTitle>
          <CardDescription>
            柱状图 (左轴) = 每小时销售额 · 折线 (右轴) = 累计广告投入 · 严格截断于当前小时
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hourlyChartData.length > 0 ? (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} interval={3} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCny(v)} width={70} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "oklch(0.708 0 0)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCny(v)} width={70} />
                  <Tooltip content={<ComboTooltip />} />
                  <Legend formatter={(value: string) => (<span style={{ color: "oklch(0.708 0 0)", fontSize: "11px" }}>{value}</span>)} />
                  <Bar yAxisId="left" dataKey="sales" name="每小时销售 (RMB)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="adCumulative" name="广告费累计 (RMB)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-base text-muted-foreground">
              暂无销售数据，请等待订单产生后图表将自动渲染
            </div>
          )}
        </CardContent>
      </Card>
      <ToastBar message={toast} />
    </div>
  );
}
