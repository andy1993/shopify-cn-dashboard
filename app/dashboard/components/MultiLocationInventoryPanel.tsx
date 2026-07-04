"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Warehouse, MapPin, Search, ChevronDown, ChevronRight, X, Save, Download,
  AlertCircle, CheckCircle2, ArrowRightLeft, TrendingUp, BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface LocationItem { id: number; name: string; address1?: string; city?: string; country?: string; type: "domestic" | "overseas"; }

interface VariantInventory {
  variantId: number; productId: number; productTitle: string; variantName: string; sku: string;
  inventoryItemId?: string; locationStocks: Record<number, number>; // locationId → qty
}

interface MultiLocationInventoryPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  locations?: LocationItem[];
  inventoryByLocation?: Array<{ variantId: number; inventoryItemId: string; locationId: number; locationName: string; available: number }>;
  fullProducts?: Array<{ id: number; title: string; variants: Array<{ variantId: number; name: string; sku: string; inventory: number; inventoryItemId?: string }> }>;
  variantSales?: Record<number, number>;
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_LOCATIONS: LocationItem[] = [
  { id: 1, name: "默认仓库", city: "New York", country: "US", type: "overseas" },
  { id: 2, name: "FBA 美东", city: "Memphis", country: "US", type: "overseas" },
  { id: 3, name: "FBA 欧洲", city: "Frankfurt", country: "DE", type: "overseas" },
  { id: 4, name: "深圳仓", city: "深圳", country: "CN", type: "domestic" },
];

function generateDemoInventory(): VariantInventory[] {
  const base = [
    { vid: 101, pid: 1, title: "碳纤维手表 Chrono X", vname: "黑色/42mm", sku: "TG-CX-BLK", inv: 45, iid: "inv-101" },
    { vid: 102, pid: 1, title: "碳纤维手表 Chrono X", vname: "银色/46mm", sku: "TG-CX-SLV", inv: 18, iid: "inv-102" },
    { vid: 201, pid: 2, title: "无线降噪耳机 SonicFlow", vname: "默认", sku: "TG-SF", inv: 120, iid: "inv-201" },
    { vid: 301, pid: 3, title: "AR 护目镜 Air", vname: "默认", sku: "TG-ARG", inv: 3, iid: "inv-301" },
    { vid: 401, pid: 4, title: "机械键盘 K8", vname: "青轴", sku: "TG-K8-BLU", inv: 5, iid: "inv-401" },
    { vid: 402, pid: 4, title: "机械键盘 K8", vname: "红轴", sku: "TG-K8-RED", inv: 0, iid: "inv-402" },
    { vid: 501, pid: 5, title: "北欧台灯 LUX", vname: "默认", sku: "MH-LUX", inv: 40, iid: "inv-501" },
    { vid: 601, pid: 6, title: "亚麻抱枕套", vname: "米白", sku: "MH-LIN-CRM", inv: 2, iid: "inv-601" },
  ];
  const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

  return base.map((b) => {
    const rand = rng(b.vid * 31);
    const total = b.inv;
    let remaining = total;
    const stocks: Record<number, number> = {};
    const locIds = [1, 2, 3, 4];
    locIds.forEach((lid, i) => {
      if (i === locIds.length - 1) stocks[lid] = Math.max(0, remaining);
      else { const share = Math.floor(remaining * (0.2 + rand() * 0.5)); stocks[lid] = share; remaining -= share; }
    });
    return { variantId: b.vid, productId: b.pid, productTitle: b.title, variantName: b.vname, sku: b.sku, inventoryItemId: b.iid, locationStocks: stocks };
  });
}

export default function MultiLocationInventoryPanel({ isDemo, shopUrl, accessToken, shopName, locations: locationsProp, inventoryByLocation: invProp, fullProducts, variantSales }: MultiLocationInventoryPanelProps) {
  const [locations, setLocations] = useState<LocationItem[]>(() => isDemo ? DEMO_LOCATIONS : (locationsProp || []));
  const [visibleLocIds, setVisibleLocIds] = useState<Set<number>>(new Set(isDemo ? DEMO_LOCATIONS.map((l) => l.id) : []));
  const [variants, setVariants] = useState<VariantInventory[]>(() => isDemo ? generateDemoInventory() : []);
  const [search, setSearch] = useState("");
  const [expandedPid, setExpandedPid] = useState<Set<number>>(new Set());
  const [transferModal, setTransferModal] = useState<{ variant: VariantInventory } | null>(null);
  const [transferFrom, setTransferFrom] = useState<number>(0);
  const [transferTo, setTransferTo] = useState<number>(0);
  const [transferQty, setTransferQty] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* ── Sync props ───────────────────────────────────── */
  useEffect(() => { if (!isDemo && locationsProp?.length) setLocations(locationsProp); }, [isDemo, locationsProp]);
  useEffect(() => { if (!isDemo && fullProducts) buildVariantsFromProps(); }, [isDemo, fullProducts, invProp]);

  const buildVariantsFromProps = () => {
    if (!fullProducts) return;
    const result: VariantInventory[] = [];
    for (const p of fullProducts) {
      for (const v of p.variants) {
        const stocks: Record<number, number> = {};
        (locationsProp || []).forEach((l) => { stocks[l.id] = 0; });
        (invProp || []).filter((i) => i.variantId === v.variantId).forEach((i) => { stocks[i.locationId] = i.available; });
        result.push({ variantId: v.variantId, productId: p.id, productTitle: p.title, variantName: v.name, sku: v.sku, inventoryItemId: v.inventoryItemId, locationStocks: stocks });
      }
    }
    setVariants(result);
  };

  const visibleLocs = useMemo(() => locations.filter((l) => visibleLocIds.has(l.id)), [locations, visibleLocIds]);
  const toggleLoc = (id: number) => setVisibleLocIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = useMemo(() =>
    variants.filter((v) => !search || v.productTitle.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase())),
    [variants, search],
  );

  const grouped = useMemo(() => {
    const map = new Map<number, { title: string; vars: VariantInventory[] }>();
    filtered.forEach((v) => {
      if (!map.has(v.productId)) map.set(v.productId, { title: v.productTitle, vars: [] });
      map.get(v.productId)!.vars.push(v);
    });
    return map;
  }, [filtered]);

  const toggleExpand = (pid: number) => setExpandedPid((p) => { const n = new Set(p); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  const executeTransfer = () => {
    if (!transferModal || transferFrom === transferTo || transferQty <= 0) return;
    const fromStock = transferModal.variant.locationStocks[transferFrom] || 0;
    if (transferQty > fromStock) { showToast("调拨数量不能超过来源仓库库存"); return; }
    setVariants((prev) => prev.map((v) => v.variantId === transferModal.variant.variantId ? {
      ...v, locationStocks: { ...v.locationStocks, [transferFrom]: fromStock - transferQty, [transferTo]: (v.locationStocks[transferTo] || 0) + transferQty },
    } : v));
    setTransferModal(null);
    const fromName = locations.find((l) => l.id === transferFrom)?.name;
    const toName = locations.find((l) => l.id === transferTo)?.name;
    showToast(`从「${fromName}」调拨 ${transferQty} 件到「${toName}」`);
  };

  const openTransfer = (v: VariantInventory) => { setTransferModal({ variant: v }); setTransferFrom(Number(Object.keys(v.locationStocks)[0]) || 0); setTransferTo(0); setTransferQty(0); };

  // Single-variant distribution analysis (for color bars)
  const totalPerLoc = useMemo(() => {
    const map: Record<number, number> = {};
    locations.forEach((l) => { map[l.id] = 0; });
    variants.forEach((v) => { Object.entries(v.locationStocks).forEach(([lid, qty]) => { map[Number(lid)] = (map[Number(lid)] || 0) + qty; }); });
    return map;
  }, [variants, locations]);

  const totalAll = Object.values(totalPerLoc).reduce((a, b) => a + b, 0);

  const exportCSV = () => {
    const header = ["商品","SKU", ...visibleLocs.map((l) => l.name), "总库存"];
    const rows = filtered.map((v) => [v.productTitle + (v.variantName ? " - " + v.variantName : ""), v.sku, ...visibleLocs.map((l) => v.locationStocks[l.id] || 0), Object.values(v.locationStocks).reduce((a, b) => a + b, 0)]);
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map((c) => '"' + String(c).replace(/"/g,'""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_库存报告.csv`; a.click();
    showToast("库存报告已导出");
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Warehouse className="h-6 w-6 text-orange-400" />多仓库存管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {locations.length} 个仓库{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* Distribution Analysis */}
      <button onClick={() => setShowAnalysis(!showAnalysis)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <BarChart3 className="h-3 w-3"/>{showAnalysis ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}库存分布分析
      </button>
      {showAnalysis && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 h-6 rounded overflow-hidden bg-muted/20">
            {locations.map((l) => {
              const pct = totalAll > 0 ? ((totalPerLoc[l.id] || 0) / totalAll) * 100 : 0;
              const colors = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#8b5cf6"];
              const ci = locations.indexOf(l) % colors.length;
              return pct > 0 ? <div key={l.id} className="h-full transition-all flex items-center justify-center text-[8px] text-white font-medium" style={{width:`${pct}%`,backgroundColor:colors[ci]}} title={`${l.name}: ${pct.toFixed(1)}%`}>{pct > 8 ? pct.toFixed(0) + "%" : ""}</div> : null;
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {locations.map((l) => { const pct = totalAll > 0 ? ((totalPerLoc[l.id] || 0) / totalAll) * 100 : 0; return <span key={l.id}>{l.name}: <span className="text-foreground tabular-nums">{totalPerLoc[l.id] || 0}</span> ({pct.toFixed(1)}%)</span>; })}
          </div>
          {locations.some((l) => !totalPerLoc[l.id]) && <p className="text-[10px] text-red-400">⚠ 以下仓库库存为 0：{locations.filter((l) => !totalPerLoc[l.id]).map((l) => l.name).join(", ")}</p>}
          {Object.values(totalPerLoc).some((v) => totalAll > 0 && v / totalAll > 0.8) && <p className="text-[10px] text-amber-400">⚠ 库存集中度过高，建议分散以降低风险</p>}
        </CardContent></Card>
      )}

      {/* Location Selector + Search */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">仓库:</span>
          {locations.map((l) => <label key={l.id} className="flex items-center gap-0.5 text-[10px] cursor-pointer"><input type="checkbox" checked={visibleLocIds.has(l.id)} onChange={() => toggleLoc(l.id)} className="accent-orange-500"/>{l.name}</label>)}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setVisibleLocIds(new Set(locations.map((l) => l.id)))} className="h-6 text-[9px]">全选</Button>
        <Button size="sm" variant="ghost" onClick={() => setVisibleLocIds(new Set(locations.filter((l) => l.type === "overseas").map((l) => l.id)))} className="h-6 text-[9px]">仅海外仓</Button>
        <Button size="sm" variant="ghost" onClick={() => setVisibleLocIds(new Set(locations.filter((l) => l.type === "domestic").map((l) => l.id)))} className="h-6 text-[9px]">仅本地仓</Button>
        <div className="relative flex-1 min-w-[120px] ml-2"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..." className="h-7 pl-7 text-[10px]"/></div>
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 gap-1 text-[10px]"><Download className="h-3 w-3"/>导出</Button>
      </CardContent></Card>

      {/* Matrix Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-xs min-w-[600px]">
            <thead><tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pl-3 text-left sticky left-0 bg-card/90 backdrop-blur z-10">商品/SKU</th>
              {visibleLocs.map((l) => <th key={l.id} className="py-2 px-2 text-right min-w-[80px]">{l.name}</th>)}
              <th className="py-2 px-2 text-right min-w-[60px]">总库存</th>
              <th className="py-2 px-2 text-center w-12">操作</th>
            </tr></thead>
            <tbody>
              {[...grouped.entries()].map(([pid, group]) => {
                const isExpanded = expandedPid.has(pid);
                const showVariants = isExpanded && group.vars.length > 1;
                const firstVar = group.vars[0];
                const totalInv = group.vars.reduce((s, v) => s + Object.values(v.locationStocks).reduce((a, b) => a + b, 0), 0);
                return (
                  <tr key={pid} className="border-b border-border/10 hover:bg-muted/5">
                    <td className="py-2 pl-3 sticky left-0 bg-card/60">
                      <div className="flex items-center gap-1">
                        {group.vars.length > 1 && <button onClick={() => toggleExpand(pid)}>{isExpanded ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}</button>}
                        <div><p className="text-foreground truncate max-w-[160px]">{group.title}</p><p className="text-[8px] text-muted-foreground">{firstVar.sku}</p></div>
                      </div>
                    </td>
                    {visibleLocs.map((l) => {
                      const qty = firstVar.locationStocks[l.id] || 0;
                      const cls = qty === 0 ? "bg-red-500/10 text-red-400" : qty < 5 ? "bg-red-500/5 text-red-400" : qty < 10 ? "bg-amber-500/5 text-amber-400" : "";
                      return <td key={l.id} className={`py-2 px-2 text-right tabular-nums font-mono ${cls}`}>{qty}</td>;
                    })}
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{totalInv}</td>
                    <td className="py-2 px-2 text-center"><Button size="sm" variant="ghost" onClick={() => openTransfer(firstVar)} className="h-6 text-[10px] text-orange-400"><ArrowRightLeft className="h-3 w-3"/></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      {transferModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setTransferModal(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-card border border-border/40 rounded-xl shadow-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-orange-400"/>跨仓调拨</h3>
              <p className="text-xs text-muted-foreground">{transferModal.variant.productTitle} · {transferModal.variant.sku}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-muted-foreground block mb-0.5">来源仓库</label>
                  <select value={transferFrom} onChange={(e) => setTransferFrom(Number(e.target.value))} className="h-9 w-full rounded border border-border/40 bg-background px-2 text-sm text-foreground">
                    {locations.filter((l) => visibleLocIds.has(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name} (库存: {transferModal.variant.locationStocks[l.id] || 0})</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] text-muted-foreground block mb-0.5">目标仓库</label>
                  <select value={transferTo} onChange={(e) => setTransferTo(Number(e.target.value))} className="h-9 w-full rounded border border-border/40 bg-background px-2 text-sm text-foreground">
                    <option value={0}>选择目标...</option>
                    {locations.filter((l) => l.id !== transferFrom).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="text-[10px] text-muted-foreground block mb-0.5">调拨数量 (最大: {transferModal.variant.locationStocks[transferFrom] || 0})</label>
                <Input type="number" value={transferQty || ""} onChange={(e) => setTransferQty(Number(e.target.value) || 0)} max={transferModal.variant.locationStocks[transferFrom] || 0} className="h-9 text-sm"/>
              </div>
              {transferQty > 0 && transferTo > 0 && (
                <div className="text-[10px] text-muted-foreground bg-muted/10 rounded p-2">
                  预览：从「{locations.find((l) => l.id === transferFrom)?.name}」调拨 {transferQty} 件到「{locations.find((l) => l.id === transferTo)?.name}」，当前 {(transferModal.variant.locationStocks[transferFrom] || 0)}→{Math.max(0, (transferModal.variant.locationStocks[transferFrom] || 0) - transferQty)}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={executeTransfer} disabled={transferQty <= 0 || transferTo === 0} className="flex-1 h-9 text-xs bg-orange-600 hover:bg-orange-500 text-white"><Save className="h-3 w-3 mr-1"/>确认调拨</Button>
                <Button variant="outline" onClick={() => setTransferModal(null)} className="h-9 text-xs">取消</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
