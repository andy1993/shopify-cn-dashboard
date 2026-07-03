"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Zap, Save, RefreshCw, RotateCcw, AlertCircle, CheckCircle2,
  Package, DollarSign, ChevronDown, ChevronRight, Layers, ShoppingCart,
  ImageOff, Globe, Image, Edit3, Copy, ToggleLeft, ToggleRight, Search,
  ArrowUpDown, Upload, Trash2, Eye, FileText, Info, X, Tag, Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

/* ─── Types ──────────────────────────────────────────── */

interface VariantDef { variantId: number; name: string; sku: string; price: number; inventory: number; productId?: string; inventoryItemId?: string; costItem?: number; }

interface ProductDef { id: number; title: string; image: string | null; shopName: string; shopFlag: string; status: "ACTIVE" | "DRAFT"; hasMultipleVariants: boolean; variants: VariantDef[]; vendor?: string; productType?: string; tags?: string[]; bodyHtml?: string; seoTitle?: string; seoDescription?: string; handle?: string; images?: ProductImage[]; }

interface ProductImage { id: number | string; src: string; alt?: string; position?: number; isMain?: boolean; width?: number; height?: number; }

interface EditableVariant extends VariantDef { newPrice: number; newInventory: number; synced: boolean; syncing: boolean; errorMsg: string | null; }

interface EditableProduct extends ProductDef { expanded: boolean; variants: EditableVariant[]; }

interface StoreEntry { id: string; shopUrl: string; accessToken?: string; shopName: string; isDemo?: boolean; }

interface ApiVariant { variantId: number; name: string; sku: string; price: string; compareAtPrice: string | null; inventory: number; productId?: string; inventoryItemId?: string; }

interface ApiProduct { id: number; title: string; handle: string; descriptionHtml: string; vendor: string; productType: string; status: string; tags: string[]; image: string | null; shopName: string; isDemo: boolean; seoTitle: string; seoDescription: string; images: Array<{ id: string; src: string; alt: string; width: number; height: number }>; variants: ApiVariant[]; }

interface ProductControlPanelProps {
  products?: ApiProduct[];
  stores: StoreEntry[];
  isDemo: boolean;
  onDemoPriceUpdate?: (productId: number, variantId: number, newPrice: number, newInventory: number) => void;
  fullProducts?: ApiProduct[];
}

/* ─── Demo Data ───────────────────────────────────────── */

const DEMO_PRODUCTS_A: ProductDef[] = [
  { id: 7901, title: "碳纤维智能手表 Chrono X", image: null, shopName: "TechGear Pro", shopFlag: "🇺🇸", status: "ACTIVE", hasMultipleVariants: true, vendor: "TechGear Inc", productType: "可穿戴设备", tags: ["新品", "热销"], bodyHtml: "<p>碳纤维打造，续航 14 天，IP68 防水。</p><ul><li>AMOLED 全天候显示</li><li>心率/血氧/睡眠监测</li><li>100+ 运动模式</li></ul><p><strong>82g 超轻机身</strong>，商务运动两不误。</p>", seoTitle: "碳纤维智能手表 Chrono X — TechGear Pro", seoDescription: "14天长续航碳纤维智能手表，IP68防水，支持心率血氧监测。", handle: "chrono-x-carbon-fiber", images: [{ id: 1, src: "/placeholder.jpg", alt: "Chrono X 正面", position: 1, isMain: true }],
    variants: [
      { variantId: 790101, name: "黑色 / 42mm", sku: "TG-CX-BLK42", price: 299.99, inventory: 45, costItem: 120 },
      { variantId: 790102, name: "银色 / 46mm", sku: "TG-CX-SLV46", price: 349.99, inventory: 18, costItem: 140 },
    ],
  },
  { id: 7902, title: "无线降噪耳机 SonicFlow", image: null, images: [{ id: "1", src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400", alt: "SonicFlow 正面", position: 1, isMain: true }], shopName: "TechGear Pro", shopFlag: "🇺🇸", status: "ACTIVE", hasMultipleVariants: false, vendor: "TechGear Inc", productType: "音频设备", tags: ["爆款"], bodyHtml: "<p>40dB 深度降噪，40 小时超长续航。</p><ul><li>自适应 ANC 主动降噪</li><li>LDAC 高清音频支持</li><li>双设备快速切换</li></ul>", seoTitle: "无线降噪耳机 SonicFlow — 40dB降噪", seoDescription: "40dB深度主动降噪，40小时超长续航，支持LDAC高清音频。", handle: "sonicflow-anc-earbuds",
    variants: [{ variantId: 790201, name: "默认", sku: "TG-SF-DEF", price: 149.99, inventory: 120, costItem: 55 }],
  },
  { id: 7903, title: "AR 轻量护目镜 Air", image: null, images: [{ id: "1", src: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400", alt: "AR 护目镜", position: 1, isMain: true }], shopName: "TechGear Pro", shopFlag: "🇺🇸", status: "ACTIVE", hasMultipleVariants: false, vendor: "TechGear Inc", productType: "可穿戴设备",     tags: [],
    bodyHtml: "<p>AR 增强现实护目镜，48° 超宽视野。</p><ul><li>波导光学显示</li><li>120Hz 刷新率</li><li>USB-C 直连手机/PC</li></ul>",
    variants: [{ variantId: 790301, name: "默认", sku: "TG-ARG-AIR", price: 89.99, inventory: 60, costItem: 30 }],
  },
  { id: 7904, title: "电竞机械键盘 K8", image: null, images: [{ id: "1", src: "https://images.unsplash.com/photo-1541140532154-b024d1f0d5d4?w=400", alt: "K8 键盘", position: 1, isMain: true }], shopName: "TechGear Pro", shopFlag: "🇺🇸", status: "DRAFT", hasMultipleVariants: true, vendor: "TechGear Inc", productType: "电脑外设", tags: ["新品"],
    bodyHtml: "<p><strong>87 键紧凑布局</strong>，PBT 双色键帽。</p><ul><li>可选青轴/红轴/茶轴</li><li>全键热插拔</li><li>RGB 背光 16.8M 色</li></ul>",
    variants: [
      { variantId: 790401, name: "青轴 RGB", sku: "TG-K8-BLU", price: 129.99, inventory: 25, costItem: 50 },
      { variantId: 790402, name: "红轴 白光", sku: "TG-K8-RED", price: 119.99, inventory: 30, costItem: 48 },
    ],
  },
];

const DEMO_PRODUCTS_B: ProductDef[] = [
  { id: 7905, title: "极简北欧台灯 LUX", image: null, images: [{ id: "1", src: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400", alt: "LUX 台灯", position: 1, isMain: true }], shopName: "MinimalHome", shopFlag: "🇩🇪", status: "ACTIVE", hasMultipleVariants: false, vendor: "MinimalHome", productType: "家居照明",     tags: ["极简"],
    bodyHtml: "<p>极简北欧设计，3 档亮度 + 暖白光。</p><ul><li>铝合金磨砂灯杆</li><li>触控调光</li><li>Ra>90 高显色</li></ul>",
    variants: [{ variantId: 790501, name: "默认", sku: "MH-LUX1", price: 79.99, inventory: 40, costItem: 28 }],
  },
  { id: 7906, title: "手工亚麻抱枕套 (一对)", image: null, images: [{ id: "1", src: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400", alt: "亚麻抱枕", position: 1, isMain: true }], shopName: "MinimalHome", shopFlag: "🇩🇪", status: "ACTIVE", hasMultipleVariants: true, vendor: "MinimalHome", productType: "家居纺织品", tags: ["手工"],
    bodyHtml: "<p><strong>100% 欧洲亚麻</strong>，手工缝制双面可用。</p><ul><li>OEKO-TEX 认证环保染色</li><li>隐形拉链设计</li><li>可机洗 30°C</li></ul>",
    variants: [
      { variantId: 790601, name: "米白色 45x45", sku: "MH-LIN-CRM45", price: 39.99, inventory: 80, costItem: 12 },
      { variantId: 790602, name: "浅灰 50x50", sku: "MH-LIN-GRY50", price: 44.99, inventory: 60, costItem: 13 },
      { variantId: 790603, name: "深蓝 60x60", sku: "MH-LIN-BLU60", price: 54.99, inventory: 15, costItem: 16 },
    ],
  },
];

// Quick product field type for modal editing
interface EditFields {
  title: string; bodyHtml: string; vendor: string; productType: string;
  tags: string[]; status: "active" | "draft";
  seoTitle: string; seoDescription: string; images: ProductImage[];
  variantPrices: Record<number, number>;
  variantInventories: Record<number, number>;
  variantCosts: Record<number, number>;
}

/* ─── Status Badge / Toggle ──────────────────────────── */

function StatusToggle({ status, onChange }: { status: "ACTIVE" | "DRAFT"; onChange: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(); }} className="shrink-0 cursor-pointer" title={status === "ACTIVE" ? "点击下架" : "点击上架"}>
      {status === "ACTIVE" ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 text-zinc-500" />}
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────── */

export default function ProductControlPanel({
  products, stores, isDemo, onDemoPriceUpdate, fullProducts,
}: ProductControlPanelProps) {
  /* ── State ────────────────────────────────────────── */
  const [catalog, setCatalog] = useState<EditableProduct[]>([]);
  const initialized = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Filters / Sort / Search
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"title" | "inventory" | "price" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Modal state
  const [editProduct, setEditProduct] = useState<EditableProduct | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editTab, setEditTab] = useState<"basic" | "images" | "seo" | "variants">("basic");
  const [editSaving, setEditSaving] = useState(false);
  const [descMode, setDescMode] = useState<"preview" | "edit">("preview");

  // For mass variant price apply
  const [batchVariantPrice, setBatchVariantPrice] = useState("");

  /* ── Init ──────────────────────────────────────────── */
  useEffect(() => {
    if (initialized.current) return;
    const data = isDemo ? DEMO_PRODUCTS_A.concat(DEMO_PRODUCTS_B) : (fullProducts ?? products ?? []);
    if (!data || data.length === 0) return;
    initialized.current = true;
    setCatalog(data.map((p) => ({
      ...p,
      expanded: false,
      status: (p.status === "ACTIVE" || p.status === "active") ? "ACTIVE" as const : "DRAFT" as const,
      vendor: p.vendor || "",
      productType: p.productType || "",
      tags: p.tags ?? [],
      bodyHtml: (p as any).descriptionHtml || (p as any).bodyHtml || "",
      seoTitle: p.seoTitle || p.title,
      seoDescription: p.seoDescription || "",
      handle: p.handle || "",
      images: (p.images || []).map((img, idx) => ({
        id: img.id, src: img.src, alt: img.alt || "",
        position: idx + 1, isMain: idx === 0,
        width: img.width, height: img.height,
      })),
      shopFlag: (p as any).shopFlag || "🌐",
      hasMultipleVariants: p.variants?.length > 1,
      variants: (p.variants ?? []).map((v: any) => ({
        ...v,
        price: typeof v.price === "string" ? parseFloat(v.price) : (v.price || 0),
        newPrice: typeof v.price === "string" ? parseFloat(v.price) : (v.price || 0),
        newInventory: v.inventory ?? 0,
        synced: true,
        syncing: false,
        errorMsg: null,
        costItem: (v as any).costItem ?? Math.round((5 + Math.random() * 45) * 100) / 100,
      })),
    })));
  }, [isDemo, products, fullProducts]);

  /* ── Toggle Expand ─────────────────────────────────── */
  const toggleExpand = (productId: number) => {
    setCatalog((prev) => prev.map((p) => p.id === productId ? { ...p, expanded: !p.expanded } : p));
  };

  /* ── Sync Variant (unchanged from original) ────────── */
  const syncVariant = useCallback(async (productId: number, variantId: number) => {
    const product = catalog.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.variantId === variantId);
    if (!product || !variant || variant.syncing) return;

    if (variant.newPrice === variant.price && variant.newInventory === variant.inventory) return;

    setCatalog((prev) => prev.map((p) => ({
      ...p, variants: p.variants.map((v) => v.variantId === variantId ? { ...v, syncing: true, errorMsg: null } : v),
    })));

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 500));
      setCatalog((prev) => prev.map((p) => ({
        ...p, variants: p.variants.map((v) => v.variantId === variantId
          ? { ...v, price: v.newPrice, inventory: v.newInventory, synced: true, syncing: false }
          : v),
      })));
      onDemoPriceUpdate?.(productId, variantId, variant.newPrice, variant.newInventory);
      showToast("演示模式：变体 " + variant.name + " 已同步");
      return;
    }

    const store = stores[0];
    if (!store?.shopUrl || !store?.accessToken) {
      setCatalog((prev) => prev.map((p) => ({
        ...p, variants: p.variants.map((v) => v.variantId === variantId ? { ...v, syncing: false, errorMsg: "未配置店铺" } : v),
      })));
      return;
    }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProductVariant",
          shopUrl: store.shopUrl,
          accessToken: store.accessToken,
          variantId,
          productId: variant.productId || "",
          inventoryItemId: variant.inventoryItemId || "",
          newPrice: variant.newPrice,
          newInventory: variant.newInventory,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) => prev.map((p) => ({
          ...p, variants: p.variants.map((v) => v.variantId === variantId
            ? { ...v, price: v.newPrice, inventory: v.newInventory, synced: true, syncing: false }
            : v),
        })));
      } else {
        setCatalog((prev) => prev.map((p) => ({
          ...p, variants: p.variants.map((v) => v.variantId === variantId ? { ...v, syncing: false, errorMsg: json.error || "同步失败" } : v),
        })));
      }
    } catch {
      setCatalog((prev) => prev.map((p) => ({
        ...p, variants: p.variants.map((v) => v.variantId === variantId ? { ...v, syncing: false, errorMsg: "网络错误" } : v),
      })));
    }
  }, [catalog, isDemo, onDemoPriceUpdate, stores]);

  /* ── Sync All ──────────────────────────────────────── */
  const syncAllVariants = (productId: number) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) return;
    for (const v of product.variants) {
      if (v.newPrice !== v.price || v.newInventory !== v.inventory) {
        syncVariant(productId, v.variantId);
      }
    }
  };

  /* ── Reset ─────────────────────────────────────────── */
  const resetProduct = (productId: number) => {
    setCatalog((prev) => prev.map((p) => ({
      ...p, variants: p.variants.map((v) => ({ ...v, newPrice: v.price, newInventory: v.inventory, synced: true })),
    })));
  };

  /* ── Open Edit Modal ───────────────────────────────── */
  const openEdit = (product: EditableProduct) => {
    setEditProduct(product);
    setEditTab("basic");
    setDescMode("preview");
    setEditFields({
      title: product.title,
      bodyHtml: (product as any).descriptionHtml || product.bodyHtml || "",
      vendor: product.vendor || "",
      productType: product.productType || "",
      tags: product.tags ?? [],
      status: product.status === "ACTIVE" ? "active" : "draft",
      seoTitle: product.seoTitle || product.title,
      seoDescription: product.seoDescription || "",
      images: product.images ?? (product.image ? [{ id: 0, src: product.image, alt: product.title, position: 1, isMain: true }] : []),
      variantPrices: Object.fromEntries(product.variants.map((v) => [v.variantId, v.newPrice])),
      variantInventories: Object.fromEntries(product.variants.map((v) => [v.variantId, v.newInventory])),
      variantCosts: Object.fromEntries(product.variants.map((v) => [v.variantId, v.costItem ?? 0])),
    });
  };

  /* ── Save Edit ─────────────────────────────────────── */
  const saveEdit = async () => {
    if (!editProduct || !editFields) return;
    setEditSaving(true);

    if (isDemo) {
      setCatalog((prev) => prev.map((p) => {
        if (p.id !== editProduct.id) return p;
        return {
          ...p,
          title: editFields.title,
          status: editFields.status === "active" ? "ACTIVE" : "DRAFT",
          vendor: editFields.vendor,
          productType: editFields.productType,
          tags: editFields.tags,
          bodyHtml: editFields.bodyHtml,
          seoTitle: editFields.seoTitle,
          seoDescription: editFields.seoDescription,
          images: editFields.images,
          variants: p.variants.map((v) => ({
            ...v,
            newPrice: editFields.variantPrices[v.variantId] ?? v.newPrice,
            newInventory: editFields.variantInventories[v.variantId] ?? v.newInventory,
            costItem: editFields.variantCosts[v.variantId] ?? v.costItem,
            synced: v.newPrice === v.price && v.newInventory === v.inventory,
          })),
        };
      }));
      showToast("演示模式：修改已本地生效");
      setEditSaving(false);
      setEditProduct(null);
      setEditFields(null);
      return;
    }

    const store = stores[0];
    if (!store?.shopUrl || !store?.accessToken) { showToast("未配置店铺 Token"); setEditSaving(false); return; }

    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProduct",
          shopUrl: store.shopUrl,
          accessToken: store.accessToken,
          productId: editProduct.id,
          title: editFields.title,
          bodyHtml: editFields.bodyHtml,
          vendor: editFields.vendor,
          productType: editFields.productType,
          tags: editFields.tags,
          status: editFields.status,
          seoTitle: editFields.seoTitle,
          seoDescription: editFields.seoDescription,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCatalog((prev) => prev.map((p) => p.id === editProduct.id ? { ...p, title: editFields.title, status: editFields.status === "active" ? "ACTIVE" : "DRAFT", vendor: editFields.vendor, productType: editFields.productType, tags: editFields.tags, bodyHtml: editFields.bodyHtml, seoTitle: editFields.seoTitle, seoDescription: editFields.seoDescription } : p));
        showToast("商品 \"" + editFields.title + "\" 已更新");
      } else {
        showToast("保存失败: " + (json.error || "未知错误"));
      }
    } catch { showToast("网络错误"); }
    finally { setEditSaving(false); setEditProduct(null); setEditFields(null); }
  };

  /* ── Toggle Status ─────────────────────────────────── */
  const toggleStatus = async (product: EditableProduct) => {
    const newStatus: "ACTIVE" | "DRAFT" = product.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    if (isDemo) {
      setCatalog((prev) => prev.map((p) => p.id === product.id ? { ...p, status: newStatus } : p));
      showToast("演示模式：商品已" + (newStatus === "ACTIVE" ? "上架" : "下架"));
      return;
    }
    const store = stores[0];
    if (!store?.shopUrl || !store?.accessToken) return;
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateProduct", shopUrl: store.shopUrl, accessToken: store.accessToken, productId: product.id, status: newStatus === "ACTIVE" ? "active" : "draft" }),
      });
      if ((await res.json()).success) {
        setCatalog((prev) => prev.map((p) => p.id === product.id ? { ...p, status: newStatus } : p));
        showToast("商品已" + (newStatus === "ACTIVE" ? "上架" : "下架"));
      }
    } catch { showToast("操作失败"); }
  };

  /* ── Filter / Sort ─────────────────────────────────── */
  const filteredCatalog = useMemo(() => {
    let list = [...catalog];
    if (filterStatus !== "all") list = list.filter((p) => p.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));
    }
    if (sortKey) {
      list.sort((a, b) => {
        let va = 0, vb = 0;
        if (sortKey === "title") { va = a.title.localeCompare(b.title); vb = 0; }
        else if (sortKey === "inventory") { va = a.variants.reduce((s, v) => s + v.inventory, 0); vb = b.variants.reduce((s, v) => s + v.inventory, 0); }
        else if (sortKey === "price") { va = Math.min(...a.variants.map((v) => v.price)); vb = Math.min(...b.variants.map((v) => v.price)); }
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }
    return list;
  }, [catalog, filterStatus, searchQuery, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* ── Apply batch variant price ─────────────────────── */
  const applyBatchPrice = () => {
    if (!editProduct || !editFields || !batchVariantPrice) return;
    const val = parseFloat(batchVariantPrice);
    if (isNaN(val) || val <= 0) return;
    setEditFields((prev) => {
      if (!prev) return null;
      const newPrices = { ...prev.variantPrices };
      editProduct.variants.forEach((v) => { newPrices[v.variantId] = val; });
      return { ...prev, variantPrices: newPrices };
    });
    setBatchVariantPrice("");
  };

  /* ── Image management helpers (edit modal) ─────────── */
  const addImage = () => {
    if (!editFields) return;
    const pos = editFields.images.length + 1;
    setEditFields({ ...editFields, images: [...editFields.images, { id: Date.now(), src: "/placeholder.jpg", alt: "", position: pos }] });
  };
  const removeImage = (id: number | string) => {
    if (!editFields || editFields.images.length <= 1) return;
    setEditFields({ ...editFields, images: editFields.images.filter((img) => img.id !== id).map((img, i) => ({ ...img, position: i + 1 })) });
  };
  const setImageAlt = (id: number | string, alt: string) => {
    if (!editFields) return;
    setEditFields({ ...editFields, images: editFields.images.map((img) => img.id === id ? { ...img, alt } : img) });
  };

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toast */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-md">{toast}</div>}

      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><ShoppingCart className="h-6 w-6 text-amber-400" />跨店改价控制</h2>
        <p className="mt-1 text-sm text-muted-foreground">{isDemo ? "多店演示" : stores[0]?.shopName || "商品库"} · {catalog.length} 个商品 · {catalog.reduce((s, p) => s + p.variants.length, 0)} 个变体</p>
      </div>

      {/* Filter / Search / Sort Bar */}
      <Card className="border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索标题或 SKU..." className="h-8 pl-7 text-xs" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 rounded border border-border/40 bg-background px-2 text-xs text-foreground">
            <option value="all">全部状态</option>
            <option value="ACTIVE">上架 (ACTIVE)</option>
            <option value="DRAFT">下架 (DRAFT)</option>
          </select>
          {(["title", "inventory", "price"] as const).map((k) => (
            <button key={k} onClick={() => toggleSort(k)} className="flex items-center gap-0.5 h-8 rounded border border-border/40 bg-background px-2 text-xs text-muted-foreground hover:text-foreground">
              {k === "title" ? "标题" : k === "inventory" ? "库存" : "价格"}
              {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
            </button>
          ))}
          {(searchQuery || filterStatus !== "all") && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}>
              <X className="h-3 w-3" />清除
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filteredCatalog.length} 个商品</span>
        </CardContent>
      </Card>

      {/* Product Cards */}
      <div className="space-y-2">
        {filteredCatalog.map((product) => (
          <Card key={product.id} className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-hidden transition-all">
            {/* Main row */}
            <div className={`flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors ${product.expanded ? "border-b border-border/20" : ""} ${product.hasMultipleVariants ? "cursor-pointer" : ""}`}
              onClick={() => product.hasMultipleVariants && toggleExpand(product.id)}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {product.hasMultipleVariants ? (product.expanded ? <ChevronDown className="h-4 w-4 text-amber-400" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />) : <div className="h-4 w-4" />}
              </div>
              {product.image ? <img src={product.image} alt={product.title} className="h-10 w-10 rounded-md border border-border/50 object-cover shrink-0" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/20"><ImageOff className="h-5 w-5 text-muted-foreground/30" /></div>}
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground truncate">{product.title}</p>
                <div className="flex items-center gap-2 mt-0.5"><span className="text-[11px] text-muted-foreground">{product.shopFlag} {product.shopName}</span></div>
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] px-2 py-0 border ${product.hasMultipleVariants ? "border-amber-500/30 text-amber-400" : "border-border/40 text-muted-foreground"}`}>
                {product.hasMultipleVariants ? "多规格 (" + product.variants.length + ")" : "单规格"}
              </Badge>
              <Badge className={`shrink-0 text-[10px] px-2 py-0 ${product.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                {product.status === "ACTIVE" ? "上架" : "草稿"}
              </Badge>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => openEdit(product)} className="h-8 w-8 p-0" title="编辑详情"><Edit3 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                <StatusToggle status={product.status} onChange={() => toggleStatus(product)} />
              </div>

              {product.hasMultipleVariants ? (
                <p className="text-xs text-muted-foreground/50 shrink-0">点击展开变体</p>
              ) : (() => {
                const v = product.variants[0];
                return (
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm font-semibold text-emerald-400 tabular-nums w-20 text-right">${v.price.toFixed(2)}</span>
                    <span className={`text-sm font-medium tabular-nums w-10 text-right ${v.inventory < 10 ? "text-red-400" : "text-foreground"}`}>{v.inventory}</span>
                    <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-muted-foreground" />
                      <Input type="number" step={0.01} min={0} value={v.newPrice} onChange={(e) => setCatalog((prev) => prev.map((p) => ({ ...p, variants: p.variants.map((vv) => vv.variantId === v.variantId ? { ...vv, newPrice: Number(e.target.value) || 0, synced: false } : vv) })))}
                        className={`h-8 w-24 text-center text-sm tabular-nums ${v.newPrice < v.price ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400" : v.newPrice > v.price ? "border-amber-500/40 bg-amber-500/5 text-amber-400" : ""}`} />
                    </div>
                    <Input type="number" step={1} min={0} value={v.newInventory} onChange={(e) => setCatalog((prev) => prev.map((p) => ({ ...p, variants: p.variants.map((vv) => vv.variantId === v.variantId ? { ...vv, newInventory: Number(e.target.value) || 0, synced: false } : vv) })))}
                      className="h-8 w-20 text-center text-sm tabular-nums" />
                    {v.syncing ? <Button size="sm" disabled className="h-8 gap-1 text-xs"><RefreshCw className="h-3 w-3 animate-spin" />同步中</Button>
                    : v.synced ? <Badge className="bg-emerald-500/15 text-emerald-400 px-2 py-1 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />已同步</Badge>
                    : v.newPrice !== v.price || v.newInventory !== v.inventory ? <Button size="sm" onClick={() => syncVariant(product.id, v.variantId)} className="h-8 gap-1 bg-amber-600 text-white hover:bg-amber-500 text-xs"><Save className="h-3 w-3" />同步</Button>
                    : <span className="text-xs text-muted-foreground w-14 text-center">无变更</span>}
                  </div>
                );
              })()}
            </div>

            {/* Expanded sub-table */}
            {product.expanded && product.hasMultipleVariants && (
              <CardContent className="px-5 py-3 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" onClick={() => syncAllVariants(product.id)} className="h-8 gap-1 bg-emerald-600 text-white hover:bg-emerald-500 text-xs"><Zap className="h-3 w-3" />一键同步全部变体</Button>
                  <Button size="sm" variant="outline" onClick={() => resetProduct(product.id)} className="h-8 gap-1 text-xs"><RotateCcw className="h-3 w-3" />重置</Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 text-left pl-2">变体</th>
                      <th className="py-2 text-left">SKU</th>
                      <th className="py-2 text-right">当前价</th>
                      <th className="py-2 text-right">库存</th>
                      <th className="py-2 text-right">新价</th>
                      <th className="py-2 text-right">新库存</th>
                      <th className="py-2 text-center w-24">同步</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.variantId} className="border-b border-border/10 transition-colors hover:bg-muted/10">
                        <td className="py-2 pl-2 text-sm text-foreground">{v.name}</td>
                        <td className="py-2 text-xs text-muted-foreground font-mono">{v.sku}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-400 font-semibold">${v.price.toFixed(2)}</td>
                        <td className={`py-2 text-right tabular-nums font-medium ${v.inventory < 10 ? "text-red-400" : "text-foreground"}`}>{v.inventory}</td>
                        <td className="py-2 text-right">
                          <Input type="number" step={0.01} min={0} value={v.newPrice} onChange={(e) => setCatalog((prev) => prev.map((p) => ({ ...p, variants: p.variants.map((vv) => vv.variantId === v.variantId ? { ...vv, newPrice: Number(e.target.value) || 0, synced: false } : vv) })))}
                            className={`h-7 w-24 text-center text-xs tabular-nums inline-block ${v.newPrice < v.price ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400" : v.newPrice > v.price ? "border-amber-500/40 bg-amber-500/5 text-amber-400" : ""}`} />
                        </td>
                        <td className="py-2 text-right">
                          <Input type="number" step={1} min={0} value={v.newInventory} onChange={(e) => setCatalog((prev) => prev.map((p) => ({ ...p, variants: p.variants.map((vv) => vv.variantId === v.variantId ? { ...vv, newInventory: Number(e.target.value) || 0, synced: false } : vv) })))}
                            className="h-7 w-20 text-center text-xs tabular-nums inline-block" />
                        </td>
                        <td className="py-2 text-center">
                          {v.errorMsg && <p className="text-[10px] text-red-400">{v.errorMsg}</p>}
                          {v.syncing ? <Button size="sm" disabled className="h-7 gap-1 text-[10px]"><RefreshCw className="h-2.5 w-2.5 animate-spin" />中</Button>
                          : v.synced ? <Badge className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />已同步</Badge>
                          : v.newPrice !== v.price || v.newInventory !== v.inventory ? <Button size="sm" onClick={() => syncVariant(product.id, v.variantId)} className="h-7 gap-1 bg-amber-600 text-white hover:bg-amber-500 text-[10px]"><Save className="h-2.5 w-2.5" />同步</Button>
                          : <span className="text-[10px] text-muted-foreground">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* =========================== EDIT MODAL =========================== */}
      {editProduct && editFields && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => { setEditProduct(null); setEditFields(null); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[90vh] rounded-xl border border-border/40 bg-card shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/20 px-5 py-3 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">编辑商品</h3>
                  <p className="text-[10px] text-muted-foreground">{editProduct.title}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setEditProduct(null); setEditFields(null); }} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/20 px-5 shrink-0">
                {(["basic", "images", "seo", "variants"] as const).map((t) => (
                  <button key={t} onClick={() => setEditTab(t)} className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${editTab === t ? "border-emerald-500 text-emerald-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {t === "basic" ? "基本信息" : t === "images" ? "图片管理" : t === "seo" ? "SEO 元数据" : "变体编辑"}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {editTab === "basic" && (
                  <>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">商品标题 *</label>
                      <Input value={editFields.title} onChange={(e) => setEditFields({ ...editFields, title: e.target.value })} className="h-9 text-sm" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">商品描述</label>
                        <div className="flex bg-muted/20 rounded-md p-0.5">
                          <button onClick={() => setDescMode("preview")} className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${descMode === "preview" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>预览</button>
                          <button onClick={() => setDescMode("edit")} className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${descMode === "edit" ? "bg-sky-500/20 text-sky-400" : "text-muted-foreground hover:text-foreground"}`}>编辑</button>
                        </div>
                      </div>
                      {descMode === "preview" ? (
                        <div
                          className="min-h-[100px] rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-xs text-foreground overflow-auto
                            [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
                            [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs
                            [&_strong]:font-bold [&_em]:italic
                            [&_p]:mb-1 [&_li]:mb-0.5"
                          dangerouslySetInnerHTML={{ __html: editFields.bodyHtml || "<span class='text-muted-foreground italic'>暂无描述</span>" }}
                        />
                      ) : (
                        <textarea
                          value={editFields.bodyHtml || ""}
                          onChange={(e) => setEditFields({ ...editFields, bodyHtml: e.target.value })}
                          placeholder={"输入 HTML 格式的商品描述，支持 <p> <ul> <strong> 等标签"}
                          rows={5}
                          className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-xs text-foreground font-mono resize-y placeholder:text-muted-foreground/50"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">供应商/Vendor</label>
                        <Input value={editFields.vendor} onChange={(e) => setEditFields({ ...editFields, vendor: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">品类/Product Type</label>
                        <Input value={editFields.productType} onChange={(e) => setEditFields({ ...editFields, productType: e.target.value })} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">标签 (逗号分隔)</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {editFields.tags.map((t) => (
                          <Badge key={t} className="text-[10px] px-2 py-0.5 gap-1 bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                            {t} <button onClick={() => setEditFields({ ...editFields, tags: editFields.tags.filter((x) => x !== t) })}><X className="h-2.5 w-2.5" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input placeholder="新标签..." className="h-8 text-xs" onKeyDown={(e) => {
                          if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v && !editFields.tags.includes(v)) setEditFields({ ...editFields, tags: [...editFields.tags, v] }); (e.target as HTMLInputElement).value = ""; }
                        }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">商品状态</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditFields({ ...editFields, status: "active" })} className={`px-3 py-1.5 rounded text-xs font-medium ${editFields.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "border border-border/30 text-muted-foreground"}`}>上架 (Active)</button>
                        <button onClick={() => setEditFields({ ...editFields, status: "draft" })} className={`px-3 py-1.5 rounded text-xs font-medium ${editFields.status === "draft" ? "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" : "border border-border/30 text-muted-foreground"}`}>下架 (Draft)</button>
                      </div>
                    </div>
                  </>
                )}

                {editTab === "images" && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{editFields.images.length} 张图片</p>
                      <Button size="sm" variant="outline" onClick={addImage} className="h-8 gap-1 text-xs"><Upload className="h-3 w-3" />添加图片 (模拟)</Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {editFields.images.length > 0 ? editFields.images.map((img, idx) => (
                        <div key={img.id || idx} className="relative rounded-lg border border-border/20 bg-muted/10 overflow-hidden group">
                          <img src={img.src} alt={img.alt || editFields.title} className="w-full h-32 object-cover" />
                          {idx === 0 && <Badge className="absolute top-1 left-1 text-[9px] px-1 py-0 bg-sky-500/80 text-white border-0">主图</Badge>}
                          {idx > 0 && editFields.images.length > 1 && (
                            <button onClick={() => removeImage(img.id)} className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></button>
                          )}
                          <div className="px-2 py-2">
                            <Input value={img.alt || ""} onChange={(e) => setImageAlt(img.id, e.target.value)} placeholder="Alt 文本 (SEO)..." className="h-7 text-[10px]" />
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-3 flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
                          <Image className="h-8 w-8 text-muted-foreground/20 mb-2" />
                          <span>暂无图片</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {editTab === "seo" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">页面标题 / SEO Title</label>
                        <span className={"text-[10px] " + (editFields.seoTitle.length > 70 ? "text-red-400" : "text-muted-foreground")}>{editFields.seoTitle.length}/70</span>
                      </div>
                      <Input value={editFields.seoTitle} onChange={(e) => setEditFields({ ...editFields, seoTitle: e.target.value })} maxLength={70} className="h-9 text-sm" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SEO 描述 / Meta Description</label>
                        <span className={"text-[10px] " + (editFields.seoDescription.length > 320 ? "text-red-400" : "text-muted-foreground")}>{editFields.seoDescription.length}/320</span>
                      </div>
                      <textarea value={editFields.seoDescription} onChange={(e) => setEditFields({ ...editFields, seoDescription: e.target.value })} maxLength={320} rows={3} className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-xs resize-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">URL 句柄 / Handle</label>
                      <Input value={editProduct.handle || ""} readOnly className="h-9 text-sm text-muted-foreground bg-muted/10" />
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Shopify 自动生成，不可手动编辑</p>
                    </div>
                  </>
                )}

                {editTab === "variants" && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Input type="number" step={0.01} min={0} value={batchVariantPrice} onChange={(e) => setBatchVariantPrice(e.target.value)} placeholder="批量价格..." className="h-8 w-32 text-xs" />
                      <Button size="sm" variant="outline" onClick={applyBatchPrice} className="h-8 text-xs">应用到全部变体</Button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 text-left">变体</th>
                          <th className="py-2 text-left">SKU</th>
                          <th className="py-2 text-right">价格</th>
                          <th className="py-2 text-right">库存</th>
                          <th className="py-2 text-right">成本价</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editProduct.variants.map((v) => (
                          <tr key={v.variantId} className="border-b border-border/10">
                            <td className="py-2 text-sm text-foreground">{v.name}</td>
                            <td className="py-2 text-xs text-muted-foreground font-mono">{v.sku}</td>
                            <td className="py-2 text-right">
                              <Input type="number" step={0.01} min={0} value={editFields.variantPrices[v.variantId] ?? v.newPrice}
                                onChange={(e) => setEditFields({ ...editFields, variantPrices: { ...editFields.variantPrices, [v.variantId]: Number(e.target.value) || 0 } })}
                                className="h-7 w-24 text-center text-xs inline-block" />
                            </td>
                            <td className="py-2 text-right">
                              <Input type="number" step={1} min={0} value={editFields.variantInventories[v.variantId] ?? v.newInventory}
                                onChange={(e) => setEditFields({ ...editFields, variantInventories: { ...editFields.variantInventories, [v.variantId]: Number(e.target.value) || 0 } })}
                                className="h-7 w-20 text-center text-xs inline-block" />
                            </td>
                            <td className="py-2 text-right">
                              <Input type="number" step={0.01} min={0} value={editFields.variantCosts[v.variantId] ?? 0}
                                onChange={(e) => setEditFields({ ...editFields, variantCosts: { ...editFields.variantCosts, [v.variantId]: Number(e.target.value) || 0 } })}
                                className="h-7 w-24 text-center text-xs inline-block" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Bottom bar */}
              <div className="flex items-center gap-2 border-t border-border/20 px-5 py-3 shrink-0">
                <Button onClick={saveEdit} disabled={editSaving} className="flex-1 h-9 gap-1.5 text-white" style={{ background: "#3b82f6" }}>
                  {editSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />保存中...</> : <><Save className="h-3.5 w-3.5" />保存修改</>}
                </Button>
                <Button variant="outline" onClick={() => { setEditProduct(null); setEditFields(null); }} className="h-9">取消</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
