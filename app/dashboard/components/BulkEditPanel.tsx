"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Layers, Search, CheckSquare, Square, Filter, X, ArrowRight, Save,
  AlertCircle, CheckCircle2, Loader2, Tag, FileText, Globe,
  LayoutList, ChevronDown, ChevronUp, History, Eye, Zap, Pause,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

/* ─── Types ──────────────────────────────────────────── */

interface ApiVariant { variantId: number; name: string; sku: string; price: string; inventory: number; }
interface ApiProduct { id: number; title: string; status: string; image: string | null; shopName: string; isDemo: boolean; variants: ApiVariant[]; }

interface BulkEditPanelProps {
  products: ApiProduct[];
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
}

type OpType = "prefix" | "suffix" | "replace" | "full" | "addTag" | "removeTag" | "replaceTag";

interface HistoryEntry {
  time: string;
  operation: string;
  count: number;
  success: number;
  failed: number;
}

/* ─── Helpers ────────────────────────────────────────── */

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("bulk_edit_history") || "[]"); } catch { return []; }
}
function saveHistory(entry: HistoryEntry) {
  const h = loadHistory();
  h.unshift(entry);
  if (h.length > 20) h.pop();
  localStorage.setItem("bulk_edit_history", JSON.stringify(h));
}

/* ─── Main Component ─────────────────────────────────── */

export default function BulkEditPanel({ products, isDemo, shopUrl, accessToken }: BulkEditPanelProps) {
  /* ── Product Selection ───────────────────────────── */
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  /* ── filtered product list ───────────────────────── */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && (p as any).productType !== filterType && (p as any).vendor !== filterType) return false;
      if (filterVendor !== "all" && (p as any).vendor !== filterVendor) return false;
      if (filterStatus !== "all") {
        const s = p.status.toLowerCase();
        if (filterStatus === "active" && s !== "active") return false;
        if (filterStatus === "draft" && s !== "draft") return false;
      }
      return true;
    });
  }, [products, search, filterType, filterVendor, filterStatus]);

  const toggleSelect = (id: number) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => setSelectedIds(new Set(filtered.map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());
  const selected = products.filter((p) => selectedIds.has(p.id));

  /* ── Product type / vendor lists ─────────────────── */
  const productTypes = useMemo(() => [...new Set(products.map((p) => (p as any).productType).filter(Boolean))] as string[], [products]);
  const vendors = useMemo(() => [...new Set(products.map((p) => (p as any).vendor).filter(Boolean))] as string[], [products]);

  /* ── Operation Tab State ─────────────────────────── */
  const [opTab, setOpTab] = useState<"title" | "desc" | "seo" | "tags">("title");
  const [titleOp, setTitleOp] = useState<OpType>("prefix");
  const [titleVal1, setTitleVal1] = useState("");
  const [titleVal2, setTitleVal2] = useState("");
  const [descFind, setDescFind] = useState("");
  const [descReplace, setDescReplace] = useState("");
  const [descRegex, setDescRegex] = useState(false);
  const [seoTitleTpl, setSeoTitleTpl] = useState("{title}");
  const [seoDescTpl, setSeoDescTpl] = useState("");
  const [tagOp, setTagOp] = useState<"add" | "remove" | "replace">("add");
  const [tagInput, setTagInput] = useState("");

  /* ── Execution State ─────────────────────────────── */
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [errors, setErrors] = useState<Array<{ title: string; reason: string }>>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(false);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* ── Preview computation ──────────────────────────── */
  const preview = useMemo(() => {
    if (selected.length === 0) return [];
    return selected.slice(0, 5).map((p) => {
      const price = p.variants?.[0] ? parseFloat(p.variants[0].price) : 0;
      const priceStr = formatCny(price * EXCHANGE_RATE);
      let orig = "", newVal = "";
      if (opTab === "title") {
        orig = p.title;
        if (titleOp === "prefix") newVal = titleVal1 + orig;
        else if (titleOp === "suffix") newVal = orig + titleVal1;
        else if (titleOp === "replace") newVal = orig.replace(new RegExp(titleVal1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), titleVal2);
        else if (titleOp === "full" && titleVal1) newVal = titleVal1;
      } else if (opTab === "desc") {
        orig = ((p as any).bodyHtml || "").slice(0, 80) + " ...";
        newVal = "预览不可用于描述字段批量替换";
      } else if (opTab === "seo") {
        orig = (p as any).seoTitle || p.title;
        newVal = seoTitleTpl.replace("{title}", p.title).replace("{price}", priceStr).replace("{type}", (p as any).productType || "");
      } else if (opTab === "tags") {
        orig = ((p as any).tags || []).join(", ");
        const cur = new Set<string>(((p as any).tags || []));
        const inputs = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        if (tagOp === "add") inputs.forEach((t) => cur.add(t));
        else if (tagOp === "remove") inputs.forEach((t) => cur.delete(t));
        else if (tagOp === "replace") { cur.clear(); inputs.forEach((t) => cur.add(t)); }
        newVal = [...cur].join(", ");
      }
      return { id: p.id, title: p.title, orig, newVal, field: opTab === "title" ? "标题" : opTab === "desc" ? "描述" : opTab === "seo" ? "SEO标题" : "标签" };
    });
  }, [selected, opTab, titleOp, titleVal1, titleVal2, descFind, descReplace, seoTitleTpl, tagOp, tagInput]);

  /* ── Insert variable into SEO template ───────────── */
  const insertVar = (v: string, setter: (s: string) => void, current: string) => setter(current + v);

  /* ── Execute ──────────────────────────────────────── */
  const execute = useCallback(async () => {
    if (selected.length === 0) return;
    setExecuting(true); abortRef.current = false;
    setErrors([]); setProgress({ done: 0, total: selected.length, current: "" });

    let done = 0, errs: Array<{ title: string; reason: string }> = [];

    for (const p of selected) {
      if (abortRef.current) break;
      setProgress({ done, total: selected.length, current: p.title });

      if (isDemo) {
        await new Promise((r) => setTimeout(r, 200));
      } else {
        try {
          const body: Record<string, unknown> = { action: "updateProduct", shopUrl, accessToken, productId: p.id };
          if (opTab === "title") {
            let newTitle = p.title;
            if (titleOp === "prefix") newTitle = titleVal1 + newTitle;
            else if (titleOp === "suffix") newTitle = newTitle + titleVal1;
            else if (titleOp === "replace" && titleVal1) newTitle = newTitle.replace(new RegExp(titleVal1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), titleVal2);
            else if (titleOp === "full") newTitle = titleVal1;
            if (newTitle && newTitle !== p.title) body.title = newTitle;
          }
          if (opTab === "tags") {
            const cur = new Set<string>(((p as any).tags || []));
            const inputs = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
            if (tagOp === "add") inputs.forEach((t) => cur.add(t));
            else if (tagOp === "remove") inputs.forEach((t) => cur.delete(t));
            else if (tagOp === "replace") { cur.clear(); inputs.forEach((t) => cur.add(t)); }
            body.tags = [...cur];
          }
          if (opTab === "seo") {
            const price = p.variants?.[0] ? formatCny(parseFloat(p.variants[0].price) * EXCHANGE_RATE) : "";
            body.seoTitle = seoTitleTpl.replace("{title}", p.title).replace("{price}", price).replace("{type}", (p as any).productType || "");
            if (seoDescTpl) body.seoDescription = seoDescTpl.replace("{title}", p.title).replace("{price}", price).replace("{type}", (p as any).productType || "");
          }
          if (opTab === "desc" && descFind && descReplace) {
            body.bodyHtml = ((p as any).bodyHtml || "").replace(new RegExp(descFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), descReplace);
          }
          const res = await fetch("/api/shopify/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          const json = await res.json();
          if (!json.success) { errs.push({ title: p.title, reason: json.error || "未知错误" }); }
        } catch { errs.push({ title: p.title, reason: "网络错误" }); }
        await new Promise((r) => setTimeout(r, 500)); // Rate limit
      }
      done++;
      setProgress({ done, total: selected.length, current: p.title });
    }

    setErrors(errs);
    saveHistory({ time: new Date().toLocaleString("zh-CN"), operation: opTab === "title" ? `标题${titleOp}` : opTab === "desc" ? "描述替换" : opTab === "seo" ? "SEO设置" : `标签${tagOp}`, count: selected.length, success: done - errs.length, failed: errs.length });
    setHistory(loadHistory());
    setExecuting(false);

    if (isDemo) showToast("演示模式：批量编辑已本地生效");
    else {
      const ok = done - errs.length;
      showToast(`完成：成功 ${ok} 件，失败 ${errs.length} 件`);
    }
  }, [selected, isDemo, shopUrl, accessToken, opTab, titleOp, titleVal1, titleVal2, descFind, descReplace, seoTitleTpl, seoDescTpl, tagOp, tagInput]);

  const stopExecution = () => { abortRef.current = true; };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-md">{toast}</div>}

      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Layers className="h-6 w-6 text-sky-400" />批量编辑面板</h2>
        <p className="mt-1 text-sm text-muted-foreground">{products.length} 个商品 · {selectedIds.size} 已选{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: "calc(100vh - 260px)" }}>
        {/* ══ LEFT: Product Selector ══ */}
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg lg:w-[40%] flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-sky-400" />选择商品
            </CardTitle>
            <CardDescription>已选 {selectedIds.size} / {products.length} 件</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 pb-0">
            {/* Filters */}
            <div className="space-y-1.5 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索商品标题..." className="h-8 pl-7 text-xs" />
              </div>
              <div className="flex gap-1">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-7 flex-1 rounded border border-border/40 bg-background px-1 text-[10px] text-foreground">
                  <option value="all">全部品类</option>
                  {productTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="h-7 flex-1 rounded border border-border/40 bg-background px-1 text-[10px] text-foreground">
                  <option value="all">全部供应商</option>
                  {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-7 w-20 rounded border border-border/40 bg-background px-1 text-[10px] text-foreground">
                  <option value="all">全部</option>
                  <option value="active">上架</option>
                  <option value="draft">下架</option>
                </select>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={selectAll} className="h-6 text-[10px] px-2">全选</Button>
                <Button size="sm" variant="ghost" onClick={clearAll} className="h-6 text-[10px] px-2">清空</Button>
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto mt-2 space-y-0.5 pr-1">
              {filtered.map((p) => {
                const price = p.variants?.[0] ? parseFloat(p.variants[0].price) : 0;
                return (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/20 transition-colors">
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-sky-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{p.title}</p>
                    </div>
                    <Badge className={`text-[9px] px-1 py-0 shrink-0 ${p.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>{p.status === "active" ? "上架" : "草稿"}</Badge>
                    <span className="text-[10px] text-emerald-400 tabular-nums shrink-0">{formatCny(price * EXCHANGE_RATE)}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">无匹配商品</div>}
            </div>
          </CardContent>
        </Card>

        {/* ══ RIGHT: Operation Area ══ */}
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg lg:w-[60%] flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base">批量操作</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 pb-0">
            {/* Op Tabs */}
            <div className="flex gap-1 shrink-0 border-b border-border/20 pb-2 mb-3">
              {(["title", "desc", "seo", "tags"] as const).map((t) => (
                <button key={t} onClick={() => setOpTab(t)} className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${opTab === t ? "bg-sky-500/15 text-sky-400 border border-sky-500/30" : "text-muted-foreground hover:text-foreground border border-transparent"}`}>
                  {t === "title" ? "标题模板" : t === "desc" ? "描述处理" : t === "seo" ? "SEO设置" : "批量标签"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Tab: Title */}
              {opTab === "title" && (
                <>
                  <select value={titleOp} onChange={(e) => setTitleOp(e.target.value as OpType)} className="h-8 rounded border border-border/40 bg-background px-2 text-xs text-foreground w-full">
                    <option value="prefix">追加前缀</option>
                    <option value="suffix">追加后缀</option>
                    <option value="replace">查找替换</option>
                    <option value="full">完全替换</option>
                  </select>
                  <div className="flex gap-2">
                    <Input value={titleVal1} onChange={(e) => setTitleVal1(e.target.value)} placeholder={titleOp === "prefix" ? "前缀文本" : titleOp === "suffix" ? "后缀文本" : titleOp === "replace" ? "查找" : "新标题"} className="h-8 text-xs flex-1" />
                    {(titleOp === "replace" || titleOp === "full") && (
                      <Input value={titleVal2} onChange={(e) => setTitleVal2(e.target.value)} placeholder={titleOp === "replace" ? "替换为" : ""} className="h-8 text-xs flex-1" />
                    )}
                  </div>
                  {preview.length > 0 && (
                    <div className="rounded-lg border border-border/20 bg-muted/10 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2">预览 ({Math.min(5, selected.length)} 件)</p>
                      {preview.map((pv) => (
                        <div key={pv.id} className="flex flex-col gap-0.5 py-1 border-b border-border/10 last:border-0">
                          <span className="text-foreground font-medium truncate">{pv.title}</span>
                          <span className="text-muted-foreground/60 line-through">{pv.orig.slice(0, 60)}{pv.orig.length > 60 ? "..." : ""}</span>
                          <span className="text-emerald-400">{pv.newVal.slice(0, 60)}{pv.newVal.length > 60 ? "..." : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Description */}
              {opTab === "desc" && (
                <>
                  <div className="flex gap-2">
                    <Input value={descFind} onChange={(e) => setDescFind(e.target.value)} placeholder="查找文本..." className="h-8 text-xs flex-1" />
                    <Input value={descReplace} onChange={(e) => setDescReplace(e.target.value)} placeholder="替换为..." className="h-8 text-xs flex-1" />
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={descRegex} onChange={() => setDescRegex(!descRegex)} className="accent-sky-500" />
                    使用正则表达式
                  </label>
                  <div className="rounded-lg border border-border/20 bg-muted/10 p-3 text-xs text-muted-foreground">
                    将在 {selected.length} 件商品描述中执行查找替换（正则{descRegex ? "开启" : "关闭"}）
                  </div>
                </>
              )}

              {/* Tab: SEO */}
              {opTab === "seo" && (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">SEO 标题模板</p>
                    <Input value={seoTitleTpl} onChange={(e) => setSeoTitleTpl(e.target.value)} className="h-8 text-xs" placeholder="{title} — 品牌名" />
                    <div className="flex gap-1 mt-1">
                      {["{title}", "{price}", "{type}"].map((v) => (
                        <button key={v} onClick={() => insertVar(v, setSeoTitleTpl, seoTitleTpl)} className="px-2 py-0.5 rounded border border-border/30 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/20">{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">SEO 描述模板</p>
                    <Input value={seoDescTpl} onChange={(e) => setSeoDescTpl(e.target.value)} className="h-8 text-xs" placeholder="(可选) 描述模板" />
                  </div>
                  {preview.length > 0 && (
                    <div className="rounded-lg border border-border/20 bg-muted/10 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2">预览 ({Math.min(3, selected.length)} 件)</p>
                      {preview.map((pv) => (
                        <div key={pv.id} className="py-1 border-b border-border/10 last:border-0">
                          <span className="text-foreground font-medium">{pv.title}</span>
                          <span className="text-emerald-400 ml-2">{pv.newVal.slice(0, 70)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Tags */}
              {opTab === "tags" && (
                <>
                  <div className="flex gap-1">
                    {(["add", "remove", "replace"] as const).map((op) => (
                      <button key={op} onClick={() => setTagOp(op)} className={`px-3 py-1 rounded text-xs font-medium ${tagOp === op ? "bg-sky-500/15 text-sky-400 border border-sky-500/30" : "border border-border/30 text-muted-foreground"}`}>
                        {op === "add" ? "添加标签" : op === "remove" ? "移除标签" : "替换标签"}
                      </button>
                    ))}
                  </div>
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="输入标签，逗号分隔..." className="h-8 text-xs" />
                  {preview.length > 0 && (
                    <div className="rounded-lg border border-border/20 bg-muted/10 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2">预览</p>
                      {preview.map((pv) => (
                        <div key={pv.id} className="py-1 border-b border-border/10 last:border-0">
                          <span className="text-foreground">{pv.title}</span>
                          <span className="text-emerald-400 ml-2">{pv.newVal || "(空)"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══ Bottom Execution Bar ══ */}
      <div className="sticky bottom-0 z-30 -mx-1 rounded-lg border border-border/40 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} 件商品</span>
          <History opacity={0.3} />
        </div>
        {executing && (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2 rounded bg-muted/20 overflow-hidden">
              <div className="h-full bg-sky-500 rounded transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <span className="text-xs tabular-nums text-sky-400 font-mono">{progress.done}/{progress.total}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{progress.current}</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(!previewOpen)} disabled={selectedIds.size === 0} className="h-8 gap-1 text-xs"><Eye className="h-3 w-3" />预览</Button>
          {executing ? (
            <Button size="sm" variant="outline" onClick={stopExecution} className="h-8 gap-1 text-xs bg-red-500/10 text-red-400 border-red-500/30"><Pause className="h-3 w-3" />停止</Button>
          ) : (
            <Button size="sm" onClick={execute} disabled={selectedIds.size === 0} className="h-8 gap-1 text-xs" style={{ background: "#3b82f6" }}>
              {isDemo ? <Zap className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              确认执行
            </Button>
          )}
        </div>
      </div>

      {/* ══ Preview Modal ══ */}
      {previewOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between shrink-0 border-b border-border/20 px-5 py-3">
                <h3 className="text-sm font-semibold">变更预览 ({selected.length} 件)</h3>
                <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/20 text-[10px] font-semibold text-muted-foreground">
                      <th className="py-2 text-left">商品</th>
                      <th className="py-2 text-left">字段</th>
                      <th className="py-2 text-left">原值</th>
                      <th className="py-2 text-left text-emerald-400">新值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((pv) => (
                      <tr key={pv.id} className="border-b border-border/10">
                        <td className="py-2 text-foreground font-medium truncate max-w-[120px]">{pv.title}</td>
                        <td className="py-2 text-muted-foreground">{pv.field}</td>
                        <td className="py-2 text-muted-foreground truncate max-w-[200px]">{pv.orig || "(空)"}</td>
                        <td className="py-2 text-emerald-400 truncate max-w-[200px]">{pv.newVal || "(空)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ Error summary ══ */}
      {errors.length > 0 && !executing && (
        <Card className="border-red-500/30 bg-red-500/10 backdrop-blur-lg">
          <CardContent className="py-3 px-4">
            <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />失败 {errors.length} 件</p>
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {errors.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-red-300">{e.title}</span>
                  <span className="text-red-400/70">{e.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
