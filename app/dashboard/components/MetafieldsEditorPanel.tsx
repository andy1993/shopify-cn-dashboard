"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Database, Search, Plus, X, Save, Download, Upload, Trash2,
  CheckCircle2, AlertCircle, Edit3, Eye, ChevronDown, Link,
  Copy, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

type MetaOwnerType = "product" | "variant" | "collection";

interface MetafieldItem {
  id: number;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description: string;
  ownerId: number;
  ownerType: MetaOwnerType;
}

interface MetafieldsEditorPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
}

const META_TYPES: Array<{ value: string; label: string }> = [
  { value: "single_line_text_field", label: "单行文本" },
  { value: "multi_line_text_field", label: "多行文本" },
  { value: "number_integer", label: "整数" },
  { value: "number_decimal", label: "小数" },
  { value: "boolean", label: "布尔值" },
  { value: "json", label: "JSON" },
  { value: "color", label: "颜色" },
  { value: "url", label: "URL" },
  { value: "date", label: "日期" },
  { value: "date_time", label: "日期时间" },
  { value: "weight", label: "重量" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(META_TYPES.map((t) => [t.value, t.label]));

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_TARGETS: Array<{ id: number; title: string; type: MetaOwnerType }> = [
  { id: 1, title: "碳纤维手表 Chrono X", type: "product" },
  { id: 2, title: "无线降噪耳机 SonicFlow", type: "product" },
  { id: 3, title: "北欧台灯 LUX", type: "product" },
];

const DEMO_METAFIELDS: MetafieldItem[] = [
  { id: 1, namespace: "custom", key: "material", value: "纯棉 + 真皮", type: "single_line_text_field", description: "材质", ownerId: 1, ownerType: "product" },
  { id: 2, namespace: "custom", key: "care", value: "手洗，不可漂白，阴干", type: "multi_line_text_field", description: "护理说明", ownerId: 1, ownerType: "product" },
  { id: 3, namespace: "specs", key: "weight", value: "250", type: "number_integer", description: "重量(克)", ownerId: 1, ownerType: "product" },
  { id: 4, namespace: "inventory", key: "is_preorder", value: "true", type: "boolean", description: "是否预售", ownerId: 2, ownerType: "product" },
  { id: 5, namespace: "theme", key: "accent_color", value: "#FF6B6B", type: "color", description: "主题色", ownerId: 2, ownerType: "product" },
  { id: 6, namespace: "seo", key: "rich_data", value: '{"brand":"TechGear","rating":4.5}', type: "json", description: "结构化数据", ownerId: 3, ownerType: "product" },
  { id: 7, namespace: "custom", key: "video_url", value: "https://youtube.com/watch?v=xxx", type: "url", description: "介绍视频", ownerId: 3, ownerType: "product" },
];

/* ─── Value Renderer ──────────────────────────────────── */

function MetaValue({ type, value }: { type: string; value: string }) {
  if (type === "boolean") return <Badge className="text-xs px-1.5 py-0">{value === "true" ? <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5 inline text-emerald-400" />是</> : <><X className="h-2.5 w-2.5 mr-0.5 inline text-red-400" />否</>}</Badge>;
  if (type === "color") return <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded border border-border/40" style={{ backgroundColor: value }} /><span className="text-sm font-mono">{value}</span></span>;
  if (type === "url") return <a href={value} target="_blank" className="text-sm text-sky-400 underline truncate max-w-[200px] inline-block">{value}</a>;
  if (type === "json") return <code className="text-xs bg-muted/20 px-1.5 py-0.5 rounded text-emerald-400 max-w-[200px] truncate inline-block">{value}</code>;
  if (type === "multi_line_text_field") return <span className="text-sm max-w-[200px] truncate inline-block">{value.split("\n")[0]}{value.includes("\n") ? " ..." : ""}</span>;
  return <span className="text-sm text-foreground max-w-[200px] truncate inline-block">{value}</span>;
}

/* ─── Add/Edit Modal ──────────────────────────────────── */

function MetaModal({
  data, onSave, onCancel,
}: {
  data: { id?: number; namespace: string; key: string; type: string; value: string; description: string };
  onSave: (d: typeof data) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(data);
  const [jsonError, setJsonError] = useState(false);

  const handleSave = () => {
    if (!form.namespace.trim() || !form.key.trim()) return;
    if (form.type === "json" && form.value.trim()) {
      try { JSON.parse(form.value); setJsonError(false); } catch { setJsonError(true); return; }
    }
    onSave(form);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
            <h3 className="text-base font-semibold">{data.id ? "编辑 Metafield" : "添加 Metafield"}</h3>
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-9 w-8 p-0"><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">Namespace *</label><Input value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} className="h-9 text-sm" placeholder="custom" /></div>
              <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">Key *</label><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="h-9 text-sm" placeholder="material" /></div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-0.5 block">类型</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 w-full rounded-md border border-border/40 bg-background px-3 text-base text-foreground">
                {META_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-0.5 block">值</label>
              {form.type === "boolean" ? (
                <label className="flex items-center gap-2 text-base cursor-pointer"><input type="checkbox" checked={form.value === "true"} onChange={(e) => setForm({ ...form, value: e.target.checked ? "true" : "false" })} className="accent-emerald-500" /><span className="text-foreground">{form.value === "true" ? "是 (true)" : "否 (false)"}</span></label>
              ) : form.type === "color" ? (
                <div className="flex items-center gap-2"><Input type="color" value={form.value || "#000000"} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 w-12 p-1" /><Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm font-mono flex-1" placeholder="#FF6B6B" /></div>
              ) : form.type === "json" || form.type === "multi_line_text_field" ? (
                <div>
                  <textarea value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} rows={form.type === "json" ? 4 : 3} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm font-mono resize-none" />
                  {form.type === "json" && jsonError && <p className="text-xs text-red-400 mt-0.5">JSON 格式无效，请检查</p>}
                </div>
              ) : form.type === "date" ? (
                <Input type="date" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm" />
              ) : form.type === "date_time" ? (
                <Input type="datetime-local" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm" />
              ) : form.type === "url" ? (
                <Input type="url" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm" placeholder="https://..." />
              ) : form.type === "number_integer" || form.type === "number_decimal" ? (
                <Input type="number" step={form.type === "number_decimal" ? 0.01 : 1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm" />
              ) : (
                <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-9 text-sm" />
              )}
            </div>
            <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">描述</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none" placeholder="此字段的用途..." /></div>
          </div>
          <div className="flex gap-2 border-t border-border/20 px-5 py-3">
            <Button onClick={handleSave} className="flex-1 h-9 gap-1 bg-emerald-600 text-white text-sm"><Save className="h-3 w-3" />保存</Button>
            <Button variant="outline" onClick={onCancel} className="h-9 text-sm">取消</Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main Component ─────────────────────────────────── */

interface MetafieldsEditorPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  fullProducts?: Array<{ id: number; title: string; status: string; shopName: string }>;
}

export default function MetafieldsEditorPanel({ isDemo, shopUrl, accessToken, shopName, fullProducts }: MetafieldsEditorPanelProps) {
  const [ownerType, setOwnerType] = useState<MetaOwnerType>("product");
  const [selectedIds, setSelectedIds] = useState<Record<MetaOwnerType, number | null>>({
    product: isDemo ? 1 : null,
    variant: null,
    collection: null,
  });
  const selectedOwnerId = selectedIds[ownerType];
  const [ownerSearch, setOwnerSearch] = useState("");
  const [allMetafields, setAllMetafields] = useState<MetafieldItem[]>(() => isDemo ? DEMO_METAFIELDS : []);
  const [modalData, setModalData] = useState<Partial<MetafieldItem> & { id?: number; namespace: string; key: string; type: string; value: string; description: string } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [targets, setTargets] = useState<Array<{ id: number; title: string; type: MetaOwnerType }>>(() => isDemo ? DEMO_TARGETS : []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  /* ── Init targets from fullProducts ──────────────── */
  useEffect(() => {
    if (!isDemo && fullProducts && fullProducts.length > 0) {
      const t = fullProducts.map((p) => ({
        id: p.id,
        title: p.title + (p.shopName ? " (" + p.shopName + ")" : ""),
        type: "product" as MetaOwnerType,
      }));
      setTargets(t);
      if (!selectedIds.product) setSelectedIds((prev) => ({ ...prev, product: t[0].id }));
    }
  }, [isDemo, fullProducts]);

  /* ── Fetch metafields from API ─────────────────── */
  const fetchMetafields = useCallback(async (ownerId: number) => {
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMetafields", shopUrl, accessToken, ownerType, ownerId }),
      });
      const data = await res.json();
      if (data.metafields) {
        setAllMetafields(data.metafields.map((m: any) => ({
          id: m.id, namespace: m.namespace, key: m.key,
          value: String(m.value ?? ""), type: m.type,
          description: m.description || "", ownerId, ownerType,
        })));
      }
    } catch { showToast("获取 metafields 失败"); }
  }, [isDemo, shopUrl, accessToken, ownerType]);

  useEffect(() => {
    if (!isDemo && selectedOwnerId) fetchMetafields(selectedOwnerId);
  }, [isDemo, selectedOwnerId, fetchMetafields]);

  const currentMetafields = useMemo(() =>
    allMetafields.filter((m) => m.ownerId === selectedOwnerId && m.ownerType === ownerType),
    [allMetafields, selectedOwnerId, ownerType],
  );

  /* ── CRUD ──────────────────────────────────────────── */
  const openAdd = () => setModalData({ namespace: "custom", key: "", type: "single_line_text_field", value: "", description: "" });
  const openEdit = (m: MetafieldItem) => setModalData({ id: m.id, namespace: m.namespace, key: m.key, type: m.type, value: m.value, description: m.description });

  const handleSave = async (d: { namespace: string; key: string; type: string; value: string; description: string }) => {
    const isEdit = !!(modalData as any)?.id;

    if (isDemo) {
      if (isEdit) setAllMetafields((prev) => prev.map((m) => m.id === (modalData as any).id ? { ...m, ...d } : m));
      else {
        const newId = Math.max(0, ...allMetafields.map((m) => m.id)) + 1;
        setAllMetafields((prev) => [...prev, { id: newId, ...d, ownerId: selectedOwnerId!, ownerType } as MetafieldItem]);
      }
      setModalData(null);
      showToast("演示模式：已本地生效");
      return;
    }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveMetafield", shopUrl, accessToken,
          ownerType, ownerId: selectedOwnerId,
          metaFieldId: isEdit ? (modalData as any).id : undefined,
          metaFieldData: { namespace: d.namespace, key: d.key, value: d.value, type: d.type, description: d.description },
        }),
      });
      if ((await res.json()).success) {
        setModalData(null);
        showToast("Metafield 已保存");
        fetchMetafields(selectedOwnerId!);
      } else {
        showToast("保存失败");
      }
    } catch { showToast("网络错误"); }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;

    if (isDemo) {
      setAllMetafields((prev) => prev.filter((m) => m.id !== deleteId));
      setDeleteId(null);
      showToast("已删除");
      return;
    }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteMetafield", shopUrl, accessToken, ownerType, ownerId: selectedOwnerId, metaFieldId: deleteId }),
      });
      if ((await res.json()).success) {
        setDeleteId(null);
        showToast("已删除");
        fetchMetafields(selectedOwnerId!);
      } else {
        showToast("删除失败");
      }
    } catch { showToast("网络错误"); }
  };

  /* ── CSV ───────────────────────────────────────────── */
  const exportCSV = () => {
    const rows = currentMetafields.map((m) => [m.namespace, m.key, m.type, m.value]);
    const csv = "\uFEFF" + [["namespace", "key", "type", "value"], ...rows].map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "metafields_" + ownerType + "_" + selectedOwnerId + ".csv";
    a.click();
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = (reader.result as string).split("\n").filter(Boolean);
      if (lines.length < 2) return showToast("CSV 至少需要 1 行数据");
      const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
      if (header[0] !== "namespace" || header[1] !== "key") return showToast("CSV 格式不正确，需包含 namespace,key,type,value 列");
      const newItems: MetafieldItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        if (cols.length < 4) continue;
        newItems.push({ id: Math.max(0, ...allMetafields.map((m) => m.id)) + i, namespace: cols[0], key: cols[1], type: cols[2] || "single_line_text_field", value: cols[3] || "", description: "", ownerId: selectedOwnerId!, ownerType });
      }
      setAllMetafields((prev) => [...prev, ...newItems]);
      showToast(`已导入 ${newItems.length} 条 metafields`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Database className="h-6 w-6 text-pink-400" />Metafields 编辑器</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName}{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* Context Selector */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardContent className="flex items-center gap-3 px-4 py-3">
          <select value={ownerType} onChange={(e) => setOwnerType(e.target.value as MetaOwnerType)} className="h-9 rounded border border-border/40 bg-background px-3 text-base text-foreground">
            <option value="product">商品 Metafields</option>
            <option value="variant">变体 Metafields</option>
            <option value="collection">集合 Metafields</option>
          </select>
          {isDemo ? (
            <select value={selectedOwnerId ?? ""} onChange={(e) => { const id = Number(e.target.value) || null; setSelectedIds((prev) => ({ ...prev, [ownerType]: id })); }} className="h-9 flex-1 rounded border border-border/40 bg-background px-3 text-base text-foreground">
              <option value="">选择目标对象...</option>
              {targets.filter((t) => t.type === ownerType).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} placeholder={`搜索${ownerType === "product" ? "商品" : ownerType === "variant" ? "变体" : "集合"} ID...`} className="h-9 pl-8 text-sm" />
            </div>
          )}
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={currentMetafields.length === 0} className="h-9 gap-1 text-sm"><Download className="h-3 w-3" />导出</Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-9 gap-1 text-sm"><Upload className="h-3 w-3" />导入</Button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
          </div>
        </CardContent>
      </Card>

      {/* Metafields Table */}
      {!selectedOwnerId ? (
        <div className="text-center py-16 text-base text-muted-foreground"><Database className="h-10 w-10 mx-auto mb-2 text-muted-foreground/25" />请先选择目标对象</div>
      ) : (
        <>
          <Button size="sm" onClick={openAdd} className="h-9 gap-1 bg-pink-600 hover:bg-pink-500 text-white text-sm"><Plus className="h-3 w-3" />添加 Metafield</Button>
          <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
            <CardContent className="p-0">
              {currentMetafields.length > 0 ? (
                <table className="w-full">
                  <thead><tr className="border-b border-border/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pl-4 text-left">命名空间</th><th className="py-2.5 px-2 text-left">键</th><th className="py-2.5 px-2 text-left">类型</th><th className="py-2.5 px-2 text-left">值</th><th className="py-2.5 px-2 text-center w-20">操作</th>
                  </tr></thead>
                  <tbody>
                    {currentMetafields.map((m) => (
                      <tr key={m.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 pl-4 text-sm text-muted-foreground font-mono">{m.namespace}</td>
                        <td className="py-2.5 px-2 text-sm font-mono text-foreground">{m.key}</td>
                        <td className="py-2.5 px-2 text-sm text-muted-foreground">{TYPE_LABELS[m.type] || m.type}</td>
                        <td className="py-2.5 px-2"><MetaValue type={m.type} value={m.value} /></td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => openEdit(m)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/30"><Edit3 className="h-3 w-3 text-muted-foreground" /></button>
                            <button onClick={() => setDeleteId(m.id)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-500/20"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-base text-muted-foreground">该对象暂无 metafields</div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal */}
      {modalData && <MetaModal data={modalData as any} onSave={handleSave} onCancel={() => setModalData(null)} />}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border/40 rounded-xl p-5 max-w-sm space-y-3 shadow-2xl">
              <AlertCircle className="h-9 w-8 text-red-400" />
              <p className="text-base font-semibold">确定删除此 metafield？</p>
              <p className="text-sm text-muted-foreground">此操作不可恢复。</p>
              <div className="flex gap-2"><Button onClick={handleDelete} className="flex-1 bg-red-600 text-white text-sm">删除</Button><Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1 text-sm">取消</Button></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
