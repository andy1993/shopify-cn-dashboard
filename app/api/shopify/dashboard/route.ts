import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_DOMAINS,
  DEMO_STORES,
  DEMO_ORDERS_A,
  DEMO_ORDERS_B,
  DEMO_CHARTS_A,
  DEMO_CHARTS_B,
} from "@/lib/demo-data";

// ─── Types ────────────────────────────────────────────

interface ShopifyOrder {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  gateway: string | null;
  customer: {
    orders_count: number;
  } | null;
  shipping_address: {
    country_code: string;
  } | null;
  line_items: Array<{
    id: number;
    product_id: number | null;
    name: string;
    quantity: number;
    price: string;
  }>;
}

interface ShopifyProduct {
  id: number;
  title: string;
  image: { src: string } | null;
  variants: Array<{ inventory_quantity: number }>;
}

/** Response format for success */
interface DashboardSuccess {
  success: true;
  shopName: string;
  domain: string;
  currency: string;
  exchangeRate: number;
  gmv: number;
  orderCount: number;
  conversionRate: number;
  charts: Array<{ hour: string; sales: number }>;
  products: Array<{
    id: number;
    title: string;
    image: string | null;
    totalSold: number;
    totalRevenue: number;
    inventory: number;
  }>;
  lastUpdated: string;
  /** Compact raw orders for frontend GroupBy and CSV export */
  orders: Array<{
    id: number;
    created_at: string;
    total_price: string;
    financial_status: string;
    gateway: string;
    customer_orders_count: number;
    shipping_country: string;
  }>;
  /** Multi-market holiday data: { 'US': [...], 'GB': [...], 'DE': [...] } */
  holidaysData: Record<string, NagerHoliday[]>;
  /** Top 3 shipping destination countries */
  topCountries: string[];
  /** Full product catalog via GraphQL (with variants, only for real stores) */
  fullProducts?: Array<{
    id: number;
    title: string;
    handle: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    status: string;
    tags: string[];
    image: string | null;
    shopName: string;
    isDemo: boolean;
    seoTitle: string;
    seoDescription: string;
    images: Array<{
      id: string;
      src: string;
      alt: string;
      width: number;
      height: number;
    }>;
    variants: Array<{
      variantId: number;
      name: string;
      sku: string;
      price: string;
      compareAtPrice: string | null;
      inventory: number;
      productId: string;
      inventoryItemId: string;
    }>;
  }>;
  /** Customer list (real stores only) */
  customers?: Array<{
    id: number; email: string; first_name: string; last_name: string; phone: string | null;
    orders_count: number; total_spent: number; currency: string; created_at: string; updated_at: string;
    state: string; tags: string; accepts_marketing: boolean;
    default_address?: { address1: string; address2?: string; city: string; province: string; country: string; zip: string };
    addresses?: Array<{ address1: string; address2?: string; city: string; province: string; country: string; zip: string; default: boolean }>;
    recent_orders?: Array<{ id: number; order_number: string; total_price: number; created_at: string; financial_status: string }>;
  }>;
  /** Collection data (smart + custom) */
  collections?: {
    smart: Array<{
      id: number; title: string; handle: string;
      body_html: string; published: boolean; products_count: number;
      sort_order: string; rules: Array<{ column: string; relation: string; condition: string }>;
      updated_at: string;
    }>;
    custom: Array<{
      id: number; title: string; handle: string;
      body_html: string; published: boolean; products_count: number;
      sort_order: string; updated_at: string;
    }>;
  } | null;
  /** Navigation menus with items */
  menus?: Array<{
    id: number; title: string; handle: string;
    items: Array<{
      id: number; title: string; url: string;
      type: string; parent_id: number | null; position: number;
    }>;
  }>;
  /** Pages */
  pages?: Array<{
    id: number; title: string; handle: string; bodyHtml: string;
    published: boolean; seoTitle: string; seoDescription: string;
    created_at: string; updated_at: string;
  }>;
  /** Blogs with articles (GraphQL) */
  blogs?: Array<{
    id: number; title: string; handle: string;
    articles: Array<{
      id: number; title: string; handle: string;
      bodyHtml: string; summaryHtml: string; author: string;
      tags: string[]; published: boolean; seoTitle: string; seoDescription: string;
      createdAt: string; updatedAt: string;
    }>;
  }>;
  /** Variant-level sales for the last 30 days */
  variantSales?: Record<number, number>;
  /** Markets data */
  markets?: Array<{
    id: string; name: string; handle: string; enabled: boolean;
    countryCode: string; countries: string[]; currency: string;
    languages: Array<{ isoCode: string; name: string }>;
    domain: string; subfolder: string;
    priceAdjustment: { type: "percentage" | "fixed"; value: number } | null;
    productCount: number;
    localizedPrices?: Record<number, number>;
  }>;
  /** Locations & multi-warehouse inventory */
  locations?: Array<{ id: number; name: string; address1?: string; city?: string; country?: string; type: "domestic" | "overseas" }>;
  inventoryByLocation?: Array<{ variantId: number; inventoryItemId: string; locationId: number; locationName: string; available: number }>;
  /** Shipping rates & carriers */
  shippingData?: {
    rates: Array<{ countryCode: string; countryName: string; currency: string; freeThreshold: number | null; standard: { name: string; price: number; currency: string } | null; express: { name: string; price: number; currency: string } | null; localPickup: boolean }>;
    carriers: Array<{ name: string; countryTimes: Record<string, string> }>;
    warehouseZones: Array<{ warehouseName: string; countryCode: string; rules: Array<{ type: string; label: string; price: number; currency: string }> }>;
  };
  /** Tax configuration data */
  taxData?: {
    markets: Array<{ marketId: string; countryCode: string; countryName: string; taxConfigured: boolean; taxRate: number | null; reducedRate: number | null; taxIncluded: boolean; vatId: string | null; risks: Array<{ level: "high" | "medium"; message: string }>; importTaxCollected: boolean; shippingTaxed: boolean }>;
    shopLevel: { taxesIncluded: boolean; taxShipping: boolean };
  };
}

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
}

/** Response format for errors */
interface DashboardError {
  success: false;
  error: string;
  code: number;
}

type DashboardResponse = DashboardSuccess | DashboardError;

// ─── Constants ────────────────────────────────────────

/** Shopify stable API version (2026) */
const SHOPIFY_API_VERSION = "2026-04";

/** USD → CNY exchange rate (configurable via process.env.USD_CNY_RATE) */
function getExchangeRate(): number {
  const envRate = process.env.USD_CNY_RATE;
  if (envRate) {
    const parsed = parseFloat(envRate);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  // fallback for development
  return 7.25;
}

// ─── Helpers ──────────────────────────────────────────

/**
 * Get today's zero-hour timestamp in Asia/Shanghai (UTC+8),
 * returned as ISO 8601 string for use in `created_at_min`.
 *
 * Time filtering logic:
 * ┌──────────────────────────────────────────────────────┐
 * │ Current time: 2026-07-02 10:30 Beijing (UTC+8)       │
 * │ Beijing today 00:00 = 2026-07-02 00:00 +08:00        │
 * │                     = 2026-07-01 16:00:00.000Z        │
 * │ → Shopify created_at_min = "2026-07-01T16:00:00Z"   │
 * └──────────────────────────────────────────────────────┘
 */
function getBeijingTodayStartISO(): string {
  const now = new Date();
  const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const beijingMidnight = new Date(
    Date.UTC(
      beijingNow.getUTCFullYear(),
      beijingNow.getUTCMonth(),
      beijingNow.getUTCDate(),
    ),
  );
  return new Date(beijingMidnight.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

/**
 * Map a Shopify HTTP status to a user-friendly Chinese error message.
 */
function mapShopifyError(status: number, body: string): string {
  const preview = body.slice(0, 300);

  if (status === 401) {
    return "API Token 无效，请检查 Admin API Token 是否正确、是否已过期，或在 Shopify 后台重新生成";
  }
  if (status === 403) {
    return "权限不足，请确认该 API Token 拥有读取 Orders / Products / Shop 的访问权限";
  }
  if (status === 404) {
    return "店铺域名不存在，请检查域名拼写是否正确（格式: your-store.myshopify.com）";
  }
  if (status === 429) {
    return "请求过于频繁，Shopify API 限流，请稍后重试";
  }
  if (status >= 500) {
    return `Shopify 服务器错误 (${status})，请稍后重试 — ${preview}`;
  }

  return `Shopify API 返回了意外状态码 ${status} — ${preview}`;
}

/** Safely build a Shopify API URL */
function buildShopifyUrl(shopUrl: string, path: string): string {
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

// ─── Shopify API Calls ────────────────────────────────

/** Fetch shop basic info (includes country_code) */
async function fetchShopInfo(
  shopUrl: string,
  accessToken: string,
): Promise<{ name: string; currency: string; domain: string; country: string }> {
  const res = await fetch(
    buildShopifyUrl(shopUrl, "/shop.json?fields=name,currency,domain,country"),
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(mapShopifyError(res.status, body));
  }

  const data = await res.json() as { shop: { name: string; currency: string; domain: string; country: string } };
  return data.shop;
}

/**
 * Fetch public holidays for a given country code from Nager.Date.
 * Documentation: https://date.nager.at/Api
 */
async function fetchHolidays(countryCode: string): Promise<NagerHoliday[]> {
  try {
    const year = new Date().getFullYear();
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{ date: string; localName: string; name: string; countryCode: string }>;
    return data;
  } catch {
    return [];
  }
}

/**
 * Fetch seller's active Markets via Shopify GraphQL Admin API.
 * Returns deduplicated ISO country codes from all enabled markets.
 * This is the authoritative source — NOT order shipping_address.
 */
async function fetchActiveMarketCountries(
  shopUrl: string,
  accessToken: string,
): Promise<string[]> {
  const GQL_URL = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const query = `{
    markets(first: 10) {
      nodes {
        name
        enabled
        regions(first: 20) {
          nodes {
            ... on MarketRegionCountry {
              code
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GraphQL Markets 查询失败 (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    data?: {
      markets?: {
        nodes?: Array<{
          name: string;
          enabled: boolean;
          regions?: {
            nodes?: Array<{ code: string }>;
          };
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw new Error(`GraphQL 错误: ${data.errors[0].message}`);
  }

  const countries = new Set<string>();
  const markets = data.data?.markets?.nodes ?? [];

  for (const market of markets) {
    if (!market.enabled) continue;
    for (const region of market.regions?.nodes ?? []) {
      const code = region.code?.trim().toUpperCase();
      if (code) countries.add(code);
    }
  }

  const result = Array.from(countries);
  if (result.length === 0) {
    // No active markets configured — fallback to shop-level country
    return [];
  }
  return result;
}

/**
 * Fetch full product catalog via Shopify GraphQL Admin API.
 * Returns product list with variants (id, title, SKU, price, inventory).
 */
async function fetchFullProducts(
  shopUrl: string,
  accessToken: string,
  shopName: string,
): Promise<DashboardSuccess["fullProducts"]> {
  const GQL_URL = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const query = `{
    products(first: 50) {
      nodes {
        id
        title
        handle
        descriptionHtml
        vendor
        productType
        status
        tags
        images(first: 20) { nodes { id src altText width height } }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            price
            compareAtPrice
            inventoryQuantity
            product { id }
            inventoryItem { id }
          }
        }
        seo { title description }
      }
    }
  }`;

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    console.warn("[shopify/dashboard] GraphQL products fetch failed:", res.status);
    return undefined;
  }

  const data = await res.json() as {
    data?: {
      products?: {
        nodes?: Array<{
          id: string;
          title: string;
          handle: string;
          descriptionHtml: string;
          vendor: string;
          productType: string;
          status: string;
          tags: string[];
          images?: { nodes?: Array<{ id: string; src: string; altText: string | null; width: number; height: number }> };
          variants?: {
            nodes?: Array<{
              id: string;
              title: string;
              sku: string | null;
              price: string;
              compareAtPrice: string | null;
              inventoryQuantity: number;
              product?: { id: string };
              inventoryItem?: { id: string };
            }>;
          };
          seo?: { title: string | null; description: string | null };
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    console.warn("[shopify/dashboard] GraphQL products errors:", data.errors[0].message);
    return undefined;
  }

  const nodes = data.data?.products?.nodes ?? [];
  if (nodes.length === 0) return undefined;

  return nodes.map((p) => {
    const gid = p.id.replace(/\D/g, "");
    return {
      id: Number(gid),
      title: p.title,
      handle: p.handle || "",
      descriptionHtml: p.descriptionHtml || "",
      vendor: p.vendor || "",
      productType: p.productType || "",
      status: p.status,
      tags: p.tags || [],
      image: p.images?.nodes?.[0]?.src ?? null,
      shopName,
      isDemo: false,
      seoTitle: p.seo?.title || "",
      seoDescription: p.seo?.description || "",
      images: (p.images?.nodes || []).map((img) => ({
        id: img.id.replace("gid://shopify/ProductImage/", ""),
        src: img.src,
        alt: img.altText || "",
        width: img.width || 0,
        height: img.height || 0,
      })),
      variants: (p.variants?.nodes ?? []).map((v) => {
        const vgid = v.id.replace(/\D/g, "");
        return {
          variantId: Number(vgid),
          name: v.title || "默认",
          sku: v.sku ?? `SKU-${vgid}`,
          price: v.price,
          compareAtPrice: v.compareAtPrice || null,
          inventory: v.inventoryQuantity,
          productId: v.product?.id ?? p.id,
          inventoryItemId: v.inventoryItem?.id ?? "",
        };
      }).filter((v) => v.price !== "0.00" || v.inventory > 0),
    };
  });
}

/**
 * Fetch customers with auto-pagination via Link header.
 */
async function fetchCustomers(shopUrl: string, accessToken: string): Promise<DashboardSuccess["customers"]> {
  const results: Array<Record<string, unknown>> = [];
  let url = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/customers.json?limit=250";

  try {
    while (url) {
      const res = await fetch(url, {
        headers: { "X-Shopify-Access-Token": accessToken },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn("[shopify/dashboard] customers fetch failed:", res.status);
        return undefined;
      }
      const data = await res.json() as { customers?: Array<Record<string, unknown>> };
      if (data.customers) results.push(...data.customers);
      // Check Link header for pagination
      const link = res.headers.get("link");
      const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : "";
    }
  } catch (err) {
    console.warn("[shopify/dashboard] customers fetch error:", err instanceof Error ? err.message : err);
    return undefined;
  }

  if (results.length === 0) return undefined;

  return results.map((c: Record<string, unknown>) => {
    const addr = c.default_address as Record<string, unknown> | undefined;
    const addrs = c.addresses as Array<Record<string, unknown>> | undefined;
    return {
      id: c.id as number,
      email: (c.email as string) || "",
      first_name: (c.first_name as string) || "",
      last_name: (c.last_name as string) || "",
      phone: (c.phone as string) || null,
      orders_count: (c.orders_count as number) || 0,
      total_spent: parseFloat((c.total_spent as string) || "0"),
      currency: (c.currency as string) || "USD",
      created_at: (c.created_at as string) || "",
      updated_at: (c.updated_at as string) || "",
      state: (c.state as string) || "enabled",
      tags: (c.tags as string) || "",
      accepts_marketing: !!c.accepts_marketing,
      default_address: addr ? {
        address1: (addr.address1 as string) || "",
        address2: addr.address2 as string,
        city: (addr.city as string) || "",
        province: (addr.province as string) || "",
        country: (addr.country as string) || "",
        zip: (addr.zip as string) || "",
      } : undefined,
      addresses: addrs?.map((a: Record<string, unknown>) => ({
        address1: (a.address1 as string) || "",
        address2: a.address2 as string,
        city: (a.city as string) || "",
        province: (a.province as string) || "",
        country: (a.country as string) || "",
        zip: (a.zip as string) || "",
        default: !!a.default,
      })),
      recent_orders: [],
    };
  });
}

/**
 * Fetch collections (smart + custom) concurrently.
 */
async function fetchCollections(shopUrl: string, accessToken: string): Promise<DashboardSuccess["collections"]> {
  const headers = { "X-Shopify-Access-Token": accessToken };
  try {
    const [smartRes, customRes] = await Promise.all([
      fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/smart_collections.json?limit=250`, { headers, signal: AbortSignal.timeout(10000) }),
      fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/custom_collections.json?limit=250`, { headers, signal: AbortSignal.timeout(10000) }),
    ]);
    if (!smartRes.ok || !customRes.ok) return null;
    const smartData = await smartRes.json();
    const customData = await customRes.json();
    return {
      smart: (smartData.smart_collections || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        title: (c.title as string) || "",
        handle: (c.handle as string) || "",
        body_html: (c.body_html as string) || "",
        published: !!(c as any).published_at,
        products_count: (c.products_count as number) || 0,
        sort_order: ((c as any).sort_order as string) || "manual",
        rules: ((c.rules as Array<Record<string, unknown>>) || []).map((r: any) => ({
          column: r.column as string,
          relation: r.relation as string,
          condition: r.condition as string,
        })),
        updated_at: (c.updated_at as string) || "",
      })),
      custom: (customData.custom_collections || []).map((c: Record<string, unknown>) => ({
        id: c.id as number,
        title: (c.title as string) || "",
        handle: (c.handle as string) || "",
        body_html: (c.body_html as string) || "",
        published: !!(c as any).published_at,
        products_count: (c.products_count as number) || 0,
        sort_order: ((c as any).sort_order as string) || "manual",
        updated_at: (c.updated_at as string) || "",
      })),
    };
  } catch (err) {
    console.warn("[shopify/dashboard] collections fetch error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch all navigation menus with their items.
 */
async function fetchMenus(shopUrl: string, accessToken: string): Promise<DashboardSuccess["menus"]> {
  const headers = { "X-Shopify-Access-Token": accessToken };
  try {
    const res = await fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/menus.json`, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const menus = data.menus || [];
    const withItems = await Promise.all(
      menus.map(async (m: Record<string, unknown>) => {
        try {
          const itemsRes = await fetch(
            `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/menus/${m.id}/items.json`,
            { headers, signal: AbortSignal.timeout(10000) },
          );
          if (!itemsRes.ok) return { id: m.id, title: m.title, handle: m.handle, items: [] };
          const itemsData = await itemsRes.json();
          return {
            id: m.id as number,
            title: (m.title as string) || "",
            handle: (m.handle as string) || "",
            items: (itemsData.items || []).map((item: Record<string, unknown>) => ({
              id: item.id as number,
              title: (item.title as string) || "",
              url: (item.url as string) || "",
              type: (item.type as string) || "custom",
              parent_id: (item.parent_id as number) || null,
              position: (item.position as number) || 0,
            })),
          };
        } catch {
          return { id: m.id as number, title: m.title, handle: m.handle, items: [] };
        }
      }),
    );
    return withItems;
  } catch (err) {
    console.warn("[shopify/dashboard] menus fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fetch all pages.
 */
async function fetchPages(shopUrl: string, accessToken: string): Promise<DashboardSuccess["pages"]> {
  const headers = { "X-Shopify-Access-Token": accessToken };
  try {
    const res = await fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/pages.json?limit=250`, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.pages || []).map((p: Record<string, unknown>) => ({
      id: p.id as number,
      title: (p.title as string) || "",
      handle: (p.handle as string) || "",
      bodyHtml: (p.body_html as string) || "",
      published: !!(p as any).published_at,
      seoTitle: ((p as any).metafields_global_title_tag as string) || "",
      seoDescription: ((p as any).metafields_global_description_tag as string) || "",
      created_at: (p.created_at as string) || "",
      updated_at: (p.updated_at as string) || "",
    }));
  } catch { return []; }
}

/**
 * Fetch all blogs with their articles via REST（并发拉各博客文章）。
 * Note: If GraphQL fails with permission errors, fall back to this REST path.
 */
async function fetchBlogs(shopUrl: string, accessToken: string): Promise<DashboardSuccess["blogs"]> {
  const headers = { "X-Shopify-Access-Token": accessToken };
  const signal = AbortSignal.timeout(15000);

  try {
    const blogsRes = await fetch(
      `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/blogs.json`,
      { headers, signal },
    );
    if (!blogsRes.ok) {
      console.warn("[shopify/dashboard] blogs REST failed:", blogsRes.status);
      return [];
    }
    const blogsData = await blogsRes.json() as { blogs?: Array<{ id: number; title: string; handle: string }> };
    if (!blogsData.blogs?.length) return [];

    // 并发拉各博客文章
    const blogs = await Promise.all(
      blogsData.blogs.map(async (b) => {
        try {
          const articlesRes = await fetch(
            `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/blogs/${b.id}/articles.json?limit=250`,
            { headers, signal: AbortSignal.timeout(10000) },
          );
          if (!articlesRes.ok) return { id: b.id, title: b.title, handle: b.handle, articles: [] };
          const articlesData = await articlesRes.json();

          return {
            id: b.id,
            title: b.title,
            handle: b.handle,
            articles: (articlesData.articles || []).map((a: any) => ({
              id: a.id,
              title: a.title,
              handle: a.handle || "",
              bodyHtml: a.body_html || "",
              summaryHtml: a.summary_html || "",
              author: a.author || "",
              tags: typeof a.tags === "string"
                ? a.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : (a.tags || []),
              published: a.published_at !== null,
              seoTitle: a.metafields_global_title_tag || "",
              seoDescription: a.metafields_global_description_tag || "",
              createdAt: a.created_at || "",
              updatedAt: a.updated_at || "",
            })),
          };
        } catch {
          return { id: b.id, title: b.title, handle: b.handle, articles: [] };
        }
      }),
    );
    return blogs;
  } catch (err) {
    console.warn("[shopify/dashboard] fetchBlogs failed:", (err as Error).message);
    return [];
  }
}

/**
 * Aggregate variant-level sales over the past 30 days from orders.
 */
async function fetchVariantSales(shopUrl: string, accessToken: string): Promise<Record<number, number>> {
  const daysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const headers = { "X-Shopify-Access-Token": accessToken };
  const sales: Record<number, number> = {};
  try {
    const res = await fetch(
      `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${daysAgo}&limit=250&fields=id,line_items`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return {};
    const data = await res.json();
    for (const order of (data.orders || [])) {
      for (const item of (order.line_items || [])) {
        if (item.variant_id) {
          sales[item.variant_id] = (sales[item.variant_id] || 0) + (item.quantity || 0);
        }
      }
    }
  } catch (err) {
    console.warn("[shopify/dashboard] variantSales fetch error:", (err as Error).message);
  }
  return sales;
}

/**
 * Fetch markets via GraphQL.
 */
async function fetchMarkets(shopUrl: string, accessToken: string): Promise<DashboardSuccess["markets"]> {
  const query = `{
    markets(first: 20) {
      nodes {
        id
        name
        handle
        enabled
        primaryLanguage { isoCode name }
        languages { nodes { isoCode name } }
        regions { nodes { name } }
        webPresences { nodes { subfolderSuffix domain { url } } }
      }
    }
  }`;

  try {
    const res = await fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { markets?: { nodes?: Array<Record<string, unknown>> } } };
    const nodes = json.data?.markets?.nodes || [];

    return nodes.map((m: Record<string, unknown>) => {
      const primaryLang = m.primaryLanguage as { isoCode?: string } | undefined;
      const langNodes = ((m.languages as { nodes?: Array<{ isoCode: string; name: string }> })?.nodes || []);
      const regionNodes = ((m.regions as { nodes?: Array<{ name: string }> })?.nodes || []);
      const webNodes = ((m.webPresences as { nodes?: Array<{ subfolderSuffix?: string; domain?: { url?: string } }> })?.nodes || []);
      const primary = webNodes[0] || {};
      const countryName = regionNodes[0]?.name || "";
      const countryCode = mapCountryToCode(countryName);

      return {
        id: (m.id as string) || "",
        name: (m.name as string) || "",
        handle: (m.handle as string) || "",
        enabled: !!(m.enabled),
        countryCode, countries: regionNodes.map((r) => r.name),
        currency: "USD",
        languages: (() => {
          const all = [primaryLang, ...langNodes].filter((l) => l?.isoCode) as Array<{ isoCode: string; name: string }>;
          return all.map((l) => ({ isoCode: l.isoCode, name: l.name || l.isoCode }));
        })(),
        domain: (primary.domain as { url?: string })?.url?.replace(/^https?:\/\//, "") || "",
        subfolder: primary.subfolderSuffix || "",
        priceAdjustment: null,
        productCount: 0,
      };
    });
  } catch (err) {
    console.warn("[shopify/dashboard] markets fetch error:", (err as Error).message);
    return [];
  }
}

function mapCountryToCode(name: string): string {
  const map: Record<string, string> = { "United States":"US","United Kingdom":"GB","Germany":"DE","Japan":"JP","France":"FR",
    "Canada":"CA","Australia":"AU","Austria":"AT","Belgium":"BE","Brazil":"BR","China":"CN","Denmark":"DK","Finland":"FI",
    "India":"IN","Ireland":"IE","Italy":"IT","Mexico":"MX","Netherlands":"NL","New Zealand":"NZ","Norway":"NO",
    "Poland":"PL","Portugal":"PT","Singapore":"SG","South Korea":"KR","Spain":"ES","Sweden":"SE","Switzerland":"CH",
  };
  return map[name] || name.slice(0, 2).toUpperCase();
}

/**
 * Fetch locations & per-location inventory levels.
 */
async function fetchLocationsAndInventory(shopUrl: string, accessToken: string): Promise<{
  locations: DashboardSuccess["locations"];
  inventoryByLocation: DashboardSuccess["inventoryByLocation"];
}> {
  const headers = { "X-Shopify-Access-Token": accessToken };
  try {
    const locRes = await fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/locations.json`, { headers, signal: AbortSignal.timeout(10000) });
    if (!locRes.ok) return { locations: [], inventoryByLocation: [] };
    const locData = await locRes.json() as { locations?: Array<{ id: number; name: string; address1?: string; city?: string; country?: string }> };
    const locations: DashboardSuccess["locations"] = (locData.locations || []).map((l) => ({
      id: l.id, name: l.name, address1: l.address1, city: l.city, country: l.country,
      type: (l.country === "CN" || l.country === "China") ? "domestic" as const : "overseas" as const,
    }));

    // Fetch inventory levels per location in bulk
    const inventoryByLocation: DashboardSuccess["inventoryByLocation"] = [];
    if (locations.length > 0) {
      const locIds = locations.map((l) => l.id).join(",");
      const invRes = await fetch(`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/inventory_levels.json?location_ids=${locIds}&limit=250`, { headers, signal: AbortSignal.timeout(15000) });
      if (invRes.ok) {
        const invData = await invRes.json() as { inventory_levels?: Array<{ inventory_item_id: string; location_id: number; available: number }> };
        for (const il of (invData.inventory_levels || [])) {
          const loc = locations.find((l) => l.id === il.location_id);
          inventoryByLocation.push({ variantId: 0, inventoryItemId: il.inventory_item_id, locationId: il.location_id, locationName: loc?.name || "", available: il.available });
        }
      }
    }
    return { locations, inventoryByLocation };
  } catch { return { locations: [], inventoryByLocation: [] }; }
}

/**
 * Extract top 3 shipping destination countries from today's orders.
 */
function extractTopCountries(orders: ShopifyOrder[]): string[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const raw = order.shipping_address?.country_code;
    if (raw) {
      const code = raw.trim().toUpperCase();
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code]) => code);
}

/**
 * Fetch holidays for multiple countries in parallel.
 * Returns { 'US': [...], 'GB': [...] }
 */
async function fetchMultiCountryHolidays(
  countries: string[],
): Promise<Record<string, NagerHoliday[]>> {
  const results = await Promise.all(
    countries.map(async (code) => {
      const holidays = await fetchHolidays(code);
      return { code, holidays };
    }),
  );
  const data: Record<string, NagerHoliday[]> = {};
  for (const { code, holidays } of results) {
    data[code] = holidays;
  }
  return data;
}

/**
 * Fetch all today's orders with automatic pagination.
 *
 * Shopify REST API paginates via the `Link` HTTP header.
 * When more pages exist, it contains rel="next" with the next page URL.
 */
async function fetchAllTodayOrders(
  shopUrl: string,
  accessToken: string,
): Promise<ShopifyOrder[]> {
  const todayISO = getBeijingTodayStartISO();
  const allOrders: ShopifyOrder[] = [];

  const baseUrl =`https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
  const params = new URLSearchParams({
    status: "any",
    created_at_min: todayISO,
    limit: "250",
    fields: "id,created_at,total_price,financial_status,shipping_address,gateway,customer,line_items",
  });

  let nextUrl: string | null = `${baseUrl}?${params.toString()}`;

  while (nextUrl !== null) {
    const res: globalThis.Response = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(mapShopifyError(res.status, body));
    }

    const data = await res.json() as { orders?: ShopifyOrder[] };
    if (data.orders) {
      allOrders.push(...data.orders);
    }

    // Pagination: parse Link header
    const linkHeader =
      res.headers.get("link") ?? res.headers.get("Link") ?? "";
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return allOrders;
}

/**
 * Enrich top products with images and inventory from the Products API.
 */
async function enrichProducts(
  shopUrl: string,
  accessToken: string,
  productIds: number[],
): Promise<Map<number, { image: string | null; inventory: number }>> {
  const result = new Map<number, { image: string | null; inventory: number }>();

  await Promise.all(
    productIds.map(async (pid) => {
      try {
        const res = await fetch(
          buildShopifyUrl(
            shopUrl,
            `/products/${pid}.json?fields=id,title,image,variants`,
          ),
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
          },
        );

        if (!res.ok) return;

        const data = await res.json() as { product: ShopifyProduct };
        const p = data.product;
        result.set(pid, {
          image: p.image?.src ?? null,
          inventory:
            p.variants?.reduce(
              (sum, v) => sum + (v.inventory_quantity ?? 0),
              0,
            ) ?? 0,
        });
      } catch {
        // Product may be deleted — skip silently
      }
    }),
  );

  return result;
}

// ─── Data Processing ──────────────────────────────────

/** Build 24 hourly sales buckets (Beijing time, CNY) */
function buildCharts(
  orders: ShopifyOrder[],
  exchangeRate: number,
): Array<{ hour: string; sales: number }> {
  const buckets = new Array(24).fill(0) as number[];

  for (const order of orders) {
    const utcDate = new Date(order.created_at);
    const beijingHour = (utcDate.getUTCHours() + 8) % 24;
    buckets[beijingHour] += parseFloat(order.total_price) || 0;
  }

  return buckets.map((usd, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    sales: Math.round(usd * exchangeRate * 100) / 100,
  }));
}

/** Extract top 5 products from order line_items sorted by quantity sold */
function buildProducts(orders: ShopifyOrder[]): Array<{
  id: number;
  title: string;
  image: string | null;
  totalSold: number;
  totalRevenue: number;
  inventory: number;
}> {
  const map = new Map<
    number,
    { title: string; totalSold: number; totalRevenue: number }
  >();

  for (const order of orders) {
    for (const item of order.line_items ?? []) {
      if (!item.product_id) continue;
      const entry = map.get(item.product_id);
      if (entry) {
        entry.totalSold += item.quantity;
        entry.totalRevenue +=
          parseFloat(item.price) * item.quantity;
      } else {
        map.set(item.product_id, {
          title: item.name,
          totalSold: item.quantity,
          totalRevenue: parseFloat(item.price) * item.quantity,
        });
      }
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].totalSold - a[1].totalSold)
    .slice(0, 5)
    .map(([id, data]) => ({
      id,
      title: data.title,
      image: null as string | null,
      totalSold: data.totalSold,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      inventory: 0,
    }));
}

// ─── PUT / GET Handler ────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // ─ Step 1: Extract credentials ─
    const searchParams = request.nextUrl.searchParams;
    const shopUrl =
      searchParams.get("shopUrl")?.trim() ??
      request.headers.get("x-shop-url")?.trim() ??
      "";
    const accessToken =
      searchParams.get("accessToken")?.trim() ??
      request.headers.get("x-shop-token")?.trim() ??
      "";

    // Validate
    if (!shopUrl) {
      return NextResponse.json<DashboardError>(
        { success: false, error: "缺少参数：shopUrl（店铺域名）", code: 400 },
        { status: 400 },
      );
    }
    if (!accessToken) {
      return NextResponse.json<DashboardError>(
        { success: false, error: "缺少参数：accessToken（API Token）", code: 400 },
        { status: 400 },
      );
    }

    // ─ Check: Demo mode ─
    const demoIndex = DEMO_DOMAINS.indexOf(shopUrl);
    if (demoIndex !== -1) {
      const store = DEMO_STORES[demoIndex];
      const orders = demoIndex === 0 ? DEMO_ORDERS_A : DEMO_ORDERS_B;
      const charts = demoIndex === 0 ? DEMO_CHARTS_A : DEMO_CHARTS_B;

      const gmvUsd = orders.reduce(
        (sum, o) => sum + parseFloat(o.total_price),
        0,
      );
      const gmv = Math.round(gmvUsd * 7.25 * 100) / 100;

      const compactOrders = orders.map((o) => ({
        id: o.id,
        created_at: o.created_at,
        total_price: o.total_price,
        financial_status: o.financial_status,
        gateway: o.gateway ?? "",
        customer_orders_count: o.customer?.orders_count ?? 1,
        shipping_country: o.shipping_address?.country_code ?? "",
      }));

      const products = store.products.map((p) => {
        const revenue = orders
          .flatMap((o) => o.line_items)
          .filter((li) => li.product_id === p.id)
          .reduce((sum, li) => sum + parseFloat(li.price) * li.quantity, 0);

        return {
          id: p.id,
          title: p.title,
          image: p.image,
          totalSold: p.totalSold,
          totalRevenue: Math.round(revenue * 100) / 100,
          inventory: p.inventory,
        };
      });

      // Demo: Store A → US/GB, Store B → JP/SE
      const demoTopCountries = demoIndex === 0 ? ["US", "GB"] : ["JP", "SE"];
      const holidaysData = await fetchMultiCountryHolidays(demoTopCountries);

      return NextResponse.json({
        success: true,
        shopName: store.shopName,
        domain: store.domain,
        currency: store.currency,
        exchangeRate: 7.25,
        gmv,
        orderCount: orders.length,
        conversionRate: 0,
        charts,
        products,
        orders: compactOrders,
        holidaysData,
        topCountries: demoTopCountries,
        lastUpdated: new Date().toISOString(),
      });
    }

    // ─ Step 2: Fetch shop info (validates credentials + domain) ─
    let shop: { name: string; currency: string; domain: string; country: string };
    try {
      shop = await fetchShopInfo(shopUrl, accessToken);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "未知错误";
      console.error("[shopify/dashboard] shop fetch failed:", message);

      const isAuthErr =
        message.includes("401") || message.includes("403") || message.includes("Token");
      const isNotFound = message.includes("404") || message.includes("不存在");

      const status = isAuthErr ? 401 : isNotFound ? 404 : 502;
      const friendlyMsg = isAuthErr
        ? "API Token 无效或权限不足，请在 Shopify 后台重新生成并确认权限范围包含 read_orders、read_products"
        : isNotFound
        ? "店铺域名不存在，请检查域名是否正确（格式: your-store.myshopify.com）"
        : message;

      return NextResponse.json<DashboardError>(
        { success: false, error: friendlyMsg, code: status },
        { status },
      );
    }

    // ─ Step 3: Exchange rate (configurable via .env, fallback 7.25) ─
    const exchangeRate = getExchangeRate();

    // ─ Step 4: Fetch today's orders ─
    let orders: ShopifyOrder[];
    try {
      orders = await fetchAllTodayOrders(shopUrl, accessToken);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "订单获取失败";
      console.error("[shopify/dashboard] orders fetch failed:", message);
      return NextResponse.json<DashboardError>(
        { success: false, error: message, code: 502 },
        { status: 502 },
      );
    }

    // ─ Step 5: Calculate GMV in CNY ─
    const gmvUsd = orders.reduce(
      (sum, o) => sum + (parseFloat(o.total_price) || 0),
      0,
    );
    const gmv = Math.round(gmvUsd * exchangeRate * 100) / 100;
    const orderCount = orders.length;

    // ─ Step 6: Build charts (hourly sales in CNY) ─
    const charts = buildCharts(orders, exchangeRate);

    // ─ Step 7: Build products (top 5 by sales volume) ─
    const productStats = buildProducts(orders);

    // Enrich with image + inventory from Products API
    const productIds = productStats.map((p) => p.id);
    if (productIds.length > 0) {
      const enrichments = await enrichProducts(shopUrl, accessToken, productIds);
      for (const p of productStats) {
        const extra = enrichments.get(p.id);
        if (extra) {
          p.image = extra.image;
          p.inventory = extra.inventory;
        }
      }
    }

    // ─ Step 7b: Fetch full product catalog via GraphQL (for ProductControlPanel) ─
    const fullProducts = await fetchFullProducts(shopUrl, accessToken, shop.name);

    // ─ Step 7c: Fetch customers ─
    const customers = await fetchCustomers(shopUrl, accessToken);

    // ─ Step 7d: Fetch collections ─
    const collections = await fetchCollections(shopUrl, accessToken);

    // ─ Step 7e: Fetch navigation menus ─
    const menus = await fetchMenus(shopUrl, accessToken);

    // ─ Step 7f: Fetch pages ─
    const pages = await fetchPages(shopUrl, accessToken);

    // ─ Step 7g: Fetch blogs with articles ─
    const blogs = await fetchBlogs(shopUrl, accessToken);

    // ─ Step 7h: Fetch variant-level sales ─
    const variantSales = await fetchVariantSales(shopUrl, accessToken);

    // ─ Step 7i: Fetch markets ─
    const markets = await fetchMarkets(shopUrl, accessToken);

    // ─ Step 7j: Fetch locations & inventory ─
    const { locations, inventoryByLocation } = await fetchLocationsAndInventory(shopUrl, accessToken);

    // ─ Step 8: Conversion rate ─
    // NOTE: Shopify REST API does not expose visitor data.
    // Accurate conversion rate requires the Analytics API or custom tracking.
    // Returning 0 as a placeholder.
    const conversionRate = 0;

    // ─ Step 9: Fetch active Markets via GraphQL + multi-market holidays ─
    let safeCountries: string[];
    try {
      const markets = await fetchActiveMarketCountries(shopUrl, accessToken);
      safeCountries = markets.length > 0 ? markets : [shop.country || "US"];
    } catch (err) {
      console.warn("[shopify/dashboard] GraphQL Markets fell back to shop country:", (err as Error).message);
      safeCountries = [shop.country || "US"];
    }
    const holidaysData = await fetchMultiCountryHolidays(safeCountries);

    // ─ Step 10: Build success response ─
    const compactOrders = orders.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      total_price: o.total_price,
      financial_status: o.financial_status ?? "",
      gateway: o.gateway ?? "",
      customer_orders_count: o.customer?.orders_count ?? 1,
      shipping_country: o.shipping_address?.country_code ?? "",
    }));

    const response: DashboardSuccess = {
      success: true,
      shopName: shop.name,
      domain: shop.domain,
      currency: shop.currency,
      exchangeRate,
      gmv,
      orderCount,
      conversionRate,
      charts,
      products: productStats,
      orders: compactOrders,
      holidaysData,
      topCountries: safeCountries,
      fullProducts,
      customers,
      collections,
      menus,
      pages,
      blogs,
      variantSales,
      markets,
      locations,
      inventoryByLocation,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "服务器内部未知错误";
    console.error("[shopify/dashboard] unhandled error:", message);

    return NextResponse.json<DashboardError>(
      { success: false, error: `服务器内部错误: ${message}`, code: 500 },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════
// Product Variant Update — Shopify GraphQL mutation
// ═══════════════════════════════════════════════════════

async function handleProductVariantUpdate(
  shopUrl: string,
  accessToken: string,
  variantId: number,
  productId: string,
  inventoryItemId: string,
  newPrice?: number,
  newInventory?: number,
  inventoryDelta?: number,
): Promise<NextResponse> {
  const GQL_URL = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/graphql.json";

  let success = true;

  // Step 1: Update price via productVariantsBulkUpdate (2026-04 standard)
  if (newPrice !== undefined && newPrice > 0) {
    const priceMutation = "mutation bulkUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { field message } } }";
    const priceVariables = {
      productId: productId,
      variants: [{ id: "gid://shopify/ProductVariant/" + variantId, price: String(newPrice) }],
    };

    try {
      const res = await fetch(GQL_URL, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ query: priceMutation, variables: priceVariables }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return NextResponse.json({ success: false, error: "改价请求失败 HTTP " + res.status }, { status: 502 });
      }

      const data = await res.json() as {
        data?: { productVariantsBulkUpdate?: { userErrors?: Array<{ message: string }> } };
        errors?: Array<{ message: string }>;
      };

      if (data.errors?.length) {
        return NextResponse.json({ success: false, error: "GraphQL 错误: " + data.errors[0].message }, { status: 502 });
      }

      const ue = data.data?.productVariantsBulkUpdate?.userErrors;
      if (ue && ue.length > 0) {
        const msg = ue[0].message;
        if (msg.toLowerCase().includes("access") || msg.toLowerCase().includes("scope")) {
          return NextResponse.json({ success: false, error: "请确认 Custom App 已勾选 write_products Admin API 写入权限" }, { status: 403 });
        }
        return NextResponse.json({ success: false, error: "Shopify 拒绝: " + msg }, { status: 400 });
      }
    } catch (err) {
      success = false;
      console.error("[shopify/dashboard] price update error:", err);
    }
  }

  // Step 2: Update inventory via REST Admin API (stable, all API versions)
  if (newInventory !== undefined && inventoryItemId) {
    // Extract numeric IDs from GID strings
    const inventoryItemNum = inventoryItemId.replace(/\D/g, "");

    // Fetch default location numeric ID
    let locationNum = "";
    try {
      const locQuery = "{ locations(first: 1) { nodes { id } } }";
      const locRes = await fetch(GQL_URL, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ query: locQuery }),
        signal: AbortSignal.timeout(10000),
      });
      if (locRes.ok) {
        const locData = await locRes.json() as { data?: { locations?: { nodes?: Array<{ id: string }> } } };
        locationNum = (locData.data?.locations?.nodes?.[0]?.id ?? "").replace(/\D/g, "");
      }
    } catch { /* continue */ }

    if (!locationNum || !inventoryItemNum) {
      success = false;
      console.error("[shopify/dashboard] could not resolve location/inventory IDs for REST call");
    } else {
      const REST_URL = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/inventory_levels/set.json";
      try {
        const res = await fetch(REST_URL, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location_id: Number(locationNum),
            inventory_item_id: Number(inventoryItemNum),
            available: newInventory,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          return NextResponse.json({ success: false, error: "库存 REST 更新失败 HTTP " + res.status + ": " + errBody.slice(0, 100) }, { status: 502 });
        }
      } catch (err) {
        success = false;
        console.error("[shopify/dashboard] REST inventory error:", err);
      }
    }
  }

  if (!success) return NextResponse.json({ success: false, error: "部分更新失败，请重试" }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ═══════════════════════════════════════════════════════
// Order Tags Update — Shopify REST API
// ═══════════════════════════════════════════════════════

async function handleOrderTagsUpdate(
  shopUrl: string,
  accessToken: string,
  orderId: number,
  tags: string[],
): Promise<NextResponse> {
  const url = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/orders/" + orderId + ".json";
  const tagString = tags.join(", ");

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order: { id: orderId, tags: tagString } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401) return NextResponse.json({ success: false, error: "Token 已过期或无效，请重新绑定店铺" }, { status: 401 });
      if (res.status === 404) return NextResponse.json({ success: false, error: "订单不存在或已被删除" }, { status: 404 });
      if (res.status === 429) return NextResponse.json({ success: false, error: "请求过于频繁，请稍后重试" }, { status: 429 });
      return NextResponse.json({ success: false, error: "标签更新失败 HTTP " + res.status }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard] orderTags update error:", msg);
    return NextResponse.json({ success: false, error: "标签更新失败: " + msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Order Note Update — Shopify REST API
// ═══════════════════════════════════════════════════════

async function handleOrderNoteUpdate(
  shopUrl: string,
  accessToken: string,
  orderId: number,
  note: string,
): Promise<NextResponse> {
  const url = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/orders/" + orderId + ".json";

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order: { id: orderId, note } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401) return NextResponse.json({ success: false, error: "Token 已过期或无效，请重新绑定店铺" }, { status: 401 });
      if (res.status === 404) return NextResponse.json({ success: false, error: "订单不存在或已被删除" }, { status: 404 });
      if (res.status === 429) return NextResponse.json({ success: false, error: "请求过于频繁，请稍后重试" }, { status: 429 });
      return NextResponse.json({ success: false, error: "备注更新失败 HTTP " + res.status }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard] orderNote update error:", msg);
    return NextResponse.json({ success: false, error: "备注更新失败: " + msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Update Product — Shopify REST API
// ═══════════════════════════════════════════════════════

async function handleUpdateProduct(
  shopUrl: string,
  accessToken: string,
  productId: number,
  title?: string,
  bodyHtml?: string,
  vendor?: string,
  productType?: string,
  tags?: string[],
  status?: string,
  seoTitle?: string,
  seoDescription?: string,
): Promise<NextResponse> {
  const url = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/products/" + productId + ".json";

  const product: Record<string, unknown> = { id: productId };
  if (title !== undefined) product.title = title;
  if (bodyHtml !== undefined) product.body_html = bodyHtml;
  if (vendor !== undefined) product.vendor = vendor;
  if (productType !== undefined) product.product_type = productType;
  if (tags !== undefined) product.tags = tags.join(", ");
  if (status !== undefined) product.status = status;
  if (seoTitle !== undefined) product.metafields_global_title_tag = seoTitle;
  if (seoDescription !== undefined) product.metafields_global_description_tag = seoDescription;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401) return NextResponse.json({ success: false, error: "Token 已过期或无效，请重新绑定店铺" }, { status: 401 });
      if (res.status === 404) return NextResponse.json({ success: false, error: "商品不存在或已被删除" }, { status: 404 });
      if (res.status === 422) return NextResponse.json({ success: false, error: "字段校验失败，请检查输入数据" }, { status: 400 });
      return NextResponse.json({ success: false, error: "商品更新失败 HTTP " + res.status }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard] updateProduct error:", msg);
    return NextResponse.json({ success: false, error: "商品更新失败: " + msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Collection CRUD Handler
// ═══════════════════════════════════════════════════════

async function handleCollectionAction(
  action: string,
  shopUrl: string,
  accessToken: string,
  collectionType: string,
  collectionId?: number,
  collectionData?: Record<string, unknown>,
): Promise<NextResponse> {
  const base = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;
  const resource = collectionType === "smart" ? "smart_collections" : "custom_collections";

  try {
    let url = `${base}/${resource}.json`;
    let method = "GET";
    let body: string | undefined;

    if (action === "deleteCollection" && collectionId) {
      url = `${base}/${resource}/${collectionId}.json`;
      method = "DELETE";
    } else if (action === "updateCollection" && collectionId && collectionData) {
      url = `${base}/${resource}/${collectionId}.json`;
      method = "PUT";
      body = JSON.stringify(collectionData);
    } else if (action === "createCollection" && collectionData) {
      method = "POST";
      body = JSON.stringify(collectionData);
    } else {
      return NextResponse.json({ success: false, error: "缺少必要参数" }, { status: 400 });
    }

    const res = await fetch(url, {
      method,
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 401) return NextResponse.json({ success: false, error: "Token 已过期或无效" }, { status: 401 });
      if (res.status === 404) return NextResponse.json({ success: false, error: "集合不存在" }, { status: 404 });
      return NextResponse.json({ success: false, error: "操作失败 HTTP " + res.status }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard] collection action error:", msg);
    return NextResponse.json({ success: false, error: "集合操作失败: " + msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Create Fulfillment — Shopify REST API
// ═══════════════════════════════════════════════════════

async function handleCreateFulfillment(
  shopUrl: string,
  accessToken: string,
  orderId: number,
  trackingNumber: string,
  trackingCompany: string,
  notifyCustomer: boolean,
  lineItemIds?: number[],
): Promise<NextResponse> {
  const url = "https://" + shopUrl + "/admin/api/" + SHOPIFY_API_VERSION + "/orders/" + orderId + "/fulfillments.json";

  try {
    const body: Record<string, unknown> = {
      fulfillment: {
        tracking_number: trackingNumber,
        tracking_company: trackingCompany,
        notify_customer: notifyCustomer,
      },
    };

    if (lineItemIds && lineItemIds.length > 0) {
      (body.fulfillment as Record<string, unknown>).line_items = lineItemIds.map((id) => ({ id }));
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 401) return NextResponse.json({ success: false, error: "Token 已过期或无效，请重新绑定店铺" }, { status: 401 });
      if (res.status === 404) return NextResponse.json({ success: false, error: "订单不存在或已被删除" }, { status: 404 });
      if (res.status === 422) {
        const errData = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = String((errData as any)?.errors ?? "");
        if (msg.includes("already fulfilled") || msg.includes("fulfill")) return NextResponse.json({ success: false, error: "该订单已完成全部履约" }, { status: 400 });
        if (msg.includes("inventory") || msg.includes("stock") || msg.includes("not enough")) return NextResponse.json({ success: false, error: "该商品库存不足以完成履约" }, { status: 400 });
        return NextResponse.json({ success: false, error: "履约失败: " + msg.slice(0, 100) }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: "履约创建失败 HTTP " + res.status }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard] createFulfillment error:", msg);
    return NextResponse.json({ success: false, error: "履约创建失败: " + msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Menu Item Action Handler
// ═══════════════════════════════════════════════════════

async function handleMenuItemAction(
  shopUrl: string, accessToken: string, menuId: number,
  changeType: "add" | "update" | "delete", itemId: number,
  itemData?: Record<string, unknown>,
): Promise<NextResponse> {
  const base = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/menus/${menuId}/items`;

  try {
    let url = `${base}.json`;
    let method = "GET";
    let body: string | undefined;

    if (changeType === "delete") {
      url = `${base}/${itemId}.json`;
      method = "DELETE";
    } else if (changeType === "update" && itemData) {
      url = `${base}/${itemId}.json`;
      method = "PUT";
      const { id, title, url: itemUrl, type, parent_id, position } = itemData;
      body = JSON.stringify({ link_list_item: { title, url: itemUrl, type, parent_id: parent_id || null, position } });
    } else if (changeType === "add" && itemData) {
      method = "POST";
      const { id, title, url: itemUrl, type, parent_id, position } = itemData;
      body = JSON.stringify({ link_list_item: { title, url: itemUrl, type, parent_id: parent_id || null, position } });
    }

    const res = await fetch(url, {
      method, headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return NextResponse.json({ success: false, error: "菜单操作失败 HTTP " + res.status }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "网络错误" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Translation CRUD Handler
// ═══════════════════════════════════════════════════════

async function handleTranslationAction(
  action: string, shopUrl: string, accessToken: string,
  locale?: string, resourceType?: string, resourceId?: string,
  translations?: Array<{ key: string; value: string }>,
): Promise<NextResponse> {
  const headers = { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };
  const endpoint = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  try {
    let query = "";
    let variables: Record<string, unknown> = {};

    if (action === "getTranslatableResources") {
      query = `query($resourceType: TranslatableResourceType!, $first: Int!) { translatableResources(resourceType: $resourceType, first: $first) { nodes { resourceId translatableContent { key value digest } } } }`;
      variables = { resourceType: (resourceType || "PRODUCT").toUpperCase(), first: 50 };
    } else if (action === "getTranslations") {
      query = `query($locale: String!, $first: Int!) { translations(locale: $locale, first: $first) { nodes { key value translatableContent { digest } } } }`;
      variables = { locale: locale || "zh-CN", first: 250 };
    } else if (action === "saveTranslations" && resourceId && translations) {
      query = `mutation($resourceId: ID!, $translations: [TranslationInput!]!) { translationsRegister(resourceId: $resourceId, translations: $translations) { userErrors { field message } translations { key value } } }`;
      variables = { resourceId: `gid://shopify/Product/${resourceId}`, translations };
    } else {
      return NextResponse.json({ success: false, error: "参数错误" }, { status: 400 });
    }

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return NextResponse.json({ success: false, error: "请求失败" }, { status: 502 });
    const json = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
    if (json.errors?.length) return NextResponse.json({ success: false, error: json.errors[0].message }, { status: 502 });
    return NextResponse.json({ success: true, data: json.data });
  } catch (err) {
    return NextResponse.json({ success: false, error: "网络错误" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Metafield CRUD Handler
// ═══════════════════════════════════════════════════════

async function handleMetafieldAction(
  action: string, shopUrl: string, accessToken: string,
  ownerType: string, ownerId: number, fieldId?: number,
  fieldData?: Record<string, unknown>,
): Promise<NextResponse> {
  const resourceMap: Record<string, string> = { product: "products", variant: "variants", collection: "collections" };
  const resource = resourceMap[ownerType] || ownerType;
  const headers = { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };

  try {
    let url = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/${resource}/${ownerId}/metafields.json`;
    let method = "GET";
    let body: string | undefined;

    if (action === "deleteMetafield" && fieldId) {
      url = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/${resource}/${ownerId}/metafields/${fieldId}.json`;
      method = "DELETE";
    } else if (action === "saveMetafield" && fieldData) {
      if (fieldId) {
        url = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/${resource}/${ownerId}/metafields/${fieldId}.json`;
        method = "PUT";
      } else {
        method = "POST";
      }
      body = JSON.stringify({ metafield: fieldData });
    }

    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(10000) });

    if (action === "getMetafields") {
      if (!res.ok) return NextResponse.json({ success: true, metafields: [] });
      const data = await res.json();
      return NextResponse.json({ success: true, metafields: data.metafields || [] });
    }

    if (!res.ok) return NextResponse.json({ success: false, error: "操作失败 HTTP " + res.status }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "网络错误" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// Page & Article CRUD Handler
// ═══════════════════════════════════════════════════════

async function handleContentAction(
  action: string, shopUrl: string, accessToken: string,
  id?: number, blogId?: number, data?: Record<string, unknown>,
): Promise<NextResponse> {
  const headers = { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };
  const base = `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}`;

  try {
    let url = "", method = "POST";
    const shouldBody = action.startsWith("save");

    if (action === "savePage") {
      url = `${base}/pages${id ? "/" + id + ".json" : ".json"}`;
      method = id ? "PUT" : "POST";
    } else if (action === "deletePage" && id) {
      url = `${base}/pages/${id}.json`;
      method = "DELETE";
    } else if (action === "saveArticle" && blogId) {
      url = `${base}/blogs/${blogId}/articles${id ? "/" + id + ".json" : ".json"}`;
      method = id ? "PUT" : "POST";
    } else if (action === "deleteArticle" && blogId && id) {
      url = `${base}/blogs/${blogId}/articles/${id}.json`;
      method = "DELETE";
    } else {
      return NextResponse.json({ success: false, error: "参数错误" }, { status: 400 });
    }

    const res = await fetch(url, {
      method, headers,
      body: shouldBody && data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ success: false, error: "操作失败 HTTP " + res.status }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "网络错误" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// POST /api/shopify/dashboard — 双轨路由器
//   • action="updateProductVariant" → Shopify GraphQL 写操作
//   • 其他 → AI 智能诊断
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action?: string;
      shopUrl?: string;
      accessToken?: string;
      variantId?: number;
      productId?: string;
      inventoryItemId?: string;
      newPrice?: number;
      newInventory?: number;
      inventoryDelta?: number;
      orderId?: number;
      tags?: string[];
      note?: string;
      trackingNumber?: string;
      trackingCompany?: string;
      notifyCustomer?: boolean;
      lineItemIds?: number[];
      title?: string;
      bodyHtml?: string;
      vendor?: string;
      productType?: string;
      status?: string;
      seoTitle?: string;
      seoDescription?: string;
      collectionType?: string;
      collectionId?: number;
      collectionData?: Record<string, unknown>;
      menuId?: number;
      changeType?: string;
      itemId?: number;
      itemData?: Record<string, unknown>;
      contentId?: number;
      blogId?: number;
      contentData?: Record<string, unknown>;
      ownerType?: string;
      ownerId?: number;
      metaFieldId?: number;
      metaFieldData?: Record<string, unknown>;
      locale?: string;
      resourceType?: string;
      resourceId?: string;
      translations?: Array<{ key: string; value: string }>;
      isDemo?: boolean;
      metrics?: {
        shopName: string;
        gmv: number;
        orderCount: number;
        conversionRate: number;
        exchangeRate: number;
        currency: string;
        products: Array<{ title: string; totalSold: number; inventory: number; totalRevenue: number }>;
        refundRate: number;
        refundedCount: number;
        refundAmount: number;
        cogsRate: number;
        shippingRate: number;
        marketingRate: number;
        stripeFeeCny: number;
        paypalFeeCny: number;
        funnelSessions: number;
        funnelAtc: number;
        funnelIc: number;
        funnelPurchase: number;
        icAtcRatio: number;
        repeatRate: number;
        repeatRevenuePct: number;
        newCustomerPct: number;
      };
    };

    // ═════════════════════════════════════════════════════
    // 写操作路由: Shopify GraphQL productVariantUpdate
    // ═════════════════════════════════════════════════════
    if (body.action === "updateProductVariant" && body.shopUrl && body.accessToken && body.variantId) {
      return await handleProductVariantUpdate(
        body.shopUrl,
        body.accessToken,
        body.variantId,
        body.productId || "",
        body.inventoryItemId || "",
        body.newPrice,
        body.newInventory,
        body.inventoryDelta,
      );
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 订单标签更新
    // ═════════════════════════════════════════════════════
    if (body.action === "updateOrderTags" && body.shopUrl && body.accessToken && body.orderId && body.tags) {
      return await handleOrderTagsUpdate(body.shopUrl, body.accessToken, body.orderId, body.tags);
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 订单备注更新
    // ═════════════════════════════════════════════════════
    if (body.action === "updateOrderNote" && body.shopUrl && body.accessToken && body.orderId) {
      return await handleOrderNoteUpdate(body.shopUrl, body.accessToken, body.orderId, body.note || "");
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 更新商品信息
    // ═════════════════════════════════════════════════════
    if (body.action === "updateProduct" && body.shopUrl && body.accessToken && body.productId) {
      return await handleUpdateProduct(
        body.shopUrl,
        body.accessToken,
        Number(body.productId),
        body.title,
        body.bodyHtml,
        body.vendor,
        body.productType,
        body.tags,
        body.status,
        body.seoTitle,
        body.seoDescription,
      );
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 集合 CRUD
    // ═════════════════════════════════════════════════════
    if (body.action && ["createCollection", "updateCollection", "deleteCollection"].includes(body.action) && body.shopUrl && body.accessToken) {
      return await handleCollectionAction(body.action, body.shopUrl, body.accessToken, body.collectionType || "smart", body.collectionId as number | undefined, body.collectionData as Record<string, unknown> | undefined);
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 创建履约
    // ═════════════════════════════════════════════════════
    if (body.action === "createFulfillment" && body.shopUrl && body.accessToken && body.orderId) {
      return await handleCreateFulfillment(
        body.shopUrl,
        body.accessToken,
        body.orderId,
        body.trackingNumber || "",
        body.trackingCompany || "USPS",
        body.notifyCustomer ?? true,
        body.lineItemIds,
      );
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 菜单项更新
    // ═════════════════════════════════════════════════════
    if (body.action === "updateMenu" && body.shopUrl && body.accessToken && body.menuId && body.changeType && body.itemId) {
      return await handleMenuItemAction(
        body.shopUrl,
        body.accessToken,
        body.menuId,
        body.changeType as "add" | "update" | "delete",
        body.itemId,
        body.itemData as Record<string, unknown> | undefined,
      );
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: 页面/文章 CRUD
    // ═════════════════════════════════════════════════════
    if (body.action && ["savePage", "deletePage", "saveArticle", "deleteArticle"].includes(body.action) && body.shopUrl && body.accessToken) {
      return await handleContentAction(body.action, body.shopUrl, body.accessToken, body.contentId as number, body.blogId as number, body.contentData as Record<string, unknown>);
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: Metafields CRUD
    // ═════════════════════════════════════════════════════
    if (body.action && ["getMetafields", "saveMetafield", "deleteMetafield"].includes(body.action) && body.shopUrl && body.accessToken && body.ownerType && body.ownerId) {
      return await handleMetafieldAction(body.action, body.shopUrl, body.accessToken, body.ownerType as string, body.ownerId, body.metaFieldId as number | undefined, body.metaFieldData as Record<string, unknown> | undefined);
    }

    // ═════════════════════════════════════════════════════
    // 写操作路由: Translation CRUD
    // ═════════════════════════════════════════════════════
    if (body.action && ["getTranslatableResources", "getTranslations", "saveTranslations"].includes(body.action) && body.shopUrl && body.accessToken) {
      return await handleTranslationAction(body.action, body.shopUrl, body.accessToken, body.locale as string, body.resourceType as string, body.resourceId as string, body.translations as Array<{ key: string; value: string }>);
    }

    const isDemo = body.isDemo || !!body.shopUrl?.includes("demo");
    const m = body.metrics;

    if (!m) {
      return NextResponse.json({ success: false, error: "缺少诊断指标" }, { status: 400 });
    }

    // ── 轨 A: Demo 店铺 — 由前端本地处理，后端仅做兜底 ──
    if (isDemo) {
      return NextResponse.json({
        success: true,
        diagnosis: {
          overview: `## 📊 数据总览\n\n**${m.shopName}** 今日表现活跃，GMV 达 **¥${m.gmv.toLocaleString()}**，共 **${m.orderCount} 笔**订单。\n\n> 演示环境数据示意，连接真实店铺获取 DeepSeek-v4-pro 个性化诊断。`,
          conversionAnalysis: `## 📈 转化漏斗分析\n\n访客→加购 ${m.funnelSessions > 0 ? ((m.funnelAtc / m.funnelSessions) * 100).toFixed(1) : "—"}% · 加购→结账 ${(m.icAtcRatio * 100).toFixed(1)}% · 结账→成交 ${m.funnelIc > 0 ? ((m.funnelPurchase / m.funnelIc) * 100).toFixed(1) : "—"}%\n\n主要瓶颈在加购→结账环节，建议优化 Checkout 流程。`,
          inventoryAlerts: m.products.filter((p) => p.inventory < 10).length > 0
            ? ["## 🔴 库存预警\n\n部分商品库存告急。"]
            : ["## ✅ 库存健康\n\n所有热销商品库存充足。"],
          recommendations: ["## 💡 行动建议\n\n### ① 转化优化\n> 添加限时折扣倒计时和库存紧迫提示\n\n### ② 邮件营销\n> 创建弃单挽回自动化流程\n\n### ③ 长期增长\n> 布局多市场 Shopify Markets"],
          riskLevel: m.refundRate > 1.5 ? "high" : m.refundRate > 1 ? "medium" : "low",
        },
      });
    }

    // ── 轨 B: 真实店铺 — DeepSeek-v4-pro 实战诊断 ──
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "未配置 DEEPSEEK_API_KEY 环境变量，请在 .env.local 中添加并重启服务",
      }, { status: 500 });
    }

    const systemPrompt = `你是一名精通 Shopify Markets 多市场运营、Stripe/PayPal 网关拒付对账、流量 MER 边际效益、供应链周转以及独立站复购留存的骨灰级操盘手。说话要真诚、大白话、直击痛点。
请根据传入的真实 Shopify 经营 JSON 账本，为卖家提供包含以下三段的结构化 Markdown 报告：

## 📊 今日营收与流失大盘点
[结合 GMV、单量、转化漏斗各层流失率，直言今日经营的好坏。给出 ICE (Impact/Confidence/Ease) 最高的问题排序]

## 💳 网关与供应链暗坑诊断
[分析 Stripe/PayPal 扣费占比是否异常，结合商品成本/物流/广告三滑块，诊断毛利的真实健康度。如果退款率超 1.5% 必须直接亮红灯]

## 🚀 今日高回报行动指南
[给出具体可执行策略。必须包含：① 建议调整某个具体商品定价；② 建议追单或砍掉某个广告渠道；③ 如果复购率低于 15%，给出激活老客的一招]

严禁说'要优化网站'、'要加强营销'等业余空话。必须结合数据给出具体策略。每条建议结尾标注预期 ROI 方向（↑/↓/→）。`;

    const userPrompt = `店铺：${m.shopName} | 货币：${m.currency} | 汇率：¥${m.exchangeRate}

💰 今日营收：GMV ¥${m.gmv.toLocaleString()} | 单数 ${m.orderCount} | 客单价 ¥${m.orderCount > 0 ? Math.round(m.gmv / m.orderCount).toLocaleString() : 0}

📈 转化漏斗：商品访客 ${m.funnelSessions.toLocaleString()} → 加购 ${m.funnelAtc.toLocaleString()} (${m.funnelSessions > 0 ? ((m.funnelAtc / m.funnelSessions) * 100).toFixed(1) : "—"}%) → 结账 ${m.funnelIc.toLocaleString()} (${(m.icAtcRatio * 100).toFixed(1)}%) → 成交 ${m.funnelPurchase} 单 (${m.funnelIc > 0 ? ((m.funnelPurchase / m.funnelIc) * 100).toFixed(1) : "—"}%)

💳 网关扣费：Stripe ¥${(m.stripeFeeCny ?? 0).toFixed(2)} | PayPal ¥${(m.paypalFeeCny ?? 0).toFixed(2)}

📦 成本结构：采购 ${m.cogsRate}% | 物流 ${m.shippingRate}% | 广告 ${m.marketingRate}%

🛡️ 风控：退款率 ${m.refundRate.toFixed(1)}% | 退款 ${m.refundedCount} 单 ¥${(m.refundAmount ?? 0).toFixed(2)}

♻️ 复购：今日老客复购率 ${m.repeatRate.toFixed(1)}% | 老客营收占比 ${m.repeatRevenuePct.toFixed(1)}% | 新客占比 ${m.newCustomerPct.toFixed(1)}%

📦 热销商品：
${m.products.map((p) => `- ${p.title}：售出 ${p.totalSold} 件 · 库存 ${p.inventory} 件 · 营收 ¥${(p.totalRevenue ?? 0).toFixed(2)}`).join("\n")}

请严格按三段式输出报告，不要输出无关内容。`;

    const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!dsResponse.ok) {
      const errBody = await dsResponse.text().catch(() => "");
      console.error("[shopify/dashboard POST] DeepSeek error:", dsResponse.status, errBody);
      return NextResponse.json({ success: false, error: `AI 诊断服务异常 (${dsResponse.status})` }, { status: 502 });
    }

    const dsData = await dsResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const rawContent = dsData.choices?.[0]?.message?.content ?? "";

    // Parse sections from AI response
    const lines = rawContent.split("\n");
    const overviewEnd = lines.findIndex((l) => l.startsWith("## 📈"));
    const invIdx = lines.findIndex((l) => l.startsWith("## ") && (l.includes("库存") || l.includes("预警") || l.includes("✅")));
    const recIdx = lines.findIndex((l) => l.startsWith("## 💡"));

    const overview = lines.slice(0, overviewEnd > 0 ? overviewEnd : undefined).join("\n").trim();
    const conversionAnalysis = overviewEnd >= 0
      ? lines.slice(overviewEnd, invIdx > 0 ? invIdx : recIdx > 0 ? recIdx : undefined).join("\n").trim()
      : "";
    const inventorySection = invIdx >= 0 && recIdx > 0
      ? lines.slice(invIdx, recIdx).join("\n").trim()
      : "## ✅ 库存健康\n\n所有商品库存充足。";
    const recommendations = recIdx >= 0
      ? lines.slice(recIdx).join("\n").trim()
      : "## 💡 行动建议\n\n暂无建议。";

    return NextResponse.json({
      success: true,
      diagnosis: {
        overview: overview || "## 📊 数据总览\n\n" + m.shopName + " 今日运营正常。",
        conversionAnalysis: conversionAnalysis || "## 📈 转化漏斗分析\n\n暂无分析数据。",
        inventoryAlerts: [inventorySection],
        recommendations: [recommendations],
        riskLevel: (m.refundRate ?? 0) > 1.5 ? "high"
          : (m.refundRate ?? 0) > 1 ? "medium"
          : "low",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    console.error("[shopify/dashboard POST] unhandled error:", message);
    return NextResponse.json({ success: false, error: `诊断失败: ${message}` }, { status: 500 });
  }
}
