"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, BarChart4, Search, ChevronDown, ChevronRight, X, Download,
  Star, StarOff, TrendingDown, Zap, CheckCircle2, AlertCircle,
  Package, DollarSign, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { type ProductRank, type TrendPoint, type LifecycleStage, generateDemoTrend } from "@/lib/product-analytics";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

interface ProductAnalyticsPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  fullProducts?: Array<{ id: number; title: string; vendor: string; productType: string; status: string; variants: Array<{ variantId: number; name: string; sku: string; price: number; costItem?: number }> }>;
}

/* ─── Helpers ─────────────────────────────────────────── */

const LIFECYCLE: Record<LifecycleStage, { label: string; color: string; bg: string; emoji: string }> = {
  new: { label: "新品期", color: "text-sky-400", bg: "bg-sky-500/15", emoji: "🆕" },
  rising: { label: "上升期", color: "text-emerald-400", bg: "bg-emerald-500/15", emoji: "🔥" },
  mature: { label: "成熟期", color: "text-blue-400", bg: "bg-blue-500/15", emoji: "✅" },
  declining: { label: "衰退期", color: "text-amber-400", bg: "bg-amber-500/15", emoji: "📉" },
  dormant: { label: "休眠期", color: "text-zinc-400", bg: "bg-zinc-500/15", emoji: "💤" },
};

const COGS_RATE = 0.45; const SHIP_RATE = 0.12; const GW_RATE = 0.035; const AD_RATE = 0.08;

/* ─── Demo Data ───────────────────────────────────────── */

function generateDemoRanks(): ProductRank[] {
  const products = [
    { id: 1, title: "碳纤维手表 Chrono X", vendor: "TechGear", type: "可穿戴", status: "ACTIVE", vars: [{ vid: 101, n: "黑/42mm", s: "TG-BLK", p: 299.99 }, { vid: 102, n: "银/46mm", s: "TG-SLV", p: 349.99 }], lifecycle: "mature" as LifecycleStage },
    { id: 2, title: "无线降噪耳机 SonicFlow", vendor: "TechGear", type: "音频", status: "ACTIVE", vars: [{ vid: 201, n: "默认", s: "TG-SF", p: 149.99 }], lifecycle: "rising" as LifecycleStage },
    { id: 3, title: "AR 护目镜 Air", vendor: "TechGear", type: "可穿戴", status: "ACTIVE", vars: [{ vid: 301, n: "默认", s: "TG-ARG", p: 89.99 }], lifecycle: "new" as LifecycleStage },
    { id: 4, title: "机械键盘 K8", vendor: "TechGear", type: "外设", status: "DRAFT", vars: [{ vid: 401, n: "青轴", s: "TG-BLU", p: 129.99 }, { vid: 402, n: "红轴", s: "TG-RED", p: 119.99 }], lifecycle: "declining" as LifecycleStage },
    { id: 5, title: "北欧台灯 LUX", vendor: "MinimalHome", type: "家居", status: "ACTIVE", vars: [{ vid: 501, n: "默认", s: "MH-LUX", p: 79.99 }], lifecycle: "mature" as LifecycleStage },
    { id: 6, title: "夏季T恤 基础款", vendor: "MinimalHome", type: "服装", status: "ACTIVE", vars: [{ vid: 701, n: "M", s: "MH-T-M", p: 29.99 }], lifecycle: "dormant" as LifecycleStage },
  ];
  const rng = (s: number) => { let v = s; return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; }; };

  return products.map((p, i) => {
    const rand = rng(p.id * 137);
    const gmv = Math.round(rand() * 50000 + 5000);
    const qty = Math.round(rand() * 100 + 5);
    const prof = Math.round(gmv * (0.15 + rand() * 0.35));
    const rr = Math.round(rand() * 8 * 10) / 10;
    const wg = Math.round((rand() * 40 - 15) * 10) / 10;
    return {
      productId: p.id, title: p.title, vendor: p.vendor, productType: p.type, status: p.status,
      variants: p.vars.map((v) => ({ variantId: v.vid, name: v.n, sku: v.s, gmv: Math.round(gmv * (0.3 + rand() * 0.7)), qty: Math.round(qty * (0.3 + rand() * 0.7)), returns: 0, returnRate: 0 })),
      gmv, qty, profit: prof, profitRate: gmv > 0 ? (prof / gmv) * 100 : 0, returnRate: rr, weekGrowth: wg,
      lifecycle: p.lifecycle,
    };
  }).sort((a, b) => b.gmv - a.gmv);
}

export default function ProductAnalyticsPanel({ isDemo, shopUrl, accessToken, shopName, fullProducts }: ProductAnalyticsPanelProps) {
  const [ranks, setRanks] = useState<ProductRank[]>(() => isDemo ? generateDemoRanks() : []);
  const [sortBy, setSortBy] = useState<keyof ProductRank>("gmv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"trend" | "profit" | "returns" | "orders">("trend");
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const types = useMemo(() => [...new Set(ranks.map((r) => r.productType).filter(Boolean))], [ranks]);
  const vendors = useMemo(() => [...new Set(ranks.map((r) => r.vendor).filter(Boolean))], [ranks]);

  const filtered = useMemo(() => {
    let list = ranks;
    if (search) list = list.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));
    if (filterLifecycle !== "all") list = list.filter((r) => r.lifecycle === filterLifecycle);
    if (filterType !== "all") list = list.filter((r) => r.productType === filterType);
    if (filterVendor !== "all") list = list.filter((r) => r.vendor === filterVendor);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    list.sort((a, b) => { const va = a[sortBy] as number, vb = b[sortBy] as number; return sortDir === "desc" ? vb - va : va - vb; });
    return list;
  }, [ranks, search, filterLifecycle, filterType, filterVendor, filterStatus, sortBy, sortDir]);

  const toggleSort = (col: keyof ProductRank) => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const toggleCompare = (id: number) => setCompareIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const expanded = expandedId ? ranks.find((r) => r.productId === expandedId) : null;
  const trendData = expanded ? generateDemoTrend(30, expanded.productId * 71) : [];
  const compareRanks = useMemo(() => ranks.filter((r) => compareIds.has(r.productId)), [ranks, compareIds]);

  // KPIs
  const avgGmv = ranks.length > 0 ? ranks.reduce((s, r) => s + r.gmv, 0) / ranks.length : 0;
  const hotCount = ranks.filter((r) => r.gmv > avgGmv * 1.5).length;
  const deadCount = ranks.filter((r) => r.qty === 0).length;
  const highRR = ranks.filter((r) => r.returnRate > 10).length;
  const top3 = [...ranks].sort((a, b) => b.profit - a.profit).slice(0, 3);

  const exportCSV = () => {
    const rows = filtered.map((r, i) => [i + 1, r.title, r.gmv, r.qty, `${r.profitRate.toFixed(1)}%`, `${r.returnRate.toFixed(1)}%`, `${r.weekGrowth > 0 ? "+" : ""}${r.weekGrowth}%`, r.lifecycle]);
    const csv = "\uFEFF" + [["排名","商品","GMV¥","销量","利润率","退货率","周增长","状态"], ...rows].map((r)=>r.map((c)=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_商品分析.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><BarChart4 className="h-6 w-6 text-purple-400" />商品分析</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName} · {ranks.length} 件商品{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[{v:ranks.length,l:"商品总数"},{v:hotCount,l:"热销"},{v:deadCount,l:"滞销"},{v:highRR,l:"高退货"},{l:"利润TOP",v:top3[0]?.title?.slice(0,8)}].map((s,i)=>
          <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-2 text-center"><p className="text-lg font-bold tabular-nums text-foreground">{s.v}</p><p className="text-[9px] text-muted-foreground">{s.l}</p></CardContent></Card>
        )}
      </div>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <div className="relative flex-1 min-w-[100px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="搜索..." className="h-7 pl-7 text-sm"/></div>
        <select value={filterLifecycle} onChange={(e)=>setFilterLifecycle(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="all">全部状态</option>{Object.entries(LIFECYCLE).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select>
        <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="all">品类</option>{types.map((t)=><option key={t}>{t}</option>)}</select>
        <select value={filterVendor} onChange={(e)=>setFilterVendor(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="all">供应商</option>{vendors.map((v)=><option key={v}>{v}</option>)}</select>
        <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="all">上架</option><option value="ACTIVE">上架</option><option value="DRAFT">下架</option></select>
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 text-xs gap-1"><Download className="h-3 w-3"/>导出</Button>
      </CardContent></Card>

      {/* Compare mode */}
      {compareIds.size > 0 && (
        <Card className="border-purple-500/30 bg-purple-500/5"><CardContent className="flex items-center gap-2 py-2 px-4">
          <span className="text-xs text-purple-400">对比模式 · {compareIds.size} 件商品</span>
          <Button size="sm" variant="ghost" onClick={()=>setCompareIds(new Set())} className="h-6 text-[9px]">清除</Button>
        </CardContent></Card>
      )}

      {/* Ranking Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="border-b border-border/20 text-xs font-semibold uppercase text-muted-foreground">
              <th className="py-2 pl-2 text-left w-6">#</th>
              <th className="py-2 pl-2 text-left">商品</th>
              <th className="py-2 px-2 text-right cursor-pointer" onClick={()=>toggleSort("gmv")}>GMV{sortBy==="gmv"&&(sortDir==="desc"?"↓":"↑")}</th>
              <th className="py-2 px-2 text-right cursor-pointer" onClick={()=>toggleSort("qty")}>销量</th>
              <th className="py-2 px-2 text-right cursor-pointer" onClick={()=>toggleSort("profitRate")}>利润率</th>
              <th className="py-2 px-2 text-right cursor-pointer" onClick={()=>toggleSort("returnRate")}>退货率</th>
              <th className="py-2 px-2 text-right cursor-pointer" onClick={()=>toggleSort("weekGrowth")}>周增长</th>
              <th className="py-2 px-2 text-center w-16">状态</th>
              <th className="py-2 px-2 text-center w-6">↔</th>
            </tr></thead>
            <tbody>
              {filtered.map((r, idx) => {
                const lc = LIFECYCLE[r.lifecycle];
                const isExpanded = expandedId === r.productId;
                const profitColor = r.profitRate > 30 ? "text-emerald-400" : r.profitRate > 15 ? "text-amber-400" : r.profitRate > 0 ? "text-red-400" : "text-red-500";
                return (
                  <tr key={r.productId} className={`border-b border-border/10 hover:bg-muted/5 cursor-pointer ${compareIds.has(r.productId) ? "bg-purple-500/5" : ""}`} onClick={() => setExpandedId(isExpanded ? null : r.productId)}>
                    <td className="py-2 pl-2 tabular-nums text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pl-2"><p className="text-foreground truncate max-w-[140px]">{r.title}</p><p className="text-[9px] text-muted-foreground">{r.variants.length} 变体</p></td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{formatCny(r.gmv * EXCHANGE_RATE)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.qty}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold ${profitColor}`}>{r.profitRate.toFixed(1)}%</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${r.returnRate > 10 ? "text-red-400" : "text-muted-foreground"}`}>{r.returnRate.toFixed(1)}%</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${r.weekGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.weekGrowth > 0 ? "+" : ""}{r.weekGrowth}%</td>
                    <td className="py-2 px-2 text-center"><Badge className={`text-[8px] px-1 py-0 ${lc.bg} ${lc.color}`}>{lc.emoji} {lc.label}</Badge></td>
                    <td className="py-2 px-2 text-center"><button onClick={(e)=>{e.stopPropagation();toggleCompare(r.productId);}} className="text-muted-foreground hover:text-purple-400">{compareIds.has(r.productId)?<Star className="h-3 w-3 text-purple-400"/>:<StarOff className="h-3 w-3"/>}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Expanded Detail */}
      {expanded && (
        <Card className="border-border/40 bg-card/60 shadow-xl border-l-2 border-l-purple-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{expanded.title}</p>
              <Button size="sm" variant="ghost" onClick={()=>setExpandedId(null)}><X className="h-4 w-4"/></Button>
            </div>
            <div className="flex gap-1">
              {(["trend","profit","returns","orders"] as typeof detailTab[]).map((t)=>(
                <button key={t} onClick={()=>setDetailTab(t)} className={`px-3 py-1 rounded text-xs font-medium ${detailTab===t?"bg-purple-500/15 text-purple-400":"text-muted-foreground"}`}>
                  {t==="trend"?"📈 趋势":t==="profit"?"💰 利润":t==="returns"?"🔄 退货":"📋 订单"}
                </button>
              ))}
            </div>
            {detailTab === "trend" && (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <Line type="monotone" dataKey="sales" stroke="#a855f7" strokeWidth={2} dot={false} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {detailTab === "profit" && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {[{l:"GMV",v:formatCny(expanded.gmv*EXCHANGE_RATE)},{l:"采购成本",v:formatCny(expanded.gmv*COGS_RATE*EXCHANGE_RATE)},{l:"物流",v:formatCny(expanded.gmv*SHIP_RATE*EXCHANGE_RATE)},{l:"网关费",v:formatCny(expanded.gmv*GW_RATE*EXCHANGE_RATE)},{l:"纯利润",v:formatCny(expanded.profit*EXCHANGE_RATE),c:"text-emerald-400"}].map((s,i)=>(
                    <div key={i} className="bg-muted/10 rounded p-2 text-center"><p className="text-muted-foreground">{s.l}</p><p className={`font-bold ${s.c||""}`}>{s.v}</p></div>
                  ))}
                </div>
                <div className="h-2 rounded bg-muted/20 overflow-hidden flex">
                  {[{p:1-COGS_RATE,c:"bg-purple-500"},{p:COGS_RATE-SHIP_RATE-GW_RATE-AD_RATE,c:"bg-zinc-500"},{p:SHIP_RATE,c:"bg-sky-500"},{p:GW_RATE,c:"bg-amber-500"},{p:AD_RATE,c:"bg-red-500"}].map((s,i)=><div key={i} className={`${s.c} h-full`} style={{width:`${Math.max(0,s.p*100)}%`}}/>)}
                </div>
              </div>
            )}
            {detailTab === "returns" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/10 rounded p-3"><p className="text-muted-foreground">退货率</p><p className={`text-lg font-bold ${expanded.returnRate>10?"text-red-400":"text-emerald-400"}`}>{expanded.returnRate.toFixed(1)}%</p><p className="text-muted-foreground/70 mt-1">全店均值: 5.2%</p></div>
                <div className="bg-muted/10 rounded p-2 flex items-center justify-center">
                  <ResponsiveContainer width={120} height={120}><PieChart><Pie data={[{n:"正常",v:100-expanded.returnRate},{n:"退货",v:expanded.returnRate}]} dataKey="v" nameKey="n" innerRadius={30} outerRadius={50}><Cell fill="#22c55e"/><Cell fill="#ef4444"/></Pie></PieChart></ResponsiveContainer>
                </div>
              </div>
            )}
            {detailTab === "orders" && (
              <div className="text-xs text-muted-foreground">该商品近 30 天订单明细（Demo）<br/>订单 #1001 · 2026-07-03 · US · 2件 · ¥599.98 · 已完成</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compare Summary */}
      {compareIds.size >= 2 && (
        <Card className="border-purple-500/30 bg-card/60"><CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">对比概览</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/20 text-muted-foreground"><th className="py-1 text-left">指标</th>{compareRanks.map((r)=><th key={r.productId} className="py-1 text-right">{r.title.slice(0,12)}</th>)}</tr></thead>
            <tbody>
              {(["gmv","qty","profitRate","returnRate"] as const).map((col)=>{
                const vals = compareRanks.map((r)=>r[col] as number);
                const best = col==="returnRate"?Math.min(...vals):Math.max(...vals);
                return <tr key={col} className="border-b border-border/10">
                  <td className="py-1 text-muted-foreground">{col==="gmv"?"GMV":col==="qty"?"销量":col==="profitRate"?"利润率":"退货率"}</td>
                  {vals.map((v,i)=><td key={i} className={`py-1 text-right tabular-nums font-semibold ${v===best?"text-emerald-400":"text-muted-foreground"}`}>{col==="gmv"?formatCny(v*EXCHANGE_RATE):col==="profitRate"||col==="returnRate"?`${v.toFixed(1)}%`:v}</td>)}
                </tr>;
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
