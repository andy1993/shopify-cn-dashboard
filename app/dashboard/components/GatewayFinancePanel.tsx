"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingDown,
  Wallet,
  Landmark,
  Settings,
  Sparkles,
  Zap,
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
import { Button } from "@/components/ui/button";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

// ─── Types ────────────────────────────────────────────

interface Order {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  gateway?: string;
  currency?: string;
}

interface GatewayStat {
  gateway: string;
  label: string;
  color: string;
  iconColor: string;
  currency: string;
  currencyLabel: string;
  rate: number;
  orderCount: number;
  totalRevenue: number; // in transaction currency
  revenueCny: number;
  feeRate: number;
  feeFixed: number;
  feeAmount: number; // in transaction currency
  feeCny: number;
  netCny: number;
}

interface GatewayFinancePanelProps {
  orders: Order[];
  exchangeRate?: number;
  currency: string;
  isDemo: boolean;
  shopName: string;
}

// ─── Constants ─────────────────────────────────────────

const CURRENCY_MAP: Record<string, { label: string; rate: number }> = {
  USD: { label: "美元", rate: 7.25 },
  EUR: { label: "欧元", rate: 7.85 },
  CAD: { label: "加元", rate: 5.30 },
  GBP: { label: "英镑", rate: 9.15 },
};

function getCurrencyRate(code?: string): { rate: number; label: string } {
  if (!code) return { rate: 7.25, label: "美元" };
  const c = CURRENCY_MAP[code.toUpperCase()];
  return c ?? { rate: 7.25, label: code.toUpperCase() };
}

function getCurrencyFlag(code: string): string {
  const f: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", CAD: "🇨🇦", GBP: "🇬🇧" };
  return f[code.toUpperCase()] ?? code.toUpperCase();
}

const GATEWAY_CONFIG: Record<string, { label: string; color: string; iconColor: string }> = {
  stripe: { label: "Stripe", color: "#635bff", iconColor: "text-indigo-400" },
  paypal: { label: "PayPal", color: "#009cde", iconColor: "text-sky-400" },
};

function getGatewayConfig(gw: string) {
  return GATEWAY_CONFIG[gw] ?? { label: gw, color: "#6b7280", iconColor: "text-zinc-400" };
}

// ─── Sub-components ───────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, accent, highlight }: {
  title: string; value: string; subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "red" | "sky" | "amber";
  highlight?: boolean;
}) {
  const colors: Record<string, string> = {
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
            <p className="text-base font-medium text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold tracking-tight ${highlight ? "text-red-400" : "text-foreground"}`}>{value}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
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

function resolveGateway(order: Order, index: number, isDemo: boolean): string {
  if (order.gateway) {
    const gw = order.gateway.toLowerCase();
    if (gw.includes("stripe") || gw.includes("shopify_payments")) return "stripe";
    if (gw.includes("paypal")) return "paypal";
    return gw;
  }
  if (isDemo) {
    return index % 5 < 3 ? "stripe" : "paypal";
  }
  return "stripe";
}

// ─── Main Component ───────────────────────────────────

export default function GatewayFinancePanel({
  orders: initialOrders,
  exchangeRate: usdRate = EXCHANGE_RATE,
  currency,
  isDemo,
  shopName,
}: GatewayFinancePanelProps) {
  // ── Rate presets ──
  const presetStripe = () => { setStripeRate(3.4); setStripeFixed(0.3); };
  const presetPaypal = () => { setPaypalRate(4.4); setPaypalFixed(0.3); };

  const [stripeRate, setStripeRate] = useState(3.4);
  const [stripeFixed, setStripeFixed] = useState(0.3);
  const [paypalRate, setPaypalRate] = useState(4.4);
  const [paypalFixed, setPaypalFixed] = useState(0.3);

  // ── Demo: local orders state for live heartbeat ──
  const [localOrders, setLocalOrders] = useState<Order[]>(initialOrders);
  const orderIdRef = useRef(Math.max(...initialOrders.map((o) => o.id), 0) + 1);
  const flashRef = useRef<Set<string>>(new Set());
  const [, setFlashKey] = useState(0); // dummy trigger for UI flash

  // Sync from parent on store switch
  const dataRef = useRef(initialOrders);
  useEffect(() => {
    if (dataRef.current !== initialOrders) {
      dataRef.current = initialOrders;
      orderIdRef.current = Math.max(...initialOrders.map((o) => o.id), 0) + 1;
      setLocalOrders(initialOrders);
    }
  }, [initialOrders]);

  // ── Demo heartbeat: 30s random EUR/Stripe order ──
  useEffect(() => {
    if (!isDemo) return;
    const tick = () => {
      if (Math.random() >= 0.5) return;
      const isEur = Math.random() < 0.4;
      const id = orderIdRef.current++;
      const amount = (isEur ? 30 : 20) + Math.random() * (isEur ? 80 : 200);
      const newOrder: Order = {
        id,
        created_at: new Date().toISOString(),
        total_price: amount.toFixed(2),
        financial_status: "paid",
        gateway: isEur ? "stripe" : (Math.random() < 0.6 ? "stripe" : "paypal"),
        currency: isEur ? "EUR" : "USD",
      };
      setLocalOrders((prev) => [...prev, newOrder]);
      flashRef.current.add(isEur ? "stripe-EUR" : (newOrder.gateway === "stripe" ? "stripe-USD" : "paypal-USD"));
      setFlashKey(Date.now());
      setTimeout(() => { flashRef.current.clear(); setFlashKey(Date.now()); }, 1200);
    };
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [isDemo]);

  const orders = isDemo ? localOrders : initialOrders;

  // ── Core aggregation: gateway × currency ──
  const gatewayStats = useMemo((): GatewayStat[] => {
    const paid = orders.filter(isPaidOrder);
    // key = "gateway-currency"
    const map = new Map<string, { orders: number; revenue: number }>();

    for (let i = 0; i < paid.length; i++) {
      const o = paid[i];
      const gw = resolveGateway(o, i, isDemo);
      const curr = (o.currency || "USD").toUpperCase();
      const key = `${gw}-${curr}`;
      const existing = map.get(key) ?? { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += parseFloat(o.total_price) || 0;
      map.set(key, existing);
    }

    const stats: GatewayStat[] = [];
    for (const [key, data] of map) {
      const [gw, curr] = key.split("-");
      const gwCfg = getGatewayConfig(gw);
      const curCfg = getCurrencyRate(curr);
      const gateRate = gw === "stripe" ? stripeRate / 100 : paypalRate / 100;
      const gateFixed = gw === "stripe" ? stripeFixed : paypalFixed;
      const feeAmt = data.revenue * gateRate + gateFixed * data.orders;
      const revenueCny = data.revenue * curCfg.rate;
      const feeCny = feeAmt * curCfg.rate;
      const netCny = revenueCny - feeCny;

      stats.push({
        gateway: gw,
        label: gwCfg.label,
        color: gwCfg.color,
        iconColor: gwCfg.iconColor,
        currency: curr,
        currencyLabel: curCfg.label,
        rate: curCfg.rate,
        orderCount: data.orders,
        totalRevenue: data.revenue,
        revenueCny,
        feeRate: gateRate * 100,
        feeFixed: gateFixed,
        feeAmount: feeAmt,
        feeCny,
        netCny,
      });
    }

    return stats.sort((a, b) => b.revenueCny - a.revenueCny);
  }, [orders, stripeRate, stripeFixed, paypalRate, paypalFixed, isDemo]);

  const totalFeeCny = gatewayStats.reduce((s, g) => s + g.feeCny, 0);
  const totalRevenueCny = gatewayStats.reduce((s, g) => s + g.revenueCny, 0);
  const netRevenueCny = totalRevenueCny - totalFeeCny;
  const totalOrders = gatewayStats.reduce((s, g) => s + g.orderCount, 0);

  // Donut data: grouped by gateway (all currencies merged)
  const donutData = useMemo(() => {
    const gwMap = new Map<string, number>();
    for (const g of gatewayStats) {
      gwMap.set(g.gateway, (gwMap.get(g.gateway) ?? 0) + g.netCny);
    }
    return Array.from(gwMap.entries()).map(([gw, val]) => ({
      name: GATEWAY_CONFIG[gw]?.label ?? gw,
      value: Math.round(val * 100) / 100,
      color: GATEWAY_CONFIG[gw]?.color ?? "#6b7280",
    }));
  }, [gatewayStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Landmark className="h-6 w-6 text-amber-400" />
          多币种网关智能对账
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          {shopName} · Stripe / PayPal 多币种手续费对比与净结汇分析
          {isDemo && <span className="ml-2 text-sm text-amber-400">(Demo: 30s 心跳 · 40% 概率 EUR/Stripe 爆单)</span>}
        </p>
      </div>

      {/* Rate Config Bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-end gap-4 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />费率配置
          </p>

          {/* Stripe */}
          <div className="flex items-end gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
            <span className="text-sm font-semibold text-indigo-400">Stripe</span>
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground">费率%</label>
              <Input type="number" step={0.1} min={0} max={10} value={stripeRate} onChange={(e) => setStripeRate(Number(e.target.value) || 0)} className="h-9 w-16 text-center text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground">固定 $</label>
              <Input type="number" step={0.01} min={0} max={2} value={stripeFixed} onChange={(e) => setStripeFixed(Number(e.target.value) || 0)} className="h-9 w-16 text-center text-sm" />
            </div>
            <Button size="sm" variant="outline" onClick={presetStripe} className="h-7 gap-1 border-indigo-500/30 bg-indigo-500/10 px-2 text-xs text-indigo-300 hover:bg-indigo-500/20">
              <Sparkles className="h-3 w-3" />官方标准
            </Button>
          </div>

          {/* PayPal */}
          <div className="flex items-end gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
            <span className="text-sm font-semibold text-sky-400">PayPal</span>
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground">费率%</label>
              <Input type="number" step={0.1} min={0} max={10} value={paypalRate} onChange={(e) => setPaypalRate(Number(e.target.value) || 0)} className="h-9 w-16 text-center text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-muted-foreground">固定 $</label>
              <Input type="number" step={0.01} min={0} max={2} value={paypalFixed} onChange={(e) => setPaypalFixed(Number(e.target.value) || 0)} className="h-9 w-16 text-center text-sm" />
            </div>
            <Button size="sm" variant="outline" onClick={presetPaypal} className="h-7 gap-1 border-sky-500/30 bg-sky-500/10 px-2 text-xs text-sky-300 hover:bg-sky-500/20">
              <Sparkles className="h-3 w-3" />官方标准
            </Button>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            多币种汇率: 🇺🇸7.25 · 🇪🇺7.85 · 🇨🇦5.30 · 🇬🇧9.15
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="网关总手续费 (RMB)"
          value={formatCny(totalFeeCny)}
          subtitle={`${totalOrders} 笔订单归集`}
          icon={TrendingDown}
          accent="red"
          highlight
        />
        <KpiCard
          title="预计净结汇 (RMB)"
          value={formatCny(netRevenueCny)}
          subtitle={`GMV ¥${formatCny(totalRevenueCny)} − 手续费 ¥${formatCny(totalFeeCny)}`}
          icon={Wallet}
          accent="emerald"
        />
        <KpiCard
          title="涵盖货币"
          value={`${new Set(gatewayStats.map((s) => s.currency)).size} 种`}
          subtitle="基于真实订单多币种对账"
          icon={CreditCard}
          accent="sky"
        />
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Donut */}
        <Card className="lg:col-span-2 border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base">网关占比</CardTitle>
            <CardDescription>各网关净结汇 (到手 RMB) 占比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name">
                    {donutData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCny(Number(value) || 0)} />
                  <Legend formatter={(v: string) => (<span style={{ color: "oklch(0.708 0 0)", fontSize: "12px" }}>{v}</span>)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Detail Table */}
        <Card className="lg:col-span-3 border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base">多币种明细对账</CardTitle>
            <CardDescription>按网关 × 币种双重聚合并扣除手续费</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>渠道</TableHead>
                  <TableHead className="text-right">单数</TableHead>
                  <TableHead className="text-right">收款额</TableHead>
                  <TableHead className="text-right">费率公式</TableHead>
                  <TableHead className="text-right">手续费 (RMB)</TableHead>
                  <TableHead className="text-right">到手 RMB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gatewayStats.map((g) => {
                  const key = `${g.gateway}-${g.currency}`;
                  const flashing = flashRef.current.has(key);
                  return (
                    <TableRow key={key} className={`group transition-all ${flashing ? "bg-amber-500/10 animate-pulse" : "hover:bg-muted/30"}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="font-medium text-foreground">{g.label}</span>
                          <span className="text-sm text-muted-foreground">{getCurrencyFlag(g.currency)}</span>
                          <Badge variant="outline" className="text-xs px-1 py-0 border-current/30 text-muted-foreground">
                            {g.currency}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.orderCount} 单</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.currency === "EUR" ? "€" : g.currency === "GBP" ? "£" : g.currency === "CAD" ? "C$" : "$"}
                        {g.totalRevenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-muted-foreground">
                          {g.totalRevenue.toFixed(2)} × {g.feeRate.toFixed(1)}% + {g.feeFixed} × {g.orderCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-red-400">{formatCny(g.feeCny)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-400">{formatCny(g.netCny)}</TableCell>
                    </TableRow>
                  );
                })}
                {gatewayStats.length > 0 && (
                  <TableRow className="border-t border-border/30 bg-muted/20">
                    <TableCell className="font-semibold text-foreground">合计</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{totalOrders} 单</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">—</TableCell>
                    <TableCell className="text-right" />
                    <TableCell className="text-right tabular-nums font-semibold text-red-400">{formatCny(totalFeeCny)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-400">{formatCny(netRevenueCny)}</TableCell>
                  </TableRow>
                )}
                {gatewayStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-base text-muted-foreground">暂无收款数据</TableCell>
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
