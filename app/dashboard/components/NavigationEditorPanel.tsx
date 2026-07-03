"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Menu, GripVertical, Plus, X, Edit3, Trash2, ChevronRight,
  ChevronDown, Save, RotateCcw, Search, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface MenuItem {
  id: number;
  title: string;
  url: string;
  type: string;
  parent_id?: number;
  position: number;
  children?: MenuItem[];
}

interface NavigationMenu {
  id: number;
  title: string;
  handle: string;
  items: MenuItem[];
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_MENU: NavigationMenu = {
  id: 1, title: "主菜单", handle: "main-menu",
  items: [
    { id: 1, title: "首页", url: "/", type: "frontpage", parent_id: undefined, position: 1 },
    { id: 2, title: "全部商品", url: "/collections/all", type: "collection", parent_id: undefined, position: 2, children: [
      { id: 3, title: "新品上市", url: "/collections/new", type: "collection", parent_id: 2, position: 1 },
      { id: 4, title: "热卖推荐", url: "/collections/best", type: "collection", parent_id: 2, position: 2 },
    ]},
    { id: 5, title: "关于我们", url: "/pages/about", type: "page", parent_id: undefined, position: 3 },
    { id: 6, title: "联系我们", url: "/pages/contact", type: "page", parent_id: undefined, position: 4 },
    { id: 7, title: "博客", url: "/blogs/news", type: "blog", parent_id: undefined, position: 5 },
  ],
};

/* ─── Helpers ────────────────────────────────────────── */

function flattenTree(items: MenuItem[], level = 0): Array<MenuItem & { level: number }> {
  return items.flatMap((item) => [
    { ...item, level },
    ...flattenTree(item.children || [], level + 1),
  ]);
}

function removeFromTree(items: MenuItem[], id: number): MenuItem[] {
  return items.filter((item) => item.id !== id).map((item) => ({
    ...item,
    children: item.children ? removeFromTree(item.children, id) : undefined,
  }));
}

function maxId(items: MenuItem[]): number {
  let max = 0;
  for (const item of items) {
    if (item.id > max) max = item.id;
    if (item.children) max = Math.max(max, maxId(item.children));
  }
  return max;
}

interface ChangeItem { type: "add" | "update" | "delete"; item: MenuItem; }

/* ─── Add/Edit Modal ─────────────────────────────────── */

const LINK_TYPES: Array<{ value: string; label: string; placeholder: string }> = [
  { value: "frontpage", label: "首页", placeholder: "/" },
  { value: "collection", label: "商品分类", placeholder: "/collections/..." },
  { value: "product", label: "具体商品", placeholder: "/products/..." },
  { value: "page", label: "静态页面", placeholder: "/pages/..." },
  { value: "blog", label: "博客", placeholder: "/blogs/..." },
  { value: "http", label: "自定义 URL", placeholder: "https://..." },
];

function ItemModal({
  item, items, onSave, onCancel,
}: {
  item: MenuItem | null;
  items: MenuItem[];
  onSave: (data: Partial<MenuItem>) => void;
  onCancel: () => void;
}) {
  const isEdit = !!item;
  const [title, setTitle] = useState(item?.title || "");
  const [linkType, setLinkType] = useState(item?.type || "frontpage");
  const [url, setUrl] = useState(item?.url || "/");
  const [parentId, setParentId] = useState<string>(item?.parent_id ? String(item.parent_id) : "none");

  const handleSave = () => {
    if (!title.trim()) return;
    const linkDef = LINK_TYPES.find((l) => l.value === linkType);
    const finalUrl = linkType === "frontpage" ? "/" : url || linkDef?.placeholder || "/";
    const pid = parentId === "none" ? undefined : Number(parentId);
    onSave({ title: title.trim(), type: linkType, url: finalUrl, parent_id: pid });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
            <h3 className="text-sm font-semibold">{isEdit ? "编辑菜单项" : "添加菜单项"}</h3>
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">菜单名称 *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="h-9 text-sm" placeholder="如：新品上市" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">链接类型</label>
              <select value={linkType} onChange={(e) => { setLinkType(e.target.value); const def = LINK_TYPES.find((l) => l.value === e.target.value); if (def?.value === "frontpage") setUrl("/"); else if (!url || url === "/") setUrl(def?.placeholder || ""); }} className="h-9 w-full rounded-md border border-border/40 bg-background px-3 text-sm text-foreground">
                {LINK_TYPES.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">目标链接</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 text-sm font-mono" placeholder={LINK_TYPES.find((l) => l.value === linkType)?.placeholder || "/"} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">父级菜单项</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9 w-full rounded-md border border-border/40 bg-background px-3 text-sm text-foreground">
                <option value="none">顶级菜单</option>
                {items.filter((i) => !item || i.id !== item.id).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border/20 px-5 py-3">
            <Button onClick={handleSave} disabled={!title.trim()} className="flex-1 h-9 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"><Save className="h-3 w-3" />{isEdit ? "保存修改" : "添加"}</Button>
            <Button variant="outline" onClick={onCancel} className="h-9 text-xs">取消</Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main Component ─────────────────────────────────── */

interface NavigationEditorPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  menus?: Array<{ id: number; title: string; handle: string; items: Array<{ id: number; title: string; url: string; type: string; parent_id: number | null; position: number }> }>;
}

export default function NavigationEditorPanel({ isDemo, shopUrl, accessToken, shopName, menus: menusProp }: NavigationEditorPanelProps) {
  const [menu, setMenu] = useState<NavigationMenu>(() => isDemo ? { ...DEMO_MENU, items: JSON.parse(JSON.stringify(DEMO_MENU.items)) } : { id: 0, title: "主菜单", handle: "main-menu", items: [] });
  const [initialItems, _setInitialItems] = useState<MenuItem[]>(() => JSON.parse(JSON.stringify(isDemo ? DEMO_MENU.items : [])));
  const [expanded, setExpanded] = useState<Set<number>>(new Set([...menu.items.map((i) => i.id)]));
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  // Init from real data
  useEffect(() => {
    if (!isDemo && menusProp && menusProp.length > 0) {
      const mainMenu = menusProp.find((m) => m.handle === "main-menu") || menusProp[0];
      const items = (mainMenu.items || []).map((i) => ({
        id: i.id, title: i.title, url: i.url, type: i.type,
        parent_id: i.parent_id || undefined, position: i.position,
      }));
      setMenu({ id: mainMenu.id, title: mainMenu.title, handle: mainMenu.handle, items });
      _setInitialItems(JSON.parse(JSON.stringify(items)));
    }
  }, [isDemo, menusProp]);

  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleExpand = (id: number) => setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  /* ── Compute changes ──────────────────────────────── */
  const changes = useMemo(() => {
    const result: ChangeItem[] = [];
    const initMap = new Map<number, MenuItem>();
    const flatInit = flattenTree(initialItems);
    flatInit.forEach((i) => initMap.set(i.id, i));

    const flatCurr = flattenTree(menu.items);
    const currMap = new Map<number, MenuItem>();
    flatCurr.forEach((i) => currMap.set(i.id, i));

    for (const [id, cur] of currMap) {
      const init = initMap.get(id);
      if (!init) result.push({ type: "add", item: cur });
      else if (init.title !== cur.title || init.url !== cur.url || init.parent_id !== cur.parent_id || init.position !== cur.position) {
        result.push({ type: "update", item: cur });
      }
    }
    for (const [id, init] of initMap) {
      if (!currMap.has(id)) result.push({ type: "delete", item: init });
    }
    return result;
  }, [menu.items, initialItems]);

  /* ── Save ──────────────────────────────────────────── */
  const handleSave = async () => {
    if (changes.length === 0) return showToast("无变更需要保存");
    setSaving(true);

    if (isDemo) {
      _setInitialItems(JSON.parse(JSON.stringify(menu.items)));
      showToast("演示模式：菜单修改已本地生效");
      setSaving(false);
      return;
    }

    let ok = 0, fail = 0;
    for (const ch of changes) {
      try {
        const res = await fetch("/api/shopify/dashboard", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateMenu",
            shopUrl, accessToken,
            menuId: menu.id,
            changeType: ch.type,
            itemId: ch.item.id,
            itemData: ch.type !== "delete" ? { ...ch.item, children: undefined } : undefined,
          }),
        });
        if ((await res.json()).success) ok++; else fail++;
      } catch { fail++; }
    }
    if (ok > 0) _setInitialItems(JSON.parse(JSON.stringify(menu.items)));
    showToast(`已保存：成功 ${ok} 项${fail > 0 ? `，失败 ${fail} 项` : ""}`);
    setSaving(false);
  };

  const handleCancel = () => {
    setMenu({ ...menu, items: JSON.parse(JSON.stringify(initialItems)) });
    showToast("已恢复原始状态");
  };

  /* ── Add/Edit/Delete ──────────────────────────────── */
  const handleAddItem = (parentId?: number) => {
    setModalItem({ id: 0, title: "", url: "/", type: "frontpage", parent_id: parentId, position: 0 });
  };

  const handleEditItem = (item: MenuItem) => setModalItem(item);

  const handleDeleteItem = (id: number) => {
    setMenu((prev) => ({ ...prev, items: removeFromTree(prev.items, id) }));
    showToast("菜单项已删除");
  };

  const handleModalSave = (data: Partial<MenuItem>) => {
    if (modalItem && modalItem.id > 0) {
      // Update
      setMenu((prev) => {
        const update = (items: MenuItem[]): MenuItem[] => items.map((i) => {
          if (i.id === modalItem.id) return { ...i, ...data, children: i.children };
          if (i.children) return { ...i, children: update(i.children) };
          return i;
        });
        return { ...prev, items: update(prev.items) };
      });
    } else {
      // Add new
      const newId = maxId(menu.items) + 1;
      const newItem: MenuItem = {
        id: newId, title: data.title || "新项目", url: data.url || "/", type: data.type || "frontpage",
        parent_id: data.parent_id, position: 99,
      };
      if (data.parent_id) {
        setMenu((prev) => {
          const addChild = (items: MenuItem[]): MenuItem[] => items.map((i) => {
            if (i.id === data.parent_id) return { ...i, children: [...(i.children || []), newItem] };
            if (i.children) return { ...i, children: addChild(i.children) };
            return i;
          });
          return { ...prev, items: addChild(prev.items) };
        });
      } else {
        setMenu((prev) => ({ ...prev, items: [...prev.items, newItem] }));
      }
    }
    setModalItem(null);
    showToast(isDemo ? "演示模式：已本地更新" : "已更新");
  };

  /* ── Drag & Drop ──────────────────────────────────── */
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnItem = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (draggedId === targetId) return;
    // Make dragged item a child of target
    setMenu((prev) => {
      let draggedItem: MenuItem | undefined;
      const removeFromList = (items: MenuItem[]): MenuItem[] => items.filter((i) => {
        if (i.id === draggedId) { draggedItem = { ...i, children: i.children, parent_id: targetId }; return false; }
        if (i.children) i.children = removeFromList(i.children);
        return true;
      });
      const newItems = removeFromList([...prev.items]);
      if (!draggedItem) return prev;
      const addTo = (items: MenuItem[]): MenuItem[] => items.map((i) => {
        if (i.id === targetId) return { ...i, children: [...(i.children || []), draggedItem!] };
        if (i.children) return { ...i, children: addTo(i.children) };
        return i;
      });
      return { ...prev, items: addTo(newItems) };
    });
    showToast("菜单层级已调整");
  };

  const handleDropToRoot = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    setMenu((prev) => {
      let draggedItem: MenuItem | undefined;
      const removeFromList = (items: MenuItem[]): MenuItem[] => items.filter((i) => {
        if (i.id === draggedId) { draggedItem = { ...i, children: i.children, parent_id: undefined }; return false; }
        if (i.children) i.children = removeFromList(i.children);
        return true;
      });
      if (!draggedItem) return prev;
      return { ...prev, items: [...removeFromList([...prev.items]), draggedItem] };
    });
    showToast("已移至顶级菜单");
  };

  /* ── Render tree items ─────────────────────────────── */
  const renderItems = (items: MenuItem[], level: number): React.ReactNode => items.map((item, idx) => (
    <div key={item.id}>
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDropOnItem(e, item.id)}
        className="flex items-center gap-1.5 py-2 px-2 rounded cursor-grab active:cursor-grabbing hover:bg-muted/20 group transition-colors"
        style={{ paddingLeft: 16 + level * 24 }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        {(item.children && item.children.length > 0) ? (
          <button onClick={() => toggleExpand(item.id)} className="shrink-0">{expanded.has(item.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}</button>
        ) : (
          <div className="w-3.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm text-foreground truncate">{item.title}</span>
          <span className="text-[10px] text-emerald-400/70 font-mono truncate">→ {item.url}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => handleEditItem(item)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/30"><Edit3 className="h-3 w-3 text-muted-foreground" /></button>
          <button onClick={() => handleDeleteItem(item.id)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-500/20"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" /></button>
        </div>
      </div>
      {(item.children && item.children.length > 0 && expanded.has(item.id)) && renderItems(item.children, level + 1)}
    </div>
  ));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Menu className="h-6 w-6 text-sky-400" />导航菜单编辑</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {menu.items.length} 个顶级项{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* Change summary */}
      {changes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">未保存的变更：新增 {changes.filter((c) => c.type === "add").length} 项，修改 {changes.filter((c) => c.type === "update").length} 项，删除 {changes.filter((c) => c.type === "delete").length} 项</span>
        </div>
      )}

      {/* Menu tree */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{menu.title}</CardTitle>
            <CardDescription className="text-[10px]">{menu.handle}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={changes.length === 0 || saving} className="h-8 gap-1 text-xs"><RotateCcw className="h-3 w-3" />取消</Button>
            <Button size="sm" onClick={handleSave} disabled={changes.length === 0 || saving} className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}保存{changes.length > 0 ? ` (${changes.length} 项)` : ""}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Tree items */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropToRoot}
            className="min-h-[200px] py-1"
          >
            {renderItems(menu.items, 0)}
            {menu.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16">
                <Menu className="h-10 w-10 text-muted-foreground/25" />
                <p className="text-xs text-muted-foreground">菜单为空</p>
              </div>
            )}
          </div>

          {/* Add menu item bar */}
          <div className="flex items-center gap-2 border-t border-border/20 px-4 py-2">
            <Button size="sm" variant="ghost" onClick={() => handleAddItem()} className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3 w-3" />添加顶级菜单项
            </Button>
            <span className="text-[10px] text-muted-foreground/50">拖拽到其他项目上可设为子菜单</span>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {modalItem && (
        <ItemModal
          item={modalItem.id > 0 ? modalItem : null}
          items={flattenTree(menu.items).map(({ level: _, ...rest }) => rest)}
          onSave={handleModalSave}
          onCancel={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
