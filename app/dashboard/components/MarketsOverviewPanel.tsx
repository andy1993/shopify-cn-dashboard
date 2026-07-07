"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Globe, Flag, Search, Plus, X, Save, Edit3, CheckCircle2, AlertCircle,
  ChevronDown, DollarSign, Languages, Settings, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ─── Types ──────────────────────────────────────────── */

interface MarketPriceAdjustment {
  type: "percentage" | "fixed"; value: number;
}

interface MarketItem {
  id: string; name: string; handle: string; enabled: boolean;
  countryCode: string; countries: string[];
  currency: string; languages: Array<{ isoCode: string; name: string }>;
  domain: string; subfolder: string;
  priceAdjustment: MarketPriceAdjustment | null;
  productCount: number;
}

interface ProductPricingOverride {
  productId: number; title: string; basePrice: number;
  localPrice: number; adjustmentType: "default" | "manual";
  manualPercent?: number; manualPrice?: number;
}

interface MarketsOverviewPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  markets?: MarketItem[];
  fullProducts?: Array<{ id: number; title: string; variants: Array<{price:number}> }>;
}

/* ─── Helpers ─────────────────────────────────────────── */

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function adjustPrice(base: number, adj: MarketPriceAdjustment | null): number {
  if (!adj) return base;
  if (adj.type === "percentage") return Math.round(base * (1 + adj.value / 100) * 100) / 100;
  return base + adj.value;
}

const CURRENCIES = ["USD","EUR","GBP","JPY","CNY","AUD","CAD","CHF","HKD","SGD","SEK","NOK","DKK","NZD","MXN","BRL","INR","KRW"];
const LANGUAGES = [
  { code: "en", name: "English" }, { code: "zh-CN", name: "简体中文" }, { code: "zh-TW", name: "繁體中文" },
  { code: "ja", name: "日本語" }, { code: "ko", name: "한국어" }, { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" }, { code: "es", name: "Español" }, { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" }, { code: "nl", name: "Nederlands" }, { code: "sv", name: "Svenska" },
  { code: "da", name: "Dansk" }, { code: "fi", name: "Suomi" }, { code: "no", name: "Norsk" },
  { code: "pl", name: "Polski" }, { code: "ru", name: "Русский" }, { code: "ar", name: "العربية" },
];

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_MARKETS: MarketItem[] = [
  { id: "gid://shopify/Market/1", name: "United States", handle: "us", enabled: true, countryCode: "US", countries: ["United States"], currency: "USD", languages: [{ isoCode:"en", name:"English" }], domain: "your-store.com", subfolder: "", priceAdjustment: null, productCount: 0 },
  { id: "gid://shopify/Market/2", name: "United Kingdom", handle: "uk", enabled: true, countryCode: "GB", countries: ["United Kingdom"], currency: "GBP", languages: [{ isoCode:"en", name:"English" }], domain: "your-store.com", subfolder: "/en-gb", priceAdjustment: { type:"percentage", value:20 }, productCount: 45 },
  { id: "gid://shopify/Market/3", name: "Germany", handle: "de", enabled: true, countryCode: "DE", countries: ["Germany","Austria"], currency: "EUR", languages: [{ isoCode:"de", name:"Deutsch" }], domain: "your-store.com", subfolder: "/de", priceAdjustment: { type:"percentage", value:15 }, productCount: 38 },
  { id: "gid://shopify/Market/4", name: "Japan", handle: "jp", enabled: true, countryCode: "JP", countries: ["Japan"], currency: "JPY", languages: [{ isoCode:"ja", name:"日本語" }], domain: "your-store.com", subfolder: "/ja", priceAdjustment: { type:"percentage", value:10 }, productCount: 30 },
  { id: "gid://shopify/Market/5", name: "France", handle: "fr", enabled: false, countryCode: "FR", countries: ["France"], currency: "EUR", languages: [{ isoCode:"fr", name:"Français" }], domain: "your-store.com", subfolder: "/fr", priceAdjustment: { type:"percentage", value:15 }, productCount: 0 },
];

const DEMO_PRODUCT_PRICING: ProductPricingOverride[] = [
  { productId: 1, title: "碳纤维手表 Chrono X", basePrice: 299.99, localPrice: 359.99, adjustmentType: "default" },
  { productId: 2, title: "无线降噪耳机 SonicFlow", basePrice: 149.99, localPrice: 179.99, adjustmentType: "manual", manualPercent: 15 },
  { productId: 3, title: "AR 护目镜 Air", basePrice: 89.99, localPrice: 103.49, adjustmentType: "default" },
  { productId: 4, title: "机械键盘 K8", basePrice: 129.99, localPrice: 129.99, adjustmentType: "manual", manualPrice: 129.99 },
  { productId: 5, title: "北欧台灯 LUX", basePrice: 79.99, localPrice: 87.99, adjustmentType: "default" },
  { productId: 6, title: "亚麻抱枕套", basePrice: 39.99, localPrice: 47.99, adjustmentType: "default" },
];

/* ─── Main Component ─────────────────────────────────── */

export default function MarketsOverviewPanel({ isDemo, shopUrl, accessToken, shopName, markets: marketsProp, fullProducts }: MarketsOverviewPanelProps) {
  const [markets, setMarkets] = useState<MarketItem[]>(() => isDemo ? DEMO_MARKETS : (marketsProp || []));
  const [detailMarket, setDetailMarket] = useState<MarketItem | null>(null);
  const [detailTab, setDetailTab] = useState<"overview"|"pricing"|"domain">("overview");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAdj, setBulkAdj] = useState<{ open: boolean; value: string }>({ open: false, value: "" });
  const [productOverrides, setProductOverrides] = useState<ProductPricingOverride[]>(() => isDemo ? DEMO_PRODUCT_PRICING : []);
  const [pricingSearch, setPricingSearch] = useState("");
  const [overrideModal, setOverrideModal] = useState<{ productId: number; pct: string; price: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* ── Sync props to state ─────────────────────────── */
  useEffect(() => {
    if (!isDemo && marketsProp && marketsProp.length > 0) {
      setMarkets(marketsProp);
    }
  }, [isDemo, marketsProp]);

  useEffect(() => {
    if (!isDemo && marketsProp && fullProducts) {
      const overrides: ProductPricingOverride[] = fullProducts.map((p) => ({
        productId: p.id, title: p.title,
        basePrice: p.variants?.[0]?.price || 0,
        localPrice: p.variants?.[0]?.price || 0,
        adjustmentType: "default" as const,
      }));
      setProductOverrides(overrides);
    }
  }, [isDemo, marketsProp, fullProducts]);

  const toggleSelect = (id: string) => { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const selectAll = () => setSelectedIds(new Set(markets.map((m) => m.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const filteredPricing = useMemo(() => {
    if (!detailMarket) return productOverrides;
    const adj = detailMarket.priceAdjustment;
    return productOverrides.filter((p) => !pricingSearch || p.title.toLowerCase().includes(pricingSearch.toLowerCase()))
      .map((p) => p.adjustmentType === "default" ? { ...p, localPrice: adjustPrice(p.basePrice, adj) } : p);
  }, [productOverrides, detailMarket, pricingSearch]);

  const applyBulkAdj = () => {
    const val = parseFloat(bulkAdj.value); if (isNaN(val)) return;
    setMarkets((p) => p.map((m) => selectedIds.has(m.id) ? { ...m, priceAdjustment: { type: "percentage" as const, value: val } } : m));
    setBulkAdj({ open: false, value: "" });
    showToast(`已为 ${selectedIds.size} 个市场设置价格调整 ${val > 0 ? "+" : ""}${val}%`);
  };

  const toggleMarket = (id: string) => { setMarkets((p) => p.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m)); };
  const applyOverride = () => {
    if (!overrideModal) return;
    const pct = parseFloat(overrideModal.pct); const price = parseFloat(overrideModal.price);
    setProductOverrides((p) => p.map((x) => x.productId === overrideModal.productId ? {
      ...x, adjustmentType: "manual" as const,
      manualPercent: !isNaN(pct) ? pct : undefined,
      manualPrice: !isNaN(price) ? price : undefined,
      localPrice: !isNaN(price) ? price : !isNaN(pct) ? Math.round(x.basePrice * (1 + pct / 100) * 100) / 100 : x.localPrice,
    } : x));
    setOverrideModal(null);
    showToast("定价已覆盖");
  };
  const resetOverrides = () => { setProductOverrides((p) => p.map((x) => ({ ...x, adjustmentType: "default" as const, manualPercent: undefined, manualPrice: undefined }))); showToast("已重置为默认规则"); };

  // Stats
  const stats = useMemo(() => ({
    total: markets.length, active: markets.filter((m) => m.enabled).length,
    currencies: new Set(markets.map((m) => m.currency)).size,
    languages: new Set(markets.flatMap((m) => m.languages.map((l) => l.isoCode))).size,
  }), [markets]);

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Globe className="h-6 w-6 text-sky-400" />多市场运营</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName}{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[{v:stats.total,l:"总市场",c:"text-sky-400"},{v:stats.active,l:"已激活",c:"text-emerald-400"},{v:stats.currencies,l:"币种",c:"text-amber-400"},{v:stats.languages,l:"语言",c:"text-violet-400"}].map((s,i)=>
          <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-3 text-center"><p className={`text-2xl font-bold tabular-nums ${s.c}`}>{s.v}</p><p className="text-xs text-muted-foreground mt-0.5">{s.l}</p></CardContent></Card>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={selectAll} className="h-7 text-xs">全选</Button>
        <Button size="sm" variant="ghost" onClick={clearSelect} className="h-7 text-xs">取消</Button>
        {selectedIds.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => setMarkets((p) => p.map((m) => selectedIds.has(m.id) ? { ...m, enabled: true } : m))} className="h-7 text-xs text-emerald-400">批量激活</Button>
            <Button size="sm" variant="outline" onClick={() => setMarkets((p) => p.map((m) => selectedIds.has(m.id) ? { ...m, enabled: false } : m))} className="h-7 text-xs text-red-400">批量停用</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAdj({ open: true, value: "" })} className="h-7 text-xs text-amber-400">批量调价</Button>
            <span className="text-xs text-muted-foreground ml-2">已选 {selectedIds.size}</span>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => showToast("数据已刷新")} className="h-7 text-xs ml-auto"><RefreshCw className="h-3 w-3 mr-1"/>刷新</Button>
      </div>

      {bulkAdj.open && (
        <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex items-center gap-2 py-2 px-4">
          <span className="text-xs text-amber-400">调整百分比:</span>
          <Input type="number" value={bulkAdj.value} onChange={(e) => setBulkAdj({ ...bulkAdj, value: e.target.value })} className="h-7 w-24 text-sm" placeholder="+10"/>
          <Button size="sm" onClick={applyBulkAdj} className="h-7 text-xs bg-amber-600 text-white">应用</Button>
          <Button size="sm" variant="ghost" onClick={() => setBulkAdj({ open: false, value: "" })} className="h-7 text-xs"><X className="h-3 w-3"/></Button>
        </CardContent></Card>
      )}

      {/* Market Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {markets.map((m) => (
          <Card key={m.id} className={`border-border/40 bg-card/60 shadow-lg backdrop-blur-lg cursor-pointer hover:border-sky-500/30 transition-colors ${selectedIds.has(m.id) ? "ring-2 ring-sky-500/50" : ""}`}
            onClick={() => { if (!bulkAdj.open) setDetailMarket(m); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedIds.has(m.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(m.id); }} className="accent-sky-500" />
                  <span className="text-3xl">{countryCodeToFlag(m.countryCode)}</span>
                  <div><p className="text-base font-semibold text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.handle}</p></div>
                </div>
                <Badge className={`text-[9px] px-1.5 py-0 ${m.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>{m.enabled ? "激活" : "未激活"}</Badge>
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1"><span className="font-semibold text-foreground">{m.currency}</span> · {m.languages.map((l) => l.name).join(", ")}</div>
                <div className="text-xs">{m.domain}{m.subfolder}</div>
                <div className="text-xs">
                  {m.priceAdjustment ? <>基础价 × {m.priceAdjustment.type === "percentage" ? <span className="text-amber-400">{(1 + m.priceAdjustment.value / 100).toFixed(2)}（{m.priceAdjustment.value > 0 ? "+" : ""}{m.priceAdjustment.value}%）</span> : `+¥${m.priceAdjustment.value}`}</> : <span className="text-emerald-400">使用店铺默认价格</span>}
                </div>
                <div className="text-xs">已为 {m.productCount > 0 ? m.productCount : "—"} 件商品设置本地价格</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Modal */}
      {detailMarket && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDetailMarket(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[85vh] bg-card border border-border/40 rounded-xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{countryCodeToFlag(detailMarket.countryCode)}</span>
                  <Input value={detailMarket.name} onChange={(e) => setDetailMarket({ ...detailMarket, name: e.target.value })} className="h-9 text-sm font-semibold w-48" />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDetailMarket(null)}><X className="h-4 w-4"/></Button>
              </div>
              <div className="flex gap-1 px-5 py-2 border-b border-border/20 shrink-0">
                {(["overview","pricing","domain"] as const).map((t) => (<button key={t} onClick={() => setDetailTab(t)} className={`px-3 py-1 rounded text-xs font-medium ${detailTab === t ? "bg-sky-500/15 text-sky-400" : "text-muted-foreground"}`}>{t==="overview"?"概况":t==="pricing"?"商品定价":"域名与语言"}</button>))}
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Tab: Overview */}
                {detailTab === "overview" && (<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">币种</label>
                      <select value={detailMarket.currency} onChange={(e) => setDetailMarket({ ...detailMarket, currency: e.target.value })} className="h-9 w-full rounded border border-border/40 bg-background px-2 text-base text-foreground">
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">国家/地区</label><Input value={detailMarket.countries.join(", ")} onChange={(e) => setDetailMarket({ ...detailMarket, countries: e.target.value.split(",").map((s) => s.trim()) })} className="h-9 text-sm"/></div>
                  </div>
                  <div><label className="text-xs font-semibold text-muted-foreground mb-0.5 block">语言</label>
                    <div className="flex flex-wrap gap-1 mb-1">{(detailMarket.languages || []).map((l) => (
                      <Badge key={l.isoCode} className="text-xs gap-1 bg-sky-500/15 text-sky-400">{l.name}<button onClick={() => setDetailMarket({ ...detailMarket, languages: detailMarket.languages.filter((x) => x.isoCode !== l.isoCode) })}><X className="h-2.5 w-2.5"/></button></Badge>))}</div>
                    <select value="" onChange={(e) => { if (e.target.value) { const lang = LANGUAGES.find((l) => l.code === e.target.value); if (lang && !detailMarket.languages.find((l) => l.isoCode === lang.code)) setDetailMarket({ ...detailMarket, languages: [...detailMarket.languages, { isoCode: lang.code, name: lang.name }] }); e.target.value = ""; } }} className="h-9 rounded border border-border/40 bg-background px-2 text-sm text-foreground">
                      <option value="">+ 添加语言</option>{LANGUAGES.filter((l) => !detailMarket.languages.find((x) => x.isoCode === l.code)).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">域名</label><Input value={detailMarket.domain} onChange={(e) => setDetailMarket({ ...detailMarket, domain: e.target.value })} className="h-9 text-sm" placeholder="your-store.com"/></div>
                    <div><label className="text-sm font-semibold text-muted-foreground mb-0.5 block">子路径</label><Input value={detailMarket.subfolder || ""} onChange={(e) => setDetailMarket({ ...detailMarket, subfolder: e.target.value })} className="h-9 text-sm" placeholder="/en"/></div>
                  </div>
                  <div className="border-t border-border/20 pt-3">
                    <label className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">价格调整</span><input type="checkbox" checked={!!detailMarket.priceAdjustment} onChange={() => setDetailMarket({ ...detailMarket, priceAdjustment: detailMarket.priceAdjustment ? null : { type:"percentage", value:0 } })} className="accent-amber-500"/></label>
                    {detailMarket.priceAdjustment && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">百分比</span>
                        <Input type="number" value={detailMarket.priceAdjustment.value} onChange={(e) => setDetailMarket({ ...detailMarket, priceAdjustment: { type:"percentage", value: Number(e.target.value) || 0 } })} className="h-9 w-24 text-sm"/>
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => showToast("已应用到所有商品")}>应用</Button>
                      </div>
                    )}
                  </div>
                </>)}

                {/* Tab: Pricing */}
                {detailTab === "pricing" && (<>
                  <div className="flex items-center gap-2">
                    <Search className="h-3 w-3 text-muted-foreground"/><Input value={pricingSearch} onChange={(e) => setPricingSearch(e.target.value)} placeholder="搜索商品..." className="h-9 text-sm flex-1"/>
                    <Button size="sm" variant="outline" onClick={resetOverrides} className="h-9 text-xs">重置为默认</Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/20 text-xs text-muted-foreground"><th className="py-1 text-left">商品</th><th className="py-1 text-right">基础价</th><th className="py-1 text-right">本地价</th><th className="py-1 text-center">方式</th><th className="py-1 w-12"/></tr></thead>
                    <tbody>{filteredPricing.map((p) => (
                      <tr key={p.productId} className={`border-b border-border/10 ${p.adjustmentType === "manual" ? "border-l-2 border-l-sky-500 pl-1" : ""}`}>
                        <td className="py-1 truncate max-w-[160px]">{p.title}</td>
                        <td className="py-1 text-right tabular-nums">¥{p.basePrice}</td>
                        <td className="py-1 text-right tabular-nums font-semibold text-sky-400">¥{p.localPrice}</td>
                        <td className="py-1 text-center"><Badge className={`text-[9px] px-1 py-0 ${p.adjustmentType === "manual" ? "bg-sky-500/15 text-sky-400" : "bg-muted/20 text-muted-foreground"}`}>{p.adjustmentType === "manual" ? "手动" : "默认"}</Badge></td>
                        <td className="py-1 text-right"><Button size="sm" variant="ghost" onClick={() => setOverrideModal({ productId: p.productId, pct: String(p.manualPercent || ""), price: String(p.manualPrice || "") })} className="h-6 text-xs text-amber-400">覆盖</Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </>)}

                {/* Tab: Domain & Languages */}
                {detailTab === "domain" && (<>
                  <Card className="border-border/40 bg-muted/10"><CardContent className="p-3 space-y-2 text-sm text-muted-foreground">
                    <p className="text-foreground font-semibold">域名预览</p>
                    <p>主域名: <span className="text-sky-400">{detailMarket.domain}</span></p>
                    <p>子路径: <span className="text-sky-400">{detailMarket.subfolder || "/"}</span></p>
                    <p>完整 URL: <span className="text-sky-400">https://{detailMarket.domain}{detailMarket.subfolder || ""}</span></p>
                  </CardContent></Card>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">已激活语言</p>
                    {detailMarket.languages.map((l) => (
                      <div key={l.isoCode} className="flex items-center justify-between py-1 px-2 rounded bg-muted/10 mb-1 text-sm">
                        <span>{l.name} <span className="text-muted-foreground">({l.isoCode})</span></span>
                        <span className="text-sky-400">https://{detailMarket.domain}{detailMarket.subfolder || "/"}</span>
                      </div>
                    ))}
                  </div>
                </>)}
              </div>
              <div className="flex gap-2 px-5 py-3 border-t border-border/20 shrink-0">
                <Button size="sm" onClick={() => { showToast(isDemo ? "演示：已保存" : "已保存"); }} className="h-9 gap-1 bg-emerald-600 text-white text-sm"><Save className="h-3 w-3"/>保存</Button>
                <Button size="sm" variant="outline" onClick={() => toggleMarket(detailMarket.id)} className="h-9 text-sm">{detailMarket.enabled ? "停用" : "激活"}此市场</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setOverrideModal(null)}/>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-card border border-border/40 rounded-xl p-5 space-y-3 shadow-2xl">
              <h3 className="text-base font-semibold">手动定价覆盖</h3>
              <div><label className="text-sm text-muted-foreground block mb-0.5">调整百分比 (%)</label><Input type="number" value={overrideModal.pct} onChange={(e) => setOverrideModal({ ...overrideModal, pct: e.target.value })} className="h-9 text-sm" placeholder="+10"/></div>
              <div><label className="text-sm text-muted-foreground block mb-0.5">或直接设置价格</label><Input type="number" step="0.01" value={overrideModal.price} onChange={(e) => setOverrideModal({ ...overrideModal, price: e.target.value })} className="h-9 text-sm" placeholder="直接输入价格"/></div>
              <div className="flex gap-2"><Button onClick={applyOverride} className="flex-1 h-9 bg-emerald-600 text-white text-sm">应用覆盖</Button><Button variant="outline" onClick={() => setOverrideModal(null)} className="h-9 text-sm">取消</Button></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
