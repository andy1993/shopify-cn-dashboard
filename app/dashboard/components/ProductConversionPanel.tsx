"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  ShoppingCart,
  Eye,
  MousePointerClick,
  AlertTriangle,
  Package,
  TrendingUp,
  GitCompare,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Tag,
  Lightbulb,
  Star,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ─── Props ──────────────────────────────────────────── */

interface ProductConversionPanelProps {
  isDemo: boolean;
  shopName: string;
  fullProducts?: any[];
}

/* ─── 类型 ──────────────────────────────────────────── */

interface ProductReview {
  rating: number;
  count: number;
  estimated: boolean;
}

type SuggestionType = "images" | "description" | "reviews" | "price";

interface Suggestion {
  type: SuggestionType;
  level: "warn" | "info";
  text: string;
}

interface ProductRow {
  handle: string;
  title: string;
  image: string | null;
  imagesCount: number;
  price: number | null;
  priceLabel: string | null;
  productType: string;
  vendor: string;
  visits: number; // 页面访问
  bounceRate: number; // 跳出率 %
  atcRate: number; // 加购率 %
  convRate: number; // 成交率 %
  review: ProductReview;
  descriptionLen: number;
  suggestions: Suggestion[];
}

/* ─── 常量 ──────────────────────────────────────────── */

const ATC_MULT = 2.9; // 加购 ≈ 成交 × 2.9（店铺均值估算）
const GA4_CACHE_KEY = "ga4_last_result";

const DESC_THRESHOLD = 200; // 描述字数阈值
const IMAGE_THRESHOLD = 3; // 图片数量阈值

/* ─── 工具 ──────────────────────────────────────────── */

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("zh-CN");
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function findImage(products: any[], handle: string): string | null {
  const p = (products || []).find((x) => x.handle === handle);
  return p?.image ?? null;
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]*>/g, "");
}

function resolveReviews(product: any, isDemo: boolean): ProductReview {
  if (isDemo) return { rating: 0, count: 0, estimated: false }; // demo 由生成器填充
  if (Array.isArray(product?.reviews) && product.reviews.length) {
    const rs = product.reviews;
    const count = rs.length;
    const avg = rs.reduce((s: number, r: any) => s + (Number(r.rating) || 0), 0) / count;
    return { rating: +avg.toFixed(1), count, estimated: false };
  }
  if (typeof product?.rating === "number" && typeof product?.reviewCount === "number") {
    return { rating: product.rating, count: product.reviewCount, estimated: false };
  }
  // 真实模式无评价字段 → 确定性合成（标注估算）
  const seed = hashSeed(product?.handle || "");
  return {
    rating: +(3.5 + (seed % 15) / 10).toFixed(1),
    count: seed % 5 === 0 ? 0 : seed % 200,
    estimated: true,
  };
}

/* ─── Demo 数据 ─────────────────────────────────────── */

function makeRow(
  handle: string,
  title: string,
  visits: number,
  bounce: number,
  atc: number,
  conv: number,
  review: ProductReview,
  imagesCount: number,
  descLen: number,
  price: number | null,
  productType: string,
  vendor: string,
  image: string | null,
): ProductRow {
  return {
    handle,
    title,
    image,
    imagesCount,
    price,
    priceLabel: price != null ? `$${price.toFixed(2)}` : null,
    productType,
    vendor,
    visits,
    bounceRate: bounce,
    atcRate: atc,
    convRate: conv,
    review,
    descriptionLen: descLen,
    suggestions: [],
  };
}

function buildDemoRows(products: any[]): ProductRow[] {
  const rows: ProductRow[] = [];

  // 显式示例（含需求表格与建议触发项）
  const explicit: Array<{
    handle: string; title: string; visits: number; bounce: number; atc: number; conv: number;
    rating: number; rcount: number; images: number; descLen: number; price: number;
    type: string; vendor: string;
  }> = [
    { handle: "wireless-earbuds-pro", title: "无线降噪耳机 Pro", visits: 3200, bounce: 35, atc: 18, conv: 6.2, rating: 4.5, rcount: 156, images: 5, descLen: 420, price: 199, type: "耳机", vendor: "AudioX" },
    { handle: "smart-watch-x2", title: "智能手表 X2", visits: 2100, bounce: 28, atc: 22, conv: 8.5, rating: 4.2, rcount: 89, images: 4, descLen: 360, price: 259, type: "手表", vendor: "WatchCo" },
    // 触发优化建议的示例
    { handle: "budget-earbuds-mini", title: "入门蓝牙耳机 Mini", visits: 900, bounce: 48, atc: 11, conv: 2.4, rating: 0, rcount: 0, images: 1, descLen: 64, price: 29, type: "耳机", vendor: "AudioX" },
    { handle: "luxury-watch-gold", title: "奢华金表 Gold", visits: 300, bounce: 40, atc: 9, conv: 1.8, rating: 4.8, rcount: 12, images: 6, descLen: 300, price: 1299, type: "手表", vendor: "WatchCo" },
  ];
  for (const e of explicit) {
    rows.push(makeRow(
      e.handle, e.title, e.visits, e.bounce, e.atc, e.conv,
      { rating: e.rating, count: e.rcount, estimated: false },
      e.images, e.descLen, e.price, e.type, e.vendor,
      findImage(products, e.handle),
    ));
  }

  // 真实商品补充
  const seen = new Set(rows.map((r) => r.handle));
  for (const p of (products || []).slice(0, 8)) {
    if (!p.handle || seen.has(p.handle)) continue;
    seen.add(p.handle);
    const seed = hashSeed(p.handle);
    const visits = 400 + (seed % 3000);
    const bounce = 25 + (seed % 35);
    const atc = 12 + (seed % 16);
    const conv = +(2.5 + (seed % 70) / 10).toFixed(1);
    const rating = +(3.6 + (seed % 14) / 10).toFixed(1);
    const rcount = seed % 7 === 0 ? 0 : 20 + (seed % 180);
    const images = 2 + (seed % 6); // 2-7，偶尔 < 3
    const descLen = 80 + (seed % 400); // 偶尔 < 200
    const price = parseFloat(p.variants?.[0]?.price || "0") || 20 + (seed % 400);
    const type = p.productType || "未分类";
    const vendor = p.vendor || "";
    rows.push(makeRow(
      p.handle, p.title, visits, bounce, atc, conv,
      { rating, count: rcount, estimated: false },
      images, descLen, price, type, vendor, p.image ?? null,
    ));
  }

  applySuggestions(rows);
  rows.sort((a, b) => b.visits - a.visits);
  return rows;
}

/* ─── 真实数据（复用 GA4 缓存 + Shopify 商品）────────── */

interface Ga4PageRow {
  path: string;
  title: string;
  sessions: number;
  engagementRate: number;
  conversions: number;
}

function readGa4CachePages(): Ga4PageRow[] | null {
  try {
    const raw = localStorage.getItem(GA4_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pages = parsed?.bundle?.pages;
    return Array.isArray(pages) ? (pages as Ga4PageRow[]) : null;
  } catch {
    return null;
  }
}

function buildRealRows(pages: Ga4PageRow[], products: any[]): ProductRow[] {
  const prodMap = new Map((products || []).map((p) => [p.handle, p]));
  const rows: ProductRow[] = [];
  for (const pg of pages) {
    if (!pg.path.startsWith("/products/")) continue;
    const handle = pg.path.split("/")[2];
    if (!handle) continue;
    const prod = prodMap.get(handle);
    const visits = pg.sessions;
    const bounce = +((1 - (pg.engagementRate || 0)) * 100).toFixed(1);
    const conv = visits > 0 ? +(((pg.conversions || 0) / visits) * 100).toFixed(2) : 0;
    const atc = +(conv * ATC_MULT).toFixed(1);
    const images = prod ? (Array.isArray(prod.images) ? prod.images.length : prod.image ? 1 : 0) : 0;
    const descRaw = prod?.description || prod?.body_html || prod?.seoDescription || "";
    const descLen = stripHtml(descRaw).length;
    const price = prod ? parseFloat(prod.variants?.[0]?.price || "0") || null : null;
    const review = resolveReviews(prod, false);
    const type = prod?.productType || "未分类";
    const vendor = prod?.vendor || "";
    rows.push({
      handle,
      title: pg.title || prod?.title || handle,
      image: prod?.image ?? null,
      imagesCount: images,
      price,
      priceLabel: price != null ? `$${price.toFixed(2)}` : null,
      productType: type,
      vendor,
      visits,
      bounceRate: bounce,
      atcRate: atc,
      convRate: conv,
      review,
      descriptionLen: descLen,
      suggestions: [],
    });
  }
  applySuggestions(rows);
  rows.sort((a, b) => b.visits - a.visits);
  return rows;
}

/* ─── 逐商品优化建议 ────────────────────────────────── */

function applySuggestions(rows: ProductRow[]): void {
  const byType: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.price != null) (byType[r.productType] ||= []).push(r.price);
  }
  const avgByType: Record<string, number> = {};
  for (const t in byType) {
    const arr = byType[t];
    avgByType[t] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  for (const r of rows) {
    const s: Suggestion[] = [];
    if (r.imagesCount < IMAGE_THRESHOLD) {
      s.push({ type: "images", level: "warn", text: `当前仅 ${r.imagesCount} 张图片，建议上传至 ${IMAGE_THRESHOLD} 张以上，首图需清晰展示核心使用场景` });
    }
    if (r.descriptionLen < DESC_THRESHOLD) {
      s.push({ type: "description", level: "warn", text: `描述仅 ${r.descriptionLen} 字，建议补充至 ${DESC_THRESHOLD}+ 字，覆盖材质 / 尺寸 / 卖点 / 适用场景` });
    }
    if (r.review.count === 0) {
      s.push({ type: "reviews", level: "warn", text: "暂无评价，建议通过售后邮件 / 包裹卡片引导买家留评，提升转化信任" });
    }
    const avg = avgByType[r.productType];
    if (r.price != null && avg && (r.price > avg * 2 || r.price < avg * 0.5)) {
      s.push({ type: "price", level: "info", text: `价格 $${r.price.toFixed(2)} 与同类「${r.productType}」均值 $${avg.toFixed(2)} 偏差较大，建议对比竞品后调整` });
    }
    r.suggestions = s;
  }
}

/* ─── 主组件 ─────────────────────────────────────────── */

const SUG_ICON: Record<SuggestionType, ReactNode> = {
  images: <ImageIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  description: <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  reviews: <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
  price: <Tag className="h-3.5 w-3.5 shrink-0 text-sky-400" />,
};

const SUG_LABEL: Record<SuggestionType, string> = {
  images: "图片不足",
  description: "描述过短",
  reviews: "无评价",
  price: "价格异常",
};

export default function ProductConversionPanel({
  isDemo,
  shopName,
  fullProducts,
}: ProductConversionPanelProps) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [ga4Missing, setGa4Missing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  useEffect(() => {
    if (isDemo) {
      setRows(buildDemoRows(fullProducts as any[]));
      setGa4Missing(false);
      return;
    }
    const pages = readGa4CachePages();
    if (!pages) {
      setGa4Missing(true);
      setRows([]);
      return;
    }
    setGa4Missing(false);
    setRows(buildRealRows(pages, fullProducts as any[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, fullProducts]);

  // 默认对比项：前两行
  useEffect(() => {
    if (rows.length >= 2) {
      if (!compareA) setCompareA(rows[0].handle);
      if (!compareB) setCompareB(rows[1].handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const meanConv = useMemo(
    () => (rows.length ? rows.reduce((s, r) => s + r.convRate, 0) / rows.length : 0),
    [rows],
  );
  const totalVisits = useMemo(() => rows.reduce((s, r) => s + r.visits, 0), [rows]);
  const needOpt = useMemo(() => rows.filter((r) => r.suggestions.length > 0).length, [rows]);
  const best = useMemo(
    () => rows.reduce<ProductRow | null>((b, r) => (!b || r.convRate > b.convRate ? r : b), null),
    [rows],
  );

  const rowA = rows.find((r) => r.handle === compareA) || null;
  const rowB = rows.find((r) => r.handle === compareB) || null;

  const compareMetrics: Array<{ key: string; label: string; get: (r: ProductRow) => number; better: "high" | "low" }> = [
    { key: "visits", label: "页面访问", get: (r) => r.visits, better: "high" },
    { key: "bounce", label: "跳出率", get: (r) => r.bounceRate, better: "low" },
    { key: "atc", label: "加购率", get: (r) => r.atcRate, better: "high" },
    { key: "conv", label: "成交率", get: (r) => r.convRate, better: "high" },
  ];

  return (
    <div className="w-full space-y-5">
      {/* 标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <ShoppingCart className="h-5 w-5 text-emerald-400" />
            商品转化分析
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {shopName} · 商品转化率排行、逐品优化建议与横向对比
          </p>
        </div>
        {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
      </div>

      {ga4Missing && !isDemo && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-amber-200">
              未检测到 GA4 缓存数据。商品转化分析需要 GA4 的「商品页」维度；请先在「GA4 流量分析」面板配置并拉取数据。
            </p>
          </CardContent>
        </Card>
      )}

      {!ga4Missing && rows.length > 0 && (
        <>
          {/* KPI 概览 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard title="总页面访问" value={fmtInt(totalVisits)} subtitle="所有商品页合计" icon={<Eye className="h-5 w-5" />} accent="sky" />
            <KpiCard title="平均成交率" value={fmtPct(meanConv)} subtitle="商品级均值" icon={<MousePointerClick className="h-5 w-5" />} accent="emerald" />
            <KpiCard title="待优化商品" value={String(needOpt)} subtitle="存在 ≥1 项建议" icon={<AlertTriangle className="h-5 w-5" />} accent={needOpt > 0 ? "red" : "emerald"} />
            <KpiCard title="最佳转化商品" value={best ? fmtPct(best.convRate) : "—"} subtitle={best ? best.title : "无数据"} icon={<TrendingUp className="h-5 w-5" />} accent="violet" />
          </div>

          {!isDemo && (
            <p className="text-xs text-zinc-500">
              注：真实模式下「加购率」为估算值（GA4 未提供分页面电商事件，按店铺均值 × 成交率推算）；「评价」若店铺未回传评价字段则为估算值。
            </p>
          )}

          {/* 排行表 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">商品转化率排行</CardTitle>
              <CardDescription>按页面访问排序 · 点击任意行展开逐品优化建议</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-[30%] text-zinc-400">商品</TableHead>
                    <TableHead className="text-right text-zinc-400">页面访问</TableHead>
                    <TableHead className="text-right text-zinc-400">跳出率</TableHead>
                    <TableHead className="text-right text-zinc-400" title={isDemo ? "加购率" : "加购率（估算值）"}>加购率</TableHead>
                    <TableHead className="text-right text-zinc-400">成交率</TableHead>
                    <TableHead className="text-zinc-400">评价</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isOpen = selected === r.handle;
                    return (
                      <FragmentRow key={r.handle}>
                        <TableRow
                          onClick={() => setSelected(isOpen ? null : r.handle)}
                          className={cn("cursor-pointer border-zinc-800 transition-colors hover:bg-zinc-800/40", isOpen && "bg-zinc-800/30")}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                                {r.image ? (
                                  <img src={r.image} alt={r.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-zinc-600"><Package className="h-4 w-4" /></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <ChevronDown className={cn("h-3 w-3 shrink-0 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
                                  <span className="truncate font-medium text-zinc-200" title={r.title}>{r.title}</span>
                                </div>
                                <span className="ml-4 truncate text-xs text-zinc-500">/{r.handle}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtInt(r.visits)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", r.bounceRate >= 50 ? "text-red-400" : "text-zinc-300")}>
                            {fmtPct(r.bounceRate)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtPct(r.atcRate)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", r.convRate < meanConv * 0.7 ? "text-red-400" : r.convRate >= Math.max(8, meanConv * 1.5) ? "text-emerald-400" : "text-zinc-300")}>
                            {fmtPct(r.convRate)}
                          </TableCell>
                          <TableCell>
                            {r.review.count > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-zinc-300" title={r.review.estimated ? "评价为估算值" : "真实评价"}>
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                {r.review.rating.toFixed(1)}
                                <span className="text-zinc-500">· {r.review.count}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-red-400">无评价</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableCell colSpan={6} className="bg-zinc-950/30 p-0">
                              <DetailPanel row={r} />
                            </TableCell>
                          </TableRow>
                        )}
                      </FragmentRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow className="border-zinc-800"><TableCell colSpan={6} className="py-8 text-center text-zinc-500">无商品页面数据</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 横向对比 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompare className="h-4 w-4 text-sky-400" />商品横向对比
              </CardTitle>
              <CardDescription>选择两个商品，对比页面访问 / 跳出 / 加购 / 成交</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">商品 A</label>
                  <Select value={compareA} onValueChange={(v) => setCompareA(v as string)}>
                    <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100">
                      <SelectValue placeholder="选择商品" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (<SelectItem key={r.handle} value={r.handle}>{r.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">商品 B</label>
                  <Select value={compareB} onValueChange={(v) => setCompareB(v as string)}>
                    <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100">
                      <SelectValue placeholder="选择商品" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (<SelectItem key={r.handle} value={r.handle}>{r.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {rowA && rowB ? (
                <div className="space-y-3">
                  {compareMetrics.map((m) => {
                    const va = m.get(rowA);
                    const vb = m.get(rowB);
                    const max = Math.max(va, vb, 1);
                    const aWins = m.better === "high" ? va >= vb : va <= vb;
                    const bWins = m.better === "high" ? vb >= va : vb <= va;
                    return (
                      <div key={m.key} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                          <span>{m.label}</span>
                          <span className="text-zinc-500">{m.better === "high" ? "越高越好" : "越低越好"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <CompareCell label={rowA.title} value={m.key === "bounce" || m.key === "atc" || m.key === "conv" ? fmtPct(va) : fmtInt(va)} pct={va / max} win={aWins && va !== vb} accent="emerald" />
                          <CompareCell label={rowB.title} value={m.key === "bounce" || m.key === "atc" || m.key === "conv" ? fmtPct(vb) : fmtInt(vb)} pct={vb / max} win={bWins && va !== vb} accent="sky" />
                        </div>
                      </div>
                    );
                  })}
                  {/* 附加：评价 / 价格 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 text-xs">
                      <p className="mb-1 text-zinc-400">评价</p>
                      <p className="text-zinc-200">{rowA.review.count > 0 ? `${rowA.review.rating.toFixed(1)}⭐ · ${rowA.review.count}` : "无评价"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 text-xs">
                      <p className="mb-1 text-zinc-400">价格</p>
                      <p className="text-zinc-200">{rowA.priceLabel ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 text-xs">
                      <p className="mb-1 text-zinc-400">评价</p>
                      <p className="text-zinc-200">{rowB.review.count > 0 ? `${rowB.review.rating.toFixed(1)}⭐ · ${rowB.review.count}` : "无评价"}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 text-xs">
                      <p className="mb-1 text-zinc-400">价格</p>
                      <p className="text-zinc-200">{rowB.priceLabel ?? "—"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-zinc-500">请选择两个商品进行对比</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ─── 详情：逐品优化建议 ────────────────────────────── */

function DetailPanel({ row }: { row: ProductRow }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-800">
          {row.image ? (
            <img src={row.image} alt={row.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600"><Package className="h-5 w-5" /></div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{row.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.productType && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{row.productType}</Badge>}
            {row.vendor && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{row.vendor}</Badge>}
            {row.priceLabel && <Badge variant="outline" className="border-zinc-700 text-zinc-400">{row.priceLabel}</Badge>}
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
          <Lightbulb className="h-4 w-4 text-amber-400" />逐商品优化建议
        </h4>
        {row.suggestions.length === 0 ? (
          <p className="text-xs text-emerald-400">✅ 各项指标健康，暂无优化建议。</p>
        ) : (
          <div className="space-y-2">
            {row.suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
                {SUG_ICON[s.type]}
                <div className="min-w-0">
                  <span className={cn("mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold", s.level === "warn" ? "bg-amber-500/10 text-amber-400" : "bg-sky-500/10 text-sky-400")}>
                    {SUG_LABEL[s.type]}
                  </span>
                  <span className="text-xs text-zinc-300">{s.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 对比单元格 ────────────────────────────────────── */

function CompareCell({ label, value, pct, win, accent }: {
  label: string; value: string; pct: number; win: boolean; accent: "emerald" | "sky";
}) {
  const bar = accent === "emerald" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate text-xs text-zinc-300" title={label}>{label}</span>
        {win && <span className={cn("text-[10px] font-semibold", accent === "emerald" ? "text-emerald-400" : "text-sky-400")}>领先</span>}
      </div>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
      </div>
    </div>
  );
}

/* ─── 行片段 ─────────────────────────────────────────── */

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ─── KPI 卡片 ──────────────────────────────────────── */

function KpiCard({ title, value, subtitle, icon, accent }: {
  title: string; value: string; subtitle: string;
  icon: ReactNode;
  accent: "emerald" | "sky" | "amber" | "red" | "violet";
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
    violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  };
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-zinc-100">{value}</p>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", colors[accent])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
