"use client";

import { useState, useMemo } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingDown,
  Wallet,
  Landmark,
  Settings,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
  gateway?: string;
}

interface GatewayStat {
  gateway: string;
  label: string;
  color: string;
  iconColor: string;
  bgColor: string;
  orderCount: number;
  totalRevenue: number; // USD
  feeRate: number;
  feeFixed: number;
  feeAmount: number; // USD
  netAmount: number; // CNY after fee
}

interface GatewayFinancePanelProps {
  orders: Order[];
  exchangeRate?: number;
  currency: string;
  isDemo: boolean;
  shopName: string;
}

// ─── Gateway config ───────────────────────────────────

const GATEWAY_CONFIG: Record<string, { label: string; color: string; iconColor: string; bgColor: string }> = {
  stripe: { label: "Stripe", color: "#635bff", iconColor: "text-indigo-400", bgColor: "bg-indigo-500/10 ring-indigo-500/20" },
  paypal: { label: "PayPal", color: "#009cde", iconColor: "text-sky-400", bgColor: "bg-sky-500/10 ring-sky-500/20" },
};

// ─── Sub-components ───────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, accent, highlight }: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "red" | "sky" | "amber";
  highlight?: boolean;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  };
  return (
    <Card className={`group relative overflow-hidden border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60 ${highlight ? "ring-1 ring-red-500/20" : ""}`}>
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold tracking-tight ${highlight ? "text-red-400" : "text-foreground"}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${colors[accent]}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Data processing ──────────────────────────────────

function isPaidOrder(o: Order): boolean {
  return o.financial_status === "paid" || o.financial_status === "authorized" || o.financial_status === "partially_paid" || o.financial_status === "";
}

function assignGateway(order: Order, index: number, isDemo: boolean): string {
  if (order.gateway) {
    const gw = order.gateway.toLowerCase();
    // Case-insensitive matching for Shopify gateway naming variants
    if (gw.includes("stripe") || gw.includes("shopify_payments")) return "stripe";
    if (gw.includes("paypal")) return "paypal";
    return gw;
  }
  if (isDemo) {
    // Deterministic assignment based on order index for consistent demo data
    return index % 5 < 3 ? "stripe" : "paypal"; // 60% Stripe, 40% PayPal
  }
  return "stripe"; // fallback for real stores without gateway field
}

// ─── Main Component ───────────────────────────────────

export default function GatewayFinancePanel({
  orders,
  exchangeRate = EXCHANGE_RATE,
  currency,
  isDemo,
  shopName,
}: GatewayFinancePanelProps) {
  // ── Rate state ──
  const [stripeRate, setStripeRate] = useState(3.4);
  const [stripeFixed, setStripeFixed] = useState(0.3);
  const [paypalRate, setPaypalRate] = useState(4.4);
  const [paypalFixed, setPaypalFixed] = useState(0.3);

  // ── Derived calculations ──
  const gatewayStats = useMemo(() => {
    const paid = orders.filter(isPaidOrder);
    const map = new Map<string, { orders: number; revenue: number }>();

    for (let i = 0; i < paid.length; i++) {
      const gw = assignGateway(paid[i], i, isDemo);
      const existing = map.get(gw) ?? { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += parseFloat(paid[i].total_price) || 0;
      map.set(gw, existing);
    }

    const stats: GatewayStat[] = [];
    for (const [gw, data] of map) {
      const config = GATEWAY_CONFIG[gw] ?? { label: gw, color: "#6b7280", iconColor: "text-zinc-400", bgColor: "bg-zinc-500/10" };
      const rate = gw === "stripe" ? stripeRate / 100 : paypalRate / 100;
      const fixed = gw === "stripe" ? stripeFixed : paypalFixed;
      // Fee = (revenue × rate%) + fixed fee per order
      const perOrderFee = data.revenue * rate;
      const totalFixedFee = fixed * data.orders;
      const feeAmount = perOrderFee + totalFixedFee;
      const netAmount = (data.revenue - feeAmount) * exchangeRate;

      stats.push({
        gateway: gw,
        label: config.label,
        color: config.color,
        iconColor: config.iconColor,
        bgColor: config.bgColor,
        orderCount: data.orders,
        totalRevenue: data.revenue,
        feeRate: rate * 100,
        feeFixed: fixed,
        feeAmount,
        netAmount,
      });
    }

    return stats.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders, stripeRate, stripeFixed, paypalRate, paypalFixed, isDemo, exchangeRate]);

  const totalFeeUsd = gatewayStats.reduce((s, g) => s + g.feeAmount, 0);
  const totalFeeCny = totalFeeUsd * exchangeRate;
  const totalRevenueUsd = gatewayStats.reduce((s, g) => s + g.totalRevenue, 0);
  const netRevenueCny = totalRevenueUsd * exchangeRate - totalFeeCny;

  // Donut chart data
  const donutData = gatewayStats.map((g) => ({
    name: g.label,
    value: Math.round(g.netAmount * 100) / 100,
    color: g.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Landmark className="h-6 w-6 text-amber-400" />
          多币种网关对账
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {shopName} · Stripe / PayPal 手续费对比与净结汇分析
          {isDemo && <span className="ml-2 text-xs text-amber-400">(Demo: 60% Stripe · 40% PayPal)</span>}
        </p>
      </div>

      {/* Rate Config Bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-end gap-6 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />费率配置
          </p>

          {/* Stripe */}
          <div className="flex items-end gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-indigo-400">Stripe</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">费率%</label>
              <Input type="number" step={0.1} min={0} max={10} value={stripeRate} onChange={(e) => setStripeRate(Number(e.target.value) || 0)} className="h-8 w-16 text-center text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">固定 $</label>
              <Input type="number" step={0.01} min={0} max={1} value={stripeFixed} onChange={(e) => setStripeFixed(Number(e.target.value) || 0)} className="h-8 w-16 text-center text-sm" />
            </div>
          </div>

          {/* PayPal */}
          <div className="flex items-end gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
            <span className="text-xs font-semibold text-sky-400">PayPal</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">费率%</label>
              <Input type="number" step={0.1} min={0} max={10} value={paypalRate} onChange={(e) => setPaypalRate(Number(e.target.value) || 0)} className="h-8 w-16 text-center text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">固定 $</label>
              <Input type="number" step={0.01} min={0} max={1} value={paypalFixed} onChange={(e) => setPaypalFixed(Number(e.target.value) || 0)} className="h-8 w-16 text-center text-sm" />
            </div>
          </div>

          <div className="ml-auto text-xs text-muted-foreground">
            汇率 1 {currency} = ¥{exchangeRate}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="今日网关手续费"
          value={formatCny(totalFeeCny)}
          subtitle={`${totalFeeUsd.toFixed(2)} USD × ¥${exchangeRate}`}
          icon={TrendingDown}
          accent="red"
          highlight
        />
        <KpiCard
          title="网关预计净结汇"
          value={formatCny(netRevenueCny)}
          subtitle={`GMV ¥${formatCny(totalRevenueUsd * exchangeRate)} − 手续费 ¥${formatCny(totalFeeCny)}`}
          icon={Wallet}
          accent="emerald"
        />
        <KpiCard
          title="已收款订单"
          value={`${gatewayStats.reduce((s, g) => s + g.orderCount, 0)} 单`}
          subtitle={`${gatewayStats.length} 个收款渠道`}
          icon={CreditCard}
          accent="sky"
        />
      </div>

      {/* Chart + Table Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Donut Chart (2 cols) */}
        <Card className="lg:col-span-2 border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base">网关占比</CardTitle>
            <CardDescription>各渠道净结汇 (到手 RMB) 占比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCny(Number(value) || 0)} />
                  <Legend
                    formatter={(value: string) => (
                      <span style={{ color: "oklch(0.708 0 0)", fontSize: "12px" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Detail Table (3 cols) */}
        <Card className="lg:col-span-3 border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base">网关明细对账</CardTitle>
            <CardDescription>费率 × 订单数 = 实扣手续费明细</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>渠道</TableHead>
                  <TableHead className="text-right">订单数</TableHead>
                  <TableHead className="text-right">收款总额 (USD)</TableHead>
                  <TableHead className="text-right">费率公式</TableHead>
                  <TableHead className="text-right">手续费 (USD)</TableHead>
                  <TableHead className="text-right">到手 RMB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gatewayStats.map((g) => (
                  <TableRow key={g.gateway} className="group transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="font-medium text-foreground">{g.label}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 border-current/30 ${g.iconColor}`}>
                          {g.gateway.toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.orderCount} 单</TableCell>
                    <TableCell className="text-right tabular-nums">${g.totalRevenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {g.totalRevenue.toFixed(2)} × {g.feeRate.toFixed(1)}% + {g.feeFixed} × {g.orderCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-red-400">${g.feeAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-400">{formatCny(g.netAmount)}</TableCell>
                  </TableRow>
                ))}
                {gatewayStats.length > 0 && (
                  <TableRow className="border-t border-border/30 bg-muted/20">
                    <TableCell className="font-semibold text-foreground">合计</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{gatewayStats.reduce((s, g) => s + g.orderCount, 0)} 单</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">${totalRevenueUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right" />
                    <TableCell className="text-right tabular-nums font-semibold text-red-400">${totalFeeUsd.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-400">{formatCny(netRevenueCny)}</TableCell>
                  </TableRow>
                )}
                {gatewayStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      暂无已收款订单数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
