"use client";

import { useState, useMemo } from "react";
import { Users, Search, Download, X, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { type CustomerRFM, type SegmentStats, type RFMThresholds, computeRFM, computeSegmentStats, getMarketingSuggestions, generateDemoRFM, DEFAULT_THRESHOLDS, SEGMENT_CONFIG } from "@/lib/rfm-analytics";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

interface CustomerSegmentationPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  orders?: { customer: { id: number; first_name?: string; last_name?: string; email?: string }; customer_id?: number; total_price: number; created_at: string }[];
  customers?: { id: number; first_name?: string; last_name?: string; email?: string; default_address?: { country?: string } }[];
}

export default function CustomerSegmentationPanel({ isDemo, shopUrl, accessToken, shopName, orders, customers }: CustomerSegmentationPanelProps) {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [showConfig, setShowConfig] = useState(false);
  const [filterSegment, setFilterSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(0);
  const [showMigration, setShowMigration] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(function () { setToast(""); }, 3000); };

  const data = useMemo(function () { return isDemo ? generateDemoRFM() : computeRFM(orders || [], customers || [], thresholds); }, [isDemo, orders, customers, thresholds]);
  const segments = useMemo(function () { return computeSegmentStats(data); }, [data]);
  const suggestions = useMemo(function () { return getMarketingSuggestions(segments); }, [segments]);

  const filtered = useMemo(function () {
    var list = data;
    if (filterSegment !== "all") list = list.filter(function (c) { return c.segment === filterSegment; });
    if (search) { var q = search.toLowerCase(); list = list.filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1 || c.email.toLowerCase().indexOf(q) !== -1; }); }
    return list;
  }, [data, filterSegment, search]);

  const pyramidData = useMemo(function () {
    return segments.map(function (s) { return { name: s.label, count: s.count, gmv: Math.round(s.totalSpent * EXCHANGE_RATE), fill: s.color }; });
  }, [segments]);

  const trendData = useMemo(function () {
    var months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
    return months.map(function (m) {
      var entry: Record<string, unknown> = { month: m };
      segments.forEach(function (s) { var key = s.segment; entry[key] = Math.round(s.count * (0.7 + Math.random() * 0.6)); });
      return entry;
    });
  }, [segments]);

  const exportCSV = function () {
    var rows = filtered.map(function (c) { return [c.name, c.email, String(c.rScore), String(c.fScore), String(c.mScore), String(c.composite), String(c.totalSpent), String(c.orderCount), String(c.lastOrderDays), SEGMENT_CONFIG[c.segment].label]; });
    var csv = "\uFEFF" + [["姓名","邮箱","R","F","M","总分","累计消费","订单数","距上次","群体"]].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g,'""') + '"'; }).join(","); }).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = shopName + "_客户分层.csv";
    a.click();
    showToast("已导出");
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Users className="h-6 w-6 text-cyan-400" />客户分层 RFM</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName} · {data.length} 位客户{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p></div>
        <Button size="sm" variant="outline" onClick={function () { setShowConfig(true); }} className="h-9 gap-1 text-sm"><Settings className="h-3 w-3"/>阈值</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { v: data.length, l: "总客户数" },
          { v: segments[0]?.count || 0, l: "🟢 核心客户", c: "text-emerald-400" },
          { v: segments[4]?.count || 0, l: "🔴 流失风险", c: "text-red-400" },
          { v: "¥" + Math.round(segments.reduce(function (s, x) { return s + x.totalSpent; }, 0) / (data.length || 1)), l: "平均 LTV" },
        ].map(function (s, i) {
          return <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-3 text-center"><p className={"text-xl font-bold tabular-nums " + (s.c || "")}>{s.v}</p><p className="text-xs text-muted-foreground">{s.l}</p></CardContent></Card>;
        })}
      </div>

      {/* Customer Pyramid */}
      <Card className="border-border/40 bg-card/60"><CardContent className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">客户金字塔</p>
        <div className="space-y-1">
          {pyramidData.map(function (l) {
            return <div key={l.name} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-right text-muted-foreground">{l.name}</span>
              <div className="flex-1 h-5 rounded overflow-hidden bg-muted/10">
                <div className="h-full flex items-center justify-end px-1.5 text-white font-semibold text-[9px] rounded transition-all" style={{ width: Math.max(2, (l.count / (data.length || 1)) * 100) + "%", background: l.fill === "text-emerald-400" ? "#22c55e" : l.fill === "text-blue-400" ? "#3b82f6" : l.fill === "text-amber-400" ? "#f59e0b" : l.fill === "text-orange-400" ? "#f97316" : l.fill === "text-red-400" ? "#ef4444" : "#71717a" }}>{l.count}人</div>
              </div>
              <span className="w-14 text-right text-muted-foreground">{formatCny(l.gmv)}</span>
            </div>;
          })}
        </div>
      </CardContent></Card>

      {/* Toolbar */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <div className="relative flex-1 min-w-[100px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={function (e) { setSearch(e.target.value); }} placeholder="搜索客户..." className="h-7 pl-7 text-sm" /></div>
        <select value={filterSegment} onChange={function (e) { setFilterSegment(e.target.value); }} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="all">全部群体</option>{segments.map(function (s) { return <option key={s.segment} value={s.segment}>{s.emoji} {s.label}</option>; })}</select>
        <Button size="sm" variant="outline" onClick={function () { setShowMigration(!showMigration); }} className="h-7 text-xs">{showMigration ? "隐藏迁徙" : "迁徙矩阵"}</Button>
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 text-xs gap-1"><Download className="h-3 w-3"/>导出</Button>
      </CardContent></Card>

      {/* Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg overflow-x-auto"><CardContent className="p-0">
        <table className="w-full text-sm min-w-[650px]">
          <thead><tr className="border-b border-border/20 text-xs font-semibold text-muted-foreground"><th className="py-2 pl-3 text-left">客户</th><th className="py-2 px-2 text-center w-6">R</th><th className="py-2 px-2 text-center w-6">F</th><th className="py-2 px-2 text-center w-6">M</th><th className="py-2 px-2 text-center w-8">总分</th><th className="py-2 px-2 text-right">消费¥</th><th className="py-2 px-2 text-right">订单</th><th className="py-2 px-2 text-right">距上次</th><th className="py-2 px-2 text-center">群体</th></tr></thead>
          <tbody>
            {filtered.slice(0, 50).map(function (c) {
              var cfg = SEGMENT_CONFIG[c.segment];
              var isExpanded = expandedId === c.customerId;
              return <tr key={c.customerId} className="border-b border-border/10 hover:bg-muted/5 cursor-pointer" onClick={function () { setExpandedId(isExpanded ? 0 : c.customerId); }}>
                <td className="py-2 pl-3"><p className="truncate max-w-[120px] text-foreground">{c.name}</p><p className="text-[9px] text-muted-foreground">{c.email}</p></td>
                <td className="py-2 px-2 text-center tabular-nums font-semibold">{c.rScore}</td>
                <td className="py-2 px-2 text-center tabular-nums">{c.fScore}</td>
                <td className="py-2 px-2 text-center tabular-nums">{c.mScore}</td>
                <td className="py-2 px-2 text-center font-bold text-cyan-400 tabular-nums">{c.composite}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatCny(c.totalSpent * EXCHANGE_RATE)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{c.orderCount}</td>
                <td className="py-2 px-2 text-right tabular-nums">{c.lastOrderDays}天</td>
                <td className="py-2 px-2 text-center"><Badge className={"text-[8px] px-1 py-0 " + cfg.bg + " " + cfg.color}>{cfg.emoji}</Badge></td>
              </tr>;
            })}
          </tbody>
        </table>
      </CardContent></Card>

      {/* Expanded Detail */}
      {expandedId !== 0 && (function () {
        var c = data.find(function (x) { return x.customerId === expandedId; });
        if (!c) return null;
        return <Card className="border-border/40 bg-card/60 border-l-2 border-l-cyan-500"><CardContent className="p-3 grid grid-cols-4 gap-2 text-xs"><p><span className="text-muted-foreground">首次购买:</span> {new Date(c.firstOrderDate).toLocaleDateString("zh-CN")}</p><p><span className="text-muted-foreground">平均客单:</span> {formatCny(c.avgOrderValue * EXCHANGE_RATE)}</p><p><span className="text-muted-foreground">国家:</span> {c.country || "—"}</p><p><span className="text-muted-foreground">LTV:</span> {formatCny(c.totalSpent * EXCHANGE_RATE)}</p></CardContent></Card>;
      })()}

      {/* Migration Matrix */}
      {showMigration && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">客户迁徙矩阵 (上期 → 本期)</p>
          <p className="text-xs text-muted-foreground">迁徙矩阵需要两期订单数据对比，请在真实模式下使用。</p>
        </CardContent></Card>
      )}

      {/* Trend Chart */}
      <Card className="border-border/40 bg-card/60"><CardContent className="p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-1">群体趋势 (近12月·模拟)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" /><XAxis dataKey="month" stroke="#71717a" tick={{fontSize:9}} /><YAxis stroke="#71717a" tick={{fontSize:9}} /><Tooltip contentStyle={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:6,fontSize:10}} />
            {segments.map(function (s) {
              var sc = s.color === "text-emerald-400" ? "#22c55e" : s.color === "text-blue-400" ? "#3b82f6" : s.color === "text-amber-400" ? "#f59e0b" : s.color === "text-orange-400" ? "#f97316" : s.color === "text-red-400" ? "#ef4444" : "#71717a";
              return <Line key={s.segment} type="monotone" dataKey={s.segment} stroke={sc} strokeWidth={1.5} dot={false} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent></Card>

      {/* Marketing Suggestions */}
      <Card className="border-border/40 bg-card/60"><CardContent className="p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">精准营销建议</p>
        {suggestions.map(function (sg, i) {
          var cfg = SEGMENT_CONFIG[sg.segment];
          return <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/10 text-xs">
            <span className="text-lg">{cfg.emoji}</span>
            <div className="flex-1"><p className="font-semibold text-foreground">{sg.title}</p><p className="text-muted-foreground">{sg.body}</p><p className="text-muted-foreground/70 mt-0.5">预估触达: <span className="text-cyan-400">{sg.reachCount}</span> 人</p></div>
          </div>;
        })}
      </CardContent></Card>

      {/* Threshold Config Modal */}
      {showConfig && (
        <div>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={function () { setShowConfig(false); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-card border border-border/40 rounded-xl shadow-2xl p-5 space-y-3">
              <h3 className="text-base font-semibold">RFM 阈值配置</h3>
              {(["r","f","m"] as const).map(function (dim) {
                return <div key={dim} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{dim === "r" ? "R·Recency (天数≤)" : dim === "f" ? "F·Frequency (次数≥)" : "M·Monetary (金额≥ ¥)"}</p>
                  <div className="flex gap-1">
                    {thresholds[dim].map(function (v, i) {
                      return <Input key={i} type="number" value={v} onChange={function (e) { var arr = thresholds[dim].slice(); arr[i] = Number(e.target.value) || 0; setThresholds({ ...thresholds, [dim]: arr }); }} className="h-7 text-sm w-16" />;
                    })}
                  </div>
                </div>;
              })}
              <Button onClick={function () { setShowConfig(false); showToast("阈值已更新"); }} className="w-full h-9 text-sm bg-cyan-600 text-white">确认</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
