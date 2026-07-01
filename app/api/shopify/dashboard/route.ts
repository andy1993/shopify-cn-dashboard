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
  }>;
  /** Multi-market holiday data: { 'US': [...], 'GB': [...], 'DE': [...] } */
  holidaysData: Record<string, NagerHoliday[]>;
  /** Top 3 shipping destination countries */
  topCountries: string[];
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
 * Extract top 3 shipping destination countries from today's orders.
 */
function extractTopCountries(orders: ShopifyOrder[]): string[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const code = order.shipping_address?.country_code;
    if (code) {
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
    fields: "id,created_at,total_price,financial_status,shipping_address,line_items",
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

    // ─ Step 8: Conversion rate ─
    // NOTE: Shopify REST API does not expose visitor data.
    // Accurate conversion rate requires the Analytics API or custom tracking.
    // Returning 0 as a placeholder.
    const conversionRate = 0;

    // ─ Step 9: Extract top shipping countries + fetch multi-market holidays ─
    const topCountries = extractTopCountries(orders);
    const holidaysData = await fetchMultiCountryHolidays(
      topCountries.length > 0 ? topCountries : [shop.country || "US"],
    );

    // ─ Step 10: Build success response ─
    const compactOrders = orders.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      total_price: o.total_price,
      financial_status: o.financial_status ?? "",
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
      topCountries,
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
