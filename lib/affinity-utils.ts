/* ─── Product Affinity / Association Rules ────────────── */

export interface Cooccurrence {
  productA: string; productB: string;
  abCount: number;         // 共现次数
  aCount: number;          // A 出现次数
  bCount: number;          // B 出现次数
  totalOrders: number;     // 总订单数
  confidence: number;      // P(B|A) = abCount / aCount
  lift: number;            // confidence / (bCount / totalOrders)
  support: number;         // abCount / totalOrders
}

export interface BundleSuggestion {
  products: string[]; originalTotal: number; bundledPrice: number;
  historicalCooccurrence: number; estimatedSales: number;
  bundleGMV: number; incrementalProfit: number;
}

type OrderInput = { line_items: Array<{ title: string; product_id: number; quantity: number; price: string }> };

/** Build co-occurrence from orders */
export function computeAffinity(
  orders: OrderInput[],
  productTitles: Map<number, string>,
): Cooccurrence[] {
  // Count item occurrences
  const itemCount: Record<string, number> = {};

  // Co-occurrence map: "A || B" → count
  const pairMap: Record<string, number> = {};

  for (const o of orders) {
    const items = (o.line_items || []).map(function (li) {
      return productTitles.get(li.product_id) || "Product-" + li.product_id;
    });

    // Count each item
    for (const title of items) {
      itemCount[title] = (itemCount[title] || 0) + 1;
    }

    // Count each pair (unique per order)
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const aName = items[i];
        const bName = items[j];
        var key = "";
        if (aName < bName) key = aName + " || " + bName;
        else key = bName + " || " + aName;
        if (!seen.has(key)) {
          seen.add(key);
          pairMap[key] = (pairMap[key] || 0) + 1;
        }
      }
    }
  }

  const total = orders.length;
  const rules: Cooccurrence[] = [];

  for (const [key, abCount] of Object.entries(pairMap)) {
    var parts = key.split(" || ");
    if (parts.length !== 2) continue;
    const aTitle = parts[0];
    const bTitle = parts[1];
    const aCount = itemCount[aTitle] || 1;
    const bCount = itemCount[bTitle] || 1;

    const confAB = abCount / aCount;
    const confBA = abCount / bCount;
    const support = abCount / total;
    const liftAB = confAB / ((bCount / total) || 0.001);
    const liftBA = confBA / ((aCount / total) || 0.001);

    // Keep the direction with higher confidence
    if (confAB >= confBA) {
      rules.push({ productA: aTitle, productB: bTitle, abCount, aCount, bCount, totalOrders: total, confidence: confAB, lift: liftAB, support });
    } else {
      rules.push({ productA: bTitle, productB: aTitle, abCount, aCount: bCount, bCount: aCount, totalOrders: total, confidence: confBA, lift: liftBA, support });
    }
  }

  // Only 1 rule per pair
  return rules.filter(function (r) { return r.abCount >= 2; }).sort(function (a, b) { return b.lift - a.lift; });
}

/** Simulate bundle pricing */
export function suggestBundle(rules: Cooccurrence[], discount: number): BundleSuggestion[] {
  return rules.slice(0, 5).map(function (r) {
    const origTotal = 100; // placeholder
    const bundled = Math.round(origTotal * discount * 100) / 100;
    const estSales = Math.round(r.abCount * (1 + (1 - discount) * 2));
    return {
      products: [r.productA, r.productB], originalTotal: origTotal, bundledPrice: bundled,
      historicalCooccurrence: r.abCount, estimatedSales: estSales,
      bundleGMV: Math.round(bundled * estSales * 100) / 100,
      incrementalProfit: Math.round((bundled * estSales - origTotal * r.abCount * 0.3) * 100) / 100,
    };
  });
}

/** Demo data helper */
export function generateDemoRules(): Cooccurrence[] {
  const pairs = [
    ["无线降噪耳机", "耳机保护套", 42, 85, 60],
    ["智能手表 S3", "替换表带", 28, 55, 35],
    ["北欧台灯", "LED 灯泡", 18, 40, 50],
    ["机械键盘 K8", "掌托", 15, 30, 20],
    ["AR 护目镜", "清洁布套装", 12, 22, 18],
    ["智能水杯", "替换滤芯", 8, 15, 12],
    ["碳纤维手表", "手表收纳盒", 22, 45, 38],
    ["运动手环", "替换腕带", 16, 32, 25],
    ["无线耳机", "USB-C 充电线", 10, 85, 70],
    ["北欧台灯", "智能灯泡", 6, 40, 15],
    ["机械键盘 K8", "键帽套装", 9, 30, 22],
    ["碳纤维手表", "表带工具", 7, 45, 10],
  ];
  const totalOrd = 200;

  return pairs.map(function (p) {
    const abCount = p[2] as number;
    const aCount = p[3] as number;
    const bCount = p[4] as number;
    const conf = abCount / aCount;
    const lift = conf / ((bCount / totalOrd) || 0.001);
    const sup = abCount / totalOrd;
    return {
      productA: p[0] as string, productB: p[1] as string,
      abCount, aCount, bCount, totalOrders: totalOrd,
      confidence: Math.round(conf * 100) / 100,
      lift: Math.round(lift * 10) / 10,
      support: Math.round(sup * 100) / 100,
    };
  }).sort(function (a, b) { return b.lift - a.lift; });
}
