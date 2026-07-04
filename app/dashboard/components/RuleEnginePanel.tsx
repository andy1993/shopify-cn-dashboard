"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Workflow, Zap, Plus, X, Save, Trash2, Edit3, Play,
  CheckCircle2, AlertCircle, GripVertical, Bell, Tag, FileText, Clock,
  ChevronDown, ChevronRight, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

type TriggerType = "order_new" | "order_refund" | "inventory_low" | "customer_new" | "scheduled" | "manual";
type RuleType = "order" | "customer" | "inventory" | "refund";

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  id: string;
  type: "addOrderTag" | "addCustomerTag" | "addOrderNote" | "desktopNotify" | "updateInventory" | "logOnly";
  config: Record<string, string>;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: TriggerType;
  conditions: Condition[];
  conditionMode: "and" | "or";
  actions: RuleAction[];
  priority: number;
  lastTriggered?: string;
  hitCount: number;
  createdAt: string;
}

interface ExecutionLog {
  id: string; timestamp: string; ruleName: string; targetName: string; success: boolean; summary: string;
}

interface RuleEnginePanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  orders?: Array<{ id: number; order_number: string; total_price: number; customer_name?: string; tags: string }>;
  customers?: Array<{ id: number; first_name: string; last_name: string; total_spent: number; orders_count: number; tags: string }>;
  fullProducts?: Array<{ id: number; title: string; variants: Array<{ variantId: number; name: string; inventory: number }> }>;
}

const TRIGGER_LABELS: Record<TriggerType, string> = { order_new: "订单创建", order_refund: "订单退款", inventory_low: "库存变化", customer_new: "新客户注册", scheduled: "定时触发", manual: "手动触发" };
const RULE_TYPE_MAP: Record<TriggerType, RuleType> = { order_new: "order", order_refund: "refund", inventory_low: "inventory", customer_new: "customer", scheduled: "order", manual: "order" };

/* ─── Field/Operator config ──────────────────────────── */

interface FieldConfig { value: string; label: string; operators: string[]; triggers: TriggerType[]; }

const OPERATORS: Record<string, string> = { equals: "等于", not_equals: "不等于", gt: "大于", lt: "小于", gte: "大于等于", lte: "小于等于", contains: "包含", not_contains: "不包含", starts_with: "开头是" };

const FIELDS: FieldConfig[] = [
  { value: "total_price", label: "订单金额", operators: ["gt","lt","gte","lte","equals"], triggers: ["order_new","order_refund","scheduled","manual"] },
  { value: "item_count", label: "商品数", operators: ["gt","lt","gte","lte","equals"], triggers: ["order_new","scheduled","manual"] },
  { value: "customer_orders", label: "客户订单数", operators: ["equals","gt","gte","lt","lte"], triggers: ["order_new","customer_new","scheduled","manual"] },
  { value: "total_spent", label: "客户总消费", operators: ["gt","gte","lt","lte"], triggers: ["order_new","customer_new","scheduled","manual"] },
  { value: "inventory_qty", label: "当前库存量", operators: ["lt","lte","gt","gte","equals"], triggers: ["inventory_low","scheduled"] },
  { value: "days_covered", label: "可售天数", operators: ["lt","lte","gt","gte"], triggers: ["inventory_low","scheduled"] },
  { value: "refund_amount", label: "退款金额", operators: ["gt","gte","lt","lte"], triggers: ["order_refund","scheduled"] },
  { value: "gateway", label: "支付网关", operators: ["equals","contains"], triggers: ["order_new","scheduled","manual"] },
  { value: "country", label: "目的地国家", operators: ["equals","contains"], triggers: ["order_new","scheduled","manual"] },
  { value: "tags", label: "是否含折扣码", operators: ["contains","not_contains"], triggers: ["order_new","scheduled","manual"] },
];

const ACTION_TYPES: Array<{ value: RuleAction["type"]; label: string; icon: React.ReactNode }> = [
  { value: "addOrderTag", label: "添加订单标签", icon: <Tag className="h-3 w-3" /> },
  { value: "addCustomerTag", label: "添加客户标签", icon: <Tag className="h-3 w-3" /> },
  { value: "addOrderNote", label: "添加订单备注", icon: <FileText className="h-3 w-3" /> },
  { value: "desktopNotify", label: "桌面通知", icon: <Bell className="h-3 w-3" /> },
  { value: "updateInventory", label: "修改库存", icon: <Zap className="h-3 w-3" /> },
  { value: "logOnly", label: "仅记录日志", icon: <FileText className="h-3 w-3" /> },
];

/* ─── Presets ─────────────────────────────────────────── */

const PRESET_RULES: Rule[] = [
  { id: "preset-1", name: "高价值新客标记", description: "新客户首单 > ¥500 自动标记", enabled: false, trigger: "order_new", conditions: [{ id: "c1", field: "customer_orders", operator: "equals", value: "1" }, { id: "c2", field: "total_price", operator: "gt", value: "500" }], conditionMode: "and", actions: [{ id: "a1", type: "addCustomerTag", config: { tag: "高价值新客" } }, { id: "a2", type: "addOrderNote", config: { note: "大单新客" } }], priority: 1, hitCount: 0, createdAt: new Date().toISOString() },
  { id: "preset-2", name: "退款风险预警", description: "退款 > ¥100 发桌面通知", enabled: false, trigger: "order_refund", conditions: [{ id: "c1", field: "refund_amount", operator: "gt", value: "100" }], conditionMode: "and", actions: [{ id: "a1", type: "desktopNotify", config: { message: "⚠️ {customer_name} 退款 ¥{amount}" } }], priority: 2, hitCount: 0, createdAt: new Date().toISOString() },
  { id: "preset-3", name: "库存告急通知", description: "可售天数 < 7 发通知", enabled: false, trigger: "inventory_low", conditions: [{ id: "c1", field: "days_covered", operator: "lt", value: "7" }], conditionMode: "and", actions: [{ id: "a1", type: "desktopNotify", config: { message: "📦 {product_name} 库存仅剩 {inventory} 件！" } }], priority: 3, hitCount: 0, createdAt: new Date().toISOString() },
  { id: "preset-4", name: "VIP 客户识别", description: "总消费 > ¥10000 标记 VIP", enabled: false, trigger: "order_new", conditions: [{ id: "c1", field: "total_spent", operator: "gt", value: "10000" }], conditionMode: "and", actions: [{ id: "a1", type: "addCustomerTag", config: { tag: "VIP" } }, { id: "a2", type: "addOrderNote", config: { note: "VIP 客户优先处理" } }], priority: 4, hitCount: 0, createdAt: new Date().toISOString() },
  { id: "preset-5", name: "复购客户感谢", description: "订单数 ≥ 3 打标签", enabled: false, trigger: "order_new", conditions: [{ id: "c1", field: "customer_orders", operator: "gte", value: "3" }], conditionMode: "and", actions: [{ id: "a1", type: "addCustomerTag", config: { tag: "复购客户" } }, { id: "a2", type: "addOrderNote", config: { note: "老客回购" } }], priority: 5, hitCount: 0, createdAt: new Date().toISOString() },
];

/* ─── Helpers ────────────────────────────────────────── */

function genId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function loadRules(): Rule[] { try { return JSON.parse(localStorage.getItem("local_rules") || "[]"); } catch { return []; } }
function saveRules(r: Rule[]) { localStorage.setItem("local_rules", JSON.stringify(r)); }
function loadLogs(): ExecutionLog[] { try { return JSON.parse(localStorage.getItem("rule_execution_log") || "[]"); } catch { return []; } }
function saveLogs(l: ExecutionLog[]) { if (l.length > 200) l = l.slice(0, 200); localStorage.setItem("rule_execution_log", JSON.stringify(l)); }

function evalCondition(v: any, c: Condition): boolean {
  const fv = String(v ?? "").toLowerCase(), cv = c.value.toLowerCase();
  switch (c.operator) {
    case "equals": return fv === cv;
    case "not_equals": return fv !== cv;
    case "gt": return Number(v) > Number(c.value);
    case "lt": return Number(v) < Number(c.value);
    case "gte": return Number(v) >= Number(c.value);
    case "lte": return Number(v) <= Number(c.value);
    case "contains": return fv.includes(cv);
    case "not_contains": return !fv.includes(cv);
    case "starts_with": return fv.startsWith(cv);
    default: return false;
  }
}

/* ─── Main Component ─────────────────────────────────── */

export default function RuleEnginePanel({ isDemo, shopUrl, accessToken, shopName, orders, customers, fullProducts }: RuleEnginePanelProps) {
  const [rules, setRules] = useState<Rule[]>(() => {
    if (isDemo) return PRESET_RULES.map((r) => ({ ...r, enabled: true }));
    else { const saved = loadRules(); return saved.length > 0 ? saved : PRESET_RULES; }
  });
  const [logs, setLogs] = useState<ExecutionLog[]>(() => loadLogs());
  const [modalRule, setModalRule] = useState<Rule | null>(null);
  const [modalStep, setModalStep] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dedupMap, setDedupMap] = useState<Record<string, number>>({});
  const dragRef = useRef<{ id: string; idx: number } | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* ── Persist ──────────────────────────────────────── */
  useEffect(() => { if (!isDemo) saveRules(rules); }, [rules, isDemo]);

  /* ── Heartbeat ────────────────────────────────────── */
  const triggerRule = useCallback(async (rule: Rule, targetInfo: { name: string; data: Record<string, any> }) => {
    // dedup
    const dedupKey = `${rule.id}|${targetInfo.name}`;
    const last = dedupMap[dedupKey];
    if (last && Date.now() - last < 3600000) return;
    setDedupMap((p) => ({ ...p, [dedupKey]: Date.now() }));

    let allOk = true;
    for (const act of rule.actions) {
      try {
        if (act.type === "desktopNotify") {
          const msg = act.config.message?.replace(/\{(\w+)\}/g, (_, k) => targetInfo.data[k] ?? "");
          if (Notification.permission === "granted") new Notification(rule.name, { body: msg });
        } else if (act.type === "addCustomerTag") {
          if (!isDemo) await fetch("/api/shopify/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateCustomerTags", shopUrl, accessToken, customerId: targetInfo.data.customer_id, tag: act.config.tag }) });
        } else if (act.type === "addOrderTag") {
          if (!isDemo) await fetch("/api/shopify/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateOrderTags", shopUrl, accessToken, orderId: targetInfo.data.order_id, tags: [act.config.tag] }) });
        } else if (act.type === "addOrderNote") {
          if (!isDemo) await fetch("/api/shopify/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateOrderNote", shopUrl, accessToken, orderId: targetInfo.data.order_id, note: act.config.note }) });
        }
      } catch { allOk = false; }
    }

    const entry: ExecutionLog = { id: genId(), timestamp: new Date().toISOString(), ruleName: rule.name, targetName: targetInfo.name, success: allOk, summary: `${allOk ? "✅" : "⚠️"} 执行${rule.actions.length}个动作` };
    setLogs((p) => { const n = [entry, ...p]; saveLogs(n); return n; });
    setRules((p) => p.map((r) => r.id === rule.id ? { ...r, hitCount: r.hitCount + 1, lastTriggered: new Date().toISOString() } : r));
    if (isDemo) showToast(`规则"${rule.name}"已触发 (演示)`);
  }, [dedupMap, isDemo, shopUrl, accessToken]);

  useEffect(() => {
    if (!isDemo && rules.filter((r) => r.enabled).length === 0) return;
    const interval = setInterval(() => {
      const candidates = isDemo ? generateDemoCandidates() : [];
      rules.filter((r) => r.enabled).forEach((rule) => {
        for (const c of candidates) {
          let matched = rule.conditionMode === "and";
          for (const cond of rule.conditions) {
            const val = c.data[cond.field] ?? "";
            const ok = evalCondition(val, cond);
            if (rule.conditionMode === "and" && !ok) { matched = false; break; }
            if (rule.conditionMode === "or" && ok) { matched = true; break; }
          }
          if (rule.conditions.length === 0) matched = true;
          if (matched) triggerRule(rule, c);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [rules, isDemo, triggerRule]);

  /* ── Wizard ────────────────────────────────────────── */
  const openCreate = () => { setModalRule({ id: "", name: "", description: "", enabled: true, trigger: "order_new", conditions: [], conditionMode: "and", actions: [], priority: rules.length + 1, hitCount: 0, createdAt: new Date().toISOString() }); setModalStep(0); };
  const openEdit = (r: Rule) => { setModalRule({ ...r }); setModalStep(0); };
  const saveModal = () => { if (!modalRule || !modalRule.name.trim()) return; const saved: Rule = { ...modalRule, id: modalRule.id || genId() }; setRules((p) => { const idx = p.findIndex((r) => r.id === saved.id); if (idx >= 0) return p.map((r, i) => i === idx ? saved : r); return [...p, saved]; }); setModalRule(null); showToast("规则已保存"); };
  const deleteRule = (id: string) => { setRules((p) => p.filter((r) => r.id !== id)); showToast("已删除"); };
  const toggleRule = (id: string) => { setRules((p) => p.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r)); };

  // Drag reorder
  const handleDragStart = (id: string, idx: number) => { dragRef.current = { id, idx }; };
  const handleDrop = (targetIdx: number) => {
    if (!dragRef.current || dragRef.current.idx === targetIdx) return;
    setRules((p) => {
      const arr = [...p];
      const [item] = arr.splice(dragRef.current!.idx, 1);
      arr.splice(targetIdx, 0, item);
      return arr.map((r, i) => ({ ...r, priority: i + 1 }));
    });
    dragRef.current = null;
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Workflow className="h-6 w-6 text-violet-400" />规则引擎</h2>
          <p className="mt-1 text-sm text-muted-foreground">{shopName} · {rules.length} 条规则 · {logs.length} 条日志{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 gap-1 bg-violet-600 hover:bg-violet-500 text-white text-xs"><Plus className="h-3 w-3"/>创建规则</Button>
      </div>

      {rules.length === 0 && <div className="text-center py-16"><Workflow className="h-12 w-12 mx-auto mb-3 text-muted-foreground/25"/><p className="text-sm text-muted-foreground">暂无规则</p></div>}

      <div className="space-y-2">
        {[...rules].sort((a, b) => a.priority - b.priority).map((rule, idx) => (
          <Card key={rule.id} className={`border-border/40 bg-card/60 shadow-lg backdrop-blur-lg ${!rule.enabled ? "opacity-50" : ""}`}
            draggable onDragStart={() => handleDragStart(rule.id, idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(idx)}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/40 cursor-grab shrink-0" />
                <button onClick={() => toggleRule(rule.id)} className={`mt-0.5 w-9 h-5 rounded-full relative transition-colors shrink-0 ${rule.enabled ? "bg-violet-500" : "bg-zinc-600"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${rule.enabled ? "left-4" : "left-0.5"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
                    <Badge className="text-[9px] px-1.5 py-0 bg-violet-500/15 text-violet-400">{TRIGGER_LABELS[rule.trigger]}</Badge>
                    <Badge className="text-[9px] px-1.5 py-0 bg-muted/20 text-muted-foreground">{RULE_TYPE_MAP[rule.trigger] === "order" ? "订单规则" : RULE_TYPE_MAP[rule.trigger] === "inventory" ? "库存规则" : RULE_TYPE_MAP[rule.trigger] === "customer" ? "客户规则" : "退款规则"}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{rule.description || "—"}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>⬆ {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString("zh-CN") : "从未"}</span>
                    <span>触发 {rule.hitCount} 次</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)} className="h-7 w-7 p-0">{expandedId === rule.id ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} className="h-7 w-7 p-0"><Edit3 className="h-3.5 w-3.5 text-muted-foreground"/></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteRule(rule.id)} className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400"/></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { const c = generateDemoCandidates()[0]; if (c) await triggerRule(rule, c); else showToast("无匹配数据"); }} className="h-7 w-7 p-0"><Play className="h-3.5 w-3.5 text-violet-400"/></Button>
                </div>
              </div>

              {/* Expanded: conditions + actions summary */}
              {expandedId === rule.id && (
                <div className="mt-2 pt-2 border-t border-border/20 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground"><span className="font-semibold">条件 ({rule.conditionMode === "and" ? "AND" : "OR"}):</span> {rule.conditions.length > 0 ? rule.conditions.map((c) => `${FIELDS.find((f) => f.value === c.field)?.label || c.field} ${OPERATORS[c.operator] || c.operator} ${c.value}`).join(", ") : "无条件(始终匹配)"}</p>
                  <p className="text-[10px] text-muted-foreground"><span className="font-semibold">动作:</span> {rule.actions.length > 0 ? rule.actions.map((a) => ACTION_TYPES.find((at) => at.value === a.type)?.label || a.type).join(" → ") : "无动作"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal */}
      {modalRule && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setModalRule(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl max-h-[85vh] bg-card border border-border/40 rounded-xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 shrink-0"><h3 className="text-sm font-semibold">{modalRule.id ? "编辑规则" : "创建规则"}</h3><Button size="sm" variant="ghost" onClick={() => setModalRule(null)}><X className="h-4 w-4"/></Button></div>
              <div className="flex gap-1 px-5 py-2 border-b border-border/20 shrink-0">{[{l:"触发器"}, {l:"条件"}, {l:"动作"}].map((s, i) => (<button key={i} onClick={() => setModalStep(i)} className={`px-3 py-1 rounded text-[10px] font-medium ${modalStep === i ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground"}`}>{i+1}. {s.l}</button>))}</div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">

                {/* Step 0: Trigger */}
                {modalStep === 0 && (<>
                  <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">规则名称 *</label><Input value={modalRule.name} onChange={(e) => setModalRule({ ...modalRule, name: e.target.value })} autoFocus className="h-9 text-sm" /></div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">描述</label><Input value={modalRule.description} onChange={(e) => setModalRule({ ...modalRule, description: e.target.value })} className="h-9 text-sm" /></div>
                  <div><label className="text-[10px] font-semibold text-muted-foreground mb-0.5 block">触发器</label>
                    <select value={modalRule.trigger} onChange={(e) => setModalRule({ ...modalRule, trigger: e.target.value as TriggerType })} className="h-9 w-full rounded border border-border/40 bg-background px-3 text-sm text-foreground">
                      {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={modalRule.enabled} onChange={() => setModalRule({ ...modalRule, enabled: !modalRule.enabled })} className="accent-violet-500"/>启用规则</label>
                </>)}

                {/* Step 1: Conditions */}
                {modalStep === 1 && (<>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">模式:</span>
                    <button onClick={() => setModalRule({ ...modalRule, conditionMode: "and" })} className={`px-2 py-0.5 text-[10px] rounded ${modalRule.conditionMode === "and" ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground"}`}>AND (全部满足)</button>
                    <button onClick={() => setModalRule({ ...modalRule, conditionMode: "or" })} className={`px-2 py-0.5 text-[10px] rounded ${modalRule.conditionMode === "or" ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground"}`}>OR (任一满足)</button>
                  </div>
                  <div className="rounded-lg border border-border/20 bg-muted/10 p-3 space-y-2">
                    {modalRule.conditions.map((c) => {
                      const fields = FIELDS.filter((f) => f.triggers.includes(modalRule.trigger));
                      const field = fields.find((f) => f.value === c.field);
                      const ops = field?.operators || ["equals"];
                      return (
                        <div key={c.id} className="flex items-center gap-1.5">
                          <select value={c.field} onChange={(e) => { const newField = e.target.value; const newOps = fields.find((f) => f.value === newField)?.operators[0] || "equals"; setModalRule({ ...modalRule, conditions: modalRule.conditions.map((x) => x.id === c.id ? { ...x, field: newField, operator: newOps } : x) }); }} className="h-7 rounded border border-border/30 bg-background text-[10px] text-foreground px-1.5 flex-1">
                            {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <select value={c.operator} onChange={(e) => setModalRule({ ...modalRule, conditions: modalRule.conditions.map((x) => x.id === c.id ? { ...x, operator: e.target.value } : x) })} className="h-7 rounded border border-border/30 bg-background text-[10px] text-foreground px-1 w-20">
                            {ops.map((op) => <option key={op} value={op}>{OPERATORS[op] || op}</option>)}
                          </select>
                          <Input value={c.value} onChange={(e) => setModalRule({ ...modalRule, conditions: modalRule.conditions.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x) })} className="h-7 text-[10px] w-24" />
                          <button onClick={() => setModalRule({ ...modalRule, conditions: modalRule.conditions.filter((x) => x.id !== c.id) })} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                    <Button size="sm" variant="ghost" onClick={() => setModalRule({ ...modalRule, conditions: [...modalRule.conditions, { id: genId(), field: "total_price", operator: "gt", value: "" }] })} className="h-7 gap-1 text-[10px]"><Plus className="h-3 w-3"/>添加条件</Button>
                  </div>
                </>)}

                {/* Step 2: Actions */}
                {modalStep === 2 && (<>
                  <div className="space-y-2">
                    {modalRule.actions.map((a) => (
                      <div key={a.id} className="rounded-lg border border-border/20 bg-muted/10 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <select value={a.type} onChange={(e) => setModalRule({ ...modalRule, actions: modalRule.actions.map((x) => x.id === a.id ? { ...x, type: e.target.value as RuleAction["type"], config: {} } : x) })} className="h-7 rounded border border-border/30 bg-background text-[10px] text-foreground px-1.5 flex-1">
                            {ACTION_TYPES.map((at) => <option key={at.value} value={at.value}>{at.label}</option>)}
                          </select>
                          <button onClick={() => setModalRule({ ...modalRule, actions: modalRule.actions.filter((x) => x.id !== a.id) })} className="text-muted-foreground hover:text-red-400 ml-2"><X className="h-3 w-3"/></button>
                        </div>
                        {a.type === "desktopNotify" && <Input value={a.config.message || ""} onChange={(e) => setModalRule({ ...modalRule, actions: modalRule.actions.map((x) => x.id === a.id ? { ...x, config: { message: e.target.value } } : x) })} placeholder="通知文案，支持 {order_id} {customer_name} {amount}" className="h-8 text-xs"/>}
                        {(a.type === "addOrderTag" || a.type === "addCustomerTag") && <Input value={a.config.tag || ""} onChange={(e) => setModalRule({ ...modalRule, actions: modalRule.actions.map((x) => x.id === a.id ? { ...x, config: { tag: e.target.value } } : x) })} placeholder="标签名" className="h-8 text-xs"/>}
                        {a.type === "addOrderNote" && <Input value={a.config.note || ""} onChange={(e) => setModalRule({ ...modalRule, actions: modalRule.actions.map((x) => x.id === a.id ? { ...x, config: { note: e.target.value } } : x) })} placeholder="备注内容" className="h-8 text-xs"/>}
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setModalRule({ ...modalRule, actions: [...modalRule.actions, { id: genId(), type: "addCustomerTag", config: {} }] })} className="h-7 gap-1 text-[10px]"><Plus className="h-3 w-3"/>添加动作</Button>
                  </div>
                </>)}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/20 shrink-0">
                <div className="flex gap-1">{[0,1,2].map((s) => <span key={s} className={`h-1.5 w-6 rounded ${modalStep >= s ? "bg-violet-500" : "bg-muted/20"}`}/>)}</div>
                <div className="flex gap-2">
                  {modalStep > 0 && <Button variant="outline" onClick={() => setModalStep((s) => s - 1)} className="h-9 text-xs">上一步</Button>}
                  {modalStep < 2 ? <Button onClick={() => setModalStep((s) => s + 1)} className="h-9 text-xs bg-violet-600 text-white">下一步</Button> : <Button onClick={saveModal} disabled={!modalRule.name.trim()} className="h-9 gap-1 bg-emerald-600 text-white text-xs"><Save className="h-3 w-3"/>保存规则</Button>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent logs */}
      <details className="group">
        <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer flex items-center gap-1">执行日志 ({logs.length}) <ChevronDown className="h-3 w-3 group-open:rotate-180"/></summary>
        <div className="space-y-0.5 mt-2 max-h-48 overflow-y-auto">
          {logs.length === 0 ? <p className="text-[10px] text-muted-foreground/50">暂无执行记录</p> :
            logs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-[10px] py-0.5">
                <span>{l.success ? "✅" : "❌"}</span>
                <span className="text-muted-foreground tabular-nums">{new Date(l.timestamp).toLocaleString("zh-CN")}</span>
                <span className="text-violet-400 font-medium">{l.ruleName}</span>
                <span className="text-muted-foreground">{l.targetName}</span>
                <span className="truncate flex-1">{l.summary}</span>
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}

/* ─── Demo candidate generator ────────────────────────── */

function generateDemoCandidates(): Array<{ name: string; data: Record<string, unknown> }> {
  const now = Date.now();
  const candidates: Array<{ name: string; data: Record<string, unknown> }> = [];

  // Only generate ~30% of the time to simulate sporadic matches
  if (Math.random() > 0.3) return candidates;

  // New order
  candidates.push({
    name: "订单 #" + Math.floor(1000 + Math.random() * 9000),
    data: {
      total_price: Math.round(Math.random() * 2000 + 50),
      item_count: Math.ceil(Math.random() * 5),
      customer_orders: Math.random() > 0.7 ? "1" : String(Math.ceil(Math.random() * 8)),
      total_spent: Math.round(Math.random() * 50000),
      gateway: Math.random() > 0.5 ? "stripe" : "paypal",
      country: Math.random() > 0.3 ? "US" : "DE",
      customer_name: "Demo Customer",
      customer_id: Math.floor(Math.random() * 10000),
      order_id: Math.floor(Math.random() * 100000),
      tags: Math.random() > 0.7 ? "discount" : "",
      amount: Math.round(Math.random() * 500),
    },
  });

  // Refund (less frequently)
  if (Math.random() > 0.6) {
    candidates.push({
      name: "退款订单 #R" + Math.floor(1000 + Math.random() * 9000),
      data: {
        refund_amount: Math.round(Math.random() * 300 + 20),
        customer_name: "Refund Customer",
        amount: Math.round(Math.random() * 300),
        reason: "尺寸不合适",
      },
    });
  }

  return candidates;
}
