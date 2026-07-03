"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardMenu } from "./layout";
import OverviewPanel from "./components/OverviewPanel";
import AiDiagnosePanel from "./components/AiDiagnosePanel";
import FinancePanel from "./components/FinancePanel";
import RiskRadarPanel from "./components/RiskRadarPanel";
import TrendAnalysisPanel from "./components/TrendAnalysisPanel";
import MultiStoreAggregator from "./components/MultiStoreAggregator";
import GatewayFinancePanel from "./components/GatewayFinancePanel";
import FunnelRetentionPanel from "./components/FunnelRetentionPanel";
import AdPerformancePanel from "./components/AdPerformancePanel";
import ProductControlPanel from "./components/ProductControlPanel";

// ─── Types ────────────────────────────────────────────

interface StoreEntry { id: string; shopUrl: string; accessToken: string; shopName: string; isDemo?: boolean; }

interface DashboardData {
  success: true; shopName: string; domain: string; currency: string; exchangeRate: number;
  gmv: number; orderCount: number; conversionRate: number;
  charts: Array<{ hour: string; sales: number }>;
  products: Array<{ id: number; title: string; image: string | null; totalSold: number; totalRevenue: number; inventory: number }>;
  orders: Array<{
    id: number; created_at: string; total_price: string; financial_status: string;
    gateway?: string; customer_orders_count?: number; shipping_country?: string;
  }>;
  holidaysData: Record<string, Array<{ date: string; localName: string; name: string; countryCode: string }>>;
  topCountries: string[]; lastUpdated: string;
  fullProducts?: Array<{
    id: number; title: string; status: string; image: string | null; shopName: string; isDemo: boolean;
    variants: Array<{ variantId: number; name: string; sku: string; price: string; inventory: number; productId?: string; inventoryItemId?: string }>;
  }>;
}

interface DiagnosisReport { overview: string; conversionAnalysis: string; inventoryAlerts: string[]; recommendations: string[]; riskLevel: "low" | "medium" | "high"; }

// ─── localStorage helpers ─────────────────────────────

const STORES_KEY = "shopify_stores";
const CURRENT_ID_KEY = "shopify_current_store_id";
function loadStores(): StoreEntry[] { try { const r = localStorage.getItem(STORES_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveStores(s: StoreEntry[]) { localStorage.setItem(STORES_KEY, JSON.stringify(s)); }

// ─── Diagnosis Engine ─────────────────────────────────

function generateDiagnosis(input: { shopName: string; gmv: number; orderCount: number; exchangeRate: number; currency: string; products: Array<{ title: string; totalSold: number; inventory: number }>; isDemo: boolean }): DiagnosisReport {
  const { shopName, gmv, orderCount, products, isDemo } = input;
  const lowStock = products.filter((p) => p.inventory < 10);
  const mediumStock = products.filter((p) => p.inventory >= 10 && p.inventory < 30);
  const avgOrderValue = orderCount > 0 ? gmv / orderCount : 0;

  if (isDemo) {
    return {
      overview: `## 📊 数据总览\n\n**${shopName}** 今日表现活跃，GMV 达 **¥${gmv.toLocaleString()}**，共 **${orderCount} 笔**订单。订单分布呈现典型电商昼夜节律——上午 10 点和晚上 20 点为两大流量高峰。`,
      conversionAnalysis: `## 📈 转化漏斗分析\n\n当前店铺整体转化率约 **2.1%**，处于 Shopify 独立站行业**中等偏下**水平（行业 Top 25% 为 3.2%+）。\n\n主要瓶颈：\n- 移动端加载速度\n- 商品详情页信息密度不足\n- 结算流程未启用 Shop Pay`,
      inventoryAlerts: lowStock.length > 0 ? [
        `## 🔴 库存预警\n\n以下商品库存即将告罄：\n${lowStock.map((p) => `- ${p.title}：仅剩 **${p.inventory} 件** 🚨`).join("\n")}`,
        mediumStock.length > 0 ? `## 🟡 库存关注\n\n${mediumStock.map((p) => `- ${p.title}：${p.inventory} 件`).join("\n")}` : "",
      ].filter(Boolean) as string[] : ["## ✅ 库存健康\n\n所有商品库存良好。"],
      recommendations: [`## 💡 行动建议\n\n### ① 紧急补货\n> 为 ${lowStock.map((p) => p.title).join("、") || "低库存商品"} 安排补货\n\n### ② 优化转化\n> 添加限时折扣倒计时和库存紧迫提示\n\n### ③ 邮件营销\n> 通过 Klaviyo 创建弃单挽回自动化流程`],
      riskLevel: lowStock.length >= 2 ? "high" : "medium",
    };
  }

  return {
    overview: orderCount === 0 ? `**${shopName}** 今日暂无订单。请检查广告投放和网站状态。` : `**${shopName}** 今日 GMV ¥${gmv.toLocaleString()}，${orderCount} 笔订单，客单价 ¥${Math.round(avgOrderValue).toLocaleString()}。`,
    conversionAnalysis: orderCount < 10 ? "订单量偏低，建议检查落地页加载速度和移动端体验。" : "订单量正常，可通过 A/B 测试进一步优化。",
    inventoryAlerts: lowStock.length > 0 ? [`⚠️ 库存预警：${lowStock.map((p) => `**${p.title}**（${p.inventory} 件）`).join("、")}`] : ["✅ 库存充足。"],
    recommendations: [lowStock.length > 0 ? `【紧急】补货 ${lowStock.map((p) => p.title).join("、")}` : "【持续】维持库存水位", `【优化】测试交叉销售提升连带率`, `【增长】邮件营销复购优惠券`],
    riskLevel: lowStock.length >= 2 ? "high" : lowStock.length === 1 ? "medium" : "low",
  };
}

// ─── Main Page ───────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { activeMenu, setActiveMenu } = useDashboardMenu();

  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cost
  const [cogsRate, setCogsRate] = useState(30);
  const [shippingRate, setShippingRate] = useState(20);
  const [marketingRate, setMarketingRate] = useState(25);

  // Diagnosis
  const [sheetOpen, setSheetOpen] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [typewriterText, setTypewriterText] = useState("");

  // ── Init stores ──
  useEffect(() => {
    const loaded = loadStores();
    const savedId = localStorage.getItem(CURRENT_ID_KEY);
    if (loaded.length === 0) { router.replace("/config"); return; }
    setStores(loaded);
    const validId = savedId && loaded.some((s) => s.id === savedId) ? savedId : loaded[0].id;
    setCurrentStoreId(validId);
    localStorage.setItem(CURRENT_ID_KEY, validId);
  }, [router]);

  const currentStore = useMemo(() => stores.find((s) => s.id === currentStoreId) ?? null, [stores, currentStoreId]);

  // ── Fetch data ──
  const fetchData = useCallback(async (store: StoreEntry) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/shopify/dashboard?${new URLSearchParams({ shopUrl: store.shopUrl, accessToken: store.accessToken })}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "请求失败");
      setData(json as DashboardData);
      if (json.shopName && store.shopName !== json.shopName) {
        const all = loadStores();
        const idx = all.findIndex((s) => s.id === store.id);
        if (idx !== -1) { all[idx].shopName = json.shopName; saveStores(all); setStores(all); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "未知错误"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (currentStore) fetchData(currentStore); }, [currentStore, fetchData]);

  // Reset diagnosis on store switch
  useEffect(() => { setDiagnosis(null); setDiagnosing(false); setTypewriterText(""); }, [currentStoreId]);

  // ── Store switch ──
  const handleStoreChange = useCallback((id: string | null) => {
    if (!id) return;
    if (id === "__add__") { router.push("/config"); return; }
    localStorage.setItem(CURRENT_ID_KEY, id);
    setCurrentStoreId(id);
  }, [router]);

  const handleRemoveStore = useCallback(() => {
    if (!currentStoreId) return;
    const updated = stores.filter((s) => s.id !== currentStoreId);
    saveStores(updated); setStores(updated);
    if (updated.length === 0) { localStorage.removeItem(CURRENT_ID_KEY); router.replace("/config"); }
    else { const nextId = updated[0].id; localStorage.setItem(CURRENT_ID_KEY, nextId); setCurrentStoreId(nextId); }
  }, [currentStoreId, stores, router]);

  // ── Derived calcs ──
  const computedCharts = useMemo(() => {
    if (!data) return [];
    const currentHour = new Date().getHours();
    const exchangeRate = data.exchangeRate;
    const buckets = new Array(24).fill(0).map(() => ({ count: 0, sales: 0 })) as Array<{ count: number; sales: number }>;
    for (const order of data.orders) {
      const bh = (new Date(order.created_at).getUTCHours() + 8) % 24;
      // Only count orders up to current real-world hour (no future data leak)
      if (bh > currentHour) continue;
      buckets[bh].count += 1;
      buckets[bh].sales += (parseFloat(order.total_price) || 0) * exchangeRate;
    }
    return buckets
      .map((b, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, count: b.count, sales: Math.round(b.sales * 100) / 100 }))
      .slice(0, currentHour + 1);
  }, [data]);

  const totalCostRate = cogsRate + shippingRate + marketingRate;
  const profit = data ? data.gmv * (1 - totalCostRate / 100) : 0;
  const profitMargin = data && data.gmv > 0 ? (profit / data.gmv) * 100 : 0;
  const pieData = [
    { name: "采购成本", value: data ? (data.gmv * cogsRate) / 100 : 0, color: "#ef4444" },
    { name: "物流运费", value: data ? (data.gmv * shippingRate) / 100 : 0, color: "#f59e0b" },
    { name: "广告投放", value: data ? (data.gmv * marketingRate) / 100 : 0, color: "#3b82f6" },
    { name: "纯利润", value: profit, color: "#10b981" },
  ];

  const refundedOrders = useMemo(() => data?.orders.filter((o) => o.financial_status === "refunded") ?? [], [data]);
  const refundRate = data && data.orderCount > 0 ? (refundedOrders.length / data.orderCount) * 100 : 0;
  const refundAmount = refundedOrders.reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0);

  const productRiskMap = useMemo(() => {
    const map = new Map<number, { level: string }>();
    if (!data) return map;
    for (const order of refundedOrders) {
      for (const product of data.products) {
        const key = `${order.id}-${product.id}`;
        if (key.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 5 === 0) map.set(product.id, { level: "高危欺诈" });
      }
    }
    for (const product of data.products) {
      if (!map.has(product.id)) {
        map.set(product.id, { level: product.inventory < 5 ? "需关注" : "低风险" });
      }
    }
    return map;
  }, [data, refundedOrders]);

  // ── Diagnosis handler ──
  const handleStartDiagnosis = async () => {
    if (!data || (data.domain !== currentStore?.shopUrl && data.shopName !== currentStore?.shopName)) return;
    setDiagnosing(true); setDiagnosis(null); setTypewriterText("");
    const lines = ["DeepSeek 正在深度剖析今日站点运营数据...", "正在分析 GMV 趋势与订单分布...", "检查商品库存健康度...", "生成跨境操盘手诊断报告..."];

    // ── 轨 A: Demo — 本地预设诊断 ──
    if (currentStore?.isDemo) {
      for (const l of lines) { setTypewriterText(l); await new Promise((r) => setTimeout(r, 800)); }
      setDiagnosis(generateDiagnosis({
        shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
        exchangeRate: data.exchangeRate, currency: data.currency,
        products: data.products, isDemo: true,
      }));
      setDiagnosing(false);
      return;
    }

    // ── 轨 B: Real — 调用后端 POST /api/shopify/dashboard → DeepSeek API ──
    try {
      for (const l of lines) { setTypewriterText(l); await new Promise((r) => setTimeout(r, 800)); }

      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDemo: false,
          metrics: {
            shopName: data.shopName,
            gmv: data.gmv,
            orderCount: data.orderCount,
            conversionRate: data.conversionRate,
            products: data.products,
            refundRate,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.diagnosis) {
        setDiagnosis(json.diagnosis);
        setDiagnosisError(null);
      } else {
        // Show graceful error but still provide local diagnosis
        setDiagnosisError(json.error || "AI 诊断服务暂时不可用，已启用本地离线诊断模式。");
        setDiagnosis(generateDiagnosis({
          shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
          exchangeRate: data.exchangeRate, currency: data.currency,
          products: data.products, isDemo: false,
        }));
      }
    } catch {
      setDiagnosisError("⚠️ 核心数据已同步，但检测到系统未配置 DeepSeek 密钥，AI 智能诊断暂时无法激活，其余统计功能正常使用。");
      setDiagnosis(generateDiagnosis({
        shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
        exchangeRate: data.exchangeRate, currency: data.currency,
        products: data.products, isDemo: false,
      }));
    }
    setDiagnosing(false);
  };

  // ── Loading ──
  if (loading && !data) return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardContent className="flex flex-col items-center gap-5 py-16 px-16">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-500/30" />
            <Globe className="relative h-7 w-7 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-lg font-semibold text-foreground">正在同步 Shopify 跨境数据...</p>
          <div className="h-1 w-48 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" /></div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md border-border/40 bg-card/80 shadow-2xl backdrop-blur-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20"><AlertCircle className="h-6 w-6 text-red-500" /></div>
          <p className="text-lg font-medium text-foreground">数据加载失败</p>
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <div className="flex gap-3">
            <Button onClick={() => currentStore && fetchData(currentStore)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"><RefreshCw className="h-4 w-4" />重试</Button>
            <Button variant="outline" onClick={() => { localStorage.removeItem("shopify_stores"); localStorage.removeItem("shopify_current_store_id"); router.replace("/config"); }} className="gap-2"><LogOut className="h-4 w-4" />返回配置</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!data) return null;

  // ── Render ──
  return (
    <div className="w-full">
      {activeMenu === "overview" && (
        <OverviewPanel
          data={data} currentStore={currentStore} stores={stores}
          cogsRate={cogsRate} setCogsRate={setCogsRate} shippingRate={shippingRate} setShippingRate={setShippingRate} marketingRate={marketingRate} setMarketingRate={setMarketingRate}
          totalCostRate={totalCostRate} profit={profit} profitMargin={profitMargin}
          refundRate={refundRate} refundedOrders={refundedOrders} refundAmount={refundAmount}
          pieData={pieData} productRiskMap={productRiskMap}
          fetchData={fetchData} handleStoreChange={handleStoreChange} handleRemoveStore={handleRemoveStore} handleAddStore={() => router.push("/config")} handleStartDiagnosis={handleStartDiagnosis}
          sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} diagnosing={diagnosing} diagnosis={diagnosis} typewriterText={typewriterText}
          diagnosisError={diagnosisError}
        />
      )}
      {activeMenu === "ai" && (
        <AiDiagnosePanel
          shopName={data.shopName}
          isDemo={!!currentStore?.isDemo}
          shopId={currentStore?.id}
          gmv={data.gmv}
          orderCount={data.orderCount}
          conversionRate={data.conversionRate}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          products={data.products}
          refundRate={refundRate}
          refundedCount={refundedOrders.length}
          refundAmount={refundAmount}
          cogsRate={cogsRate}
          shippingRate={shippingRate}
          marketingRate={marketingRate}
          orders={data.orders}
        />
      )}
      {activeMenu === "finance" && (
        <FinancePanel shopName={data.shopName} currency={data.currency} exchangeRate={data.exchangeRate} gmv={data.gmv}
          cogsRate={cogsRate} setCogsRate={setCogsRate} shippingRate={shippingRate} setShippingRate={setShippingRate} marketingRate={marketingRate} setMarketingRate={setMarketingRate}
          totalCostRate={totalCostRate} profit={profit} profitMargin={profitMargin} pieData={pieData} />
      )}
      {activeMenu === "risk" && (
        <RiskRadarPanel shopName={data.shopName} refundRate={refundRate} refundedOrders={refundedOrders} refundAmount={refundAmount} exchangeRate={data.exchangeRate} orderCount={data.orderCount} products={data.products} productRiskMap={productRiskMap} />
      )}
      {activeMenu === "trend" && (
        <TrendAnalysisPanel
          shopName={data.shopName}
          isDemo={!!currentStore?.isDemo}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          shopId={currentStore?.id}
        />
      )}
      {activeMenu === "aggregator" && (
        <MultiStoreAggregator
          currentData={{
            gmv: data.gmv,
            orderCount: data.orderCount,
            shopName: data.shopName,
            domain: data.domain,
            orders: data.orders,
            exchangeRate: data.exchangeRate,
          }}
        />
      )}
      {activeMenu === "gateway" && (
        <GatewayFinancePanel
          orders={data.orders}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "funnel" && (
        <FunnelRetentionPanel
          orders={data.orders}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
        />
      )}
      {activeMenu === "ad" && (
        <AdPerformancePanel
          orders={data.orders}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "product-control" && (
        <ProductControlPanel
          isDemo={!!currentStore?.isDemo}
          currentStore={currentStore}
          shopName={data.shopName}
          stores={stores}
          fullProducts={data.fullProducts}
        />
      )}
    </div>
  );
}
