"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DollarSign, Coins, Search, Download, ChevronDown, ChevronRight, X, Save,
  TrendingUp, TrendingDown, RotateCcw, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface MarketPricing {
  id: string; name: string; countryCode: string; currency: string;
  priceAdjustment: { type: "percentage"; value: number } | null;
  exchangeRate: number; // e.g. 1 USD = 0.92 EUR
}

interface VariantPrice {
  variantId: number; productId: number; productTitle: string; variantName: string;
  sku: string; basePrice: number;
  marketPrices: Record<string, number>;     // marketId → current local price
  manualOverrides: Record<string, boolean>; // marketId → is manual override
}

interface MultiCurrencyPricingPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  markets?: Array<{ id: string; name: string; handle: string; enabled: boolean; countryCode: string; countries: string[]; currency: string; languages: Array<{ isoCode: string; name: string }>; domain: string; subfolder: string; priceAdjustment: { type: "percentage"; value: number } | null; productCount: number; localizedPrices?: Record<number, number> }>;
  fullProducts?: Array<{ id: number; title: string; vendor: string; productType: string; image: string | null; variants: Array<{ variantId: number; name: string; sku: string; price: number }> }>;
}

/* ─── Helpers ─────────────────────────────────────────── */

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function calcLocalPrice(base: number, adj: number | null, manualPrice?: number): number {
  if (manualPrice !== undefined) return manualPrice;
  if (adj === null) return base;
  return Math.round(base * (1 + adj / 100) * 100) / 100;
}

function getAdjustmentColor(base: number, local: number): string {
  if (local === base) return "text-zinc-400";
  const pct = ((local - base) / base) * 100;
  if (pct > 10) return "text-amber-400";
  if (pct > 0) return "text-amber-300";
  if (pct < -10) return "text-emerald-400";
  if (pct < 0) return "text-emerald-300";
  return "text-zinc-400";
}

function getAdjustmentLabel(base: number, local: number): string {
  if (local === base) return "=基础价";
  const pct = ((local - base) / base) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_MARKETS: MarketPricing[] = [
  { id: "us", name: "美国", countryCode: "US", currency: "USD", priceAdjustment: null, exchangeRate: 1.0 },
  { id: "uk", name: "英国", countryCode: "GB", currency: "GBP", priceAdjustment: { type:"percentage", value:20 }, exchangeRate: 0.79 },
  { id: "de", name: "德国", countryCode: "DE", currency: "EUR", priceAdjustment: { type:"percentage", value:15 }, exchangeRate: 0.92 },
  { id: "jp", name: "日本", countryCode: "JP", currency: "JPY", priceAdjustment: { type:"percentage", value:10 }, exchangeRate: 148.5 },
  { id: "fr", name: "法国", countryCode: "FR", currency: "EUR", priceAdjustment: { type:"percentage", value:15 }, exchangeRate: 0.92 },
];

const DEMO_VARIANTS: VariantPrice[] = [
  { variantId: 101, productId: 1, productTitle: "碳纤维手表 Chrono X", variantName: "黑色/42mm", sku: "TG-CX-BLK", basePrice: 299.99, marketPrices: { us:299.99, uk:359.99, de:344.99, jp:32999, fr:344.99 }, manualOverrides: { jp:true } },
  { variantId: 102, productId: 1, productTitle: "碳纤维手表 Chrono X", variantName: "银色/46mm", sku: "TG-CX-SLV", basePrice: 349.99, marketPrices: { us:349.99, uk:419.99, de:402.49, jp:38499, fr:402.49 }, manualOverrides: {} },
  { variantId: 201, productId: 2, productTitle: "无线降噪耳机 SonicFlow", variantName: "默认", sku: "TG-SF", basePrice: 149.99, marketPrices: { us:149.99, uk:179.99, de:172.49, jp:16499, fr:172.49 }, manualOverrides: {} },
  { variantId: 301, productId: 3, productTitle: "AR 护目镜 Air", variantName: "默认", sku: "TG-ARG", basePrice: 89.99, marketPrices: { us:89.99, uk:107.99, de:103.49, jp:9899, fr:103.49 }, manualOverrides: { us:true, uk:true } },
  { variantId: 401, productId: 4, productTitle: "机械键盘 K8", variantName: "青轴", sku: "TG-K8-BLU", basePrice: 129.99, marketPrices: { us:129.99, uk:155.99, de:149.49, jp:14299, fr:149.49 }, manualOverrides: {} },
  { variantId: 501, productId: 5, productTitle: "北欧台灯 LUX", variantName: "默认", sku: "MH-LUX", basePrice: 79.99, marketPrices: { us:79.99, uk:95.99, de:91.99, jp:8799, fr:91.99 }, manualOverrides: {} },
  { variantId: 601, productId: 6, productTitle: "亚麻抱枕套", variantName: "米白", sku: "MH-LIN-CRM", basePrice: 39.99, marketPrices: { us:39.99, uk:47.99, de:45.99, jp:4399, fr:45.99 }, manualOverrides: {} },
];

export default function MultiCurrencyPricingPanel({ isDemo, shopUrl, accessToken, shopName, markets: marketsProp, fullProducts }: MultiCurrencyPricingPanelProps) {
  const [markets, setMarkets] = useState<MarketPricing[]>(() => isDemo ? DEMO_MARKETS : []);
  const [visibleMarketIds, setVisibleMarketIds] = useState<Set<string>>(new Set(isDemo ? DEMO_MARKETS.map((m) => m.id) : []));
  const [variants, setVariants] = useState<VariantPrice[]>(() => isDemo ? DEMO_VARIANTS : []);
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ variantId: number; marketId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const visibleMarkets = useMemo(() => markets.filter((m) => visibleMarketIds.has(m.id)), [markets, visibleMarketIds]);
  const allMarketIds = useMemo(() => markets.map((m) => m.id), [markets]);

  const toggleMarket = (id: string) => setVisibleMarketIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = useMemo(() => {
    return variants.filter((v) => !search || v.productTitle.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase()));
  }, [variants, search]);

  const groupedProducts = useMemo(() => {
    const map = new Map<number, { title: string; variants: VariantPrice[] }>();
    filtered.forEach((v) => {
      if (!map.has(v.productId)) map.set(v.productId, { title: v.productTitle, variants: [] });
      map.get(v.productId)!.variants.push(v);
    });
    return map;
  }, [filtered]);

  const toggleExpand = (pid: number) => setExpandedProductId((p) => { const n = new Set(p); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  const startEdit = (vId: number, mId: string, current: number) => { setEditingCell({ variantId: vId, marketId: mId }); setEditValue(String(current)); };
  const saveEdit = () => {
    if (!editingCell) return;
    const val = parseFloat(editValue); if (isNaN(val) || val <= 0) { setEditingCell(null); return; }
    setVariants((prev) => prev.map((v) => v.variantId === editingCell.variantId ? {
      ...v, marketPrices: { ...v.marketPrices, [editingCell.marketId]: val },
      manualOverrides: { ...v.manualOverrides, [editingCell.marketId]: true },
    } : v));
    setEditingCell(null);
    showToast("价格已保存");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingCell(null); };

  const exportCSV = () => {
    const rows = filtered.map((v) => [v.productTitle + (v.variantName ? " - " + v.variantName : ""), v.sku, ...visibleMarkets.map((m) => v.marketPrices[m.id] || "")]);
    const header = ["商品","SKU", ...visibleMarkets.map((m) => m.currency)];
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map((c) => '"' + String(c).replace(/"/g,'""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_多币种定价.csv`; a.click();
    showToast("价格表已导出");
  };

  const selCount = selectedIds.size;
  const applyBatchAdjustment = (pct: number, mode: "multiply" | "up" | "down" | "reset") => {
    if (selCount === 0) return;
    setVariants((prev) => prev.map((v) => {
      const key = `${v.variantId}`; if (!selectedIds.has(key)) return v;
      const newPrices = { ...v.marketPrices };
      const newOverrides = { ...v.manualOverrides };
      visibleMarkets.forEach((m) => {
        if (mode === "reset") { delete newOverrides[m.id]; newPrices[m.id] = calcLocalPrice(v.basePrice, m.priceAdjustment?.value ?? null); }
        else {
          const cur = newPrices[m.id] || v.basePrice;
          if (mode === "multiply") newPrices[m.id] = Math.round(cur * pct * 100) / 100;
          else if (mode === "up") newPrices[m.id] = Math.round(cur * (1 + pct / 100) * 100) / 100;
          else if (mode === "down") newPrices[m.id] = Math.round(cur * (1 - pct / 100) * 100) / 100;
          newOverrides[m.id] = true;
        }
      });
      return { ...v, marketPrices: newPrices, manualOverrides: newOverrides };
    }));
    setSelectedIds(new Set());
    showToast(`已调整 ${selCount} 项`);
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><DollarSign className="h-6 w-6 text-amber-400" />多币种定价矩阵</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName}{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* Exchange Rates */}
      <button onClick={() => setShowRates(!showRates)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {showRates ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}汇率信息
      </button>
      {showRates && (
        <Card className="border-border/40 bg-muted/10"><CardContent className="p-3 flex flex-wrap gap-3 text-xs">
          {markets.filter((m) => m.exchangeRate !== 1).map((m) => <span key={m.id} className="text-muted-foreground">1 USD = <span className="text-foreground tabular-nums">{m.exchangeRate}</span> {m.currency}</span>)}
          <span className="text-muted-foreground/50 ml-2">汇率由 Shopify Markets 自动管理</span>
        </CardContent></Card>
      )}

      {/* Color Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-zinc-500 inline-block"/> =基础价</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500/70 inline-block"/> 上调</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500/70 inline-block"/> 下调</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-sky-500/70 inline-block"/> 手动覆盖</span>
      </div>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="relative flex-1 min-w-[120px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="搜索商品/SKU..." className="h-7 pl-7 text-sm"/></div>
        <Button size="sm" variant="outline" onClick={() => setExpandAll(!expandAll)} className="h-7 text-xs">{expandAll ? "折叠变体" : "展开变体"}</Button>
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 gap-1 text-xs"><Download className="h-3 w-3"/>导出</Button>
        <div className="flex items-center gap-1 ml-2">
          {markets.map((m) => (
            <label key={m.id} className="flex items-center gap-0.5 cursor-pointer text-xs">
              <input type="checkbox" checked={visibleMarketIds.has(m.id)} onChange={()=>toggleMarket(m.id)} className="accent-sky-500"/>{countryCodeToFlag(m.countryCode)} {m.currency}
            </label>
          ))}
        </div>
      </CardContent></Card>

      {/* Batch Ops Bar */}
      {selCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex items-center gap-2 py-2 px-4">
          <span className="text-xs text-amber-400">已选 {selCount} 行</span>
          <Button size="sm" variant="outline" onClick={()=>applyBatchAdjustment(1.5,"multiply")} className="h-7 text-xs">×1.5</Button>
          <Button size="sm" variant="outline" onClick={()=>applyBatchAdjustment(0.8,"multiply")} className="h-7 text-xs">×0.8</Button>
          <Button size="sm" variant="outline" onClick={()=>applyBatchAdjustment(5,"up")} className="h-7 text-xs text-amber-400">+5%</Button>
          <Button size="sm" variant="outline" onClick={()=>applyBatchAdjustment(5,"down")} className="h-7 text-xs text-emerald-400">−5%</Button>
          <Button size="sm" variant="outline" onClick={()=>applyBatchAdjustment(0,"reset")} className="h-7 text-xs text-sky-400">重置默认</Button>
        </CardContent></Card>
      )}

      {/* Matrix Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="border-b border-border/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pl-3 text-left w-6 sticky left-0 bg-card/90 backdrop-blur z-10">☐</th>
              <th className="py-2 pl-2 text-left sticky left-8 bg-card/90 backdrop-blur z-10">商品 / SKU</th>
              {visibleMarkets.map((m) => (
                <th key={m.id} className="py-2 px-3 text-right min-w-[90px]">{countryCodeToFlag(m.countryCode)} {m.currency}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...groupedProducts.entries()].map(([pid, group]) => {
                const mainVariant = group.variants[0];
                const isExpanded = expandedProductId.has(pid) || expandAll;
                const showVariants = isExpanded && group.variants.length > 1;
                return (
                  <tr key={pid} className="border-b border-border/10 hover:bg-muted/5">
                    <td className="py-2 pl-3"><input type="checkbox" onChange={()=>{const k=`${mainVariant.variantId}`;setSelectedIds((p)=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});}} checked={selectedIds.has(`${mainVariant.variantId}`)} className="accent-amber-500"/></td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-1">
                        {group.variants.length > 1 && <button onClick={()=>toggleExpand(pid)}>{isExpanded?<ChevronDown className="h-3 w-3"/>:<ChevronRight className="h-3 w-3"/>}</button>}
                        <div><p className="text-foreground truncate max-w-[180px]">{group.title}</p><p className="text-[9px] text-muted-foreground">{mainVariant.sku}</p></div>
                      </div>
                    </td>
                    {visibleMarkets.map((m) => {
                      const v = mainVariant;
                      const price = v.marketPrices[m.id] ?? v.basePrice;
                      const manual = v.manualOverrides[m.id];
                      const adj = m.priceAdjustment?.value ?? null;
                      const defaultPrice = calcLocalPrice(v.basePrice, adj);
                      const editing = editingCell?.variantId === v.variantId && editingCell?.marketId === m.id;
                      const colorClass = manual ? "text-sky-400" : getAdjustmentColor(v.basePrice, price);
                      return (
                        <td key={m.id} className={`py-2 px-3 text-right ${manual ? "border-l-2 border-l-sky-500 cursor-pointer" : "cursor-pointer"}`} onClick={() => startEdit(v.variantId, m.id, price)}>
                          {editing ? (
                            <Input type="number" step="0.01" value={editValue} onChange={(e)=>setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className="h-6 w-20 text-sm tabular-nums inline-block" onClick={(e)=>e.stopPropagation()} />
                          ) : (
                            <div>
                              <p className={`tabular-nums font-semibold ${colorClass}`}>{price.toFixed(2)}</p>
                              <p className="text-[9px] text-muted-foreground">{manual ? "手动覆盖" : getAdjustmentLabel(v.basePrice, price)}</p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
