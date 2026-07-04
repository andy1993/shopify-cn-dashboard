"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AlertTriangle, Gauge, Search, Download, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, RotateCcw, CheckCircle2, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

/* ─── Types ──────────────────────────────────────────── */

interface VariantStock {
  variantId: number; productId: number; productTitle: string; variantName: string; sku: string;
  inventory: number; sales30d: number; dailyAvg: number; daysCovered: number | null;
  suggestReorder: number; status: "critical" | "low" | "reorder" | "ok" | "soldOut";
  vendor: string; productType: string; image: string | null;
  shopUrl: string;
}

interface InventoryAlertPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  fullProducts?: Array<{ id: number; title: string; vendor: string; productType: string; image: string | null; status: string; shopName: string; variants: Array<{ variantId: number; name: string; sku: string; price: number; inventory: number }> }>;
  variantSales?: Record<number, number>;
}

/* ─── Seeded Random (Demo) ────────────────────────────── */

function mulberry32(seed: number) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function generateDemoSales(variantId: number): { sales30d: number; daily: number[] } {
  const rng = mulberry32(variantId * 31 + 7);
  const daily: number[] = [];
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const s = Math.max(0, Math.round(rng() * 5 + rng() * (variantId % 7)));
    daily.push(s); total += s;
  }
  return { sales30d: total, daily };
}

/* ─── Mini Chart ──────────────────────────────────────── */

function MiniSalesChart({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ day: i + 1, sales: v }));
  return (
    <ResponsiveContainer width={200} height={60}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="sales" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 10 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── Helpers ─────────────────────────────────────────── */

const STATUS_CONFIG = {
  critical: { label: "即将断货", color: "text-red-400", bg: "bg-red-500/10", badge: "bg-red-500/15 text-red-400", emoji: "🔴" },
  low: { label: "库存偏低", color: "text-amber-400", bg: "bg-amber-500/10", badge: "bg-amber-500/15 text-amber-400", emoji: "🟡" },
  reorder: { label: "建议补货", color: "text-orange-400", bg: "bg-orange-500/10", badge: "bg-orange-500/15 text-orange-400", emoji: "🟠" },
  ok: { label: "库存充足", color: "text-emerald-400", bg: "bg-emerald-500/10", badge: "bg-emerald-500/15 text-emerald-400", emoji: "🟢" },
  soldOut: { label: "已售罄", color: "text-zinc-400", bg: "bg-zinc-500/10", badge: "bg-zinc-500/15 text-zinc-400", emoji: "⚫" },
};

function loadHidden(): number[] { try { return JSON.parse(localStorage.getItem("inv_hidden_variants") || "[]"); } catch { return []; } }
function saveHidden(ids: number[]) { localStorage.setItem("inv_hidden_variants", JSON.stringify(ids)); const now = Date.now(); localStorage.setItem("inv_hidden_at", String(now)); }

export default function InventoryAlertPanel({ isDemo, shopUrl, accessToken, shopName, fullProducts, variantSales }: InventoryAlertPanelProps) {
  const [safetyDays, setSafetyDays] = useState(30);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"daysCovered" | "sales" | "inventory">("daysCovered");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set(loadHidden()));
  const [inTransit, setInTransit] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Clear hidden after 24h
  useEffect(() => { const at = localStorage.getItem("inv_hidden_at"); if (at && Date.now() - Number(at) > 86400000) { localStorage.removeItem("inv_hidden_variants"); setHiddenIds(new Set()); } }, []);

  /* ── Build variant stock list ───────────────────────── */
  const variants = useMemo(() => {
    const result: VariantStock[] = [];
    const products = isDemo ? DEMO_PRODUCTS : (fullProducts || []);

    for (const p of products) {
      for (const v of p.variants) {
        let sales30d = 0, daily: number[] = [];
        if (isDemo) {
          const d = generateDemoSales(v.variantId);
          sales30d = d.sales30d; daily = d.daily;
        } else {
          sales30d = variantSales?.[v.variantId] || 0;
          daily = new Array(30).fill(0);
        }

        const dailyAvg = sales30d / 30;
        const daysCovered = dailyAvg > 0 ? v.inventory / dailyAvg : null;
        let status: VariantStock["status"];
        if (v.inventory === 0) status = "soldOut";
        else if (!daysCovered || daysCovered === Infinity) status = "ok";
        else if (daysCovered < 7) status = "critical";
        else if (daysCovered < 14) status = "low";
        else if (daysCovered < 30) status = "reorder";
        else status = "ok";

        const inTrans = inTransit[v.variantId] || 0;
        const suggestReorder = Math.max(0, Math.ceil(safetyDays * dailyAvg - v.inventory - inTrans));

        result.push({
          variantId: v.variantId, productId: p.id, productTitle: p.title,
          variantName: v.name || "", sku: v.sku || "",
          inventory: v.inventory, sales30d, dailyAvg, daysCovered,
          suggestReorder, status, vendor: p.vendor || "", productType: p.productType || "",
          image: p.image, shopUrl: isDemo ? "demo" : (p as any).shopUrl || shopUrl,
        });
      }
    }
    return result;
  }, [isDemo, fullProducts, variantSales, safetyDays, inTransit]);

  /* ── Filter & sort ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = variants.filter((v) => !hiddenIds.has(v.variantId));
    if (search) { const q = search.toLowerCase(); list = list.filter((v) => v.productTitle.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)); }
    if (filterStatus !== "all") list = list.filter((v) => v.status === filterStatus);
    list.sort((a, b) => {
      if (sortBy === "daysCovered") { const da = a.daysCovered ?? Infinity, db = b.daysCovered ?? Infinity; return da - db; }
      if (sortBy === "sales") return b.sales30d - a.sales30d;
      return a.inventory - b.inventory;
    });
    return list;
  }, [variants, search, filterStatus, sortBy, hiddenIds]);

  /* ── KPI counts ────────────────────────────────────── */
  const kpi = useMemo(() => {
    const counts = { ok: 0, reorder: 0, low: 0, critical: 0, soldOut: 0 };
    variants.forEach((v) => counts[v.status]++);
    return counts;
  }, [variants]);

  /* ── Export CSV ─────────────────────────────────────── */
  const exportCSV = () => {
    const rows = filtered.filter((v) => (v.daysCovered ?? Infinity) < 30);
    const csv = "\uFEFF" + [["商品名","SKU","当前库存","近30天销量","日均销量","可售天数","建议补货量","供应商"], ...rows.map((v) => [v.productTitle + " - " + v.variantName, v.sku, String(v.inventory), String(v.sales30d), v.dailyAvg.toFixed(1), v.daysCovered !== null ? v.daysCovered.toFixed(1) : "∞", String(v.suggestReorder), v.vendor])].map((r) => r.map((c) => '"' + c.replace(/"/g,'""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${shopName}_补货清单_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast("补货清单已下载");
  };

  const markHidden = (variantId: number) => { const next = new Set(hiddenIds); next.add(variantId); setHiddenIds(next); saveHidden([...next]); showToast("已标记为已补货，24h 后自动恢复"); };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Gauge className="h-6 w-6 text-emerald-400" />库存健康面板</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {variants.length} 个 SKU{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{k:"ok",n:"库存充足",e:"🟢",c:"border-emerald-500/20 bg-emerald-500/5 text-emerald-400"},
          {k:"reorder",n:"建议补货",e:"🟠",c:"border-orange-500/20 bg-orange-500/5 text-orange-400"},
          {k:"critical",n:"即将断货",e:"🔴",c:"border-red-500/20 bg-red-500/5 text-red-400"},
          {k:"soldOut",n:"已售罄",e:"⚫",c:"border-zinc-500/20 bg-zinc-500/5 text-zinc-400"},
        ].map((item) => (
          <button key={item.k} onClick={() => setFilterStatus(filterStatus === item.k ? "all" : item.k)} className={`rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${filterStatus === item.k ? item.c + " ring-1" : "border-border/20 bg-muted/5 hover:bg-muted/10"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider">{item.e} {item.n}</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{kpi[item.k as keyof typeof kpi]}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/60">
        <CardContent className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="relative flex-1 min-w-[140px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索商品/SKU..." className="h-8 pl-7 text-xs"/></div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 rounded border border-border/40 bg-background text-xs text-foreground px-2">
            <option value="all">全部状态</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-8 rounded border border-border/40 bg-background text-xs text-foreground px-2">
            <option value="daysCovered">按紧急度</option><option value="sales">按销量</option><option value="inventory">按库存</option>
          </select>
          <div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">安全库存(天)</span><Input type="number" value={safetyDays} onChange={(e) => setSafetyDays(Number(e.target.value) || 30)} className="h-8 w-16 text-xs"/></div>
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 gap-1 text-xs"><Download className="h-3 w-3"/>导出补货清单</Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length > 0 ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pl-3 text-left">商品 / SKU</th>
                <th className="py-2 px-2 text-right w-16">库存</th>
                <th className="py-2 px-2 text-right hidden md:table-cell">30天销量</th>
                <th className="py-2 px-2 text-right w-16">可售天数</th>
                <th className="py-2 px-2 text-right hidden md:table-cell">建议补货</th>
                <th className="py-2 px-2 text-center w-16">状态</th>
              </tr></thead>
              <tbody>
                {filtered.map((v) => {
                  const cfg = STATUS_CONFIG[v.status];
                  return (
                    <tr key={v.variantId} className={`border-b border-border/10 hover:bg-muted/10 cursor-pointer ${cfg.bg}`} onClick={() => setExpandedId(expandedId === v.variantId ? null : v.variantId)}>
                      <td className="py-2 pl-3 pr-2">
                        <div className="flex items-center gap-2">
                          {expandedId === v.variantId ? <ChevronDown className="h-3 w-3 shrink-0"/> : <ChevronRight className="h-3 w-3 shrink-0"/>}
                          <div className="min-w-0"><p className="text-foreground truncate max-w-[180px]">{v.productTitle}</p><p className="text-[10px] text-muted-foreground">{v.sku}</p></div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-mono">{v.inventory}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">{v.sales30d}</td>
                      <td className={`py-2 px-2 text-right tabular-nums font-semibold ${(v.daysCovered ?? Infinity) < 7 ? "text-red-400" : (v.daysCovered ?? Infinity) < 14 ? "text-amber-400" : "text-foreground"}`}>{v.daysCovered !== null ? v.daysCovered < 100 ? v.daysCovered.toFixed(1) : "99+" : "∞"}</td>
                      <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">{v.suggestReorder > 0 ? v.suggestReorder : "—"}</td>
                      <td className="py-2 px-2 text-center"><Badge className={`text-[9px] px-1.5 py-0 ${cfg.badge}`}>{cfg.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">暂无匹配数据</div>
          )}
        </CardContent>
      </Card>

      {/* Expanded detail (shown as overlay card) */}
      {expandedId !== null && (() => {
        const v = variants.find((x) => x.variantId === expandedId);
        if (!v) return null;
        const demoDaily = isDemo ? generateDemoSales(v.variantId).daily : new Array(30).fill(0);
        const cfg = STATUS_CONFIG[v.status];
        return (
          <Card className={`border-border/40 shadow-xl ${cfg.bg}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.productTitle}</p>
                  <p className="text-[10px] text-muted-foreground">SKU: {v.sku} · 供应商: {v.vendor || "—"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => markHidden(v.variantId)} className="h-7 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3"/>标记已补货</Button>
              </div>
              <div className="flex items-center gap-4">
                <MiniSalesChart data={demoDaily} />
                <div className="text-[10px] space-y-0.5">
                  <p>日均销量: <span className="tabular-nums font-semibold">{v.dailyAvg.toFixed(1)}</span></p>
                  <p>近 30 天: <span className="tabular-nums font-semibold">{v.sales30d}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded bg-muted/10 px-2 py-1.5"><p className="text-[9px] text-muted-foreground">当前库存</p><p className="text-sm font-bold tabular-nums">{v.inventory}</p></div>
                <div className="rounded bg-muted/10 px-2 py-1.5"><p className="text-[9px] text-muted-foreground">可售天数</p><p className={`text-sm font-bold tabular-nums ${(v.daysCovered ?? Infinity) < 7 ? "text-red-400" : ""}`}>{v.daysCovered !== null ? v.daysCovered.toFixed(1) : "∞"}</p></div>
                <div className="rounded bg-muted/10 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">在途库存</p>
                  <Input type="number" value={inTransit[v.variantId] || 0} onChange={(e) => setInTransit((p) => ({ ...p, [v.variantId]: Number(e.target.value) || 0 }))} className="h-7 text-xs w-full" min={0} />
                </div>
              </div>
              {v.suggestReorder > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300">建议补货量：<strong className="tabular-nums text-amber-400">{v.suggestReorder}</strong> 件（安全库存 {safetyDays} 天 × 日均 {v.dailyAvg.toFixed(1)} — 库存 {v.inventory}{inTransit[v.variantId] ? ` — 在途 ${inTransit[v.variantId]}` : ""}）</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

/* ─── Demo Products ─────────────────────────────────────── */

const DEMO_PRODUCTS: Array<{ id: number; title: string; vendor: string; productType: string; image: string | null; status: string; shopName: string; variants: Array<{ variantId: number; name: string; sku: string; price: number; inventory: number }> }> = [
  { id: 1, title: "碳纤维手表 Chrono X", vendor: "TechGear Inc", productType: "可穿戴设备", image: null, status: "ACTIVE", shopName: "TechGear Pro",
    variants: [
      { variantId: 101, name: "黑色/42mm", sku: "TG-CX-BLK42", price: 299.99, inventory: 45 },
      { variantId: 102, name: "银色/46mm", sku: "TG-CX-SLV46", price: 349.99, inventory: 18 },
    ]},
  { id: 2, title: "无线降噪耳机 SonicFlow", vendor: "TechGear Inc", productType: "音频设备", image: null, status: "ACTIVE", shopName: "TechGear Pro",
    variants: [
      { variantId: 201, name: "默认", sku: "TG-SF-ANC", price: 149.99, inventory: 120 },
    ]},
  { id: 3, title: "AR 护目镜 Air", vendor: "TechGear Inc", productType: "可穿戴设备", image: null, status: "ACTIVE", shopName: "TechGear Pro",
    variants: [
      { variantId: 301, name: "默认", sku: "TG-ARG-AIR", price: 89.99, inventory: 3 },
    ]},
  { id: 4, title: "机械键盘 K8", vendor: "TechGear Inc", productType: "电脑外设", image: null, status: "DRAFT", shopName: "TechGear Pro",
    variants: [
      { variantId: 401, name: "青轴", sku: "TG-K8-BLU", price: 129.99, inventory: 5 },
      { variantId: 402, name: "红轴", sku: "TG-K8-RED", price: 119.99, inventory: 0 },
    ]},
  { id: 5, title: "北欧台灯 LUX", vendor: "MinimalHome", productType: "家居照明", image: null, status: "ACTIVE", shopName: "MinimalHome",
    variants: [
      { variantId: 501, name: "默认", sku: "MH-LUX1", price: 79.99, inventory: 40 },
    ]},
  { id: 6, title: "亚麻抱枕套", vendor: "MinimalHome", productType: "家居纺织品", image: null, status: "ACTIVE", shopName: "MinimalHome",
    variants: [
      { variantId: 601, name: "米白", sku: "MH-LIN-CRM", price: 39.99, inventory: 2 },
      { variantId: 602, name: "浅灰", sku: "MH-LIN-GRY", price: 44.99, inventory: 0 },
    ]},
];
