"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  Sparkles, Search, History, Star, Download, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, ArrowUpRight, RefreshCw, ListTodo,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "../hooks/useToast";
import { useDashboardMenu } from "../layout";
import {
  simulateAllProducts, simulateAICitation, deriveProductTypes, deriveVendors,
  type SimulationResult, type QueryEntities,
} from "@/lib/ai-simulator";

/* ─── Props ──────────────────────────────────────────── */

interface AISimulationPanelProps {
  isDemo: boolean;
  shopName: string;
  fullProducts?: any[];
  pages?: any[];
  blogs?: any[];
}

/* ─── Demo 数据（8 个商品，与 AIIndexabilityPanel 保持一致） ─────────────── */

const DEMO_PRODUCTS: any[] = [
  { id: 1, title: "碳纤维智能手表 Chrono X", handle: "chrono-x", descriptionHtml: "<p>TechGear 碳纤维智能手表，7 天续航，支持心率与血氧监测，适合运动与商务场景。</p><a href=\"/collections/wearables\">查看系列</a>", image: "https://demo.myshopify.com/cdn/chrono.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-06-20", metafields: [{ namespace: "judgeme", key: "reviews", value: JSON.stringify([{ reviewer: { name: "A" }, body: "好", rating: 5 }]) }], variants: [{ variantId: 11, name: "标配", sku: "TG-CX-001", price: "299.99", compareAtPrice: "349.99", inventory: 10 }] },
  { id: 2, title: "无线降噪耳机 SonicFlow", handle: "sonicflow", descriptionHtml: "<p>主动降噪，30 小时续航，适合运动与通勤。</p>", image: "https://demo.myshopify.com/cdn/sonic.jpg", productType: "音频设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-05-11", variants: [{ variantId: 12, name: "标配", sku: null, price: "149.99", compareAtPrice: null, inventory: 8 }] },
  { id: 3, title: "AR 护目镜 Air", handle: "ar-goggles-air", descriptionHtml: "<p>轻量碳纤维表壳，7 天超长续航，支持心率与血氧全天候监测，适合运动与户外场景使用。</p>", image: "https://demo.myshopify.com/cdn/ar.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", updated_at: "2026-04-02", variants: [{ variantId: 13, name: "标配", sku: "TG-ARG-001", price: "89.99", compareAtPrice: null, inventory: 5 }] },
  { id: 4, title: "机械键盘 K8 青轴", handle: "k8-blue", descriptionHtml: "<p>KeyLab 热插拔机械键盘，青轴段落感，适合办公与游戏场景，键帽为 PBT 材质。</p><a href=\"/products/chrono-x\">配套手表</a>", image: "https://demo.myshopify.com/cdn/k8.jpg", productType: "电脑外设", vendor: "KeyLab", status: "ACTIVE", updated_at: "2026-03-15", variants: [{ variantId: 14, name: "青轴", sku: "KL-K8-BLU", price: "129.99", compareAtPrice: null, inventory: 20 }] },
  { id: 5, title: "北欧极简台灯 LUX", handle: "lux-lamp", descriptionHtml: "<p>MinimalHome 无极调光护眼 LED 台灯，适合卧室与客厅，铝合金材质，轻便耐用。</p>", image: "https://demo.myshopify.com/cdn/lux.jpg", productType: "家居照明", vendor: "MinimalHome", status: "DRAFT", updated_at: "2024-01-01", metafields: [{ namespace: "judgeme", key: "reviews", value: JSON.stringify([{ reviewer: { name: "B" }, body: "很亮", rating: 5 }]) }], variants: [{ variantId: 15, name: "标配", sku: "MH-LUX-01", price: "79.99", compareAtPrice: "99.99", inventory: 6 }] },
  { id: 6, title: "亚麻抱枕套", handle: "linen-pillow", descriptionHtml: "<p>MinimalHome 天然亚麻抱枕套，亲肤透气，适合卧室与客厅。</p>", image: "https://demo.myshopify.com/cdn/pillow.jpg", productType: "家居纺织品", vendor: "MinimalHome", status: "ACTIVE", updated_at: "2026-02-10", variants: [{ variantId: 16, name: "标配", sku: null, price: null, compareAtPrice: null, inventory: 30 }] },
  { id: 7, title: "便携咖啡手冲壶", handle: "pour-over-kettle", descriptionHtml: "<p>BrewMaster 304 不锈钢手冲壶，精准控温，适合旅行与户外冲泡。</p>", image: "https://demo.myshopify.com/cdn/kettle.jpg", productType: "厨房用品", vendor: "BrewMaster", status: "ACTIVE", updated_at: "2026-06-01", variants: [{ variantId: 17, name: "标配", sku: "BM-KET-01", price: "59.99", compareAtPrice: null, inventory: 12 }] },
  { id: 8, title: "瑜伽垫 Pro", handle: "yoga-mat-pro", descriptionHtml: "<p>FitLife TPE 环保瑜伽垫，防滑回弹，适合瑜伽与运动场景。</p>", image: null, productType: "运动健身", vendor: "FitLife", status: "ACTIVE", updated_at: "2026-05-28", variants: [{ variantId: 18, name: "标配", sku: "FL-YM-PRO", price: "39.99", compareAtPrice: null, inventory: 40 }] },
];

const DEMO_QUERIES = [
  "推荐一款 $100 以内适合运动的无线耳机",
  "降噪耳机和 Bose 哪个好",
  "户外旅行适合带什么音频设备",
];

const PRESET_QUERIES = [
  "推荐一款运动的无线耳机",
  "100 以内最好的耳机",
  "运动适合用什么耳机",
  "TechGear 和 Bose 哪个好",
  "耳机购买指南",
];

const HISTORY_KEY = "ai_simulation_queries";
const FAV_KEY = "ai_simulation_favorites";

interface HistoryItem { query: string; timestamp: number; topProductTitle: string; topProductScore: number; }

/* ─── 内联进度条 / 状态徽章 ─────────────────────────────────────────────── */

function Bar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color || "#10b981" }} />
    </div>
  );
}

function StatusBadge({ status }: { status: "high" | "medium" | "low" }) {
  if (status === "high") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">🟢 高</Badge>;
  if (status === "medium") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">🟡 中</Badge>;
  return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30">🔴 低</Badge>;
}

function scoreColor(v: number): string {
  if (v >= 70) return "#10b981";
  if (v >= 40) return "#f59e0b";
  return "#f43f5e";
}

/* ─── 主面板 ──────────────────────────────────────────── */

export default function AISimulationPanel(props: AISimulationPanelProps) {
  const { isDemo, shopName, fullProducts } = props;
  const { setActiveMenu } = useDashboardMenu();
  const { showToast } = useToast();

  const products = useMemo<any[]>(() => (isDemo ? DEMO_PRODUCTS : (fullProducts || [])), [isDemo, fullProducts]);
  const productTypes = useMemo(() => deriveProductTypes(products), [products]);
  const vendors = useMemo(() => deriveVendors(products), [products]);

  const [query, setQuery] = useState<string>("");
  const [mode, setMode] = useState<"all" | "single">("all");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [allResults, setAllResults] = useState<SimulationResult[] | null>(null);
  const [singleResult, setSingleResult] = useState<SimulationResult | null>(null);
  const [detail, setDetail] = useState<SimulationResult | null>(null);
  const [sortKey, setSortKey] = useState<"compositeScore" | "semanticScore" | "schemaCompletenessScore" | "contentAuthorityScore">("compositeScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<HistoryItem[]>([]);
  const [showFav, setShowFav] = useState<boolean>(false);

  // 读取 localStorage
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch { setHistory([]); }
    try { setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { setFavorites([]); }
  }, []);

  // Demo：预置查询示例并自动跑第一条
  useEffect(() => {
    if (isDemo && products.length > 0 && allResults === null) {
      const demoHistory: HistoryItem[] = DEMO_QUERIES.map((q, i) => ({
        query: q, timestamp: Date.now() - (DEMO_QUERIES.length - i) * 1000,
        topProductTitle: "", topProductScore: 0,
      }));
      setHistory(demoHistory);
      runSimulation(DEMO_QUERIES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, products.length]);

  const saveHistory = useCallback((q: string, top: HistoryItem) => {
    setHistory((prev) => {
      const next = [top, ...prev.filter((h) => h.query !== q)].slice(0, 20);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const runSimulation = useCallback((q: string) => {
    const clean = (q || "").trim();
    if (!clean) { showToast("请输入查询语句"); return; }
    if (mode === "single") {
      const p = products.find((x) => x.id === selectedProductId) || products[0];
      if (!p) return;
      const r = simulateAICitation(p, clean, productTypes, vendors);
      setSingleResult(r);
      setAllResults(null);
      saveHistory(clean, { query: clean, timestamp: Date.now(), topProductTitle: r.productTitle, topProductScore: r.compositeScore });
    } else {
      const rs = simulateAllProducts(products, clean, productTypes, vendors);
      setAllResults(rs);
      setSingleResult(null);
      const top = rs[0];
      if (top) saveHistory(clean, { query: clean, timestamp: Date.now(), topProductTitle: top.productTitle, topProductScore: top.compositeScore });
    }
  }, [mode, products, selectedProductId, productTypes, vendors, saveHistory, showToast]);

  const addFavorite = useCallback((item: HistoryItem) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.query === item.query)) { showToast("已在收藏中"); return prev; }
      const next = [item, ...prev].slice(0, 50);
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [showToast]);

  const removeFavorite = useCallback((q: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.query !== q);
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const loadFavorite = useCallback((item: HistoryItem) => {
    setQuery(item.query);
    runSimulation(item.query);
    setShowFav(false);
  }, [runSimulation]);

  const sortedResults = useMemo(() => {
    if (!allResults) return [];
    const arr = [...allResults];
    arr.sort((a, b) => {
      const d = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? d : -d;
    });
    return arr;
  }, [allResults, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortHead = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-right font-medium text-zinc-400 hover:text-zinc-100"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </span>
    </th>
  );

  // 导出 txt 报告
  const exportReport = () => {
    const target = allResults || (singleResult ? [singleResult] : []);
    if (!target.length) return;
    const lines: string[] = [];
    lines.push(`AI 引用概率模拟报告 — ${shopName}`);
    lines.push(`查询：${query}`);
    lines.push(`模式：${mode === "all" ? "全店排名" : "单商品查询"}`);
    lines.push("=".repeat(48));
    target.forEach((r) => {
      lines.push(`#${r.rank} ${r.productTitle}`);
      lines.push(`  综合概率：${Math.round(r.compositeScore)}% [${r.status}]`);
      lines.push(`  语义匹配 ${Math.round(r.semanticScore)} | Schema 完整度 ${Math.round(r.schemaCompletenessScore)} | 内容权威度 ${Math.round(r.contentAuthorityScore)}`);
      if (r.optimizationSuggestions.length) {
        lines.push("  优化建议：");
        r.optimizationSuggestions.forEach((s) => lines.push(`   ${s.priority}. ${s.action}`));
      }
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-citation-simulation.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── 详情弹窗（三栏） ── */
  const DetailDialog = ({ r }: { r: SimulationResult }) => {
    const gapTo80 = Math.max(0, 80 - r.compositeScore);
    const missingFacts: string[] = [];
    if (r.schemaMissingTypes.length) missingFacts.push(`缺少 Schema 类型：${r.schemaMissingTypes.join("、")}`);
    if (r.schemaMissingFields.length) missingFacts.push(`Product Schema 缺字段：${r.schemaMissingFields.join("、")}`);
    if (r.semanticMissedDimensions.length) missingFacts.push(`语义未命中维度：${r.semanticMissedDimensions.join("、")}`);
    Object.entries(r.contentAuthorityFactors).forEach(([k, v]) => {
      if (v.actual < v.max - 0.5) missingFacts.push(`内容权威度·${k}：${v.message}`);
    });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetail(null)}>
        <div className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-zinc-100">{r.productTitle}</div>
              <div className="mt-1 flex items-center gap-2 text-base text-zinc-400">
                <span>综合引用概率</span>
                <span className="text-xl font-bold" style={{ color: scoreColor(r.compositeScore) }}>{Math.round(r.compositeScore)}%</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => addFavorite({ query, timestamp: Date.now(), topProductTitle: r.productTitle, topProductScore: r.compositeScore })}>
                <Star size={14} /> 收藏查询
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDetail(null)}>关闭</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 左：得分明细 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 text-base font-semibold text-zinc-200">得分明细</div>
              <div className="mb-3">
                <div className="mb-1 text-sm text-zinc-400">语义匹配（40%）· {Math.round(r.semanticScore)}</div>
                <Bar value={r.semanticScore} color={scoreColor(r.semanticScore)} />
                <div className="mt-1 space-y-0.5 text-sm">
                  {(["category", "brand", "attribute", "scene", "price", "title"] as const).map((dim) => {
                    const ok = r.semanticMatchedDimensions.includes(dim);
                    const wasEval = ok || r.semanticMissedDimensions.includes(dim);
                    if (!wasEval) return null;
                    return (
                      <div key={dim} className="flex items-center gap-1">
                        {ok ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-rose-400" />}
                        <span className={ok ? "text-emerald-300" : "text-rose-300"}>{dim}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mb-3">
                <div className="mb-1 text-sm text-zinc-400">Schema 完整度（35%）· {Math.round(r.schemaCompletenessScore)}</div>
                <Bar value={r.schemaCompletenessScore} color={scoreColor(r.schemaCompletenessScore)} />
                <div className="mt-1 text-sm text-zinc-400">
                  缺失类型：{r.schemaMissingTypes.length ? r.schemaMissingTypes.join("、") : "无"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm text-zinc-400">内容权威度（25%）· {Math.round(r.contentAuthorityScore)}</div>
                <Bar value={r.contentAuthorityScore} color={scoreColor(r.contentAuthorityScore)} />
                <div className="mt-1 space-y-1">
                  {Object.entries(r.contentAuthorityFactors).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>{k}</span><span>{Math.round(v.actual)}/{v.max}</span>
                      </div>
                      <Bar value={v.actual} max={v.max} color={scoreColor(v.actual / v.max * 100)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 中：缺失要素 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 text-base font-semibold text-zinc-200">缺失要素</div>
              <div className="mb-2 rounded-md bg-zinc-800/50 px-2 py-1 text-sm text-amber-300">
                提升到 80% 还需 +{Math.round(gapTo80)} 个百分点
              </div>
              {missingFacts.length === 0 ? (
                <div className="text-sm text-emerald-400">要素已较完整，保持即可。</div>
              ) : (
                <ul className="space-y-1.5">
                  {missingFacts.map((f, i) => (
                    <li key={i} className="flex items-start gap-1 text-sm text-zinc-300">
                      <span className="mt-0.5 text-rose-400">•</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 右：优化建议 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 text-base font-semibold text-zinc-200">优化建议（按优先级）</div>
              {r.optimizationSuggestions.length === 0 ? (
                <div className="text-sm text-emerald-400">暂无明确优化项，引用概率已较高。</div>
              ) : (
                <ol className="space-y-2">
                  {r.optimizationSuggestions.map((s) => (
                    <li key={s.priority} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-300">{s.priority}</span>
                        <div className="flex-1">
                          <div className="text-sm text-zinc-200">{s.action}</div>
                          {s.linkTo && (
                            <button
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline"
                              onClick={() => { setDetail(null); setActiveMenu(s.linkTo as any); }}
                            >
                              去处理 <ArrowUpRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── 渲染 ── */
  const hasResults = (allResults && allResults.length > 0) || singleResult !== null;
  const kpiAvg = allResults ? Math.round(allResults.reduce((s, r) => s + r.compositeScore, 0) / allResults.length) : (singleResult ? Math.round(singleResult.compositeScore) : 0);
  const kpiTop = allResults && allResults[0] ? allResults[0] : singleResult;
  const kpiHigh = allResults ? allResults.filter((r) => r.status === "high").length : (singleResult && singleResult.status === "high" ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-indigo-400" />
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">AI 引用概率模拟</h2>
          <p className="text-sm text-zinc-500">模拟 AI 搜索引擎的引用决策：语义匹配 40% + Schema 完整度 35% + 内容权威度 25%</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 主区 */}
        <div className="flex-1 space-y-4">
          {/* 查询输入 */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    className="pl-9"
                    placeholder="例如：推荐一款 $100 以内适合运动的无线耳机"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runSimulation(query); }}
                  />
                </div>
                <Button onClick={() => runSimulation(query)}><Sparkles size={15} /> 模拟查询</Button>
                <Button variant="outline" onClick={() => setShowFav((v) => !v)}><Star size={15} /> 收藏 {favorites.length > 0 && `(${favorites.length})`}</Button>
              </div>

              {/* 历史下拉 */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-zinc-500"><History size={13} /> 历史</div>
                <select
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 outline-none"
                  value=""
                  onChange={(e) => { if (e.target.value) { setQuery(e.target.value); runSimulation(e.target.value); } }}
                >
                  <option value="">选择历史查询…</option>
                  {history.map((h, i) => (
                    <option key={i} value={h.query}>{h.query.length > 28 ? h.query.slice(0, 28) + "…" : h.query}</option>
                  ))}
                </select>
              </div>

              {/* 预设按钮 */}
              <div className="flex flex-wrap gap-2">
                {PRESET_QUERIES.map((pq) => (
                  <Button key={pq} size="sm" variant="secondary" onClick={() => { setQuery(pq); runSimulation(pq); }}>{pq}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 模式 Tab */}
          <Tabs value={mode} onValueChange={(v) => setMode((v as "all" | "single"))}>
            <TabsList>
              <TabsTrigger value="all">全店排名</TabsTrigger>
              <TabsTrigger value="single">单商品查询</TabsTrigger>
            </TabsList>

            <TabsContent value="all"></TabsContent>
            <TabsContent value="single">
              {mode === "single" && (
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-base text-zinc-400">选择商品</span>
                      <select
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-base text-zinc-200 outline-none"
                        value={selectedProductId ?? ""}
                        onChange={(e) => setSelectedProductId(Number(e.target.value))}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <Button size="sm" onClick={() => runSimulation(query)}>分析该商品</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* KPI */}
          {hasResults && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card><CardContent className="p-3">
                <div className="text-sm text-zinc-500">候选商品</div>
                <div className="text-2xl font-bold text-zinc-100">{products.length}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-sm text-zinc-500">平均综合概率</div>
                <div className="text-2xl font-bold" style={{ color: scoreColor(kpiAvg) }}>{kpiAvg}%</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-sm text-zinc-500">最高概率商品</div>
                <div className="truncate text-base font-semibold text-zinc-100" title={kpiTop?.productTitle}>{kpiTop?.productTitle || "—"}</div>
                <div className="text-sm" style={{ color: scoreColor(kpiTop?.compositeScore || 0) }}>{kpiTop ? Math.round(kpiTop.compositeScore) + "%" : "—"}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-sm text-zinc-500">高概率商品数</div>
                <div className="text-2xl font-bold text-emerald-400">{kpiHigh}</div>
              </CardContent></Card>
            </div>
          )}

          {/* 全店排名表 */}
          {allResults && allResults.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-base font-medium text-zinc-300">引用概率排行（{allResults.length}）</span>
                  <Button size="sm" variant="outline" onClick={exportReport}><Download size={14} /> 导出报告</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead className="border-y border-zinc-800 text-sm text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">排名</th>
                        <th className="px-3 py-2 text-left">商品</th>
                        <SortHead k="semanticScore" label="语义匹配" />
                        <SortHead k="schemaCompletenessScore" label="Schema" />
                        <SortHead k="contentAuthorityScore" label="内容权威" />
                        <SortHead k="compositeScore" label="综合概率" />
                        <th className="px-3 py-2 text-left">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((r) => (
                        <tr
                          key={r.productId}
                          className="cursor-pointer border-b border-zinc-800/60 hover:bg-zinc-800/40"
                          onClick={() => setDetail(r)}
                        >
                          <td className="px-3 py-2 text-zinc-400">#{r.rank}</td>
                          <td className="px-3 py-2 text-zinc-100">{r.productTitle}</td>
                          <td className="px-3 py-2 text-right" style={{ color: scoreColor(r.semanticScore) }}>{Math.round(r.semanticScore)}</td>
                          <td className="px-3 py-2 text-right" style={{ color: scoreColor(r.schemaCompletenessScore) }}>{Math.round(r.schemaCompletenessScore)}</td>
                          <td className="px-3 py-2 text-right" style={{ color: scoreColor(r.contentAuthorityScore) }}>{Math.round(r.contentAuthorityScore)}</td>
                          <td className="px-3 py-2 text-right font-semibold" style={{ color: scoreColor(r.compositeScore) }}>{Math.round(r.compositeScore)}%</td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-sm text-zinc-500">点击任意行查看三栏详情分析。</div>
              </CardContent>
            </Card>
          )}

          {/* 单商品详情（直接渲染三栏） */}
          {mode === "single" && singleResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-zinc-300">单商品引用分析</span>
                <Button size="sm" variant="outline" onClick={exportReport}><Download size={14} /> 导出</Button>
              </div>
              <DetailDialog r={singleResult} />
            </div>
          )}

          {/* 空态 */}
          {!hasResults && (
            <Card><CardContent className="p-8 text-center text-base text-zinc-500">
              输入查询语句（或点击上方预设按钮）后，这里会展示 AI 引用概率排行与逐商品分析。
            </CardContent></Card>
          )}
        </div>

        {/* 收藏侧栏 */}
        {showFav && (
          <div className="w-full lg:w-64">
            <Card>
              <CardContent className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base font-semibold text-zinc-200">收藏的查询</span>
                  <button className="text-sm text-zinc-500 hover:text-zinc-300" onClick={() => setShowFav(false)}>收起</button>
                </div>
                {favorites.length === 0 ? (
                  <div className="text-sm text-zinc-500">暂无收藏。在详情弹窗中点击「收藏查询」即可保存。</div>
                ) : (
                  <ul className="space-y-1.5">
                    {favorites.map((f, i) => (
                      <li key={i} className="group rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
                        <button className="block w-full text-left text-sm text-zinc-200 hover:text-indigo-300" onClick={() => loadFavorite(f)}>
                          {f.query.length > 32 ? f.query.slice(0, 32) + "…" : f.query}
                        </button>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">Top: {Math.round(f.topProductScore)}%</span>
                          <button className="text-[11px] text-rose-400 hover:underline" onClick={() => removeFavorite(f.query)}>移除</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {detail && <DetailDialog r={detail} />}
    </div>
  );
}
