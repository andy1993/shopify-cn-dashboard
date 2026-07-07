"use client";

import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import {
  Braces, Search, Download, ClipboardCopy, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, FileJson, Sparkles, ListChecks, Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SCHEMA_TYPES, runSchemaAudit, computeSiteHealth, buildCsvReport,
  normalizeProductFromDashboard, normalizeContentFromDashboard,
  generateProductJsonLd, generateBreadcrumbJsonLd, generateOrgJsonLd,
  generateWebsiteJsonLd, generateArticleJsonLd, generateFaqJsonLd,
  type SchemaAuditResult, type NormalizedProduct, type NormalizedContent,
  type MissingFieldEntry, type AuditInput,
} from "@/lib/schema-detector";
import { setSchemaGenLink } from "@/lib/schema-gen-link";
import { useDashboardMenu } from "../layout";

/* ─── Props ──────────────────────────────────────────── */

interface DashboardFullProduct {
  id: number; title: string; handle: string; descriptionHtml: string; image: string | null;
  productType: string; vendor: string; status: string;
  variants?: Array<{ variantId: number; name: string; sku: string | null; price: string | number | null; inventory: number }>;
}
interface DashboardContent {
  id: number; title: string; handle: string; bodyHtml: string;
  published?: boolean; seoTitle?: string; seoDescription?: string; created_at?: string; updated_at?: string;
}
interface DashboardBlog {
  id: number; title: string; handle: string;
  articles?: Array<{ id: number; title: string; handle: string; bodyHtml: string; author?: string; published?: boolean; createdAt?: string }>;
}

interface SchemaAuditPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  domain?: string;
  fullProducts?: DashboardFullProduct[];
  pages?: DashboardContent[] | null;
  blogs?: DashboardBlog[] | null;
  collections?: unknown;
}

/* Schema 类型 → 权重 查找表 */
const SCHEMA_WEIGHT: Record<string, number> = Object.fromEntries(SCHEMA_TYPES.map((t) => [t.type, t.weight]));

/* ─── Demo 数据（8 商品 + 2 页面 + 1 博客，覆盖度参差） ───────── */
const DEMO_PRODUCTS: NormalizedProduct[] = [
  { id: 1, title: "碳纤维智能手表 Chrono X", handle: "chrono-x", descriptionHtml: "<p>轻量碳纤维表壳，7 天续航，支持心率与血氧监测。</p>", image: "https://demo.myshopify.com/cdn/chrono.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", sku: "TG-CX-001", price: 299.99, currency: "USD", availability: "https://schema.org/InStock", brand: "TechGear", ratingValue: 4.7, reviewCount: 132, hasReviews: true, url: null, gtin: "1234567890123", mpn: "CX-001" },
  { id: 2, title: "无线降噪耳机 SonicFlow", handle: "sonicflow", descriptionHtml: "<p>主动降噪，30 小时续航。</p>", image: null, productType: "音频设备", vendor: "TechGear", status: "ACTIVE", sku: null, price: 149.99, currency: "USD", availability: "https://schema.org/InStock", brand: "TechGear", ratingValue: null, reviewCount: null, hasReviews: false, url: null, gtin: null, mpn: null },
  { id: 3, title: "AR 护目镜 Air", handle: "ar-goggles-air", descriptionHtml: "", image: "https://demo.myshopify.com/cdn/ar.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", sku: "TG-ARG-001", price: 89.99, currency: "USD", availability: "https://schema.org/InStock", brand: "TechGear", ratingValue: 4.2, reviewCount: 18, hasReviews: false, url: null, gtin: null, mpn: null },
  { id: 4, title: "机械键盘 K8 青轴", handle: "k8-blue", descriptionHtml: "<p>热插拔机械键盘，青轴段落感。</p>", image: "https://demo.myshopify.com/cdn/k8.jpg", productType: "电脑外设", vendor: "KeyLab", status: "ACTIVE", sku: "KL-K8-BLU", price: 129.99, currency: "USD", availability: "https://schema.org/InStock", brand: "KeyLab", ratingValue: null, reviewCount: null, hasReviews: false, url: null, gtin: null, mpn: null },
  { id: 5, title: "北欧极简台灯 LUX", handle: "lux-lamp", descriptionHtml: "<p>无极调光，护眼 LED。</p>", image: "https://demo.myshopify.com/cdn/lux.jpg", productType: "家居照明", vendor: "MinimalHome", status: "DRAFT", sku: "MH-LUX-01", price: 79.99, currency: "USD", availability: "https://schema.org/PreOrder", brand: "MinimalHome", ratingValue: 4.9, reviewCount: 56, hasReviews: true, url: null, gtin: null, mpn: null },
  { id: 6, title: "亚麻抱枕套", handle: "linen-pillow", descriptionHtml: "<p>天然亚麻，亲肤透气。</p>", image: "https://demo.myshopify.com/cdn/pillow.jpg", productType: "家居纺织品", vendor: "MinimalHome", status: "ACTIVE", sku: null, price: null, currency: "USD", availability: null, brand: "MinimalHome", ratingValue: null, reviewCount: null, hasReviews: false, url: null, gtin: null, mpn: null },
  { id: 7, title: "便携咖啡手冲壶", handle: "pour-over-kettle", descriptionHtml: "<p>304 不锈钢，精准控温。</p>", image: "https://demo.myshopify.com/cdn/kettle.jpg", productType: "厨房用品", vendor: "BrewMaster", status: "ACTIVE", sku: "BM-KET-01", price: 59.99, currency: "USD", availability: "https://schema.org/InStock", brand: "BrewMaster", ratingValue: 4.5, reviewCount: 41, hasReviews: false, url: null, gtin: null, mpn: null },
  { id: 8, title: "瑜伽垫 Pro", handle: "yoga-mat-pro", descriptionHtml: "<p>TPE 环保材质，防滑回弹。</p>", image: null, productType: "运动健身", vendor: "FitLife", status: "ACTIVE", sku: "FL-YM-PRO", price: 39.99, currency: "USD", availability: "https://schema.org/InStock", brand: "FitLife", ratingValue: null, reviewCount: null, hasReviews: false, url: null, gtin: null, mpn: null },
];

const DEMO_PAGES: NormalizedContent[] = [
  { id: 101, title: "关于我们", handle: "about-us", bodyHtml: "<h2>我们的故事</h2><p>成立于 2018 年，专注跨境数码好物。</p><h2>常见问题？</h2><p>支持全球配送。</p><h2>如何退货？</h2><p>30 天无理由退货。</p>", publishedAt: "2024-01-01", author: "Admin" },
  { id: 102, title: "配送政策", handle: "shipping", bodyHtml: "<p>默认 7-15 个工作日送达。</p>", publishedAt: "2024-01-01", author: "Admin" },
];
const DEMO_ARTICLES: NormalizedContent[] = [
  { id: 201, title: "2026 智能手表选购指南", handle: "smartwatch-guide", bodyHtml: "<h2>怎么选智能手表？</h2><p>看续航与传感器。</p><ol><li>确定预算</li><li>确认功能</li><li>对比品牌</li></ol>", publishedAt: "2026-01-10", author: "Editor" },
];

/* ─── 工具 ──────────────────────────────────────────── */

function buildAuditInput(props: SchemaAuditPanelProps): AuditInput {
  const domain = (props.domain || props.shopUrl || "your-store.myshopify.com").replace(/^https?:\/\//, "");
  if (props.isDemo) {
    return { shopName: props.shopName || "Demo Store", domain, products: DEMO_PRODUCTS, pages: DEMO_PAGES, articles: DEMO_ARTICLES };
  }
  const products = (props.fullProducts || []).map((p) => normalizeProductFromDashboard(p));
  const pages = (props.pages || []).map((c) => normalizeContentFromDashboard({ id: c.id, title: c.title, handle: c.handle, bodyHtml: c.bodyHtml, publishedAt: c.created_at || null, author: null }));
  const articles: NormalizedContent[] = [];
  for (const b of props.blogs || []) {
    for (const a of b.articles || []) {
      articles.push(normalizeContentFromDashboard({ id: a.id, title: a.title, handle: a.handle, bodyHtml: a.bodyHtml, publishedAt: a.createdAt || null, author: a.author || null }));
    }
  }
  return { shopName: props.shopName, domain, products, pages, articles };
}

function healthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}
function healthBadge(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: "优秀", cls: "bg-emerald-500/15 text-emerald-400" };
  if (score >= 60) return { label: "待优化", cls: "bg-amber-500/15 text-amber-400" };
  return { label: "风险", cls: "bg-red-500/15 text-red-400" };
}

/* ─── 主组件 ──────────────────────────────────────────── */

export default function SchemaAuditPanel(props: SchemaAuditPanelProps) {
  const { isDemo, shopName, shopUrl, domain } = props;
  const { setActiveMenu } = useDashboardMenu();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SchemaAuditResult[] | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"missing" | "preview" | "fix">("missing");
  const [selectedPage, setSelectedPage] = useState<MissingFieldEntry | null>(null);
  const [previewJson, setPreviewJson] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3200); }, []);

  const siteHealth = useMemo(() => (results ? computeSiteHealth(results) : 0), [results]);

  const kpis = useMemo(() => {
    if (!results) return null;
    const coveredTypes = results.filter((r) => r.coverageRate >= 0.999).length;
    const totalPages = results.reduce((s, r) => s + r.totalPages, 0);
    const coveredPages = results.reduce((s, r) => s + r.coveredPages, 0);
    const missingCritical = results.reduce((s, r) => s + r.missingFields.length, 0);
    const avgCoverage = totalPages > 0 ? coveredPages / totalPages : 0;
    return { coveredTypes, totalTypes: results.length, coveredPages, totalPages, missingCritical, avgCoverage };
  }, [results]);

  const runScan = useCallback(() => {
    setScanning(true); setProgress(0); setResults(null); setExpandedType(null); setSelectedPage(null); setPreviewJson("");
    const input = buildAuditInput(props);
    let p = 0;
    const timer = setInterval(() => {
      p += Math.random() * 18 + 7;
      if (p >= 100) {
        p = 100; clearInterval(timer);
        const res = runSchemaAudit(input);
        setResults(res);
        setScanning(false);
        showToast("全站 Schema 审计完成");
      }
      setProgress(Math.min(100, Math.round(p)));
    }, 120);
  }, [props, showToast]);

  // 首次进入自动扫描
  useEffect(() => { runScan(); /* eslint-disable-next-line */ }, []);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(label + " 已复制到剪贴板");
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        showToast(label + " 已复制到剪贴板");
      }
    } catch {
      showToast("复制失败，请手动选择文本");
    }
  }, [showToast]);

  const exportCsv = useCallback(() => {
    if (!results) return;
    const csv = buildCsvReport(results, shopName);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${shopName || "store"}_GEO_Schema_审计_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("CSV 缺口报告已下载");
  }, [results, shopName, showToast]);

  // 加载某条缺失记录到预览面板
  const loadPagePreview = useCallback((entry: MissingFieldEntry, type: string) => {
    setSelectedPage(entry);
    const d = (domain || shopUrl || "your-store.myshopify.com").replace(/^https?:\/\//, "");
    let obj: Record<string, unknown> | null = null;
    if (type === "Product" || type === "Review" || type === "AggregateRating" || type === "Offer" || type === "BreadcrumbList" || type === "VideoObject") {
      const prod = (isDemo ? DEMO_PRODUCTS : (props.fullProducts || []).map((p) => normalizeProductFromDashboard(p))).find((x) => x.id === entry.pageId);
      if (prod) {
        if (type === "BreadcrumbList") obj = generateBreadcrumbJsonLd(prod, d);
        else obj = generateProductJsonLd(prod, d);
      }
    } else if (type === "Article" || type === "FAQPage" || type === "HowTo") {
      const all = isDemo ? [...DEMO_PAGES, ...DEMO_ARTICLES] : [
        ...(props.pages || []).map((c) => normalizeContentFromDashboard({ id: c.id, title: c.title, handle: c.handle, bodyHtml: c.bodyHtml, publishedAt: c.created_at || null, author: null })),
        ...(props.blogs || []).flatMap((b) => (b.articles || []).map((a) => normalizeContentFromDashboard({ id: a.id, title: a.title, handle: a.handle, bodyHtml: a.bodyHtml, publishedAt: a.createdAt || null, author: a.author || null }))),
      ];
      const content = all.find((x) => x.id === entry.pageId);
      if (content) {
        const base = (props.blogs || []).some((b) => (b.articles || []).some((a) => a.id === content.id)) ? "blogs" : "pages";
        obj = type === "FAQPage" ? generateFaqJsonLd(content) : generateArticleJsonLd(content, d, base);
      }
    }
    setPreviewJson(obj ? JSON.stringify(obj, null, 2) : "// 该页面暂无可用数据生成预览");
  }, [domain, shopUrl, isDemo, props.fullProducts, props.pages, props.blogs]);

  // 加载类型模板到预览面板（站点级 / 批量修复）
  const loadTypeTemplate = useCallback((type: string) => {
    const d = (domain || shopUrl || "your-store.myshopify.com").replace(/^https?:\/\//, "");
    let obj: Record<string, unknown> | null = null;
    if (type === "Organization") obj = generateOrgJsonLd(shopName, d);
    else if (type === "WebSite") obj = generateWebsiteJsonLd(shopName, d);
    else if (type === "Product") {
      const prods = isDemo ? DEMO_PRODUCTS : (props.fullProducts || []).map((p) => normalizeProductFromDashboard(p));
      obj = { "@context": "https://schema.org", "@graph": prods.map((p) => generateProductJsonLd(p, d)) };
    } else if (type === "BreadcrumbList") {
      const prods = isDemo ? DEMO_PRODUCTS : (props.fullProducts || []).map((p) => normalizeProductFromDashboard(p));
      obj = { "@context": "https://schema.org", "@graph": prods.filter((p) => p.productType || p.vendor).map((p) => generateBreadcrumbJsonLd(p, d)) };
    }
    setPreviewJson(obj ? JSON.stringify(obj, null, 2) : "// 该类型需基于页面数据逐页生成");
  }, [domain, shopUrl, isDemo, shopName, props.fullProducts, props.blogs, props.pages]);

  const expandedResult = results?.find((r) => r.schemaType === expandedType) || null;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Braces className="h-6 w-6 text-emerald-400" />Schema 结构化数据审计
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            {shopName} · GEO（生成式引擎优化）覆盖度分析
            {isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={runScan} disabled={scanning} className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
            <Search className="h-3.5 w-3.5" />{scanning ? "扫描中…" : "重新扫描"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!results} className="h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" />导出 CSV
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {scanning && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">正在遍历商品页、内容页与站点级实体… {progress}%</p>
        </div>
      )}

      {!results && !scanning && (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center text-base text-muted-foreground">尚未扫描，点击「重新扫描」开始全站 GEO 结构化数据审计。</CardContent>
        </Card>
      )}

      {results && kpis && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">全站 GEO 健康分</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${healthColor(siteHealth)}`}>{siteHealth.toFixed(1)}</p>
                <Badge className={`mt-1 text-[9px] ${healthBadge(siteHealth).cls}`}>{healthBadge(siteHealth).label} · 加权综合</Badge>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schema 类型覆盖</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{kpis.coveredTypes}<span className="text-base text-muted-foreground">/{kpis.totalTypes}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">已完整配置的 Schema 类型</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">页面覆盖率</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{Math.round(kpis.avgCoverage * 100)}<span className="text-base text-muted-foreground">%</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{kpis.coveredPages}/{kpis.totalPages} 页面必填字段齐全</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">缺失关键字段</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${kpis.missingCritical > 0 ? "text-red-400" : "text-emerald-400"}`}>{kpis.missingCritical}</p>
                <p className="mt-1 text-xs text-muted-foreground">待修复缺口（页面级）</p>
              </CardContent>
            </Card>
          </div>

          {/* Main: table + preview */}
          <div className="flex flex-col xl:flex-row gap-4 items-start">
            {/* Coverage matrix */}
            <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg flex-1 w-full overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20">
                  <ListChecks className="h-4 w-4 text-emerald-400" />
                  <span className="text-base font-semibold text-foreground">Schema 覆盖矩阵</span>
                  <span className="text-xs text-muted-foreground">（点击类型展开缺口明细）</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pl-3 text-left w-6"></th>
                        <th className="py-2 px-2 text-left">Schema 类型</th>
                        <th className="py-2 px-2 text-center w-14">权重</th>
                        <th className="py-2 px-2 text-center w-20">覆盖页</th>
                        <th className="py-2 px-2 text-center w-20">覆盖率</th>
                        <th className="py-2 px-2 text-center w-24">健康分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => {
                        const isOpen = expandedType === r.schemaType;
                        const cov = Math.round(r.coverageRate * 100);
                        const covColor = r.coverageRate >= 0.999 ? "text-emerald-400" : r.coverageRate >= 0.6 ? "text-amber-400" : "text-red-400";
                        return (
                          <Fragment key={r.schemaType}>
                            <tr
                              className={`border-b border-border/10 cursor-pointer hover:bg-muted/10 ${isOpen ? "bg-muted/10" : ""}`}
                              onClick={() => { setExpandedType(isOpen ? null : r.schemaType); setSelectedPage(null); if (!isOpen) { setDetailTab("missing"); if (["Organization", "WebSite"].includes(r.schemaType)) loadTypeTemplate(r.schemaType); } }}
                            >
                              <td className="py-2 pl-3">{isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground font-medium">{r.title}</span>
                                  {r.missingFields.length > 0 && <Badge className="text-[8px] bg-red-500/15 text-red-400 px-1.5">{r.missingFields.length} 缺口</Badge>}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center tabular-nums text-muted-foreground">{Math.round((SCHEMA_WEIGHT[r.schemaType] || 0) * 100)}%</td>
                              <td className="py-2 px-2 text-center tabular-nums text-foreground">{r.coveredPages}/{r.totalPages}</td>
                              <td className={`py-2 px-2 text-center tabular-nums font-semibold ${covColor}`}>{cov}%</td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                                    <div className={`h-full rounded-full ${r.coverageRate >= 0.999 ? "bg-emerald-500" : r.coverageRate >= 0.6 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${cov}%` }} />
                                  </div>
                                  <span className={`tabular-nums text-xs ${covColor}`}>{cov}</span>
                                </div>
                              </td>
                            </tr>
                            {isOpen && expandedResult && (
                              <tr className="border-b border-border/10 bg-muted/5">
                                <td colSpan={6} className="px-3 py-3">
                                  {/* Tabs */}
                                  <div className="mb-3 flex gap-1.5">
                                    {([["missing", "缺失清单"], ["preview", "已有 Schema 预览"], ["fix", "批量修复"]] as const).map(([k, label]) => (
                                      <button
                                        key={k}
                                        onClick={() => { setDetailTab(k); if (k === "fix") loadTypeTemplate(r.schemaType); }}
                                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${detailTab === k ? "bg-emerald-500/15 text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
                                      >
                                        {k === "missing" && <AlertTriangle className="h-3 w-3" />}
                                        {k === "preview" && <FileJson className="h-3 w-3" />}
                                        {k === "fix" && <Wrench className="h-3 w-3" />}
                                        {label}
                                      </button>
                                    ))}
                                  </div>

                                  {detailTab === "missing" && (
                                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                      {expandedResult.missingFields.length === 0 ? (
                                        <div className="flex items-center gap-2 text-[11px] text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />该类型在所有页面均已完整覆盖，无需修复。</div>
                                      ) : (
                                        expandedResult.missingFields.map((m, i) => (
                                          <button
                                            key={i}
                                            onClick={() => loadPagePreview(m, r.schemaType)}
                                            className="flex w-full items-start gap-2 rounded-md border border-border/20 bg-background/40 px-2.5 py-1.5 text-left hover:border-emerald-500/30 transition-colors"
                                          >
                                            <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">#{m.pageId}</span>
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-[11px] font-medium text-foreground">{m.pageTitle}</p>
                                              <p className="text-[9px] text-muted-foreground truncate">{m.pageUrl}</p>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {m.missingFieldNames.map((f) => <span key={f} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">{f}</span>)}
                                              </div>
                                            </div>
                                            <FileJson className="h-3 w-3 shrink-0 text-muted-foreground mt-1" />
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  )}

                                  {detailTab === "preview" && (
                                    <div className="text-[11px] text-muted-foreground">
                                      {selectedPage ? (
                                        <p>已加载页面「{selectedPage.pageTitle}」的推荐 JSON-LD，详见右侧预览面板。点击「复制」即可注入店铺主题。</p>
                                      ) : (
                                        <p>{["Organization", "WebSite"].includes(r.schemaType)
                                          ? "站点级 Schema 模板已生成，详见右侧预览面板。"
                                          : "点击上方任一缺口页面，查看该页推荐生成的 JSON-LD。"}</p>
                                      )}
                                    </div>
                                  )}

                                  {detailTab === "fix" && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] text-muted-foreground">
                                        推荐将以下 JSON-LD 注入对应模板（商品页 / 页面 / theme.liquid）。选中右侧代码后复制，或点击「复制模板」。
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { loadTypeTemplate(r.schemaType); setTimeout(() => copyText(previewJson, "类型模板"), 50); }}>
                                          <ClipboardCopy className="h-3 w-3" />复制{r.title}模板
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs gap-1 bg-emerald-600 text-white hover:bg-emerald-500"
                                          onClick={() => {
                                            const field = selectedPage?.missingFieldNames[0]
                                              || expandedResult?.missingFields[0]?.missingFieldNames[0]
                                              || r.schemaType;
                                            const productIds = selectedPage
                                              ? [selectedPage.pageId]
                                              : (expandedResult?.missingFields || []).map((m) => m.pageId);
                                            setSchemaGenLink({ scope: "missing_field", fieldName: field, schemaType: r.schemaType, productIds });
                                            setActiveMenu("schema-generator");
                                          }}
                                        >
                                          <Wrench className="h-3 w-3" />一键生成并注入修复
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* JSON-LD Preview (right 400px) */}
            <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg w-full xl:w-[400px] xl:shrink-0">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span className="text-base font-semibold text-foreground">JSON-LD 预览</span>
                  </div>
                  {previewJson && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300" onClick={() => copyText(previewJson, "JSON-LD")}>
                      <ClipboardCopy className="h-3 w-3" />复制
                    </Button>
                  )}
                </div>
                <div className="max-h-[520px] overflow-auto p-3">
                  {previewJson ? (
                    <pre className="whitespace-pre-wrap break-all text-xs leading-relaxed text-emerald-300/90 font-mono">{previewJson}</pre>
                  ) : (
                    <p className="py-16 text-center text-[11px] text-muted-foreground">
                      选择左侧缺口页面或类型<br />查看可注入的 JSON-LD 代码
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footnote */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            GEO（Generative Engine Optimization）通过补全 Schema.org 结构化数据，提升商品与内容被 ChatGPT / Perplexity / Google AI Overview 等生成式引擎引用与摘要的概率。本面板基于店铺已同步数据评估字段完备度，生成的 JSON-LD 需由你粘贴至 Shopify 主题模板后生效。
          </p>
        </>
      )}
    </div>
  );
}
