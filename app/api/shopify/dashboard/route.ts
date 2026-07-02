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
// POST /api/shopify/dashboard — AI 智能诊断
// ═══════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      shopUrl?: string;
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
