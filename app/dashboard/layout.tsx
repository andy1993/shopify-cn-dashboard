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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Context ───────────────────────────────────────────

type MenuKey = "overview" | "ai" | "finance" | "risk" | "trend" | "aggregator" | "gateway" | "funnel";

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

// ─── Navigation Definition ─────────────────────────────

const NAV_ITEMS: Array<{
  id: MenuKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "核心实时看板", icon: LayoutDashboard },
  { id: "ai", label: "AI 智能诊断", icon: Brain },
  { id: "finance", label: "供应链对账", icon: Coins },
  { id: "risk", label: "风控雷达", icon: Shield },
  { id: "trend", label: "趋势同比", icon: BarChart3 },
  { id: "aggregator", label: "全店聚合", icon: Layers },
  { id: "gateway", label: "网关对账", icon: Landmark },
  { id: "funnel", label: "漏斗转化", icon: Brain },
];

// ─── Layout Component ──────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("overview");

  return (
    <DashboardContext.Provider value={{ activeMenu, setActiveMenu }}>
      <div className="flex min-h-screen bg-zinc-950">
        {/* ── Sidebar ── */}
        <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-zinc-800 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <span className="text-sm">🚀</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-zinc-100">
                Shopify CN Pro
              </p>
              <p className="text-[10px] font-medium text-zinc-500">
                跨境操盘手工作台
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              功能菜单
            </p>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeMenu === item.id;
                const Icon = item.icon;

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveMenu(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-emerald-400"
                            : "text-zinc-600 group-hover:text-zinc-400",
                        )}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isActive && (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-3 py-4">
            <button
              onClick={() => router.push("/config")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-800/60 hover:text-zinc-300"
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
