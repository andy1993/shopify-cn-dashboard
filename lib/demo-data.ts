// ─── Demo Mode: High-fidelity Mock Data ────────────────────────────
// Used when shopUrl matches a demo domain, returning realistic 2026-07-01 data.

interface DemoOrder {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  gateway?: string;
  customer?: { orders_count: number } | null;
  shipping_address?: { country_code: string } | null;
  line_items: Array<{
    id: number;
    product_id: number;
    name: string;
    quantity: number;
    price: string;
  }>;
}

interface DemoProduct {
  id: number;
  title: string;
  image: string;
  totalSold: number;
  inventory: number;
}

interface DemoStore {
  domain: string;
  shopName: string;
  currency: string;
  products: DemoProduct[];
}

// ─── Product image URL helpers (Unsplash direct links) ────────────

function img(id: string) {
  return `https://images.unsplash.com/${id}?w=200&h=200&fit=crop&auto=format`;
}

// ─── Store Definitions ─────────────────────────────────────────────

export const DEMO_DOMAINS = [
  "tech-accessories-demo.myshopify.com",
  "minimal-home-demo.myshopify.com",
];

export const DEMO_STORES: DemoStore[] = [
  {
    domain: "tech-accessories-demo.myshopify.com",
    shopName: "TechGear Pro",
    currency: "USD",
    products: [
      {
        id: 1001,
        title: "无线降噪耳机 Pro",
        image: img("photo-1590658268037-6bf12f032f55"),
        totalSold: 18,
        inventory: 45,
      },
      {
        id: 1002,
        title: "智能运动手表 S3",
        image: img("photo-1523275335684-37898b6baf30"),
        totalSold: 12,
        inventory: 8,
      },
      {
        id: 1003,
        title: "MagSafe 磁吸手机壳",
        image: img("photo-1601784551446-20c9e07cdbdb"),
        totalSold: 9,
        inventory: 120,
      },
      {
        id: 1004,
        title: "10000mAh 迷你充电宝",
        image: img("photo-1609091839311-d5365f9ff1c5"),
        totalSold: 7,
        inventory: 3,
      },
      {
        id: 1005,
        title: "铝合金笔记本支架",
        image: img("photo-1611186871348-b1ce696e52c9"),
        totalSold: 5,
        inventory: 67,
      },
    ],
  },
  {
    domain: "minimal-home-demo.myshopify.com",
    shopName: "MinimalHome",
    currency: "USD",
    products: [
      {
        id: 2001,
        title: "手工陶瓷花瓶",
        image: img("photo-1612196808214-b8e1d6145a8c"),
        totalSold: 8,
        inventory: 15,
      },
      {
        id: 2002,
        title: "亚麻抱枕套 两件装",
        image: img("photo-1616627561950-9f746e330187"),
        totalSold: 6,
        inventory: 32,
      },
      {
        id: 2003,
        title: "天然大豆香薰蜡烛",
        image: img("photo-1603006905003-be475563bc59"),
        totalSold: 5,
        inventory: 5,
      },
      {
        id: 2004,
        title: "胡桃木收纳托盘",
        image: img("photo-1611486212557-88be5ff6f941"),
        totalSold: 4,
        inventory: 2,
      },
      {
        id: 2005,
        title: "极简静音挂钟",
        image: img("photo-1507646227500-4d389b0012be"),
        totalSold: 3,
        inventory: 28,
      },
    ],
  },
];

// ─── Order Generation (deterministic seed) ─────────────────────────

/**
 * Simple seeded PRNG (mulberry32).
 * Ensures demo orders are identical every render / every user.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hourly order count template — simulates real e-commerce traffic */
const HOURLY_WEIGHTS = [
  0, 0, 0, 0, 0, 1,  // 00-05: night
  1, 2, 3, 4, 5,     // 06-10: morning ramp
  4, 3,               // 11-12: lunch dip
  4, 5, 5, 4,         // 13-16: afternoon peak
  3, 4, 5, 4,         // 17-20: evening
  3, 2, 1,            // 21-23: wind down
];

function generateOrders(
  storeIndex: number,
  baseSeed: number,
  scale: number,
): DemoOrder[] {
  const rand = mulberry32(baseSeed);
  const store = DEMO_STORES[storeIndex];
  const products = store.products;
  const orders: DemoOrder[] = [];
  let orderId = (storeIndex + 1) * 10000;

  // Product price lookup
  const priceMap = new Map<number, number>();
  if (storeIndex === 0) {
    priceMap.set(1001, 89.99);
    priceMap.set(1002, 149.99);
    priceMap.set(1003, 29.99);
    priceMap.set(1004, 39.99);
    priceMap.set(1005, 59.99);
  } else {
    priceMap.set(2001, 79.99);
    priceMap.set(2002, 45.99);
    priceMap.set(2003, 32.99);
    priceMap.set(2004, 89.99);
    priceMap.set(2005, 68.99);
  }

  // Financial status distribution: 85% paid, 10% pending, 5% refunded
  function pickStatus(r: number) {
    if (r < 0.85) return "paid";
    if (r < 0.95) return "pending";
    return "refunded";
  }

  const baseDate = new Date("2026-07-01T00:00:00+08:00");

  for (let hour = 0; hour < 24; hour++) {
    const count = HOURLY_WEIGHTS[hour] * scale + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const minute = Math.floor(rand() * 60);
      const second = Math.floor(rand() * 60);
      const date = new Date(baseDate);
      date.setHours(hour, minute, second);

      // Pick 1-2 random products
      const itemCount = rand() > 0.6 ? 2 : 1;
      const picked = new Set<number>();
      const items: DemoOrder["line_items"] = [];

      let total = 0;
      for (let j = 0; j < itemCount; j++) {
        let pid: number;
        do {
          pid = products[Math.floor(rand() * products.length)].id;
        } while (picked.has(pid));
        picked.add(pid);

        const qty = Math.floor(rand() * 2) + 1;
        const price = priceMap.get(pid) ?? 29.99;
        const product = products.find((p) => p.id === pid)!;

        items.push({
          id: orderId * 100 + j,
          product_id: pid,
          name: product.title,
          quantity: qty,
          price: price.toFixed(2),
        });
        total += price * qty;
      }

      orders.push({
        id: orderId++,
        created_at: date.toISOString(),
        total_price: total.toFixed(2),
        financial_status: pickStatus(rand()),
        line_items: items,
      });
    }
  }

  return orders;
}

// ─── Pre-generated order sets ──────────────────────────────────────

/** Store A (TechGear Pro): ~51 orders, ~$6,000 */
export const DEMO_ORDERS_A = generateOrders(0, 42, 2);

/** Store B (MinimalHome): ~26 orders, ~$5,800 (higher unit price) */
export const DEMO_ORDERS_B = generateOrders(1, 99, 1);

// ─── Compute hourly charts (CNY) ──────────────────────────────────

function computeHourlySales(orders: DemoOrder[], rate: number) {
  const buckets = new Array(24).fill(0) as number[];
  for (const o of orders) {
    const beijingHour = (new Date(o.created_at).getUTCHours() + 8) % 24;
    buckets[beijingHour] += parseFloat(o.total_price) * rate;
  }
  return buckets.map((s, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    sales: Math.round(s * 100) / 100,
  }));
}

const EXCHANGE_RATE = 7.25;

export const DEMO_CHARTS_A = computeHourlySales(DEMO_ORDERS_A, EXCHANGE_RATE);
export const DEMO_CHARTS_B = computeHourlySales(DEMO_ORDERS_B, EXCHANGE_RATE);
