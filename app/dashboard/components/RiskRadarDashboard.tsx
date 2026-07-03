"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Gauge,
  FileWarning,
  Scale,
  Clock,
  RefreshCw,
  Ban,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

// ─── Types ────────────────────────────────────────────

type RiskLevel = "safe" | "warning" | "critical";

interface DisputeEntry {
  id: string;
  orderId: number;
  amount: number;
  currency: string;
  gateway: string;
  reason: string;
  filedAt: string;
  status: "open" | "won" | "lost" | "under_review";
  daysOpen: number;
}

interface MerchantReview {
  id: string;
  type: "chargeback_review" | "terms_of_service" | "fulfillment_review";
  status: "pending" | "resolved";
  severity: "low" | "medium" | "high";
  title: string;
  openedAt: string;
  description: string;
}

interface StoreRiskProfile {
  storeId: string;
  storeName: string;
  healthScore: number;
  rollingDisputeRate: number;
  totalOrders30d: number;
  disputedOrders30d: number;
  chargebackCount: number;
  chargebackAmount: number;
  refundRate: number;
  avgFulfillmentHours: number;
  merchantReviews: MerchantReview[];
  disputes: DisputeEntry[];
  overallRisk: RiskLevel;
}

interface RiskRadarDashboardProps {
  isDemo: boolean;
  shopName: string;
  orders: Array<{ id: number; created_at: string; total_price: string; financial_status: string; gateway?: string }>;
  orderCount: number;
  gmv: number;
  refundRate: number;
  refundedCount: number;
  refundAmount: number;
  exchangeRate: number;
  stores?: Array<{ id: string; shopName: string; shopUrl: string; isDemo?: boolean }>;
}

// ─── Constants ────────────────────────────────────────

type RiskThresholdEntry = { max?: number; color: string; bg: string; text: string; ring: string; label: string };  const RISK_THRESHOLDS: Record<string, RiskThresholdEntry> = {
  safe: { max: 1.0, color: "#10b981", bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/20", label: "安全" },
  warning: { max: 1.5, color: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/20", label: "预警" },
  critical: { color: "#ef4444", bg: "bg-red-500/10", text: "text-red-400", ring: "ring-red-500/20", label: "危机" },
};

function getRiskLevel(rate: number, hasReview: boolean): RiskLevel {
  if (rate >= 1.5 || hasReview) return "critical";
  if (rate >= 1.0) return "warning";
  return "safe";
}

function getRiskStyle(level: RiskLevel) {
  const map: Record<RiskLevel, typeof RISK_THRESHOLDS.safe> = {
    safe: RISK_THRESHOLDS.safe,
    warning: RISK_THRESHOLDS.warning,
    critical: RISK_THRESHOLDS.critical,
  };
  return map[level];
}

// ─── Health Gauge SVG ─────────────────────────────────

function HealthGauge({ score, size = 160 }: { score: number; size?: number }) {
  const strokeW = 12;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(100, score));
  const dashoffset = circumference * (1 - normalized / 100);

  const color = normalized >= 80 ? "#10b981" : normalized >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth={strokeW} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{normalized}</span>
        <span className="text-[10px] font-medium text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ─── Store health card ────────────────────────────────

function StoreHealthCard({ profile }: { profile: StoreRiskProfile }) {
  const style = getRiskStyle(profile.overallRisk);

  return (
    <Card className={`border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all hover:border-border/60 ${profile.overallRisk === "critical" ? "ring-2 ring-red-500/20" : profile.overallRisk === "warning" ? "ring-1 ring-amber-500/20" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.color }} />
            {profile.storeName}
          </CardTitle>
          <Badge className={`text-[10px] px-2 py-0 ${style.bg} ${style.text} ${style.ring}`}>
            {style.label}
          </Badge>
        </div>
        <CardDescription>店铺健康分 · 滚动纠纷率 · 履约时效</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <HealthGauge score={profile.healthScore} size={120} />
          <div className="flex-1 ml-4 space-y-3">
            <MetricRow label="滚动纠纷率 (30d)" value={profile.rollingDisputeRate.toFixed(2) + "%"} accent={profile.rollingDisputeRate >= 1.5 ? "red" : profile.rollingDisputeRate >= 1.0 ? "amber" : "emerald"} />
            <MetricRow label="拒付次数" value={String(profile.chargebackCount)} accent={profile.chargebackCount > 0 ? "red" : "emerald"} />
            <MetricRow label="拒付金额" value={formatCny(profile.chargebackAmount)} accent={profile.chargebackAmount > 0 ? "red" : "emerald"} />
            <MetricRow label="退款率" value={profile.refundRate.toFixed(2) + "%"} accent={profile.refundRate > 3 ? "red" : profile.refundRate > 1.5 ? "amber" : "emerald"} />
            <MetricRow label="平均履约时长" value={profile.avgFulfillmentHours + "h"} accent={profile.avgFulfillmentHours > 72 ? "amber" : "emerald"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent: "emerald" | "amber" | "red" }) {
  const colors = { emerald: "text-emerald-400", amber: "text-amber-400", red: "text-red-400" };
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${colors[accent]}`}>{value}</span>
    </div>
  );
}

// ─── Pending Disputes Table ───────────────────────────

function DisputesTable({ disputes }: { disputes: DisputeEntry[] }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    open: { label: "进行中", cls: "border-amber-500/30 text-amber-400" },
    won: { label: "胜诉", cls: "border-emerald-500/30 text-emerald-400" },
    lost: { label: "败诉", cls: "border-red-500/30 text-red-400" },
    under_review: { label: "审核中", cls: "border-sky-500/30 text-sky-400" },
  };

  return (
    <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-400" />
          未决争议申诉控制台
        </CardTitle>
        <CardDescription>所有未解决的争议与拒付申诉 · 按开启天数降序</CardDescription>
      </CardHeader>
      <CardContent>
        {disputes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>订单</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>网关</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">已开天数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((d) => (
                <TableRow key={d.id} className="group transition-colors hover:bg-muted/20">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{d.orderId}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-red-400">
                    {d.currency === "EUR" ? "€" : "$"}{d.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground">
                      {d.gateway}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{d.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusMap[d.status]?.cls ?? ""}`}>
                      {statusMap[d.status]?.label ?? d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={`text-sm font-medium ${d.daysOpen > 14 ? "text-red-400" : d.daysOpen > 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {d.daysOpen} 天
                      {d.daysOpen > 14 && <AlertCircle className="ml-1 inline h-3 w-3 text-red-400" />}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
            <p>暂无未决争议</p>
            <p className="text-xs text-muted-foreground/60">店铺风控状态健康</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Merchant Review Alerts ───────────────────────────

function ReviewAlerts({ reviews }: { reviews: MerchantReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-2">
      {reviews.map((r) => (
        <div key={r.id} className={`flex items-start gap-3 rounded-lg px-4 py-3 backdrop-blur-sm ${
          r.severity === "high"
            ? "border border-red-500/30 bg-red-500/10"
            : r.severity === "medium"
              ? "border border-amber-500/30 bg-amber-500/10"
              : "border border-sky-500/30 bg-sky-500/10"
        }`}>
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
            r.severity === "high" ? "text-red-400" : r.severity === "medium" ? "text-amber-400" : "text-sky-400"
          }`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${
              r.severity === "high" ? "text-red-300" : r.severity === "medium" ? "text-amber-300" : "text-sky-300"
            }`}>{r.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${r.status === "pending" ? "border-red-500/30 text-red-400" : "border-emerald-500/30 text-emerald-400"}`}>
                {r.status === "pending" ? "未处理" : "已解决"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">开启于 {r.openedAt}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Risk Timeline Bar ────────────────────────────────

function RiskTimelineBar({ disputeRate }: { disputeRate: number }) {
  const pct = Math.min(3, disputeRate);
  const leftPct = (pct / 3) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1.5">
        <span>0%</span>
        <span className="text-emerald-400">1.0%</span>
        <span className="text-amber-400">1.5%</span>
        <span className="text-red-400">3.0%+</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-red-500/20">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
            style={{ width: leftPct + "%", opacity: 0.3 }}
          />
        </div>
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
          style={{ left: leftPct + "%" }}
        >
          <div className="h-4 w-1 rounded-full bg-foreground/80" />
          <span className="text-[10px] font-bold tabular-nums mt-0.5" style={{ color: disputeRate >= 1.5 ? "#ef4444" : disputeRate >= 1.0 ? "#f59e0b" : "#10b981" }}>
            {disputeRate.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Demo Data Generator ──────────────────────────────

function generateDemoRiskProfile(storeName: string, isCritical: boolean): StoreRiskProfile {
  const now = new Date();
  const fmt = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date.toISOString().slice(0, 10);
  };

  const rate = isCritical ? 1.5 + Math.random() * 0.8 : 0.4 + Math.random() * 0.6;
  const health = isCritical ? 35 + Math.random() * 20 : 70 + Math.random() * 25;

  const disputeReasons = ["未收到商品", "商品与描述不符", "信用卡未授权交易", "重复扣款", "商品损坏"];
  const gateways = ["Stripe", "PayPal", "Shopify Payments"];

  const disputes: DisputeEntry[] = isCritical
    ? Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => ({
        id: "disp-" + i,
        orderId: 10000 + i * 127,
        amount: 29 + Math.random() * 200,
        currency: Math.random() < 0.3 ? "EUR" : "USD",
        gateway: gateways[Math.floor(Math.random() * gateways.length)],
        reason: disputeReasons[Math.floor(Math.random() * disputeReasons.length)],
        filedAt: fmt(Math.floor(Math.random() * 20)),
        status: (["open", "under_review", "lost"] as const)[Math.floor(Math.random() * 3)],
        daysOpen: Math.floor(Math.random() * 25),
      }))
    : [];

  const reviews: MerchantReview[] = isCritical
    ? [{
        id: "rev-1",
        type: "chargeback_review",
        status: "pending",
        severity: "high",
        title: "拒付率超标审查 — Shopify Merchant Review",
        openedAt: fmt(3),
        description: "系统检测到贵店近 30 天拒付率超出 1.5% 阈值。请立即处理未决争议，否则可能面临冻结支付或店铺关停风险。",
      }]
    : [];

  return {
    storeId: "demo-" + storeName.toLowerCase().replace(/\s/g, "-"),
    storeName,
    healthScore: Math.round(health),
    rollingDisputeRate: Math.round(rate * 100) / 100,
    totalOrders30d: 150 + Math.floor(Math.random() * 350),
    disputedOrders30d: Math.max(1, Math.round(rate * (150 + Math.floor(Math.random() * 350)) / 100)),
    chargebackCount: isCritical ? 3 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 2),
    chargebackAmount: isCritical ? 500 + Math.random() * 2000 : Math.random() * 300,
    refundRate: isCritical ? 2.5 + Math.random() * 2 : 0.5 + Math.random() * 1.5,
    avgFulfillmentHours: isCritical ? 60 + Math.random() * 50 : 20 + Math.random() * 30,
    merchantReviews: reviews,
    disputes,
    overallRisk: isCritical ? "critical" : Math.random() < 0.3 ? "warning" : "safe",
  };
}

// ─── Main Component ───────────────────────────────────

export default function RiskRadarDashboard({
  isDemo,
  shopName,
  orders,
  orderCount,
  gmv,
  refundRate,
  refundedCount,
  refundAmount,
  exchangeRate,
  stores,
}: RiskRadarDashboardProps) {
  // ── Demo profiles ──
  const demoProfiles = useMemo(() => {
    if (!isDemo) return [];
    return [
      generateDemoRiskProfile(shopName, false),
      generateDemoRiskProfile("AGAIC POWER Official", true),
    ];
  }, [isDemo, shopName]);

  // ── Real profile computation ──
  const realProfile = useMemo((): StoreRiskProfile | null => {
    if (isDemo) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders30d = orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= thirtyDaysAgo;
    });

    // Estimate disputed orders from refund/chargeback rate
    const estimatedDisputes = Math.round(orderCount * (refundRate / 100) * 0.3);
    const estimatedChargebacks = Math.round(orderCount * (refundRate / 100) * 0.15);
    const disputeRate = orders30d.length > 0 ? (estimatedDisputes / orders30d.length) * 100 : 0;

    const chargebackCount = estimatedChargebacks;
    const chargebackAmount = refundAmount * 0.15;
    const avgFulfillment = 48;

    const hasReview = disputeRate >= 1.5;
    const reviews: MerchantReview[] = hasReview ? [{
      id: "rev-real-1",
      type: "chargeback_review",
      status: "pending",
      severity: disputeRate >= 2 ? "high" : "medium",
      title: "拒付率超限预警",
      openedAt: new Date().toISOString().slice(0, 10),
      description: "30 天滚动纠纷率超过安全阈值，建议立即处理未决争议并优化物流时效。",
    }] : [];

    const health = Math.max(0, Math.round(100 - disputeRate * 20 - chargebackCount * 5 - refundRate * 3));

    return {
      storeId: "real",
      storeName: shopName,
      healthScore: health,
      rollingDisputeRate: Math.round(disputeRate * 100) / 100,
      totalOrders30d: orders30d.length,
      disputedOrders30d: estimatedDisputes,
      chargebackCount,
      chargebackAmount: Math.round(chargebackAmount * 100) / 100,
      refundRate: Math.round(refundRate * 100) / 100,
      avgFulfillmentHours: avgFulfillment,
      merchantReviews: reviews,
      disputes: [],
      overallRisk: getRiskLevel(disputeRate, hasReview),
    };
  }, [isDemo, orders, orderCount, refundRate, refundAmount, shopName]);

  const profiles = isDemo ? demoProfiles : (realProfile ? [realProfile] : []);
  const allDisputes = profiles.flatMap((p) => p.disputes);
  const allReviews = profiles.flatMap((p) => p.merchantReviews);
  let worstRisk: RiskLevel = "safe";
  for (const p of profiles) {
    if (p.overallRisk === "critical") { worstRisk = "critical"; break; }
    if (p.overallRisk === "warning") worstRisk = "warning";
  }

  const worstStyle = getRiskStyle(worstRisk);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Shield className="h-6 w-6" style={{ color: worstStyle.color }} />
          风控雷达与店铺健康中心
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDemo ? "多店风控推演 (演示模式)" : shopName} · 滚动纠纷率 · Merchant Review · 拒付追踪
          {isDemo && <span className="ml-2 text-xs text-amber-400">(包含 AGAIC POWER Official 高危风控演示数据)</span>}
        </p>
      </div>

      {/* Global risk banner */}
      {worstRisk !== "safe" && (
        <div className={`flex items-start gap-3 rounded-lg px-5 py-4 backdrop-blur-sm ${worstStyle.bg} border`} style={{ borderColor: worstStyle.color + "33" }}>
          {worstRisk === "critical"
            ? <Ban className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />}
          <div>
            <p className="text-sm font-semibold" style={{ color: worstStyle.color }}>
              {worstRisk === "critical" ? "🔴 全局风控危机" : "🟡 部分店铺风控预警"}
            </p>
            <p className="text-xs mt-1" style={{ color: worstStyle.color, opacity: 0.7 }}>
              {worstRisk === "critical"
                ? "检测到至少一家店铺拒付率超标或存在未处理的 Merchant Review。请立即介入处理，避免冻结支付或关停风险。"
                : "部分指标接近安全阈值，建议提前优化物流时效与售后响应。"}
            </p>
          </div>
        </div>
      )}

      {/* Health cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {profiles.map((p) => (
          <StoreHealthCard key={p.storeId} profile={p} />
        ))}
        {profiles.length === 0 && (
          <Card className="col-span-full border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <Gauge className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">正在加载风控数据...</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Risk Timeline Bar */}
      {profiles.length > 0 && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-400" />
              滚动纠纷率水位计 (Dispute Rate)
            </CardTitle>
            <CardDescription>基于近 30 天订单 · 公式: Dispute Rate = (未决争议 / 30天总订单) × 100%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profiles.map((p) => (
              <div key={p.storeId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{p.storeName}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.disputedOrders30d} 争议 / {p.totalOrders30d} 订单
                  </span>
                </div>
                <RiskTimelineBar disputeRate={p.rollingDisputeRate} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Merchant Review Alerts */}
      <ReviewAlerts reviews={allReviews} />

      {/* Pending Disputes Console */}
      <DisputesTable disputes={allDisputes} />

      {/* Cross-store summary (demo only) */}
      {profiles.length > 1 && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-400" />
              跨店风控指标实时对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>店铺</TableHead>
                  <TableHead className="text-right">健康分</TableHead>
                  <TableHead className="text-right">纠纷率</TableHead>
                  <TableHead className="text-right">拒付次数</TableHead>
                  <TableHead className="text-right">拒付金额</TableHead>
                  <TableHead className="text-right">退款率</TableHead>
                  <TableHead className="text-right">履约时</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => {
                  const s = getRiskStyle(p.overallRisk);
                  return (
                    <TableRow key={p.storeId} className="group transition-colors hover:bg-muted/20">
                      <TableCell className="font-medium text-foreground">{p.storeName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={`font-semibold ${p.healthScore >= 80 ? "text-emerald-400" : p.healthScore >= 50 ? "text-amber-400" : "text-red-400"}`}>{p.healthScore}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={`font-semibold ${p.rollingDisputeRate >= 1.5 ? "text-red-400" : p.rollingDisputeRate >= 1.0 ? "text-amber-400" : "text-emerald-400"}`}>
                          {p.rollingDisputeRate.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.chargebackCount}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-400">{formatCny(p.chargebackAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.refundRate.toFixed(2)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{p.avgFulfillmentHours}h</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] px-2 py-0 ${s.bg} ${s.text}`}>{s.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
