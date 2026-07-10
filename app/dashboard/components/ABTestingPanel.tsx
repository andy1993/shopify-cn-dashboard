"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  GitBranch,
  FlaskConical,
  Play,
  Square,
  CheckCircle2,
  Trophy,
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  Info,
  Loader2,
  GitCompare,
  Type,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ─── Props ──────────────────────────────────────────── */

interface ABTestingPanelProps {
  isDemo: boolean;
  shopName: string;
  fullProducts?: any[];
  shopUrl?: string;
  accessToken?: string;
}

/* ─── 类型 ──────────────────────────────────────────── */

type ABTestType = "title" | "price";
type TestPhase = "setup" | "running" | "finished";

interface ABMetrics {
  visits: number; // 访问量（变体分流后）
  atcRate: number; // 加购率 %
  convRate: number; // 成交率 %
}

interface SimState {
  phase: TestPhase;
  testType: ABTestType;
  productHandle: string | null;
  productId: number | null;
  variantId: number | null;
  valueA: string; // 变体 A 当前值（自动填入）
  valueB: string; // 变体 B 新值（用户输入）
  duration: number; // 测试周期（天）
  startedAt: number | null;
  daysElapsed: number; // 已进行天数（演示中按 tick 推进）
  totalPerVariant: number; // 每变体累计目标访问量
  trueA: number; // 隐藏：A 真实成交率（模拟目标）
  trueB: number; // 隐藏：B 真实成交率（模拟目标）
  metricA: ABMetrics;
  metricB: ABMetrics;
  confidence: number; // 0-100
  winner: "A" | "B" | null;
  significant: boolean; // 置信度 ≥ 80% 视为显著
  applied: boolean;
  appliedValue: string | null;
  writing: boolean;
  apiError: string | null;
  liveNote: string | null;
  lastRefresh: number | null;
}

/* ─── 常量 ──────────────────────────────────────────── */

const GA4_CACHE_KEY = "ga4_last_result";
const DEMO_TICK_MS = 3000; // 演示中每 3 秒推进 1 天
const REAL_TICK_MS = 30000; // 真实模式每 30 秒轮询（近似每日刷新）

/* ─── 工具 ──────────────────────────────────────────── */

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("zh-CN");
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/* 双比例 Z 检验：比较 A/B 成交率，返回置信度（0-100）与 z 值 */
function computeConfidence(convA: number, nA: number, convB: number, nB: number): { confidence: number; z: number } {
  const pA = convA / 100;
  const pB = convB / 100;
  if (nA < 30 || nB < 30) return { confidence: 0, z: 0 }; // 样本不足
  const pooled = (pA * nA + pB * nB) / (nA + nB);
  if (pooled <= 0 || pooled >= 1) return { confidence: 100, z: 0 };
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return { confidence: 100, z: 0 };
  const z = (pB - pA) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const confidence = Math.max(0, Math.min(100, (1 - p) * 100));
  return { confidence, z };
}

function readGa4CachePages(): Array<{ path: string; sessions: number; conversions: number }> | null {
  try {
    const raw = localStorage.getItem(GA4_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pages = parsed?.bundle?.pages;
    if (!Array.isArray(pages)) return null;
    return pages.map((p: any) => ({
      path: p.path,
      sessions: p.sessions || 0,
      conversions: p.conversions || 0,
    }));
  } catch {
    return null;
  }
}

/* 调用 Shopify Admin API 写入变体（标题或价格） */
async function writeVariant(
  shopUrl: string,
  accessToken: string,
  type: ABTestType,
  id: number,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const action = type === "title" ? "updateProductTitle" : "updateVariantPrice";
  const body: any = { action, shopUrl, accessToken };
  if (type === "title") {
    body.productId = id;
    body.title = value;
  } else {
    body.variantId = id;
    body.price = value;
  }
  try {
    const res = await fetch("/api/shopify/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}

function initialState(): SimState {
  return {
    phase: "setup",
    testType: "title",
    productHandle: null,
    productId: null,
    variantId: null,
    valueA: "",
    valueB: "",
    duration: 7,
    startedAt: null,
    daysElapsed: 0,
    totalPerVariant: 0,
    trueA: 0,
    trueB: 0,
    metricA: { visits: 0, atcRate: 0, convRate: 0 },
    metricB: { visits: 0, atcRate: 0, convRate: 0 },
    confidence: 0,
    winner: null,
    significant: false,
    applied: false,
    appliedValue: null,
    writing: false,
    apiError: null,
    liveNote: null,
    lastRefresh: null,
  };
}

/* ─── 主组件 ─────────────────────────────────────────── */

export default function ABTestingPanel({
  isDemo,
  shopName,
  fullProducts,
  shopUrl = "",
  accessToken = "",
}: ABTestingPanelProps) {
  const [sim, setSim] = useState<SimState>(initialState);
  const [search, setSearch] = useState("");

  const products = useMemo(() => (fullProducts as any[]) || [], [fullProducts]);
  const selectedProduct = useMemo(
    () => products.find((p) => p.handle === sim.productHandle) || null,
    [products, sim.productHandle],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => String(p.title || "").toLowerCase().includes(q));
  }, [products, search]);

  const valueA = useMemo(() => {
    if (!selectedProduct) return "";
    return sim.testType === "title"
      ? String(selectedProduct.title ?? "")
      : String(selectedProduct.variants?.[0]?.price ?? "");
  }, [selectedProduct, sim.testType]);

  const canStart = useMemo(() => {
    if (!selectedProduct || sim.writing) return false;
    const b = sim.valueB.trim();
    if (!b) return false;
    if (sim.testType === "price") {
      const num = parseFloat(b);
      if (isNaN(num) || num <= 0) return false;
    }
    if (b === valueA) return false;
    return true;
  }, [selectedProduct, sim.valueB, sim.testType, sim.writing, valueA]);

  /* 选择商品 → 自动填入变体 A 并把变体 B 预设为当前值 */
  function handleSelectProduct(handle: string) {
    const p = products.find((x) => x.handle === handle);
    const va = sim.testType === "title"
      ? String(p?.title ?? "")
      : String(p?.variants?.[0]?.price ?? "");
    setSim((s) => ({ ...s, productHandle: handle, valueB: va, apiError: null }));
  }

  /* 切换测试类型 → 同步刷新 A/B 默认值 */
  function handleTypeChange(t: ABTestType) {
    const p = products.find((x) => x.handle === sim.productHandle);
    const va = t === "title" ? String(p?.title ?? "") : String(p?.variants?.[0]?.price ?? "");
    setSim((s) => ({ ...s, testType: t, valueB: p ? va : s.valueB, apiError: null }));
  }

  /* 开始测试 */
  async function startTest() {
    if (!selectedProduct) return;
    const id = sim.testType === "title"
      ? Number(selectedProduct.id)
      : Number(selectedProduct.variants?.[0]?.variantId);
    const b = sim.valueB.trim();
    if (!b) return;
    if (sim.testType === "price") {
      const num = parseFloat(b);
      if (isNaN(num) || num <= 0) {
        setSim((s) => ({ ...s, apiError: "价格必须为大于 0 的数字" }));
        return;
      }
    }

    // 模拟目标：基于商品 handle 确定性生成
    const seed = hashSeed(selectedProduct.handle + b);
    const seed2 = hashSeed(selectedProduct.handle + "lift");
    const totalVisits = 600 + (seed % 2400);
    const totalPerVariant = Math.max(60, Math.round(totalVisits / 2));
    const trueA = 3 + (seed % 50) / 10; // 3.0 - 7.9%
    const lift = (10 + (seed2 % 25)) / 100; // +10% ~ +34%
    const trueB = +(trueA * (1 + lift)).toFixed(2);

    let baseConv = trueA;
    let liveNote: string | null = null;
    if (!isDemo) {
      const pages = readGa4CachePages();
      const pg = pages?.find((p) => p.path === "/products/" + selectedProduct.handle);
      if (pg && pg.sessions > 0) {
        baseConv = +((pg.conversions / pg.sessions) * 100).toFixed(2);
      }
      liveNote = pages
        ? `已实时读取 GA4「/${selectedProduct.handle}」页面作为基线；A/B 对比为本地估算（Shopify 端无法做真实流量分流，建议结合实验平台交叉验证）。`
        : `未检测到 GA4 缓存，基线采用估算值；A/B 对比为本地估算。`;
    }

    const initVisits = Math.max(30, Math.round(totalPerVariant * 0.05));
    const initA: ABMetrics = {
      visits: initVisits,
      convRate: +baseConv.toFixed(2),
      atcRate: +(baseConv * 2.9).toFixed(1),
    };
    const initB: ABMetrics = {
      visits: initVisits,
      convRate: +trueB.toFixed(2),
      atcRate: +(trueB * 2.9).toFixed(1),
    };

    // 真实模式：将变体 B 写入 Shopify
    if (!isDemo) {
      setSim((s) => ({ ...s, writing: true, apiError: null }));
      const res = await writeVariant(shopUrl, accessToken, sim.testType, id, b);
      if (!res.ok) {
        setSim((s) => ({ ...s, writing: false, apiError: `写入变体 B 失败：${res.error}` }));
        return;
      }
    }

    setSim((prev) => ({
      ...prev,
      phase: "running",
      productId: id,
      variantId: sim.testType === "price" ? id : null,
      valueA,
      startedAt: Date.now(),
      daysElapsed: 0,
      totalPerVariant,
      trueA: baseConv,
      trueB,
      metricA: initA,
      metricB: initB,
      confidence: 0,
      winner: null,
      significant: false,
      applied: false,
      appliedValue: null,
      writing: false,
      apiError: null,
      liveNote,
      lastRefresh: Date.now(),
    }));
  }

  /* 结束测试 */
  function finishTest() {
    setSim((prev) => {
      const w: "A" | "B" = prev.metricB.convRate >= prev.metricA.convRate ? "B" : "A";
      return { ...prev, phase: "finished", winner: w, significant: prev.confidence >= 80 };
    });
  }

  /* 应用胜出版本 */
  async function applyWinner() {
    if (!sim.winner || !selectedProduct) return;
    const winnerValue = sim.winner === "A" ? sim.valueA : sim.valueB;
    const id = sim.testType === "title"
      ? Number(selectedProduct.id)
      : Number(selectedProduct.variants?.[0]?.variantId);

    if (isDemo) {
      setSim((s) => ({ ...s, applied: true, appliedValue: winnerValue }));
      return;
    }
    setSim((s) => ({ ...s, writing: true, apiError: null }));
    const res = await writeVariant(shopUrl, accessToken, sim.testType, id, winnerValue);
    if (!res.ok) {
      setSim((s) => ({ ...s, writing: false, apiError: `应用胜出版本失败：${res.error}` }));
      return;
    }
    setSim((s) => ({ ...s, writing: false, applied: true, appliedValue: winnerValue }));
  }

  /* 返回创建（保留已选商品与类型，便于重跑） */
  function backToSetup() {
    setSim((prev) => ({
      ...prev,
      phase: "setup",
      daysElapsed: 0,
      metricA: { visits: 0, atcRate: 0, convRate: 0 },
      metricB: { visits: 0, atcRate: 0, convRate: 0 },
      confidence: 0,
      winner: null,
      significant: false,
      applied: false,
      appliedValue: null,
      startedAt: null,
      liveNote: null,
    }));
  }

  /* 轮询 / 自动推进 */
  useEffect(() => {
    if (sim.phase !== "running") return;
    const tickMs = isDemo ? DEMO_TICK_MS : REAL_TICK_MS;
    const interval = setInterval(() => {
      setSim((prev) => {
        if (prev.phase !== "running") return prev;
        const add = Math.max(20, Math.round(prev.totalPerVariant / Math.max(1, prev.duration)));
        const noiseA = (Math.random() - 0.5) * 0.3;
        const noiseB = (Math.random() - 0.5) * 0.3;
        const mA: ABMetrics = {
          visits: prev.metricA.visits + add,
          convRate: +(prev.trueA + noiseA).toFixed(2),
          atcRate: +((prev.trueA + noiseA) * 2.9).toFixed(1),
        };
        const mB: ABMetrics = {
          visits: prev.metricB.visits + add,
          convRate: +(prev.trueB + noiseB).toFixed(2),
          atcRate: +((prev.trueB + noiseB) * 2.9).toFixed(1),
        };
        const { confidence } = computeConfidence(mA.convRate, mA.visits, mB.convRate, mB.visits);
        const daysElapsed = prev.daysElapsed + 1;

        let phase: TestPhase = prev.phase;
        let winner = prev.winner;
        let significant = prev.significant;
        if (isDemo && daysElapsed >= prev.duration) {
          phase = "finished";
          winner = mB.convRate >= mA.convRate ? "B" : "A";
          significant = confidence >= 80;
        }
        return { ...prev, metricA: mA, metricB: mB, confidence, daysElapsed, phase, winner, significant, lastRefresh: Date.now() };
      });
    }, tickMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.phase, isDemo]);

  const steps: Array<{ key: TestPhase; label: string; icon: ReactNode }> = [
    { key: "setup", label: "创建测试", icon: <FlaskConical className="h-4 w-4" /> },
    { key: "running", label: "测试中监控", icon: <GitCompare className="h-4 w-4" /> },
    { key: "finished", label: "测试结果", icon: <Trophy className="h-4 w-4" /> },
  ];
  const stepIndex = steps.findIndex((s) => s.key === sim.phase);

  const confColor =
    sim.confidence >= 80 ? "emerald" : sim.confidence >= 60 ? "amber" : "red";

  return (
    <div className="w-full space-y-5">
      {/* 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <GitBranch className="h-5 w-5 text-emerald-400" />
            A/B 测试
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {shopName} · 标题 / 价格 A/B 实验：创建、实时监控与胜者应用
          </p>
        </div>
        {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
      </div>

      {/* 步骤条 */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
                i < stepIndex
                  ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                  : i === stepIndex
                    ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/50"
                    : "bg-zinc-800 text-zinc-600 ring-zinc-700",
              )}
            >
              {s.icon}
            </div>
            <span className={cn("text-xs font-medium", i === stepIndex ? "text-zinc-200" : "text-zinc-500")}>{s.label}</span>
            {i < steps.length - 1 && <div className={cn("h-px flex-1", i < stepIndex ? "bg-emerald-500/40" : "bg-zinc-800")} />}
          </div>
        ))}
      </div>

      {/* 错误条 */}
      {sim.apiError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-start gap-3 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="flex-1 text-xs text-red-200">{sim.apiError}</p>
            <button onClick={() => setSim((s) => ({ ...s, apiError: null }))} className="text-red-400/70 hover:text-red-300">
              <X className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── 阶段一：创建测试 ── */}
      {sim.phase === "setup" && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-emerald-400" />创建 A/B 测试
            </CardTitle>
            <CardDescription>选择测试类型与目标商品，开始后将把变体 B 写入商品并持续监控</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 测试类型 */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">测试类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTypeChange("title")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    sim.testType === "title"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800",
                  )}
                >
                  <Type className="h-4 w-4" />标题 A/B
                </button>
                <button
                  onClick={() => handleTypeChange("price")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    sim.testType === "price"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800",
                  )}
                >
                  <Tag className="h-4 w-4" />价格 A/B
                </button>
              </div>
            </div>

            {/* 目标商品：搜索 + 下拉 */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">目标商品（搜索或下拉）</label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索商品名称..."
                    className="pl-8"
                  />
                </div>
                <Select value={sim.productHandle ?? ""} onValueChange={(v) => handleSelectProduct(v as string)}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100">
                    <SelectValue placeholder={products.length ? "选择商品" : "暂无商品（请先加载商品目录）"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((p) => (
                      <SelectItem key={p.handle} value={p.handle}>{String(p.title)}</SelectItem>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="px-3 py-2 text-xs text-zinc-500">无匹配商品</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 变体 A / B */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">
                  变体 A（当前值{sim.testType === "price" ? " · 价格" : " · 标题"}）
                </label>
                <Input value={valueA} disabled className="bg-zinc-800/60 text-zinc-400" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">
                  变体 B（新值{sim.testType === "price" ? " · 价格" : " · 标题"}）
                </label>
                <Input
                  value={sim.valueB}
                  onChange={(e) => setSim((s) => ({ ...s, valueB: e.target.value, apiError: null }))}
                  placeholder={sim.testType === "price" ? "例如 179.0" : "输入新的标题"}
                  inputMode={sim.testType === "price" ? "decimal" : "text"}
                />
              </div>
            </div>

            {/* 测试周期 */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">测试周期</label>
              <Select value={String(sim.duration)} onValueChange={(v) => setSim((s) => ({ ...s, duration: Number(v) }))}>
                <SelectTrigger className="w-40 border-zinc-700 bg-zinc-800 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 天</SelectItem>
                  <SelectItem value="7">7 天（默认）</SelectItem>
                  <SelectItem value="14">14 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isDemo && selectedProduct && (
              <p className="flex items-start gap-2 text-xs text-zinc-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                开始后将通过 Shopify Admin API 把「变体 B」写入商品
                {sim.testType === "price" ? "的变体价格" : "标题"}（{valueA} → {sim.valueB || "（待输入）"}）。
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={startTest} disabled={!canStart} className="gap-2">
                {sim.writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {sim.writing ? "写入中..." : "开始测试"}
              </Button>
              {!canStart && selectedProduct && (
                <span className="text-xs text-zinc-500">变体 B 需为与当前值不同的有效值</span>
              )}
              {!selectedProduct && <span className="text-xs text-zinc-500">请先选择目标商品</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 阶段二：测试中监控 ── */}
      {sim.phase === "running" && selectedProduct && (
        <div className="space-y-4">
          {/* 测试概要 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs">
              <div>
                <span className="text-zinc-500">商品：</span>
                <span className="text-zinc-200">{String(selectedProduct.title)}</span>
              </div>
              <div>
                <span className="text-zinc-500">类型：</span>
                <span className="text-zinc-200">{sim.testType === "title" ? "标题 A/B" : "价格 A/B"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">变体：</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{sim.valueA}</span>
                <ArrowText />
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{sim.valueB}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-zinc-200">第 {sim.daysElapsed}/{sim.duration} 天</span>
              </div>
              {sim.lastRefresh && (
                <div className="text-zinc-500">
                  最后刷新：{new Date(sim.lastRefresh).toLocaleTimeString("zh-CN")}
                </div>
              )}
            </CardContent>
          </Card>

          {sim.liveNote && (
            <Card className="border-sky-500/30 bg-sky-500/5">
              <CardContent className="flex items-start gap-3 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <p className="text-xs text-sky-200">{sim.liveNote}</p>
              </CardContent>
            </Card>
          )}

          {/* A vs B 对比 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompare className="h-4 w-4 text-sky-400" />变体 A vs B 实时监控
              </CardTitle>
              <CardDescription>访问量 / 加购率 / 成交率对比（成交率为置信度计算主指标）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <VariantHead label="变体 A（当前）" value={sim.valueA} accent="zinc" />
                <VariantHead label="变体 B（新）" value={sim.valueB} accent="emerald" />
              </div>
              <CompareRow
                label="页面访问"
                a={fmtInt(sim.metricA.visits)}
                b={fmtInt(sim.metricB.visits)}
                pa={sim.metricA.visits}
                pb={sim.metricB.visits}
                better="high"
                aWins={sim.metricA.visits >= sim.metricB.visits}
                bWins={sim.metricB.visits >= sim.metricA.visits}
              />
              <CompareRow
                label="加购率"
                a={fmtPct(sim.metricA.atcRate)}
                b={fmtPct(sim.metricB.atcRate)}
                pa={sim.metricA.atcRate}
                pb={sim.metricB.atcRate}
                better="high"
                aWins={sim.metricA.atcRate >= sim.metricB.atcRate}
                bWins={sim.metricB.atcRate >= sim.metricA.atcRate}
              />
              <CompareRow
                label="成交率"
                a={fmtPct(sim.metricA.convRate)}
                b={fmtPct(sim.metricB.convRate)}
                pa={sim.metricA.convRate}
                pb={sim.metricB.convRate}
                better="high"
                aWins={sim.metricA.convRate >= sim.metricB.convRate}
                bWins={sim.metricB.convRate >= sim.metricA.convRate}
                highlight
              />
            </CardContent>
          </Card>

          {/* 置信度 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-violet-400" />统计显著性（双比例 Z 检验）
              </CardTitle>
              <CardDescription>基于成交率与样本量的置信度；≥ 80% 视为结果显著</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <p className={cn("text-4xl font-bold tabular-nums", confColor === "emerald" ? "text-emerald-400" : confColor === "amber" ? "text-amber-400" : "text-red-400")}>
                  {sim.confidence.toFixed(1)}%
                </p>
                <div className="flex-1 pb-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn("h-full rounded-full transition-all", confColor === "emerald" ? "bg-emerald-500" : confColor === "amber" ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${Math.max(2, sim.confidence)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {sim.confidence >= 80
                      ? "结果显著，可据此决策"
                      : sim.confidence >= 60
                        ? "趋势显现，建议继续积累样本"
                        : "样本不足或差异不明显，需更多数据"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setSim((s) => ({ ...s, lastRefresh: Date.now() }))} className="gap-2">
              <RefreshCw className="h-4 w-4" />刷新数据
            </Button>
            <Button variant="outline" onClick={finishTest} className="gap-2">
              <Square className="h-4 w-4" />结束测试
            </Button>
            {!isDemo && <span className="text-xs text-zinc-500">真实模式每日自动拉取 GA4（此处轮询 {REAL_TICK_MS / 1000}s）</span>}
            {isDemo && <span className="text-xs text-zinc-500">演示模式每 {DEMO_TICK_MS / 1000}s 推进 1 天，到达周期后自动结束</span>}
          </div>
        </div>
      )}

      {/* ── 阶段三：测试结果 ── */}
      {sim.phase === "finished" && selectedProduct && (
        <div className="space-y-4">
          {/* 胜者 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl ring-1", sim.winner === "B" ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" : "bg-zinc-500/10 text-zinc-300 ring-zinc-600/30")}>
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-500">胜出版本</p>
                  <p className="text-xl font-bold text-zinc-100">
                    变体 {sim.winner}（{sim.winner === "B" ? sim.valueB : sim.valueA}）
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-3xl font-bold tabular-nums", confColor === "emerald" ? "text-emerald-400" : confColor === "amber" ? "text-amber-400" : "text-red-400")}>
                    {sim.confidence.toFixed(1)}%
                  </p>
                  <p className="text-xs text-zinc-500">置信度</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 text-sm">
                {sim.winner === "B" ? (
                  <p className="text-zinc-300">
                    {sim.significant
                      ? `变体 B（${sim.valueB}）成交率 ${fmtPct(sim.metricB.convRate)} 优于变体 A（${fmtPct(sim.metricA.convRate)}），置信度 ${sim.confidence.toFixed(1)}%，建议将 B 设为正式版本。`
                      : `变体 B 当前领先，但置信度仅 ${sim.confidence.toFixed(1)}%，尚不显著。建议延长测试周期或扩大流量后再决策。`}
                  </p>
                ) : (
                  <p className="text-zinc-300">
                    {sim.significant
                      ? `变体 A（${sim.valueA}）成交率 ${fmtPct(sim.metricA.convRate)} 仍优于变体 B（${fmtPct(sim.metricB.convRate)}），置信度 ${sim.confidence.toFixed(1)}%。建议保留当前版本，或调整变体 B 后重试。`
                      : `两版本差异不显著（置信度 ${sim.confidence.toFixed(1)}%）。建议保留当前版本，或重新设计变体 B。`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 对比回顾 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">结果对比</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <VariantHead label="变体 A（当前）" value={sim.valueA} accent="zinc" />
                <VariantHead label="变体 B（新）" value={sim.valueB} accent="emerald" />
              </div>
              <CompareRow label="页面访问" a={fmtInt(sim.metricA.visits)} b={fmtInt(sim.metricB.visits)} pa={sim.metricA.visits} pb={sim.metricB.visits} better="high" aWins={sim.metricA.visits >= sim.metricB.visits} bWins={sim.metricB.visits >= sim.metricA.visits} />
              <CompareRow label="加购率" a={fmtPct(sim.metricA.atcRate)} b={fmtPct(sim.metricB.atcRate)} pa={sim.metricA.atcRate} pb={sim.metricB.atcRate} better="high" aWins={sim.metricA.atcRate >= sim.metricB.atcRate} bWins={sim.metricB.atcRate >= sim.metricA.atcRate} />
              <CompareRow label="成交率" a={fmtPct(sim.metricA.convRate)} b={fmtPct(sim.metricB.convRate)} pa={sim.metricA.convRate} pb={sim.metricB.convRate} better="high" aWins={sim.metricA.convRate >= sim.metricB.convRate} bWins={sim.metricB.convRate >= sim.metricA.convRate} highlight />
            </CardContent>
          </Card>

          {/* 操作 */}
          <div className="flex flex-wrap items-center gap-3">
            {!sim.applied ? (
              <Button onClick={applyWinner} disabled={sim.writing} className="gap-2">
                {sim.writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {sim.writing ? "应用中..." : `应用胜出版本（变体 ${sim.winner}）`}
              </Button>
            ) : (
              <span className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                已应用：{sim.appliedValue}
              </span>
            )}
            <Button variant="outline" onClick={backToSetup} className="gap-2">
              <RefreshCw className="h-4 w-4" />重新测试
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 子组件 ─────────────────────────────────────────── */

function ArrowText() {
  return <span className="text-zinc-500">→</span>;
}

function VariantHead({ label, value, accent }: { label: string; value: string; accent: "zinc" | "emerald" }) {
  return (
    <div className={cn("rounded-lg border p-3", accent === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/30")}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold", accent === "emerald" ? "text-emerald-300" : "text-zinc-200")} title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

function CompareRow({
  label, a, b, pa, pb, better, aWins, bWins, highlight,
}: {
  label: string;
  a: string; b: string;
  pa: number; pb: number;
  better: "high" | "low";
  aWins: boolean; bWins: boolean;
  highlight?: boolean;
}) {
  const max = Math.max(pa, pb, 1);
  return (
    <div className={cn("rounded-lg border border-zinc-800 bg-zinc-950/30 p-3", highlight && "ring-1 ring-emerald-500/20")}>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-500">{better === "high" ? "越高越好" : "越低越好"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CompareCell label="A" value={a} pct={pa / max} win={aWins && pa !== pb} accent="zinc" />
        <CompareCell label="B" value={b} pct={pb / max} win={bWins && pa !== pb} accent="emerald" />
      </div>
    </div>
  );
}

function CompareCell({ label, value, pct, win, accent }: {
  label: string; value: string; pct: number; win: boolean; accent: "zinc" | "emerald";
}) {
  const bar = accent === "emerald" ? "bg-emerald-500" : "bg-zinc-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        {win && (
          <span className={cn("text-[10px] font-semibold", accent === "emerald" ? "text-emerald-400" : "text-zinc-300")}>
            领先
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
      </div>
    </div>
  );
}
