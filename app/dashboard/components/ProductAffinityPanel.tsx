"use client";

import { useState, useMemo } from "react";
import { Link, Search, X, Package, TrendingUp, DollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type Cooccurrence, type BundleSuggestion, computeAffinity, generateDemoRules, suggestBundle } from "@/lib/affinity-utils";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

interface ProductAffinityPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  orders?: Array<{ line_items: Array<{ title: string; product_id: number; quantity: number; price: string }> }>;
  fullProducts?: Array<{ id: number; title: string; variants: Array<{ price: number }> }>;
}

export default function ProductAffinityPanel({ isDemo, shopUrl, accessToken, shopName, orders, fullProducts }: ProductAffinityPanelProps) {
  const [minSupport, setMinSupport] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minLift, setMinLift] = useState(0);
  const [sortBy, setSortBy] = useState("lift");
  const [search, setSearch] = useState("");
  const [selectedRule, setSelectedRule] = useState(-1);
  const [showBundler, setShowBundler] = useState(false);
  const [bundleDiscount, setBundleDiscount] = useState(0.8);
  const [toast, setToast] = useState("");
  const showToast = function (msg: string) { setToast(msg); setTimeout(function () { setToast(""); }, 3000); };

  const productTitles = useMemo(function () {
    const map = new Map<number, string>();
    if (fullProducts) { fullProducts.forEach(function (p) { map.set(p.id, p.title); }); }
    return map;
  }, [fullProducts]);

  const allRules = useMemo(function () {
    if (isDemo) return generateDemoRules();
    if (orders && productTitles.size > 0) return computeAffinity(orders, productTitles);
    return [];
  }, [isDemo, orders, productTitles]);

  const filtered = useMemo(function () {
    var list = allRules;
    if (search) { var q = search.toLowerCase(); list = list.filter(function (r) { return r.productA.toLowerCase().indexOf(q) !== -1 || r.productB.toLowerCase().indexOf(q) !== -1; }); }
    if (minSupport !== 0) list = list.filter(function (r) { return r.abCount >= minSupport; });
    if (minConfidence !== 0) list = list.filter(function (r) { return r.confidence * 100 >= minConfidence; });
    if (minLift !== 0) list = list.filter(function (r) { return r.lift >= minLift; });
    list = list.slice().sort(function (a, b) {
      if (sortBy === "lift") return b.lift - a.lift;
      if (sortBy === "confidence") return b.confidence - a.confidence;
      if (sortBy === "abCount") return b.abCount - a.abCount;
      return b.lift - a.lift;
    });
    return list;
  }, [allRules, search, minSupport, minConfidence, minLift, sortBy]);

  const selected = selectedRule >= 0 ? filtered[selectedRule] : null;

  // Bundle suggestions
  const bundles: BundleSuggestion[] = useMemo(function () { return isDemo ? suggestBundle(allRules.slice(0, 5), bundleDiscount) : []; }, [allRules, bundleDiscount, isDemo]);

  // Action labels
  function getAction(r: Cooccurrence): string {
    if (r.lift >= 3) return "捆绑销售";
    if (r.lift >= 2) return "交叉推荐";
    return "加购推荐";
  }

  // Separate into table & network data
  const topRules = filtered.slice(0, 30);

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Link className="h-6 w-6 text-violet-400" />商品关联分析</h2>
        <p className="mt-1 text-base text-muted-foreground">{shopName} · {allRules.length} 条关联规则{isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}</p>
      </div>

      {/* Filters */}
      <Card className="border-border/40 bg-card/60"><CardContent className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <div className="relative flex-1 min-w-[100px]"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={function (e) { setSearch(e.target.value); setSelectedRule(-1); }} placeholder="搜索商品..." className="h-7 pl-7 text-sm" /></div>
        <span className="text-[9px] text-muted-foreground">支持度≥</span>
        <Input type="number" value={minSupport || ""} onChange={function (e) { setMinSupport(Number(e.target.value) || 0); }} className="h-7 w-14 text-sm" />
        <span className="text-[9px] text-muted-foreground">置信度≥</span>
        <Input type="number" value={minConfidence || ""} onChange={function (e) { setMinConfidence(Number(e.target.value) || 0); }} className="h-7 w-14 text-sm" placeholder="%" />
        <span className="text-[9px] text-muted-foreground">提升度≥</span>
        <Input type="number" value={minLift || ""} onChange={function (e) { setMinLift(Number(e.target.value) || 0); }} className="h-7 w-14 text-sm" />
        <select value={sortBy} onChange={function (e) { setSortBy(e.target.value); }} className="h-7 rounded border border-border/40 bg-background text-xs px-1"><option value="lift">提升度</option><option value="confidence">置信度</option><option value="abCount">共现次数</option></select>
        <Button size="sm" variant="outline" onClick={function () { setShowBundler(!showBundler); }} className="h-7 text-xs"><Package className="h-3 w-3"/>捆绑模拟</Button>
      </CardContent></Card>

      {/* Main Table */}
      <Card className="border-border/40 bg-card/60 shadow-lg overflow-x-auto"><CardContent className="p-0">
        <table className="w-full text-sm min-w-[600px]">
          <thead><tr className="border-b border-border/20 text-xs font-semibold text-muted-foreground"><th className="py-2 pl-3 text-left">源商品</th><th className="py-2 w-8" /><th className="py-2 text-left">关联商品</th><th className="py-2 px-2 text-right">共现</th><th className="py-2 px-2 text-right">置信度</th><th className="py-2 px-2 text-right">提升度</th><th className="py-2 px-2 text-center">建议</th></tr></thead>
          <tbody>
            {topRules.map(function (r, i) {
              var action = getAction(r);
              return (
                <tr key={i} className={"border-b border-border/10 hover:bg-muted/5 cursor-pointer " + (selectedRule === i ? "bg-violet-500/10" : "")} onClick={function () { setSelectedRule(selectedRule === i ? -1 : i); }}>
                  <td className="py-2 pl-3 font-medium text-foreground truncate max-w-[140px]">{r.productA}</td>
                  <td className="py-2 text-center text-muted-foreground">→</td>
                  <td className="py-2 text-foreground truncate max-w-[140px]">{r.productB}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{r.abCount} 次</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{r.confidence.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold text-violet-400">{r.lift.toFixed(1)}x</td>
                  <td className="py-2 px-2 text-center"><Badge className="text-[8px] px-1 py-0 bg-violet-500/15 text-violet-400">{action}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent></Card>

      {/* Affinity Network Viz (simplified CSS) */}
      {topRules.length > 0 && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">关联网络 Top 10</p>
          <div className="flex flex-wrap gap-2">
            {topRules.slice(0, 10).map(function (r, i) {
              var size = Math.max(10, Math.min(40, r.abCount * 0.8));
              var opacity = Math.max(0.3, Math.min(1, r.lift / 5));
              var isSelected = selectedRule === i;
              return (
                <div key={i} className={"flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] border cursor-pointer transition-all " + (isSelected ? "border-violet-500 bg-violet-500/10" : "border-border/20 bg-muted/5")} onClick={function () { setSelectedRule(i); }} style={{ opacity: opacity }}>
                  <span className="font-semibold text-foreground truncate max-w-[70px]">{r.productA}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-violet-400" />
                  <span className="font-semibold text-violet-400 truncate max-w-[70px]">{r.productB}</span>
                  <span className="text-muted-foreground">{r.lift.toFixed(1)}x</span>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Detail Modal */}
      {selected && (
        <Card className="border-border/40 bg-card/60 shadow-xl border-l-2 border-l-violet-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{selected.productA} → {selected.productB}</p>
              <Button size="sm" variant="ghost" onClick={function () { setSelectedRule(-1); }}><X className="h-4 w-4"/></Button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">共现次数</p><p className="text-lg font-bold tabular-nums">{selected.abCount}</p></div>
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">置信度</p><p className="text-lg font-bold tabular-nums text-violet-400">{selected.confidence.toFixed(1)}%</p></div>
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">提升度</p><p className="text-lg font-bold tabular-nums text-violet-400">{selected.lift.toFixed(1)}x</p></div>
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">建议</p><p className="text-base font-semibold text-foreground">{getAction(selected)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">解读</p><p className="mt-0.5">购买「{selected.productA}」的客户中，{selected.confidence.toFixed(0)}% 也购买了「{selected.productB}」，是随机概率的 {selected.lift.toFixed(1)} 倍。</p></div>
              <div className="bg-muted/10 rounded p-2"><p className="text-muted-foreground">捆绑建议</p><p className="mt-0.5">建议将两件商品捆绑销售，原价合计 ¥200 → 8折 ¥160，预估增量 GMV ¥1,200。</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bundle Simulator */}
      {showBundler && bundles.length > 0 && (
        <Card className="border-border/40 bg-card/60 shadow-lg"><CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">捆绑销售模拟器</p>
            <div className="flex items-center gap-1"><span className="text-[9px] text-muted-foreground">折扣:</span>
              <Input type="number" value={bundleDiscount} onChange={function (e) { setBundleDiscount(Number(e.target.value) || 0.8); }} className="h-6 w-14 text-sm" step="0.05" min="0.5" max="1" />
            </div>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground border-b border-border/20"><th className="py-1 text-left">商品组合</th><th className="py-1 text-right">原价</th><th className="py-1 text-right">捆绑价</th><th className="py-1 text-right">预估销量</th><th className="py-1 text-right">预估 GMV</th></tr></thead>
            <tbody>{bundles.map(function (b, i) { return <tr key={i} className="border-b border-border/10"><td className="py-1">{b.products.join(" + ")}</td><td className="py-1 text-right tabular-nums">¥{b.originalTotal}</td><td className="py-1 text-right tabular-nums text-violet-400">¥{b.bundledPrice}</td><td className="py-1 text-right tabular-nums">{b.estimatedSales}</td><td className="py-1 text-right tabular-nums text-emerald-400">{formatCny(Math.round(b.bundleGMV * EXCHANGE_RATE))}</td></tr>; })}</tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}
