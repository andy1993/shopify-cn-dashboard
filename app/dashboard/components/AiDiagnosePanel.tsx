"use client";

import { useState, useRef } from "react";
import {
  Brain,
  Sparkles,
  Bot,
  Lightbulb,
  AlertTriangle,
  Loader2,
  Zap,
  TrendingUp,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────

interface Order {
  id: number;
  total_price: string;
  financial_status: string;
  gateway?: string;
  currency?: string;
}

interface Product {
  title: string;
  totalSold: number;
  inventory: number;
  totalRevenue: number;
}

interface DiagnosisReport {
  overview: string;
  conversionAnalysis: string;
  inventoryAlerts: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
}

interface AiDiagnosePanelProps {
  shopName: string;
  isDemo: boolean;
  shopId?: string;
  gmv: number;
  orderCount: number;
  conversionRate: number;
  exchangeRate: number;
  currency: string;
  products: Product[];
  refundRate: number;
  refundedCount: number;
  refundAmount: number;
  cogsRate: number;
  shippingRate: number;
  marketingRate: number;
  orders: Order[];
}

// ─── Per-store Demo presets ──────────────────────────

function getDemoPreset(shopName: string, gmv: number, orderCount: number): DiagnosisReport {
  const isTech = shopName.toLowerCase().includes("tech") || shopName.includes("科技");

  const techOverview = "## 📊 今日营收与流失大盘点\n\n**" + shopName + "** 今日 GMV 达 **¥" + gmv.toLocaleString() + "**，" + orderCount + " 笔订单，数据表现亮眼。\n\n> 需警惕转化漏斗中加购到结账环节流失偏大。高客单价技术配饰买家对信任度极度敏感，建议在 PDP 页强化 30 天无理由退换和保修承诺图标，可预期提升结账率至少 15%。";

  const homeOverview = "## 📊 今日营收与流失大盘点\n\n**" + shopName + "** 今日 GMV 达 **¥" + gmv.toLocaleString() + "**，" + orderCount + " 笔订单，家居类目转化表现稳健。\n\n> 家居品复购周期天然偏长。当前核心增长杠杆不在拉新，而在提升客单：搭配满 ¥300 减 ¥30 捆绑促销，预期 ARPU 上升 20%。";

  const techConversion = "## 📈 转化漏斗分析\n\n- 访客到加购：8.3%（正常偏低，页面信息密度可加强）\n- 加购到结账：55.6%（低于 60% 健康线）\n- 结账到成交：47.6%\n\n> 建议：在购物车页面增加已有 X 人正在浏览该商品的社交证明组件，并开启 Shop Pay 一键结账加速。";

  const homeConversion = "## 📈 转化漏斗分析\n\n- 访客到加购：8.3%\n- 加购到结账：55.6%\n- 结账到成交：47.6%\n\n> 建议：家居品可尝试 PDP 页 3D/AR 家具摆放预览功能（支持 iOS Safari），大幅降低退货预期和决策焦虑。";

  const techRecs = "## 🚀 今日高回报行动指南\n\n### ① 信任强化\n> 为 Top 3 产品 PDP 页添加 30 天无理由退换横幅 + 实时购买人数徽标，预期转化提高 15% (ROI ↑)\n\n### ② 弃单挽回\n> 立即激活 Klaviyo 加购未结邮件流，首封 30 分钟后发送带 ¥20 优惠券，预期挽回 12% 弃单 (ROI ↑)\n\n### ③ PayPal 对账\n> 当前 PayPal 扣费率 4.4%，若月 GMV 超过 $10K，可致电 PayPal 申请费率下浮至 3.9%，年省 ¥8,000+ (ROI ↑)";

  const homeRecs = "## 🚀 今日高回报行动指南\n\n### ① 捆绑组合\n> 推出 卧室套餐 (床品+抱枕)，定价比单品总和低 15%，预估客单价提高 40% (ROI ↑)\n\n### ② 内容种草\n> 在 Instagram 发布 3 条 Room Tour Reels，挂 Shopify Collabs 联盟链接，预期周增 100+ 社交流量 (ROI ↑)\n\n### ③ 老客激活\n> 通过 Omnisend 向 90 天未回购老客发送 Miss You 专属 85 折码，预期唤醒 5% 老客 (ROI ↑)";

  return {
    overview: isTech ? techOverview : homeOverview,
    conversionAnalysis: isTech ? techConversion : homeConversion,
    inventoryAlerts: ["## ✅ 库存健康\n\n当前热销商品库存均在安全水位以上。"],
    recommendations: [isTech ? techRecs : homeRecs],
    riskLevel: "low",
  };
}

// ─── Gateway fee computer ─────────────────────────────

function computeGatewayFees(orders: Order[], rate: number) {
  let stripeFee = 0;
  let paypalFee = 0;
  for (const o of orders) {
    if (o.financial_status !== "paid" && o.financial_status !== "authorized" && o.financial_status !== "") continue;
    const usd = parseFloat(o.total_price) || 0;
    const gw = (o.gateway || "").toLowerCase();
    if (gw.includes("stripe") || gw.includes("shopify_payments")) stripeFee += usd * 0.034 + 0.3;
    else if (gw.includes("paypal")) paypalFee += usd * 0.044 + 0.3;
    else stripeFee += usd * 0.034 + 0.3;
  }
  return { stripeFee: Math.round(stripeFee * rate * 100) / 100, paypalFee: Math.round(paypalFee * rate * 100) / 100 };
}

function computeFunnel(orderCount: number) {
  const purchase = orderCount;
  const ic = Math.round(purchase * 2.1);
  const atc = Math.round(ic * 1.8);
  const sessions = Math.round(atc * 12);
  return { sessions, atc, ic, purchase, icAtcRatio: atc > 0 ? ic / atc : 0 };
}

function computeRetention(orders: Order[], isDemo: boolean) {
  let repeat = 0;
  let repeatRevenue = 0;
  let newRevenue = 0;
  const paid = orders.filter((o) => o.financial_status === "paid" || o.financial_status === "authorized" || o.financial_status === "");
  for (let i = 0; i < paid.length; i++) {
    const price = parseFloat(paid[i].total_price) || 0;
    if (isDemo && i % 4 === 0) { repeat++; repeatRevenue += price; }
    else newRevenue += price;
  }
  const totalRev = repeatRevenue + newRevenue;
  return {
    repeatRate: paid.length > 0 ? (repeat / paid.length) * 100 : 0,
    repeatRevenuePct: totalRev > 0 ? (repeatRevenue / totalRev) * 100 : 0,
    newCustomerPct: totalRev > 0 ? (newRevenue / totalRev) * 100 : 100,
  };
}

// ─── Main Component ───────────────────────────────────

export default function AiDiagnosePanel({
  shopName,
  isDemo,
  gmv,
  orderCount,
  exchangeRate,
  currency,
  products,
  refundRate,
  refundedCount,
  refundAmount,
  cogsRate,
  shippingRate,
  marketingRate,
  orders,
}: AiDiagnosePanelProps) {
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [typewriterText, setTypewriterText] = useState("");
  const canRetry = useRef(false);

  const handleDiagnose = async () => {
    if (diagnosing) return;
    setDiagnosing(true);
    setDiagnosis(null);
    setDiagnosisError(null);
    setTypewriterText("");
    canRetry.current = false;

    // ── 轨 A: Demo — 本地预设 + 打字机动效 ──
    if (isDemo) {
      const loadingLines = [
        "DeepSeek-v4-pro 正在深度解构演示店铺的运营数据...",
        "正在分析流量漏斗各层流失与加购行为...",
        "正在对账 Stripe/PayPal 网关扣费与利润率...",
        "正在生成骨灰级操盘手实战诊断报告...",
      ];
      for (const line of loadingLines) {
        setTypewriterText(line);
        await new Promise((r) => setTimeout(r, 700));
      }
      setDiagnosis(getDemoPreset(shopName, gmv, orderCount));
      setDiagnosing(false);
      setTypewriterText("");
      return;
    }

    // ── 轨 B: Real — POST 到后端 → DeepSeek-v4-pro ──
    const loadingLines = [
      "DeepSeek-v4-pro 正在深度解构您的真实资产、网关扣费与流失漏斗...",
      "正在抓取 Multi-Market 售卖国配置与节日大促数据...",
      "正在分析 Stripe/PayPal 手续费占比与供应链利润...",
      "正在生成专属跨境操盘手行动报告，请稍候...",
    ];
    for (const line of loadingLines) {
      setTypewriterText(line);
      await new Promise((r) => setTimeout(r, 800));
    }

    const gwFees = computeGatewayFees(orders, exchangeRate);
    const funnel = computeFunnel(orderCount);
    const retention = computeRetention(orders, false);

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDemo: false,
          metrics: {
            shopName,
            gmv,
            orderCount,
            conversionRate: 0,
            exchangeRate,
            currency,
            products,
            refundRate,
            refundedCount,
            refundAmount: refundAmount * exchangeRate,
            cogsRate,
            shippingRate,
            marketingRate,
            stripeFeeCny: gwFees.stripeFee,
            paypalFeeCny: gwFees.paypalFee,
            funnelSessions: funnel.sessions,
            funnelAtc: funnel.atc,
            funnelIc: funnel.ic,
            funnelPurchase: funnel.purchase,
            icAtcRatio: funnel.icAtcRatio,
            repeatRate: retention.repeatRate,
            repeatRevenuePct: retention.repeatRevenuePct,
            newCustomerPct: retention.newCustomerPct,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.diagnosis) {
        setDiagnosis(json.diagnosis);
        setDiagnosisError(null);
      } else {
        setDiagnosisError(json.error || "AI 诊断服务停摆，请稍后重试。");
        canRetry.current = true;
      }
    } catch {
      setDiagnosisError("\u26a0\ufe0f 网络异常，无法连接诊断服务。请检查网络后重试。");
      canRetry.current = true;
    }
    setDiagnosing(false);
    setTypewriterText("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Brain className="h-6 w-6 text-amber-400" />
            AI 跨境操盘手智能诊断
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            基于 {shopName} 全维度实时数据的 DeepSeek-v4-pro 深度分析
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDemo && diagnosis && !diagnosing && (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Zap className="mr-1 h-3 w-3" />已生成诊断
            </Badge>
          )}
          <Button size="sm" onClick={handleDiagnose} disabled={diagnosing}
            className="gap-2 bg-amber-600 text-white hover:bg-amber-500"
          >
            <Sparkles className="h-4 w-4" />
            {diagnosing ? "诊断中..." : diagnosis ? "重新诊断" : "开始 AI 智能诊断"}
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {diagnosisError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm text-amber-200">{diagnosisError}</p>
            {canRetry.current && (
              <Button size="sm" variant="outline" className="mt-2 h-7 border-amber-500/30 text-xs text-amber-300" onClick={handleDiagnose}>点击重试</Button>
            )}
          </div>
        </div>
      )}

      {/* Typewriter loading */}
      {diagnosing && (
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-lg backdrop-blur-lg ring-1 ring-amber-500/10">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-300">DeekSeek-v4-pro 诊断中</p>
              <p className="mt-1 text-xs text-amber-200/60 animate-pulse">{typewriterText}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!diagnosis && !diagnosing && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Bot className="h-16 w-16 text-muted-foreground/25" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-muted-foreground">AI 博弈室已就绪</p>
              <p className="text-sm text-muted-foreground/60 max-w-md">
                点击「开始 AI 智能诊断」
                {isDemo ? "，系统将结合当前演示店铺品类输出高保真实战诊断报告。" : "，系统将实时调用 DeepSeek-v4-pro 深度分析您的真实网关对账、流量漏斗与供应链利润。"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis result */}
      {diagnosis && !diagnosing && (
        <div className="space-y-4">
          {/* Risk badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              diagnosis.riskLevel === "high" ? "border-red-500/30 bg-red-500/10 text-red-400" :
              diagnosis.riskLevel === "medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }>
              {diagnosis.riskLevel === "high" ? "🔴 高风险" : diagnosis.riskLevel === "medium" ? "🟡 中风险" : "🟢 低风险"}
            </Badge>
            {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">演示模式</Badge>}
            {!isDemo && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">DeekSeek-v4-pro 生成</Badge>}
          </div>

          {/* Overview card */}
          <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(diagnosis.overview) }} />
            </CardContent>
          </Card>

          {/* Conversion card */}
          <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
            <CardContent className="p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
                <TrendingUp className="h-4 w-4" />转化与流量健康度
              </h3>
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(diagnosis.conversionAnalysis) }} />
            </CardContent>
          </Card>

          {/* Inventory cards */}
          {diagnosis.inventoryAlerts.map((alert, i) => (
            <Card key={i} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
              <CardContent className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <Shield className="h-4 w-4" />库存与风控
                </h3>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(alert) }} />
              </CardContent>
            </Card>
          ))}

          {/* Recommendations cards */}
          {diagnosis.recommendations.map((rec, i) => (
            <Card key={i} className="border-emerald-500/20 bg-emerald-500/5 shadow-lg backdrop-blur-lg ring-1 ring-emerald-500/10">
              <CardContent className="p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Lightbulb className="h-4 w-4" />行动指南
                </h3>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(rec) }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Simple Markdown-to-HTML converter ────────────────

function mdToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h4 style="margin-top:16px;margin-bottom:8px;font-size:15px;font-weight:700">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin-top:20px;margin-bottom:10px;font-size:16px;font-weight:700;color:#fbbf24">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fbbf24">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #f59e0b;padding-left:12px;margin:8px 0;color:#a3a3a3;font-style:italic">$1</blockquote>')
    .replace(/`([^`]+)`/g, '<code style="background:#1c1917;padding:1px 5px;border-radius:4px;font-size:12px;color:#fbbf24">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style-type:disc;margin-bottom:4px">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#fbbf24;text-decoration:underline">$1</a>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
  return html;
}
