"use client";

import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import {
  Wand2, Sparkles, Search, Download, ClipboardCopy, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, FileJson, Play, RotateCcw, X, Loader2, Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type SchemaGenerationResult, type GeneratorProduct, type GeneratorContent,
  type ShopInfo, type InjectionRecord, type SchemaTypeKey,
  generateSchemasForProduct, generateOrganizationSchema, generateArticleSchema,
  injectSchemaToBodyHtml, SCHEMA_TYPE_LIST,
} from "@/lib/schema-generator";
import { consumeSchemaGenLink } from "@/lib/schema-gen-link";

/* ─── Props ──────────────────────────────────────────── */

interface DashboardFullProduct {
  id: number; title: string; handle: string; descriptionHtml: string; vendor: string;
  productType: string; status: string; image: string | null;
  variants?: Array<{ variantId: number; name: string; sku: string | null; price: string | number | null; inventory: number }>;
}
interface DashboardContent {
  id: number; title: string; handle: string; bodyHtml: string;
  published?: boolean; author?: string; published_at?: string; created_at?: string;
}
interface DashboardBlog {
  id: number; title: string; handle: string;
  articles?: Array<{ id: number; title: string; handle: string; bodyHtml: string; author?: string; createdAt?: string }>;
}

interface SchemaGeneratorPanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken: string;
  shopName: string;
  domain?: string;
  currency?: string;
  fullProducts?: DashboardFullProduct[];
  pages?: DashboardContent[] | null;
  blogs?: DashboardBlog[] | null;
  collections?:
    | Array<{ id: number; title: string; handle: string }>
    | { smart?: Array<{ id: number; title: string; handle: string }>; custom?: Array<{ id: number; title: string; handle: string }> }
    | null;
}

/* ─── Demo 数据 ───────────────────────────────────────── */
const DEMO_PRODUCTS: GeneratorProduct[] = [
  { id: 1, title: "碳纤维智能手表 Chrono X", handle: "chrono-x", descriptionHtml: "<p>轻量碳纤维表壳，7 天续航，支持心率与血氧监测。</p>", bodyHtml: "<p>轻量碳纤维表壳，7 天续航，支持心率与血氧监测。</p>", image: "https://demo.myshopify.com/cdn/chrono.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", sku: "TG-CX-001", price: 299.99, currency: "USD", inventory: 120, brand: "TechGear", ratingValue: 4.7, reviewCount: 132, hasReviews: true, variants: [{ variantId: 11, name: "默认", sku: "TG-CX-001", price: "299.99", inventory: 120 }], metafields: [{ namespace: "judgeme", key: "reviews", value: JSON.stringify([{ reviewer: { name: "Lily" }, body: "续航真的强，做工精致！", rating: 5 }, { reviewer: { name: "Tom" }, body: "表带有点紧，其他都好。", rating: 4 }]) }] },
  { id: 2, title: "无线降噪耳机 SonicFlow", handle: "sonicflow", descriptionHtml: "<p>主动降噪，30 小时续航。</p>", bodyHtml: "<p>主动降噪，30 小时续航。</p>", image: null, productType: "音频设备", vendor: "TechGear", status: "ACTIVE", sku: null, price: 149.99, currency: "USD", inventory: 80, brand: "TechGear", ratingValue: null, reviewCount: null, hasReviews: false, variants: [{ variantId: 21, name: "默认", sku: null, price: "149.99", inventory: 80 }] },
  { id: 3, title: "AR 护目镜 Air", handle: "ar-goggles-air", descriptionHtml: "<p>沉浸式 AR 体验。</p>", bodyHtml: "<p>沉浸式 AR 体验。</p>", image: "https://demo.myshopify.com/cdn/ar.jpg", productType: "可穿戴设备", vendor: "TechGear", status: "ACTIVE", sku: "TG-ARG-001", price: 89.99, currency: "USD", inventory: 0, brand: "TechGear", ratingValue: 4.2, reviewCount: 18, hasReviews: false, variants: [{ variantId: 31, name: "默认", sku: "TG-ARG-001", price: "89.99", inventory: 0 }] },
  { id: 4, title: "机械键盘 K8 青轴", handle: "k8-blue", descriptionHtml: "<p>Q：这把键盘支持热插拔吗？\nA：支持，所有轴体均可热插拔。\n\nQ：有 RGB 背光吗？\nA：有，支持 16 种灯效。</p>", bodyHtml: "<p>Q：这把键盘支持热插拔吗？\nA：支持，所有轴体均可热插拔。</p><p>Q：有 RGB 背光吗？\nA：有，支持 16 种灯效。</p>", image: "https://demo.myshopify.com/cdn/k8.jpg", productType: "电脑外设", vendor: "KeyLab", status: "ACTIVE", sku: "KL-K8-BLU", price: 129.99, currency: "USD", inventory: 40, brand: "KeyLab", ratingValue: null, reviewCount: null, hasReviews: false, variants: [{ variantId: 41, name: "青轴", sku: "KL-K8-BLU", price: "129.99", inventory: 40 }] },
  { id: 5, title: "北欧极简台灯 LUX", handle: "lux-lamp", descriptionHtml: "<p>无极调光，护眼 LED。</p>", bodyHtml: "<p>无极调光，护眼 LED。</p>", image: "https://demo.myshopify.com/cdn/lux.jpg", productType: "家居照明", vendor: "MinimalHome", status: "DRAFT", sku: "MH-LUX-01", price: 79.99, currency: "USD", inventory: 60, brand: "MinimalHome", ratingValue: 4.9, reviewCount: 56, hasReviews: true, variants: [{ variantId: 51, name: "默认", sku: "MH-LUX-01", price: "79.99", inventory: 60 }] },
  { id: 6, title: "亚麻抱枕套", handle: "linen-pillow", descriptionHtml: "<p>天然亚麻，亲肤透气。</p>", bodyHtml: "<p>天然亚麻，亲肤透气。</p>", image: "https://demo.myshopify.com/cdn/pillow.jpg", productType: "家居纺织品", vendor: "MinimalHome", status: "ACTIVE", sku: null, price: null, currency: "USD", inventory: 0, brand: "MinimalHome", ratingValue: null, reviewCount: null, hasReviews: false, variants: [{ variantId: 61, name: "默认", sku: null, price: "0", inventory: 0 }] },
  { id: 7, title: "便携咖啡手冲壶", handle: "pour-over-kettle", descriptionHtml: "<p>304 不锈钢，精准控温。</p>", bodyHtml: "<p>304 不锈钢，精准控温。</p>", image: "https://demo.myshopify.com/cdn/kettle.jpg", productType: "厨房用品", vendor: "BrewMaster", status: "ACTIVE", sku: "BM-KET-01", price: 59.99, currency: "USD", inventory: 25, brand: "BrewMaster", ratingValue: 4.5, reviewCount: 41, hasReviews: false, variants: [{ variantId: 71, name: "默认", sku: "BM-KET-01", price: "59.99", inventory: 25 }] },
  { id: 8, title: "瑜伽垫 Pro", handle: "yoga-mat-pro", descriptionHtml: "<p>TPE 环保材质，防滑回弹。</p>", bodyHtml: "<p>TPE 环保材质，防滑回弹。</p>", image: null, productType: "运动健身", vendor: "FitLife", status: "ACTIVE", sku: "FL-YM-PRO", price: 39.99, currency: "USD", inventory: 200, brand: "FitLife", ratingValue: null, reviewCount: null, hasReviews: false, variants: [{ variantId: 81, name: "默认", sku: "FL-YM-PRO", price: "39.99", inventory: 200 }] },
];

const DEMO_COLLECTIONS = [
  { id: 1, title: "全部数码", handle: "all-tech" },
  { id: 2, title: "家居好物", handle: "home-goods" },
];

const HISTORY_KEY = "schema_injection_history";

/* ─── 数据映射 ───────────────────────────────────────── */

function mapDashboardProduct(p: DashboardFullProduct, currency: string): GeneratorProduct {
  const v0 = p.variants && p.variants[0];
  const price = v0 && v0.price !== null && v0.price !== undefined && v0.price !== ""
    ? (typeof v0.price === "number" ? v0.price : parseFloat(String(v0.price)))
    : null;
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.descriptionHtml || "",
    bodyHtml: p.descriptionHtml || "",
    image: p.image,
    productType: p.productType || "",
    vendor: p.vendor || "",
    status: p.status,
    sku: v0?.sku ?? null,
    price,
    currency,
    inventory: v0?.inventory ?? 0,
    brand: p.vendor || null,
    ratingValue: null,
    reviewCount: null,
    hasReviews: false,
    variants: (p.variants || []).map((v) => ({ variantId: v.variantId, name: v.name, sku: v.sku, price: v.price, inventory: v.inventory })),
  };
}

/* ─── 注入历史读写 ───────────────────────────────────── */

function readHistory(): InjectionRecord[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(HISTORY_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function appendHistory(rec: InjectionRecord): void {
  if (typeof window === "undefined") return;
  const all = readHistory();
  all.unshift(rec);
  const trimmed = all.slice(0, 100); // 最多保留 100 条
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota */ }
}

/* ─── 注入 API 调用 ──────────────────────────────────── */

async function callUpdateProduct(
  shopUrl: string, accessToken: string, productId: number, bodyHtml: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/shopify/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateProduct", shopUrl, accessToken, productId, bodyHtml }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) return { ok: true };
    if (res.status === 401) return { ok: false, error: "Token 已过期，请重新绑定店铺" };
    if (res.status === 403) return { ok: false, error: "权限不足（应用无 write_products 权限）" };
    if (res.status === 422) return { ok: false, error: "内容过长被截断或服务端校验失败" };
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "网络异常，注入请求失败" };
  }
}

/* ─── 主组件 ──────────────────────────────────────────── */

export default function SchemaGeneratorPanel(props: SchemaGeneratorPanelProps) {
  const { isDemo, shopUrl, accessToken, shopName, domain, currency, fullProducts, pages, blogs, collections } = props;

  const [scope, setScope] = useState<"all_missing" | "category" | "collection" | "manual">("all_missing");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [manualSelected, setManualSelected] = useState<Set<number>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<SchemaTypeKey>>(new Set(["Product"]));
  const [preview, setPreview] = useState<SchemaGenerationResult[] | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, fail: 0, skipped: 0 });
  const [failList, setFailList] = useState<Array<{ title: string; reason: string }>>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [showRollback, setShowRollback] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const shopInfo: ShopInfo = useMemo(() => ({
    name: shopName,
    domain: (domain || shopUrl || "your-store.myshopify.com").replace(/^https?:\/\//, ""),
    currency: currency || "USD",
  }), [shopName, domain, shopUrl, currency]);

  const products: GeneratorProduct[] = useMemo(() => {
    if (isDemo) return DEMO_PRODUCTS;
    return (fullProducts || []).map((p) => mapDashboardProduct(p, currency || "USD"));
  }, [isDemo, fullProducts, currency]);

  const contentItems: GeneratorContent[] = useMemo(() => {
    const out: GeneratorContent[] = [];
    for (const c of pages || []) {
      out.push({ id: c.id, title: c.title, handle: c.handle, bodyHtml: c.bodyHtml, publishedAt: c.published_at || c.created_at || null, author: c.author || null, kind: "page" });
    }
    for (const b of blogs || []) {
      for (const a of b.articles || []) {
        out.push({ id: a.id, title: a.title, handle: a.handle, bodyHtml: a.bodyHtml, publishedAt: a.createdAt || null, author: a.author || null, kind: "article" });
      }
    }
    return out;
  }, [pages, blogs]);

  const categoryOptions = useMemo(() => Array.from(new Set(products.map((p) => p.productType).filter(Boolean))), [products]);
  const collectionOptions = useMemo(() => {
    if (isDemo) return DEMO_COLLECTIONS;
    if (!collections) return [];
    if (Array.isArray(collections)) return collections;
    // 真实模式下 API 返回 { smart: [...], custom: [...] }
    const c = collections as { smart?: Array<{ id: number; title: string; handle: string }>; custom?: Array<{ id: number; title: string; handle: string }> };
    return [...(c.smart || []), ...(c.custom || [])];
  }, [isDemo, collections]);

  // 处理来自 SchemaAuditPanel 的联动参数
  useEffect(() => {
    const link = consumeSchemaGenLink();
    if (!link) return;
    // 根据缺失字段反推需要生成的类型
    const typeSet = new Set<SchemaTypeKey>();
    const field = link.fieldName.toLowerCase();
    if (link.schemaType === "Product" || ["brand", "sku", "image", "offers", "aggregateRating", "review"].some((k) => field.includes(k))) typeSet.add("Product");
    if (link.schemaType === "FAQPage" || field.includes("faq") || field.includes("mainentity")) typeSet.add("FAQPage");
    if (link.schemaType === "Review" || field.includes("review")) typeSet.add("Review");
    if (link.schemaType === "BreadcrumbList" || field.includes("breadcrumb") || field.includes("itemlist")) typeSet.add("BreadcrumbList");
    if (link.schemaType === "Organization") typeSet.add("Organization");
    if (link.schemaType === "Article") typeSet.add("Article");
    if (typeSet.size === 0) typeSet.add("Product");
    setSelectedTypes(typeSet);
    // 范围：若审计面板预筛了商品，则用「手动选择」；否则全部缺失
    if (link.productIds && link.productIds.length > 0) {
      setScope("manual");
      setManualSelected(new Set(link.productIds));
    } else {
      setScope("all_missing");
    }
    showToast(`已接收审计修复任务：${link.schemaType} · 缺失字段「${link.fieldName}」`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初始化历史计数
  useEffect(() => {
    setHistoryCount(readHistory().length);
  }, []);

  /* ── 计算目标商品范围 ── */
  const scopedProducts = useMemo(() => {
    let list = products;
    if (scope === "category") {
      list = categoryFilter ? products.filter((p) => p.productType === categoryFilter) : products;
    } else if (scope === "manual") {
      list = products.filter((p) => manualSelected.has(p.id));
    } else if (scope === "all_missing") {
      // 仅保留「缺失任一已选类型」的商品
      list = products.filter((p) => {
        for (const t of selectedTypes) {
          // 简单判缺：商品 bodyHtml 中不存在该类型 Schema 即视为缺失
          // （真实场景用 descriptionHtml 作 bodyHtml，演示为空一定缺失）
          const body = p.bodyHtml || "";
          if (!body.includes(`"@type":"${t}"`) && !body.includes(`"@type": "${t}"`)) return true;
        }
        return false;
      });
    }
    return list;
  }, [products, scope, categoryFilter, manualSelected, selectedTypes]);

  /* ── 生成预览 ── */
  const generatePreview = useCallback(() => {
    const types = Array.from(selectedTypes);
    if (types.length === 0) { showToast("请至少选择一个 Schema 类型"); return; }
    if (scopedProducts.length === 0) { showToast("当前范围下没有可生成的目标商品"); return; }

    const results: SchemaGenerationResult[] = [];
    const chosenCollection = collectionOptions.find((c) => c.handle === collectionFilter) || collectionOptions[0];

    for (const p of scopedProducts) {
      // 站点级 Organization 仅生成一次（标记为 productId=0）
      if (types.includes("Organization")) {
        // 在循环外统一追加，避免重复
      }
      // 收集型：若用户选了「指定集合」或商品属于某集合，则附加面包屑
      let prodForBreadcrumb = p;
      if (types.includes("BreadcrumbList") && chosenCollection) {
        prodForBreadcrumb = { ...p, collections: [{ id: chosenCollection.id, title: chosenCollection.title, handle: chosenCollection.handle }] };
      }
      const genTypes: SchemaTypeKey[] = types.filter((t) => t !== "Organization");
      const r = generateSchemasForProduct(prodForBreadcrumb, genTypes, shopInfo);
      results.push(...r);
    }

    if (types.includes("Organization")) {
      results.unshift(generateOrganizationSchema(shopInfo));
    }
    // Article 单独基于内容页
    if (types.includes("Article")) {
      for (const c of contentItems) {
        results.push(generateArticleSchema(c, shopInfo));
      }
    }

    setPreview(results);
    showToast(`已生成 ${results.length} 条 Schema 预览`);
  }, [selectedTypes, scopedProducts, shopInfo, collectionOptions, collectionFilter, contentItems, showToast]);

  /* ── 注入执行 ── */
  const doInject = useCallback(async () => {
    if (!preview || preview.length === 0) return;
    setInjecting(true);
    setFailList([]);
    const total = preview.length;
    let success = 0, fail = 0, skipped = 0;
    const fails: Array<{ title: string; reason: string }> = [];

    // 按 productId 分组（同商品的多个 Schema 合并注入到同一 bodyHtml）
    const byProduct = new Map<number, SchemaGenerationResult[]>();
    for (const r of preview) {
      if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
      byProduct.get(r.productId)!.push(r);
    }

    const entries = Array.from(byProduct.entries());
    for (let i = 0; i < entries.length; i++) {
      const [productId, results] = entries[i];
      // 站点级 (0) 不写商品，仅记录
      if (productId === 0) {
        // Organization 注入到 theme（此处仅模拟/记录，不调用商品 API）
        for (const r of results) {
          appendHistory({ productId: 0, productTitle: r.productTitle, originalBodyHtml: "", injectedBodyHtml: r.jsonLD, timestamp: Date.now(), schemaType: r.schemaType });
        }
        success += results.length;
        setProgress({ done: i + 1, total: entries.length, success, fail, skipped });
        if (isDemo) { await new Promise((res) => setTimeout(res, 300)); }
        continue;
      }

      const product = products.find((p) => p.id === productId);
      if (!product) { fail += results.length; for (const r of results) fails.push({ title: r.productTitle, reason: "商品未找到" }); setProgress({ done: i + 1, total: entries.length, success, fail, skipped }); continue; }

      // 检测是否已存在任意待注入类型 → 跳过
      const allExist = results.every((r) => r.alreadyExists);
      if (allExist) {
        skipped += results.length;
        setProgress({ done: i + 1, total: entries.length, success, fail, skipped });
        if (isDemo) { await new Promise((res) => setTimeout(res, 300)); }
        continue;
      }

      // 合并生成新的 bodyHtml
      let newBody = product.bodyHtml || product.descriptionHtml || "";
      const injectedSchemas: SchemaGenerationResult[] = [];
      for (const r of results) {
        const merged = injectSchemaToBodyHtml(newBody, r.jsonLD, r.schemaType);
        if (merged !== newBody) { // 真实注入了
          newBody = merged;
          injectedSchemas.push(r);
        } else {
          skipped += 1;
        }
      }

      if (injectedSchemas.length === 0) {
        setProgress({ done: i + 1, total: entries.length, success, fail, skipped });
        if (isDemo) { await new Promise((res) => setTimeout(res, 300)); }
        continue;
      }

      if (isDemo) {
        await new Promise((res) => setTimeout(res, 300));
        appendHistory({ productId, productTitle: product.title, originalBodyHtml: product.bodyHtml || product.descriptionHtml || "", injectedBodyHtml: newBody, timestamp: Date.now(), schemaType: injectedSchemas.map((s) => s.schemaType).join(",") });
        success += injectedSchemas.length;
        showToast("演示模式：Schema 已模拟注入");
      } else {
        const orig = product.bodyHtml || product.descriptionHtml || "";
        const resp = await callUpdateProduct(shopUrl, accessToken, productId, newBody);
        if (resp.ok) {
          appendHistory({ productId, productTitle: product.title, originalBodyHtml: orig, injectedBodyHtml: newBody, timestamp: Date.now(), schemaType: injectedSchemas.map((s) => s.schemaType).join(",") });
          success += injectedSchemas.length;
        } else {
          fail += injectedSchemas.length;
          fails.push({ title: product.title, reason: resp.error || "未知错误" });
        }
        // 串行间隔 500ms
        await new Promise((res) => setTimeout(res, 500));
      }
      setProgress({ done: i + 1, total: entries.length, success, fail, skipped });
    }

    setInjecting(false);
    setHistoryCount(readHistory().length);
    if (fail > 0) setFailList(fails);
    showToast(`成功注入 ${success} 件，失败 ${fail} 件，${skipped} 件已有该 Schema 跳过`);
  }, [preview, products, shopUrl, accessToken, isDemo, showToast]);

  /* ── 回滚全部 ── */
  const doRollbackAll = useCallback(async () => {
    const history = readHistory();
    if (history.length === 0) { showToast("没有可回滚的注入记录"); return; }

    let success = 0, fail = 0;
    if (isDemo) {
      await new Promise((res) => setTimeout(res, 300));
      success = history.filter((h) => h.productId !== 0).length + history.filter((h) => h.productId === 0).length;
      showToast(`演示模式：已模拟回滚 ${success} 条注入`);
    } else {
      for (const h of history) {
        if (h.productId === 0) { success += 1; continue; }
        const resp = await callUpdateProduct(shopUrl, accessToken, h.productId, h.originalBodyHtml);
        if (resp.ok) success += 1; else fail += 1;
        await new Promise((res) => setTimeout(res, 500));
      }
    }
    // 清空历史
    try { window.localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    setHistoryCount(0);
    setShowRollback(false);
    if (fail > 0) showToast(`回滚完成：${success} 成功，${fail} 失败`);
    else showToast(`已回滚全部 ${success} 条注入`);
  }, [isDemo, shopUrl, accessToken, showToast]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(label + " 已复制");
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        showToast(label + " 已复制");
      }
    } catch {
      showToast("复制失败");
    }
  }, [showToast]);

  const exportingCsv = useCallback(() => {
    if (!preview) return;
    const header = ["商品/页面", "Schema类型", "新增字段", "是否已存在", "JSON-LD"];
    const rows = preview.map((r) => [r.productTitle, r.schemaType, r.newFields.join(" | "), r.alreadyExists ? "是" : "否", r.jsonLD]);
    const csv = [header, ...rows].map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${shopName || "store"}_Schema_生成清单_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("生成清单 CSV 已下载");
  }, [preview, shopName, showToast]);

  const toggleType = (t: SchemaTypeKey) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const toggleManual = (id: number) => {
    setManualSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-600/90 px-4 py-2 text-base font-medium text-white shadow-2xl">{toast}</div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Wand2 className="h-6 w-6 text-emerald-400" />Schema 结构化数据生成与注入
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            {shopName} · 一键生成标准 JSON-LD 并写回 Shopify
            {isDemo && <span className="ml-2 text-sm text-amber-400">(演示)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportingCsv} disabled={!preview} className="h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" />导出 CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowRollback(true)} className="h-9 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />回滚 ({historyCount})
          </Button>
        </div>
      </div>

      {/* 顶部选择区 */}
      <Card className="border-border/40 bg-card/60">
        <CardContent className="space-y-3 p-4">
          {/* 目标范围 */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-muted-foreground">目标范围</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className="rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-emerald-500/50"
            >
              <option value="all_missing">全部缺失商品</option>
              <option value="category">指定品类</option>
              <option value="collection">指定集合</option>
              <option value="manual">手动选择商品</option>
            </select>

            {scope === "category" && (
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-emerald-500/50">
                <option value="">— 选择品类 —</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {scope === "collection" && (
              <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className="rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-emerald-500/50">
                <option value="">— 选择集合 —</option>
                {collectionOptions.map((c) => <option key={c.handle} value={c.handle}>{c.title}</option>)}
              </select>
            )}
            <Badge className="bg-zinc-500/15 text-zinc-300">{scopedProducts.length} 件目标</Badge>
          </div>

          {/* Schema 类型 Checkbox 组 */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-muted-foreground">Schema 类型</label>
            {SCHEMA_TYPE_LIST.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border/30 bg-background/40 px-2.5 py-1.5 text-sm text-foreground hover:border-emerald-500/40">
                <input type="checkbox" checked={selectedTypes.has(t)} onChange={() => toggleType(t)} className="h-3.5 w-3.5 accent-emerald-500" />
                {t}
              </label>
            ))}
          </div>

          {/* 手动选择商品列表 */}
          {scope === "manual" && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 bg-background/30 p-2">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-foreground hover:bg-muted/20">
                    <input type="checkbox" checked={manualSelected.has(p.id)} onChange={() => toggleManual(p.id)} className="h-3 w-3 accent-emerald-500" />
                    <span className="truncate">{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={generatePreview} className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
              <Sparkles className="h-3.5 w-3.5" />生成预览
            </Button>
            <Button size="sm" onClick={doInject} disabled={!preview || injecting} className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
              {injecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {injecting ? "注入中…" : "确认生成并注入"}
            </Button>
            {preview && <span className="text-[11px] text-muted-foreground">共 {preview.length} 条待注入</span>}
          </div>
        </CardContent>
      </Card>

      {/* 进度条 */}
      {injecting && progress.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            已注入 {progress.done}/{progress.total} 件… 成功 {progress.success} / 失败 {progress.fail} / 跳过 {progress.skipped}
          </p>
        </div>
      )}

      {/* 失败列表 */}
      {failList.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="space-y-1.5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-red-400"><AlertTriangle className="h-3.5 w-3.5" />注入失败 {failList.length} 件</p>
            {failList.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-red-300/90">
                <span className="text-red-400/60">#{i + 1}</span>
                <span className="font-medium">{f.title}</span>
                <span className="text-red-300/70">— {f.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 预览对比表 */}
      {preview && preview.length > 0 ? (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border/20 px-4 py-2.5">
              <FileJson className="h-4 w-4 text-emerald-400" />
              <span className="text-base font-semibold text-foreground">生成前后对比</span>
              <span className="text-xs text-muted-foreground">（点击任一行展开 bodyHtml 对比）</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pl-3 text-left w-6"></th>
                    <th className="py-2 px-2 text-left">商品 / 页面</th>
                    <th className="py-2 px-2 text-left w-28">新增 Schema</th>
                    <th className="py-2 px-2 text-left">新增字段</th>
                    <th className="py-2 px-2 text-center w-24">状态</th>
                    <th className="py-2 px-2 text-right w-36">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => {
                    const key = `${r.productId}-${r.schemaType}`;
                    const isOpen = expandedKey === key;
                    return (
                      <Fragment key={key}>
                        <tr
                          className={`border-b border-border/10 cursor-pointer hover:bg-muted/10 ${isOpen ? "bg-muted/10" : ""}`}
                          onClick={() => setExpandedKey(isOpen ? null : key)}
                        >
                          <td className="py-2 pl-3">{isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</td>
                          <td className="py-2 px-2">
                            <span className="text-foreground font-medium">{r.productTitle}</span>
                            {r.productId === 0 && <span className="ml-1 text-[9px] text-amber-400">站点级</span>}
                          </td>
                          <td className="py-2 px-2"><Badge className="bg-emerald-500/15 text-emerald-400 text-[9px]">{r.schemaType}</Badge></td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {r.newFields.slice(0, 4).map((f) => <span key={f} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">{f}</span>)}
                              {r.newFields.length > 4 && <span className="text-[9px] text-muted-foreground">+{r.newFields.length - 4}</span>}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {r.alreadyExists
                              ? <Badge className="bg-amber-500/15 text-amber-400 text-[9px]">已存在</Badge>
                              : r.noDataSource
                                ? <Badge className="bg-zinc-500/15 text-zinc-400 text-[9px]">数据源缺失</Badge>
                                : <Badge className="bg-emerald-500/15 text-emerald-400 text-[9px]">新增</Badge>}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-emerald-400 hover:text-emerald-300" onClick={(e) => { e.stopPropagation(); copyText(r.jsonLD, r.schemaType); }}>
                              <ClipboardCopy className="h-3 w-3" />复制
                            </Button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border/10 bg-muted/5">
                            <td colSpan={6} className="px-3 py-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Link2 className="h-3 w-3" />BodyHtml 注入前后对比</div>
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  {/* 当前 bodyHtml（灰底） */}
                                  <div>
                                    <p className="mb-1 text-xs font-semibold text-zinc-400">当前 BodyHtml</p>
                                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-zinc-800/60 p-2.5 text-xs leading-relaxed text-zinc-300 font-mono">
                                      {(products.find((p) => p.id === r.productId)?.bodyHtml || products.find((p) => p.id === r.productId)?.descriptionHtml || "（站点级 / 无 bodyHtml）")}
                                    </pre>
                                  </div>
                                  {/* 注入后（绿底） */}
                                  <div>
                                    <p className="mb-1 text-xs font-semibold text-emerald-400">注入后 BodyHtml（新 Schema 绿色高亮）</p>
                                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-emerald-950/30 p-2.5 text-xs leading-relaxed font-mono">
                                      <span className="text-emerald-300">{injectSchemaToBodyHtml(products.find((p) => p.id === r.productId)?.bodyHtml || products.find((p) => p.id === r.productId)?.descriptionHtml || "", r.jsonLD, r.schemaType)}</span>
                                    </pre>
                                  </div>
                                </div>
                                {/* 完整 JSON-LD */}
                                <div>
                                  <p className="mb-1 text-xs font-semibold text-foreground">完整 JSON-LD</p>
                                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background/60 p-2.5 text-xs leading-relaxed text-emerald-300/90 font-mono">{r.jsonLD}</pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        !injecting && (
          <Card className="border-border/40 bg-card/60">
            <CardContent className="py-12 text-center text-base text-muted-foreground">选择范围与 Schema 类型后，点击「生成预览」查看待注入清单。</CardContent>
          </Card>
        )
      )}

      {/* 回滚确认 Dialog */}
      {showRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRollback(false)}>
          <div className="w-full max-w-md rounded-xl border border-border/40 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><RotateCcw className="h-4 w-4 text-amber-400" />回滚全部注入</h3>
              <button onClick={() => setShowRollback(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              将逐件恢复 <span className="font-medium text-foreground">{historyCount}</span> 条注入记录的原始 BodyHtml（站点级 Organization 仅本地记录，不调用 API）。此操作不可撤销。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowRollback(false)}>取消</Button>
              <Button size="sm" onClick={doRollbackAll} className="h-9 gap-1.5 bg-amber-600 text-white hover:bg-amber-500">
                <RotateCcw className="h-3.5 w-3.5" />确认回滚
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        生成逻辑严格遵循 Schema.org 规范：Product 含多变体 Offer 数组与 AggregateRating；FAQPage 从描述中的 Q&A 提取；Review 需店铺安装 Judge.me / Loox / Yotpo 等评价 App（无数据源时标记「数据源缺失」）。注入前自动检测重复，避免重复标记。
      </p>
    </div>
  );
}
