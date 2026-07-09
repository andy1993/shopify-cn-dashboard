"use client";

import { Fragment, useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  Search, BarChart4, RefreshCw, Download, ListTodo, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronRight, XCircle, EyeOff, CheckCheck,
  Pencil, Image as ImageIcon, ExternalLink, FileSearch,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "../hooks/useToast";
import { useDashboardMenu } from "../layout";
import { cn } from "@/lib/utils";
import {
  scanSEODuplicateTitles, scanSEODuplicateDescriptions, scanSEOMissingDescriptions,
  scanSEODefaultHomepageTitle, scanSEOTitleLength, scanSEODescriptionLength,
  scanSEOAltText, scanSEOHandleFormat, scanSEOInternalLinks, scanSEOH1Tags,
  scanSEOImageCount, scanSEOBrandInTitle, scanSEOCanonical, scanSEOStructuredData,
  scanSEOSitemap, scanSEOMobileFriendly,   scanSEOFAQSchema, computeSEOHealthScore,
  buildSeoReportMarkdown, buildSeoCsv, downloadText,
  SEO_CATEGORY_META, SEO_CATEGORY_WEIGHT, type SEOCheckResult, type SEOIssue, type SEOCheckCategory, type SEOKpi,
} from "@/lib/seo-scanner";

/* ─── Props ──────────────────────────────────────────── */

interface SEOHealthPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  domain?: string;
  fullProducts?: any[];
  pages?: any[] | null;
  blogs?: any[] | null;
  collections?: any | null;
}

/* ─── Demo 数据 ───────────────────────────────────────── */

const DEMO_HOMEPAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://demo.myshopify.com/">
  <title>Demo Store</title>
</head>
<body><h1>Demo Store</h1></body>
</html>`;

// 演示用结构化数据缓存（Product Schema 仅覆盖 6/18，制造一个可优化问题）
const DEMO_SCHEMA_CACHE = {
  results: [{ schemaType: "Product", totalPages: 18, coveredPages: 6 }],
};

const DEMO_SEO_PRODUCTS: any[] = [
  // 重复标题组 A：智能手表 ×3
  { id: 1, title: "智能手表", handle: "chrono-1", vendor: "TechGear", productType: "可穿戴", status: "ACTIVE", seoDescription: "TechGear 碳纤维智能手表，7 天续航，心率血氧监测，运动商务两用。", descriptionHtml: "<p>TechGear 智能手表，7 天续航。</p>", images: [{ id: "1", src: "a.jpg", alt: "" }] },
  { id: 2, title: "智能手表", handle: "chrono-2", vendor: "TechGear", productType: "可穿戴", status: "ACTIVE", seoDescription: "TechGear 智能手表，支持血氧监测，适合商务场景使用。", descriptionHtml: "<p>另一款智能手表。</p>", images: [{ id: "1", src: "b.jpg", alt: "" }] },
  { id: 3, title: "智能手表", handle: "chrono-3", vendor: "TechGear", productType: "可穿戴", status: "ACTIVE", seoDescription: "TechGear 智能手表青春版，轻量设计，适合学生群体日常佩戴。", descriptionHtml: "<p>青春版智能手表。</p>", images: [{ id: "1", src: "c.jpg", alt: "" }] },
  // 重复标题组 B：无线耳机 ×3
  { id: 4, title: "无线耳机", handle: "ear-1", vendor: "TechGear", productType: "音频", status: "ACTIVE", seoDescription: "TechGear 无线降噪耳机，30 小时续航，LDAC 高清音频，通勤运动必备。", descriptionHtml: "<p>无线降噪耳机。</p>", images: [{ id: "1", src: "d.jpg", alt: "" }] },
  { id: 5, title: "无线耳机", handle: "ear-2", vendor: "TechGear", productType: "音频", status: "ACTIVE", seoDescription: "TechGear 无线耳机青春版，蓝牙 5.3，适合日常通勤与办公场景。", descriptionHtml: "<p>青春版无线耳机。</p>", images: [{ id: "1", src: "e.jpg", alt: "" }] },
  { id: 6, title: "无线耳机", handle: "ear-3", vendor: "TechGear", productType: "音频", status: "ACTIVE", seoDescription: "TechGear 无线耳机 Pro，自适应降噪，双设备切换，长续航设计。", descriptionHtml: "<p>Pro 无线耳机。</p>", images: [{ id: "1", src: "f.jpg", alt: "" }] },
  // 重复标题组 C：保温杯 ×2
  { id: 7, title: "保温杯", handle: "cup-1", vendor: "BrewMaster", productType: "厨房", status: "ACTIVE", seoDescription: "BrewMaster 不锈钢保温杯，12 小时保温，户外旅行随身必备好物。", descriptionHtml: "<p>不锈钢保温杯。</p>", images: [{ id: "1", src: "g.jpg", alt: "" }] },
  { id: 8, title: "保温杯", handle: "cup-2", vendor: "BrewMaster", productType: "厨房", status: "ACTIVE", seoDescription: "BrewMaster 大容量保温杯，便携设计，适合户外与日常使用场景。", descriptionHtml: "<p>大容量保温杯。</p>", images: [{ id: "1", src: "h.jpg", alt: "" }] },
  // 缺失 Meta Description ×5
  { id: 9, title: "蓝牙音箱", handle: "speaker-a", vendor: "TechGear", productType: "音频", status: "ACTIVE", seoDescription: "", descriptionHtml: "<p>便携蓝牙音箱。</p>", images: [{ id: "1", src: "i.jpg", alt: "" }] },
  { id: 10, title: "机械键盘", handle: "kb-a", vendor: "KeyLab", productType: "外设", status: "ACTIVE", seoDescription: "", descriptionHtml: "<p>热插拔机械键盘。</p>", images: [{ id: "1", src: "j.jpg", alt: "" }] },
  { id: 11, title: "护眼台灯", handle: "lamp-a", vendor: "MinimalHome", productType: "家居", status: "ACTIVE", seoDescription: "", descriptionHtml: "<p>无极调光护眼台灯。</p>", images: [{ id: "1", src: "k.jpg", alt: "" }] },
  { id: 12, title: "瑜伽垫", handle: "mat-a", vendor: "FitLife", productType: "运动", status: "ACTIVE", seoDescription: "", descriptionHtml: "<p>TPE 环保瑜伽垫。</p>", images: [{ id: "1", src: "l.jpg", alt: "" }] },
  { id: 13, title: "咖啡壶", handle: "kettle-a", vendor: "BrewMaster", productType: "厨房", status: "ACTIVE", seoDescription: "", descriptionHtml: "<p>手冲咖啡壶。</p>", images: [{ id: "1", src: "m.jpg", alt: "" }] },
  // 其他短标题 / 缺 Alt / 图片不足 / 缺品牌词 商品
  { id: 14, title: "便携充电宝", handle: "power-1", vendor: "PowerX", productType: "数码", status: "ACTIVE", seoDescription: "PowerX 20000mAh 便携充电宝，双向快充，出行必备。", descriptionHtml: "<p>20000mAh 充电宝。</p><a href=\"/collections/power\">查看系列</a>", images: [{ id: "1", src: "n.jpg", alt: "充电宝正面" }, { id: "2", src: "n2.jpg", alt: "充电宝背面" }, { id: "3", src: "n3.jpg", alt: "充电宝接口" }] },
  { id: 15, title: "运动腰包", handle: "bag-1", vendor: "FitLife", productType: "运动", status: "ACTIVE", seoDescription: "FitLife 防水运动腰包，大容量贴身，跑步骑行适用。", descriptionHtml: "<p>防水运动腰包。</p>", images: [{ id: "1", src: "o.jpg", alt: "" }] },
  { id: 16, title: "桌面收纳盒", handle: "box-1", vendor: "MinimalHome", productType: "家居", status: "ACTIVE", seoDescription: "MinimalHome 桌面收纳盒，分格设计，办公整洁利器。", descriptionHtml: "<p>分格收纳盒。</p>", images: [{ id: "1", src: "p.jpg", alt: "" }] },
  { id: 17, title: "数据线", handle: "cable-1", vendor: "PowerX", productType: "数码", status: "ACTIVE", seoDescription: "PowerX 编织数据线，耐拉扯，支持快充协议。", descriptionHtml: "<p>编织数据线。</p>", images: [{ id: "1", src: "q.jpg", alt: "" }] },
  { id: 18, title: "挂钟", handle: "clock-1", vendor: "MinimalHome", productType: "家居", status: "DRAFT", seoDescription: "MinimalHome 静音挂钟，北欧简约，卧室客厅墙面装饰。", descriptionHtml: "<p>静音挂钟。</p>", images: [{ id: "1", src: "r.jpg", alt: "" }] },
];

const DEMO_SEO_PAGES: any[] = [
  { id: 101, title: "关于我们", handle: "about-us", bodyHtml: "<p>成立于 2018 年，专注跨境数码好物。</p>", seoDescription: "关于我们 — Demo Store 品牌故事" },
  { id: 102, title: "配送政策", handle: "shipping", bodyHtml: "<p>默认 7-15 个工作日送达。</p>", seoDescription: "配送政策与时效说明" },
];

/* ─── localStorage 键 ─────────────────────────────────── */

const FIXED_KEY = "seo_fixed_issues";
const IGNORED_KEY = "seo_ignored_issues";

/* ─── 评分色调 ───────────────────────────────────────── */

function scoreColor(s: number): string {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  return "text-red-400";
}

function priorityMeta(cat: SEOCheckCategory): { emoji: string; cls: string } {
  if (cat === "critical") return { emoji: "🔴", cls: "text-red-400" };
  if (cat === "warning") return { emoji: "🟡", cls: "text-amber-400" };
  return { emoji: "🔵", cls: "text-sky-400" };
}

/* ─── 主面板 ──────────────────────────────────────────── */

export default function SEOHealthPanel(props: SEOHealthPanelProps) {
  const { isDemo, shopUrl, shopName } = props;
  const { setActiveMenu } = useDashboardMenu();
  const { showToast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SEOCheckResult[] | null>(null);
  const [scanId, setScanId] = useState<string>("");
  const [scanTime, setScanTime] = useState<string>("");
  const [scanRange, setScanRange] = useState<"all" | "products" | "pages" | "blogs" | "collections">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<SEOCheckCategory>>(new Set(["critical", "warning", "suggestion"]));
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // 修复追踪
  const [fixedMap, setFixedMap] = useState<Record<string, number>>({});
  const [ignoredSet, setIgnoredSet] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);

  /* 数据映射 */
  const data = useMemo(() => {
    if (isDemo) {
      return { products: DEMO_SEO_PRODUCTS, pages: DEMO_SEO_PAGES, blogs: [], collections: [] };
    }
    return {
      products: props.fullProducts ?? [],
      pages: props.pages ?? [],
      blogs: props.blogs ?? [],
      collections: props.collections ?? [],
    };
  }, [isDemo, props.fullProducts, props.pages, props.blogs, props.collections]);

  /* 读取修复/忽略记录 */
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(FIXED_KEY) || "{}");
      setFixedMap(typeof f === "object" && f ? f : {});
    } catch { setFixedMap({}); }
    try {
      const ig = JSON.parse(localStorage.getItem(IGNORED_KEY) || "[]");
      setIgnoredSet(new Set(Array.isArray(ig) ? ig : []));
    } catch { setIgnoredSet(new Set()); }
  }, []);

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

  /* 全站扫描 */
  const runScan = useCallback(async () => {
    setScanning(true);
    setProgress(3);
    setExpandedRow(null);

    const useProducts = scanRange === "all" || scanRange === "products" ? data.products : [];
    const usePages = scanRange === "all" || scanRange === "pages" ? data.pages : [];
    // 博客/集合当前无独立检查项，保留为可用数据源但不参与评分
    void data.blogs; void data.collections;

    let homepageHtml = "";
    let sitemapStatus: number | undefined;
    let schemaCache: any = null;

    if (isDemo) {
      homepageHtml = DEMO_HOMEPAGE_HTML;
      sitemapStatus = 200;
      schemaCache = DEMO_SCHEMA_CACHE;
    } else {
      const h = await proxyFetch("fetchHomepage");
      homepageHtml = h.html || "";
      const s = await proxyFetch("fetchSitemap");
      sitemapStatus = typeof s.status === "number" ? s.status : undefined;
      try {
        const cached = localStorage.getItem("geo_wizard_step2");
        schemaCache = cached ? JSON.parse(cached)?.result ?? null : null;
      } catch { schemaCache = null; }
    }
    setProgress(12);

    // 严重组
    const r1 = scanSEODuplicateTitles(useProducts); setProgress(18);
    const r2 = scanSEODuplicateDescriptions(useProducts); setProgress(24);
    const r3 = scanSEOMissingDescriptions(useProducts, usePages); setProgress(30);
    const r4 = scanSEODefaultHomepageTitle(homepageHtml); setProgress(36);
    // 警告组
    const r5 = scanSEOTitleLength(useProducts); setProgress(44);
    const r6 = scanSEODescriptionLength(useProducts); setProgress(52);
    const r7 = scanSEOAltText(useProducts); setProgress(60);
    const r8 = scanSEOHandleFormat(useProducts); setProgress(68);
    // 建议组
    const r9 = scanSEOInternalLinks(useProducts, usePages); setProgress(74);
    const r10 = scanSEOH1Tags(usePages); setProgress(80);
    const r11 = scanSEOImageCount(useProducts); setProgress(85);
    const r12 = scanSEOBrandInTitle(useProducts); setProgress(89);
    const r13 = scanSEOCanonical(homepageHtml); setProgress(92);
    const r14 = scanSEOStructuredData(schemaCache); setProgress(95);
    const r15 = scanSEOSitemap(sitemapStatus); setProgress(98);
    const r16 = scanSEOFAQSchema(useProducts); setProgress(99);

    const all: SEOCheckResult[] = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16];
    setResults(all);
    setScanId(`scan_${Date.now()}`);
    setScanTime(new Date().toLocaleString("zh-CN"));
    setProgress(100);

    // 修复追踪对账：仍存在的问题从 fixedMap 移除（状态回退为 🔴）
    const currentKeys = new Set(all.flatMap((r) => r.issues.map((i) => i.key)));
    setFixedMap((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [k, ts] of Object.entries(prev)) {
        if (currentKeys.has(k)) { changed = true; continue; } // 问题仍存在 → 回退
        next[k] = ts;
      }
      if (changed) {
        try { localStorage.setItem(FIXED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });

    setScanning(false);
  }, [isDemo, proxyFetch, data, scanRange]);

  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 派生：问题清单 + KPI */
  const allIssues = useMemo<SEOIssue[]>(
    () => (results ? results.flatMap((r) => r.issues) : []),
    [results],
  );

  const displayedIssues = useMemo<SEOIssue[]>(
    () => allIssues.filter((i) => showIgnored || !ignoredSet.has(i.key)),
    [allIssues, ignoredSet, showIgnored],
  );

  const kpi = useMemo<SEOKpi>(() => {
    if (!results) {
      return { score: 0, totalIssues: 0, fixedCount: 0, unfixedCount: 0, criticalCount: 0, warningCount: 0, suggestionCount: 0 };
    }
    const score = computeSEOHealthScore(results);
    const criticalCount = displayedIssues.filter((i) => i.category === "critical").length;
    const warningCount = displayedIssues.filter((i) => i.category === "warning").length;
    const suggestionCount = displayedIssues.filter((i) => i.category === "suggestion").length;
    const inSessionFixed = displayedIssues.filter((i) => i.key in fixedMap).length;
    return {
      score,
      totalIssues: displayedIssues.length,
      fixedCount: Object.keys(fixedMap).length,
      unfixedCount: displayedIssues.length - inSessionFixed,
      criticalCount,
      warningCount,
      suggestionCount,
    };
  }, [results, displayedIssues, fixedMap]);

  /* ── 操作 ── */
  const ignoreIssue = useCallback((key: string) => {
    setIgnoredSet((prev) => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem(IGNORED_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
    showToast("已忽略该问题（下次扫描不再报告）");
  }, [showToast]);

  const markFixed = useCallback((key: string) => {
    setFixedMap((prev) => {
      const next = { ...prev, [key]: Date.now() };
      try { localStorage.setItem(FIXED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    showToast("已标记为已修复，下次扫描将验证");
  }, [showToast]);

  const markAllFixed = useCallback(() => {
    setFixedMap((prev) => {
      const next = { ...prev };
      displayedIssues.forEach((i) => { next[i.key] = Date.now(); });
      try { localStorage.setItem(FIXED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    showToast(`已标记 ${displayedIssues.length} 项问题为已修复`);
  }, [displayedIssues, showToast]);

  const restoreIgnored = useCallback(() => {
    setIgnoredSet(new Set());
    try { localStorage.removeItem(IGNORED_KEY); } catch { /* ignore */ }
    showToast("已恢复全部被忽略的问题");
  }, [showToast]);

  const openProductEdit = useCallback((productId: number, tab: "basic" | "seo" | "images") => {
    try { localStorage.setItem("pc_edit_request", JSON.stringify({ productId, tab })); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent("pc-edit-request")); } catch { /* ignore */ }
    setActiveMenu("product-control");
  }, [setActiveMenu]);

  /* 导出 */
  const exportCsv = () => {
    if (displayedIssues.length === 0) { showToast("暂无问题可导出"); return; }
    const csv = buildSeoCsv(displayedIssues);
    downloadText(`seo-issues-${(shopName || "report").replace(/\s+/g, "-")}.csv`, csv, "text/csv");
    showToast("问题清单 CSV 已导出");
  };

  const exportMarkdown = () => {
    if (!results) { showToast("请先完成扫描"); return; }
    const md = buildSeoReportMarkdown(results, kpi, shopName || (isDemo ? "Demo Store" : "Store"), scanTime || new Date().toLocaleString("zh-CN"));
    downloadText(`SEO健康报告_${shopName || "shop"}_${new Date().toISOString().slice(0, 10)}.md`, md, "text/markdown");
    showToast("SEO 健康报告（Markdown）已导出");
  };

  /* 维度分组 */
  const groups: SEOCheckCategory[] = ["critical", "warning", "suggestion"];
  const groupedChecks = useMemo(() => {
    const m: Record<SEOCheckCategory, SEOCheckResult[]> = { critical: [], warning: [], suggestion: [] };
    (results || []).forEach((r) => m[r.checkCategory].push(r));
    return m;
  }, [results]);

  function toggleGroup(cat: SEOCheckCategory) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  /* 行操作按钮 */
  function rowActions(issue: SEOIssue) {
    const actions: ReactNode[] = [];
    if (issue.groupItems && issue.groupItems.length > 0) {
      actions.push(
        <Button key="view" size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setExpandedRow((p) => (p === issue.key ? null : issue.key)); }}>
          <EyeOff className="h-3 w-3" />{expandedRow === issue.key ? "收起" : "查看"}
        </Button>,
      );
    }
    if (issue.editTab && issue.targetType === "product") {
      const label = issue.editTab === "seo" ? "编辑SEO" : issue.editTab === "images" ? "添加Alt" : "编辑";
      const Icon = issue.editTab === "images" ? ImageIcon : Pencil;
      actions.push(
        <Button key="edit" size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openProductEdit(issue.targetId, issue.editTab as any); }}>
          <Icon className="h-3 w-3" />{label}
        </Button>,
      );
    }
    actions.push(
      <Button key="fix" size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300" onClick={(e) => { e.stopPropagation(); markFixed(issue.key); }}>
        <CheckCheck className="h-3 w-3" />修复
      </Button>,
    );
    actions.push(
      <Button key="ignore" size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-rose-400" onClick={(e) => { e.stopPropagation(); ignoreIssue(issue.key); }}>
        <XCircle className="h-3 w-3" />忽略
      </Button>,
    );
    return actions;
  }

  const hasResults = results !== null;
  const ignoredCount = useMemo(() => allIssues.filter((i) => ignoredSet.has(i.key)).length, [allIssues, ignoredSet]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Search className="h-6 w-6 text-emerald-400" />SEO 健康扫描
          {isDemo && <span className="ml-1 text-sm text-amber-400">(演示)</span>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-300 outline-none"
            value={scanRange}
            onChange={(e) => setScanRange(e.target.value as any)}
            disabled={scanning}
          >
            <option value="all">扫描范围：全部</option>
            <option value="products">仅商品</option>
            <option value="pages">仅页面</option>
            <option value="blogs">仅博客</option>
            <option value="collections">仅集合</option>
          </select>
          <Button size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-500" onClick={runScan} disabled={scanning}>
            <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />{scanning ? "扫描中…" : "开始全站扫描"}
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={exportCsv} disabled={!hasResults}>
            <Download className="h-3.5 w-3.5" />导出 CSV
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={exportMarkdown} disabled={!hasResults}>
            <FileSearch className="h-3.5 w-3.5" />导出报告
          </Button>
        </div>
      </div>

      {scanTime && !scanning && (
        <p className="text-sm text-muted-foreground">上次扫描：{scanTime} · Scan ID：{scanId}</p>
      )}

      {/* Progress */}
      {scanning && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!hasResults ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center text-base text-muted-foreground">正在扫描全站 SEO 基础指标，请稍候…</CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO 健康分</p>
                <p className={cn("mt-1 text-2xl font-bold", scoreColor(kpi.score))}>{kpi.score}<span className="text-base text-muted-foreground">/100</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">12+ 项检查加权</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">问题 / 已修复 / 未修复</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {kpi.totalIssues}<span className="text-base text-muted-foreground"> / </span>
                  <span className="text-emerald-400">{kpi.fixedCount}</span><span className="text-base text-muted-foreground"> / </span>
                  <span className="text-amber-400">{kpi.unfixedCount}</span>
                </p>
                <Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-xs text-zinc-400 hover:text-emerald-300" onClick={markAllFixed}>
                  <CheckCheck className="h-3 w-3" />标记全部已修复
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">阻塞性问题（🔴）</p>
                <p className="mt-1 text-2xl font-bold text-red-400">{kpi.criticalCount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">直接影响排名</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">可优化问题（🟡🔵）</p>
                <p className="mt-1 text-2xl font-bold text-amber-400">{kpi.warningCount + kpi.suggestionCount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">影响排名但不阻塞</p>
              </CardContent>
            </Card>
          </div>

          {/* 被忽略提示 */}
          {ignoredCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2">
              <p className="text-sm text-zinc-400">已忽略 {ignoredCount} 项问题（{showIgnored ? "当前已显示" : "当前已隐藏"}）。</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowIgnored((v) => !v)}>
                  {showIgnored ? "隐藏已忽略" : "显示已忽略"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300" onClick={restoreIgnored}>
                  恢复全部
                </Button>
              </div>
            </div>
          )}

          {/* 维度折叠组 */}
          <div className="space-y-3">
            {groups.map((cat) => {
              const meta = SEO_CATEGORY_META[cat];
              const checks = groupedChecks[cat];
              const grpIssues = checks.reduce((a, c) => a + c.issues.length, 0);
              const expanded = expandedGroups.has(cat);
              return (
                <Card key={cat} className="border-border/40 bg-card/60">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    onClick={() => toggleGroup(cat)}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                    <span className={cn("text-base font-semibold", meta.tone)}>{meta.emoji} {meta.label}</span>
                    <Badge className={cn("ml-1", cat === "critical" ? "bg-red-500/15 text-red-400 border-red-500/30" : cat === "warning" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-sky-500/15 text-sky-400 border-sky-500/30")}>
                      {grpIssues} 项问题
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">权重 {Math.round(SEO_CATEGORY_WEIGHT[cat] * 100)}%</span>
                  </button>
                  {expanded && (
                    <CardContent className="space-y-2 border-t border-border/10 p-3">
                      {checks.map((c, i) => {
                        const ratio = c.totalCount > 0 ? c.passedCount / c.totalCount : 1;
                        const pts = Math.round(c.maxPoints * ratio * 10) / 10;
                        const ok = c.issues.length === 0;
                        return (
                          <div key={i} className="rounded-lg border border-border/20 bg-card/40 p-2.5">
                            <div className="flex items-center gap-2">
                              {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className={cn("h-4 w-4", meta.tone)} />}
                              <span className="text-base font-medium text-foreground">{c.checkName}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{pts}/{c.maxPoints} 分 · {c.passedCount}/{c.totalCount} 通过</span>
                            </div>
                            {c.note && <p className="mt-1 text-xs text-zinc-500">{c.note}</p>}
                            {c.issues.length > 0 && (
                              <div className="mt-1.5 max-h-32 overflow-y-auto rounded bg-zinc-950/40 p-1.5 text-xs text-muted-foreground">
                                {c.issues.slice(0, 10).map((it, j) => (
                                  <div key={j} className="flex items-center gap-1.5">
                                    <span className="text-foreground">{it.targetTitle}</span>
                                    <span>— {it.currentValue}</span>
                                  </div>
                                ))}
                                {c.issues.length > 10 && <div>…共 {c.issues.length} 项</div>}
                              </div>
                            )}
                            <div className="mt-1.5 flex items-start gap-2">
                              <ListTodo className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                              <p className="text-xs leading-relaxed text-muted-foreground">{c.suggestion}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* 修复清单表格 */}
          <Card className="border-border/40 bg-card/60">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-base font-semibold text-foreground">问题修复清单（{displayedIssues.length}）</span>
                <span className="text-xs text-muted-foreground">点击任意行展开修复建议</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="border-y border-zinc-800 text-sm text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left">优先级</th>
                      <th className="px-3 py-2 text-left">商品/对象</th>
                      <th className="px-3 py-2 text-left">问题</th>
                      <th className="px-3 py-2 text-left">检查项</th>
                      <th className="px-3 py-2 text-left">当前值</th>
                      <th className="px-3 py-2 text-left">建议值</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedIssues.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-emerald-400">🎉 未检测到 SEO 问题，全站基础指标健康！</td></tr>
                    ) : (
                      displayedIssues.map((it) => {
                        const pm = priorityMeta(it.category);
                        const isFixed = it.key in fixedMap;
                        const isOpen = expandedRow === it.key;
                        return (
                          <Fragment key={it.key}>
                            <tr
                              className={cn("cursor-pointer border-b border-zinc-800/60 hover:bg-zinc-800/40", isFixed && "opacity-60")}
                              onClick={() => setExpandedRow((p) => (p === it.key ? null : it.key))}
                            >
                              <td className={cn("px-3 py-2 text-sm font-medium", pm.cls)}>
                                {isFixed ? "✅" : pm.emoji}
                              </td>
                              <td className="px-3 py-2 text-zinc-100">
                                {it.targetTitle}
                                {it.groupItems && it.groupItems.length > 0 && <span className="text-xs text-zinc-500"> ×{it.groupItems.length}</span>}
                              </td>
                              <td className="px-3 py-2 text-zinc-300">{it.checkName}</td>
                              <td className="px-3 py-2 text-xs text-zinc-500">{it.targetType}</td>
                              <td className="px-3 py-2 text-zinc-400">{it.currentValue}</td>
                              <td className="px-3 py-2 text-emerald-300/90">{it.suggestedValue}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  {rowActions(it)}
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b border-zinc-800/60 bg-zinc-950/30">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                                    <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                                      {pm.emoji} {it.checkName}
                                      {isFixed && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">已修复 · {new Date(fixedMap[it.key]).toLocaleDateString("zh-CN")}</Badge>}
                                    </div>
                                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.detail}</p>
                                    {it.groupItems && it.groupItems.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs font-medium text-zinc-400">问题对象（{it.groupItems.length}）：</p>
                                        <div className="mt-1 max-h-32 overflow-y-auto rounded bg-zinc-950/40 p-1.5 text-xs text-muted-foreground">
                                          {it.groupItems.map((g, gi) => (
                                            <div key={gi} className="flex items-center gap-1.5">
                                              <span className="text-foreground">#{g.id} {g.title}</span>
                                              {g.handle && <span>· /{g.handle}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="mt-2 flex items-start gap-2">
                                      <ListTodo className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                                      <p className="text-xs leading-relaxed text-zinc-300">💡 建议：{it.suggestedValue}。{it.category === "critical" ? "该问题会直接稀释排名，建议优先处理。" : ""}</p>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {it.editTab && it.targetType === "product" && (
                                        <Button size="sm" className="h-7 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => openProductEdit(it.targetId, it.editTab as any)}>
                                          <Pencil className="h-3 w-3" />{it.editTab === "seo" ? "编辑 SEO" : it.editTab === "images" ? "添加 Alt" : "编辑商品"}
                                        </Button>
                                      )}
                                      {it.groupItems && it.groupItems.length > 0 && it.targetType === "product" && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { const first = it.groupItems!.find((g) => g.id !== it.targetId) ?? it.groupItems![0]; if (first && it.editTab) openProductEdit(first.id, it.editTab as any); }}>
                                          <Pencil className="h-3 w-3" />批量编辑标题
                                        </Button>
                                      )}
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300" onClick={() => markFixed(it.key)}>
                                        <CheckCheck className="h-3 w-3" />标记为已修复
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-rose-400" onClick={() => ignoreIssue(it.key)}>
                                        <XCircle className="h-3 w-3" />忽略此问题
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        SEO 健康扫描覆盖「重复内容 → 元信息质量 → 技术友好性」三段链路，共 16 项检查（严重 50% / 警告 30% / 建议 20% 加权）。
        真实模式下首页与 sitemap.xml 由服务端代理路由抓取，结构化数据复用 Schema 检测缓存，其余分析基于店铺已同步数据，不额外调用 Shopify API。
        修复按钮会跳转商品管理面板并对准对应 Tab；忽略/修复状态保存在本地，下次扫描自动对账。
      </p>
    </div>
  );
}
