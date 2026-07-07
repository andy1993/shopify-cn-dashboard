"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FolderTree, Search, Plus, X, GripVertical, Trash2, Eye, EyeOff,
  ChevronDown, ChevronRight, Globe, MoreVertical, AlertCircle,
  CheckCircle2, Loader2, Tag, FileText, TrendingUp, Image,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface ConditionRule {
  id: string;
  column: string;
  relation: string;
  condition: string;
}

interface CollectionItem {
  id: number;
  title: string;
  description: string;
  published: boolean;
  updated_at: string;
  product_count: number;
  type: "smart" | "custom";
  rules?: ConditionRule[];
  disjunctive?: boolean;
  sortOrder?: string;
  productIds?: number[];
  seoTitle: string;
  seoDescription: string;
  handle: string;
}

interface DemoProduct {
  id: number; title: string; price: number;
}

const COLUMN_OPTIONS = [
  { value: "tag", label: "商品标签" },
  { value: "title", label: "商品标题" },
  { value: "price", label: "商品价格" },
  { value: "product_type", label: "商品品类" },
  { value: "vendor", label: "商品供应商" },
  { value: "inventory_quantity", label: "库存量" },
  { value: "variant_sku", label: "变体 SKU" },
];

const RELATIONS_BY_COLUMN: Record<string, Array<{ value: string; label: string }>> = {
  tag: [{ value: "equals", label: "等于" }],
  title: [{ value: "equals", label: "等于" }, { value: "not_equals", label: "不等于" }, { value: "contains", label: "包含" }, { value: "starts_with", label: "开头是" }],
  price: [{ value: "greater_than", label: "大于" }, { value: "less_than", label: "小于" }, { value: "equals", label: "等于" }],
  product_type: [{ value: "equals", label: "等于" }, { value: "not_equals", label: "不等于" }],
  vendor: [{ value: "equals", label: "等于" }, { value: "not_equals", label: "不等于" }],
  inventory_quantity: [{ value: "greater_than", label: "大于" }, { value: "less_than", label: "小于" }, { value: "equals", label: "等于" }],
  variant_sku: [{ value: "equals", label: "等于" }, { value: "contains", label: "包含" }],
};

const SORT_OPTIONS = [
  { value: "manual", label: "手动排序" },
  { value: "best-selling", label: "畅销" },
  { value: "created-descending", label: "新品" },
  { value: "price-ascending", label: "价格 ↑" },
  { value: "price-descending", label: "价格 ↓" },
  { value: "title-ascending", label: "标题 A-Z" },
];

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 1, title: "碳纤维手表 Chrono X", price: 299.99 },
  { id: 2, title: "无线降噪耳机 SonicFlow", price: 149.99 },
  { id: 3, title: "AR 护目镜 Air", price: 89.99 },
  { id: 4, title: "机械键盘 K8", price: 129.99 },
  { id: 5, title: "北欧台灯 LUX", price: 79.99 },
  { id: 6, title: "亚麻抱枕套", price: 44.99 },
  { id: 7, title: "智能运动手环", price: 59.99 },
  { id: 8, title: "便携蓝牙音箱", price: 69.99 },
];

const DEMO_COLLECTIONS: CollectionItem[] = [
  {
    id: 101, title: "热卖商品", description: "所有热卖标签商品", published: true, updated_at: new Date().toISOString(), product_count: 5, type: "smart",
    rules: [{ id: "r1", column: "tag", relation: "equals", condition: "hot" }], disjunctive: false, sortOrder: "best-selling",
    seoTitle: "热卖商品精选", seoDescription: "本站最受欢迎的热卖商品合集。", handle: "hot-products",
  },
  {
    id: 102, title: "¥300以上精选", description: "高客单价商品", published: true, updated_at: new Date().toISOString(), product_count: 3, type: "smart",
    rules: [{ id: "r1", column: "price", relation: "greater_than", condition: "300" }], disjunctive: false, sortOrder: "price-descending",
    seoTitle: "高客单价精选合集", seoDescription: "品质之选，¥300 以上精品商品。", handle: "premium-collection",
  },
  {
    id: 201, title: "首页推荐", description: "手动精选推荐商品", published: true, updated_at: new Date().toISOString(), product_count: 3, type: "custom",
    productIds: [1, 3, 5],
    seoTitle: "首页推荐", seoDescription: "编辑精选，每周更新。", handle: "featured",
  },
  {
    id: 202, title: "新品上架", description: "", published: false, updated_at: new Date().toISOString(), product_count: 2, type: "custom",
    productIds: [4, 6],
    seoTitle: "新品上架", seoDescription: "", handle: "new-arrivals",
  },
];

/* ─── Helpers ────────────────────────────────────────── */

function genId() { return String(Date.now()) + Math.random().toString(36).slice(2, 6); }

function estimateMatchCount(rules: ConditionRule[]): number {
  if (!rules.length) return 0;
  // Simple simulation for demo
  const tagRule = rules.find((r) => r.column === "tag");
  if (tagRule) return 5;
  const priceRule = rules.find((r) => r.column === "price");
  if (priceRule) return 3;
  return 2;
}

/* ─── Condition Rule Editor ──────────────────────────── */

function RuleEditor({
  rules, disjunctive, onChangeRules, onChangeDisjunctive,
}: {
  rules: ConditionRule[];
  disjunctive: boolean;
  onChangeRules: (r: ConditionRule[]) => void;
  onChangeDisjunctive: (v: boolean) => void;
}) {
  const addRule = () => onChangeRules([...rules, { id: genId(), column: "tag", relation: "equals", condition: "" }]);
  const removeRule = (id: string) => onChangeRules(rules.filter((r) => r.id !== id));
  const updateRule = (id: string, field: keyof ConditionRule, val: string) => {
    onChangeRules(rules.map((r) => r.id === id ? { ...r, [field]: val, ...(field === "column" ? { relation: RELATIONS_BY_COLUMN[val]?.[0]?.value ?? "equals" } : {}) } : r));
  };

  return (
    <div className="rounded-lg border border-border/20 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">条件逻辑：</span>
        <button onClick={() => onChangeDisjunctive(false)} className={`px-2 py-0.5 text-xs rounded ${!disjunctive ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground"}`}>所有条件 (AND)</button>
        <button onClick={() => onChangeDisjunctive(true)} className={`px-2 py-0.5 text-xs rounded ${disjunctive ? "bg-sky-500/20 text-sky-400" : "text-muted-foreground"}`}>任一条件 (OR)</button>
      </div>
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-1.5">
          <select value={r.column} onChange={(e) => updateRule(r.id, "column", e.target.value)} className="h-7 rounded border border-border/30 bg-background text-xs text-foreground px-1.5 flex-1">
            {COLUMN_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={r.relation} onChange={(e) => updateRule(r.id, "relation", e.target.value)} className="h-7 rounded border border-border/30 bg-background text-xs text-foreground px-1.5 w-20">
            {(RELATIONS_BY_COLUMN[r.column] || [{ value: "equals", label: "等于" }]).map((rel) => <option key={rel.value} value={rel.value}>{rel.label}</option>)}
          </select>
          <Input value={r.condition} onChange={(e) => updateRule(r.id, "condition", e.target.value)} placeholder="值" className="h-7 text-sm w-24" />
          <button onClick={() => removeRule(r.id)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={addRule} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" />添加条件</Button>
    </div>
  );
}

/* ─── SEO Preview ────────────────────────────────────── */

function SeoPreview({ title, handle, description, shopDomain }: { title: string; handle: string; description: string; shopDomain: string }) {
  const displayTitle = title || "集合名称";
  const displayDesc = description || "暂无描述";
  const url = (shopDomain || "店铺地址") + "/collections/" + (handle || "handle");

  return (
    <div className="rounded-lg border border-border/20 bg-card p-3 max-w-md">
      <p className="text-sm font-medium text-sky-400 truncate">{displayTitle.slice(0, 70)}</p>
      <p className="text-xs text-emerald-400/70 truncate">{url}</p>
      <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">{displayDesc.slice(0, 320)}</p>
    </div>
  );
}

/* ─── Delete Confirm Dialog ──────────────────────────── */

function DeleteDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border/40 bg-card shadow-2xl p-5 space-y-3">
          <AlertCircle className="h-9 w-8 text-red-400" />
          <p className="text-base text-foreground font-semibold">确定删除集合 &ldquo;{title}&rdquo;？</p>
          <p className="text-sm text-muted-foreground">此操作不可恢复。集合中的商品不会被删除。</p>
          <div className="flex gap-2 pt-2">
            <Button onClick={onConfirm} className="flex-1 h-9 bg-red-600 hover:bg-red-500 text-white text-sm">确认删除</Button>
            <Button variant="outline" onClick={onCancel} className="flex-1 h-9 text-sm">取消</Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main Component ─────────────────────────────────── */

interface CollectionManagerPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  collections?: {
    smart: Array<{ id: number; title: string; handle: string; body_html: string; published: boolean; products_count: number; sort_order: string; rules?: Array<{ column: string; relation: string; condition: string }>; updated_at: string }>;
    custom: Array<{ id: number; title: string; handle: string; body_html: string; published: boolean; products_count: number; sort_order: string; updated_at: string }>;
  } | null;
}

export default function CollectionManagerPanel({ isDemo, shopUrl, accessToken, shopName, collections: collectionsProp }: CollectionManagerPanelProps) {
  const [collections, setCollections] = useState<CollectionItem[]>(() => isDemo ? DEMO_COLLECTIONS : []);
  const [activeTab, setActiveTab] = useState<"smart" | "custom">("smart");
  const [search, setSearch] = useState("");
  const [filterPublished, setFilterPublished] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<CollectionItem> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Init from real data or demo data
  useEffect(() => {
    if (!isDemo && collectionsProp) {
      const merged: CollectionItem[] = [
        ...(collectionsProp.smart || []).map((c) => ({
          id: c.id, title: c.title, description: c.body_html || "", published: c.published,
          updated_at: c.updated_at, product_count: c.products_count,
          type: "smart" as const,
          rules: (c.rules || []).map((r, i) => ({ id: String(i), column: r.column, relation: r.relation, condition: r.condition })),
          sortOrder: c.sort_order, seoTitle: "", seoDescription: "", handle: c.handle,
        })),
        ...(collectionsProp.custom || []).map((c) => ({
          id: c.id, title: c.title, description: c.body_html || "", published: c.published,
          updated_at: c.updated_at, product_count: c.products_count,
          type: "custom" as const, productIds: [],
          seoTitle: "", seoDescription: "", handle: c.handle,
        })),
      ];
      setCollections(merged);
    }
  }, [isDemo, collectionsProp]);

  // Product picker state for custom collections
  const [pickerSearch, setPickerSearch] = useState("");

  const filtered = useMemo(() => {
    return collections.filter((c) => {
      if (c.type !== activeTab) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPublished === "published" && !c.published) return false;
      if (filterPublished === "hidden" && c.published) return false;
      return true;
    });
  }, [collections, activeTab, search, filterPublished]);

  /* ── CRUD operations ──────────────────────────────── */
  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); setEditForm(null); return; }
    const c = collections.find((x) => x.id === id);
    if (c) {
      setExpandedId(id);
      setEditForm({
        title: c.title, description: c.description, published: c.published,
        rules: c.rules ? [...c.rules] : [], disjunctive: c.disjunctive ?? false,
        sortOrder: c.sortOrder ?? "manual", productIds: c.productIds ? [...c.productIds] : [],
        seoTitle: c.seoTitle, seoDescription: c.seoDescription, handle: c.handle,
      });
    }
  };

  const saveEdit = () => {
    if (!editForm || expandedId === null || !editForm.title) return;
    setCollections((prev) => prev.map((c) => c.id === expandedId ? {
      ...c, title: editForm.title!, description: editForm.description || "",
      published: !!editForm.published,
      rules: editForm.rules || [], disjunctive: editForm.disjunctive ?? false,
      sortOrder: editForm.sortOrder || "manual", productIds: editForm.productIds || [],
      product_count: editForm.type === "smart" ? estimateMatchCount(editForm.rules || []) : (editForm.productIds || []).length,
      seoTitle: editForm.seoTitle || editForm.title!, seoDescription: editForm.seoDescription || "",
      handle: editForm.handle || "",
      updated_at: new Date().toISOString(),
    } : c));
    showToast(isDemo ? "演示模式：已本地生效" : "集合已保存");
    setExpandedId(null); setEditForm(null);
  };

  const createNew = (type: "smart" | "custom") => {
    const newId = Date.now();
    const newItem: CollectionItem = {
      id: newId, title: "新集合", description: "", published: false, type,
      updated_at: new Date().toISOString(), product_count: 0,
      rules: type === "smart" ? [{ id: genId(), column: "tag", relation: "equals", condition: "" }] : undefined,
      disjunctive: false, sortOrder: "manual",
      productIds: [], seoTitle: "", seoDescription: "", handle: "",
    };
    setCollections((prev) => [newItem, ...prev]);
    setExpandedId(newId);
    setEditForm({
      title: newItem.title, description: "", published: false,
      rules: type === "smart" ? [{ id: genId(), column: "tag", relation: "equals", condition: "" }] : [],
      disjunctive: false, sortOrder: "manual", productIds: [],
      seoTitle: "", seoDescription: "", handle: "",
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    showToast(isDemo ? "演示模式：已删除" : "集合已删除");
    setDeleteTarget(null); setExpandedId(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><FolderTree className="h-6 w-6 text-purple-400" />集合管理</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName} · {collections.length} 个集合{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="flex gap-1">
            {(["smart", "custom"] as const).map((t) => (
              <button key={t} onClick={() => { setActiveTab(t); setExpandedId(null); setEditForm(null); }} className={`px-3 py-1.5 rounded text-sm font-medium ${activeTab === t ? "bg-purple-500/15 text-purple-400" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "smart" ? "智能集合" : "手动集合"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索集合名称..." className="h-9 pl-7 text-sm" />
          </div>
          <select value={filterPublished} onChange={(e) => setFilterPublished(e.target.value)} className="h-9 rounded border border-border/40 bg-background px-2 text-sm text-foreground">
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="hidden">隐藏</option>
          </select>
          <Button size="sm" onClick={() => createNew(activeTab)} className="h-9 gap-1 bg-purple-600 hover:bg-purple-500 text-white text-sm"><Plus className="h-3 w-3" />创建{activeTab === "smart" ? "智能" : "手动"}集合</Button>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.id} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-hidden">
            {/* Row */}
            <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/20" onClick={() => toggleExpand(c.id)}>
              {expandedId === c.id ? <ChevronDown className="h-4 w-4 shrink-0 text-purple-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("zh-CN")} 更新</p>
              </div>
              <Badge className="text-xs px-2 py-0 bg-purple-500/15 text-purple-400">{c.product_count} 件</Badge>
              <Badge className={`text-xs px-2 py-0 ${c.published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                {c.published ? <><Eye className="h-2.5 w-2.5 mr-0.5 inline" />已发布</> : <><EyeOff className="h-2.5 w-2.5 mr-0.5 inline" />隐藏</>}
              </Badge>
              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>

            {/* Expanded edit area */}
            {expandedId === c.id && editForm && (
              <CardContent className="px-5 py-3 border-t border-border/20 animate-[fadeIn_0.15s_ease-out] space-y-3">
                {/* Name / Description / Published */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 block">集合名称 *</label>
                    <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 block">描述</label>
                    <Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="h-9 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={!!editForm.published} onChange={() => setEditForm({ ...editForm, published: !editForm.published })} className="accent-emerald-500" />已发布到店铺前台
                </label>

                {/* Smart: Rules editor */}
                {c.type === "smart" && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">条件规则</p>
                    <RuleEditor
                      rules={editForm.rules || []}
                      disjunctive={editForm.disjunctive ?? false}
                      onChangeRules={(r) => setEditForm({ ...editForm, rules: r })}
                      onChangeDisjunctive={(v) => setEditForm({ ...editForm, disjunctive: v })}
                    />
                    <p className="text-xs text-emerald-400">当前规则匹配 ≈ {estimateMatchCount(editForm.rules || [])} 件商品</p>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 block">排序方式</label>
                      <select value={editForm.sortOrder || "manual"} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} className="h-9 rounded border border-border/40 bg-background px-2 text-sm text-foreground w-full">
                        {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* Custom: Product picker */}
                {c.type === "custom" && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">商品管理 ({(editForm.productIds || []).length} 件)</p>
                    <div className="flex gap-3">
                      {/* Available */}
                      <div className="flex-1 border border-border/20 rounded-lg p-2 max-h-48 overflow-y-auto">
                        <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="搜索商品..." className="h-7 text-sm mb-1" />
                        {DEMO_PRODUCTS.filter((p) => !(editForm.productIds || []).includes(p.id) && (!pickerSearch || p.title.includes(pickerSearch))).map((p) => (
                          <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/20 text-sm cursor-pointer"
                            onClick={() => setEditForm({ ...editForm, productIds: [...(editForm.productIds || []), p.id] })}>
                            <span className="text-foreground truncate">{p.title}</span>
                            <span className="text-xs text-emerald-400">${p.price.toFixed(2)}</span>
                            <Plus className="h-3 w-3 text-muted-foreground ml-1" />
                          </div>
                        ))}
                        {DEMO_PRODUCTS.filter((p) => !(editForm.productIds || []).includes(p.id) && (!pickerSearch || p.title.includes(pickerSearch))).length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">无可选商品</p>}
                      </div>
                      {/* Selected */}
                      <div className="flex-1 border border-border/20 rounded-lg p-2 max-h-48 overflow-y-auto">
                        <p className="text-xs text-muted-foreground mb-1">已选商品</p>
                        {(editForm.productIds || []).map((pid) => {
                          const p = DEMO_PRODUCTS.find((x) => x.id === pid);
                          if (!p) return null;
                          return (
                            <div key={pid} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/20 text-sm cursor-pointer group"
                              onClick={() => setEditForm({ ...editForm, productIds: (editForm.productIds || []).filter((x) => x !== pid) })}>
                              <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                              <span className="flex-1 text-foreground truncate ml-1">{p.title}</span>
                              <span className="text-xs text-emerald-400">${p.price.toFixed(2)}</span>
                              <X className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 ml-1 hover:text-red-400" />
                            </div>
                          );
                        })}
                        {(editForm.productIds || []).length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">未选择商品</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* SEO */}
                <details className="group">
                  <summary className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer flex items-center gap-1">SEO 设置 <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" /></summary>
                  <div className="space-y-2 mt-2 ml-1">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5"><span>SEO 标题</span><span>{(editForm.seoTitle || "").length}/70</span></div>
                      <Input value={editForm.seoTitle || ""} onChange={(e) => setEditForm({ ...editForm, seoTitle: e.target.value })} maxLength={70} className="h-9 text-sm" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5"><span>SEO 描述</span><span>{(editForm.seoDescription || "").length}/320</span></div>
                      <textarea value={editForm.seoDescription || ""} onChange={(e) => setEditForm({ ...editForm, seoDescription: e.target.value })} maxLength={320} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">URL 句柄</label>
                      <Input value={editForm.handle || ""} onChange={(e) => setEditForm({ ...editForm, handle: e.target.value })} className="h-9 text-sm" />
                    </div>
                    <SeoPreview title={editForm.seoTitle || editForm.title || ""} handle={editForm.handle || ""} description={editForm.seoDescription || editForm.description || ""} shopDomain={shopUrl || shopName} />
                  </div>
                </details>

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveEdit} disabled={!editForm.title} className="h-9 gap-1 bg-purple-600 hover:bg-purple-500 text-white text-sm flex-1"><CheckCircle2 className="h-3 w-3" />保存</Button>
                  <Button variant="outline" onClick={() => { setExpandedId(null); setEditForm(null); }} className="h-9 text-sm">取消</Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16">
            <FolderTree className="h-12 w-12 text-muted-foreground/25" />
            <p className="text-base text-muted-foreground">暂无集合</p>
            <Button size="sm" onClick={() => createNew(activeTab)} className="h-9 text-sm bg-purple-600 hover:bg-purple-500 text-white"><Plus className="h-3 w-3 mr-1" />创建集合</Button>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {deleteTarget && <DeleteDialog title={deleteTarget.title} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
