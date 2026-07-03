"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Package,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Eye,
  Tag,
  Truck,
  Archive,
  Ban,
  MoreHorizontal,
  ShoppingBag,
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  Globe,
  Hash,
  Layers,
  AlertCircle,
  Loader2,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny, formatTimeAgo } from "../helpers";
import OrderTags from "./OrderTags";

// ─── Types ────────────────────────────────────────────

interface OrderAddress {
  name: string;
  address1: string;
  city: string;
  country: string;
  zip?: string;
}

interface OrderCustomer {
  name: string;
  email: string;
  phone?: string;
}

interface OrderLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
}

interface OrderItem {
  id: number;
  orderNumber: string;
  customer: OrderCustomer;
  totalPrice: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  createdAt: string;
  shippingAddress: OrderAddress;
  lineItems: OrderLineItem[];
  itemCount: number;
  tags: string[];
  note: string;
  gateway: string;
  countryCode: string;
}

type ColumnKey =
  | "orderNumber"
  | "customer"
  | "amount"
  | "currency"
  | "financialStatus"
  | "fulfillmentStatus"
  | "createdAt"
  | "country"
  | "itemCount"
  | "tags"
  | "gateway";

const ALL_COLUMNS: ColumnKey[] = [
  "orderNumber",
  "customer",
  "amount",
  "currency",
  "financialStatus",
  "fulfillmentStatus",
  "createdAt",
  "country",
  "itemCount",
  "tags",
  "gateway",
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  orderNumber: "订单号",
  customer: "客户",
  amount: "金额(¥)",
  currency: "币种",
  financialStatus: "支付状态",
  fulfillmentStatus: "履约状态",
  createdAt: "时间",
  country: "国家",
  itemCount: "商品数",
  tags: "标签",
  gateway: "网关",
};

const PAGE_SIZE = 20;

// ─── Demo data generator ──────────────────────────────

function generateDemoOrders(count: number): OrderItem[] {
  const currencies = ["USD", "EUR", "CAD", "GBP"];
  const gateways = ["Stripe", "PayPal", "Shopify Payments", "Stripe"];
  const countries = ["US", "GB", "CA", "DE", "FR", "AU", "JP", "BR", "MX", "IT"];
  const statuses = ["paid", "paid", "paid", "paid", "pending", "refunded", "cancelled"];
  const fulStatuses = ["fulfilled", "fulfilled", "fulfilled", "in_transit", null, null];
  const names = ["Alex Chen", "Sarah Kim", "Mike Johnson", "Emma Wilson", "Liam Brown", "Olivia Smith", "Noah Davis", "Ava Martinez", "James Lee", "Isabella Taylor"];
  const productNames = ["无线降噪耳机", "碳纤维手表", "北欧台灯", "亚麻抱枕", "手工咖啡杯", "机械键盘", "羊毛地毯", "智能手表", "蓝牙音箱", "充电数据线"];
  const tagPool = ["VIP", "大促", "新客", "批发", "急单", "加急", "", "", ""];

  return Array.from({ length: count }, (_, i) => {
    const lineCount = 1 + Math.floor(Math.random() * 3);
    const currency = currencies[Math.floor(Math.random() * currencies.length)];
    const price = 19 + Math.random() * 250;
    const days = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

    const tags: string[] = [];
    const t = tagPool[Math.floor(Math.random() * tagPool.length)];
    if (t) tags.push(t);
    if (Math.random() < 0.25) tags.push("国际");

    return {
      id: 20000 + i,
      orderNumber: "#" + (10800 + i * 31),
      customer: {
        name: names[i % names.length],
        email: "order" + i + "@email.com",
        phone: Math.random() < 0.6 ? "+1 (555) " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(1000 + Math.random() * 9000) : undefined,
      },
      totalPrice: Math.round(price * 100) / 100,
      currency,
      financialStatus: statuses[Math.floor(Math.random() * statuses.length)],
      fulfillmentStatus: fulStatuses[Math.floor(Math.random() * fulStatuses.length)],
      createdAt: date.toISOString(),
      shippingAddress: {
        name: names[i % names.length],
        address1: (100 + Math.floor(Math.random() * 900)) + " Main St",
        city: "City " + (i % 10),
        country: countries[i % countries.length],
        zip: String(10000 + Math.floor(Math.random() * 90000)),
      },
      lineItems: Array.from({ length: lineCount }, (_, j) => ({
        id: 30000 + i * 10 + j,
        title: productNames[(i + j) % productNames.length],
        quantity: 1 + Math.floor(Math.random() * 3),
        price: String(Math.round((10 + Math.random() * 80) * 100) / 100),
        sku: "SKU-" + (200 + i * 10 + j),
      })),
      itemCount: lineCount,
      tags,
      note: Math.random() < 0.2 ? "客户备注：请用礼盒包装" : "",
      gateway: gateways[Math.floor(Math.random() * gateways.length)],
      countryCode: countries[i % countries.length],
    };
  });
}

// ─── Status badges ──────────────────────────────────

const FINANCIAL_STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  paid: { label: "已付款", cls: "bg-emerald-500/15 text-emerald-400", icon: "✓" },
  pending: { label: "待付款", cls: "bg-amber-500/15 text-amber-400", icon: "⏳" },
  refunded: { label: "已退款", cls: "bg-red-500/15 text-red-400", icon: "↩" },
  cancelled: { label: "已取消", cls: "bg-zinc-500/15 text-zinc-400", icon: "✕" },
};

const FULFILLMENT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  fulfilled: { label: "已发货", cls: "bg-sky-500/15 text-sky-400" },
  in_transit: { label: "运输中", cls: "bg-purple-500/15 text-purple-400" },
  partial: { label: "部分发货", cls: "bg-amber-500/15 text-amber-400" },
};

function FulfillmentBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">未处理</span>;
  const m = FULFILLMENT_STATUS_MAP[status];
  if (!m) return <span className="text-xs text-muted-foreground">{status}</span>;
  return <Badge className={"text-[10px] px-1.5 py-0 " + m.cls}>{m.label}</Badge>;
}

// ─── Pagination ──────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-xs text-muted-foreground">
        第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4));
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <Button
              key={p}
              size="sm"
              variant={p === page ? "default" : "outline"}
              onClick={() => onPage(p)}
              className={"h-8 w-8 p-0 text-xs " + (p === page ? "bg-emerald-600 hover:bg-emerald-500" : "")}
            >
              {p}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

interface OrderCenterPanelProps {
  orders?: OrderItem[];
  isDemo: boolean;
  shopName: string;
  shopUrl: string;
  accessToken: string;
  loading?: boolean;
}

export default function OrderCenterPanel({
  orders: rawOrders,
  isDemo,
  shopName,
  shopUrl,
  accessToken,
  loading = false,
}: OrderCenterPanelProps) {
  // Demo data
  const demoOrders = useMemo(() => generateDemoOrders(73), []);
  const allOrders: OrderItem[] = useMemo(
    () => (isDemo ? demoOrders : rawOrders ?? []),
    [isDemo, demoOrders, rawOrders],
  );

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFulfillment, setFilterFulfillment] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  // Columns
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(["orderNumber", "customer", "amount", "financialStatus", "fulfillmentStatus", "createdAt", "country", "itemCount"]),
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Detail Sheet
  const [detailOrder, setDetailOrder] = useState<OrderItem | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "items" | "timeline" | "tags">("info");
  const [orderTagsMap, setOrderTagsMap] = useState<Record<number, string[]>>({});
  const [orderNoteMap, setOrderNoteMap] = useState<Record<number, string>>({});

  // Pagination
  const [page, setPage] = useState(1);

  // ── Filter logic ──
  const filtered = useMemo(() => {
    return allOrders.filter((o) => {
      if (filterStatus !== "all" && o.financialStatus !== filterStatus) return false;
      if (filterFulfillment !== "all") {
        if (filterFulfillment === "unfulfilled" && o.fulfillmentStatus) return false;
        if (filterFulfillment !== "unfulfilled" && o.fulfillmentStatus !== filterFulfillment) return false;
      }
      if (filterCountry !== "all" && o.countryCode !== filterCountry) return false;
      if (filterKeyword) {
        const kw = filterKeyword.toLowerCase();
        if (
          !o.orderNumber.toLowerCase().includes(kw) &&
          !o.customer.name.toLowerCase().includes(kw) &&
          !o.lineItems.some((li) => li.title.toLowerCase().includes(kw))
        ) return false;
      }
      if (dateFrom && o.createdAt < dateFrom) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(o.createdAt) >= to) return false;
      }
      if (amountMin && o.totalPrice < parseFloat(amountMin)) return false;
      if (amountMax && o.totalPrice > parseFloat(amountMax)) return false;
      return true;
    });
  }, [allOrders, filterStatus, filterFulfillment, filterCountry, filterKeyword, dateFrom, dateTo, amountMin, amountMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // When filters change, reset page
  const prevFilterRef = useRef("");
  const filterFingerprint = [filterStatus, filterFulfillment, filterCountry, filterKeyword, dateFrom, dateTo, amountMin, amountMax].join("|");
  if (filterFingerprint !== prevFilterRef.current) {
    prevFilterRef.current = filterFingerprint;
    if (page !== 1) setPage(1);
  }

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllPage = () => {
    setSelectedIds(new Set(pagedOrders.map((o) => o.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  // CSV export
  const exportCSV = () => {
    const rows = (selectedIds.size > 0 ? filtered.filter((o) => selectedIds.has(o.id)) : filtered).map((o) => [
      o.orderNumber,
      o.customer.name,
      String(o.totalPrice),
      o.currency,
      FINANCIAL_STATUS_MAP[o.financialStatus]?.label ?? o.financialStatus,
      o.fulfillmentStatus ? FULFILLMENT_STATUS_MAP[o.fulfillmentStatus]?.label ?? o.fulfillmentStatus : "未处理",
      new Date(o.createdAt).toLocaleString("zh-CN"),
      o.countryCode,
      String(o.itemCount),
      o.tags.join(","),
      o.gateway,
    ]);
    const headers = ["订单号", "客户", "金额", "币种", "支付状态", "履约状态", "下单时间", "国家", "商品数", "标签", "网关"];
    const bom = "\uFEFF";
    const csv = bom + [headers, ...rows].map((r) => r.map((c) => '"' + c + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "订单管理中心_" + shopName + "_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Column toggle
  const toggleColumn = (col: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  };

  // Countries for dropdown
  const countries = useMemo(
    () => [...new Set(allOrders.map((o) => o.countryCode))].sort(),
    [allOrders],
  );

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 animate-pulse rounded bg-muted/30" />
          <div className="h-7 w-20 animate-pulse rounded bg-muted/30" />
        </div>
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 w-4 rounded bg-muted/30" />
                <div className="h-4 w-24 rounded bg-muted/30" />
                <div className="h-4 w-32 rounded bg-muted/20 flex-1" />
                <div className="h-4 w-16 rounded bg-muted/30" />
                <div className="h-5 w-14 rounded bg-muted/20" />
                <div className="h-5 w-16 rounded bg-muted/30" />
                <div className="h-4 w-20 rounded bg-muted/20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <ShoppingBag className="h-6 w-6 text-emerald-400" />
            订单管理中心
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {shopName} · 共 {filtered.length} 笔订单
            {isDemo && <span className="ml-2 text-xs text-amber-400">(演示数据)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setColMenuOpen(!colMenuOpen)}
              className="h-9 gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />列显示
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
            {colMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-border/40 bg-card p-2 shadow-xl backdrop-blur-lg w-40">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/20 rounded text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col)}
                        onChange={() => toggleColumn(col)}
                        className="accent-emerald-500"
                      />
                      <span className="text-foreground">{COLUMN_LABELS[col]}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            导出{selectedIds.size > 0 ? "选中" : "全部"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded border border-border/40 bg-background px-2 text-xs text-foreground"
          >
            <option value="all">全部状态</option>
            <option value="paid">已付款</option>
            <option value="pending">待付款</option>
            <option value="refunded">已退款</option>
            <option value="cancelled">已取消</option>
          </select>

          <select
            value={filterFulfillment}
            onChange={(e) => setFilterFulfillment(e.target.value)}
            className="h-8 rounded border border-border/40 bg-background px-2 text-xs text-foreground"
          >
            <option value="all">全部履约</option>
            <option value="fulfilled">已发货</option>
            <option value="in_transit">运输中</option>
            <option value="unfulfilled">未处理</option>
          </select>

          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="h-8 rounded border border-border/40 bg-background px-2 text-xs text-foreground"
          >
            <option value="all">全部国家</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-34 text-xs"
            placeholder="开始日期"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-34 text-xs"
            placeholder="结束日期"
          />

          <Input
            type="number"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder="¥最低"
            className="h-8 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="number"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder="¥最高"
            className="h-8 w-20 text-xs"
          />

          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="搜索订单号/客户/商品..."
              className="h-8 pl-7 text-xs"
            />
          </div>

          {(filterStatus !== "all" || filterFulfillment !== "all" || filterCountry !== "all" || filterKeyword || dateFrom || dateTo || amountMin || amountMax) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setFilterStatus("all");
                setFilterFulfillment("all");
                setFilterCountry("all");
                setFilterKeyword("");
                setDateFrom("");
                setDateTo("");
                setAmountMin("");
                setAmountMax("");
              }}
            >
              <X className="h-3 w-3" />清除筛选
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Batch bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-30 -mx-1 flex items-center gap-2 rounded-lg border border-border/40 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
          <span className="text-sm font-medium text-foreground">已选 {selectedIds.size} 笔</span>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Truck className="h-3 w-3" />标记已发货</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Archive className="h-3 w-3" />归档</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Ban className="h-3 w-3" />取消订单</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Tag className="h-3 w-3" />添加标签</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs ml-auto" onClick={clearSelection}><X className="h-3 w-3" />取消选择</Button>
        </div>
      )}

      {/* Orders table */}
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardContent className="p-0">
          {pagedOrders.length > 0 ? (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="py-2.5 pl-4 pr-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={pagedOrders.length > 0 && pagedOrders.every((o) => selectedIds.has(o.id))}
                        onChange={() => pagedOrders.every((o) => selectedIds.has(o.id)) ? clearSelection() : selectAllPage()}
                        className="accent-emerald-500"
                      />
                    </th>
                    {visibleColumns.has("orderNumber") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">订单号</th>
                    )}
                    {visibleColumns.has("customer") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">客户</th>
                    )}
                    {visibleColumns.has("amount") && (
                      <th className="py-2.5 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">金额</th>
                    )}
                    {visibleColumns.has("currency") && (
                      <th className="py-2.5 px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">币种</th>
                    )}
                    {visibleColumns.has("financialStatus") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">支付</th>
                    )}
                    {visibleColumns.has("fulfillmentStatus") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">履约</th>
                    )}
                    {visibleColumns.has("createdAt") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">时间</th>
                    )}
                    {visibleColumns.has("country") && (
                      <th className="py-2.5 px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">国家</th>
                    )}
                    {visibleColumns.has("itemCount") && (
                      <th className="py-2.5 px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">商品</th>
                    )}
                    {visibleColumns.has("tags") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">标签</th>
                    )}
                    {visibleColumns.has("gateway") && (
                      <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">网关</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagedOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/10 transition-colors hover:bg-muted/10">
                      <td className="py-2.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="accent-emerald-500"
                        />
                      </td>
                      {visibleColumns.has("orderNumber") && (
                        <td className="py-2.5 px-2">
                          <button
                            onClick={() => { setDetailOrder(o); setDetailTab("info"); }}
                            className="text-xs font-mono font-medium text-emerald-400 hover:underline cursor-pointer"
                          >
                            {o.orderNumber}
                          </button>
                        </td>
                      )}
                      {visibleColumns.has("customer") && (
                        <td className="py-2.5 px-2 text-sm text-foreground">{o.customer.name}</td>
                      )}
                      {visibleColumns.has("amount") && (
                        <td className="py-2.5 px-2 text-right tabular-nums text-sm font-semibold text-emerald-400">
                          {formatCny(o.totalPrice * 7.25)}
                        </td>
                      )}
                      {visibleColumns.has("currency") && (
                        <td className="py-2.5 px-2 text-center text-xs text-muted-foreground">{o.currency}</td>
                      )}
                      {visibleColumns.has("financialStatus") && (
                        <td className="py-2.5 px-2">
                          {(FINANCIAL_STATUS_MAP[o.financialStatus] && (
                            <Badge className={"text-[10px] px-1.5 py-0 " + FINANCIAL_STATUS_MAP[o.financialStatus].cls}>
                              {FINANCIAL_STATUS_MAP[o.financialStatus].label}
                            </Badge>
                          )) || <span className="text-xs text-muted-foreground">{o.financialStatus}</span>}
                        </td>
                      )}
                      {visibleColumns.has("fulfillmentStatus") && (
                        <td className="py-2.5 px-2">
                          <FulfillmentBadge status={o.fulfillmentStatus} />
                        </td>
                      )}
                      {visibleColumns.has("createdAt") && (
                        <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      )}
                      {visibleColumns.has("country") && (
                        <td className="py-2.5 px-2 text-center">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground">
                            {o.countryCode}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.has("itemCount") && (
                        <td className="py-2.5 px-2 text-center text-xs text-muted-foreground">{o.itemCount}</td>
                      )}
                      {visibleColumns.has("tags") && (
                        <td className="py-2.5 px-2">
                          <div className="flex flex-wrap gap-1">
                            {o.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-[9px] px-1 py-0 border-border/30 text-muted-foreground">{t}</Badge>
                            ))}
                            {o.tags.length === 0 && <span className="text-xs text-muted-foreground/40">-</span>}
                          </div>
                        </td>
                      )}
                      {visibleColumns.has("gateway") && (
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{o.gateway}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 pb-3">
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <Inbox className="h-12 w-12 text-muted-foreground/25" />
              <p className="text-sm font-medium text-muted-foreground">暂无匹配的订单数据</p>
              <p className="text-xs text-muted-foreground/60">尝试调整筛选条件或查看其他状态</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      {detailOrder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setDetailOrder(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border/40 shadow-2xl overflow-y-auto">
            {/* Sheet Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-card/95 px-5 py-3 backdrop-blur-md">
              <div>
                <p className="text-sm font-semibold text-foreground">{detailOrder.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(detailOrder.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetailOrder(null)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/20 px-5">
              {(["info", "items", "timeline", "tags"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    detailTab === tab
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "info" ? "客户与支付" : tab === "items" ? "商品明细" : tab === "timeline" ? "履约时间线" : "标签与备注"}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {detailTab === "info" && (
                <>
                  {/* Customer */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">客户信息</p>
                    <div className="space-y-1.5 rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">{detailOrder.customer.name}</span></div>
                      <div className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{detailOrder.customer.email}</span></div>
                      {detailOrder.customer.phone && (
                        <div className="flex items-center gap-2 text-xs"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{detailOrder.customer.phone}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">配送地址</p>
                    <div className="space-y-1 rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5 text-xs text-muted-foreground">
                      <p className="text-foreground font-medium">{detailOrder.shippingAddress.name}</p>
                      <p>{detailOrder.shippingAddress.address1}</p>
                      <p>{detailOrder.shippingAddress.city}, {detailOrder.shippingAddress.country} {detailOrder.shippingAddress.zip ?? ""}</p>
                    </div>
                  </div>

                  {/* Payment */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">支付信息</p>
                    <div className="space-y-1.5 rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">网关</span>
                        <span className="text-foreground font-medium">{detailOrder.gateway}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">金额</span>
                        <span className="text-emerald-400 font-semibold">{detailOrder.currency} {detailOrder.totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">状态</span>
                        {(FINANCIAL_STATUS_MAP[detailOrder.financialStatus] && (
                          <Badge className={"text-[10px] px-1.5 py-0 " + FINANCIAL_STATUS_MAP[detailOrder.financialStatus].cls}>
                            {FINANCIAL_STATUS_MAP[detailOrder.financialStatus].label}
                          </Badge>
                        )) || <span className="text-xs text-muted-foreground">{detailOrder.financialStatus}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Order Tags & Note */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">标签与备注</p>
                    <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5">
                      <OrderTags
                        orderId={detailOrder.id}
                        tags={orderTagsMap[detailOrder.id] ?? detailOrder.tags}
                        note={orderNoteMap[detailOrder.id] ?? detailOrder.note}
                        isDemo={isDemo}
                        shopUrl={shopUrl}
                        accessToken={accessToken}
                        onTagsChange={(tags) => setOrderTagsMap((prev) => ({ ...prev, [detailOrder.id]: tags }))}
                        onNoteChange={(note) => setOrderNoteMap((prev) => ({ ...prev, [detailOrder.id]: note }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {detailTab === "items" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">商品列表 ({detailOrder.lineItems.length} 件)</p>
                  <div className="space-y-2">
                    {detailOrder.lineItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5">
                        <Layers className="h-8 w-8 text-muted-foreground/30" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sku ?? "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{detailOrder.currency} {parseFloat(item.price).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">× {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === "timeline" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">订单时间线</p>
                  <div className="space-y-0">
                    {[
                      { label: "订单创建", time: detailOrder.createdAt, done: true },
                      { label: "付款", time: detailOrder.createdAt, done: detailOrder.financialStatus === "paid" },
                      { label: "履约", time: detailOrder.fulfillmentStatus ? detailOrder.createdAt : null, done: !!detailOrder.fulfillmentStatus },
                      { label: "配送完成", time: null, done: detailOrder.fulfillmentStatus === "fulfilled" },
                    ].map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full border-2 ${step.done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"}`} />
                          {i < 3 && <div className={`w-0.5 flex-1 my-0.5 ${step.done ? "bg-emerald-500" : "bg-muted/20"}`} />}
                        </div>
                        <div className="pb-4">
                          <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                          {step.time && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(step.time).toLocaleString("zh-CN")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === "tags" && (
                <div>
                  <OrderTags
                    orderId={detailOrder.id}
                    tags={orderTagsMap[detailOrder.id] ?? detailOrder.tags}
                    note={orderNoteMap[detailOrder.id] ?? detailOrder.note}
                    isDemo={isDemo}
                    shopUrl={shopUrl}
                    accessToken={accessToken}
                    onTagsChange={(tags) => setOrderTagsMap((prev) => ({ ...prev, [detailOrder.id]: tags }))}
                    onNoteChange={(note) => setOrderNoteMap((prev) => ({ ...prev, [detailOrder.id]: note }))}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
