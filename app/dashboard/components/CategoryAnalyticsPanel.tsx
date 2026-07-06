"use client";

import { useState, useMemo } from "react";
import {
  PieChart, Grid, Download, BarChart4, TrendingUp, TrendingDown, Star,
  ChevronDown, X, CheckCircle2, AlertCircle, FileText, Eye, Table,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type CategoryRank, type ScatterPoint, computeCategoryRanking, computeScatterPoints } from "@/lib/product-analytics";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

interface CategoryAnalyticsPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  fullProducts?: Array<{ id: number; title: string; productType: string; status: string; variants: Array<{ price: number }> }>;
}

/* ─── Helpers ─────────────────────────────────────────── */

const HEALTH: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  healthy: { label: "健康", emoji: "🟢", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  ok: { label: "一般", emoji: "🟡", color: "text-amber-400", bg: "bg-amber-500/15" },
  watch: { label: "需关注", emoji: "🟠", color: "text-orange-400", bg: "bg-orange-500/15" },
  danger: { label: "危险", emoji: "🔴", color: "text-red-400", bg: "bg-red-500/15" },
};

const QUADRANTS = { star: "🌟 明星品类", potential: "💎 潜力品类", problem: "⚡ 问题品类", eliminate: "💤 淘汰候选" };
const GRADES = [
  { grade: "S", label: "核心品类", min: 0.2, color: "text-amber-400" },
  { grade: "A", label: "重要品类", min: 0.1, color: "text-purple-400" },
  { grade: "B", label: "常规品类", min: 0.05, color: "text-sky-400" },
  { grade: "C", label: "长尾品类", min: 0, color: "text-zinc-400" },
];

/* ─── Demo Data ───────────────────────────────────────── */

function generateDemoCategories(): CategoryRank[] {
  const base: Array<{ name: string; count: number; gmv: number; qty: number; profRate: number; rr: number; wg: number }> = [
    { name: "可穿戴设备", count: 12, gmv: 45200, qty: 156, profRate: 35, rr: 4.2, wg: 8 },
    { name: "音频设备", count: 8, gmv: 28700, qty: 98, profRate: 42, rr: 2.1, wg: 15 },
    { name: "家居用品", count: 5, gmv: 18200, qty: 67, profRate: 28, rr: 6.8, wg: -3 },
    { name: "电脑外设", count: 4, gmv: 9800, qty: 42, profRate: 22, rr: 8.5, wg: -12 },
    { name: "服装", count: 3, gmv: 3200, qty: 18, profRate: 18, rr: 12.3, wg: -8 },
  ];
  const totalGmv = base.reduce((s, b) => s + b.gmv, 0);
  return base.map((b, i) => {
    const profit = b.gmv * (b.profRate / 100);
    const score = 50 + b.profRate * 0.8 + (b.wg + 15) * 0.5 - b.rr * 1.5;
    const hScore = Math.min(100, Math.max(0, Math.round(score)));
    let hl: CategoryRank["healthLabel"];
    if (hScore >= 80) hl = "healthy";
    else if (hScore >= 60) hl = "ok";
    else if (hScore >= 40) hl = "watch";
    else hl = "danger";
    let tr: CategoryRank["trend"];
    if (b.wg > 5) tr = "rising";
    else if (b.wg < -5) tr = "declining";
    else tr = "stable";
    return {
      name: b.name, rank: i + 1, productCount: b.count, gmv: b.gmv, gmvShare: b.gmv / totalGmv,
      qty: b.qty, profit, profitRate: b.profRate, returnRate: b.rr, weekGrowth: b.wg,
      healthScore: hScore,
      healthLabel: hl,
      trend: tr,
    };
  });
}

export default function CategoryAnalyticsPanel({ isDemo, shopUrl, accessToken, shopName, fullProducts }: CategoryAnalyticsPanelProps) {
  const [categories, setCategories] = useState<CategoryRank[]>(() => isDemo ? generateDemoCategories() : []);
  const [view, setView] = useState<"cards" | "table" | "bubble">("cards");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "finance" | "inventory" | "compare">("overview");
  const [compareCat, setCompareCat] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const scatterPoints = useMemo(() => {
    const base = computeScatterPoints(categories);
    return base.map((p) => ({ ...p, fill: p.health === "healthy" ? "#22c55e" : p.health === "ok" ? "#f59e0b" : p.health === "watch" ? "#f97316" : "#ef4444" }));
  }, [categories]);
  const avgProfitRate = categories.length > 0 ? categories.reduce((s, c) => s + c.profitRate, 0) / categories.length : 0;

  // S/A/B/C grades
  const gradeCounts = useMemo(() => GRADES.map((g) => ({ ...g, count: categories.filter((c) => c.gmvShare >= g.min).length, totalGmv: categories.filter((c) => c.gmvShare >= g.min).reduce((s, c) => s + c.gmv, 0) })), [categories]);

  const expanded = expandedCat ? categories.find((c) => c.name === expandedCat) : null;

  const generateReport = () => {
    const stars = categories.filter((c) => c.healthLabel === "healthy").map((c) => `- ${c.name}: GMV ${formatCny(c.gmv * EXCHANGE_RATE)}, 利润率 ${c.profitRate.toFixed(1)}%`).join("\n");
    const problems = categories.filter((c) => c.healthLabel === "danger" || c.healthLabel === "watch").map((c) => `- ${c.name}: GMV ${formatCny(c.gmv * EXCHANGE_RATE)}, 利润率 ${c.profitRate.toFixed(1)}%, 退货率 ${c.returnRate.toFixed(1)}%`).join("\n");
    const md = `# ${shopName} 品类健康报告\n## 📊 概览\n- 明星品类: ${categories.filter((c) => c.healthLabel === "healthy").length} 个 | 问题品类: ${categories.filter((c) => c.healthLabel === "danger" || c.healthLabel === "watch").length} 个\n## 🔥 明星品类\n${stars}\n## ⚡ 需关注品类\n${problems}\n---\n*由 Shopify CN Pro 自动生成*`;
    const blob = new Blob([md], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_品类报告.md`; a.click();
    showToast("报告已下载");
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><PieChart className="h-6 w-6 text-fuchsia-400" />品类分析</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {categories.length} 个品类{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* Grade Summary */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[10px]">
        {gradeCounts.map((g) => (
          <div key={g.grade} className="flex items-center gap-1"><Badge className={`text-[9px] px-1.5 py-0 ${g.color} bg-muted/20`}>{g.grade}级</Badge><span className="text-muted-foreground">{g.label}: <span className="text-foreground">{g.count} 个</span> · {formatCny(g.totalGmv * EXCHANGE_RATE)}</span></div>
        ))}
        <div className="ml-auto flex gap-1">
          {([{k:"cards",l:"卡片",i:Eye},{k:"table",l:"表格",i:Table},{k:"bubble",l:"气泡图",i:BarChart4}] as const).map((v) => (
            <Button key={v.k} size="sm" variant={view === v.k ? "default" : "outline"} onClick={() => setView(v.k)} className={`h-6 text-[9px] gap-0.5 ${view===v.k?"bg-fuchsia-600":""}`}><v.i className="h-2.5 w-2.5"/>{v.l}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={generateReport} className="h-6 text-[9px] gap-0.5"><Download className="h-2.5 w-2.5"/>报告</Button>
        </div>
      </CardContent></Card>

      {/* Cards View */}
      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat) => {
            const h = HEALTH[cat.healthLabel];
            const aboveAvg = cat.profitRate >= avgProfitRate;
            return (
              <Card key={cat.name} className={`border-2 cursor-pointer hover:shadow-lg transition-shadow ${aboveAvg ? "border-emerald-500/20 bg-card/60" : "border-red-500/20 bg-card/60"}`}
                onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 py-0 ${cat.rank <= 3 ? (cat.rank === 1 ? "bg-amber-500/15 text-amber-400" : cat.rank === 2 ? "bg-zinc-400/15 text-zinc-300" : "bg-orange-500/15 text-orange-400") : "bg-muted/20 text-muted-foreground"}`}>#{cat.rank}</Badge>
                      <p className="font-semibold text-foreground">{cat.name}</p>
                    </div>
                    <Badge className={`text-[8px] px-1 py-0 ${h.bg} ${h.color}`}>{h.emoji} {h.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1"><span>GMV: <span className="text-foreground font-semibold">{formatCny(cat.gmv * EXCHANGE_RATE)}</span></span><span className="ml-auto">占全店 {cat.gmvShare.toFixed(1)}%</span></div>
                  <div className="h-1.5 rounded bg-muted/20 mb-2"><div className="h-full bg-fuchsia-500/50 rounded" style={{ width: `${cat.gmvShare * 100}%` }} /></div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    <div><p className="text-muted-foreground">销量</p><p className="tabular-nums">{cat.qty}</p></div>
                    <div><p className="text-muted-foreground">利润率</p><p className={`tabular-nums ${aboveAvg ? "text-emerald-400" : "text-red-400"}`}>{cat.profitRate.toFixed(1)}%</p></div>
                    <div><p className="text-muted-foreground">退货率</p><p className={`tabular-nums ${cat.returnRate > 8 ? "text-red-400" : ""}`}>{cat.returnRate.toFixed(1)}%</p></div>
                    <div><p className="text-muted-foreground">周增长</p><p className={`tabular-nums ${cat.weekGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{cat.weekGrowth > 0 ? "+" : ""}{cat.weekGrowth}%</p></div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5">{cat.productCount} 件商品 · 趋势: {cat.trend === "rising" ? "🔥 上升" : cat.trend === "declining" ? "📉 下降" : "➡ 平稳"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <Card className="border-border/40 bg-card/60 shadow-lg overflow-x-auto"><CardContent className="p-0">
          <table className="w-full text-xs min-w-[600px]">
            <thead><tr className="border-b border-border/20 text-[10px] font-semibold text-muted-foreground"><th className="py-2 pl-3 text-left">品类</th><th className="py-2 px-2 text-right">商品</th><th className="py-2 px-2 text-right">GMV</th><th className="py-2 px-2 text-right">占比</th><th className="py-2 px-2 text-right">利润率</th><th className="py-2 px-2 text-right">退货率</th><th className="py-2 px-2 text-right">增长</th><th className="py-2 px-2 text-center">健康度</th></tr></thead>
            <tbody>{categories.map((cat) => {
              const h = HEALTH[cat.healthLabel];
              return (<tr key={cat.name} className="border-b border-border/10 hover:bg-muted/5 cursor-pointer" onClick={() => setExpandedCat(cat.name)}>
                <td className="py-2 pl-3 font-medium text-foreground">{cat.name}</td>
                <td className="py-2 px-2 text-right">{cat.productCount}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatCny(cat.gmv * EXCHANGE_RATE)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{cat.gmvShare.toFixed(1)}%</td>
                <td className={`py-2 px-2 text-right tabular-nums ${cat.profitRate >= avgProfitRate ? "text-emerald-400" : "text-red-400"}`}>{cat.profitRate.toFixed(1)}%</td>
                <td className={`py-2 px-2 text-right tabular-nums ${cat.returnRate > 8 ? "text-red-400" : ""}`}>{cat.returnRate.toFixed(1)}%</td>
                <td className={`py-2 px-2 text-right tabular-nums ${cat.weekGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{cat.weekGrowth > 0 ? "+" : ""}{cat.weekGrowth}%</td>
                <td className="py-2 px-2 text-center"><Badge className={`text-[8px] px-1 py-0 ${h.bg} ${h.color}`}>{cat.healthScore}</Badge></td>
              </tr>);
            })}</tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Bubble Chart */}
      {view === "bubble" && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-4">
          <div className="text-[10px] text-muted-foreground mb-2 flex gap-4 flex-wrap">
            {Object.entries(QUADRANTS).map(([k, v]) => <span key={k}>{v}</span>)}
          </div>
          <div className="relative w-full h-[350px] border border-border/20 rounded bg-muted/5">
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-border/40" /><div className="absolute w-px h-full bg-border/40" /></div>
            <div className="absolute top-2 left-3 text-[8px] text-emerald-400">{QUADRANTS.potential}</div>
            <div className="absolute top-2 right-3 text-[8px] text-amber-400">{QUADRANTS.star}</div>
            <div className="absolute bottom-2 left-3 text-[8px] text-zinc-400">{QUADRANTS.eliminate}</div>
            <div className="absolute bottom-2 right-3 text-[8px] text-red-400">{QUADRANTS.problem}</div>
            {scatterPoints.map((p) => {
              const colors: Record<string, string> = { healthy: "#22c55e", ok: "#f59e0b", watch: "#f97316", danger: "#ef4444" };
              const xPct = Math.min(92, Math.max(8, p.x * 3));
              const yPct = Math.min(92, Math.max(8, 100 - p.y * 2.5));
              const size = Math.max(24, Math.min(80, (p.z || 5) * 4));
              return (<div key={p.name} className="absolute rounded-full flex items-center justify-center text-[8px] text-white font-medium" style={{ left: `${xPct}%`, top: `${yPct}%`, width: size, height: size, background: colors[p.health] || "#a855f7", transform: "translate(-50%, -50%)" }} title={`${p.name}: GMV${p.x.toFixed(1)}% 利润${p.y.toFixed(1)}%`}>{size > 30 ? p.name.slice(0, 2) : ""}</div>);
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Expanded Detail */}
      {expanded && (
        <Card className="border-border/40 bg-card/60 shadow-xl border-l-2 border-l-fuchsia-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{expanded.name}</p><Button size="sm" variant="ghost" onClick={()=>setExpandedCat(null)}><X className="h-4 w-4"/></Button></div>
            <div className="flex gap-1">{(["overview","finance","inventory","compare"] as const).map((t)=>{const l=t==="overview"?"📊 总览":t==="finance"?"💰 财务":t==="inventory"?"📦 库存":"🆚 对比";return(<button key={t} onClick={()=>setDetailTab(t)} className={`px-3 py-1 rounded text-[10px] font-medium ${detailTab===t?"bg-fuchsia-500/15 text-fuchsia-400":"text-muted-foreground"}`}>{l}</button>);})}</div>
            {detailTab === "overview" && <p className="text-[10px] text-muted-foreground">GMV: {formatCny(expanded.gmv*EXCHANGE_RATE)} · 利润率: {expanded.profitRate.toFixed(1)}% · {expanded.productCount} 件商品 · 健康状况: {HEALTH[expanded.healthLabel].emoji} {HEALTH[expanded.healthLabel].label}</p>}
            {detailTab === "finance" && <p className="text-[10px] text-muted-foreground">采购成本 ~{(45).toFixed(0)}% · 物流 ~{(12).toFixed(0)}% · 网关 ~{(3.5).toFixed(0)}% · 建议: {expanded.profitRate<avgProfitRate?"该品类利润率低于全店均值，建议优化成本结构":"该品类表现良好"}</p>}
            {detailTab === "inventory" && <p className="text-[10px] text-muted-foreground">库存分布: 充足 {Math.round(expanded.productCount*0.4)}件 · 偏低 {Math.round(expanded.productCount*0.3)}件 · 滞销 {Math.round(expanded.productCount*0.2)}件</p>}
            {detailTab === "compare" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">对比:</span>
                <select value={compareCat} onChange={(e)=>setCompareCat(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-[10px] px-1">
                  <option value="">选择品类...</option>
                  {categories.filter((c)=>c.name!==expanded.name).map((c)=><option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                {compareCat&&(<span className="text-[10px] text-muted-foreground">
                  {(()=>{const c=categories.find((x)=>x.name===compareCat);if(!c||!expanded)return null;return <span>{expanded.name} vs {c.name}: GMV {expanded.gmv>c.gmv?"↑":"↓"} · 利润 {expanded.profitRate>c.profitRate?"↑":"↓"}</span>;})()}
                </span>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
