"use client";

import { ShieldCheck, ShieldAlert, ShieldX, Flame, Package } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInventoryBadge } from "../helpers";

// ─── Types ────────────────────────────────────────────

interface Product {
  id: number;
  title: string;
  image: string | null;
  totalSold: number;
  totalRevenue: number;
  inventory: number;
}

interface RiskRadarPanelProps {
  shopName: string;
  refundRate: number;
  refundedOrders: Array<{ id: number; total_price: string }>;
  refundAmount: number;
  exchangeRate: number;
  orderCount: number;
  products: Product[];
  productRiskMap: Map<number, { level: string }>;
}

// ─── Panel ─────────────────────────────────────────────

export default function RiskRadarPanel(props: RiskRadarPanelProps) {
  const { shopName, refundRate, refundedOrders, refundAmount, exchangeRate, orderCount, products, productRiskMap } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldCheck className="h-6 w-6 text-red-400" />
          风控预警中心
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          实时监控退款率与欺诈订单 · {shopName}
        </p>
      </div>

      {/* Risk Radar */}
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 backdrop-blur-sm ${
        refundRate < 1 ? "border-emerald-500/30 bg-emerald-500/10"
        : refundRate < 1.5 ? "border-amber-500/30 bg-amber-500/10"
        : "relative overflow-hidden border-red-500/40 bg-red-500/10"
      }`}>
        {refundRate >= 1.5 && (
          <span className="absolute inset-0 animate-[ai-pulse_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-red-400/5 to-transparent" />
        )}
        {refundRate < 1 ? <ShieldCheck className="relative h-6 w-6 shrink-0 text-emerald-400" />
          : refundRate < 1.5 ? <ShieldAlert className="relative h-6 w-6 shrink-0 text-amber-400" />
          : <Flame className="relative h-6 w-6 shrink-0 animate-pulse text-red-400" />}
        <div className="relative flex-1">
          <p className={`text-base font-semibold ${
            refundRate < 1 ? "text-emerald-300" : refundRate < 1.5 ? "text-amber-300" : "text-red-300"
          }`}>
            {refundRate < 1 ? "✓ 账户健康度：优秀"
              : refundRate < 1.5 ? `⚠ 警告：退款率 ${refundRate.toFixed(1)}%，接近风险红线`
              : `🔥 极高风险：退款率 ${refundRate.toFixed(1)}%！立即暂停广告自查刷单！`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>退款 {refundedOrders.length}/{orderCount} 单</span>
          <span>¥{(refundAmount * exchangeRate).toFixed(2)}</span>
        </div>
      </div>

      {/* Refund Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "今日退款率", value: `${refundRate.toFixed(2)}%`, color: refundRate >= 1.5 ? "text-red-400" : refundRate >= 1 ? "text-amber-400" : "text-emerald-400" },
          { label: "退款订单数", value: `${refundedOrders.length} 单`, color: "text-foreground" },
          { label: "退款总金额", value: `¥${(refundAmount * exchangeRate).toFixed(2)}`, color: "text-red-400" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Risk Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader>
          <CardTitle>商品风控评级</CardTitle>
          <CardDescription>基于退款关联 + 库存状态的风险评估</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">销量</TableHead>
                <TableHead className="text-right">库存</TableHead>
                <TableHead className="text-right">库存状态</TableHead>
                <TableHead className="text-right w-32">风控评级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p, i) => {
                const badge = getInventoryBadge(p.inventory);
                const risk = productRiskMap.get(p.id);
                return (
                  <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium text-muted-foreground">{String(i + 1).padStart(2, "0")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.image ? <img src={p.image} alt={p.title} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/30" />
                          : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 ring-1 ring-border/30"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                        <span className="max-w-[220px] truncate font-medium text-foreground">{p.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.totalSold}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.inventory}</TableCell>
                    <TableCell className="text-right">
                      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <span className="text-xs text-muted-foreground">库存充足</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {risk?.level === "高危欺诈" ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-red-400 bg-red-500/10 ring-red-500/20"><ShieldX className="h-3 w-3" /> 高危欺诈</span>
                      ) : risk?.level === "需关注" ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-amber-400 bg-amber-500/10 ring-amber-500/20"><ShieldAlert className="h-3 w-3" /> 需关注</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 text-emerald-400 bg-emerald-500/10 ring-emerald-500/20"><ShieldCheck className="h-3 w-3" /> 低风险</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
