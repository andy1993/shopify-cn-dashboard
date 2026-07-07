"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
  RefreshCw,
  Download,
  ChevronDown,
  Circle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Sparkles,
  GitCompare,
  SearchCheck,
  Braces,
  Wand2,
  Bot,
} from "lucide-react";
import {
  loadGeoWizardCache,
  saveGeoWizardCache,
  notifyGeoWizardRefresh,
  computeGeoHealthScore,
  geoHealthTone,
  generateGeoReport,
  downloadGeoReport,
  isCacheExpired,
  GEO_WIZARD_EVENT,
  GeoWizardCache,
  GeoWizardStepCache,
} from "@/lib/geo-wizard-cache";
import { analyzeRobotsForBots } from "@/lib/competitor-geo-analyzer";
import {
  runSchemaAudit,
  computeSiteHealth,
  normalizeProductFromDashboard,
  normalizeContentFromDashboard,
  SchemaAuditResult,
} from "@/lib/schema-detector";
import {
  simulateAllProducts,
  deriveProductTypes,
  deriveVendors,
} from "@/lib/ai-simulator";

type StepStatus = "done" | "fix" | "progress" | "todo";

const STEP_META = [
  { key: "ai-indexability", label: "AI 可索引性", short: "可索引性", icon: SearchCheck, menu: "ai-indexability" },
  { key: "schema-audit", label: "Schema 检测", short: "Schema检测", icon: Braces, menu: "schema-audit" },
  { key: "schema-generator", label: "Schema 生成", short: "Schema生成", icon: Wand2, menu: "schema-generator" },
  { key: "competitor-geo", label: "竞品对标", short: "竞品对标", icon: GitCompare, menu: "competitor-geo" },
  { key: "ai-simulation", label: "AI 引用模拟", short: "引用测试", icon: Bot, menu: "ai-simulation" },
] as const;

const PRESET_QUERIES = [
  "推荐一款适合运动的无线耳机",
  "$50 以内最好的生日礼物",
  "北欧风格家居用品推荐",
];

// ─── Demo 预设结果 ───────────────────────────────────────────────────────────
const DEMO_STEP1 = {
  score: 100,
  bots: { gptBotBlocked: false, perplexityBotBlocked: false, googleExtendedBlocked: false, ccBotBlocked: false },
  robotsContent: "User-agent: GPTBot\nAllow: /\n\nUser-agent: *\nDisallow: /checkout\nDisallow: /cart",
};

const DEMO_STEP2_RESULTS: SchemaAuditResult[] = [
  { schemaType: "Product", title: "Product", totalPages: 68, coveredPages: 45, coverageRate: 0.66, missingFields: [
    { pageId: 1, pageTitle: "运动无线耳机 Pro", pageUrl: "", missingFieldNames: ["brand"], affectedScenarios: ["实体关联"] },
    { pageId: 2, pageTitle: "降噪耳机 Lite", pageUrl: "", missingFieldNames: ["brand", "aggregateRating"], affectedScenarios: ["实体关联", "评价信号"] },
  ] as any, healthScore: 0.66 },
  { schemaType: "Review", title: "Review", totalPages: 68, coveredPages: 3, coverageRate: 0.05, missingFields: [] as any, healthScore: 0.05 },
  { schemaType: "FAQPage", title: "FAQPage", totalPages: 68, coveredPages: 0, coverageRate: 0, missingFields: [] as any, healthScore: 0 },
  { schemaType: "BreadcrumbList", title: "BreadcrumbList", totalPages: 68, coveredPages: 68, coverageRate: 1, missingFields: [] as any, healthScore: 1 },
  { schemaType: "Organization", title: "Organization", totalPages: 1, coveredPages: 0, coverageRate: 0, missingFields: [] as any, healthScore: 0 },
  { schemaType: "Article", title: "Article", totalPages: 3, coveredPages: 1, coverageRate: 0.33, missingFields: [] as any, healthScore: 0.33 },
];

const DEMO_STEP5 = {
  query: PRESET_QUERIES[0],
  top3: [
    { title: "运动无线耳机 Pro", score: 78, status: "high" },
    { title: "防水蓝牙音箱", score: 67, status: "medium" },
    { title: "降噪耳机 Lite", score: 59, status: "medium" },
  ],
};

interface GeoWizardPanelProps {
  isDemo?: boolean;
  shopUrl?: string;
  shopName?: string;
  fullProducts?: any[];
  pages?: any[];
  blogs?: any[];
  setActiveMenu?: (menu: string) => void;
}

export default function GeoWizardPanel(props: GeoWizardPanelProps) {
  const { isDemo, shopUrl = "", shopName = "", fullProducts = [], pages = [], blogs = [], setActiveMenu } = props;
  const domain = useMemo(() => (shopUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""), [shopUrl]);

  const [cache, setCache] = useState<GeoWizardCache>(() => loadGeoWizardCache());
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState<Record<number, boolean>>({});
  const [injecting, setInjecting] = useState(false);
  const [injectProgress, setInjectProgress] = useState(0);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [step5Query, setStep5Query] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string>("");

  const stepRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null]);

  // 重新加载缓存（事件 + 5s 轮询）
  const reload = useCallback(() => {
    setCache(loadGeoWizardCache());
  }, []);

  useEffect(() => {
    const onEvent = () => reload();
    window.addEventListener(GEO_WIZARD_EVENT, onEvent);
    const timer = window.setInterval(reload, 5000);
    return () => {
      window.removeEventListener(GEO_WIZARD_EVENT, onEvent);
      window.clearInterval(timer);
    };
  }, [reload]);

  const proxyFetch = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch("/api/shopify/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shopUrl, ...extra }),
      });
      return res.json();
    },
    [shopUrl]
  );

  // ─── Step 1 扫描 ──────────────────────────────────────────────────────────
  const scanStep1 = useCallback(async () => {
    setScanning((s) => ({ ...s, 1: true }));
    try {
      if (isDemo) {
        saveGeoWizardCache(1, DEMO_STEP1);
      } else {
        const data = await proxyFetch("fetchRobotsTxt");
        const content: string = data?.content ?? "";
        const bots = analyzeRobotsForBots(content);
        const blocked = [bots.gptBotBlocked, bots.perplexityBotBlocked, bots.googleExtendedBlocked, bots.ccBotBlocked].filter(Boolean).length;
        const score = Math.round((1 - blocked / 4) * 100);
        saveGeoWizardCache(1, { score, bots, robotsContent: content });
      }
      notifyGeoWizardRefresh();
      setCache(loadGeoWizardCache());
    } finally {
      setScanning((s) => ({ ...s, 1: false }));
    }
  }, [isDemo, proxyFetch]);

  // ─── Step 2 扫描 ──────────────────────────────────────────────────────────
  const scanStep2 = useCallback(async () => {
    setScanning((s) => ({ ...s, 2: true }));
    try {
      if (isDemo) {
        saveGeoWizardCache(2, { results: DEMO_STEP2_RESULTS, siteHealth: 62, scannedAt: Date.now() });
      } else if (fullProducts && fullProducts.length) {
        const products = fullProducts.map((p) => normalizeProductFromDashboard(p));
        const contentPages = (pages || []).map((c) => normalizeContentFromDashboard(c));
        const articles = (blogs || []).map((c) => normalizeContentFromDashboard(c));
        const results = runSchemaAudit({ shopName, domain, products, pages: contentPages, articles });
        const siteHealth = computeSiteHealth(results);
        saveGeoWizardCache(2, { results, siteHealth, scannedAt: Date.now() });
      } else {
        setGlobalMsg("暂无商品数据，无法扫描 Schema。");
        return;
      }
      notifyGeoWizardRefresh();
      setCache(loadGeoWizardCache());
    } finally {
      setScanning((s) => ({ ...s, 2: false }));
    }
  }, [isDemo, fullProducts, pages, blogs, shopName, domain]);

  // ─── Step 3 模拟注入（闭环：注入完成更新 Step2） ──────────────────────────
  const deriveInjectCounts = useCallback((step2: GeoWizardStepCache | null) => {
    const counts: Record<string, number> = {};
    const res = step2?.result?.results as SchemaAuditResult[] | undefined;
    if (res) {
      res.forEach((r) => {
        const missing = (r.totalPages || 0) - (r.coveredPages || 0);
        if (missing > 0) counts[r.schemaType] = missing;
      });
    }
    return counts;
  }, []);

  const runInjection = useCallback(() => {
    setShowInjectModal(false);
    setInjecting(true);
    setInjectProgress(0);
    const timer = window.setInterval(() => {
      setInjectProgress((p) => {
        if (p >= 100) {
          window.clearInterval(timer);
          finishInjection();
          return 100;
        }
        return p + 10;
      });
    }, 120);
  }, []);

  const finishInjection = useCallback(() => {
    const cur = loadGeoWizardCache();
    const step2 = cur.step2;
    if (step2?.result?.results) {
      const updated = (step2.result.results as SchemaAuditResult[]).map((r) => {
        if (["Product", "FAQPage", "Review", "Organization", "BreadcrumbList"].includes(r.schemaType)) {
          return { ...r, coveredPages: r.totalPages, coverageRate: 1, missingFields: [], healthScore: 1 };
        }
        return r;
      });
      const siteHealth = computeSiteHealth(updated);
      saveGeoWizardCache(2, { ...step2.result, results: updated, siteHealth });
    }
    const counts = deriveInjectCounts(cur.step2);
    saveGeoWizardCache(3, { done: true, counts, injectedAt: Date.now() });
    notifyGeoWizardRefresh();
    setCache(loadGeoWizardCache());
    setInjecting(false);
  }, [deriveInjectCounts]);

  // ─── Step 5 测试 ───────────────────────────────────────────────────────────
  const runStep5 = useCallback(
    (query: string) => {
      setStep5Query(query);
      if (isDemo) {
        saveGeoWizardCache(5, { ...DEMO_STEP5, query });
        notifyGeoWizardRefresh();
        setCache(loadGeoWizardCache());
        return;
      }
      const products = fullProducts && fullProducts.length ? fullProducts : [];
      if (!products.length) {
        saveGeoWizardCache(5, { ...DEMO_STEP5, query });
      } else {
        const types = deriveProductTypes(products);
        const vendors = deriveVendors(products);
        const all = simulateAllProducts(products, query, types, vendors);
        const top3 = all.slice(0, 3).map((r) => ({ title: r.productTitle, score: r.compositeScore, status: r.status }));
        saveGeoWizardCache(5, { query, top3 });
      }
      notifyGeoWizardRefresh();
      setCache(loadGeoWizardCache());
    },
    [isDemo, fullProducts]
  );

  // ─── 全店重新扫描（Step1 → Step2） ─────────────────────────────────────────
  const runFullScan = useCallback(async () => {
    setGlobalMsg("正在执行全站扫描…");
    await scanStep1();
    await scanStep2();
    setGlobalMsg("");
  }, [scanStep1, scanStep2]);

  // ─── 状态计算 ──────────────────────────────────────────────────────────────
  const stepStatus = useCallback(
    (i: number): StepStatus => {
      const step = (cache as any)[`step${i}`] as GeoWizardStepCache | null;
      if (!step || isCacheExpired(step.timestamp)) return "todo";
      if (i === 1) {
        const r = step.result;
        const blocked = r?.bots
          ? [r.bots.gptBotBlocked, r.bots.perplexityBotBlocked, r.bots.googleExtendedBlocked, r.bots.ccBotBlocked].filter(Boolean).length
          : 0;
        if (blocked > 0) return "fix";
        return r?.score >= 100 ? "done" : "progress";
      }
      if (i === 2) {
        const sc = step.result?.siteHealth ?? 0;
        if (sc >= 80) return "done";
        if (sc < 60) return "fix";
        return "progress";
      }
      if (i === 3) return step.result?.done ? "done" : "todo";
      if (i === 4) return step.result ? "done" : "todo";
      if (i === 5) return step.result ? "done" : "todo";
      return "todo";
    },
    [cache]
  );

  const statuses = [1, 2, 3, 4, 5].map(stepStatus);
  const completedCount = statuses.filter((s) => s === "done").length;
  const health = computeGeoHealthScore(cache);
  const healthTone = geoHealthTone(health);
  const lastScan = Math.max(
    0,
    ...[1, 2, 3, 4, 5].map((i) => (cache as any)[`step${i}`]?.timestamp || 0)
  );

  const toggleStep = (i: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const scrollToStep = (i: number) => {
    toggleStep(i);
    window.setTimeout(() => stepRefs.current[i - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const goMenu = (menu: string) => {
    if (setActiveMenu) setActiveMenu(menu);
  };

  // ─── 渲染辅助 ──────────────────────────────────────────────────────────────
  const StatusBadge = ({ s, score }: { s: StepStatus; score?: number }) => {
    if (s === "done") return <Badge className="bg-green-600/20 text-green-400 border-green-700">✅ 已完成</Badge>;
    if (s === "fix") return <Badge className="bg-red-600/20 text-red-400 border-red-700">🔴 需修复</Badge>;
    if (s === "progress") return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-700">🟡 进行中</Badge>;
    return <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600">⚪ 待操作</Badge>;
  };

  const CircleIcon = ({ s, n }: { s: StepStatus; n: number }) => {
    const base = "h-10 w-10 rounded-full flex items-center justify-center border-2 text-base font-bold";
    if (s === "done") return <div className={`${base} bg-green-600 border-green-400 text-white`}><CheckCircle2 size={20} /></div>;
    if (s === "fix") return <div className={`${base} bg-red-600 border-red-400 text-white`}><XCircle size={20} /></div>;
    if (s === "progress") return <div className={`${base} bg-blue-600 border-blue-400 text-white`}>{n}</div>;
    return <div className={`${base} bg-zinc-700 border-zinc-500 text-zinc-300`}>{n}</div>;
  };

  const Bar = ({ rate }: { rate: number }) => (
    <div className="h-2 w-full rounded-full bg-zinc-700 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-green-500" style={{ width: `${Math.round(rate * 100)}%` }} />
    </div>
  );

  // Step 2 结果展示
  const step2Results = cache.step2?.result?.results as SchemaAuditResult[] | undefined;
  const step2Health = cache.step2?.result?.siteHealth ?? 0;
  const injectCounts = deriveInjectCounts(cache.step2);

  // Step 4 结果
  const step4 = cache.step4?.result as any;
  const competitorCount = step4?.comparisons?.length ?? 0;

  // Step 5 结果
  const step5 = cache.step5?.result as any;

  return (
    <div className="space-y-4">
      {/* 顶部快速操作栏（始终可见） */}
      <Card className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur border-zinc-800">
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-sky-400" />
            <span className="text-base text-zinc-400">GEO 健康分</span>
            <span className="text-xl font-bold text-white">{health}/100</span>
            <span className="text-base">{healthTone.color} {healthTone.label}</span>
          </div>
          <div className="text-sm text-zinc-500">
            上次扫描：{lastScan ? new Date(lastScan).toLocaleString("zh-CN") : "未执行"}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={runFullScan}>
              <RefreshCw size={14} className="mr-1" /> 全站重新扫描
            </Button>
            <Button
              size="sm"
              onClick={() => downloadGeoReport(cache, shopName || "shop")}
            >
              <Download size={14} className="mr-1" /> 导出 GEO 报告
            </Button>
          </div>
        </CardContent>
      </Card>

      {globalMsg && <div className="text-sm text-sky-400">{globalMsg}</div>}

      {/* 向导进度条 */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between">
            {STEP_META.map((m, idx) => {
              const i = idx + 1;
              const s = statuses[idx];
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center">
                  <button onClick={() => scrollToStep(i)} title={m.label} className="flex flex-col items-center gap-1 group">
                    <CircleIcon s={s} n={i} />
                    <span className={`text-sm mt-1 ${s === "todo" ? "text-zinc-500" : "text-zinc-200"}`}>{m.short}</span>
                    <StatusBadge s={s} />
                  </button>
                  {i < 5 && (
                    <div className="h-0.5 w-full mt-5 bg-zinc-700">
                      <div className="h-full bg-green-500" style={{ width: s === "done" ? "100%" : "0%" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1 */}
      <StepSection
        index={1}
        status={statuses[0]}
        meta={STEP_META[0]}
        open={openSteps.has(1)}
        onToggle={() => toggleStep(1)}
        innerRef={(el) => (stepRefs.current[0] = el)}
        scoreText={cache.step1?.result?.score != null ? `${cache.step1.result.score}/100` : undefined}
      >
        {!cache.step1 ? (
          <div className="text-base text-zinc-400">
            尚未扫描。点击「开始扫描」检测 AI 爬虫能否访问你的站点。
            <div className="mt-2"><Button size="sm" onClick={scanStep1} disabled={scanning[1]}><Play size={14} className="mr-1" />开始扫描</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-base">
              {(["gptBotBlocked", "perplexityBotBlocked", "googleExtendedBlocked", "ccBotBlocked"] as const).map((k, idx) => {
                const blocked = (cache.step1!.result.bots as any)?.[k];
                const name = ["GPTBot", "PerplexityBot", "Google-Extended", "CCBot"][idx];
                return (
                  <div key={k} className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2">
                    <span className={blocked ? "text-red-400" : "text-green-400"}>{blocked ? "❌ 被屏蔽" : "✅ 未被屏蔽"}</span>
                    <span className="text-zinc-300">{name}</span>
                  </div>
                );
              })}
            </div>
            {(["gptBotBlocked", "perplexityBotBlocked", "googleExtendedBlocked", "ccBotBlocked"] as const).some((k) => (cache.step1!.result.bots as any)?.[k]) && (
              <div className="rounded-lg border border-red-700 bg-red-900/20 px-3 py-2 text-base text-red-300">
                ⚠️ 有 AI 爬虫被 robots.txt 屏蔽，AI 无法抓取你的站点！请立即修复。
              </div>
            )}
            <div>
              <div className="text-sm text-zinc-400 mb-1">robots.txt 预览：</div>
              <pre className="text-sm bg-zinc-950 rounded-lg p-3 overflow-x-auto text-zinc-300 whitespace-pre-wrap">{cache.step1.result.robotsContent || "（空）"}</pre>
            </div>
            <Button size="sm" variant="outline" onClick={() => goMenu("ai-indexability")}>查看详细报告 →</Button>
          </div>
        )}
      </StepSection>

      {/* Step 2 */}
      <StepSection
        index={2}
        status={statuses[1]}
        meta={STEP_META[1]}
        open={openSteps.has(2)}
        onToggle={() => toggleStep(2)}
        innerRef={(el) => (stepRefs.current[1] = el)}
        scoreText={cache.step2 ? `${step2Health}/100` : undefined}
      >
        {!cache.step2 ? (
          <div className="text-base text-zinc-400">
            尚未扫描。点击「开始扫描」检测全站结构化数据覆盖。
            <div className="mt-2"><Button size="sm" onClick={scanStep2} disabled={scanning[2]}><Play size={14} className="mr-1" />开始扫描</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-base text-zinc-400">
              全站扫描结果：{step2Results?.reduce((s, r) => s + (r.totalPages || 0), 0) || 0} 项页面
            </div>
            <div className="space-y-2">
              {(step2Results || []).map((r) => (
                <div key={r.schemaType} className="text-base">
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-300">{r.title}</span>
                    <span className="text-zinc-400">{Math.round((r.coverageRate || 0) * 100)}%{((r.totalPages || 0) - (r.coveredPages || 0)) > 0 ? ` · ${(r.totalPages || 0) - (r.coveredPages || 0)} 件缺失` : " · 全覆盖"}</span>
                  </div>
                  <Bar rate={r.coverageRate || 0} />
                </div>
              ))}
            </div>
            {injectCounts["Product"] ? (
              <div className="rounded-lg border border-orange-700 bg-orange-900/20 px-3 py-2 text-base text-orange-300">
                🆘 最紧迫：{injectCounts["Product"]} 件商品缺少 Product Schema 的 brand 字段
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => goMenu("schema-audit")}>查看完整报告 →</Button>
          </div>
        )}
      </StepSection>

      {/* Step 3 */}
      <StepSection
        index={3}
        status={statuses[2]}
        meta={STEP_META[2]}
        open={openSteps.has(3)}
        onToggle={() => toggleStep(3)}
        innerRef={(el) => (stepRefs.current[2] = el)}
      >
        {!cache.step2 && !cache.step3 ? (
          <div className="text-base text-zinc-400">请先完成 Step 2 检测，系统会自动列出可注入的 Schema 清单。</div>
        ) : cache.step3?.result?.done ? (
          <div className="space-y-2 text-base">
            <div className="text-green-400">✅ 已注入完成（{new Date(cache.step3.result.injectedAt).toLocaleString("zh-CN")}）</div>
            <div className="text-zinc-300">注入清单：{Object.keys(cache.step3.result.counts).map((k) => `${k}(${cache.step3!.result.counts[k]}件)`).join(" + ") || "无"}</div>
            <Button size="sm" variant="outline" onClick={() => goMenu("schema-generator")}>打开生成器 →</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-base text-zinc-400">待注入清单（基于 Step 2 检测结果）：</div>
            <div className="space-y-1 text-base">
              {Object.keys(injectCounts).length ? (
                Object.entries(injectCounts).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-zinc-800/60 px-3 py-2 text-zinc-300">{k} Schema：{v} 件可注入</div>
                ))
              ) : (
                <div className="text-zinc-500">暂无可注入项（全站 Schema 已完整）。</div>
              )}
            </div>
            <div className="text-sm text-zinc-500">
              预计新增字段总数：约 {Object.values(injectCounts).reduce((s, v) => s + v, 0) * 3} 个
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={injecting || Object.keys(injectCounts).length === 0}
                onClick={() => setShowInjectModal(true)}
              >
                <Wand2 size={14} className="mr-1" /> 一键注入全部 Schema
              </Button>
              <Button size="sm" variant="outline" onClick={() => goMenu("schema-generator")}>手动选择要注入的类型</Button>
            </div>
            {injecting && (
              <div className="space-y-1">
                <div className="text-sm text-sky-400">注入中… {injectProgress}%</div>
                <div className="h-2 w-full rounded-full bg-zinc-700 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${injectProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </StepSection>

      {/* Step 4 */}
      <StepSection
        index={4}
        status={statuses[3]}
        meta={STEP_META[3]}
        open={openSteps.has(4)}
        onToggle={() => toggleStep(4)}
        innerRef={(el) => (stepRefs.current[3] = el)}
      >
        <div className="space-y-3">
          <div className="text-base text-zinc-400">
            已添加竞品：{competitorCount > 0 ? `${competitorCount} 个` : "无"} · 上次对比：{cache.step4 ? new Date(cache.step4.timestamp).toLocaleString("zh-CN") : "未执行"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => goMenu("competitor-geo")}><GitCompare size={14} className="mr-1" />+ 添加竞品</Button>
            <Button size="sm" variant="outline" onClick={() => goMenu("competitor-geo")}>开始对比</Button>
          </div>
          {step4?.comparisons?.length ? (
            <div className="space-y-1 text-base">
              {step4.comparisons.slice(0, 2).map((c: any, i: number) => (
                <div key={i} className="rounded-lg bg-zinc-800/60 px-3 py-2 text-zinc-300">
                  与 {c.competitor?.storeName || c.competitor?.domain} 对比：{c.todos?.length || 0} 项待改进
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">如果竞品 Schema 覆盖率和内容质量都高于你 → 需要追赶。</div>
          )}
          <Button size="sm" variant="outline" onClick={() => goMenu("competitor-geo")}>查看竞品对比面板 →</Button>
        </div>
      </StepSection>

      {/* Step 5 */}
      <StepSection
        index={5}
        status={statuses[4]}
        meta={STEP_META[4]}
        open={openSteps.has(5)}
        onToggle={() => toggleStep(5)}
        innerRef={(el) => (stepRefs.current[4] = el)}
      >
        <div className="space-y-3">
          <div className="text-base text-zinc-400">预设查询（点击即测）：</div>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((q) => (
              <Button key={q} size="sm" variant="outline" onClick={() => runStep5(q)}>
                <Sparkles size={14} className="mr-1" />{q}
              </Button>
            ))}
          </div>
          {step5?.top3?.length ? (
            <div className="space-y-1">
              <div className="text-sm text-zinc-500">测试查询：{step5.query}</div>
              {step5.top3.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2 text-base">
                  <span className="text-zinc-200">{i + 1}. {r.title}</span>
                  <span className={r.status === "high" ? "text-green-400" : r.status === "medium" ? "text-yellow-400" : "text-red-400"}>{r.score}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">上次测试：未执行</div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => goMenu("ai-simulation")}>输入自定义查询</Button>
            <Button size="sm" variant="outline" onClick={() => goMenu("ai-simulation")}>打开完整模拟器 →</Button>
          </div>
        </div>
      </StepSection>

      {/* 注入确认弹窗 */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowInjectModal(false)}>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-2">确认注入 Schema</h3>
            <p className="text-base text-zinc-400 mb-4">
              将向 {Object.keys(injectCounts).length} 类 Schema、约 {Object.values(injectCounts).reduce((s, v) => s + v, 0)} 个页面注入共计约 {Object.values(injectCounts).reduce((s, v) => s + v, 0) * 3} 个 Schema 字段。此操作会修改商品描述内容并调用 Shopify API。确定继续？
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowInjectModal(false)}>取消</Button>
              <Button size="sm" onClick={runInjection}>确定注入</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 步骤折叠区块 ──────────────────────────────────────────────────────────────
function StepSection({
  index,
  status,
  meta,
  open,
  onToggle,
  innerRef,
  scoreText,
  children,
}: {
  index: number;
  status: StepStatus;
  meta: (typeof STEP_META)[number];
  open: boolean;
  onToggle: () => void;
  innerRef: (el: HTMLDivElement | null) => void;
  scoreText?: string;
  children: React.ReactNode;
}) {
  const Icon = meta.icon;
  return (
    <Card className="bg-zinc-900 border-zinc-800" ref={innerRef}>
      <button onClick={onToggle} className="w-full text-left">
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <Icon size={18} className="text-sky-400" />
          <div className="flex-1">
            <div className="text-base font-medium text-white">Step {index}: {meta.label}</div>
          </div>
          {scoreText && <span className="text-base font-bold text-zinc-200">{scoreText}</span>}
          <StatusBadgeInline status={status} />
          <ChevronDown size={16} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </CardContent>
      </button>
      {open && <CardContent className="pt-0 px-4 pb-4 border-t border-zinc-800">{children}</CardContent>}
    </Card>
  );
}

function StatusBadgeInline({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-sm text-green-400">✅ 已完成</span>;
  if (status === "fix") return <span className="text-sm text-red-400">🔴 需修复</span>;
  if (status === "progress") return <span className="text-sm text-yellow-400">🟡 进行中</span>;
  return <span className="text-sm text-zinc-500">⚪ 待操作</span>;
}
