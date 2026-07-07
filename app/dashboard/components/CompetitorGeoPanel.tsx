"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  GitCompare, Swords, Plus, Trash2, RefreshCw, Download, ExternalLink, ChevronDown,
  ChevronRight, Check, X, SearchCheck, Bot, FileSearch, AlertTriangle, CheckCircle2,
  Target, Crosshair, ListTodo, Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "../hooks/useToast";
import { useDashboardMenu } from "../layout";
import {
  runSchemaAudit, normalizeProductFromDashboard, normalizeContentFromDashboard, SCHEMA_TYPES,
  type NormalizedProduct, type NormalizedContent,
} from "@/lib/schema-detector";
import {
  buildOwnGeoResult, buildCompetitorGeoResultFromFetch, parseCompetitorPageHtml,
  extractSeoFromHtml, analyzeRobotsForBots, buildComparisonResult, buildComparisonReportText,
  computeGeoHealth, toneClass,
  type CompetitorGeoResult, type ComparisonResult, type OverviewMetric, type ComparisonRow,
  type MetricBetter, type CellTone, type TodoItem, type TodoPriority,
} from "@/lib/competitor-geo-analyzer";

/* ─── Props ──────────────────────────────────────────── */

interface DashboardFullProduct {
  id: number; title: string; handle: string; descriptionHtml: string; image: string | null;
  productType: string; vendor: string; status: string;
  variants?: Array<{ variantId?: number; name?: string; sku?: string | null; price?: string | number | null; compareAtPrice?: string | null; inventory?: number }>;
}
interface DashboardContent {
  id: number; title: string; handle: string; bodyHtml: string;
  publishedAt?: string | null; author?: string | null;
}
interface DashboardBlog {
  id: number; title: string; handle: string;
  articles?: Array<{ id: number; title: string; handle: string; bodyHtml: string; author?: string | null; publishedAt?: string | null }>;
}

interface CompetitorGeoPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  domain?: string;
  fullProducts?: DashboardFullProduct[];
  pages?: DashboardContent[] | null;
  blogs?: DashboardBlog[] | null;
}

/* ─── 本地类型 ──────────────────────────────────────────── */

interface CompetitorStore { name: string; domain: string; }
type ScopeKey = "all" | "schema" | "seo" | "robots";
type ViewKey = "overview" | "fields" | "todo";

const STORE_KEY = "competitor_stores";
const RESULT_KEY = "competitor_geo_result";
const MAX_COMPETITORS = 10;

/* ─── Demo 数据 ───────────────────────────────────────── */

const DEMO_OWN: CompetitorGeoResult = {
  storeName: "我的店铺（Demo）",
  domain: "demo.myshopify.com",
  schemaCoverage: {
    Product: false, Review: false, FAQPage: true, BreadcrumbList: true, Organization: true,
    Article: false, AggregateRating: false, Offer: false, VideoObject: false, WebSite: false, LocalBusiness: false,
  },
  fieldComparison: {},
  seoMetrics: { titleLength: 42, descriptionLength: 80, hasCanonical: true, imgAltCount: 3 },
  robotsTxtStatus: { gptBotBlocked: false, perplexityBotBlocked: false, googleExtendedBlocked: false, ccBotBlocked: false },
};

const DEMO_COMPETITORS: Array<{ name: string; domain: string; html: string; robots: string }> = [
  {
    name: "竞品 A · NorthWave",
    domain: "northwave-demo.myshopify.com",
    robots: `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: CCBot
Allow: /`,
    html: `<!DOCTYPE html><html><head>
<title>NorthWave 专业运动装备 | 碳纤维智能穿戴</title>
<meta name="description" content="NorthWave 专注碳纤维智能手表与运动穿戴，7 天续航、心率血氧监测，适合运动与户外场景，全球顺丰直邮。">
<link rel="canonical" href="https://northwave-demo.myshopify.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"NorthWave","url":"https://northwave-demo.myshopify.com/","logo":"https://northwave-demo.myshopify.com/logo.png"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"碳纤维智能手表 Chrono X","description":"7 天续航智能手表","image":"https://northwave-demo.myshopify.com/chrono.jpg","brand":{"@type":"Brand","name":"NorthWave"},"aggregateRating":{"@type":"AggregateRating","ratingValue":4.8,"reviewCount":312},"review":{"@type":"Review","reviewRating":{"@type":"Rating","ratingValue":5},"author":{"@type":"Person","name":"Lily"},"reviewBody":"续航真的强"},"offers":{"@type":"Offer","price":299.99,"priceCurrency":"USD","availability":"https://schema.org/InStock","url":"https://northwave-demo.myshopify.com/products/chrono-x"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Chrono X 防水吗？","acceptedAnswer":{"@type":"Answer","text":"支持 5ATM 防水。"}},{"@type":"Question","name":"续航多久？","acceptedAnswer":{"@type":"Answer","text":"典型使用 7 天。"}}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"首页","item":"https://northwave-demo.myshopify.com/"},{"@type":"ListItem","position":2,"name":"智能手表","item":"https://northwave-demo.myshopify.com/collections/watches"}]}</script>
</head><body>
<img src="/a.jpg" alt="碳纤维智能手表正面">
<img src="/b.jpg" alt="手表表带细节">
<img src="/c.jpg" alt="佩戴效果">
<h2>常见问题</h2><h3>Chrono X 防水吗？</h3><p>支持 5ATM。</p>
</body></html>`,
  },
  {
    name: "竞品 B · Lumio",
    domain: "lumio-demo.myshopify.com",
    robots: `User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: *
Allow: /`,
    html: `<!DOCTYPE html><html><head>
<title>Lumio</title>
<meta name="description" content="家居好物">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Lumio","url":"https://lumio-demo.myshopify.com/"}</script>
</head><body>
<img src="/x.jpg"><img src="/y.jpg">
</body></html>`,
  },
];

/* ─── 工具 ──────────────────────────────────────────── */

function cleanDomain(shopUrl: string): string {
  return String(shopUrl || "").replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\s+/g, "");
}

function readStoredCompetitors(): CompetitorStore[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => x && x.domain).slice(0, MAX_COMPETITORS);
  } catch { /* ignore */ }
  return [];
}

function metricTone(better: MetricBetter): CellTone {
  if (better === "own") return "green";
  if (better === "competitor") return "red";
  return "gray";
}

function gapToneToCellTone(gap: ComparisonRow["gap"]): CellTone {
  if (gap === "leading") return "green";
  if (gap === "behind") return "red";
  return "gray";
}

const PRIO_CLS: Record<TodoPriority, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};
const PRIO_LABEL: Record<TodoPriority, string> = { high: "高", medium: "中", low: "低" };

/* ─── 主组件 ──────────────────────────────────────────── */

export default function CompetitorGeoPanel(props: CompetitorGeoPanelProps) {
  const { isDemo, shopUrl, shopName, domain } = props;
  const { setActiveMenu } = useDashboardMenu();
  const { showToast } = useToast();

  const [competitors, setCompetitors] = useState<CompetitorStore[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [scope, setScope] = useState<ScopeKey>("all");
  const [view, setView] = useState<ViewKey>("overview");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [openTypes, setOpenTypes] = useState<Set<string>>(new Set(["Product", "FAQPage", "Review"]));
  const [error, setError] = useState<string | null>(null);

  const displayCompetitors = useMemo<CompetitorStore[]>(
    () => (isDemo ? DEMO_COMPETITORS.map((c) => ({ name: c.name, domain: c.domain })) : competitors),
    [isDemo, competitors],
  );

  const proxyPost = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    try {
      const res = await fetch("/api/shopify/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shopUrl, ...extra }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  }, [shopUrl]);

  const runCompare = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      let own: CompetitorGeoResult;
      let competitorResults: CompetitorGeoResult[];

      if (isDemo) {
        own = DEMO_OWN;
        competitorResults = DEMO_COMPETITORS.map((c) => parseCompetitorPageHtml(c.html, c.robots, c.name, c.domain));
      } else {
        const products: NormalizedProduct[] = (props.fullProducts || []).map((p) => normalizeProductFromDashboard(p as any));
        const pages: NormalizedContent[] = (props.pages || []).map((c) => normalizeContentFromDashboard(c as any));
        const articles: NormalizedContent[] = [];
        for (const b of props.blogs || []) {
          for (const a of b.articles || []) articles.push(normalizeContentFromDashboard(a as any));
        }
        const d = domain || cleanDomain(shopUrl);
        const auditResults = runSchemaAudit({ shopName: shopName || "Store", domain: d, products, pages, articles });
        const home = await proxyPost("fetchHomepage");
        const ownSeo = extractSeoFromHtml(home.html || "");
        const rob = await proxyPost("fetchRobotsTxt");
        const ownRobots = analyzeRobotsForBots(rob.content || "");
        own = buildOwnGeoResult(auditResults, ownSeo, ownRobots, shopName || "Store", d);

        const list = readStoredCompetitors();
        competitorResults = [];
        for (const c of list) {
          const page = await proxyPost("fetchCompetitorPage", { competitorUrl: c.domain });
          const crob = await proxyPost("fetchCompetitorRobots", { competitorUrl: c.domain });
          competitorResults.push(
            buildCompetitorGeoResultFromFetch(
              {
                title: page.title, metaDescription: page.metaDescription, canonical: page.canonical,
                schemas: page.schemas, imgAltCount: page.imgAltCount,
                hasProductSchema: page.hasProductSchema, hasReviewSchema: page.hasReviewSchema,
                hasFAQSchema: page.hasFAQSchema, hasBreadcrumbSchema: page.hasBreadcrumbSchema,
                hasOrganizationSchema: page.hasOrganizationSchema,
              },
              crob.content || "",
              c.name,
              c.domain,
            ),
          );
        }
      }

      const built = buildComparisonResult(own, competitorResults);
      setResult(built);
      try { localStorage.setItem(RESULT_KEY, JSON.stringify(built)); } catch { /* ignore */ }
    } catch (e) {
      setError("对比失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  }, [isDemo, props.fullProducts, props.pages, props.blogs, domain, shopUrl, shopName, proxyPost]);

  /* 挂载：载入本地竞品 + 历史结果，并自动对比 */
  useEffect(() => {
    if (!isDemo) {
      const stored = readStoredCompetitors();
      if (stored.length) setCompetitors(stored);
      try {
        const saved = localStorage.getItem(RESULT_KEY);
        if (saved) setResult(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    runCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 添加竞品 */
  const addCompetitor = () => {
    const name = newName.trim();
    const dom = cleanDomain(newDomain.trim());
    if (!dom) { showToast("请填写竞品域名"); return; }
    const list = readStoredCompetitors();
    if (list.length >= MAX_COMPETITORS) { showToast(`最多添加 ${MAX_COMPETITORS} 个竞品`); return; }
    if (list.some((c) => c.domain === dom)) { showToast("该域名已存在"); return; }
    const next = [...list, { name: name || dom, domain: dom }];
    setCompetitors(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setNewName(""); setNewDomain(""); setShowAdd(false);
    showToast("已添加，点击「对比」刷新结果");
  };

  const removeCompetitor = (dom: string) => {
    const next = competitors.filter((c) => c.domain !== dom);
    setCompetitors(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    showToast("已移除竞品");
  };

  const exportReport = () => {
    if (!result) { showToast("请先完成对比"); return; }
    const text = buildComparisonReportText(result, shopName || (isDemo ? "Demo Store" : "Store"));
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `competitor-geo-${(shopName || "report").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("对比报告已导出（文本格式）");
  };

  /* scope → 视图可用性 */
  const canShowFields = scope === "all" || scope === "schema";
  const effectiveView: ViewKey = !canShowFields && view === "fields" ? "overview" : view;

  const filteredMetrics = useMemo<OverviewMetric[]>(() => {
    if (!result) return [];
    const defs = result.comparisons[0]?.metrics || [];
    if (scope === "schema") return defs.filter((m) => ["health", "coverage", "product", "faq", "review"].includes(m.key));
    if (scope === "seo") return defs.filter((m) => ["health", "desc", "imgalt"].includes(m.key));
    if (scope === "robots") return defs.filter((m) => ["health", "robots"].includes(m.key));
    return defs;
  }, [result, scope]);

  const filteredRows = useMemo<ComparisonRow[]>(() => {
    if (!result) return [];
    const defs = result.comparisons[0]?.rows || [];
    if (scope === "seo" || scope === "robots") return [];
    return defs;
  }, [result, scope]);

  const toggleType = (t: string) => {
    setOpenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const SCOPE_OPTS: Array<{ key: ScopeKey; label: string }> = [
    { key: "all", label: "全部维度" },
    { key: "schema", label: "Schema" },
    { key: "seo", label: "SEO" },
    { key: "robots", label: "robots" },
  ];
  const VIEW_OPTS: Array<{ key: ViewKey; label: string; icon: ReactNode }> = [
    { key: "overview", label: "概览对比", icon: <GitCompare className="h-3.5 w-3.5" /> },
    { key: "fields", label: "字段明细", icon: <Crosshair className="h-3.5 w-3.5" /> },
    { key: "todo", label: "待办清单", icon: <ListTodo className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Swords className="h-6 w-6 text-emerald-400" />GEO 竞品对比
          {isDemo && <span className="ml-1 text-sm text-amber-400">(演示)</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isDemo && (
            <Button size="sm" variant="outline" className="h-9" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />添加竞品
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-9" onClick={runCompare} disabled={running}>
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />{running ? "对比中…" : "对比"}
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={exportReport} disabled={!result}>
            <Download className="h-3.5 w-3.5" />导出报告
          </Button>
        </div>
      </div>

      {/* 竞品 chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">对比对象：</span>
        {displayCompetitors.length === 0 && (
          <span className="text-[11px] text-amber-400">
            {isDemo ? "（演示预设竞品）" : "尚未添加竞品，点击右上角「添加竞品」"}
          </span>
        )}
        {displayCompetitors.map((c) => (
          <span key={c.domain} className="flex items-center gap-1 rounded-full border border-border/40 bg-card/50 px-2.5 py-1 text-[11px] text-foreground">
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground">· {c.domain}</span>
            {!isDemo && (
              <button className="ml-0.5 text-zinc-500 hover:text-red-400" onClick={() => removeCompetitor(c.domain)}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* 范围 + 视图切换 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {SCOPE_OPTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${scope === s.key ? "border-emerald-500/50 bg-emerald-500/10 text-foreground" : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {VIEW_OPTS.map((v) => (
            <button
              key={v.key}
              disabled={v.key === "fields" && !canShowFields}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${effectiveView === v.key ? "border-emerald-500/50 bg-emerald-500/10 text-foreground" : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"}`}
            >
              {v.icon}<span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 进度 */}
      {running && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-2/3 animate-pulse bg-emerald-500" />
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          <AlertTriangle className="mr-1 inline h-3 w-3" />{error}
        </div>
      )}

      {!result ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center text-base text-muted-foreground">
            {running ? "正在抓取竞品公开页面并生成对比…" : "准备中…"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 头部健康分概览 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">本店 GEO 健康分</p>
                <p className={`mt-1 text-2xl font-bold ${computeGeoHealth(result.own) >= 60 ? "text-emerald-400" : computeGeoHealth(result.own) >= 40 ? "text-amber-400" : "text-red-400"}`}>{computeGeoHealth(result.own)}<span className="text-base text-muted-foreground">/100</span></p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">对比竞品数</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{result.comparisons.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">领先维度（合计）</p>
                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {result.comparisons.reduce((a, c) => a + c.rows.filter((r) => r.gap === "leading").length, 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">落后维度（合计）</p>
                <p className="mt-1 text-2xl font-bold text-red-400">
                  {result.comparisons.reduce((a, c) => a + c.rows.filter((r) => r.gap === "behind").length, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 图例 */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="text-emerald-400">●</span>领先（绿）</span>
            <span className="flex items-center gap-1"><span className="text-zinc-400">●</span>持平/无差异（灰）</span>
            <span className="flex items-center gap-1"><span className="text-amber-400">●</span>差距 10–30%（黄）</span>
            <span className="flex items-center gap-1"><span className="text-red-400">●</span>落后 &gt;30%（红）</span>
          </div>

          {/* 概览视图 */}
          {effectiveView === "overview" && (
            <div className="space-y-4">
              {/* 概览指标表 */}
              <Card className="border-border/40 bg-card/60">
                <CardContent className="p-3">
                  <p className="mb-2 text-base font-semibold text-foreground">概览指标对比</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1.5 px-2 text-left">指标</th>
                          <th className="py-1.5 px-2 text-right">我的店铺</th>
                          {result.comparisons.map((c) => (
                            <th key={c.competitor.domain} className="py-1.5 px-2 text-right">{c.competitor.storeName}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMetrics.map((m) => (
                          <tr key={m.key} className="border-t border-border/10">
                            <td className="py-1.5 px-2 text-foreground">{m.label}<span className="text-muted-foreground"> ({m.unit})</span></td>
                            <td className={`py-1.5 px-2 text-right font-medium ${toneClass(metricTone(m.better))}`}>{m.own}{m.unit}</td>
                            {result.comparisons.map((c) => {
                              const cm = c.metrics.find((x) => x.key === m.key);
                              const t = cm ? metricTone(cm.better) : "gray";
                              return (
                                <td key={c.competitor.domain} className={`py-1.5 px-2 text-right font-medium ${toneClass(t)}`}>
                                  {cm && cm.competitor !== null ? `${cm.competitor}${m.unit}` : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Schema 覆盖表 */}
              {filteredRows.length > 0 && (
                <Card className="border-border/40 bg-card/60">
                  <CardContent className="p-3">
                    <p className="mb-2 text-base font-semibold text-foreground">Schema 类型覆盖率</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="py-1.5 px-2 text-left">Schema 类型</th>
                            <th className="py-1.5 px-2 text-center">我的店铺</th>
                            {result.comparisons.map((c) => (
                              <th key={c.competitor.domain} className="py-1.5 px-2 text-center">{c.competitor.storeName}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((r) => (
                            <tr key={r.label} className="border-t border-border/10">
                              <td className="py-1.5 px-2 text-foreground">{r.label}</td>
                              <td className="py-1.5 px-2 text-center">
                                {r.own ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" /> : <X className="mx-auto h-3.5 w-3.5 text-zinc-600" />}
                              </td>
                              {result.comparisons.map((c) => {
                                const cr = c.rows.find((x) => x.label === r.label);
                                const t = cr ? gapToneToCellTone(cr.gap) : "gray";
                                return (
                                  <td key={c.competitor.domain} className="py-1.5 px-2 text-center">
                                    {cr && cr.competitor !== null ? (
                                      cr.competitor ? <Check className={`mx-auto h-3.5 w-3.5 ${toneClass(t)}`} /> : <X className={`mx-auto h-3.5 w-3.5 ${toneClass(t)}`} />
                                    ) : <span className="text-zinc-600">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 字段明细视图 */}
          {effectiveView === "fields" && (
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-3 space-y-2">
                <p className="text-base font-semibold text-foreground">逐类型字段明细（✓ 已部署 / ✗ 缺失）</p>
                {SCHEMA_TYPES.map((t) => {
                  const open = openTypes.has(t.type);
                  return (
                    <div key={t.type} className="rounded-lg border border-border/20 bg-card/40">
                      <button
                        onClick={() => toggleType(t.type)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left"
                      >
                        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-sm font-medium text-foreground">{t.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">权重 {(t.weight * 100).toFixed(0)}%</span>
                      </button>
                      {open && (
                        <div className="px-3 pb-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="py-1 px-2 text-left">字段</th>
                                  <th className="py-1 px-2 text-center">我的店铺</th>
                                  {result.comparisons.map((c) => (
                                    <th key={c.competitor.domain} className="py-1 px-2 text-center">{c.competitor.storeName}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {t.fields.map((f) => {
                                  const ownV = result.own.fieldComparison[t.type]?.[f.path] ?? false;
                                  return (
                                    <tr key={f.path} className="border-t border-border/10">
                                      <td className="py-1 px-2 text-foreground">{f.name}<span className="text-muted-foreground"> · {f.path}</span></td>
                                      <td className="py-1 px-2 text-center">{ownV ? <Check className="mx-auto h-3 w-3 text-emerald-400" /> : <X className="mx-auto h-3 w-3 text-zinc-600" />}</td>
                                      {result.comparisons.map((c) => {
                                        const v = c.competitor.fieldComparison[t.type]?.[f.path] ?? false;
                                        const tone: CellTone = ownV === v ? "gray" : ownV ? "green" : "red";
                                        return (
                                          <td key={c.competitor.domain} className="py-1 px-2 text-center">
                                            {v ? <Check className={`mx-auto h-3 w-3 ${toneClass(tone)}`} /> : <X className={`mx-auto h-3 w-3 ${toneClass(tone)}`} />}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 待办视图 */}
          {effectiveView === "todo" && (
            <div className="space-y-3">
              {result.comparisons.map((c) => {
                const todos = c.todos.filter((t) => scope === "all" || t.category === scope);
                return (
                  <Card key={c.competitor.domain} className="border-border/40 bg-card/60">
                    <CardContent className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4 text-emerald-400" />
                        <p className="text-base font-semibold text-foreground">对比「{c.competitor.storeName}」的赶超建议</p>
                        <Badge variant="outline" className="ml-auto text-xs">{todos.length} 项</Badge>
                      </div>
                      {todos.length === 0 ? (
                        <p className="py-4 text-center text-sm text-emerald-400"><Trophy className="mr-1 inline h-3.5 w-3.5" />在该竞品面前无明显差距，保持领先！</p>
                      ) : (
                        <div className="space-y-2">
                          {todos.map((t: TodoItem, i: number) => (
                            <div key={i} className="rounded-lg border border-border/20 bg-card/40 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${PRIO_CLS[t.priority]}`}>{PRIO_LABEL[t.priority]}</span>
                                <span className="text-sm font-medium text-foreground">{t.title}</span>
                                {t.jumpMenu && (
                                  <button
                                    className="ml-auto flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                                    onClick={() => setActiveMenu(t.jumpMenu as any)}
                                  >
                                    去处理 <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        GEO 竞品对比通过服务端代理抓取竞品公开页面（首页 / robots.txt），无需任何 API 权限。对比覆盖「Schema 结构化数据 → SEO 基础 → AI 爬虫放行」三条链路，
        差值按领先（≤30% 绿 / &gt;30% 红）、持平（灰）、落后着色。待办清单中的「去处理」会跳转到对应的 GEO 优化子面板。「添加竞品」列表保存在本地（localStorage，最多 {MAX_COMPETITORS} 个）。
      </p>

      {/* 添加竞品弹窗 */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
                <p className="text-base font-semibold text-foreground">添加竞品店铺</p>
                <button className="text-zinc-500 hover:text-foreground" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">竞品名称（可选）</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：竞品 A · NorthWave" className="h-9" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">竞品域名（必填）</label>
                  <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="northwave.myshopify.com" className="h-9" />
                  <p className="mt-1 text-xs text-muted-foreground">无需 http(s):// 前缀，代理会自动补全并抓取首页与 robots.txt。</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowAdd(false)}>取消</Button>
                  <Button size="sm" className="h-9" onClick={addCompetitor}><Plus className="h-3.5 w-3.5" />添加</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
