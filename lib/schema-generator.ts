// ─────────────────────────────────────────────────────────────────────────────
// lib/schema-generator.ts
// Schema 结构化数据一键生成引擎
// 从 Shopify 商品/内容/店铺数据生成标准 JSON-LD，并注入到 bodyHtml
// 纯客户端逻辑；仅 injectSchemaToBodyHtml 的调用方需要服务端 API 写入。
// ─────────────────────────────────────────────────────────────────────────────

/* ─── 核心类型 ──────────────────────────────────────────── */

/** 单条 Schema 生成结果 */
export interface SchemaGenerationResult {
  /** 关联商品/页面 ID（站点级为 0） */
  productId: number;
  /** 商品/页面标题 */
  productTitle: string;
  /** 生成的 Schema 类型 */
  schemaType: string;
  /** 本次新增的字段名列表 */
  newFields: string[];
  /** 完整的 JSON-LD 代码字符串 */
  jsonLD: string;
  /** 该页面是否已存在同 @type 的 Schema */
  alreadyExists: boolean;
  /** 数据源是否缺失（如 Review 无评价数据） */
  noDataSource?: boolean;
}

/** 注入历史记录（localStorage 持久化） */
export interface InjectionRecord {
  productId: number;
  productTitle: string;
  originalBodyHtml: string;
  injectedBodyHtml: string;
  timestamp: number;
  schemaType: string;
}

/** 生成器的店铺上下文信息 */
export interface ShopInfo {
  name: string;
  domain: string;
  currency: string;
  logoUrl?: string;
}

/** 生成器的商品输入 */
export interface GeneratorProduct {
  id: number;
  title: string;
  handle: string;
  descriptionHtml: string;
  bodyHtml: string;
  image: string | null;
  productType: string;
  vendor: string;
  status: string;
  sku: string | null;
  price: number | null;
  currency: string;
  inventory: number;
  brand: string | null;
  ratingValue: number | null;
  reviewCount: number | null;
  hasReviews: boolean;
  variants?: Array<{
    variantId: number;
    name: string;
    sku: string | null;
    price: string | number | null;
    inventory: number;
  }>;
  metafields?: Array<{ namespace: string; key: string; value: string }>;
  collections?: Array<{ id: number; title: string; handle: string }>;
}

/** 生成器的内容输入 */
export interface GeneratorContent {
  id: number;
  title: string;
  handle: string;
  bodyHtml: string;
  publishedAt: string | null;
  author: string | null;
  kind: "page" | "article";
}

/* ─── 工具函数 ──────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function availabilityFromInventory(inventory: number, status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "DRAFT") return "https://schema.org/PreOrder";
  if (s === "ARCHIVED") return "https://schema.org/Discontinued";
  return inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/** 提取 bodyHtml 中已存在的某 @type Schema 的字段路径集合 */
function extractExistingFieldPaths(bodyHtml: string, schemaType: string): Set<string> {
  const set = new Set<string>();
  if (!bodyHtml) return set;
  const regex = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(bodyHtml)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const collect = (obj: Record<string, unknown>, prefix: string) => {
        for (const k of Object.keys(obj)) {
          if (k.startsWith("@")) continue;
          const path = prefix ? prefix + "." + k : k;
          set.add(path);
          const v = obj[k];
          if (v && typeof v === "object" && !Array.isArray(v)) collect(v as Record<string, unknown>, path);
        }
      };
      const objectsToScan: Array<Record<string, unknown>> = [];
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed["@graph"])) objectsToScan.push(...(parsed["@graph"] as Array<Record<string, unknown>>));
        else if (parsed["@type"] === schemaType) objectsToScan.push(parsed);
      }
      for (const obj of objectsToScan) {
        if (obj["@type"] === schemaType) collect(obj, "");
      }
    } catch { /* ignore */ }
  }
  return set;
}

/** 检测 bodyHtml 中是否已有指定 @type 的 JSON-LD */
export function hasExistingSchema(bodyHtml: string, schemaType: string): boolean {
  if (!bodyHtml) return false;
  const regex = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(bodyHtml)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const check = (obj: Record<string, unknown>): boolean => {
        if (obj["@type"] === schemaType) return true;
        if (Array.isArray(obj["@graph"])) {
          return (obj["@graph"] as Array<Record<string, unknown>>).some((g) => g["@type"] === schemaType);
        }
        return false;
      };
      if (parsed && typeof parsed === "object") {
        if (check(parsed)) return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

/** FAQ Q&A 正则匹配（不使用 s 标志以兼容 ES2017 编译目标） */
const FAQ_REGEX = /Q[:：]\s*([\s\S]+?)\n[\s\S]*?A[:：]\s*([\s\S]+?)(?=\n\n|\nQ[:：]|$)/g;

/** 提取描述中的 Q&A 对 */
function extractFAQPairs(bodyHtml: string): Array<{ question: string; answer: string }> {
  if (!bodyHtml) return [];
  const text = stripHtml(bodyHtml);
  if (!text) return [];
  const pairs: Array<{ question: string; answer: string }> = [];
  FAQ_REGEX.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = FAQ_REGEX.exec(text)) !== null) {
    const q = mm[1].trim();
    const a = mm[2].trim();
    if (q && a) pairs.push({ question: q, answer: a });
  }
  return pairs;
}

/** 从 metafields 提取评价数据（Judge.me / Loox / Yotpo） */
function extractReviewsFromMetafields(
  metafields?: Array<{ namespace: string; key: string; value: string }>,
): Array<{ author: string; body: string; rating: number }> | null {
  if (!metafields || metafields.length === 0) return null;
  const reviews: Array<{ author: string; body: string; rating: number }> = [];
  for (const mf of metafields) {
    const ns = (mf.namespace || "").toLowerCase();
    const key = (mf.key || "").toLowerCase();
    if (ns === "judgeme" && key === "reviews") {
      try {
        const data = JSON.parse(mf.value);
        if (Array.isArray(data)) {
          for (const r of data.slice(0, 10)) {
            reviews.push({ author: r.reviewer?.name || "匿名用户", body: r.body || "", rating: typeof r.rating === "number" ? r.rating : 5 });
          }
        }
      } catch { /* ignore */ }
    }
    if (ns === "loox" && key === "reviews") {
      try {
        const data = JSON.parse(mf.value);
        if (Array.isArray(data)) {
          for (const r of data.slice(0, 10)) {
            reviews.push({ author: r.reviewer_name || "匿名用户", body: r.review_text || "", rating: typeof r.stars === "number" ? r.stars : 5 });
          }
        }
      } catch { /* ignore */ }
    }
    if (ns === "yotpo" && key === "reviews") {
      try {
        const data = JSON.parse(mf.value);
        if (Array.isArray(data)) {
          for (const r of data.slice(0, 10)) {
            reviews.push({ author: r.user?.display_name || "匿名用户", body: r.content || "", rating: typeof r.score === "number" ? r.score : 5 });
          }
        }
      } catch { /* ignore */ }
    }
  }
  return reviews.length > 0 ? reviews : null;
}

/* ─── JSON-LD 注入 ──────────────────────────────────────── */

/** 将 JSON-LD 追加到 bodyHtml 末尾（在 </body> 之前；若无则直接追加） */
export function injectSchemaToBodyHtml(currentBodyHtml: string, jsonLD: string, schemaType: string): string {
  if (!jsonLD) return currentBodyHtml;
  if (currentBodyHtml && hasExistingSchema(currentBodyHtml, schemaType)) {
    return currentBodyHtml; // 已存在同类型，跳过（不重复注入）
  }
  const scriptTag = `\n<script type="application/ld+json">\n${jsonLD}\n</script>`;
  if (!currentBodyHtml) {
    return `<!DOCTYPE html><html><head></head><body>${scriptTag}\n</body></html>`;
  }
  const idx = currentBodyHtml.toLowerCase().lastIndexOf("</body>");
  if (idx !== -1) {
    return currentBodyHtml.slice(0, idx) + scriptTag + "\n" + currentBodyHtml.slice(idx);
  }
  return currentBodyHtml + scriptTag + "\n";
}

/* ─── 生成器 ────────────────────────────────────────────── */

/** 生成 Product Schema（含多变体 offer 数组 / aggregateRating / review） */
export function generateProductSchema(product: GeneratorProduct, shopInfo: ShopInfo): SchemaGenerationResult {
  const base = `https://${shopInfo.domain}/products/${product.handle}`;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: stripHtml(product.descriptionHtml).slice(0, 200),
    url: base,
  };
  const newFields: string[] = ["name", "description", "url"];
  if (product.image) { node.image = product.image; newFields.push("image"); }

  // variants → offers
  const variants = product.variants && product.variants.length > 0 ? product.variants : null;
  if (variants) {
    const offers = variants.map((v) => {
      const priceRaw = v.price;
      const price = priceRaw === null || priceRaw === undefined || priceRaw === ""
        ? (product.price ?? 0)
        : typeof priceRaw === "number" ? priceRaw : parseFloat(String(priceRaw));
      return {
        "@type": "Offer",
        price: price,
        priceCurrency: product.currency || shopInfo.currency,
        availability: availabilityFromInventory(v.inventory, product.status),
        url: base,
      };
    });
    node.offers = offers.length === 1 ? offers[0] : offers;
    newFields.push("offers.price", "offers.priceCurrency", "offers.availability");
  } else {
    node.offers = {
      "@type": "Offer",
      price: product.price ?? 0,
      priceCurrency: product.currency || shopInfo.currency,
      availability: availabilityFromInventory(product.inventory, product.status),
      url: base,
    };
    newFields.push("offers.price", "offers.priceCurrency", "offers.availability");
  }

  // sku
  const sku = product.sku ?? (variants && variants[0]?.sku) ?? null;
  if (sku) { node.sku = sku; newFields.push("sku"); }

  // brand
  const brand = product.brand ?? product.vendor ?? null;
  if (brand) { node.brand = { "@type": "Brand", name: brand }; newFields.push("brand"); }

  // aggregateRating
  if (product.ratingValue !== null && product.reviewCount !== null) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.ratingValue,
      reviewCount: product.reviewCount,
    };
    newFields.push("aggregateRating.ratingValue", "aggregateRating.reviewCount");
  }

  // review (from metafields)
  const reviews = extractReviewsFromMetafields(product.metafields);
  if (reviews) {
    node.review = reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      reviewBody: r.body,
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
    }));
    newFields.push("review");
  }

  const jsonLD = JSON.stringify(node, null, 2);
  const existing = extractExistingFieldPaths(product.bodyHtml, "Product");
  const trulyNew = newFields.filter((f) => !existing.has(f));
  return {
    productId: product.id,
    productTitle: product.title,
    schemaType: "Product",
    newFields: trulyNew.length > 0 ? trulyNew : newFields,
    jsonLD,
    alreadyExists: hasExistingSchema(product.bodyHtml, "Product"),
  };
}

/** 生成 FAQPage Schema（无 Q&A 返回 null） */
export function generateFAQPageSchema(product: GeneratorProduct): SchemaGenerationResult | null {
  const pairs = extractFAQPairs(product.bodyHtml || product.descriptionHtml);
  if (pairs.length === 0) return null;
  const node = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
  return {
    productId: product.id,
    productTitle: product.title,
    schemaType: "FAQPage",
    newFields: [`${pairs.length} 个 FAQ 问答对`],
    jsonLD: JSON.stringify(node, null, 2),
    alreadyExists: hasExistingSchema(product.bodyHtml, "FAQPage"),
  };
}

/** 生成 Review Schema（数据源缺失返回 null） */
export function generateReviewSchema(product: GeneratorProduct): SchemaGenerationResult | null {
  const reviews = extractReviewsFromMetafields(product.metafields);
  if (!reviews) return null;
  const node = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `https://${""}/products/${product.handle}`,
    name: product.title,
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      reviewBody: r.body,
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
    })),
  };
  return {
    productId: product.id,
    productTitle: product.title,
    schemaType: "Review",
    newFields: [`${reviews.length} 条评价`],
    jsonLD: JSON.stringify(node, null, 2),
    alreadyExists: hasExistingSchema(product.bodyHtml, "Review"),
  };
}

/** 生成 BreadcrumbList Schema（基于集合层级） */
export function generateBreadcrumbSchema(
  product: GeneratorProduct,
  collection: { title: string; handle: string },
  shopInfo: ShopInfo,
): SchemaGenerationResult {
  const crumbs: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Home", item: `https://${shopInfo.domain}` },
    { "@type": "ListItem", position: 2, name: collection.title, item: `https://${shopInfo.domain}/collections/${collection.handle}` },
    { "@type": "ListItem", position: 3, name: product.title, item: `https://${shopInfo.domain}/products/${product.handle}` },
  ];
  const node = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  };
  return {
    productId: product.id,
    productTitle: product.title,
    schemaType: "BreadcrumbList",
    newFields: ["itemListElement (3 级)"],
    jsonLD: JSON.stringify(node, null, 2),
    alreadyExists: hasExistingSchema(product.bodyHtml, "BreadcrumbList"),
  };
}

/** 生成 Organization Schema（站点级） */
export function generateOrganizationSchema(shopInfo: ShopInfo): SchemaGenerationResult {
  const node = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: shopInfo.name,
    url: `https://${shopInfo.domain}`,
    logo: shopInfo.logoUrl || `https://${shopInfo.domain}/cdn/shop/logo.png`,
  };
  return {
    productId: 0,
    productTitle: shopInfo.name,
    schemaType: "Organization",
    newFields: ["name", "url", "logo"],
    jsonLD: JSON.stringify(node, null, 2),
    alreadyExists: false,
  };
}

/** 生成 Article Schema（页面 / 博客） */
export function generateArticleSchema(content: GeneratorContent, shopInfo: ShopInfo): SchemaGenerationResult {
  const base = content.kind === "article" ? "blogs" : "pages";
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    articleBody: stripHtml(content.bodyHtml).slice(0, 200),
    url: `https://${shopInfo.domain}/${base}/${content.handle}`,
  };
  if (content.author) node.author = { "@type": "Person", name: content.author };
  if (content.publishedAt) { node.datePublished = content.publishedAt; node.dateModified = content.publishedAt; }
  return {
    productId: content.id,
    productTitle: content.title,
    schemaType: "Article",
    newFields: ["headline", "articleBody", ...(content.author ? ["author"] : []), ...(content.publishedAt ? ["datePublished"] : [])],
    jsonLD: JSON.stringify(node, null, 2),
    alreadyExists: hasExistingSchema(content.bodyHtml, "Article"),
  };
}

/* ─── 批量编排 ──────────────────────────────────────────── */

export const SCHEMA_TYPE_LIST = ["Product", "Review", "FAQPage", "BreadcrumbList", "Organization", "Article"] as const;
export type SchemaTypeKey = typeof SCHEMA_TYPE_LIST[number];

/** 为单个商品生成其所有已选类型的 Schema 结果数组 */
export function generateSchemasForProduct(
  product: GeneratorProduct,
  selectedTypes: SchemaTypeKey[],
  shopInfo: ShopInfo,
): SchemaGenerationResult[] {
  const results: SchemaGenerationResult[] = [];
  for (const t of selectedTypes) {
    if (t === "Product") results.push(generateProductSchema(product, shopInfo));
    else if (t === "FAQPage") { const r = generateFAQPageSchema(product); if (r) results.push(r); }
    else if (t === "Review") { const r = generateReviewSchema(product); if (r) results.push(r); }
    else if (t === "BreadcrumbList") {
      const col = product.collections && product.collections[0];
      if (col) results.push(generateBreadcrumbSchema(product, col, shopInfo));
    }
  }
  return results;
}
