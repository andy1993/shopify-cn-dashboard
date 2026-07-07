"use client";

import { Coins, Wallet, Receipt, DollarSign } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCny } from "../helpers";

// ─── Types ────────────────────────────────────────────

interface FinancePanelProps {
  shopName: string;
  currency: string;
  exchangeRate: number;
  gmv: number;
  cogsRate: number; setCogsRate: (v: number) => void;
  shippingRate: number; setShippingRate: (v: number) => void;
  marketingRate: number; setMarketingRate: (v: number) => void;
  totalCostRate: number;
  profit: number;
  profitMargin: number;
  pieData: Array<{ name: string; value: number; color: string }>;
}

// ─── Sub-component ────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, trend, trendValue, accent }: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: "up" | "down" | "neutral"; trendValue: string;
  accent?: "emerald" | "sky" | "amber" | "violet";
}) {
  const a = { emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20", amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20", violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20" };
  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60 hover:shadow-xl">
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-base font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>{trendValue}</span>
              <span className="text-sm text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${a[accent ?? "emerald"]}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Panel ─────────────────────────────────────────────

export default function FinancePanel(props: FinancePanelProps) {
  const { shopName, currency, exchangeRate, gmv, cogsRate, setCogsRate, shippingRate, setShippingRate, marketingRate, setMarketingRate, totalCostRate, profit, profitMargin, pieData } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Coins className="h-6 w-6 text-amber-400" />
          供应链对账
        </h2>
        <p className="mt-1 text-base text-muted-foreground">精细化成本核算与利润分析 · {shopName}</p>
      </div>

      {/* Cost Settings */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-base">成本参数配置</CardTitle>
          <CardDescription>拖动滑块调整各项成本占比，实时查看利润变化</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[{ label: "采购成本", value: cogsRate, set: setCogsRate, max: 60, accent: "accent-emerald-500" },
              { label: "物流运费", value: shippingRate, set: setShippingRate, max: 40, accent: "accent-amber-500" },
              { label: "广告成本", value: marketingRate, set: setMarketingRate, max: 50, accent: "accent-blue-500" }].map((item) => (
              <div key={item.label} className="space-y-2">
                <label className="text-base font-medium text-foreground">{item.label} ({item.value}%)</label>
                <input type="range" min={0} max={item.max} value={item.value} onChange={(e) => item.set(Number(e.target.value))} className={`w-full ${item.accent}`} />
                <Input type="number" min={0} max={100} value={item.value} onChange={(e) => item.set(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="h-9 font-mono text-sm" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2 text-base">
            <span className="text-muted-foreground">合计成本占比</span>
            <span className="font-semibold text-foreground">{totalCostRate}%</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-muted-foreground">预计纯利润</span>
            <span className={profit >= 0 ? "font-bold text-emerald-400" : "font-bold text-red-400"}>{formatCny(profit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <KpiCard title="预计纯利润" value={formatCny(profit)} subtitle={`成本合计 ${totalCostRate}%`} icon={Wallet} trend={profit >= 0 ? "up" : "down"} trendValue={profit >= 0 ? "盈利中" : "亏损警告"} accent={profit >= 0 ? "emerald" : "violet"} />
        <KpiCard title="预计毛利率" value={totalCostRate < 100 ? `${profitMargin.toFixed(1)}%` : "—"} subtitle="扣除采购/物流/广告" icon={Receipt} trend={profit >= 0 ? "up" : "down"} trendValue={`${currency} ${(profit / exchangeRate).toFixed(2)}`} accent={profit >= 0 ? "emerald" : "violet"} />
        <KpiCard title="今日 GMV" value={formatCny(gmv)} subtitle={`原始货币 ${currency}`} icon={DollarSign} trend="neutral" trendValue={`1 ${currency} = ¥${exchangeRate}`} accent="emerald" />
      </div>

      {/* Pie Chart */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle>利润构成分析</CardTitle>
          <CardDescription>四色占比分布：采购 · 物流 · 广告 · 纯利</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  label={({ name: n, percent: p }: { name?: string; percent?: number }) => `${n ?? ""} ${((p ?? 0) * 100).toFixed(1)}%`}
                >
                  {pieData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                </Pie>
                <Tooltip formatter={(value: unknown) => formatCny(Number(value) || 0)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
