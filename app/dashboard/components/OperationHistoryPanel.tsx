"use client";

import { useState, useMemo } from "react";
import {
  History, RotateCcw, ChevronDown, ChevronRight, X, TrendingUp,
  Package, Tag, FileText, Edit3, AlertCircle, CheckCircle2, Play, Pause,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addOperationLog, getOperationHistory, markRolledBack, type OperationLog, type OperationDetail } from "@/lib/operation-logger";
import { useToast } from "../hooks/useToast";
import ToastBar from "./ToastBar";

interface OperationHistoryPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
}

/* ─── Helpers ─────────────────────────────────────────── */

const ACTION_ICONS: Record<string, React.ReactNode> = {
  batch_price: <TrendingUp className="h-4 w-4 text-amber-400" />,
  batch_inventory: <Package className="h-4 w-4 text-sky-400" />,
  batch_tags: <Tag className="h-4 w-4 text-purple-400" />,
  batch_status: <FileText className="h-4 w-4 text-emerald-400" />,
  single_price: <TrendingUp className="h-4 w-4 text-amber-300" />,
  single_inventory: <Package className="h-4 w-4 text-sky-300" />,
  product_update: <Edit3 className="h-4 w-4 text-zinc-400" />,
};

const ACTION_LABELS: Record<string, string> = {
  batch_price: "批量改价", batch_inventory: "批量改库存", batch_tags: "批量标签",
  batch_status: "批量改状态", single_price: "单品改价", single_inventory: "单品改库存", product_update: "商品编辑",
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

function groupByDate(logs: OperationLog[]): Map<string, OperationLog[]> {
  const map = new Map<string, OperationLog[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const log of logs) {
    const d = new Date(log.timestamp).toDateString();
    const key = d === today ? "今天" : d === yesterday ? "昨天" : new Date(log.timestamp).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return map;
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_LOGS: OperationLog[] = [
  {
    id: "demo-1", timestamp: new Date(Date.now() - 3600000).toISOString(), actionType: "batch_price",
    summary: "将 12 件商品价格下调 10%（大促预热），尾数 .95", details: [
      { targetType: "variant", targetId: 101, targetName: "Chrono X - 黑色", field: "price", oldValue: 299.99, newValue: 269.99, shopUrl: "demo.myshopify.com", rolledBack: false },
      { targetType: "variant", targetId: 201, targetName: "SonicFlow", field: "price", oldValue: 149.99, newValue: 134.99, shopUrl: "demo.myshopify.com", rolledBack: false },
    ],
    status: "completed", totalItems: 12, successCount: 12, failCount: 0,
  },
  {
    id: "demo-2", timestamp: new Date(Date.now() - 7200000).toISOString(), actionType: "batch_inventory",
    summary: "将 5 件商品库存增加 100 件", details: [
      { targetType: "variant", targetId: 301, targetName: "AR 护目镜 Air", field: "inventory", oldValue: 60, newValue: 160, shopUrl: "demo.myshopify.com", rolledBack: false },
    ],
    status: "completed", totalItems: 5, successCount: 5, failCount: 0,
  },
  {
    id: "demo-3", timestamp: new Date(Date.now() - 86400000).toISOString(), actionType: "batch_tags",
    summary: "为 8 件商品添加标签「热销」", details: [],
    status: "completed", totalItems: 8, successCount: 8, failCount: 0,
  },
  {
    id: "demo-4", timestamp: new Date(Date.now() - 2*86400000).toISOString(), actionType: "batch_status",
    summary: "将 3 件商品设为下架", details: [],
    status: "rolled_back", totalItems: 3, successCount: 3, failCount: 0,
  },
  {
    id: "demo-5", timestamp: new Date(Date.now() - 3*86400000).toISOString(), actionType: "batch_price",
    summary: "将 20 件商品统一改为 $99.99", details: [],
    status: "completed", totalItems: 20, successCount: 18, failCount: 2,
  },
];

/* ─── Main Component ─────────────────────────────────── */

export default function OperationHistoryPanel({ isDemo, shopUrl, accessToken, shopName }: OperationHistoryPanelProps) {
  const [logs, setLogs] = useState<OperationLog[]>(() => isDemo ? DEMO_LOGS : getOperationHistory());
  const [filterAction, setFilterAction] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { toast, showToast } = useToast(3000);

  const refresh = () => setLogs(isDemo ? DEMO_LOGS : getOperationHistory());

  const filtered = useMemo(() =>
    logs.filter((l) => filterAction === "all" || l.actionType === filterAction),
    [logs, filterAction],
  );

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  /* ── Rollback ─────────────────────────────────────── */
  const rollbackLog = useMemo(() => logs.find((l) => l.id === rollbackId), [logs, rollbackId]);

  const executeRollback = async () => {
    if (!rollbackLog) return;
    setRollingBack(true);
    setProgress({ done: 0, total: rollbackLog.details.length });

    let ok = 0, fail = 0;
    for (const d of rollbackLog.details) {
      if (isDemo) await new Promise((r) => setTimeout(r, 1000));
      else {
        try {
          await fetch("/api/shopify/dashboard", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "updateProduct", shopUrl: d.shopUrl, accessToken, productId: d.targetId, [d.field]: d.oldValue }),
          });
          ok++;
        } catch { fail++; }
        await new Promise((r) => setTimeout(r, 500));
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    if (isDemo) {
      setLogs((prev) => prev.map((l) => l.id === rollbackLog.id ? { ...l, status: "rolled_back" as const } : l));
    } else {
      markRolledBack(rollbackLog.id); refresh();
    }
    setRollingBack(false); setRollbackId(null);
    showToast(isDemo ? "演示模式：回滚已模拟" : `已回滚 ${ok} 项`);
  };

  return (
    <div className="space-y-4">
      <ToastBar message={toast} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><History className="h-6 w-6 text-orange-400" />操作历史</h2>
          <p className="mt-1 text-sm text-muted-foreground">{isDemo && <span className="text-xs text-amber-400">(演示)</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="h-8 rounded border border-border/40 bg-background text-xs text-foreground px-2">
            <option value="all">全部类型</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={refresh} className="h-8 text-xs"><RotateCcw className="h-3 w-3 mr-1"/>刷新</Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16"><History className="h-12 w-12 mx-auto mb-3 text-muted-foreground/25" /><p className="text-sm text-muted-foreground">暂无操作记录</p></div>
      )}

      <div className="space-y-4">
        {[...grouped.entries()].map(([date, items]) => (
          <div key={date}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 sticky top-0 bg-zinc-950/80 backdrop-blur-sm py-1 z-10">{date}</p>
            <div className="space-y-2">
              {items.map((log) => (
                <Card key={log.id} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{ACTION_ICONS[log.actionType] || <Edit3 className="h-4 w-4" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{log.summary}</p>
                          <Badge className={`text-[9px] px-1.5 py-0 ${log.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : log.status === "rolled_back" ? "bg-sky-500/15 text-sky-400" : "bg-red-500/15 text-red-400"}`}>
                            {log.status === "completed" ? "已完成" : log.status === "rolled_back" ? "已回滚" : "失败"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                          <span title={new Date(log.timestamp).toLocaleString("zh-CN")}>{relativeTime(log.timestamp)}</span>
                          <span>共 {log.totalItems} 项 · 成功 {log.successCount}{log.failCount > 0 && <span className="text-red-400"> · 失败 {log.failCount}</span>}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted/20">{expandedId === log.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
                        {log.status === "completed" && log.details.length > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setRollbackId(log.id)} className="h-7 gap-1 text-[10px] text-amber-400"><RotateCcw className="h-3 w-3" />回滚</Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === log.id && log.details.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/20">
                        <table className="w-full text-[10px]">
                          <thead><tr className="text-muted-foreground"><th className="py-0.5 text-left">目标</th><th className="py-0.5 text-left">字段</th><th className="py-0.5 text-right">旧值</th><th className="py-0.5 text-center w-4">→</th><th className="py-0.5 text-right">新值</th></tr></thead>
                          <tbody>
                            {log.details.slice(0, 20).map((d, i) => (
                              <tr key={i} className="border-t border-border/10">
                                <td className="py-1 truncate max-w-[140px]">{d.targetName}</td>
                                <td className="py-1 text-muted-foreground">{d.field}</td>
                                <td className="py-1 text-right tabular-nums text-zinc-400">{String(d.oldValue)}</td>
                                <td className="py-1 text-center">→</td>
                                <td className="py-1 text-right tabular-nums">{String(d.newValue)}</td>
                              </tr>
                            ))}
                            {log.details.length > 20 && <tr><td colSpan={5} className="py-1 text-center text-muted-foreground">...还有 {log.details.length - 20} 项</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rollback Confirm Modal */}
      {rollbackId && rollbackLog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setRollbackId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-card border border-border/40 rounded-xl shadow-2xl p-5 space-y-3">
              <RotateCcw className="h-8 w-8 text-amber-400" />
              <h3 className="text-sm font-semibold">确定要回滚以下操作？</h3>
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/10 rounded-lg p-3">
                <p><span className="text-muted-foreground">操作：</span>{rollbackLog.summary}</p>
                <p><span className="text-muted-foreground">时间：</span>{new Date(rollbackLog.timestamp).toLocaleString("zh-CN")}</p>
                <p>将恢复 {rollbackLog.details.length} 项到操作前的值</p>
              </div>
              {rollingBack ? (
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-amber-400"><Play className="h-3 w-3"/>回滚中 {progress.done}/{progress.total}</div>
                  <div className="h-2 rounded bg-muted/20 mt-1 overflow-hidden"><div className="h-full bg-amber-500 rounded transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={executeRollback} className="flex-1 h-9 text-xs bg-amber-600 hover:bg-amber-500 text-white"><Play className="h-3 w-3 mr-1" />确认回滚</Button>
                  <Button variant="outline" onClick={() => setRollbackId(null)} className="h-9 text-xs">取消</Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
