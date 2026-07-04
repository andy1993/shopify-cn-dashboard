"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Languages, Search, Download, Upload, Save, Bot, X, CheckCircle2, AlertCircle,
  Globe, FileText, Package, FolderOpen, BookOpen, Store,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface TranslatableField {
  resourceType: "product" | "collection" | "page" | "blog" | "article" | "shop";
  resourceId: number; resourceName: string;
  field: string; sourceText: string; translation: string; translated: boolean;
}

interface TranslationManagerPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
}

const TARGET_LANGUAGES = [
  { code: "zh-CN", name: "简体中文" }, { code: "zh-TW", name: "繁體中文" },
  { code: "ja", name: "日本語" }, { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" }, { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" }, { code: "it", name: "Italiano" },
];

const RESOURCE_TYPE_TABS = [
  { key: "all", label: "全部", icon: Globe },
  { key: "product", label: "商品", icon: Package },
  { key: "collection", label: "集合", icon: FolderOpen },
  { key: "page", label: "页面", icon: FileText },
  { key: "blog", label: "博客", icon: BookOpen },
];

/* ─── Demo Data ───────────────────────────────────────── */

function generateDemoFields(): TranslatableField[] {
  const items: Array<{ type: TranslatableField["resourceType"]; id: number; name: string }> = [
    { type: "product", id: 1, name: "碳纤维手表 Chrono X" },
    { type: "product", id: 2, name: "无线降噪耳机 SonicFlow" },
    { type: "product", id: 3, name: "AR 护目镜 Air" },
    { type: "product", id: 4, name: "机械键盘 K8" },
    { type: "product", id: 5, name: "北欧台灯 LUX" },
    { type: "product", id: 6, name: "亚麻抱枕套" },
    { type: "product", id: 7, name: "智能水杯 Thermo" },
    { type: "product", id: 8, name: "运动手环 FitBand" },
    { type: "collection", id: 101, name: "夏季新品" },
    { type: "collection", id: 102, name: "办公好物" },
    { type: "page", id: 201, name: "关于我们" },
    { type: "page", id: 202, name: "FAQ 常见问题" },
    { type: "blog", id: 301, name: "产品博客" },
  ];

  const fields: TranslatableField[] = [];
  let idx = 0;
  for (const item of items) {
    const isProduct = item.type === "product";
    const fieldKeys = isProduct ? ["title","body_html","seo_title","seo_description","variant_title"] :
                      item.type === "blog" ? ["title","seo_title","seo_description"] : ["title","body_html","seo_title","seo_description"];
    for (const fk of fieldKeys) {
      const src = fk === "title" ? item.name :
                  fk === "body_html" ? `<p>This is the description for ${item.name.toLowerCase()}.</p>` :
                  fk === "seo_title" ? `${item.name} - Buy Online` :
                  fk === "seo_description" ? `Shop ${item.name} with fast shipping.` :
                  fk === "variant_title" ? "Default Title" : "";
      const translated = (idx + 1) % 2 === 0;
      fields.push({
        resourceType: item.type, resourceId: item.id, resourceName: item.name,
        field: fk, sourceText: src,
        translation: translated ? `【模拟翻译】${src.slice(0, 20)}...` : "",
        translated,
      });
      idx++;
    }
  }
  return fields;
}

export default function TranslationManagerPanel({ isDemo, shopUrl, accessToken, shopName }: TranslationManagerPanelProps) {
  const [targetLang, setTargetLang] = useState("zh-CN");
  const [resourceTab, setResourceTab] = useState("all");
  const [fields, setFields] = useState<TranslatableField[]>(() => isDemo ? generateDemoFields() : []);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() => {
    let list = fields;
    if (resourceTab !== "all") list = list.filter((f) => f.resourceType === resourceTab);
    if (!showCompleted) list = list.filter((f) => !f.translated);
    if (search) list = list.filter((f) => f.sourceText.toLowerCase().includes(search.toLowerCase()) || f.resourceName.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [fields, resourceTab, search, showCompleted]);

  const grouped = useMemo(() => {
    const map = new Map<string, TranslatableField[]>();
    filtered.forEach((f) => {
      const key = `${f.resourceType}|${f.resourceId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return map;
  }, [filtered]);

  // Progress stats
  const stats = useMemo(() => {
    const total = fields.length;
    const done = fields.filter((f) => f.translated).length;
    const byType = (type: string) => {
      const f = fields.filter((x) => x.resourceType === type);
      return { total: f.length, done: f.filter((x) => x.translated).length };
    };
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0, product: byType("product"), collection: byType("collection"), page: byType("page") };
  }, [fields]);

  const untranslatedCount = stats.total - stats.done;

  const updateTranslation = (resourceType: string, resourceId: number, field: string, value: string) => {
    setFields((prev) => prev.map((f) => f.resourceType === resourceType && f.resourceId === resourceId && f.field === field ? { ...f, translation: value, translated: value.trim().length > 0 } : f));
  };

  const machineTranslateOne = async (f: TranslatableField) => {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(f.sourceText)}&langpair=en|${targetLang}`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      updateTranslation(f.resourceType, f.resourceId, f.field, data.responseData?.translatedText || "");
    } catch { showToast("翻译失败"); }
  };

  const machineTranslateAll = async () => {
    setTranslating(true);
    const untrans = fields.filter((f) => !f.translated);
    for (const f of untrans) {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 300));
        updateTranslation(f.resourceType, f.resourceId, f.field, `[自动翻译] ${f.sourceText.slice(0, 30)}...`);
      } else {
        await machineTranslateOne(f);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setTranslating(false);
    showToast(`完成 ${untrans.length} 条翻译`);
  };

  const exportJSON = () => {
    const data = fields.filter((f) => f.translated).map((f) => ({ resourceType: f.resourceType, resourceId: f.resourceId, field: f.field, source: f.sourceText, translation: f.translation }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_翻译_${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast("翻译文件已导出");
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Array<{ resourceType: string; resourceId: number; field: string; source: string; translation: string }>;
        setFields((prev) => prev.map((f) => { const m = data.find((d) => d.resourceType === f.resourceType && d.resourceId === f.resourceId && d.field === f.field); return m ? { ...f, translation: m.translation, translated: true } : f; }));
        showToast(`已导入 ${data.length} 条翻译`);
      } catch { showToast("导入失败：JSON 格式错误"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Expose count to parent (for nav badge)
  useEffect(() => { (window as any).__untranslatedCount = untranslatedCount; }, [untranslatedCount]);

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Languages className="h-6 w-6 text-indigo-400" />翻译管理器</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {untranslatedCount} 条待翻译{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{k:"product",l:"商品",p:stats.product},{k:"collection",l:"集合",p:stats.collection},{k:"page",l:"页面",p:stats.page},{k:"total",l:"总计",p:{total:stats.total,done:stats.done}}].map((s) => {
          const pct = s.p.total > 0 ? Math.round((s.p.done / s.p.total) * 100) : 0;
          return <Card key={s.k} className="border-border/40 bg-card/60"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground mb-1">{s.l} · {s.p.done}/{s.p.total}</p>
            <div className="h-2 rounded bg-muted/20 overflow-hidden"><div className="h-full bg-indigo-500 rounded transition-all" style={{ width: `${pct}%` }} /></div>
          </CardContent></Card>;
        })}
      </div>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="text-[10px] text-muted-foreground">目标:</span>
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="h-7 rounded border border-border/40 bg-background text-[10px] text-foreground px-1">
          {TARGET_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <div className="flex gap-1 ml-2">
          {RESOURCE_TYPE_TABS.map((t) => <button key={t.key} onClick={() => { setResourceTab(t.key); setExpandedId(null); }} className={`px-2 py-0.5 rounded text-[10px] ${resourceTab === t.key ? "bg-indigo-500/15 text-indigo-400" : "text-muted-foreground"}`}>{t.label}</button>)}
        </div>
        <label className="flex items-center gap-1 text-[10px] cursor-pointer ml-2"><input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted(!showCompleted)} className="accent-indigo-500"/>显示已翻译</label>
        <div className="relative flex-1 min-w-[100px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..." className="h-7 pl-7 text-[10px]"/></div>
        <Button size="sm" variant="outline" onClick={machineTranslateAll} disabled={translating} className="h-7 gap-1 text-[10px]"><Bot className="h-3 w-3"/>{translating ? "翻译中..." : "批量机翻"}</Button>
        <Button size="sm" variant="outline" onClick={exportJSON} className="h-7 gap-1 text-[10px]"><Download className="h-3 w-3"/>导出</Button>
        <label className="h-7 gap-1 text-[10px] flex items-center cursor-pointer border border-border/40 rounded px-2 hover:bg-muted/10"><Upload className="h-3 w-3"/>导入<input type="file" accept=".json" onChange={importJSON} className="hidden"/></label>
      </CardContent></Card>

      {/* Translation List */}
      <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto">
        {[...grouped.entries()].map(([key, items]) => {
          const allDone = items.every((i) => i.translated);
          const first = items[0];
          const typeIcons: Record<string, string> = { product: "📦", collection: "📁", page: "📄", blog: "📝", article: "📰", shop: "🏪" };

          if (expandedId === key) {
            // Expanded full editor
            return (
              <Card key={key} className={`border-border/40 bg-card/60 shadow-lg ${allDone ? "border-l-2 border-l-indigo-500" : ""}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{typeIcons[first.resourceType] || ""} {first.resourceName}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => items.forEach((i) => machineTranslateOne(i))} className="h-6 text-[9px]"><Bot className="h-3 w-3"/></Button>
                      <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)} className="h-6"><X className="h-3 w-3"/></Button>
                    </div>
                  </div>
                  {items.map((f) => (
                    <div key={f.field} className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/10 rounded px-2 py-1.5 text-muted-foreground"><span className="text-[9px] text-muted-foreground/50">{f.field}</span><p className="text-muted-foreground">{f.sourceText}</p></div>
                      <div className="relative">
                        <textarea value={f.translation} onChange={(e) => updateTranslation(f.resourceType, f.resourceId, f.field, e.target.value)} rows={2} className="w-full rounded border border-border/40 bg-background px-2 py-1.5 text-foreground text-xs resize-none" placeholder="输入译文..." />
                        {f.translated ? <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-emerald-400"/> : <AlertCircle className="absolute top-1 right-1 h-3 w-3 text-amber-400"/>}
                      </div>
                    </div>
                  ))}
                  <Button size="sm" onClick={() => showToast("翻译已保存")} className="h-7 text-[10px] bg-indigo-600 text-white"><Save className="h-3 w-3 mr-1"/>保存翻译</Button>
                </CardContent>
              </Card>
            );
          }

          // Collapsed row
          return (
            <Card key={key} className={`border-border/40 bg-card/60 cursor-pointer hover:border-indigo-500/30 transition-colors ${allDone ? "border-l-2 border-l-indigo-500" : ""}`} onClick={() => setExpandedId(key)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{typeIcons[first.resourceType] || ""}</span>
                    <span className="text-sm font-semibold text-foreground">{first.resourceName}</span>
                    <Badge className={`text-[8px] px-1 py-0 ${allDone ? "bg-indigo-500/15 text-indigo-400" : "bg-amber-500/15 text-amber-400"}`}>{allDone ? "已完成" : "待翻译"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{items.filter((i) => i.translated).length}/{items.length} 字段</span>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); items.forEach((i) => machineTranslateOne(i)); }} className="h-6 text-[9px]"><Bot className="h-3 w-3"/></Button>
                  </div>
                </div>
                {/* Preview: first untranslated field */}
                {items.find((i) => !i.translated) && (
                  <div className="mt-1.5 flex items-center gap-2 text-[9px]">
                    <span className="text-muted-foreground shrink-0">{items.find((i) => !i.translated)!.field}:</span>
                    <span className="text-muted-foreground/70 truncate">{items.find((i) => !i.translated)!.sourceText.slice(0, 80)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <div className="text-center py-16"><CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-indigo-400/25"/><p className="text-sm text-muted-foreground">全部已翻译 ✓</p></div>}
    </div>
  );
}
