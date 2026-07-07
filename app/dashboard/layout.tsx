"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  Coins,
  Shield,
  BarChart3,
  Layers,
  Landmark,
  Settings,
  TrendingUp,
  ChevronDown,
  Package,
  DollarSign,
  AlertTriangle,
  Repeat,
  Zap,
  ShoppingBag,
  Users,
  Truck,
  FolderTree,
  Menu,
  FileText,
  Database,
  Play,
  CalendarClock,
  History,
  Gauge,
  Workflow,
  Globe,
  Warehouse,
  Languages,
  Receipt,
  BarChart4,
  PieChart,
  Users2,
  Link,
  Braces,
  Bot,
  Code2,
  Wand,
  GitCompare,
  Sparkles,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Context ───────────────────────────────────────────

export type MenuKey = "overview" | "ai" | "finance" | "risk" | "trend" | "aggregator" | "gateway" | "funnel" | "ad" | "product-control" | "batch-op" | "bulk-edit" | "scheduled-tasks" | "rule-engine" | "orders" | "customers" | "fulfillment" | "collections" | "navigation" | "content-pages" | "metafields" | "operation-history" | "inventory-alert" | "markets" | "multi-currency" | "multi-location" | "translations" | "shipping-rates" | "tax-overview" | "product-analytics" | "category-analytics" | "customer-segmentation" | "sales-forecast" | "product-affinity" | "schema-audit" | "schema-generator" | "ai-indexability" | "competitor-geo" | "ai-simulation" | "geo-wizard";

interface DashboardContextValue {
  activeMenu: MenuKey;
  setActiveMenu: (key: MenuKey) => void;
}

const DashboardContext = createContext<DashboardContextValue>({
  activeMenu: "overview",
  setActiveMenu: () => {},
});

export function useDashboardMenu() {
  return useContext(DashboardContext);
}

// ─── Category Definition ───────────────────────────────

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{
    id: MenuKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    soon?: boolean;
  }>;
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "data-center",
    label: "📊 数据中心",
    icon: BarChart3,
    items: [
      { id: "aggregator", label: "全店聚合大盘", icon: Layers },
      { id: "trend", label: "趋势同比分析", icon: BarChart3 },
      { id: "funnel", label: "漏斗转化复购", icon: Repeat },
    ],
  },
  {
    id: "order-customer",
    label: "🏪 订单与客户",
    icon: ShoppingBag,
    items: [
      { id: "orders", label: "订单管理中心", icon: ShoppingBag },
      { id: "customers", label: "客户管理中心", icon: Users },
      { id: "fulfillment", label: "履约看板", icon: Truck },
      { id: "inventory-alert", label: "库存健康面板", icon: Gauge },
    ],
  },
  {
    id: "product-content",
    label: "📦 商品与内容",
    icon: Package,
    items: [
      { id: "product-control", label: "跨店改价控制", icon: Zap },
      { id: "batch-op", label: "批量操作引擎", icon: Play },
      { id: "scheduled-tasks", label: "定时任务", icon: CalendarClock },
      { id: "rule-engine", label: "规则引擎", icon: Workflow },
      { id: "bulk-edit", label: "批量编辑面板", icon: Layers },
      { id: "collections", label: "集合管理", icon: FolderTree },
      { id: "navigation", label: "导航菜单编辑", icon: Menu },
      { id: "content-pages", label: "页面与博客", icon: FileText },
      { id: "metafields", label: "Metafields 编辑器", icon: Database },
      { id: "operation-history", label: "操作历史", icon: History },
    ],
  },
  {
    id: "geo-center",
    label: "🌐 GEO 优化",
    icon: Braces,
    items: [
      { id: "geo-wizard", label: "GEO 优化向导", icon: Compass },
      { id: "ai-indexability", label: "AI 可索引性检查", icon: Bot },
      { id: "schema-audit", label: "Schema 检测", icon: Code2 },
      { id: "schema-generator", label: "Schema 自动生成", icon: Wand },
      { id: "competitor-geo", label: "竞品 GEO 对标", icon: GitCompare },
      { id: "ai-simulation", label: "AI 引用模拟器", icon: Sparkles },
    ],
  },
  {
    id: "finance-center",
    label: "💰 财务对账",
    icon: DollarSign,
    items: [
      { id: "ad", label: "广告成效与 MER", icon: TrendingUp },
      { id: "gateway", label: "网关渠道对账", icon: Landmark },
      { id: "finance", label: "供应链对账", icon: Coins },
    ],
  },
  {
    id: "markets-center",
    label: "🌍 多市场运营",
    icon: Globe,
    items: [
      { id: "markets", label: "市场总览", icon: Globe },
      { id: "multi-currency", label: "多币种定价矩阵", icon: DollarSign },
      { id: "multi-location", label: "多仓库存管理", icon: Warehouse },
      { id: "translations", label: "翻译管理器", icon: Languages },
      { id: "shipping-rates", label: "运费管理", icon: Truck },
      { id: "tax-overview", label: "税务总览", icon: Receipt },
    ],
  },
  {
    id: "risk-center",
    label: "🛡️ 风控预警",
    icon: Shield,
    items: [
      { id: "ai", label: "AI 智能诊断", icon: Brain },
      { id: "risk", label: "账户风控雷达", icon: AlertTriangle },
    ],
  },
  {
    id: "intelligence-center",
    label: "🎯 智能决策",
    icon: BarChart4,
    items: [
      { id: "product-analytics", label: "商品深度分析", icon: BarChart4 },
      { id: "category-analytics", label: "品类分析", icon: PieChart },
      { id: "customer-segmentation", label: "客户分层 RFM", icon: Users2 },
      { id: "sales-forecast", label: "销售预测", icon: TrendingUp },
      { id: "product-affinity", label: "商品关联分析", icon: Link },
    ],
  },
];

// ─── Layout Component ──────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("overview");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["data-center", "order-customer", "product-content", "geo-center", "finance-center", "markets-center", "risk-center", "intelligence-center"]),
  );
  const [soonMsg, setSoonMsg] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      const wasExpanded = next.has(id);
      if (wasExpanded) next.delete(id);
      else {
        next.add(id);
        // GEO 分类默认入口：展开时若当前不在该分类内，跳转到向导面板
        if (id === "geo-center" && !NAV_CATEGORIES.find((c) => c.id === "geo-center")?.items.some((i) => i.id === activeMenu)) {
          const first = NAV_CATEGORIES.find((c) => c.id === "geo-center")?.items[0];
          if (first) setActiveMenu(first.id as MenuKey);
        }
      }
      return next;
    });
  };

  const handleMenuClick = (id: MenuKey, soon?: boolean) => {
    if (soon) {
      setSoonMsg("🚀 [Roadmap No.1] 广告成效与实时 MER 面板正在全力研发中，预计 4 号开源发布后 48 小时内随 MVP 2.1 补丁合入！");
      setTimeout(() => setSoonMsg(null), 4000);
      return;
    }
    setActiveMenu(id);
  };

  return (
    <DashboardContext.Provider value={{ activeMenu, setActiveMenu }}>
      <div className="flex min-h-screen bg-zinc-950">
        {/* ── Sidebar ── */}
        <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-zinc-800 px-5">
            <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <span className="text-base">🚀</span>
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-zinc-100">
                Shopify CN Pro
              </p>
              <p className="text-xs font-medium text-zinc-500">
                v0.3.0.1 · MVP 3.0
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {/* ── Top-level: Overview ── */}
            <button
              onClick={() => handleMenuClick("overview")}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all",
                activeMenu === "overview"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
              )}
            >
              <LayoutDashboard
                className={cn(
                  "h-4 w-4 shrink-0",
                  activeMenu === "overview"
                    ? "text-emerald-400"
                    : "text-zinc-600",
                )}
              />
              <span className="flex-1 text-left">核心实时看板</span>
              {activeMenu === "overview" && (
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* ── Divider ── */}
            <hr className="my-4 border-zinc-800" />

            {/* ── Category groups ── */}
            <div className="space-y-3">
              {NAV_CATEGORIES.map((cat) => {
                const isExpanded = expandedCategories.has(cat.id);
                const hasActiveChild = cat.items.some((i) => activeMenu === i.id);

                return (
                  <div key={cat.id}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors",
                        hasActiveChild
                          ? "text-zinc-300"
                          : "text-zinc-500 hover:text-zinc-400",
                      )}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 shrink-0 transition-transform",
                          isExpanded ? "" : "-rotate-90",
                        )}
                      />
                      <span className="flex-1 uppercase tracking-wider">{cat.label}</span>
                    </button>

                    {/* Sub-items */}
                    {isExpanded && (
                      <ul className="mt-1 space-y-0.5 pl-1">
                        {cat.items.map((item) => {
                          const isActive = activeMenu === item.id;
                          const Icon = item.icon;

                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => handleMenuClick(item.id, item.soon)}
                                className={cn(
                                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-base font-medium transition-all",
                                  item.soon
                                    ? "text-zinc-600 hover:bg-zinc-800/40 hover:text-zinc-400"
                                    : isActive
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    item.soon
                                      ? "text-zinc-700"
                                      : isActive
                                        ? "text-emerald-400"
                                        : "text-zinc-600",
                                  )}
                                />
                                <span className="flex-1 text-left">
                                  {item.label}
                                </span>
                                {item.soon && (
                                  <span className="text-xs font-semibold text-amber-500/60">
                                    即将开放
                                  </span>
                                )}
                                {!item.soon && isActive && (
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-3 py-4">
            {/* Roadmap toast */}
            {soonMsg && (
              <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <p className="text-[11px] leading-relaxed text-amber-300">{soonMsg}</p>
              </div>
            )}
            <button
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-zinc-500 transition-all hover:bg-zinc-800/60 hover:text-zinc-300"
            >
              <Settings className="h-4 w-4 shrink-0 text-zinc-600" />
              <span>重新绑定店铺</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="ml-64 flex-1 min-h-screen bg-zinc-900 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </DashboardContext.Provider>
  );
}
