"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Brain, Send, Copy, Download, X, ChevronDown, Sparkles, Trash2, Globe, Package, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface ChatMessage {
  role: "user" | "ai"; content: string; timestamp: number;
  dataSource?: string; scope?: string;
}

interface AiChatPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  metrics?: Record<string, unknown>;
  storeNames?: string[];
}

/* ─── Demo responses ──────────────────────────────────── */

const DEMO_RESPONSES: Record<string, string> = {
  "gmv": "根据近30天数据分析，店铺 GMV 总计 ¥52,800（折合 ¥383,856），日均 ¥1,760。\n\n📊 **关键发现：**\n• 周中（周三-周五）GMV最高，周日最低（季节性波动 ±18%）\n• 近7天趋势 ↑+8%，高于30日均值\n• TOP3 商品贡献了 62% GMV：无线耳机(28%)、智能手表(22%)、碳纤维手表(12%)\n\n💡 **建议：** 加大TOP3商品的广告投放，预计可提升 GMV 10-15%。\n\n---\n*数据来源：2026-07-06 全店数据快照*",
  "return": "退货率分析完成。全店30天退货率 **3.8%**，低于行业均值（5-7%）。\n\n📉 **退货热点：**\n• 机械键盘 K8 退货率最高 8.5%（与轴体偏好不符有关）\n• 服装品类退货率 12.3%（尺码问题为主）\n• 美国市场退货率 4.2%，高于日本 2.1%\n\n⚠️ **风险提示：** 退货率周增长 +0.5%，需关注趋势。\n\n💡 **建议：** 1. 键盘商品页增加轴体对比指南 2. 服装增加详细尺码表和试穿视频 3. 设置退货率阈值 8%，自动暂停高退货SKU广告。\n\n---\n*数据来源：2026-07-06 全店数据快照*",
  "profit": "利润诊断报告：\n\n💰 **整体利润：** 近30天净利润 ¥18,900，利润率 **35.8%**，高于行业均值（25-30%）。\n\n📊 **成本结构：**\n• 采购成本：45%（偏高，建议优化供应链）\n• 物流成本：12%（正常）\n• 网关费：3.5%\n• 广告成本：8%（回报率 MER 3.2x）\n\n🟢 **高利润品类：** 音频设备（42%利润率）\n🔴 **低利润品类：** 服装（18%利润率，退货率拖累）\n\n💡 **建议：** 服装品类若无法将退货率降至 8% 以下，建议缩减 SKU 数量。\n\n---\n*数据来源：2026-07-06 全店数据快照*",
  "top10": "📦 **热销 TOP10（近30天）：**\n1. 无线降噪耳机 SonicFlow — 85件 · ¥12,500 · 利润率38%\n2. 智能手表 S3 — 42件 · ¥8,900 · 利润率25%\n3. 碳纤维手表 Chrono X — 38件 · ¥11,400 · 利润率32%\n4. 北欧台灯 LUX — 25件 · ¥2,000 · 利润率41%\n5. 机械键盘 K8 — 22件 · ¥2,860 · 利润率28%\n\n🔥 上升最快：无线耳机（+12% 周增长）\n📉 下降最快：服装品类 T恤（-8% 周增长）\n\n---\n*数据来源：2026-07-06 全店数据快照*",
  "compare": "🏪 **多店对比分析（TechGear vs MinimalHome）：**\n\n| 指标 | TechGear | MinimalHome | 差异 |\n|------|----------|-------------|------|\n| GMV | ¥41,800 | ¥11,000 | TechGear +280% |\n| 利润率 | 38% | 28% | TechGear +10pp |\n| 退货率 | 3.2% | 5.8% | MinimalHome 偏高 |\n| 客单价 | ¥245 | ¥89 | TechGear +175% |\n\n📊 **分析结论：** MinimalHome 客单价低但退货率高，主要受服装品类12.3%退货率拖累。建议该店铺聚焦家居品类（退货率仅2.1%）。\n\n---\n*数据来源：2026-07-06 双店数据对比*",
};

const QUICK_PROMPTS = [
  { key: "gmv", label: "📊 GMV 概览" },
  { key: "return", label: "📉 退货分析" },
  { key: "profit", label: "💰 利润诊断" },
  { key: "top10", label: "📦 热销 TOP10" },
  { key: "compare", label: "🏪 多店对比" },
];

/* ─── Component ───────────────────────────────────────── */

export default function AiChatPanel({ isDemo, shopUrl, accessToken, shopName, metrics, storeNames }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(function () {
    try {
      var saved = localStorage.getItem("ai_chat_history");
      if (saved) return JSON.parse(saved) as ChatMessage[];
    } catch { }
    return [
      { role: "ai", content: "你好！我是运营助手。我可以帮你：\n📊 分析 GMV/利润/退货趋势\n📦 对比多家店铺业绩差异\n📈 诊断特定品类或商品表现\n💡 生成营销/备货/定价建议\n\n请直接提问，或点击下方快捷按钮 👇", timestamp: Date.now() },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState("all");
  const [compareStore, setCompareStore] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(function () {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist chat
  useEffect(function () {
    try { localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-50))); } catch { }
  }, [messages]);

  const addMessage = useCallback(function (role: "user" | "ai", content: string, scopeLabel?: string) {
    setMessages(function (prev) { return [...prev, { role, content, timestamp: Date.now(), scope: scopeLabel }]; });
  }, []);

  const clearChat = function () {
    setMessages([{ role: "ai", content: "对话已清除。有什么我可以帮你的？", timestamp: Date.now(), dataSource: "" }]);
    try { localStorage.removeItem("ai_chat_history"); } catch { }
  };

  const sendMessage = async function (text: string) {
    var trimmed = text.trim();
    if (!trimmed || loading) return;
    addMessage("user", trimmed, scope === "all" ? "全店" : scope);
    setInput("");
    setLoading(true);

    if (isDemo) {
      // Demo: match quick prompt keywords
      await new Promise(function (r) { setTimeout(r, 800); });
      var response = DEMO_RESPONSES["gmv"]; // default fallback
      for (var k in DEMO_RESPONSES) {
        if (trimmed.indexOf(k) !== -1 || trimmed.indexOf(QUICK_PROMPTS.find(function (p) { return p.key === k; })?.label || "") !== -1) {
          response = DEMO_RESPONSES[k]; break;
        }
      }
      addMessage("ai", response, scope === "all" ? "全店" : scope);
      setLoading(false);
      return;
    }

    // Real mode: POST to backend with conversation history
    try {
      var recentHistory = messages.slice(-10).map(function (m) { return { role: m.role, content: m.content }; });
      recentHistory.push({ role: "user", content: trimmed });

      var res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aiChat",
          shopUrl, accessToken,
          messages: recentHistory,
          scope: scope,
          compareStoreId: compareStore || undefined,
        }),
      });
      var json = await res.json();
      if (json.success) {
        addMessage("ai", json.reply, json.dataSource);
      } else {
        addMessage("ai", "抱歉，分析请求失败：" + (json.error || "未知错误"));
      }
    } catch {
      addMessage("ai", "网络错误，请稍后重试。");
    }
    setLoading(false);
  };

  const handleKeyDown = function (e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const copyMessage = function (content: string) {
    navigator.clipboard.writeText(content).then(function () { }).catch(function () { });
  };

  const exportMessage = function (content: string) {
    var blob = new Blob([content], { type: "text/markdown" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ai_report_" + new Date().toISOString().slice(0, 10) + ".md"; a.click();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Brain className="h-6 w-6 text-green-400" />AI 运营助手</h2>
          <p className="mt-1 text-sm text-muted-foreground">{shopName}{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope selector */}
          <select value={scope} onChange={function (e) { setScope(e.target.value); }} className="h-7 rounded border border-border/40 bg-background text-xs px-1">
            <option value="all">全店分析</option>
            <option value="category">按品类</option>
            <option value="product">按商品</option>
            <option value="market">按市场</option>
          </select>
          {storeNames && storeNames.length >= 2 && (
            <select value={compareStore} onChange={function (e) { setCompareStore(e.target.value); }} className="h-7 rounded border border-border/40 bg-background text-xs px-1">
              <option value="">单店模式</option>
              {storeNames.map(function (s) { return <option key={s} value={s}>对比 {s}</option>; })}
            </select>
          )}
          <Button size="sm" variant="ghost" onClick={clearChat} className="h-7 text-xs text-muted-foreground"><Trash2 className="h-3 w-3"/></Button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {QUICK_PROMPTS.map(function (p) {
          return (
            <button key={p.key} onClick={function () { sendMessage(p.label); }} className="px-2.5 py-1 rounded-full text-xs border border-border/40 bg-muted/10 hover:bg-green-500/10 hover:border-green-500/30 transition-colors">
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 border-border/40 bg-card/60 overflow-hidden"><CardContent className="p-3 h-full overflow-y-auto space-y-3">
        {messages.map(function (msg, i) {
          var isAI = msg.role === "ai";
          return (
            <div key={i} className={"flex gap-2 " + (isAI ? "" : "flex-row-reverse")}>
              <div className={"shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold " + (isAI ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400")}>
                {isAI ? "AI" : "👤"}
              </div>
              <div className={"max-w-[80%] space-y-1 " + (isAI ? "" : "text-right")}>
                <div className={"rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap " + (isAI ? "bg-green-500/10 text-foreground rounded-tl-sm" : "bg-zinc-500/10 text-foreground rounded-tr-sm")}>
                  {msg.content}
                </div>
                {isAI && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px] text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                    {msg.scope && <Badge className="text-[7px] px-1 py-0 bg-muted/20 text-muted-foreground">{msg.scope}</Badge>}
                    <button onClick={function () { copyMessage(msg.content); }} className="text-[8px] text-muted-foreground hover:text-foreground"><Copy className="h-2.5 w-2.5" /></button>
                    <button onClick={function () { exportMessage(msg.content); }} className="text-[8px] text-muted-foreground hover:text-foreground"><Download className="h-2.5 w-2.5" /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-400">AI</div>
            <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-green-500/10 text-sm text-green-400">
              <Sparkles className="h-3 w-3 inline animate-pulse mr-1" />正在分析...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent></Card>

      {/* Input Area */}
      <div className="flex gap-2 shrink-0">
        <Input value={input} onChange={function (e) { setInput(e.target.value); }} onKeyDown={handleKeyDown} ref={inputRef} placeholder="输入问题，Enter 发送... 例：分析下 Q2 利润下降原因" className="flex-1 h-9 text-sm" disabled={loading} />
        <Button onClick={function () { sendMessage(input); }} disabled={loading || !input.trim()} size="sm" className="h-9 px-3 bg-green-600 hover:bg-green-500 text-white"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
