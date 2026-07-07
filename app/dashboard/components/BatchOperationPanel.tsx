"use client";

import { useState, useMemo, useRef } from "react";
import { Search, Plus, X, Save, Play, Pause, Download, History, CheckCircle2, AlertCircle, Square, Layers, DollarSign, TrendingUp, TrendingDown, Tag, Archive, Package, ChevronDown, Lock, Unlock, Settings, Bookmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";
import { addOperationLog, type OperationLog } from "@/lib/operation-logger";
import { useToast } from "../hooks/useToast";
import ToastBar from "./ToastBar";

/* ─── Types ──────────────────────────────────────────── */

interface VariantItem { variantId: number; name: string; sku: string; price: number; inventory: number; costItem?: number; productId?: string; inventoryItemId?: string; }

interface ProductItem { id: number; title: string; status: string; image: string | null; vendor: string; productType: string; tags: string[]; variants: VariantItem[]; }

interface BatchOperationPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  fullProducts?: ProductItem[];
  stores?: Array<{ shopUrl: string; accessToken?: string }>;
}

type OpTab = "price" | "inventory" | "status" | "tags" | "archive";

interface HistoryEntry { time: string; tab: string; count: number; success: number; failed: number; }

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_PRODUCTS: ProductItem[] = [
  { id: 1, title: "碳纤维手表 Chrono X", status: "ACTIVE", image: null, vendor: "TechGear Inc", productType: "可穿戴设备", tags: ["新品","热销"], variants: [{variantId: 101, name:"黑色/42mm", sku:"TG-CX-BLK", price: 299.99, inventory: 45, costItem: 120},{variantId: 102, name:"银色/46mm", sku:"TG-CX-SLV", price: 349.99, inventory: 18, costItem: 140}] },
  { id: 2, title: "无线降噪耳机 SonicFlow", status: "ACTIVE", image: null, vendor: "TechGear Inc", productType: "音频设备", tags: ["爆款"], variants: [{variantId: 201, name:"默认", sku:"TG-SF", price: 149.99, inventory: 120, costItem: 55}] },
  { id: 3, title: "AR 护目镜 Air", status: "ACTIVE", image: null, vendor: "TechGear Inc", productType: "可穿戴设备", tags: [], variants: [{variantId: 301, name:"默认", sku:"TG-ARG", price: 89.99, inventory: 60, costItem: 30}] },
  { id: 4, title: "机械键盘 K8", status: "DRAFT", image: null, vendor: "TechGear Inc", productType: "电脑外设", tags: ["新品"], variants: [{variantId: 401, name:"青轴", sku:"TG-K8-BLU", price: 129.99, inventory: 25, costItem: 50},{variantId: 402, name:"红轴", sku:"TG-K8-RED", price: 119.99, inventory: 30, costItem: 48}] },
  { id: 5, title: "北欧台灯 LUX", status: "ACTIVE", image: null, vendor: "MinimalHome", productType: "家居照明", tags: ["极简"], variants: [{variantId: 501, name:"默认", sku:"MH-LUX", price: 79.99, inventory: 40, costItem: 28}] },
  { id: 6, title: "亚麻抱枕套", status: "ACTIVE", image: null, vendor: "MinimalHome", productType: "家居纺织品", tags: ["手工"], variants: [{variantId: 601, name:"米白", sku:"MH-LIN-CRM", price: 39.99, inventory: 80, costItem: 12},{variantId: 602, name:"浅灰", sku:"MH-LIN-GRY", price: 44.99, inventory: 60, costItem: 13}] },
];

/* ─── Price Strategy Templates ─────────────────────────── */

interface PriceTemplate {
  id: string; name: string; description: string;
  priceMode: string; priceVal: string; priceRounding: string;
  createdAt: string;
}

const PRESET_TEMPLATES: PriceTemplate[] = [
  { id: "preset-1", name: "清仓甩卖 5 折", description: "全部商品半价清仓", priceMode: "pctDown", priceVal: "50", priceRounding: ".00", createdAt: "" },
  { id: "preset-2", name: "新品上架 ×3 倍", description: "成本加价 3 倍定价", priceMode: "costMarkup", priceVal: "300", priceRounding: ".00", createdAt: "" },
  { id: "preset-3", name: "大促预热减 10%", description: "预热 10% off", priceMode: "pctDown", priceVal: "10", priceRounding: ".95", createdAt: "" },
  { id: "preset-4", name: "会员日加价 5%", description: "会员溢价 5%", priceMode: "pctUp", priceVal: "5", priceRounding: ".99", createdAt: "" },
  { id: "preset-5", name: "尾数改 .99", description: "仅改尾数为 .99", priceMode: "fixed", priceVal: "0", priceRounding: ".99", createdAt: "" },
  { id: "preset-6", name: "全场涨价 3%", description: "全线涨价", priceMode: "pctUp", priceVal: "3", priceRounding: ".00", createdAt: "" },
  { id: "preset-7", name: "亏损清仓 7 折", description: "30% off 清仓", priceMode: "pctDown", priceVal: "30", priceRounding: ".00", createdAt: "" },
  { id: "preset-8", name: "恢复原价", description: "恢复 compareAtPrice", priceMode: "fixed", priceVal: "0", priceRounding: "none", createdAt: "" },
];

function loadTemplates(): PriceTemplate[] { try { return JSON.parse(localStorage.getItem("price_strategy_templates") || "[]"); } catch { return []; } }
function saveTemplates(t: PriceTemplate[]) { localStorage.setItem("price_strategy_templates", JSON.stringify(t)); }
function loadRecent(): string[] { try { return JSON.parse(localStorage.getItem("price_strategy_recent") || "[]"); } catch { return []; } }
function saveRecent(ids: string[]) { localStorage.setItem("price_strategy_recent", JSON.stringify(ids.slice(0, 3))); }

/* ─── Helpers ────────────────────────────────────────── */

function loadHistory(): HistoryEntry[] { try { return JSON.parse(localStorage.getItem("batch_op_history") || "[]"); } catch { return []; } }
function saveHistory(entry: HistoryEntry) { const h = loadHistory(); h.unshift(entry); if (h.length > 30) h.pop(); localStorage.setItem("batch_op_history", JSON.stringify(h)); }

function roundPrice(v: number, rounding: string): number {
  const r = Math.round(v * 100) / 100;
  if (rounding === ".99") return Math.floor(r) + 0.99;
  if (rounding === ".00") return Math.round(r);
  if (rounding === ".95") return Math.floor(r) + 0.95;
  return r;
}

/* ─── Main Component ─────────────────────────────────── */

export default function BatchOperationPanel({ isDemo, shopUrl, accessToken, shopName, fullProducts, stores }: BatchOperationPanelProps) {
  const products = useMemo(() => isDemo ? DEMO_PRODUCTS : (fullProducts || []), [isDemo, fullProducts]);

  /* ── Selection ────────────────────────────────────── */
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => setSelectedIds(new Set(filtered.map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());
  const selectActive = () => setSelectedIds(new Set(filtered.filter((p) => p.status === "ACTIVE").map((p) => p.id)));
  const selectLowStock = () => setSelectedIds(new Set(filtered.filter((p) => p.variants.some((v) => v.inventory < 10)).map((p) => p.id)));

  const filtered = useMemo(() => products.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && p.productType !== filterType) return false;
    if (filterVendor !== "all" && p.vendor !== filterVendor) return false;
    if (filterStatus !== "all") { if (filterStatus === "active" && p.status !== "ACTIVE") return false; if (filterStatus === "draft" && p.status !== "DRAFT") return false; }
    return true;
  }), [products, search, filterType, filterVendor, filterStatus]);

  const selected = products.filter((p) => selectedIds.has(p.id));
  const types = useMemo(() => [...new Set(products.map((p) => p.productType).filter(Boolean))], [products]);
  const vendors = useMemo(() => [...new Set(products.map((p) => p.vendor).filter(Boolean))], [products]);

  /* ── Op Tab ───────────────────────────────────────── */

  const [opTab, setOpTab] = useState<OpTab>("price");

  // Price
  const [priceMode, setPriceMode] = useState("fixed");
  const [priceVal, setPriceVal] = useState("");
  const [priceRounding, setPriceRounding] = useState("none");
  const [pricePerVariant, setPricePerVariant] = useState(false);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateLocked, setTemplateLocked] = useState(false);
  const [templates, setTemplates] = useState<PriceTemplate[]>(() => loadTemplates());
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>(() => loadRecent());
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateManageOpen, setTemplateManageOpen] = useState(false);

  const allTemplates = useMemo(() => [...PRESET_TEMPLATES, ...templates], [templates]);
  const recentTemplates = useMemo(() => allTemplates.filter((t) => recentTemplateIds.includes(t.id)), [allTemplates, recentTemplateIds]);

  const applyTemplate = (tpl: PriceTemplate) => {
    setPriceMode(tpl.priceMode);
    setPriceVal(tpl.priceVal);
    setPriceRounding(tpl.priceRounding);
    setSelectedTemplateId(tpl.id);
    setTemplateLocked(true);
    setRecentTemplateIds((prev) => { const ids = [tpl.id, ...prev.filter((x) => x !== tpl.id)]; saveRecent(ids); return ids; });
  };

  const saveAsTemplate = (name: string, desc: string) => {
    if (templates.length >= 20) { showToast("最多保存 20 个自定义模板，请先删除旧模板"); return; }
    const newTpl: PriceTemplate = { id: "custom-" + Date.now(), name, description: desc, priceMode, priceVal, priceRounding, createdAt: new Date().toISOString() };
    const updated = [...templates, newTpl];
    setTemplates(updated);
    saveTemplates(updated);
    setSelectedTemplateId(newTpl.id);
    setTemplateSaveOpen(false);
    showToast("模板已保存");
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    if (selectedTemplateId === id) { setSelectedTemplateId(""); setTemplateLocked(false); }
    showToast("模板已删除");
  };

  // Inventory
  const [invMode, setInvMode] = useState("set");
  const [invVal, setInvVal] = useState("");

  // Status
  const [targetStatus, setTargetStatus] = useState("ACTIVE");

  // Tags
  const [tagOp, setTagOp] = useState<"add" | "remove" | "replace">("add");
  const [tagInput, setTagInput] = useState("");

  /* ── Preview ──────────────────────────────────────── */
  const [previewOpen, setPreviewOpen] = useState(false);

  const pricePreviews = useMemo(() => {
    if (opTab !== "price" || !priceVal) return [];
    const val = parseFloat(priceVal); if (isNaN(val)) return [];
    return selected.flatMap((p) => p.variants.map((v) => {
      let newP = v.price;
      const cost = v.costItem ?? 0;
      if (priceMode === "fixed") newP = v.price + val;
      else if (priceMode === "pctUp") newP = v.price * (1 + val / 100);
      else if (priceMode === "pctDown") newP = v.price * (1 - val / 100);
      else if (priceMode === "flat") newP = val;
      else if (priceMode === "costMarkup") newP = cost * (1 + val / 100);
      newP = roundPrice(Math.max(0.01, newP), priceRounding);
      return { title: p.title + " - " + v.name, old: v.price, new: newP, change: newP - v.price };
    })).slice(0, 10);
  }, [selected, opTab, priceMode, priceVal, priceRounding]);

  const invPreviews = useMemo(() => {
    if (opTab !== "inventory" || !invVal) return [];
    const val = parseInt(invVal); if (isNaN(val)) return [];
    return selected.flatMap((p) => p.variants.map((v) => {
      let newInv = v.inventory;
      if (invMode === "set") newInv = val;
      else if (invMode === "add") newInv = v.inventory + val;
      else if (invMode === "subtract") newInv = v.inventory - val;
      return { title: p.title + " - " + v.name, sku: v.sku, old: v.inventory, new: newInv };
    })).slice(0, 10);
  }, [selected, opTab, invMode, invVal]);

  /* ── Execution ───────────────────────────────────── */

  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "", ok: 0, fail: 0 });
  const [errors, setErrors] = useState<Array<{ title: string; reason: string }>>([]);
  const { toast, showToast } = useToast(3000);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const abortRef = useRef(false);

  const totalOps = useMemo(() => {
    if (opTab === "price" || opTab === "inventory") return selected.reduce((s, p) => s + p.variants.length, 0);
    return selected.length;
  }, [selected, opTab]);

  const execute = async () => {
    if (selected.length === 0) return;
    setExecuting(true); setErrors([]); abortRef.current = false;
    setProgress({ done: 0, total: totalOps, current: "", ok: 0, fail: 0 });
    let ok = 0, fail = 0;
    const errs: Array<{ title: string; reason: string }> = [];

    let ops: Array<{ title: string; action: () => Promise<boolean> }> = [];

    if (opTab === "price") {
      const val = parseFloat(priceVal); if (isNaN(val)) return;
      selected.forEach((p) => p.variants.forEach((v) => {
        let newP = v.price; const cost = v.costItem ?? 0;
        if (priceMode === "fixed") newP = v.price + val;
        else if (priceMode === "pctUp") newP = v.price * (1 + val / 100);
        else if (priceMode === "pctDown") newP = v.price * (1 - val / 100);
        else if (priceMode === "flat") newP = val;
        else if (priceMode === "costMarkup") newP = cost * (1 + val / 100);
        newP = roundPrice(Math.max(0.01, newP), priceRounding);
        ops.push({ title: p.title + " - " + v.name, action: async () => {
          if (isDemo) { await new Promise((r) => setTimeout(r, 200)); return true; }
          const res = await fetch("/api/shopify/dashboard", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"updateProductVariant", shopUrl, accessToken, variantId: v.variantId, productId: v.productId || "", inventoryItemId: v.inventoryItemId || "", newPrice: newP }) });
          return (await res.json()).success;
        }});
      }));
    } else if (opTab === "inventory") {
      const val = parseInt(invVal); if (isNaN(val)) return;
      selected.forEach((p) => p.variants.forEach((v) => {
        let newInv = v.inventory;
        if (invMode === "set") newInv = val;
        else if (invMode === "add") newInv = v.inventory + val;
        else if (invMode === "subtract") newInv = v.inventory - val;
        ops.push({ title: p.title + " - " + v.name, action: async () => {
          if (isDemo) { await new Promise((r) => setTimeout(r, 200)); return true; }
          const res = await fetch("/api/shopify/dashboard", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"updateProductVariant", shopUrl, accessToken, variantId: v.variantId, productId: v.productId || "", inventoryItemId: v.inventoryItemId || "", newInventory: newInv }) });
          return (await res.json()).success;
        }});
      }));
    } else if (opTab === "status") {
      selected.forEach((p) => ops.push({ title: p.title, action: async () => {
        if (isDemo) { await new Promise((r) => setTimeout(r, 200)); return true; }
        const res = await fetch("/api/shopify/dashboard", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"updateProduct", shopUrl, accessToken, productId: p.id, status: targetStatus.toLowerCase() }) });
        return (await res.json()).success;
      }}));
    } else if (opTab === "tags") {
      selected.forEach((p) => {
        const cur = new Set(p.tags);
        const inputs = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        if (tagOp === "add") inputs.forEach((t) => cur.add(t));
        else if (tagOp === "remove") inputs.forEach((t) => cur.delete(t));
        else if (tagOp === "replace") { cur.clear(); inputs.forEach((t) => cur.add(t)); }
        ops.push({ title: p.title, action: async () => {
          if (isDemo) { await new Promise((r) => setTimeout(r, 200)); return true; }
          const res = await fetch("/api/shopify/dashboard", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"updateProduct", shopUrl, accessToken, productId: p.id, tags: [...cur] }) });
          return (await res.json()).success;
        }});
      });
    }

    for (const op of ops) {
      if (abortRef.current) break;
      setProgress((p) => ({ ...p, current: op.title, done: p.done }));
      try { if (await op.action()) ok++; else { fail++; errs.push({ title: op.title, reason: "API 返回失败" }); } }
      catch { fail++; errs.push({ title: op.title, reason: "网络错误" }); }
      setProgress((p) => ({ ...p, done: p.done + 1, ok, fail }));
      if (!isDemo) await new Promise((r) => setTimeout(r, 500));
    }

    // Record operation log for history/rollback
    if (ok > 0) {
      const opTypeMap: Record<OpTab, string> = { price: "batch_price", inventory: "batch_inventory", tags: "batch_tags", status: "batch_status", archive: "batch_status" };
      const summaryMap: Record<OpTab, string> = { price: `将 ${ok} 件商品调整价格`, inventory: `将 ${ok} 件商品调整库存`, tags: `为 ${ok} 件商品修改标签`, status: `将 ${ok} 件商品修改状态`, archive: `将 ${ok} 件商品归档` };
      addOperationLog({
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), actionType: opTypeMap[opTab] as OperationLog["actionType"],
        summary: summaryMap[opTab] + (fail > 0 ? `，失败 ${fail} 件` : ""),
        details: selected.slice(0, 50).flatMap((p) => p.variants.map((v) => ({
          targetType: "variant" as const, targetId: v.variantId, targetName: p.title + " - " + v.name,
          field: opTab === "price" ? "price" as const : opTab === "inventory" ? "inventory" as const : "tags" as const,
          oldValue: opTab === "price" ? v.price : opTab === "inventory" ? v.inventory : p.tags,
          newValue: opTab === "price" ? v.price : opTab === "inventory" ? v.inventory : p.tags,
          shopUrl, rolledBack: false,
        }))),
        status: fail > 0 ? "failed" : "completed", totalItems: selected.length, successCount: ok, failCount: fail,
      });
    }

    setErrors(errs);
    saveHistory({ time: new Date().toLocaleString("zh-CN"), tab: opTab, count: selected.length, success: ok, failed: fail });
    setHistory(loadHistory());
    setExecuting(false);
    showToast(isDemo ? "演示模式：批量操作已本地生效" : `完成：成功 ${ok} 项，失败 ${fail} 项`);
  };

  /* ── All tags for preview ────────────────────────── */
  const allTags = useMemo(() => [...new Set(selected.flatMap((p) => p.tags))].sort(), [selected]);
  const tagPreview = useMemo(() => {
    const inputs = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    return selected.slice(0, 5).map((p) => {
      const cur = new Set(p.tags);
      if (tagOp === "add") inputs.forEach((t) => cur.add(t));
      else if (tagOp === "remove") inputs.forEach((t) => cur.delete(t));
      else if (tagOp === "replace") { cur.clear(); inputs.forEach((t) => cur.add(t)); }
      return { title: p.title, old: p.tags.join(", "), new: [...cur].join(", ") };
    });
  }, [selected, tagOp, tagInput]);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <ToastBar message={toast} />

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Play className="h-6 w-6 text-amber-400" />批量操作引擎</h2>
        <p className="mt-1 text-base text-muted-foreground">{products.length} 件商品 · {selectedIds.size} 已选{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-280px)]">
        {/* ══ LEFT: Product Selector ══ */}
        <Card className="border-border/40 bg-card/60 lg:w-[35%] flex flex-col">
          <CardContent className="p-3 flex flex-col h-full space-y-2">
            <div className="relative"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="搜索..." className="h-7 pl-7 text-sm" /></div>
            <div className="flex gap-1">
              <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} className="h-7 flex-1 rounded border border-border/40 bg-background text-xs text-foreground px-1"><option value="all">全部品类</option>{types.map((t)=><option key={t}>{t}</option>)}</select>
              <select value={filterVendor} onChange={(e)=>setFilterVendor(e.target.value)} className="h-7 flex-1 rounded border border-border/40 bg-background text-xs text-foreground px-1"><option value="all">全部供应商</option>{vendors.map((v)=><option key={v}>{v}</option>)}</select>
              <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="h-7 w-20 rounded border border-border/40 bg-background text-xs text-foreground px-1"><option value="all">全部</option><option value="active">上架</option><option value="draft">下架</option></select>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="ghost" onClick={selectAll} className="h-6 text-[9px] px-2">全选</Button>
              <Button size="sm" variant="ghost" onClick={selectActive} className="h-6 text-[9px] px-2">上架中</Button>
              <Button size="sm" variant="ghost" onClick={selectLowStock} className="h-6 text-[9px] px-2">库存&lt;10</Button>
              <Button size="sm" variant="ghost" onClick={clearAll} className="h-6 text-[9px] px-2">清空</Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {filtered.map((p) => {
                const minPrice = Math.min(...p.variants.map((v) => v.price));
                const totalInv = p.variants.reduce((s, v) => s + v.inventory, 0);
                return (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/20">
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={()=>toggleSelect(p.id)} className="accent-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-[11px] text-foreground truncate">{p.title}</p></div>
                    <span className="text-xs text-emerald-400 tabular-nums shrink-0">{formatCny(minPrice*EXCHANGE_RATE)}</span>
                    <Badge className={`text-[9px] px-1 py-0 shrink-0 ${totalInv < 10 ? "bg-red-500/15 text-red-400" : "bg-muted/20 text-muted-foreground"}`}>{totalInv}</Badge>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/20">已选 {selectedIds.size} 件 · 筛出 {filtered.length} 件</div>
          </CardContent>
        </Card>

        {/* ══ RIGHT: Operation Area ══ */}
        <Card className="border-border/40 bg-card/60 lg:w-[65%] flex flex-col">
          <CardContent className="p-3 flex flex-col h-full space-y-3">
            {/* Op Tabs */}
            <div className="flex gap-1 flex-wrap">
              {([{k:"price",l:"📊 批量改价"},{k:"inventory",l:"🔄 批量改库存"},{k:"status",l:"🏷 改状态"},{k:"tags",l:"🏷 批量标签"}] as Array<{k:OpTab;l:string}>).map((t)=>(
                <button key={t.k} onClick={()=>setOpTab(t.k)} className={`px-2.5 py-1 rounded text-[11px] font-semibold ${opTab===t.k?"bg-amber-500/15 text-amber-400":"text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {/* Tab: Price */}
              {opTab === "price" && (<>
                {/* Template selector */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    {templateLocked && <Lock className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-400" />}
                    <select value={selectedTemplateId} onChange={(e) => { const tpl = allTemplates.find((t) => t.id === e.target.value); if (tpl) applyTemplate(tpl); else { setSelectedTemplateId(""); setTemplateLocked(false); } }} className="h-9 w-full rounded border border-border/40 bg-background text-sm text-foreground px-2" style={templateLocked?{paddingLeft:28}:{}}>
                      <option value="">自定义（手动输入）</option>
                      {PRESET_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      {templates.length > 0 && (<><optgroup label="自定义模板">{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup></>)}
                    </select>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setTemplateSaveOpen(true)} className="h-9 gap-1 text-xs"><Save className="h-3 w-3"/>另存为</Button>
                  <Button size="sm" variant="outline" onClick={() => setTemplateManageOpen(true)} className="h-9 w-8 p-0"><Settings className="h-3.5 w-3.5"/></Button>
                </div>
                {/* Quick recent templates */}
                {recentTemplates.length > 0 && !templateLocked && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-muted-foreground">最近:</span>
                    {recentTemplates.map((t) => (
                      <button key={t.id} onClick={() => applyTemplate(t)} className="px-2 py-0.5 rounded border border-border/30 text-[9px] text-muted-foreground hover:text-amber-400 hover:border-amber-500/30">{t.name}</button>
                    ))}
                  </div>
                )}
                {/* Lock indicator */}
                {templateLocked && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    <Lock className="h-3 w-3"/>模板已锁定
                    <button onClick={() => { setTemplateLocked(false); setSelectedTemplateId(""); }} className="text-sky-400 hover:underline">解锁手动编辑</button>
                  </div>
                )}
                {/* Price controls */}
                <div className="flex gap-2">
                  <select value={priceMode} onChange={(e)=>setPriceMode(e.target.value)} disabled={templateLocked} className="h-9 rounded border border-border/40 bg-background text-sm text-foreground px-2 disabled:opacity-50">
                    <option value="fixed">固定金额调整</option><option value="pctUp">百分比上调</option><option value="pctDown">百分比下调</option><option value="flat">统一价格</option><option value="costMarkup">成本加成定价</option>
                  </select>
                  <Input type="number" step="0.01" value={priceVal} onChange={(e)=>setPriceVal(e.target.value)} placeholder={priceMode==="costMarkup"?"加成%":"金额"} className="h-9 w-32 text-sm" disabled={templateLocked} />
                  <select value={priceRounding} onChange={(e)=>setPriceRounding(e.target.value)} className="h-9 rounded border border-border/40 bg-background text-xs text-foreground px-1 w-20">
                    <option value="none">不处理</option><option value=".99">.99</option><option value=".00">.00</option><option value=".95">.95</option>
                  </select>
                </div>
                {pricePreviews.length > 0 && (
                  <table className="w-full text-sm"><thead><tr className="border-b border-border/20 text-xs text-muted-foreground"><th className="py-1 text-left">商品</th><th className="py-1 text-right">原价</th><th className="py-1 text-center w-6"></th><th className="py-1 text-right">新价</th><th className="py-1 text-right">变化</th></tr></thead>
                    <tbody>{pricePreviews.map((pv,i)=>(
                      <tr key={i} className="border-b border-border/10"><td className="py-1 text-foreground truncate max-w-[140px]">{pv.title}</td><td className="py-1 text-right tabular-nums">{formatCny(pv.old*EXCHANGE_RATE)}</td><td className="py-1 text-center text-muted-foreground">→</td><td className="py-1 text-right tabular-nums font-semibold" style={{color:pv.change>=0?"#f59e0b":"#10b981"}}>{formatCny(pv.new*EXCHANGE_RATE)}</td><td className="py-1 text-right tabular-nums" style={{color:pv.change>=0?"#f59e0b":"#10b981"}}>{pv.change>=0?"+":""}{pv.change.toFixed(2)}</td></tr>
                    ))}</tbody></table>
                )}
              </>)}

              {/* Tab: Inventory */}
              {opTab === "inventory" && (<>
                <div className="flex gap-2">
                  <select value={invMode} onChange={(e)=>setInvMode(e.target.value)} className="h-9 rounded border border-border/40 bg-background text-sm text-foreground px-2"><option value="set">设为绝对值</option><option value="add">增加库存</option><option value="subtract">减少库存</option></select>
                  <Input type="number" value={invVal} onChange={(e)=>setInvVal(e.target.value)} className="h-9 w-32 text-sm" />
                </div>
                {invPreviews.some((p)=>p.new<0) && <p className="text-xs text-red-400">⚠ 以下商品的库存将被设为负数</p>}
                {invPreviews.length > 0 && (
                  <table className="w-full text-sm"><thead><tr className="border-b border-border/20 text-xs text-muted-foreground"><th className="py-1 text-left">商品</th><th className="py-1 text-left">SKU</th><th className="py-1 text-right">当前</th><th className="py-1 text-center w-6"></th><th className="py-1 text-right">新库存</th></tr></thead>
                    <tbody>{invPreviews.map((pv,i)=>(
                      <tr key={i} className={`border-b border-border/10 ${pv.new<0?"bg-red-500/5 text-red-400":""}`}><td className="py-1 truncate max-w-[120px]">{pv.title}</td><td className="py-1 text-muted-foreground font-mono">{pv.sku}</td><td className="py-1 text-right tabular-nums">{pv.old}</td><td className="py-1 text-center">→</td><td className="py-1 text-right tabular-nums font-semibold">{pv.new}</td></tr>
                    ))}</tbody></table>
                )}
              </>)}

              {/* Tab: Status */}
              {opTab === "status" && (<>
                <div className="flex gap-2">
                  {(["ACTIVE","DRAFT","ARCHIVED"] as const).map((s)=>(
                    <button key={s} onClick={()=>setTargetStatus(s)} className={`px-3 py-1.5 rounded text-sm font-medium ${targetStatus===s?(s==="ARCHIVED"?"bg-red-500/15 text-red-400":s==="ACTIVE"?"bg-emerald-500/15 text-emerald-400":"bg-amber-500/15 text-amber-400"):"text-muted-foreground border border-border/30"}`}>
                      {s==="ACTIVE"?"上架":s==="DRAFT"?"下架":"归档"}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">将对 {selected.length} 件商品执行状态变更</p>
                {selected.length > 0 && (
                  <table className="w-full text-sm"><thead><tr className="border-b border-border/20 text-xs text-muted-foreground"><th className="py-1 text-left">商品</th><th className="py-1 text-center">当前</th><th className="py-1 text-center">→</th><th className="py-1 text-center">新状态</th></tr></thead>
                    <tbody>{selected.slice(0,8).map((p)=>(
                      <tr key={p.id} className="border-b border-border/10"><td className="py-1 truncate max-w-[160px]">{p.title}</td><td className="py-1 text-center"><Badge className={`text-[9px] ${p.status==="ACTIVE"?"bg-emerald-500/15 text-emerald-400":"bg-zinc-500/15 text-zinc-400"}`}>{p.status==="ACTIVE"?"上架":"下架"}</Badge></td><td className="py-1 text-center">→</td><td className="py-1 text-center"><Badge className={`text-[9px] ${targetStatus==="ACTIVE"?"bg-emerald-500/15 text-emerald-400":targetStatus==="DRAFT"?"bg-amber-500/15 text-amber-400":"bg-red-500/15 text-red-400"}`}>{targetStatus==="ACTIVE"?"上架":targetStatus==="DRAFT"?"下架":"归档"}</Badge></td></tr>
                    ))}</tbody></table>
                )}
              </>)}

              {/* Tab: Tags */}
              {opTab === "tags" && (<>
                <div className="flex gap-1">
                  {(["add","remove","replace"] as const).map((o)=>(<button key={o} onClick={()=>setTagOp(o)} className={`px-2 py-1 rounded text-xs ${tagOp===o?"bg-amber-500/15 text-amber-400":"text-muted-foreground border border-border/30"}`}>{o==="add"?"添加":o==="remove"?"移除":"替换"}</button>))}
                </div>
                <Input value={tagInput} onChange={(e)=>setTagInput(e.target.value)} placeholder="标签,逗号分隔" className="h-9 text-sm" />
                {allTags.length > 0 && <div className="flex flex-wrap gap-1">{allTags.map((t)=><Badge key={t} variant="outline" className="text-[9px] px-1 py-0 cursor-pointer hover:bg-muted/20" onClick={()=>setTagInput((prev)=>prev?prev+","+t:t)}>{t}</Badge>)}</div>}
                {tagPreview.length > 0 && (
                  <table className="w-full text-sm"><thead><tr className="border-b border-border/20 text-xs text-muted-foreground"><th className="py-1 text-left">商品</th><th className="py-1 text-left">当前</th><th className="py-1 text-left text-emerald-400">操作后</th></tr></thead>
                    <tbody>{tagPreview.map((pv,i)=>(<tr key={i} className="border-b border-border/10"><td className="py-1 truncate max-w-[120px]">{pv.title}</td><td className="py-1 text-muted-foreground">{pv.old||"-"}</td><td className="py-1 text-emerald-400">{pv.new||"-"}</td></tr>))}</tbody></table>
                )}
              </>)}
            </div>

            {/* Execution Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
              {executing ? (
                <>
                  <div className="flex-1 h-2 rounded bg-muted/20 overflow-hidden"><div className="h-full bg-amber-500 rounded transition-all" style={{width:`${progress.total>0?(progress.done/progress.total)*100:0}%`}}/></div>
                  <span className="text-xs tabular-nums text-amber-400">{progress.done}/{progress.total}</span>
                  <span className="text-xs text-emerald-400">{progress.ok}✓</span>
                  <span className="text-xs text-red-400">{progress.fail}✕</span>
                  <Button size="sm" variant="outline" onClick={()=>{abortRef.current=true}} className="h-7 text-xs text-red-400"><Pause className="h-3 w-3"/></Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={()=>setPreviewOpen(!previewOpen)} disabled={selectedIds.size===0} className="h-9 text-sm">预览</Button>
                  <Button size="sm" onClick={execute} disabled={selectedIds.size===0} className="h-9 gap-1 bg-amber-600 hover:bg-amber-500 text-white text-sm"><Play className="h-3 w-3"/>确认执行</Button>
                  <span className="ml-auto text-xs text-muted-foreground">{totalOps} 项操作</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      {previewOpen && (<>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={()=>setPreviewOpen(false)}/>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[80vh] bg-card border border-border/40 rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 shrink-0"><h3 className="text-base font-semibold">变更预览</h3><Button size="sm" variant="ghost" onClick={()=>setPreviewOpen(false)}><X className="h-4 w-4"/></Button></div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-muted-foreground space-y-1">
              {opTab==="price"&&pricePreviews.map((pv,i)=><div key={i}>{pv.title}: {formatCny(pv.old*EXCHANGE_RATE)} → <span style={{color:pv.change>=0?"#f59e0b":"#10b981"}}>{formatCny(pv.new*EXCHANGE_RATE)}</span></div>)}
              {opTab==="inventory"&&invPreviews.map((pv,i)=><div key={i}>{pv.title}: {pv.old} → <span className={pv.new<0?"text-red-400":""}>{pv.new}</span></div>)}
              {opTab==="status"&&selected.map((p)=><div key={p.id}>{p.title}: {p.status} → {targetStatus}</div>)}
              {opTab==="tags"&&tagPreview.map((pv,i)=><div key={i}>{pv.title}: {pv.old||"(空)"} → {pv.new||"(空)"}</div>)}
              {totalOps>10&&<p className="text-xs pt-2">...还有 {totalOps-10} 项</p>}
            </div>
          </div>
        </div>
      </>)}

      {/* Error summary */}
      {errors.length>0&&!executing&&(
        <Card className="border-red-500/30 bg-red-500/10"><CardContent className="py-3 px-4"><p className="text-base font-semibold text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4"/>失败 {errors.length} 项</p><div className="mt-2 max-h-32 overflow-y-auto space-y-1">{errors.map((e,i)=><div key={i} className="flex justify-between text-sm"><span className="text-red-300">{e.title}</span><span className="text-red-400/70">{e.reason}</span></div>)}</div></CardContent></Card>
      )}

      {/* Save Template Modal */}
      <TemplateSaveModal open={templateSaveOpen} onClose={()=>setTemplateSaveOpen(false)} onSave={saveAsTemplate}/>

      {/* Template Manage Modal */}
      {templateManageOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={()=>setTemplateManageOpen(false)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md max-h-[70vh] bg-card border border-border/40 rounded-xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 shrink-0"><h3 className="text-base font-semibold">模板管理</h3><Button size="sm" variant="ghost" onClick={()=>setTemplateManageOpen(false)}><X className="h-4 w-4"/></Button></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">预设模板</p>
                {PRESET_TEMPLATES.map((t)=>(
                  <div key={t.id} className="flex items-center gap-2 py-1 border-b border-border/10">
                    <div className="flex-1"><p className="text-sm text-foreground">{t.name}</p><p className="text-[9px] text-muted-foreground">{t.description}</p></div>
                    <Button size="sm" variant="ghost" onClick={() => { applyTemplate(t); setTemplateManageOpen(false); }} className="h-7 text-xs text-emerald-400">使用</Button>
                  </div>
                ))}
                <p className="text-xs font-semibold text-muted-foreground pt-2">自定义模板 ({templates.length}/20)</p>
                {templates.length > 0 ? templates.map((t)=>(
                  <div key={t.id} className="flex items-center gap-2 py-1 border-b border-border/10">
                    <div className="flex-1"><p className="text-sm text-foreground">{t.name}</p><p className="text-[9px] text-muted-foreground">{t.description || "无描述"}</p></div>
                    <Button size="sm" variant="ghost" onClick={() => { applyTemplate(t); setTemplateManageOpen(false); }} className="h-7 text-xs text-emerald-400">使用</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("确定删除模板\""+t.name+"\"？")) deleteTemplate(t.id); }} className="h-7 text-xs text-red-400"><X className="h-3 w-3"/></Button>
                  </div>
                )) : <p className="text-xs text-muted-foreground py-2">暂无自定义模板</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Template Save Modal ────────────────────────────── */

function TemplateSaveModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border/40 rounded-xl shadow-2xl p-5 space-y-3">
          <h3 className="text-base font-semibold">另存为模板</h3>
          <div><label className="text-sm text-muted-foreground block mb-0.5">模板名称 *</label><Input value={name} onChange={(e)=>setName(e.target.value)} autoFocus className="h-9 text-sm"/></div>
          <div><label className="text-sm text-muted-foreground block mb-0.5">描述</label><textarea value={desc} onChange={(e)=>setDesc(e.target.value)} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none"/></div>
          <div className="flex gap-2"><Button onClick={()=>onSave(name,desc)} disabled={!name.trim()} className="flex-1 h-9 bg-emerald-600 text-white text-sm"><Save className="h-3 w-3 mr-1"/>保存</Button><Button variant="outline" onClick={onClose} className="h-9 text-sm">取消</Button></div>
        </div>
      </div>
    </>
  );
}
