"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Zap,
  Save,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Package,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Layers,
  ShoppingCart,
  ImageOff,
  Globe,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

// ─── Types ────────────────────────────────────────────

interface VariantDef {
  variantId: number;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  productId?: string;
  inventoryItemId?: string;
}

interface ProductDef {
  id: number;
  title: string;
  image: string | null;
  shopName: string;
  shopFlag: string;
  status: "ACTIVE" | "DRAFT";
  hasMultipleVariants: boolean;
  variants: VariantDef[];
}

interface EditableVariant extends VariantDef {
  newPrice: number;
  newInventory: number;
  synced: boolean;
  syncing: boolean;
  errorMsg: string | null;
}

interface EditableProduct extends ProductDef {
  expanded: boolean;
  variants: EditableVariant[];
}

interface StoreEntry {
  id: string;
  shopUrl: string;
  accessToken?: string;
  shopName: string;
  isDemo?: boolean;
}

interface ApiVariant {
  variantId: number;
  name: string;
  sku: string;
  price: string;
  inventory: number;
  productId?: string;
  inventoryItemId?: string;
}

interface ApiProduct {
  id: number;
  title: string;
  status: string;
  image: string | null;
  shopName: string;
  isDemo: boolean;
  variants: ApiVariant[];
}

interface ProductControlPanelProps {
  isDemo: boolean;
  currentStore?: StoreEntry | null;
  shopName: string;
  stores: StoreEntry[];
  fullProducts?: ApiProduct[];
}

// ─── Demo presets: per-store product catalog with variants ──

const DEMO_PRODUCTS_A: ProductDef[] = [
  {
    id: 7901,
    title: "无线降噪耳机 Pro Max",
    image: null,
    shopName: "TechGear Pro",
    shopFlag: "🇺🇸",
    status: "ACTIVE",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790101, name: "星空黑", sku: "TG-WHP-BLK", price: 149.99, inventory: 45 },
      { variantId: 790102, name: "极光银", sku: "TG-WHP-SLV", price: 149.99, inventory: 32 },
    ],
  },
  {
    id: 7902,
    title: "碳纤维智能手表 S3",
    image: null,
    shopName: "TechGear Pro",
    shopFlag: "🇺🇸",
    status: "ACTIVE",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790201, name: "42mm 运动版", sku: "TG-CFW42-SPT", price: 299.99, inventory: 18 },
      { variantId: 790202, name: "46mm 旗舰版", sku: "TG-CFW46-PRO", price: 399.99, inventory: 8 },
      { variantId: 790203, name: "42mm 女士版", sku: "TG-CFW42-WMN", price: 279.99, inventory: 22 },
    ],
  },
  {
    id: 7903,
    title: "AR 轻量护目镜 Air",
    image: null,
    shopName: "TechGear Pro",
    shopFlag: "🇺🇸",
    status: "ACTIVE",
    hasMultipleVariants: false,
    variants: [
      { variantId: 790301, name: "默认", sku: "TG-ARG-AIR", price: 89.99, inventory: 60 },
    ],
  },
  {
    id: 7904,
    title: "电竞机械键盘 K8",
    image: null,
    shopName: "TechGear Pro",
    shopFlag: "🇺🇸",
    status: "DRAFT",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790401, name: "青轴 RGB", sku: "TG-K8-BLU", price: 129.99, inventory: 25 },
      { variantId: 790402, name: "红轴 白光", sku: "TG-K8-RED", price: 119.99, inventory: 30 },
    ],
  },
];

const DEMO_PRODUCTS_B: ProductDef[] = [
  {
    id: 7905,
    title: "极简北欧台灯 LUX",
    image: null,
    shopName: "MinimalHome",
    shopFlag: "🇯🇵",
    status: "ACTIVE",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790501, name: "暖白光 / 黄铜底座", sku: "MH-LUX-WRM", price: 79.99, inventory: 35 },
      { variantId: 790502, name: "日光白 / 铁灰底座", sku: "MH-LUX-DAY", price: 79.99, inventory: 28 },
    ],
  },
  {
    id: 7906,
    title: "日式亚麻抱枕套装",
    image: null,
    shopName: "MinimalHome",
    shopFlag: "🇯🇵",
    status: "ACTIVE",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790601, name: "米白 45×45", sku: "MH-CSH45-IVR", price: 34.99, inventory: 50 },
      { variantId: 790602, name: "浅灰 45×45", sku: "MH-CSH45-GRY", price: 34.99, inventory: 42 },
      { variantId: 790603, name: "驼色 60×60", sku: "MH-CSH60-TAN", price: 44.99, inventory: 20 },
    ],
  },
  {
    id: 7907,
    title: "手工粗陶咖啡杯",
    image: null,
    shopName: "MinimalHome",
    shopFlag: "🇯🇵",
    status: "ACTIVE",
    hasMultipleVariants: false,
    variants: [
      { variantId: 790701, name: "默认", sku: "MH-MUG-CLY", price: 24.99, inventory: 100 },
    ],
  },
  {
    id: 7908,
    title: "羊毛混纺几何地毯",
    image: null,
    shopName: "MinimalHome",
    shopFlag: "🇯🇵",
    status: "DRAFT",
    hasMultipleVariants: true,
    variants: [
      { variantId: 790801, name: "120×180 几何灰", sku: "MH-RUG120-GRY", price: 159.99, inventory: 10 },
      { variantId: 790802, name: "160×230 渐变蓝", sku: "MH-RUG160-BLU", price: 249.99, inventory: 5 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────

function buildEditableProduct(def: ProductDef): EditableProduct {
  return {
    ...def,
    expanded: false,
    variants: def.variants.map((v) => ({
      ...v,
      newPrice: v.price,
      newInventory: v.inventory,
      synced: false,
      syncing: false,
      errorMsg: null,
    })),
  };
}

function buildDemoCatalog(isDemoB: boolean): EditableProduct[] {
  const storeA = DEMO_PRODUCTS_A.map(buildEditableProduct);
  const storeB = DEMO_PRODUCTS_B.map(buildEditableProduct);
  // If current store is TechGear, show A first; otherwise show B first
  return isDemoB ? [...storeB, ...storeA] : [...storeA, ...storeB];
}

// ─── Main Component ───────────────────────────────────

export default function ProductControlPanel({
  isDemo,
  currentStore,
  shopName,
  stores,
  fullProducts,
}: ProductControlPanelProps) {
  const isDemoB = currentStore?.shopName?.toLowerCase().includes("minimal") || shopName.toLowerCase().includes("minimal");

  const [catalog, setCatalog] = useState<EditableProduct[]>(() =>
    isDemo ? buildDemoCatalog(!!isDemoB) : [],
  );
  const [loading, setLoading] = useState(!isDemo && !fullProducts);
  const [globalMsg, setGlobalMsg] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const [batchSyncing, setBatchSyncing] = useState(false);

  // ── Convert fullProducts (from API) to EditableProduct catalog ──
  useEffect(() => {
    if (isDemo) return;
    if (fullProducts && fullProducts.length > 0) {
      setCatalog(fullProducts.map((p): EditableProduct => {
        const status = (p.status.toUpperCase() === "ACTIVE" ? "ACTIVE" : "DRAFT") as "ACTIVE" | "DRAFT";
        const flag = p.shopName.toLowerCase().includes("minimal") ? "🇯🇵"
          : p.shopName.toLowerCase().includes("tech") ? "🇺🇸"
          : "🌐";
        return {
          id: p.id,
          title: p.title,
          image: p.image,
          shopName: p.shopName,
          shopFlag: flag,
          status,
          hasMultipleVariants: p.variants.length > 1,
          expanded: false,
          variants: p.variants.map((v) => ({
            variantId: v.variantId,
            name: v.name,
            sku: v.sku,
            price: parseFloat(v.price) || 0,
            inventory: v.inventory,
            productId: v.productId,
            inventoryItemId: v.inventoryItemId,
            newPrice: parseFloat(v.price) || 0,
            newInventory: v.inventory,
            synced: false,
            syncing: false,
            errorMsg: null,
          })),
        };
      }));
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isDemo, fullProducts]);

  // ── Sync single variant ──
  const syncVariant = async (productId: number, variantId: number) => {
    setCatalog((prev) =>
      prev.map((p) => ({
        ...p,
        variants: p.variants.map((v) =>
          v.variantId === variantId ? { ...v, syncing: true, errorMsg: null } : v,
        ),
      })),
    );

    const product = catalog.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.variantId === variantId);
    if (!variant) return;

    // ── Demo: virtual sync ──
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 500));
      setCatalog((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.variantId === variantId
              ? { ...v, price: v.newPrice, inventory: v.newInventory, synced: true, syncing: false }
              : v,
          ),
        })),
      );
      setGlobalMsg({
        type: "success",
        text: `✓ [Demo 沙盒] ${variant.name} 已同步 — 价格 $${variant.newPrice.toFixed(2)} · 库存 ${variant.newInventory}`,
      });
      setTimeout(() => setGlobalMsg({ type: null, text: "" }), 3000);
      return;
    }

    // ── Real: POST to backend → GraphQL mutation ──
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProductVariant",
          shopUrl: currentStore?.shopUrl,
          accessToken: currentStore?.accessToken,
          variantId,
          productId: variant.productId,
          inventoryItemId: variant.inventoryItemId,
          newPrice: variant.newPrice,
          newInventory: variant.newInventory,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) =>
          prev.map((p) => ({
            ...p,
            variants: p.variants.map((v) =>
              v.variantId === variantId
                ? { ...v, price: v.newPrice, inventory: v.newInventory, synced: true, syncing: false }
                : v,
            ),
          })),
        );
        setGlobalMsg({ type: "success", text: `✓ ${variant.name} 已同步至 Shopify 后台` });
      } else {
        throw new Error(json.error || "未知错误");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setCatalog((prev) =>
        prev.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.variantId === variantId
              ? { ...v, syncing: false, errorMsg: msg || "同步失败" }
              : v,
          ),
        })),
      );
      setGlobalMsg({
        type: "error",
        text: "⚠️ 同步失败：请确认您在 Shopify 后台创建 Custom App 时勾选了 write_products 的 Admin API 写入权限。",
      });
      setTimeout(() => setGlobalMsg({ type: null, text: "" }), 5000);
      return;
    }
    setTimeout(() => setGlobalMsg({ type: null, text: "" }), 3000);
  };

  // ── Batch sync all pending ──
  const batchSyncAll = async () => {
    setBatchSyncing(true);
    for (const product of catalog) {
      for (const variant of product.variants) {
        if (variant.newPrice !== variant.price || variant.newInventory !== variant.inventory) {
          await syncVariant(product.id, variant.variantId);
        }
      }
    }
    setBatchSyncing(false);
    if (isDemo) {
      setGlobalMsg({
        type: "success",
        text: `✓ [Demo 沙盒] 所有变体已一键同步至 ${stores.filter((s) => s.isDemo).length} 家演示站点！`,
      });
      setTimeout(() => setGlobalMsg({ type: null, text: "" }), 3000);
    }
  };

  const totalPending = catalog.reduce((sum, p) =>
    sum + p.variants.filter((v) => v.newPrice !== v.price || v.newInventory !== v.inventory).length, 0,
  );

  const toggleExpand = (productId: number) => {
    setCatalog((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Zap className="h-6 w-6 text-amber-400" />
            跨店改价控制台
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">正在通过 Shopify GraphQL 拉取真实商品库...</p>
        </div>
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="space-y-4 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-md bg-muted/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted/30" />
                  <div className="h-3 w-32 rounded bg-muted/20" />
                </div>
                <div className="h-5 w-20 rounded bg-muted/30" />
                <div className="h-5 w-12 rounded bg-muted/20" />
                <div className="h-8 w-20 rounded bg-muted/30" />
                <div className="h-8 w-14 rounded bg-muted/20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state (real store, no products data) ──
  if (catalog.length === 0 && !isDemo) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Zap className="h-6 w-6 text-amber-400" />
            跨店改价控制台
          </h2>
        </div>
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Package className="h-16 w-16 text-muted-foreground/25" />
            <p className="text-lg font-semibold text-muted-foreground">真实商品库加载中</p>
            <p className="text-sm text-muted-foreground/60 max-w-md text-center">
              系统正在通过 Shopify GraphQL products 接口拉取当前店铺的真实商品及变体数据。请确认 Admin API 已开启 read_products 权限。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Zap className="h-6 w-6 text-amber-400" />
          跨店改价控制台
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDemo ? "演示商品库 (多店铺 · 多规格)" : shopName} · 批量改价 / 变体库存 / 多店联动
          {isDemo && <span className="ml-2 text-xs text-amber-400">(Demo: 8 款商品 · 18 个变体)</span>}
        </p>
      </div>

      {/* Global alert */}
      {globalMsg.type && (
        <div className={`flex items-start gap-2 rounded-lg px-4 py-3 backdrop-blur-sm ${
          globalMsg.type === "success"
            ? "border border-emerald-500/30 bg-emerald-500/10"
            : "border border-red-500/30 bg-red-500/10"
        }`}>
          {globalMsg.type === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
          <p className={`text-sm ${globalMsg.type === "success" ? "text-emerald-300" : "text-red-300"}`}>{globalMsg.text}</p>
        </div>
      )}

      {/* Batch bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-3 px-5 py-3">
          <p className="text-xs font-medium text-muted-foreground">商品控制中心</p>
          <p className="text-xs text-muted-foreground/70">
            {catalog.length} 款商品 · {catalog.reduce((s, p) => s + p.variants.length, 0)} 个变体
          </p>
          <div className="ml-auto flex items-center gap-3">
            {totalPending > 0 && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                {totalPending} 项待同步
              </Badge>
            )}
            <Button size="sm" onClick={batchSyncAll} disabled={batchSyncing || totalPending === 0}
              className="h-9 gap-1.5 bg-amber-600 text-white hover:bg-amber-500">
              {batchSyncing
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />同步中...</>
                : <><Save className="h-3.5 w-3.5" />一键同步全部变体</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setCatalog((prev) => prev.map((p) => ({
                ...p,
                variants: p.variants.map((v) => ({ ...v, newPrice: v.price, newInventory: v.inventory, synced: false })),
              })));
            }} className="h-9 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      {catalog.map((product) => (
        <Card
          key={product.id}
          className={`border-border/40 bg-card/60 shadow-lg backdrop-blur-lg transition-all ${
            product.status === "DRAFT" ? "opacity-70" : ""
          }`}
        >
          <CardContent className="p-0">
            {/* Main row */}
            <div
              className={`flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors ${
                product.expanded ? "border-b border-border/20" : ""
              } ${product.hasMultipleVariants ? "cursor-pointer" : ""}`}
              onClick={() => product.hasMultipleVariants && toggleExpand(product.id)}
            >
              {/* Expand arrow */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {product.hasMultipleVariants ? (
                  product.expanded
                    ? <ChevronDown className="h-4 w-4 text-amber-400" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <div className="h-4 w-4" />
                )}
              </div>

              {/* Image */}
              {product.image ? (
                <img src={product.image} alt={product.title} className="h-10 w-10 rounded-md border border-border/50 object-cover shrink-0" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/20">
                  <ImageOff className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}

              {/* Title & shop */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{product.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{product.shopFlag} {product.shopName}</span>
                </div>
              </div>

              {/* Variant count badge */}
              <Badge variant="outline" className={`shrink-0 text-[10px] px-2 py-0 border ${product.hasMultipleVariants ? "border-amber-500/30 text-amber-400" : "border-border/40 text-muted-foreground"}`}>
                {product.hasMultipleVariants ? "多规格 (" + product.variants.length + " 变体)" : "单规格"}
              </Badge>

              {/* Status */}
              <Badge className={`shrink-0 text-[10px] px-2 py-0 ${
                product.status === "ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-zinc-500/15 text-zinc-400"
              }`}>
                {product.status === "ACTIVE" ? "上架" : "草稿"}
              </Badge>

              {product.hasMultipleVariants ? (
                <p className="text-xs text-muted-foreground/50 shrink-0">点击展开变体</p>
              ) : (() => {
                const v = product.variants[0];
                return (
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm font-semibold text-emerald-400 tabular-nums w-20 text-right">${v.price.toFixed(2)}</span>
                    <span className={`text-sm font-medium tabular-nums w-10 text-right ${v.inventory < 10 ? "text-red-400" : "text-foreground"}`}>{v.inventory}</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <Input type="number" step={0.01} min={0} value={v.newPrice}
                        onChange={(e) => setCatalog((prev) => prev.map((p) => ({
                          ...p, variants: p.variants.map((vv) =>
                            vv.variantId === v.variantId ? { ...vv, newPrice: Number(e.target.value) || 0, synced: false } : vv),
                        })))}
                        className={`h-8 w-24 text-center text-sm tabular-nums ${
                          v.newPrice < v.price ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                          : v.newPrice > v.price ? "border-amber-500/40 bg-amber-500/5 text-amber-400" : ""}`}
                      />
                    </div>
                    <Input type="number" step={1} min={0} value={v.newInventory}
                      onChange={(e) => setCatalog((prev) => prev.map((p) => ({
                        ...p, variants: p.variants.map((vv) =>
                          vv.variantId === v.variantId ? { ...vv, newInventory: Number(e.target.value) || 0, synced: false } : vv),
                      })))}
                      className="h-8 w-20 text-center text-sm tabular-nums" />
                    {v.syncing ? (
                      <Button size="sm" disabled className="h-8 gap-1 text-xs"><RefreshCw className="h-3 w-3 animate-spin" />同步中</Button>
                    ) : v.synced ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 px-2 py-1 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />已同步</Badge>
                    ) : v.newPrice !== v.price || v.newInventory !== v.inventory ? (
                      <Button size="sm" onClick={() => syncVariant(product.id, v.variantId)} className="h-8 gap-1 bg-amber-600 text-white hover:bg-amber-500 text-xs"><Save className="h-3 w-3" />同步</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground w-14 text-center">无变更</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Sub-table: variants */}
            {product.expanded && product.hasMultipleVariants && (
              <div className="px-5 pb-4 animate-[fadeIn_0.2s_ease-out]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">变体名称</th>
                      <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">当前价格</th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">库存</th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">修改为</th>
                      <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">新库存</th>
                      <th className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.variantId} className={`border-b border-border/10 transition-colors hover:bg-muted/10 ${v.synced ? "bg-emerald-500/5" : ""}`}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getVariantDotColor(v.variantId) }} />
                            <span className="text-sm font-medium text-foreground">{v.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <code className="rounded bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground">{v.sku}</code>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className="text-sm font-semibold text-emerald-400">${v.price.toFixed(2)}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className={`text-sm font-medium ${v.inventory < 10 ? "text-red-400" : "text-foreground"}`}>{v.inventory}</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <Input
                              type="number" step={0.01} min={0}
                              value={v.newPrice}
                              onChange={(e) => {
                                setCatalog((prev) => prev.map((p) => ({
                                  ...p,
                                  variants: p.variants.map((vv) =>
                                    vv.variantId === v.variantId
                                      ? { ...vv, newPrice: Number(e.target.value) || 0, synced: false }
                                      : vv,
                                  ),
                                })));
                              }}
                              className={`h-8 w-24 text-center text-sm tabular-nums ${
                                v.newPrice < v.price ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                                : v.newPrice > v.price ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                                : ""
                              }`}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <Input
                            type="number" step={1} min={0}
                            value={v.newInventory}
                            onChange={(e) => {
                              setCatalog((prev) => prev.map((p) => ({
                                ...p,
                                variants: p.variants.map((vv) =>
                                  vv.variantId === v.variantId
                                    ? { ...vv, newInventory: Number(e.target.value) || 0, synced: false }
                                    : vv,
                                ),
                              })));
                            }}
                            className="h-8 w-20 text-center text-sm tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 text-center">
                          {v.syncing ? (
                            <Button size="sm" disabled className="h-8 gap-1 text-xs">
                              <RefreshCw className="h-3 w-3 animate-spin" />同步中
                            </Button>
                          ) : v.synced ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 px-2 py-1 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" />已同步
                            </Badge>
                          ) : v.newPrice !== v.price || v.newInventory !== v.inventory ? (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); syncVariant(product.id, v.variantId); }}
                              className="h-8 gap-1 bg-amber-600 text-white hover:bg-amber-500 text-xs">
                              <Save className="h-3 w-3" />同步
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">无变更</span>
                          )}
                          {v.errorMsg && (
                            <p className="mt-1 text-[10px] text-red-400">{v.errorMsg}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </CardContent>
        </Card>
      ))}

      {/* Real mode warning */}
      {!isDemo && (
        <Card className="border-red-500/20 bg-red-500/5 shadow-lg backdrop-blur-lg ring-1 ring-red-500/10">
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-red-300">
              <AlertCircle className="h-4 w-4" />
              真实环境写入须知
            </p>
            <div className="mt-2 text-xs leading-relaxed text-red-200/70 space-y-1">
              <p>• 后端通过 Shopify GraphQL Admin API (2026-04) 发送 <code className="rounded bg-red-500/10 px-1 py-0.5 text-red-300">mutation productVariantUpdate</code> 精确修改变体价格/库存</p>
              <p>• 请确认 Custom App 的 Admin API 权限已勾选 <code className="rounded bg-red-500/10 px-1 py-0.5 text-red-300">write_products</code></p>
              <p>• 如遇 403 错误，请前往 Shopify 后台 Settings → Apps and sales channels → Develop apps 重新授权写入权限</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Deterministic variant dot color ──────────────────

const VARIANT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function getVariantDotColor(variantId: number): string {
  return VARIANT_COLORS[variantId % VARIANT_COLORS.length];
}
