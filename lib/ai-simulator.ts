// ─────────────────────────────────────────────────────────────────────────────
// lib/ai-simulator.ts
// 纯前端「AI 引用概率模拟」引擎。
// 原理：模拟 AI 搜索引擎的引用决策三要素 ——
//   语义匹配度(40%) + 结构化数据完整度(35%) + 内容权威度(25%)
// 这不是真正的 AI 调用，而是基于规则与权重的引用概率估算，
// 让卖家在发布前预判商品被 AI 推荐/引用的可能性。
// ─────────────────────────────────────────────────────────────────────────────

/* ─── 词典与常量 ─────────────────────────────────────────────────────────── */

export const SCENE_KEYWORDS: Record<string, string[]> = {
  "运动": ["运动", "健身", "跑步", "训练", "户外", "登山", "骑行", "游泳", "瑜伽"],
  "家居": ["家居", "客厅", "卧室", "厨房", "浴室", "办公桌"],
  "送礼": ["送礼", "礼物", "生日", "节日", "纪念日", "情人节", "圣诞节"],
  "旅行": ["旅行", "出差", "便携", "随身", "轻便"],
  "商务": ["商务", "办公", "会议", "专业", "正装"],
  "音乐": ["音乐", "音质", "hifi", "低音", "高音", "降噪"],
  "游戏": ["游戏", "电竞", "rgb", "机械", "无线"],
};

// 品类同义词：既包含通用品类关键词，也把店铺常见 productType 直接作为 key，
// 使其对应的同义词能被实体抽取命中（如 productType="音频设备" 命中查询中的"耳机"）。
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "耳机": ["耳机", "耳塞", "头戴", "earphone", "headphone", "降噪耳机", "无线耳机"],
  "手表": ["手表", "腕表", "watch", "智能手表", "smartwatch"],
  "音箱": ["音箱", "音响", "扬声器", "speaker", "音响设备"],
  "键盘": ["键盘", "机械键盘", "keyboard"],
  "音频设备": ["音频设备", "耳机", "耳塞", "音箱", "音响", "扬声器", "earphone", "headphone", "speaker", "sound"],
  "可穿戴设备": ["可穿戴设备", "手表", "腕表", "智能手表", "手环", "watch", "wearable", "smartwatch"],
  "电脑外设": ["电脑外设", "键盘", "鼠标", "机械键盘", "keyboard", "mouse"],
  "家居照明": ["家居照明", "台灯", "灯具", "灯", "lamp", "light"],
  "家居纺织品": ["家居纺织品", "抱枕", "枕头", "床品", "pillow", "cushion", "textile"],
  "厨房用品": ["厨房用品", "咖啡", "手冲", "壶", "kettle", "kitchen"],
  "运动健身": ["运动健身", "瑜伽", "健身", "瑜伽垫", "运动", "fitness", "yoga", "sport"],
};

// 属性/特征词典：颜色/尺寸/材质/风格。用于从查询中提取属性词，再与商品标题/描述/变体名交集。
export const ATTRIBUTE_KEYWORDS: Record<string, string[]> = {
  "颜色": ["白色", "黑色", "红色", "蓝色", "绿色", "黄色", "粉色", "灰色", "金色", "银色", "紫色", "橙色"],
  "尺寸": ["大", "小", "迷你", "超大", "m", "l", "xl", "xxl", "s", "均码"],
  "材质": ["棉", "麻", "金属", "铝合金", "碳纤维", "tpe", "硅胶", "不锈钢", "钛", "木", "竹", "皮革", "pu", "塑料", "玻璃", "陶瓷"],
  "风格": ["北欧", "简约", "复古", "运动", "商务", "可爱", "工业"],
};

// 知名品牌词（用于内容权威度「品牌知名度」判定）。含 demo 店铺品牌，确保 demo 可被识别。
export const KNOWN_BRANDS: string[] = [
  "apple", "samsung", "sony", "bose", "anker", "jbl", "sennheiser", "logitech",
  "dyson", "xiaomi", "huawei", "techgear", "keylab", "minimalhome", "brewmaster", "fitlife",
];

// 标题关键词抽取时移除的停用词（中英文）。
const STOPWORDS: string[] = [
  "的", "了", "吗", "呢", "一款", "推荐", "适合", "以内", "以下", "左右", "最好", "什么",
  "哪个", "和", "或", "与", "及", "购买", "指南", "请问", "想", "要", "我", "需要", "有",
  "没有", "可以", "能", "帮", "问", "个", "种", "类", "请", "求", "找", "选", "怎么", "如何",
  "给", "来", "用", "上", "下", "a", "the", "for", "best", "under", "recommend", "good",
  "vs", "and", "or", "to", "of", "with", "buy", "guide", "which", "me", "my", "i",
];

// 语义匹配各维度权重（合计 1.00）
const SEM_WEIGHT: Record<string, number> = {
  category: 0.30,
  brand: 0.15,
  attribute: 0.20,
  scene: 0.15,
  price: 0.10,
  title: 0.10,
};

/* ─── 类型定义 ───────────────────────────────────────────────────────────── */

export interface QueryEntities {
  categories: string[];
  brands: string[];
  priceRange: { min?: number; max?: number } | null;
  attributes: string[];
  scenes: string[];
}

export interface SimulationResult {
  productId: number;
  productTitle: string;
  semanticScore: number;
  semanticMatchedDimensions: string[];
  semanticMissedDimensions: string[];
  schemaCompletenessScore: number;
  schemaMissingTypes: string[];
  schemaMissingFields: string[];
  contentAuthorityScore: number;
  contentAuthorityFactors: Record<string, { actual: number; max: number; message: string }>;
  compositeScore: number;
  rank: number;
  status: "high" | "medium" | "low";
  optimizationSuggestions: Array<{ priority: number; action: string; estimatedImpact: number; linkTo?: string }>;
}

/* ─── 通用工具 ───────────────────────────────────────────────────────────── */

const round1 = (n: number): number => Math.round(n * 10) / 10;

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 999;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function parsePriceFromQuery(query: string): { min?: number; max?: number } | null {
  const q = (query || "").toLowerCase();
  // 区间：100-200 / 100 到 200
  let m = q.match(/(\d+(?:\.\d+)?)\s*(?:-|到|~)\s*(\d+(?:\.\d+)?)/);
  if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
  // 上限：以内 / 以下 / 不超过 / 低于 / under $X
  m = q.match(/(?:以内|以下|不超过|低于|under)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (m) return { max: parseFloat(m[1]) };
  // 左右（带容差）
  m = q.match(/(\d+(?:\.\d+)?)\s*左右/);
  if (m) {
    const n = parseFloat(m[1]);
    return { min: n * 0.8, max: n * 1.2 };
  }
  // 下限：以上 / 超过 X
  m = q.match(/(?:以上|超过)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (m) return { min: parseFloat(m[1]) };
  return null;
}

// 标题关键词重合度：抽取查询中的实义词（CJK 二元组 + 英文单词），与标题做比例匹配。
function titleKeywordFraction(query: string, title: string): number {
  const q = (query || "").toLowerCase();
  const t = (title || "").toLowerCase();
  const tokens: string[] = [];
  const cjk = q.match(/[\u4e00-\u9fff]+/g) || [];
  cjk.forEach((seg) => {
    const cleaned = seg.split("").filter((ch) => !STOPWORDS.includes(ch)).join("");
    for (let i = 0; i < cleaned.length - 1; i++) tokens.push(cleaned.slice(i, i + 2));
  });
  const en = q.match(/[a-z0-9]+/g) || [];
  en.forEach((w) => {
    if (!STOPWORDS.includes(w)) tokens.push(w);
  });
  if (tokens.length === 0) return 0.5; // 无可匹配词时给中性值
  let hit = 0;
  tokens.forEach((tok) => { if (t.includes(tok)) hit++; });
  return hit / tokens.length;
}

// 从商品 metafields 抽取评价数组（兼容 judgeme / yotpo 等常见结构）。
export function extractReviewsFromProduct(product: any): Array<{ rating?: number; body?: string; reviewer?: string }> {
  const mfs: Array<{ key?: string; value?: string }> = product?.metafields || [];
  for (const mf of mfs) {
    if (mf && (mf.key === "reviews" || (mf.key && mf.key.toLowerCase().includes("review"))) && mf.value) {
      try {
        const arr = JSON.parse(mf.value);
        if (Array.isArray(arr) && arr.length) return arr;
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

function priceOf(product: any): number | null {
  const p = product?.variants?.[0]?.price;
  if (p === null || p === undefined || p === "") return null;
  const n = parseFloat(String(p).replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/* ─── 实体抽取 ───────────────────────────────────────────────────────────── */

export function extractEntitiesFromQuery(
  query: string,
  productTypes: string[],
  vendors: string[]
): QueryEntities {
  const q = (query || "").toLowerCase();

  // 品类：productType 自身 + 其同义词命中查询即视为命中
  const categories: string[] = [];
  for (const pt of productTypes) {
    const tokens = [pt.toLowerCase(), ...(CATEGORY_SYNONYMS[pt] || []).map((s) => s.toLowerCase())];
    if (tokens.some((tok) => tok && q.includes(tok))) categories.push(pt);
  }

  // 品牌：vendor 出现在查询中
  const brands: string[] = [];
  for (const v of vendors) {
    if (v && q.includes(v.toLowerCase())) brands.push(v);
  }

  const priceRange = parsePriceFromQuery(query);

  // 属性：颜色/尺寸/材质/风格词典命中
  const attributes: string[] = [];
  for (const grp of Object.keys(ATTRIBUTE_KEYWORDS)) {
    for (const kw of ATTRIBUTE_KEYWORDS[grp]) {
      if (q.includes(kw.toLowerCase())) attributes.push(kw);
    }
  }

  // 场景：预置场景词典命中
  const scenes: string[] = [];
  for (const sc of Object.keys(SCENE_KEYWORDS)) {
    if (SCENE_KEYWORDS[sc].some((k) => q.includes(k.toLowerCase()))) scenes.push(sc);
  }

  return { categories, brands, priceRange, attributes, scenes };
}

/* ─── 3a. 语义匹配度得分（权重 40%） ─────────────────────────────────────── */

export function computeSemanticMatchScore(
  product: any,
  entities: QueryEntities
): { score: number; matchedDimensions: string[]; missedDimensions: string[] } {
  const title = product?.title || "";
  const desc = stripHtml(product?.descriptionHtml || product?.description || "");
  const variantNames = (product?.variants || []).map((v: any) => v?.name || "").join(" ");
  const haystack = (title + " " + desc + " " + variantNames).toLowerCase();

  const evaluated: Array<{ dim: string; matched: boolean }> = [];

  // 品类
  if (entities.categories.length > 0) {
    evaluated.push({ dim: "category", matched: entities.categories.includes(product?.productType) });
  }
  // 品牌
  if (entities.brands.length > 0) {
    evaluated.push({ dim: "brand", matched: entities.brands.includes(product?.vendor) });
  }
  // 属性
  if (entities.attributes.length > 0) {
    const matched = entities.attributes.some((a) => haystack.includes(a.toLowerCase()));
    evaluated.push({ dim: "attribute", matched });
  }
  // 场景
  if (entities.scenes.length > 0) {
    const matched = entities.scenes.some((sc) =>
      SCENE_KEYWORDS[sc].some((k) => haystack.includes(k.toLowerCase()))
    );
    evaluated.push({ dim: "scene", matched });
  }
  // 价格
  if (entities.priceRange) {
    const price = priceOf(product);
    let matched = false;
    if (price !== null) {
      const { min, max } = entities.priceRange;
      const aboveMin = min === undefined ? true : price >= min;
      const belowMax = max === undefined ? true : price <= max;
      matched = aboveMin && belowMax;
    }
    evaluated.push({ dim: "price", matched });
  }
  // 标题关键词（始终评估）
  const tkFrac = titleKeywordFraction(getQueryText(entities), title);
  evaluated.push({ dim: "title", matched: tkFrac > 0.5, _frac: tkFrac } as any);

  let wSum = 0;
  let acc = 0;
  const matchedDimensions: string[] = [];
  const missedDimensions: string[] = [];
  for (const e of evaluated) {
    const w = SEM_WEIGHT[e.dim] || 0;
    wSum += w;
    let contribution = 0;
    if (e.dim === "title") {
      contribution = (e as any)._frac;
    } else {
      contribution = e.matched ? 1 : 0;
    }
    acc += w * contribution;
    if (contribution >= 0.5) matchedDimensions.push(e.dim);
    else missedDimensions.push(e.dim);
  }

  const score = wSum > 0 ? (acc / wSum) * 100 : 0;
  return { score: round1(score), matchedDimensions, missedDimensions };
}

// computeSemanticMatchScore 内部需要原始查询文本来算标题重合度，这里通过闭包外的辅助函数拿回。
// 为保持纯函数签名（product, entities），我们把查询文本暂时挂在 entities 上（不污染导出类型）。
function getQueryText(entities: QueryEntities): string {
  return (entities as any).__query || "";
}

/* ─── 3b. Schema 完整度得分（权重 35%） ──────────────────────────────────── */

export function computeSchemaCompletenessScore(
  product: any
): { score: number; missingSchemas: string[]; missingFields: string[] } {
  const reviews = extractReviewsFromProduct(product);
  const desc = stripHtml(product?.descriptionHtml || product?.description || "");
  const images: any[] = product?.images || (product?.image ? [product.image] : []);
  const variant = product?.variants?.[0];

  // 必填字段（共 40 分，每项约 5.71）
  const requiredChecks: Array<{ name: string; ok: boolean }> = [
    { name: "name", ok: !!product?.title },
    { name: "description", ok: desc.length > 10 },
    { name: "image", ok: images.length > 0 },
    { name: "offers(price)", ok: variant?.price !== null && variant?.price !== undefined && variant?.price !== "" },
    { name: "brand", ok: !!product?.vendor },
    { name: "sku", ok: !!variant?.sku },
    { name: "availability", ok: product?.status !== "DRAFT" && product?.status !== "ARCHIVED" },
  ];
  const requiredMissing = requiredChecks.filter((c) => !c.ok);
  const requiredScore = ((requiredChecks.length - requiredMissing.length) / requiredChecks.length) * 40;

  // 推荐字段（共 30 分，每项 6）
  const recommendedChecks: Array<{ name: string; ok: boolean }> = [
    { name: "aggregateRating", ok: reviews.some((r) => typeof r.rating === "number") },
    { name: "reviewCount", ok: reviews.length > 0 },
    { name: "gtin", ok: hasMetafield(product, ["gtin", "barcode"]) },
    { name: "mpn", ok: hasMetafield(product, ["mpn"]) },
    { name: "additionalImage", ok: images.length > 1 },
  ];
  const recommendedMissing = recommendedChecks.filter((c) => !c.ok);
  const recommendedScore = ((recommendedChecks.length - recommendedMissing.length) / recommendedChecks.length) * 30;

  // 其他 Schema 类型
  const faqOk = hasMetafield(product, ["faq"]) || /faq|常见问题|问[：:].*答[：:]/.test(desc);
  const reviewOk = reviews.length > 0;
  const breadcrumbOk = !!product?.productType || (product?.tags && product.tags.length > 0);

  const faqScore = faqOk ? 15 : 0;
  const reviewScore = reviewOk ? 10 : 0;
  const breadcrumbScore = breadcrumbOk ? 5 : 0;

  const score = requiredScore + recommendedScore + faqScore + reviewScore + breadcrumbScore;

  const missingSchemas: string[] = [];
  if (requiredMissing.length > 0 || recommendedMissing.length > 0) missingSchemas.push("Product");
  if (!faqOk) missingSchemas.push("FAQPage");
  if (!reviewOk) missingSchemas.push("Review");
  if (!breadcrumbOk) missingSchemas.push("BreadcrumbList");

  const missingFields = [...requiredMissing.map((c) => c.name), ...recommendedMissing.map((c) => c.name)];

  return { score: round1(Math.max(0, Math.min(100, score))), missingSchemas, missingFields };
}

function hasMetafield(product: any, keys: string[]): boolean {
  const mfs: Array<{ namespace?: string; key?: string; value?: string }> = product?.metafields || [];
  return mfs.some((m) => m && keys.some((k) => (m.key || "").toLowerCase() === k || (m.key || "").toLowerCase().includes(k)));
}

/* ─── 3c. 内容权威度得分（权重 25%） ─────────────────────────────────────── */

export function computeContentAuthorityScore(
  product: any,
  reviews?: any[]
): {
  score: number;
  factors: Record<string, { actual: number; max: number; message: string }>;
} {
  const rs = reviews && reviews.length ? reviews : extractReviewsFromProduct(product);
  const desc = stripHtml(product?.descriptionHtml || product?.description || "");
  const descLen = desc.length;
  const images: any[] = product?.images || (product?.image ? [product.image] : []);
  const imgCount = images.length;
  const reviewCount = rs.length;
  const vendor = (product?.vendor || "").toLowerCase();
  const brandKnown = KNOWN_BRANDS.some((b) => vendor.includes(b));
  const days = daysSince(product?.updated_at || product?.updatedAt);
  const descText = (product?.descriptionHtml || product?.description || "").toLowerCase();
  const hasVideo = /<video|<iframe|youtube|youtu\.be|vimeo/.test(descText) || hasMetafield(product, ["video", "product_video"]);
  const hasSpecTable = /规格|参数表|specification|尺寸表/.test(desc) || hasMetafield(product, ["spec", "size_chart"]);

  const descActual = Math.min(descLen / 300, 1) * 30;
  const imgActual = Math.min(imgCount / 5, 1) * 20;
  const reviewActual = Math.min(reviewCount / 20, 1) * 20;
  const brandActual = brandKnown ? 10 : 0;
  const freshActual = days <= 0 ? 10 : Math.min(30 / days, 1) * 10;
  const mediaActual = (hasVideo ? 5 : 0) + (hasSpecTable ? 5 : 0);

  const factors: Record<string, { actual: number; max: number; message: string }> = {
    description: { actual: round1(descActual), max: 30, message: `描述字数 ${descLen}（目标 ≥300）` },
    images: { actual: round1(imgActual), max: 20, message: `图片 ${imgCount} 张（目标 ≥5）` },
    reviews: { actual: round1(reviewActual), max: 20, message: `评价 ${reviewCount} 条（目标 ≥20）` },
    brand: { actual: brandActual, max: 10, message: brandKnown ? `品牌「${product?.vendor}」已识别` : `品牌未识别，建议强化品牌词` },
    freshness: { actual: round1(freshActual), max: 10, message: days > 900 ? `无更新时间` : `更新于 ${days} 天前（目标 ≤30）` },
    multimedia: { actual: mediaActual, max: 10, message: `${hasVideo ? "含视频" : "无视频"}+${hasSpecTable ? "含规格表" : "无规格表"}` },
  };

  const score = descActual + imgActual + reviewActual + brandActual + freshActual + mediaActual;
  return { score: round1(Math.max(0, Math.min(100, score))), factors };
}

/* ─── 优化建议生成 ───────────────────────────────────────────────────────── */

function buildOptimizationSuggestions(
  product: any,
  sem: { matchedDimensions: string[]; missedDimensions: string[] },
  schema: { score: number; missingSchemas: string[]; missingFields: string[] },
  auth: { factors: Record<string, { actual: number; max: number; message: string }> },
  entities: QueryEntities
): Array<{ priority: number; action: string; estimatedImpact: number; linkTo?: string }> {
  const candidates: Array<{ action: string; estimatedImpact: number; linkTo?: string }> = [];

  // 语义维度缺失
  const semImpact: Record<string, number> = {
    category: Math.round(SEM_WEIGHT.category * 0.4 * 100),
    brand: Math.round(SEM_WEIGHT.brand * 0.4 * 100),
    attribute: Math.round(SEM_WEIGHT.attribute * 0.4 * 100),
    scene: Math.round(SEM_WEIGHT.scene * 0.4 * 100),
    price: Math.round(SEM_WEIGHT.price * 0.4 * 100),
    title: Math.round(SEM_WEIGHT.title * 0.4 * 100),
  };
  const semAction: Record<string, (e: QueryEntities) => string> = {
    category: (e) => `在商品标题/描述中加入品类词「${e.categories.join("、") || "相关品类"}」`,
    brand: (e) => `在描述中强化品牌「${e.brands.join("、") || "本店品牌"}」`,
    attribute: () => `在描述中加入属性词（颜色/尺寸/材质），提升特征匹配`,
    scene: (e) => `在描述中补充场景词（如「${e.scenes.join("、") || "使用场景"}」）`,
    price: () => `在标题/描述中明确标注价格区间，匹配查询预算`,
    title: () => `优化商品标题，提升与查询关键词的重合度`,
  };
  for (const dim of sem.missedDimensions) {
    candidates.push({
      action: semAction[dim](entities) + ` (+${semImpact[dim]}%)`,
      estimatedImpact: semImpact[dim],
      linkTo: "product-control",
    });
  }

  // Schema 缺失
  const reqMissing = schema.missingFields.filter((f) => ["name", "description", "image", "offers(price)", "brand", "sku", "availability"].includes(f)).length;
  const recMissing = schema.missingFields.filter((f) => ["aggregateRating", "reviewCount", "gtin", "mpn", "additionalImage"].includes(f)).length;
  if (reqMissing > 0) {
    candidates.push({ action: `补充 Product Schema 必填字段（name/description/price/image/brand/sku）(+${Math.round(reqMissing * (40 / 7) * 0.35)}%)`, estimatedImpact: Math.round(reqMissing * (40 / 7) * 0.35), linkTo: "schema-generator" });
  }
  if (recMissing > 0) {
    candidates.push({ action: `完善 Product Schema 推荐字段（评分/评价数/gtin/mpn/多图）(+${Math.round(recMissing * 6 * 0.35)}%)`, estimatedImpact: Math.round(recMissing * 6 * 0.35), linkTo: "schema-generator" });
  }
  if (schema.missingSchemas.includes("FAQPage")) {
    candidates.push({ action: `为商品添加 FAQPage Schema (+${Math.round(15 * 0.35)}%)`, estimatedImpact: Math.round(15 * 0.35), linkTo: "schema-generator" });
  }
  if (schema.missingSchemas.includes("Review")) {
    candidates.push({ action: `添加 Review Schema（需先积累评价数据）(+${Math.round(10 * 0.35)}%)`, estimatedImpact: Math.round(10 * 0.35), linkTo: "schema-generator" });
  }
  if (schema.missingSchemas.includes("BreadcrumbList")) {
    candidates.push({ action: `添加 BreadcrumbList Schema (+${Math.round(5 * 0.35)}%)`, estimatedImpact: Math.round(5 * 0.35), linkTo: "schema-generator" });
  }

  // 内容权威度缺失
  const f = auth.factors;
  const pushFactor = (key: string, action: (msg: string) => string, linkTo?: string) => {
    const deficit = (f[key]?.max || 0) - (f[key]?.actual || 0);
    if (deficit > 0.5) {
      candidates.push({ action: action(f[key]?.message || "") + ` (+${Math.round(deficit * 0.25)}%)`, estimatedImpact: Math.round(deficit * 0.25), linkTo });
    }
  };
  pushFactor("description", (m) => `扩充商品描述至 300 字以上（${m}）`, "product-control");
  pushFactor("images", (m) => `上传更多图片至 5 张以上（${m}）`, "product-control");
  pushFactor("reviews", (m) => `积累更多评价至 20 条以上（${m}）`, "product-control");
  pushFactor("brand", () => `提升品牌辨识度，在描述中突出品牌名`, "product-control");
  pushFactor("freshness", (m) => `更新商品信息（${m}）`, "content-pages");
  pushFactor("multimedia", () => `补充视频或规格参数表，提升多媒体丰富度`, "product-control");

  candidates.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  return candidates.slice(0, 8).map((c, i) => ({ priority: i + 1, action: c.action, estimatedImpact: c.estimatedImpact, linkTo: c.linkTo }));
}

/* ─── 单商品模拟 ─────────────────────────────────────────────────────────── */

export function simulateAICitation(
  product: any,
  query: string,
  productTypes: string[],
  vendors: string[],
  reviews?: any[]
): SimulationResult {
  // 把查询文本临时挂在 entities 上，供 computeSemanticMatchScore 计算标题重合度
  const entities = extractEntitiesFromQuery(query, productTypes, vendors) as QueryEntities & { __query?: string };
  (entities as any).__query = query;

  const sem = computeSemanticMatchScore(product, entities);
  const schema = computeSchemaCompletenessScore(product);
  const auth = computeContentAuthorityScore(product, reviews);

  const composite = round1(sem.score * 0.4 + schema.score * 0.35 + auth.score * 0.25);
  const status: "high" | "medium" | "low" = composite >= 70 ? "high" : composite >= 40 ? "medium" : "low";

  const suggestions = buildOptimizationSuggestions(product, sem, schema, auth, entities);

  return {
    productId: product?.id,
    productTitle: product?.title || "",
    semanticScore: sem.score,
    semanticMatchedDimensions: sem.matchedDimensions,
    semanticMissedDimensions: sem.missedDimensions,
    schemaCompletenessScore: schema.score,
    schemaMissingTypes: schema.missingSchemas,
    schemaMissingFields: schema.missingFields,
    contentAuthorityScore: auth.score,
    contentAuthorityFactors: auth.factors,
    compositeScore: composite,
    rank: 0,
    status,
    optimizationSuggestions: suggestions,
  };
}

/* ─── 全店批量模拟（返回已排序、已排名结果） ────────────────────────────── */

export function simulateAllProducts(
  products: any[],
  query: string,
  productTypes: string[],
  vendors: string[]
): SimulationResult[] {
  const results = (products || []).map((p) => simulateAICitation(p, query, productTypes, vendors));
  results.sort((a, b) => b.compositeScore - a.compositeScore);
  results.forEach((r, i) => { r.rank = i + 1; });
  return results;
}

/* ─── 工具：从商品列表派生品类/品牌词表 ─────────────────────────────────── */

export function deriveProductTypes(products: any[]): string[] {
  const set = new Set<string>();
  (products || []).forEach((p) => { if (p?.productType) set.add(p.productType); });
  return Array.from(set);
}

export function deriveVendors(products: any[]): string[] {
  const set = new Set<string>();
  (products || []).forEach((p) => { if (p?.vendor) set.add(p.vendor); });
  return Array.from(set);
}
