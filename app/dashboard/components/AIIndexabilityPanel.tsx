"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  SearchCheck, Bot, FileSearch, RefreshCw, Download, ClipboardCopy, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Wrench, ListTodo,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "../hooks/useToast";
import { useDashboardMenu } from "../layout";
import {
  checkCrawlerAccess, checkContentQuality, checkEntityAssociation, checkFreshnessSignals,
  checkTechnicalHealth, computeIndexabilityScore, collectIssues, buildReportText,
  parseRobotsTxt, checkHomepageSchema, DIMENSIONS,
  type IndexabilityResult, type Severity, type DimensionKey, type TechnicalHealthInput,
} from "@/lib/ai-indexability-checker";

/* ─── Props ──────────────────────────────────────────── */

interface DashboardFullProduct {
  id: number; title: string; handle: string; descriptionHtml: string; image: string | null;
  productType: string; vendor: string; status: string;
  metafields?: Array<{ namespace: string; key: string; value: string }> | null;
  updated_at?: string; updatedAt?: string;
  variants?: Array<{ variantId: number; name: string; sku: string | null; price: string | number | null; compareAtPrice: string | null; inventory: number }>;
}
interface DashboardContent {
  id: number; title: string; handle: string; bodyHtml: string;
  published?: boolean; created_at?: string; updated_at?: string;
}
interface DashboardBlog {
  id: number; title: string; handle: string;
  articles?: Array<{ id: number; title: string; handle: string; bodyHtml: string; author?: string; published?: boolean; createdAt?: string; updatedAt?: string }>;
}

interface AIIndexabilityPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  domain?: string;
  fullProducts?: DashboardFullProduct[];
  pages?: DashboardContent[] | null;
  blogs?: DashboardBlog[] | null;
  variantSales?: Record<number, number> | null;
}

/* ─── Demo 数据 ───────────────────────────────────────── */

const DEMO_ROBOTS_TXT = `User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: *
Disallow: /checkout
Disallow: /cart
`;

const DEMO_HOMEPAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://demo.myshopify.com/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Demo Store","url":"https://demo.myshopify.com/"}</script>
</head>
<body><h1>Demo Store</h1></body>
</html>`;

const DEMO_PAGE_SPEED = 380;

const DEMO_PRODUCTS: DashboardFullProduct[] = [
  { id: 1, title: "碳纤维智能手表 Chrono X", handle: "chrono-x", descriptionHtml: "<p>TechGear 碳纤维智能手表，7 天续航，支持心率与血氧监测，适合运动与商务场景。</p><a href=\"/collections/wearables\">查看系列</a>", image: "https://demo.myshopify.com/cdn/chrono.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-06-20", metafields: [{ namespace: "judgeme", key: "reviews", value: JSON.stringify([{ reviewer: { name: "A" }, body: "好", rating: 5 }]) }], variants: [{ variantId: 11, name: "标配", sku: "TG-CX-001", price: "299.99", compareAtPrice: "349.99", inventory: 10 }] },
  { id: 2, title: "无线降噪耳机 SonicFlow", handle: "sonicflow", descriptionHtml: "<p>主动降噪，30 小时续航。</p>", image: "https://demo.myshopify.com/cdn/sonic.jpg", productType: "音频设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-05-11", variants: [{ variantId: 12, name: "标配", sku: null, price: "149.99", compareAtPrice: null, inventory: 8 }] },
  { id: 3, title: "AR 护目镜 Air", handle: "ar-goggles-air", descriptionHtml: "<p>轻量碳纤维表壳，7 天超长续航，支持心率与血氧全天候监测，适合运动与户外场景使用。</p>", image: "https://demo.myshopify.com/cdn/ar.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-04-02", variants: [{ variantId: 13, name: "标配", sku: "TG-ARG-001", price: "89.99", compareAtPrice: null, inventory: 5 }] },
  { id: 4, title: "机械键盘 K8 青轴", handle: "k8-blue", descriptionHtml: "<p>KeyLab 热插拔机械键盘，青轴段落感，适合办公与游戏场景，键帽为 PBT 材质。</p><a href=\"/products/chrono-x\">配套手表</a>", image: "https://demo.myshopify.com/cdn/k8.jpg", productType: "电脑外设", vendor: "KeyLab", status: "ACTIVE", updated_at: "2026-03-15", variants: [{ variantId: 14, name: "青轴", sku: "KL-K8-BLU", price: "129.99", compareAtPrice: null, inventory: 20 }] },
  { id: 5, title: "北欧极简台灯 LUX", handle: "lux-lamp", descriptionHtml: "<p>MinimalHome 无极调光护眼 LED 台灯，适合卧室与客厅，铝合金材质，轻便耐用。</p>", image: "https://demo.myshopify.com/cdn/lux.jpg", productType: "家居照明", vendor: "MinimalHome", status: "DRAFT", updated_at: "2024-01-01", metafields: [{ namespace: "judgeme", key: "reviews", value: JSON.stringify([{ reviewer: { name: "B" }, body: "很亮", rating: 5 }]) }], variants: [{ variantId: 15, name: "标配", sku: "MH-LUX-01", price: "79.99", compareAtPrice: "99.99", inventory: 6 }] },
  { id: 6, title: "亚麻抱枕套", handle: "linen-pillow", descriptionHtml: "<p>MinimalHome 天然亚麻抱枕套，亲肤透气，适合卧室与客厅。</p>", image: "https://demo.myshopify.com/cdn/pillow.jpg", productType: "家居纺织品", vendor: "MinimalHome", status: "ACTIVE", updated_at: "2026-02-10", variants: [{ variantId: 16, name: "标配", sku: null, price: null, compareAtPrice: null, inventory: 30 }] },
  { id: 7, title: "便携咖啡手冲壶", handle: "pour-over-kettle", descriptionHtml: "<p>BrewMaster 304 不锈钢手冲壶，精准控温，适合旅行与户外冲泡。</p>", image: "https://demo.myshopify.com/cdn/kettle.jpg", productType: "厨房用品", vendor: "BrewMaster", status: "ACTIVE", updated_at: "2026-06-01", variants: [{ variantId: 17, name: "标配", sku: "BM-KET-01", price: "59.99", compareAtPrice: null, inventory: 12 }] },
  { id: 8, title: "瑜伽垫 Pro", handle: "yoga-mat-pro", descriptionHtml: "<p>FitLife TPE 环保瑜伽垫，防滑回弹，适合瑜伽与运动场景。</p>", image: null, productType: "运动健身", vendor: "FitLife", status: "ACTIVE", updated_at: "2026-05-28", variants: [{ variantId: 18, name: "标配", sku: "FL-YM-PRO", price: "39.99", compareAtPrice: null, inventory: 40 }] },
];

const DEMO_PAGES: DashboardContent[] = [
  { id: 101, title: "关于我们", handle: "about-us", bodyHtml: "<h2>我们的故事</h2><p>成立于 2018 年，专注跨境数码好物，提供运动与商务场景装备。</p>", created_at: "2024-01-01", updated_at: "2026-06-10" },
  { id: 102, title: "配送政策", handle: "shipping", bodyHtml: "<p>默认 7-15 个工作日送达。</p>", created_at: "2024-01-01", updated_at: "2026-01-01" },
];
const DEMO_BLOGS: DashboardBlog[] = [
  { id: 201, title: "博客", handle: "news", articles: [{ id: 2011, title: "2026 智能手表选购指南", handle: "smartwatch-guide", bodyHtml: "<h2>怎么选智能手表？</h2><p>看续航与传感器，TechGear 品牌表现优秀。</p>", createdAt: "2026-06-25" }] },
];

const DEMO_VARIANT_SALES: Record<number, number> = { 11: 12, 14: 5, 18: 33 };

const SUGGESTED_ROBOTS = `User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: *
Disallow: /admin
Disallow: /checkout
Disallow: /cart
`;

/* ─── 严重度元数据 ─────────────────────────────────────── */

const SEV: Record<Severity, { emoji: string; cls: string; label: string }> = {
  critical: { emoji: "🔴", cls: "text-red-400", label: "阻塞" },
  warning: { emoji: "🟡", cls: "text-amber-400", label: "待优化" },
  pass: { emoji: "🟢", cls: "text-emerald-400", label: "通过" },
};

function scoreColor(s: number): string {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  return "text-red-400";
}

/* ─── 主组件 ──────────────────────────────────────────── */

export default function AIIndexabilityPanel(props: AIIndexabilityPanelProps) {
  const { isDemo, shopUrl, shopName } = props;
  const { setActiveMenu } = useDashboardMenu();
  const { toast, showToast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<IndexabilityResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<DimensionKey>("crawler");
  const [robotsRaw, setRobotsRaw] = useState("");
  const [sitemapStatus, setSitemapStatus] = useState<number | undefined>(undefined);
  const [homepageHtml, setHomepageHtml] = useState("");
  const [pageSpeedMs, setPageSpeedMs] = useState<number | null>(null);

  /* 数据映射 */
  const data = useMemo(() => {
    if (isDemo) {
      return { products: DEMO_PRODUCTS, pages: DEMO_PAGES, blogs: DEMO_BLOGS, variantSales: DEMO_VARIANT_SALES };
    }
    const products = (props.fullProducts || []).map((p) => ({
      id: p.id, title: p.title, descriptionHtml: p.descriptionHtml, image: p.image,
      images: undefined as undefined, vendor: p.vendor, productType: p.productType,
      metafields: p.metafields || null, updated_at: p.updated_at || p.updatedAt,
      variants: (p.variants || []).map((v) => ({ sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice, inventory: v.inventory })),
    }));
    const pages = (props.pages || []).map((c) => ({ id: c.id, title: c.title, bodyHtml: c.bodyHtml }));
    const blogs: Array<{ id: number; title: string; articles: Array<{ id: number; title: string; createdAt?: string }> }> = [];
    for (const b of props.blogs || []) {
      blogs.push({ id: b.id, title: b.title, articles: (b.articles || []).map((a) => ({ id: a.id, title: a.title, createdAt: a.createdAt })) });
    }
    return { products, pages, blogs, variantSales: props.variantSales || null };
  }, [isDemo, props.fullProducts, props.pages, props.blogs, props.variantSales]);

  /* 代理抓取 */
  const proxyFetch = useCallback(async (action: string) => {
    try {
      const res = await fetch("/api/shopify/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shopUrl }),
      });
      const json = await res.json();
      return json || {};
    } catch {
      return { success: false };
    }
  }, [shopUrl]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setProgress(5);

    let rContent = "";
    let sStatus: number | undefined;
    let hHtml = "";
    let speed: number | null = null;

    if (isDemo) {
      rContent = DEMO_ROBOTS_TXT;
      sStatus = 200;
      hHtml = DEMO_HOMEPAGE_HTML;
      speed = DEMO_PAGE_SPEED;
    } else {
      const r = await proxyFetch("fetchRobotsTxt");
      rContent = r.content || "";
      const s = await proxyFetch("fetchSitemap");
      sStatus = typeof s.status === "number" ? s.status : undefined;
      const h = await proxyFetch("fetchHomepage");
      hHtml = h.html || "";
      speed = typeof h.ms === "number" ? h.ms : null;
    }
    setRobotsRaw(rContent);
    setSitemapStatus(sStatus);
    setHomepageHtml(hHtml);
    setPageSpeedMs(speed);
    setProgress(20);

    const crawler = checkCrawlerAccess(rContent, sStatus);
    setProgress(35);
    const content = checkContentQuality(data.products, data.pages, data.blogs as any);
    setProgress(52);
    const entity = checkEntityAssociation(data.products, data.pages);
    setProgress(68);
    const freshness = checkFreshnessSignals(data.products, data.blogs as any, data.variantSales);
    setProgress(83);

    const https = !shopUrl || shopUrl.startsWith("https") || !/^http:/.test(shopUrl);
    const schemaOk = checkHomepageSchema(hHtml);
    const techInput: TechnicalHealthInput = {
      shopUrl, https, robotsTxtContent: rContent, homepageHtml: hHtml, pageSpeedMs: speed, schemaParseOk: schemaOk,
    };
    const technical = checkTechnicalHealth(techInput);
    setProgress(100);

    setResults([crawler, content, entity, freshness, technical]);
    setScanning(false);
  }, [isDemo, proxyFetch, data, shopUrl]);

  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* KPI 派生 */
  const kpi = useMemo(() => {
    if (!results) return { score: 0, passed: 0, total: 0, critical: 0, warning: 0 };
    const total = results.reduce((a, r) => a + r.checks.length, 0);
    let passed = 0, critical = 0, warning = 0;
    for (const r of results) for (const c of r.checks) {
      if (c.passed) passed++;
      if (c.severity === "critical") critical++;
      if (c.severity === "warning") warning++;
    }
    return { score: computeIndexabilityScore(results), passed, total, critical, warning };
  }, [results]);

  const issues = useMemo(() => (results ? collectIssues(results) : []), [results]);

  const activeResult = results?.find((r) => r.dimensionKey === activeTab) || null;

  /* 复制建议配置 */
  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => showToast(`已复制${label}`),
      () => showToast("复制失败，请手动选择"),
    );
  };

  const exportReport = () => {
    if (!results) { showToast("请先完成扫描"); return; }
    const text = buildReportText(results, shopName || (isDemo ? "Demo Store" : "Store"));
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-indexability-${(shopName || "report").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("报告已导出（文本格式）");
  };

  const TABS: Array<{ key: DimensionKey; label: string; icon: ReactNode }> = [
    { key: "crawler", label: "AI Crawler 访问", icon: <Bot className="h-3.5 w-3.5" /> },
    { key: "content", label: "内容质量", icon: <FileSearch className="h-3.5 w-3.5" /> },
    { key: "entity", label: "实体关联", icon: <SearchCheck className="h-3.5 w-3.5" /> },
    { key: "freshness", label: "新鲜度", icon: <RefreshCw className="h-3.5 w-3.5" /> },
    { key: "technical", label: "技术性", icon: <ListTodo className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <SearchCheck className="h-6 w-6 text-emerald-400" />AI 可索引性检查
          {isDemo && <span className="ml-1 text-sm text-amber-400">(演示)</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9" onClick={runScan} disabled={scanning}>
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />{scanning ? "扫描中…" : "开始全站扫描"}
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={exportReport} disabled={!results}>
            <Download className="h-3.5 w-3.5" />导出报告
          </Button>
        </div>
      </div>

      {/* Progress */}
      {scanning && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!results ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center text-base text-muted-foreground">正在扫描全站可索引性，请稍候…</CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">可索引性评分</p>
                <p className={`mt-1 text-2xl font-bold ${scoreColor(kpi.score)}`}>{kpi.score}<span className="text-base text-muted-foreground">/100</span></p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">通过 / 总检查项</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{kpi.passed}<span className="text-base text-muted-foreground">/{kpi.total}</span></p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">阻塞性问题</p>
                <p className="mt-1 text-2xl font-bold text-red-400">{kpi.critical}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">可优化问题</p>
                <p className="mt-1 text-2xl font-bold text-amber-400">{kpi.warning}</p>
              </CardContent>
            </Card>
          </div>

          {/* Global Issues */}
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-3">
              <p className="mb-2 text-base font-semibold text-foreground">全局问题列表（{issues.length}）</p>
              {issues.length === 0 ? (
                <p className="py-6 text-center text-sm text-emerald-400">🎉 未发现阻塞或待优化问题，全站 AI 可索引性良好。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="py-1.5 px-2 text-left">严重度</th>
                        <th className="py-1.5 px-2 text-left">检查维度</th>
                        <th className="py-1.5 px-2 text-left">问题描述</th>
                        <th className="py-1.5 px-2 text-center">影响对象</th>
                        <th className="py-1.5 px-2 text-left">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((it, idx) => (
                        <tr key={idx} className="border-t border-border/10 hover:bg-muted/10">
                          <td className={`py-1.5 px-2 ${SEV[it.severity].cls}`}>{SEV[it.severity].emoji} {SEV[it.severity].label}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{it.dimensionName}</td>
                          <td className="py-1.5 px-2 text-foreground">{it.checkName}{it.affectedCount > 0 ? `（${it.affectedCount} 项）` : ""}</td>
                          <td className="py-1.5 px-2 text-center tabular-nums text-muted-foreground">{it.affectedCount}</td>
                          <td className="py-1.5 px-2">
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setActiveTab(it.dimensionKey)}>查看详情</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const r = results.find((x) => x.dimensionKey === t.key);
              const ds = r ? Math.round((r.checks.reduce((a, c) => a + (c.passed ? (c.severity === "warning" ? 0.5 : 1) : 0), 0) / (r.checks.length || 1)) * 100) : 0;
              const worst = r?.checks.some((c) => c.severity === "critical") ? "critical" : r?.checks.some((c) => c.severity === "warning") ? "warning" : "pass";
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${activeTab === t.key ? "border-emerald-500/50 bg-emerald-500/10 text-foreground" : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  <span className={`text-xs ${worst ? SEV[worst as Severity].cls : ""}`}>{ds}%</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-3 space-y-3">
              <p className="text-base font-semibold text-foreground">{activeResult?.dimensionName}（权重 {Math.round((activeResult?.dimensionWeight || 0) * 100)}%）</p>

              {/* Crawler: robots.txt 预览 + 建议 */}
              {activeTab === "crawler" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">当前 robots.txt 内容</p>
                    <div className="rounded-lg border border-border/30 bg-zinc-950/60 p-2">
                      <RobotsPreview content={robotsRaw} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">建议的 AI 友好白名单</p>
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
                      <pre className="whitespace-pre-wrap text-[11px] font-mono text-emerald-300/90">{SUGGESTED_ROBOTS}</pre>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => copyText(SUGGESTED_ROBOTS, "白名单配置")}>
                      <ClipboardCopy className="h-3 w-3" />复制建议配置
                    </Button>
                    {sitemapStatus !== undefined && (
                      <p className="mt-2 text-xs text-muted-foreground">sitemap.xml 检测：HTTP {sitemapStatus}{sitemapStatus === 200 ? " ✅" : " ⚠️"}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Check list */}
              <div className="space-y-2">
                {activeResult?.checks.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/20 bg-card/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={SEV[c.severity].cls}>{SEV[c.severity].emoji}</span>
                      <span className="text-sm font-medium text-foreground">{c.checkName}</span>
                      <span className="ml-auto text-xs text-muted-foreground">影响 {c.affectedCount} 项</span>
                    </div>
                    {c.affectedItems.length > 0 && (
                      <div className="mt-1.5 max-h-28 overflow-y-auto rounded bg-zinc-950/40 p-1.5 text-xs text-muted-foreground">
                        {c.affectedItems.slice(0, 12).map((it, j) => (
                          <div key={j} className="flex items-center gap-1.5">
                            <span className="text-foreground">{it.title}</span>
                            <span>— {it.detail}</span>
                            {it.id !== 0 && activeResult.dimensionKey !== "crawler" && c.severity !== "pass" && (
                              <button className="ml-1 text-emerald-400 hover:underline" onClick={() => setActiveMenu("product-control")}>编辑</button>
                            )}
                          </div>
                        ))}
                        {c.affectedItems.length > 12 && <div>…共 {c.affectedItems.length} 项</div>}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-start gap-2">
                      <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <p className="text-xs leading-relaxed text-muted-foreground">{c.suggestion}</p>
                    </div>
                    {activeResult.dimensionKey === "crawler" && c.severity !== "pass" && (
                      <Button size="sm" variant="outline" className="mt-1.5 h-6 text-xs" onClick={() => copyText(SUGGESTED_ROBOTS, "白名单配置")}>
                        <ClipboardCopy className="h-3 w-3" />复制建议白名单
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        AI 可索引性检查覆盖「抓取权限 → 内容质量 → 实体关联 → 新鲜度 → 技术健康」五段链路。真实模式下 robots.txt / sitemap.xml / 首页由服务端代理路由抓取（避免浏览器跨域限制），其余分析基于店铺已同步数据。修复建议中的「编辑商品」会跳转到商品管理面板。
      </p>
    </div>
  );
}

/* robots.txt 语法高亮预览 */
function RobotsPreview({ content }: { content: string }) {
  if (!content) return <p className="text-[11px] text-amber-400">（robots.txt 不存在或无法获取 — 默认所有爬虫可访问）</p>;
  const lines = content.split("\n");
  return (
    <pre className="whitespace-pre-wrap text-[11px] font-mono leading-relaxed">
      {lines.map((ln, i) => {
        const t = ln.trim();
        const isComment = t.startsWith("#");
        const isDisallow = /^disallow:/i.test(t);
        const isAllow = /^allow:/i.test(t);
        const isAgent = /^user-agent:/i.test(t);
        const color = isComment ? "text-zinc-500" : isDisallow ? "text-red-400" : isAllow ? "text-emerald-400" : isAgent ? "text-sky-400" : "text-zinc-300";
        return <div key={i} className={color}>{ln || " "}</div>;
      })}
    </pre>
  );
}
