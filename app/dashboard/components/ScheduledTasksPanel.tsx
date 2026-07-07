"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Clock, Play, Pause, Plus, X, Save, Trash2, Edit3, CheckCircle2, AlertCircle,
  Bell, FileText, Download, RefreshCw, RotateCcw, ChevronDown, ChevronRight,
  CalendarClock, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

type ActionType = "refresh" | "weeklyReport" | "batchPrice" | "exportCsv" | "notify";

interface ExecutionLog {
  id: string; timestamp: string; status: "ok" | "fail"; duration: number; summary: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  frequency: "once" | "daily" | "weekly" | "monthly" | "interval";
  time: string;         // HH:MM
  date?: string;        // YYYY-MM-DD for once
  weekday?: number;     // 0-6 Sun-Sat for weekly
  monthDay?: number;    // 1-28 for monthly
  intervalMinutes?: number; // for interval
  actionType: ActionType;
  actionConfig: Record<string, string>;
  lastRun?: string;
  nextRun?: string;
  creating?: boolean;
  running?: boolean;
  logs: ExecutionLog[];
  createdAt: string;
}

interface ScheduledTasksPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
}

const ACTION_LABELS: Record<ActionType, string> = { refresh: "刷新数据", weeklyReport: "生成周报", batchPrice: "批量改价", exportCsv: "导出 CSV", notify: "桌面通知" };
const ACTION_ICONS: Record<ActionType, React.ReactNode> = { refresh: <RefreshCw className="h-3 w-3" />, weeklyReport: <FileText className="h-3 w-3" />, batchPrice: <TrendingUp className="h-3 w-3" />, exportCsv: <Download className="h-3 w-3" />, notify: <Bell className="h-3 w-3" /> };

/* ─── Helpers ────────────────────────────────────────── */

function nowBeijing(): Date { return new Date(new Date().getTime() + 8 * 3600000); }

function beijingStr(d: Date): string { const utc = new Date(d.getTime() - 8*3600000); return utc.toISOString().slice(0,16); }

function computeNextRun(task: ScheduledTask): string | undefined {
  if (!task.enabled) return undefined;
  const now = nowBeijing();
  const [h,m] = task.time.split(":").map(Number);

  if (task.frequency === "once") {
    if (!task.date) return undefined;
    const target = new Date(task.date + "T" + task.time + ":00+08:00");
    return target > now ? target.toISOString() : undefined;
  }

  if (task.frequency === "daily") {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h - 8, m));
    if (t <= now) t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString();
  }

  if (task.frequency === "weekly") {
    const wd = task.weekday ?? 1;
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h - 8, m));
    const diff = (wd + 7 - t.getUTCDay()) % 7;
    if (diff === 0 && t <= now) { t.setUTCDate(t.getUTCDate() + 7); } else { t.setUTCDate(t.getUTCDate() + (diff || 7)); }
    return t.toISOString();
  }

  if (task.frequency === "monthly") {
    const md = task.monthDay ?? 1;
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(md, 28), h - 8, m));
    if (t <= now) t.setUTCMonth(t.getUTCMonth() + 1);
    return t.toISOString();
  }

  // interval
  if (task.lastRun) {
    const t = new Date(task.lastRun);
    t.setMinutes(t.getMinutes() + (task.intervalMinutes || 60));
    return t > now ? t.toISOString() : new Date(now.getTime() + 60000).toISOString();
  }
  return new Date(now.getTime() + 60000).toISOString();
}

function formatNextRun(t?: string): string {
  if (!t) return "—";
  const d = new Date(t);
  return d.toLocaleString("zh-CN", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

function freqLabel(task: ScheduledTask): string {
  if (task.frequency === "once") return task.date ? `${task.date} ${task.time}（一次性）` : "一次性";
  if (task.frequency === "daily") return `每天 ${task.time}`;
  if (task.frequency === "weekly") return `每周${["日","一","二","三","四","五","六"][task.weekday??1]} ${task.time}`;
  if (task.frequency === "monthly") return `每月 ${task.monthDay??1} 号 ${task.time}`;
  return `每 ${task.intervalMinutes??60} 分钟`;
}

function loadTasks(): ScheduledTask[] { try { return JSON.parse(localStorage.getItem("scheduled_tasks") || "[]"); } catch { return []; } }
function saveTasks(t: ScheduledTask[]) { localStorage.setItem("scheduled_tasks", JSON.stringify(t)); }

/* ─── Weekday / MonthDay options ─────────────────────── */
const WEEKDAYS = ["日","一","二","三","四","五","六"];
const MONTH_DAYS = Array.from({length:28},(_,i)=>i+1);

/* ─── Main Component ─────────────────────────────────── */

export default function ScheduledTasksPanel({ isDemo, shopUrl, accessToken, shopName }: ScheduledTasksPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>(() => isDemo ? DEMO_TASKS : loadTasks().map((t) => ({ ...t, nextRun: computeNextRun(t) })));
  const [modalTask, setModalTask] = useState<ScheduledTask | null>(null);
  const [modalStep, setModalStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* ── Persist ──────────────────────────────────────── */
  useEffect(() => { if (!isDemo) saveTasks(tasks); }, [tasks, isDemo]);

  /* ── Execution Engine ─────────────────────────────── */
  const executeTask = useCallback(async (task: ScheduledTask) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, running: true } : t));
    const start = Date.now();
    let status: "ok" | "fail" = "ok", summary = "完成";

    try {
      if (task.actionType === "refresh") {
        if (isDemo) { await new Promise((r) => setTimeout(r, 2000)); summary = "演示：数据已刷新"; }
        else { const res = await fetch("/api/shopify/dashboard", { method: "GET", headers: { "x-shop-url": shopUrl, "x-access-token": accessToken } }); if (!res.ok) throw new Error("请求失败"); }
      } else if (task.actionType === "weeklyReport") {
        summary = isDemo ? "演示：周报已生成" : await generateWeeklyReport(shopUrl, accessToken, shopName);
      } else if (task.actionType === "batchPrice") {
        if (isDemo) { await new Promise((r) => setTimeout(r, 2000)); summary = "演示：价格已调整"; }
      } else if (task.actionType === "exportCsv") {
        if (isDemo) { await new Promise((r) => setTimeout(r, 2000)); summary = "演示：CSV 已导出"; }
      } else if (task.actionType === "notify") {
        const msg = task.actionConfig?.message || "定时任务已触发";
        if (Notification.permission === "granted") { new Notification("Shopify CN Pro", { body: msg + " — " + new Date().toLocaleString("zh-CN") }); }
        else if (Notification.permission === "default") { const perm = await Notification.requestPermission(); if (perm === "granted") new Notification("Shopify CN Pro", { body: msg }); else showToast("桌面通知权限被拒绝"); }
        summary = "通知已发送";
      }
    } catch (e) { status = "fail"; summary = (e as Error).message || "执行失败"; }

    const log: ExecutionLog = { id: Date.now().toString(36), timestamp: new Date().toISOString(), status, duration: Date.now() - start, summary };
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, running: false, lastRun: new Date().toISOString(), nextRun: computeNextRun({ ...t, lastRun: new Date().toISOString() }), logs: [log, ...(t.logs||[])].slice(0, 10) } : t));
  }, [isDemo, shopUrl, accessToken, shopName]);

  /* ── Interval check ───────────────────────────────── */
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTasks((prev) => prev.map((t) => {
        if (!t.enabled || t.running) return t;
        const next = t.nextRun || computeNextRun(t);
        if (next && new Date(next) <= new Date()) {
          executeTask(t);
          return { ...t, nextRun: computeNextRun({ ...t, lastRun: new Date().toISOString() }) };
        }
        return { ...t, nextRun: next };
      }));
    }, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [executeTask]);

  /* ── CRUD ─────────────────────────────────────────── */
  const openCreate = () => { setModalTask({ id: "", name: "", description: "", enabled: true, frequency: "daily", time: "09:00", date: "", weekday: 1, monthDay: 1, actionType: "refresh", actionConfig: {}, logs: [], createdAt: new Date().toISOString() }); setModalStep(0); };

  const openEdit = (task: ScheduledTask) => { setModalTask({ ...task }); setModalStep(0); };

  const saveModal = () => {
    if (!modalTask || !modalTask.name.trim()) return;
    const saved: ScheduledTask = { ...modalTask, id: modalTask.id || "task-" + Date.now(), nextRun: computeNextRun(modalTask), createdAt: modalTask.createdAt || new Date().toISOString() };
    setTasks((prev) => { const exists = prev.findIndex((t) => t.id === saved.id); return exists >= 0 ? prev.map((t,i) => i===exists ? saved : t) : [...prev, saved]; });
    setModalTask(null);
    showToast("任务已保存");
  };

  const deleteTask = (id: string) => { setTasks((prev) => prev.filter((t) => t.id !== id)); showToast("已删除"); };
  const toggleTask = (id: string) => { setTasks((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled, nextRun: !t.enabled ? computeNextRun({ ...t, enabled: true }) : undefined } : t)); };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><CalendarClock className="h-6 w-6 text-cyan-400" />定时任务</h2>
          <p className="mt-1 text-base text-muted-foreground">{shopName} · {tasks.length} 个任务{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-9 gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm"><Plus className="h-3 w-3"/>创建任务</Button>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-16"><CalendarClock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/25"/><p className="text-base text-muted-foreground">暂无定时任务</p></div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className={`border-border/40 bg-card/60 shadow-lg backdrop-blur-lg ${task.running ? "ring-1 ring-cyan-500/50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button onClick={() => toggleTask(task.id)} className={`mt-0.5 w-9 h-5 rounded-full relative transition-colors shrink-0 ${task.enabled ? "bg-cyan-500" : "bg-zinc-600"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${task.enabled ? "left-4" : "left-0.5"}`} />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-foreground truncate">{task.name}</p>
                    <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-cyan-500/15 text-cyan-400">{ACTION_ICONS[task.actionType]}{ACTION_LABELS[task.actionType]}</Badge>
                    {task.running && <Badge className="text-[9px] bg-cyan-500/20 text-cyan-400 animate-pulse">执行中</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description || "—"}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>⏰ {freqLabel(task)}</span>
                    <span>⬆ {task.lastRun ? formatNextRun(task.lastRun) : "从未"}</span>
                    <span>⬇ {formatNextRun(task.nextRun)}</span>
                    <span className="text-[9px]">📋 {task.logs.length} 条日志</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => executeTask(task)} disabled={task.running} className="h-7 w-7 p-0" title="立即执行"><Play className="h-3.5 w-3.5 text-cyan-400"/></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(task)} className="h-7 w-7 p-0"><Edit3 className="h-3.5 w-3.5 text-muted-foreground"/></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteTask(task.id)} className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400"/></Button>
                  <button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="h-7 w-7 flex items-center justify-center">{expandedId === task.id ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}</button>
                </div>
              </div>

              {/* Execution Logs */}
              {expandedId === task.id && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">执行日志</p>
                  {task.logs.length === 0 ? <p className="text-xs text-muted-foreground/50">暂无执行记录</p> : (
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {task.logs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs py-0.5">
                          <span className={log.status === "ok" ? "text-emerald-400" : "text-red-400"}>{log.status === "ok" ? "🟢" : "🔴"}</span>
                          <span className="text-muted-foreground tabular-nums">{new Date(log.timestamp).toLocaleString("zh-CN")}</span>
                          <span className="text-muted-foreground">{log.duration}ms</span>
                          <span className="text-foreground truncate flex-1">{log.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Create/Edit Modal ── */}
      {modalTask && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setModalTask(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
                <h3 className="text-base font-semibold">{modalTask.id ? "编辑任务" : "创建任务"}</h3>
                <Button size="sm" variant="ghost" onClick={() => setModalTask(null)}><X className="h-4 w-4"/></Button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-1 px-5 py-2 border-b border-border/20">
                {["基本信息","触发条件","执行动作"].map((label, i) => (
                  <button key={i} onClick={() => setModalStep(i)} className={`px-3 py-1 rounded text-xs font-medium ${modalStep===i?"bg-cyan-500/15 text-cyan-400":"text-muted-foreground"}`}>
                    {i+1}. {label}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-3">
                {/* Step 0: Basic */}
                {modalStep === 0 && (<>
                  <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">任务名称 *</label><Input value={modalTask.name} onChange={(e)=>setModalTask({...modalTask,name:e.target.value})} autoFocus className="h-9 text-sm"/></div>
                  <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">描述</label><textarea value={modalTask.description} onChange={(e)=>setModalTask({...modalTask,description:e.target.value})} rows={2} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm resize-none"/></div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={modalTask.enabled} onChange={()=>setModalTask({...modalTask,enabled:!modalTask.enabled})} className="accent-cyan-500"/>启用任务</label>
                </>)}

                {/* Step 1: Schedule */}
                {modalStep === 1 && (<>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-0.5 block">频率</label>
                    <select value={modalTask.frequency} onChange={(e)=>{const f=e.target.value as ScheduledTask["frequency"];setModalTask({...modalTask,frequency:f});}} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-base text-foreground">
                      <option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="interval">间隔执行</option><option value="once">一次性</option>
                    </select>
                  </div>
                  {modalTask.frequency === "once" && <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">日期</label><Input type="date" value={modalTask.date||""} onChange={(e)=>setModalTask({...modalTask,date:e.target.value})} className="h-9 text-sm"/></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">时间</label><Input type="time" value={modalTask.time} onChange={(e)=>setModalTask({...modalTask,time:e.target.value})} className="h-9 text-sm"/></div>
                    {modalTask.frequency === "weekly" && <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">星期</label><select value={modalTask.weekday??1} onChange={(e)=>setModalTask({...modalTask,weekday:Number(e.target.value)})} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-base text-foreground">{WEEKDAYS.map((d,i)=><option key={i} value={i}>周{d}</option>)}</select></div>}
                    {modalTask.frequency === "monthly" && <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">日期</label><select value={modalTask.monthDay??1} onChange={(e)=>setModalTask({...modalTask,monthDay:Number(e.target.value)})} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-base text-foreground">{MONTH_DAYS.map((d)=><option key={d}>{d} 号</option>)}</select></div>}
                    {modalTask.frequency === "interval" && <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">间隔(分钟)</label><Input type="number" value={modalTask.intervalMinutes??60} onChange={(e)=>setModalTask({...modalTask,intervalMinutes:Number(e.target.value)||60})} className="h-9 text-sm"/></div>}
                  </div>
                </>)}

                {/* Step 2: Action */}
                {modalStep === 2 && (<>
                  <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">动作类型</label>
                    <select value={modalTask.actionType} onChange={(e)=>setModalTask({...modalTask,actionType:e.target.value as ActionType})} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-base text-foreground">
                      {(Object.entries(ACTION_LABELS) as [ActionType,string][]).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {modalTask.actionType === "notify" && <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">通知文案</label><Input value={modalTask.actionConfig?.message||""} onChange={(e)=>setModalTask({...modalTask,actionConfig:{message:e.target.value}})} placeholder="定时任务已触发" className="h-9 text-sm"/></div>}
                  {modalTask.actionType === "batchPrice" && <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">价格策略模板</label><Input value={modalTask.actionConfig?.template||""} onChange={(e)=>setModalTask({...modalTask,actionConfig:{template:e.target.value}})} placeholder="模板 ID" className="h-9 text-sm"/></div>}
                  {modalTask.actionType === "exportCsv" && <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">导出类型</label><select value={modalTask.actionConfig?.csvType||"orders"} onChange={(e)=>setModalTask({...modalTask,actionConfig:{csvType:e.target.value}})} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-base text-foreground"><option value="orders">订单</option><option value="customers">客户</option><option value="products">商品</option></select></div>}
                </>)}
              </div>

              <div className="flex items-center justify-between border-t border-border/20 px-5 py-3">
                <div className="flex gap-1">{[0,1,2].map((s)=><span key={s} className={`h-1.5 w-6 rounded ${modalStep>=s?"bg-cyan-500":"bg-muted/20"}`}/>)}</div>
                <div className="flex gap-2">
                  {modalStep > 0 && <Button variant="outline" onClick={()=>setModalStep((s)=>s-1)} className="h-9 text-sm">上一步</Button>}
                  {modalStep < 2 ? <Button onClick={()=>setModalStep((s)=>s+1)} className="h-9 text-sm bg-cyan-600 hover:bg-cyan-500 text-white">下一步</Button>
                  : <Button onClick={saveModal} disabled={!modalTask.name.trim()} className="h-9 gap-1 bg-emerald-600 text-white text-sm"><Save className="h-3 w-3"/>保存任务</Button>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Demo Tasks ──────────────────────────────────────── */

const DEMO_TASKS: ScheduledTask[] = [
  {
    id: "demo-1", name: "每日数据快照", description: "每天凌晨刷新仪表盘数据", enabled: true,
    frequency: "daily", time: "00:00", actionType: "refresh", actionConfig: {},
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    nextRun: new Date(new Date().setHours(24,0,0,0)).toISOString(),
    logs: [{ id: "l1", timestamp: new Date(Date.now() - 86400000).toISOString(), status: "ok", duration: 3420, summary: "数据刷新完成" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-2", name: "每周一运营周报", description: "自动生成上周运营数据周报", enabled: true,
    frequency: "weekly", time: "09:00", weekday: 1, actionType: "weeklyReport", actionConfig: {},
    lastRun: new Date(Date.now() - 7*86400000).toISOString(),
    nextRun: new Date(Date.now() + 2*86400000).toISOString(),
    logs: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-3", name: "大促结束调价", description: "大促结束后恢复原价", enabled: false,
    frequency: "once", time: "23:59", date: "2026-07-15", actionType: "batchPrice", actionConfig: { template: "preset-8" },
    logs: [],
    createdAt: new Date().toISOString(),
  },
];

/* ─── Weekly Report Generator ──────────────────────────── */

async function generateWeeklyReport(shopUrl: string, token: string, shopName: string): Promise<string> {
  try {
    const res = await fetch("/api/shopify/dashboard", { method: "GET", headers: { "x-shop-url": shopUrl, "x-access-token": token } });
    const data = await res.json() as Record<string, unknown>;
    const gmv = (data.totalSales as number)?.toFixed(2) || "0";
    const orders = data.orderCount || 0;
    const macro = data.macro || {};
    const weekStart = new Date(Date.now() - 7 * 86400000).toLocaleDateString("zh-CN");
    const weekEnd = new Date().toLocaleDateString("zh-CN");

    const md = `# ${shopName} 运营周报\n📅 ${weekStart} — ${weekEnd}\n---\n## 💰 GMV 概览\n- 本周 GMV: ¥${gmv}\n## 📦 订单\n- 总订单数: ${orders}\n---\n*由 Shopify CN Pro 自动生成*`;

    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${shopName}_周报_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    return "周报已下载";
  } catch { return "生成失败"; }
}
