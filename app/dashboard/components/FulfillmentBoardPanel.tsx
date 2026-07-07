"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Filter,
  X,
  ArrowUpDown,
  ClipboardList,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny, formatTimeAgo } from "../helpers";
import { EXCHANGE_RATE } from "../config";

// ─── Types ────────────────────────────────────────────

interface FulfillmentLineItem {
  id: number;
  product_id?: number;
  name: string;
  quantity: number;
  price?: string;
}

interface BoardOrder {
  id: number;
  order_number: string;
  customer_name: string;
  total_price: number;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  country_code: string;
  line_items: FulfillmentLineItem[];
  item_count: number;
  tags: string[];
  gateway?: string;
  tracking_number?: string;
  tracking_company?: string;
  shop_name?: string;
}

type FulfillmentColumn = "unfulfilled" | "partial" | "fulfilled";

interface FulfillmentBoardPanelProps {
  orders: BoardOrder[];
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
}

// ─── Constants ────────────────────────────────────────

const COLUMN_META: Record<FulfillmentColumn, { title: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  unfulfilled: { title: "待履约", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
  partial: { title: "部分履约", color: "text-sky-400", bg: "bg-sky-500/10", icon: Package },
  fulfilled: { title: "已履约", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
};

const TRACKING_COMPANIES = ["USPS", "UPS", "FedEx", "DHL", "顺丰国际", "云途物流", "燕文物流", "递四方", "4PX", "万邑通"];

const FINANCIAL_MAP: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  refunded: "bg-red-500/15 text-red-400",
  cancelled: "bg-zinc-500/15 text-zinc-400",
};

function countryFlag(code: string): string {
  if (!code) return "🌐";
  const base = "A".charCodeAt(0);
  const a = code.toUpperCase().charCodeAt(0) - base;
  const b = code.toUpperCase().charCodeAt(1) - base;
  return String.fromCodePoint(0x1F1E6 + a) + String.fromCodePoint(0x1F1E6 + b);
}

function groupByColumn(orders: BoardOrder[]): Record<FulfillmentColumn, BoardOrder[]> {
  const groups: Record<FulfillmentColumn, BoardOrder[]> = { unfulfilled: [], partial: [], fulfilled: [] };
  for (const o of orders) {
    if (o.fulfillment_status === "fulfilled") groups.fulfilled.push(o);
    else if (o.fulfillment_status === "partial") groups.partial.push(o);
    else groups.unfulfilled.push(o);
  }
  return groups;
}

function isOverdue(o: BoardOrder): boolean {
  return (Date.now() - new Date(o.created_at).getTime()) > 24 * 60 * 60 * 1000;
}

// ─── Fulfillment Modal ────────────────────────────────

function FulfillmentModal({
  order,
  onConfirm,
  onCancel,
  isDemo,
  saving,
}: {
  order: BoardOrder;
  onConfirm: (data: { trackingNumber: string; trackingCompany: string; notify: boolean; note: string; lineItemIds?: number[] }) => void;
  onCancel: () => void;
  isDemo: boolean;
  saving: boolean;
}) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCompany, setTrackingCompany] = useState("");
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [showLineItems, setShowLineItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!trackingNumber.trim()) return;
    onConfirm({
      trackingNumber: trackingNumber.trim(),
      trackingCompany: trackingCompany || "USPS",
      notify,
      note: note.trim(),
      lineItemIds: showLineItems ? Array.from(selectedItems) : undefined,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
            <h3 className="text-base font-semibold text-foreground">确认履约 — {order.order_number}</h3>
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-9 w-8 p-0"><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">物流单号 *</label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="输入追踪单号..." className="h-9 mt-1 text-sm" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">物流公司</label>
              <select value={trackingCompany} onChange={(e) => setTrackingCompany(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border/40 bg-background px-3 text-base text-foreground">
                <option value="">选择物流公司...</option>
                {TRACKING_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-base text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={notify} onChange={() => setNotify(!notify)} className="accent-emerald-500" />
              通知客户发货信息
            </label>
            {order.line_items.length > 1 && (
              <label className="flex items-center gap-2 text-base text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showLineItems} onChange={() => setShowLineItems(!showLineItems)} className="accent-sky-500" />
                部分履约（仅发货选中的商品）
              </label>
            )}
            {showLineItems && (
              <div className="space-y-1 rounded-lg border border-border/20 bg-muted/10 p-2 max-h-36 overflow-y-auto">
                {order.line_items.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/20 rounded px-1 py-0.5">
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItem(item.id)} className="accent-sky-500" />
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground ml-auto">×{item.quantity}</span>
                  </label>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">备注</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="发货备注（可选）..." rows={2} className="mt-1 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none" />
            </div>
            {isDemo && (
              <p className="text-xs text-amber-400">演示模式：履约操作将模拟本地状态更新</p>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border/20 px-5 py-3">
            <Button onClick={handleSubmit} disabled={!trackingNumber.trim() || saving} className="flex-1 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {saving ? "提交中..." : "确认发货"}
            </Button>
            <Button variant="outline" onClick={onCancel} className="h-9">取消</Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Order Card ───────────────────────────────────────

function OrderCard({
  order,
  onDragStart,
  onContextAction,
}: {
  order: BoardOrder;
  onDragStart: (e: React.DragEvent) => void;
  onContextAction: (action: string, order: BoardOrder) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = isOverdue(order);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onContextAction("detail", order)}
      className={`relative rounded-lg border px-3 py-2.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg bg-card/80 border-border/30 hover:border-border/50 ${overdue && order.fulfillment_status !== "fulfilled" ? "border-l-2 border-l-red-500" : "border-l-2 border-l-transparent"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-emerald-400 truncate">{order.order_number}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{order.customer_name}</p>
        </div>
        {/* Three-dot menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/20">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-border/30 bg-card px-1 py-1 shadow-xl backdrop-blur-lg w-32">
                {["detail", "fulfill", "cancel"].map((a) => (
                  <button key={a} onClick={() => { setMenuOpen(false); onContextAction(a, order); }} className="block w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded">
                    {a === "detail" ? "查看详情" : a === "fulfill" ? "标记发货" : "取消订单"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-base font-semibold text-foreground">{formatCny(order.total_price * EXCHANGE_RATE)}</span>
        <span className="text-xs text-muted-foreground">{order.currency}</span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <Badge className={"text-[9px] px-1 py-0 " + (FINANCIAL_MAP[order.financial_status] ?? "bg-zinc-500/15 text-zinc-400")}>
            {order.financial_status === "paid" ? "已付" : order.financial_status}
          </Badge>
          <span className="text-[9px] text-muted-foreground">{order.item_count} 件</span>
        </div>
        <div className="flex items-center gap-1">
          {order.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 border-border/30 text-muted-foreground">{t}</Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/10">
        <span className="text-sm">{countryFlag(order.country_code)}</span>
        <span className="text-xs text-muted-foreground">{order.country_code}</span>
        <span className="ml-auto text-xs text-muted-foreground/60">{formatTimeAgo(order.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────

function Column({
  col,
  orders,
  search,
  sort,
  setSearch,
  setSort,
  onDragOver,
  onDrop,
  onDragStart,
  onContextAction,
  collapsed,
  setCollapsed,
}: {
  col: FulfillmentColumn;
  orders: BoardOrder[];
  search: string;
  sort: string;
  setSearch: (v: string) => void;
  setSort: (v: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, col: FulfillmentColumn) => void;
  onDragStart: (order: BoardOrder) => (e: React.DragEvent) => void;
  onContextAction: (action: string, order: BoardOrder) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const meta = COLUMN_META[col];
  const filtered = useMemo(() => {
    let list = [...orders];
    if (search) {
      const kw = search.toLowerCase();
      list = list.filter((o) => o.order_number.toLowerCase().includes(kw) || o.customer_name.toLowerCase().includes(kw));
    }
    if (sort === "time-asc") list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === "time-desc") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "amount-desc") list.sort((a, b) => b.total_price - a.total_price);
    else if (sort === "amount-asc") list.sort((a, b) => a.total_price - b.total_price);
    return list;
  }, [orders, search, sort]);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, col)}
      className="flex flex-col rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm min-h-0 flex-1"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/10 shrink-0">
        <meta.icon className={`h-4 w-4 ${meta.color}`} />
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.title}</span>
        <Badge className={`text-xs px-1.5 py-0 ${meta.bg} ${meta.color}`}>{orders.length}</Badge>
        <button className="ml-auto lg:hidden" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </button>
        <div className="hidden lg:flex items-center gap-1 ml-auto">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-6 rounded border border-border/30 bg-background text-xs text-muted-foreground px-1">
            <option value="time-desc">最新</option>
            <option value="time-asc">最早</option>
            <option value="amount-desc">金额↓</option>
            <option value="amount-asc">金额↑</option>
          </select>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="px-3 py-1.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..." className="h-7 pl-7 text-sm" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5 custom-scrollbar">
            {filtered.map((o) => (
              <OrderCard key={o.id} order={o} onDragStart={onDragStart(o)} onContextAction={onContextAction} />
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-8">
                <Package className="h-6 w-6 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">暂无订单</p>
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 text-xs text-muted-foreground/60 border-t border-border/10 shrink-0">
            显示 {filtered.length} / 共 {orders.length} 单
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

export default function FulfillmentBoardPanel({
  orders,
  isDemo,
  shopUrl,
  accessToken,
  shopName,
}: FulfillmentBoardPanelProps) {
  const [boardOrders, setBoardOrders] = useState<BoardOrder[]>(() =>
    orders.map((o) => ({ ...o, tags: o.tags ?? [], country_code: o.country_code || "", customer_name: o.customer_name || "客户", item_count: o.item_count ?? o.line_items?.length ?? 1 }))
  );

  // Global filters
  const [timeFilter, setTimeFilter] = useState("all");
  const [paidOnly, setPaidOnly] = useState(true);

  // Column state
  const [colSearches, setColSearches] = useState<Record<string, string>>({});
  const [colSorts, setColSorts] = useState<Record<string, string>>({ unfulfilled: "time-desc", partial: "time-desc", fulfilled: "time-desc" });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Fulfillment modal
  const [fulfillOrder, setFulfillOrder] = useState<BoardOrder | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag
  const dragOrderRef = useRef<BoardOrder | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Filter orders
  const filteredOrders = useMemo(() => {
    let list = [...boardOrders];
    if (paidOnly) list = list.filter((o) => o.financial_status === "paid");
    if (timeFilter !== "all") {
      const cutoff = Date.now() - ({ today: 1, yesterday: 2, "3d": 3, "7d": 7 }[timeFilter] ?? 0) * 86400000;
      list = list.filter((o) => new Date(o.created_at).getTime() > cutoff);
    }
    return list;
  }, [boardOrders, paidOnly, timeFilter]);

  const grouped = useMemo(() => groupByColumn(filteredOrders), [filteredOrders]);

  // KPI
  const kpi = useMemo(() => {
    const avgFulfillHours = grouped.fulfilled.length > 0
      ? grouped.fulfilled.reduce((s, o) => s + (Date.now() - new Date(o.created_at).getTime()) / 3600000, 0) / grouped.fulfilled.length
      : 0;
    return {
      unfulfilled: grouped.unfulfilled.length,
      todayFulfilled: grouped.fulfilled.filter((o) => (Date.now() - new Date(o.created_at).getTime()) < 86400000).length,
      overdue: grouped.unfulfilled.filter(isOverdue).length,
      avgFulfillHours: Math.round(avgFulfillHours * 10) / 10,
    };
  }, [grouped]);

  // Drag handlers
  const handleDragStart = (order: BoardOrder) => (e: React.DragEvent) => {
    dragOrderRef.current = order;
    e.dataTransfer.setData("text/plain", String(order.id));
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "0.5";
    setTimeout(() => { el.style.opacity = "1"; }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetCol: FulfillmentColumn) => {
    e.preventDefault();
    const orderId = Number(e.dataTransfer.getData("text/plain"));
    const order = boardOrders.find((o) => o.id === orderId);
    if (!order) return;

    // Determine current column
    let currentCol: FulfillmentColumn = "unfulfilled";
    if (order.fulfillment_status === "fulfilled") currentCol = "fulfilled";
    else if (order.fulfillment_status === "partial") currentCol = "partial";
    if (currentCol === targetCol) return; // same column, no-op

    // If dragging to fulfilled → open modal
    if (targetCol === "fulfilled") {
      setFulfillOrder(order);
      return;
    }

    // To partial → only if has multiple line items
    if (targetCol === "partial" && order.line_items.length <= 1) {
      showToast("单商品订单无法部分履约，请拖入已履约列");
      return;
    }

    // To unfulfilled → only if currently partial
    if (targetCol === "unfulfilled" && currentCol !== "partial") return;

    // Direct move for partial/unfulfilled
    moveOrder(orderId, targetCol);
  };

  const moveOrder = (orderId: number, targetCol: FulfillmentColumn) => {
    const newStatus = targetCol === "unfulfilled" ? null : targetCol === "partial" ? "partial" : "fulfilled";
    setBoardOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, fulfillment_status: newStatus as string | null } : o));
    showToast(isDemo ? "演示模式：订单已移动" : "订单状态已更新");
  };

  const handleFulfillConfirm = useCallback(async (data: { trackingNumber: string; trackingCompany: string; notify: boolean; note: string; lineItemIds?: number[] }) => {
    if (!fulfillOrder) return;
    setSaving(true);

    if (isDemo) {
      setBoardOrders((prev) => prev.map((o) =>
        o.id === fulfillOrder.id
          ? { ...o, fulfillment_status: "fulfilled", tracking_number: data.trackingNumber, tracking_company: data.trackingCompany }
          : o
      ));
      showToast("演示模式：履约操作已模拟");
      setSaving(false);
      setFulfillOrder(null);
      return;
    }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createFulfillment",
          shopUrl,
          accessToken,
          orderId: fulfillOrder.id,
          trackingNumber: data.trackingNumber,
          trackingCompany: data.trackingCompany,
          notifyCustomer: data.notify,
          lineItemIds: data.lineItemIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBoardOrders((prev) => prev.map((o) =>
          o.id === fulfillOrder.id
            ? { ...o, fulfillment_status: "fulfilled", tracking_number: data.trackingNumber, tracking_company: data.trackingCompany }
            : o
        ));
        showToast(fulfillOrder.order_number + " 已履约");
      } else {
        showToast("履约失败: " + (json.error || "未知错误"));
      }
    } catch {
      showToast("网络错误，请重试");
    } finally {
      setSaving(false);
      setFulfillOrder(null);
    }
  }, [fulfillOrder, isDemo, shopUrl, accessToken]);

  const handleContextAction = (action: string, order: BoardOrder) => {
    if (action === "fulfill") setFulfillOrder(order);
    else if (action === "cancel") {
      setBoardOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, fulfillment_status: null } : o));
      showToast(order.order_number + " 已退回待履约");
    }
  };

  const timeLabels: Record<string, string> = { all: "全部时间", today: "今天", yesterday: "昨天", "3d": "近 3 天", "7d": "近 7 天" };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <ClipboardList className="h-6 w-6 text-sky-400" />
            履约看板
          </h2>
          <p className="mt-1 text-base text-muted-foreground">{shopName} · Trello 式拖拽管理履约进度{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[{ label: "待履约", value: kpi.unfulfilled, icon: Clock, color: "text-amber-400 bg-amber-500/10" },
          { label: "今日已履约", value: kpi.todayFulfilled, icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10" },
          { label: "超时未履约 (>24h)", value: kpi.overdue, icon: AlertTriangle, color: "text-red-400 bg-red-500/10" },
          { label: "平均履约时长", value: kpi.avgFulfillHours + "h", icon: Truck, color: "text-sky-400 bg-sky-500/10" },
        ].map((k) => (
          <Card key={k.label} className="border-border/40 bg-card/60 backdrop-blur-lg">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={"flex h-9 w-9 items-center justify-center rounded-lg " + k.color}><k.icon className="h-4 w-4" /></div>
              <div><p className="text-lg font-bold text-foreground tabular-nums">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground"><Filter className="h-3 w-3 inline mr-1" />筛选:</span>
        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="h-7 rounded border border-border/40 bg-background px-2 text-xs text-foreground">
          {Object.entries(timeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={paidOnly} onChange={() => setPaidOnly(!paidOnly)} className="accent-emerald-500" />仅已付款
        </label>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-col lg:flex-row gap-3" style={{ height: "calc(100vh - 300px)", minHeight: "420px" }}>
        {(Object.keys(grouped) as FulfillmentColumn[]).map((col) => (
          <Column
            key={col}
            col={col}
            orders={grouped[col]}
            search={colSearches[col] ?? ""}
            sort={colSorts[col] ?? ""}
            setSearch={(v) => setColSearches((p) => ({ ...p, [col]: v }))}
            setSort={(v) => setColSorts((p) => ({ ...p, [col]: v }))}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onContextAction={handleContextAction}
            collapsed={collapsed[col] ?? false}
            setCollapsed={(v) => setCollapsed((p) => ({ ...p, [col]: v }))}
          />
        ))}
      </div>

      {/* Fulfillment Modal */}
      {fulfillOrder && (
        <FulfillmentModal
          order={fulfillOrder}
          onConfirm={handleFulfillConfirm}
          onCancel={() => setFulfillOrder(null)}
          isDemo={isDemo}
          saving={saving}
        />
      )}
    </div>
  );
}
