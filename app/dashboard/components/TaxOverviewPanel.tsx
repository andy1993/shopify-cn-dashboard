"use client";

import { useState, useMemo } from "react";
import {
  Receipt, Shield, ChevronDown, ChevronRight, X, Download, ExternalLink,
  CheckCircle2, AlertTriangle, AlertCircle, Info, Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface TaxMarket {
  marketId: string; countryCode: string; countryName: string;
  taxConfigured: boolean; taxRate: number | null; reducedRate: number | null;
  taxIncluded: boolean; vatId: string | null;
  risks: Array<{ level: "high" | "medium"; message: string }>;
  // Import settings
  importTaxCollected: boolean; shippingTaxed: boolean;
}

interface TaxOverviewPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  taxData?: { markets: TaxMarket[]; shopLevel: { taxesIncluded: boolean; taxShipping: boolean } };
}

/* ─── Helpers ─────────────────────────────────────────── */

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

const TAX_TIPS = [
  { title: "欧盟 IOSS 须知", content: "发往欧盟 ≤€150 的商品需注册 IOSS，由 Shopify 代收代缴 VAT。>€150 的商品在进口时缴纳关税和 VAT。" },
  { title: "英国 VAT", content: "发往英国 ≤£135 的商品由 Shopify 代收 VAT，>£135 在进口时缴纳。需注册 UK VAT 号。" },
  { title: "美国 Sales Tax", content: "2026 年起多数州要求 Marketplace Facilitator 代收，Shopify 自动处理大部分州的 Sales Tax。" },
  { title: "日本 JCT", content: "2023 年起日本消费税发票制度生效，发往日本的卖家需注册 JCT 号并开具合格发票。" },
  { title: "澳大利亚 GST", content: "发往澳洲 ≤A$1000 的商品由 Shopify 代收 GST，>A$1000 进口时缴纳。" },
];

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_TAX_MARKETS: TaxMarket[] = [
  { marketId: "us", countryCode: "US", countryName: "美国", taxConfigured: true, taxRate: 8.25, reducedRate: null, taxIncluded: false, vatId: null, risks: [{ level: "medium", message: "Sales Tax 各州不同，部分州税率可能偏低" }], importTaxCollected: false, shippingTaxed: true },
  { marketId: "gb", countryCode: "GB", countryName: "英国", taxConfigured: true, taxRate: 20, reducedRate: 5, taxIncluded: true, vatId: "GB123456789", risks: [], importTaxCollected: true, shippingTaxed: true },
  { marketId: "de", countryCode: "DE", countryName: "德国", taxConfigured: true, taxRate: 19, reducedRate: 7, taxIncluded: true, vatId: null, risks: [{ level: "high", message: "发往欧盟但未配置 IOSS 号" }, { level: "medium", message: "进口关税未设置由 Shopify 代收" }], importTaxCollected: false, shippingTaxed: true },
  { marketId: "jp", countryCode: "JP", countryName: "日本", taxConfigured: false, taxRate: null, reducedRate: null, taxIncluded: true, vatId: null, risks: [{ level: "high", message: "日本消费税 (JCT) 未配置，2023 年发票制度要求注册 JCT" }], importTaxCollected: false, shippingTaxed: false },
  { marketId: "fr", countryCode: "FR", countryName: "法国", taxConfigured: true, taxRate: 20, reducedRate: 5.5, taxIncluded: true, vatId: null, risks: [{ level: "high", message: "发往欧盟但未配置 IOSS 号" }], importTaxCollected: false, shippingTaxed: true },
];

export default function TaxOverviewPanel({ isDemo, shopUrl, accessToken, shopName, taxData }: TaxOverviewPanelProps) {
  const [markets, setMarkets] = useState<TaxMarket[]>(() => isDemo ? DEMO_TAX_MARKETS : (taxData?.markets || []));
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [ignoredRisks, setIgnoredRisks] = useState<Set<string>>(new Set());
  const [showTips, setShowTips] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const ignoreRisk = (marketId: string, idx: number) => {
    const key = `${marketId}|${idx}`;
    setIgnoredRisks((p) => { const n = new Set(p); n.add(key); return n; });
    showToast("已忽略此风险");
  };

  // Risk scan summary
  const allRisks = useMemo(() => {
    const visible: Array<{ market: TaxMarket; risk: TaxMarket["risks"][0]; idx: number }> = [];
    markets.forEach((m) => m.risks.forEach((r, i) => { if (!ignoredRisks.has(`${m.marketId}|${i}`)) visible.push({ market: m, risk: r, idx: i }); }));
    return visible;
  }, [markets, ignoredRisks]);

  const stats = useMemo(() => {
    const configured = markets.filter((m) => m.taxConfigured).length;
    const withRisk = markets.filter((m) => m.risks.length > 0).length;
    const unconfigured = markets.filter((m) => !m.taxConfigured).length;
    return { configured, withRisk, unconfigured, total: markets.length };
  }, [markets]);

  const exportCSV = () => {
    const rows = markets.map((m) => [
      m.countryName, m.taxRate ? `${m.taxRate}%` : "未配置", m.reducedRate ? `${m.reducedRate}%` : "-",
      m.taxIncluded ? "含税" : "不含税", m.vatId || "-", m.taxConfigured ? "已配置" : "未配置",
      m.risks.length > 0 ? m.risks[0].level : "正常",
    ]);
    const csv = "\uFEFF" + [["市场", "税率", "低税率", "定价方式", "税务ID", "状态", "风险等级"], ...rows].map((r) => r.map((c) => '"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${shopName}_税务配置报告_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    showToast("报告已导出");
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Receipt className="h-6 w-6 text-rose-400" />税务总览</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {markets.length} 个市场{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* Risk Scan Alerts */}
      {allRisks.length > 0 && (
        <div className="space-y-2">
          {allRisks.map(({ market, risk, idx }) => (
            <Card key={`${market.marketId}-${idx}`} className={`border-2 ${risk.level === "high" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              <CardContent className="p-3 flex items-start gap-2">
                {risk.level === "high" ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5"/> : <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"/>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><Badge className={`text-[8px] px-1 py-0 ${risk.level==="high"?"bg-red-500/15 text-red-400":"bg-amber-500/15 text-amber-400"}`}>{risk.level==="high"?"高风险":"中风险"}</Badge>
                    <span className="text-[10px] text-muted-foreground">{countryCodeToFlag(market.countryCode)} {market.countryName}</span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{risk.message}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setExpandedMarket(market.marketId)} className="h-6 text-[9px]">详情</Button>
                  <Button size="sm" variant="ghost" onClick={() => ignoreRisk(market.marketId, idx)} className="h-6 text-[9px]"><X className="h-3 w-3"/></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[{v:stats.configured,l:"已配置",c:"text-emerald-400",bg:"bg-emerald-500/10"},{v:stats.withRisk,l:"需关注",c:"text-amber-400",bg:"bg-amber-500/10"},{v:stats.unconfigured,l:"未配置",c:"text-red-400",bg:"bg-red-500/10"}].map((s,i)=>
          <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-3 text-center"><p className={`text-2xl font-bold tabular-nums ${s.c}`}>{s.v}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p></CardContent></Card>
        )}
      </div>

      {/* Tax Matrix Table */}
      {markets.length > 0 && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-x-auto">
          <CardContent className="p-0">
            <table className="w-full text-xs min-w-[600px]">
              <thead><tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pl-3 text-left sticky left-0 bg-card/90 backdrop-blur">税种</th>
                {markets.map((m) => <th key={m.marketId} className="py-2 px-3 text-center min-w-[100px]">{countryCodeToFlag(m.countryCode)} {m.countryName}</th>)}
              </tr></thead>
              <tbody>
                {(["standardTax","taxIncluded","reducedTax","importTax"] as const).map((row) => {
                  const label = row==="standardTax"?"标准税率":row==="taxIncluded"?"含税定价":row==="reducedTax"?"低税率商品":"进口关税";
                  return (<tr key={row} className="border-b border-border/10 hover:bg-muted/5">
                    <td className="py-2 pl-3 text-foreground font-medium sticky left-0 bg-card/60">{label}</td>
                    {markets.map((m) => {
                      let cell: React.ReactNode;
                      if (row === "standardTax") cell = m.taxRate ? <span className="text-foreground">{m.taxRate}%{m.risks.some((r) => r.level === "high") ? "" : " ✓"}</span> : <span className="text-red-400">未配置</span>;
                      else if (row === "taxIncluded") cell = m.taxIncluded ? <span className="text-emerald-400">✓ 含税</span> : <span className="text-muted-foreground">✗ 不含</span>;
                      else if (row === "reducedTax") cell = m.reducedRate ? <span className="text-foreground">{m.reducedRate}%</span> : "—";
                      else cell = m.importTaxCollected ? <span className="text-emerald-400">✓ 代收</span> : <span className="text-amber-400">⚠ 未代收</span>;
                      return (
                        <td key={m.marketId} className="py-2 px-3 text-center cursor-pointer hover:bg-muted/10" onClick={() => setExpandedMarket(expandedMarket === m.marketId ? null : m.marketId)}>
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Expanded Market Detail */}
      {expandedMarket && (() => {
        const m = markets.find((x) => x.marketId === expandedMarket);
        if (!m) return null;
        return (
          <Card className="border-border/40 bg-card/60 shadow-lg border-l-2 border-l-rose-500">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">{countryCodeToFlag(m.countryCode)} {m.countryName}<Badge className={`text-[9px] ${m.taxConfigured?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400"}`}>{m.taxConfigured?"已配置":"未配置"}</Badge></p>
                <Button size="sm" variant="ghost" onClick={()=>setExpandedMarket(null)}><X className="h-4 w-4"/></Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">标准税率</p><p className="text-foreground font-semibold">{m.taxRate ? `${m.taxRate}%` : "未配置"}</p></div>
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">低税率</p><p className="text-foreground font-semibold">{m.reducedRate ? `${m.reducedRate}%` : "—"}</p></div>
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">VAT/IOSS号</p><p className="text-foreground font-semibold font-mono">{m.vatId || "—"}</p></div>
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">定价方式</p><p className="text-foreground font-semibold">{m.taxIncluded ? "含税定价" : "不含税定价"}</p></div>
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">运费计税</p><p className="text-foreground font-semibold">{m.shippingTaxed ? "✓" : "✗"}</p></div>
                <div className="bg-muted/10 rounded px-2 py-1.5"><p className="text-muted-foreground">代收关税</p><p className={`font-semibold ${m.importTaxCollected?"text-emerald-400":"text-amber-400"}`}>{m.importTaxCollected?"✓":"✗"}</p></div>
              </div>
              {m.risks.length > 0 && (
                <div className="pt-2 border-t border-border/20">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">风险项</p>
                  {m.risks.map((r,i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className={r.level==="high"?"text-red-400":"text-amber-400"}>{r.level==="high"?"🔴":"🟡"}</span><span className="text-muted-foreground">{r.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Tax Tips */}
      <button onClick={() => setShowTips(!showTips)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <Info className="h-3 w-3"/>{showTips ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}税务知识提示
      </button>
      {showTips && (
        <div className="space-y-1">
          {TAX_TIPS.map((tip) => (
            <Card key={tip.title} className="border-border/40 bg-muted/10"><CardContent className="p-2"><p className="text-[10px] font-semibold text-foreground">{tip.title}</p><p className="text-[9px] text-muted-foreground mt-0.5">{tip.content}</p></CardContent></Card>
          ))}
        </div>
      )}

      {/* Export */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 gap-1 text-[10px]"><Download className="h-3 w-3"/>导出税务报告</Button>
      </div>
    </div>
  );
}
