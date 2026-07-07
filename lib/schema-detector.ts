// ─────────────────────────────────────────────────────────────────────────────
// lib/schema-detector.ts
// GEO（Generative Engine Optimization）结构化数据审计工具模块
// 纯客户端、零服务端依赖：基于 Shopify Admin API 已返回的数据评估
// 各页面是否具备生成合规 Schema.org JSON-LD 的字段条件，并生成可注入的 JSON-LD。
// ─────────────────────────────────────────────────────────────────────────────

/* ─── 核心类型 ──────────────────────────────────────────── */

/** 单个 Schema 字段的定义（含权重与影响的 AI 搜索场景） */
export interface SchemaField {
  /** 字段名（人工可读） */
  name: string;
  /** 是否为必填字段（决定页面是否「完整覆盖」该类型） */
  required: boolean;
  /** JSON-LD 中的路径，如 offers.price */
  path: string;
  /** 缺失该字段会影响的 AI 搜索/摘要场景 */
  affectedAIScenario: string;
  /** 该字段在所属类型内的权重（必填字段合计 = 1.0，推荐字段为附加分） */
  weight: number;
}

/** 一种 Schema.org 类型的定义 */
export interface SchemaType {
  /** 类型标识，如 Product、Review */
  type: string;
  /** 中文标题 */
  title: string;
  /** 适用页面说明 */
  applicablePages: string;
  /** 该类型包含的字段 */
  fields: SchemaField[];
  /** 该类型对全站健康分的贡献权重（0~1，全部类型合计 = 1.0） */
  weight: number;
}

/** 单个页面的缺失字段记录 */
export interface MissingFieldEntry {
  pageId: number;
  pageTitle: string;
  pageUrl: string;
  missingFieldNames: string[];
  affectedScenarios: string[];
}

/** 单个类型的审计结果 */
export interface SchemaAuditResult {
  schemaType: string;
  title: string;
  /** 参与审计的页面总数 */
  totalPages: number;
  /** 完全覆盖（必填字段全齐）的页面数 */
  coveredPages: number;
  /** 覆盖率 0~1（按必填字段加权求平均，含部分覆盖） */
  coverageRate: number;
  /** 该类型下所有页面的缺失字段明细 */
  missingFields: MissingFieldEntry[];
  /** 该类型的健康分 0~1（= coverageRate） */
  healthScore: number;
}

/* ─── 归一化输入类型（由面板从 DashboardData 映射而来） ──────────── */

export interface NormalizedProduct {
  id: number;
  title: string;
  handle: string;
  descriptionHtml: string;
  image: string | null;
  productType: string;
  vendor: string;
  status: string;
  sku: string | null;
  price: number | null;
  currency: string;
  availability: string | null;
  brand: string | null;
  ratingValue: number | null;
  reviewCount: number | null;
  hasReviews: boolean;
  url: string | null;
  gtin: string | null;
  mpn: string | null;
}

export interface NormalizedContent {
  id: number;
  title: string;
  handle: string;
  bodyHtml: string;
  publishedAt: string | null;
  author: string | null;
}

export interface AuditInput {
  shopName: string;
  domain: string;
  products: NormalizedProduct[];
  pages: NormalizedContent[];
  articles: NormalizedContent[];
}

/* ─── Schema 类型目录（11 种，权重合计 100%） ───────────────────
 * 权重分配遵循产品需求：
 *   Product 30% / Review 20% / FAQPage 15% / BreadcrumbList 10% /
 *   Organization 10% / Article 5% / 其余 5 类各 2%
 * ───────────────────────────────────────────────────────────── */
export const SCHEMA_TYPES: SchemaType[] = [
  {
    type: "Product",
    title: "商品 Product",
    applicablePages: "所有商品详情页",
    weight: 0.30,
    fields: [
      { name: "商品名称 name", required: true, path: "name", affectedAIScenario: "商品被 AI 问答直接引用为答案", weight: 0.12 },
      { name: "商品描述 description", required: true, path: "description", affectedAIScenario: "卖点/规格被 AI 摘要抓取", weight: 0.14 },
      { name: "商品主图 image", required: true, path: "image", affectedAIScenario: "视觉搜索与富媒体结果展示", weight: 0.12 },
      { name: "库存单位 sku", required: true, path: "sku", affectedAIScenario: "跨平台商品唯一匹配", weight: 0.10 },
      { name: "售价 offers.price", required: true, path: "offers.price", affectedAIScenario: "价格被比价/购物类 AI 引用", weight: 0.18 },
      { name: "货币 offers.priceCurrency", required: true, path: "offers.priceCurrency", affectedAIScenario: "货币识别，避免报价错位", weight: 0.06 },
      { name: "可售状态 offers.availability", required: true, path: "offers.availability", affectedAIScenario: "可购买性判断（库存状态）", weight: 0.10 },
      { name: "品牌 brand", required: false, path: "brand.name", affectedAIScenario: "品牌知识图谱联想", weight: 0.05 },
      { name: "评分 aggregateRating.ratingValue", required: false, path: "aggregateRating.ratingValue", affectedAIScenario: "评分影响购买决策 AI", weight: 0.05 },
      { name: "评论数 aggregateRating.reviewCount", required: false, path: "aggregateRating.reviewCount", affectedAIScenario: "评论数可信度背书", weight: 0.04 },
      { name: "用户评价 review", required: false, path: "review", affectedAIScenario: "真实评价被摘要引用", weight: 0.04 },
      { name: "规范链接 url", required: false, path: "url", affectedAIScenario: "来源归因与去重", weight: 0.03 },
      { name: "全球贸易标识 gtin/mpn", required: false, path: "gtin13|mpn", affectedAIScenario: "跨平台商品匹配（Google 购物）", weight: 0.03 },
    ],
  },
  {
    type: "Review",
    title: "评价 Review",
    applicablePages: "含用户评价的商品页",
    weight: 0.20,
    fields: [
      { name: "评分 ratingValue", required: true, path: "review.reviewRating.ratingValue", affectedAIScenario: "评分被 AI 综述引用", weight: 0.40 },
      { name: "评价作者 author.name", required: true, path: "review.author.name", affectedAIScenario: "评价来源可信度", weight: 0.20 },
      { name: "评价正文 reviewBody", required: true, path: "review.reviewBody", affectedAIScenario: "真实体验被摘要", weight: 0.40 },
    ],
  },
  {
    type: "FAQPage",
    title: "问答 FAQPage",
    applicablePages: "含 FAQ 的内容/博客页",
    weight: 0.15,
    fields: [
      { name: "问答对 mainEntity", required: true, path: "mainEntity", affectedAIScenario: "直接命中「XX 是什么/怎么用」类提问", weight: 0.60 },
      { name: "问题 name", required: true, path: "mainEntity.name", affectedAIScenario: "问题匹配用户搜索意图", weight: 0.20 },
      { name: "答案 acceptedAnswer.text", required: true, path: "mainEntity.acceptedAnswer.text", affectedAIScenario: "答案被 AI 直接朗读/引用", weight: 0.20 },
    ],
  },
  {
    type: "BreadcrumbList",
    title: "面包屑 BreadcrumbList",
    applicablePages: "商品页与内容页",
    weight: 0.10,
    fields: [
      { name: "路径 itemListElement", required: true, path: "itemListElement", affectedAIScenario: "站点层级被 AI 理解，提升内页曝光", weight: 0.50 },
      { name: "节点名称 name", required: true, path: "itemListElement.name", affectedAIScenario: "层级名称语义化", weight: 0.25 },
      { name: "节点链接 item", required: true, path: "itemListElement.item", affectedAIScenario: "可跳转来源链接", weight: 0.25 },
    ],
  },
  {
    type: "Organization",
    title: "组织 Organization",
    applicablePages: "全站（站级）",
    weight: 0.10,
    fields: [
      { name: "名称 name", required: true, path: "name", affectedAIScenario: "品牌实体被知识面板收录", weight: 0.35 },
      { name: "官网 url", required: true, path: "url", affectedAIScenario: "官网权威性背书", weight: 0.35 },
      { name: "Logo logo", required: true, path: "logo", affectedAIScenario: "品牌视觉在 AI 结果中出现", weight: 0.30 },
    ],
  },
  {
    type: "Article",
    title: "文章 Article",
    applicablePages: "页面与博客文章",
    weight: 0.05,
    fields: [
      { name: "标题 headline", required: true, path: "headline", affectedAIScenario: "文章被 AI 资讯聚合引用", weight: 0.30 },
      { name: "作者 author", required: true, path: "author.name", affectedAIScenario: "作者权威背书（E-E-A-T）", weight: 0.20 },
      { name: "发布时间 datePublished", required: true, path: "datePublished", affectedAIScenario: "时效性与新鲜度信号", weight: 0.25 },
      { name: "正文 articleBody", required: true, path: "articleBody", affectedAIScenario: "正文内容被摘要", weight: 0.25 },
    ],
  },
  {
    type: "AggregateRating",
    title: "综合评分 AggregateRating",
    applicablePages: "有评分的商品页",
    weight: 0.02,
    fields: [
      { name: "平均评分 ratingValue", required: true, path: "aggregateRating.ratingValue", affectedAIScenario: "星标富媒体展示", weight: 0.50 },
      { name: "评论总数 reviewCount", required: true, path: "aggregateRating.reviewCount", affectedAIScenario: "评论规模可信度", weight: 0.50 },
    ],
  },
  {
    type: "Offer",
    title: "报价 Offer",
    applicablePages: "商品页报价区",
    weight: 0.02,
    fields: [
      { name: "价格 price", required: true, path: "offers.price", affectedAIScenario: "购物类 AI 比价", weight: 0.40 },
      { name: "货币 priceCurrency", required: true, path: "offers.priceCurrency", affectedAIScenario: "货币识别", weight: 0.20 },
      { name: "可售状态 availability", required: true, path: "offers.availability", affectedAIScenario: "库存状态", weight: 0.20 },
      { name: "商品链接 url", required: true, path: "offers.url", affectedAIScenario: "来源链接归因", weight: 0.20 },
    ],
  },
  {
    type: "VideoObject",
    title: "视频 VideoObject",
    applicablePages: "含视频的商品/内容页",
    weight: 0.02,
    fields: [
      { name: "名称 name", required: true, path: "name", affectedAIScenario: "视频被 AI 视频搜索收录", weight: 0.30 },
      { name: "描述 description", required: true, path: "description", affectedAIScenario: "视频内容摘要", weight: 0.30 },
      { name: "播放地址 contentUrl/embedUrl", required: true, path: "contentUrl", affectedAIScenario: "可播放来源", weight: 0.40 },
    ],
  },
  {
    type: "WebSite",
    title: "站点 WebSite",
    applicablePages: "全站（站级）",
    weight: 0.02,
    fields: [
      { name: "名称 name", required: true, path: "name", affectedAIScenario: "站点实体识别", weight: 0.40 },
      { name: "地址 url", required: true, path: "url", affectedAIScenario: "站点主页归因", weight: 0.30 },
      { name: "站内搜索 potentialAction", required: true, path: "potentialAction", affectedAIScenario: "Sitelinks 搜索框（品牌词直达）", weight: 0.30 },
    ],
  },
  {
    type: "LocalBusiness",
    title: "本地商家 LocalBusiness",
    applicablePages: "全站（站级）",
    weight: 0.02,
    fields: [
      { name: "名称 name", required: true, path: "name", affectedAIScenario: "本地实体被地图/本地 AI 收录", weight: 0.40 },
      { name: "地址 address", required: true, path: "address", affectedAIScenario: "实体位置可信度", weight: 0.40 },
      { name: "电话 telephone", required: true, path: "telephone", affectedAIScenario: "联系方式展示", weight: 0.20 },
    ],
  },
];

/* ─── 工具函数 ──────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasVideo(html: string): boolean {
  if (!html) return false;
  return /<video[\s>]|youtube\.com|youtu\.be|vimeo\.com|<iframe/gi.test(html);
}

/** 粗略检测内容中是否存在 FAQ 式问答结构（>=2 个带问号的标题） */
function hasFaqStructure(html: string): boolean {
  if (!html) return false;
  const headings = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || [];
  let qCount = 0;
  for (const h of headings) {
    const text = stripHtml(h);
    if (text.includes("?") || text.includes("？")) qCount++;
    if (qCount >= 2) return true;
  }
  return false;
}

/** 粗略检测内容中是否存在步骤列表（<ol> 含 >=2 <li>） */
function hasHowToSteps(html: string): boolean {
  if (!html) return false;
  const ol = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
  if (!ol) return false;
  for (const list of ol) {
    const items = list.match(/<li[^>]*>/gi) || [];
    if (items.length >= 2) return true;
  }
  return false;
}

function availabilityFromStatus(status: string, hasInventory: boolean): string {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return hasInventory ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  if (s === "DRAFT") return "https://schema.org/PreOrder";
  if (s === "ARCHIVED") return "https://schema.org/Discontinued";
  return "https://schema.org/InStock";
}

/* ─── JSON-LD 解析（用于从 HTML 提取已有结构化数据） ──────────── */

const JSON_LD_REGEX = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * 从 HTML 字符串中提取所有 application/ld+json 块并解析为对象数组。
 * 支持 @graph 展开、单对象与数组两种写法。
 */
export function extractJsonLdBlocks(html: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  if (!html) return blocks;
  let m: RegExpExecArray | null;
  JSON_LD_REGEX.lastIndex = 0;
  while ((m = JSON_LD_REGEX.exec(html)) !== null) {
    const raw = m[1];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) blocks.push(item);
      } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).graph)) {
        for (const item of (parsed as any).graph) blocks.push(item);
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // 忽略无法解析的坏块
    }
  }
  return blocks;
}

/* ─── 审计主逻辑 ────────────────────────────────────────── */

interface PageEval {
  id: number;
  title: string;
  url: string;
  /** 该页面对每种类型缺失的字段名列表 */
  missingByType: Record<string, string[]>;
  /** 该页面已有的字段路径集合（用于生成预览） */
  presentByType: Record<string, Set<string>>;
}

function evaluateProductPages(products: NormalizedProduct[], domain: string): PageEval[] {
  return products.map((p) => {
    const url = `https://${domain}/products/${p.handle}`;
    const missing: Record<string, string[]> = {};
    const present: Record<string, Set<string>> = {};
    const ensure = (t: string) => { if (!missing[t]) missing[t] = []; if (!present[t]) present[t] = new Set(); };

    // Product
    ensure("Product");
    if (!p.title) { missing["Product"].push("name"); } else present["Product"].add("name");
    if (!stripHtml(p.descriptionHtml)) { missing["Product"].push("description"); } else present["Product"].add("description");
    if (!p.image) { missing["Product"].push("image"); } else present["Product"].add("image");
    if (!p.sku) { missing["Product"].push("sku"); } else present["Product"].add("sku");
    if (p.price === null || p.price === undefined) { missing["Product"].push("offers.price"); } else present["Product"].add("offers.price");
    if (!p.currency) { missing["Product"].push("offers.priceCurrency"); } else present["Product"].add("offers.priceCurrency");
    if (!p.availability) { missing["Product"].push("offers.availability"); } else present["Product"].add("offers.availability");
    if (p.brand) present["Product"].add("brand.name");
    if (p.ratingValue !== null) present["Product"].add("aggregateRating.ratingValue");
    if (p.reviewCount !== null) present["Product"].add("aggregateRating.reviewCount");
    if (p.hasReviews) present["Product"].add("review");
    if (p.url) present["Product"].add("url");
    if (p.gtin || p.mpn) present["Product"].add("gtin13|mpn");

    // Review
    ensure("Review");
    if (p.hasReviews) { present["Review"].add("review.reviewRating.ratingValue"); present["Review"].add("review.author.name"); present["Review"].add("review.reviewBody"); }
    else { missing["Review"].push("review.reviewRating.ratingValue"); missing["Review"].push("review.author.name"); missing["Review"].push("review.reviewBody"); }

    // AggregateRating
    ensure("AggregateRating");
    if (p.ratingValue !== null && p.reviewCount !== null) { present["AggregateRating"].add("aggregateRating.ratingValue"); present["AggregateRating"].add("aggregateRating.reviewCount"); }
    else { missing["AggregateRating"].push("aggregateRating.ratingValue"); missing["AggregateRating"].push("aggregateRating.reviewCount"); }

    // Offer
    ensure("Offer");
    if (p.price === null) missing["Offer"].push("offers.price"); else present["Offer"].add("offers.price");
    if (!p.currency) missing["Offer"].push("offers.priceCurrency"); else present["Offer"].add("offers.priceCurrency");
    if (!p.availability) missing["Offer"].push("offers.availability"); else present["Offer"].add("offers.availability");
    present["Offer"].add("offers.url");

    // BreadcrumbList
    ensure("BreadcrumbList");
    if (p.productType || p.vendor) { present["BreadcrumbList"].add("itemListElement"); present["BreadcrumbList"].add("itemListElement.name"); present["BreadcrumbList"].add("itemListElement.item"); }
    else { missing["BreadcrumbList"].push("itemListElement"); missing["BreadcrumbList"].push("itemListElement.name"); missing["BreadcrumbList"].push("itemListElement.item"); }

    // VideoObject
    ensure("VideoObject");
    if (hasVideo(p.descriptionHtml)) { present["VideoObject"].add("name"); present["VideoObject"].add("description"); present["VideoObject"].add("contentUrl"); }
    else { missing["VideoObject"].push("name"); missing["VideoObject"].push("description"); missing["VideoObject"].push("contentUrl"); }

    return { id: p.id, title: p.title, url, missingByType: missing, presentByType: present };
  });
}

function evaluateContentPages(items: NormalizedContent[], domain: string, base: string): PageEval[] {
  return items.map((c) => {
    const url = `https://${domain}/${base}/${c.handle}`;
    const missing: Record<string, string[]> = {};
    const present: Record<string, Set<string>> = {};
    const ensure = (t: string) => { if (!missing[t]) missing[t] = []; if (!present[t]) present[t] = new Set(); };

    const bodyLen = stripHtml(c.bodyHtml).length;

    // Article
    ensure("Article");
    if (c.title) present["Article"].add("headline"); else missing["Article"].push("headline");
    if (c.author) present["Article"].add("author.name"); else missing["Article"].push("author.name");
    if (c.publishedAt) present["Article"].add("datePublished"); else missing["Article"].push("datePublished");
    if (bodyLen > 0) present["Article"].add("articleBody"); else missing["Article"].push("articleBody");

    // FAQPage
    ensure("FAQPage");
    if (hasFaqStructure(c.bodyHtml)) { present["FAQPage"].add("mainEntity"); present["FAQPage"].add("mainEntity.name"); present["FAQPage"].add("mainEntity.acceptedAnswer.text"); }
    else { missing["FAQPage"].push("mainEntity"); missing["FAQPage"].push("mainEntity.name"); missing["FAQPage"].push("mainEntity.acceptedAnswer.text"); }

    // BreadcrumbList
    ensure("BreadcrumbList");
    if (c.handle) { present["BreadcrumbList"].add("itemListElement"); present["BreadcrumbList"].add("itemListElement.name"); present["BreadcrumbList"].add("itemListElement.item"); }
    else { missing["BreadcrumbList"].push("itemListElement"); }

    // VideoObject
    ensure("VideoObject");
    if (hasVideo(c.bodyHtml)) { present["VideoObject"].add("name"); present["VideoObject"].add("description"); present["VideoObject"].add("contentUrl"); }
    else { missing["VideoObject"].push("name"); missing["VideoObject"].push("description"); missing["VideoObject"].push("contentUrl"); }

    // HowTo (复用 VideoObject 页面评估，但单独计为 HowTo 类型)
    ensure("HowTo");
    if (hasHowToSteps(c.bodyHtml)) { present["HowTo"].add("name"); present["HowTo"].add("step"); }
    else { missing["HowTo"].push("name"); missing["HowTo"].push("step"); }

    return { id: c.id, title: c.title, url, missingByType: missing, presentByType: present };
  });
}

function evaluateSiteLevel(shopName: string, domain: string): PageEval[] {
  const url = `https://${domain}`;
  const missing: Record<string, string[]> = {};
  const present: Record<string, Set<string>> = {};
  const ensure = (t: string) => { if (!missing[t]) missing[t] = []; if (!present[t]) present[t] = new Set(); };

  // Organization
  ensure("Organization");
  if (shopName) present["Organization"].add("name"); else missing["Organization"].push("name");
  if (domain) present["Organization"].add("url"); else missing["Organization"].push("url");
  missing["Organization"].push("logo"); // 纯本地无法获知 Logo URL

  // WebSite
  ensure("WebSite");
  if (shopName) present["WebSite"].add("name"); else missing["WebSite"].push("name");
  if (domain) present["WebSite"].add("url"); else missing["WebSite"].push("url");
  missing["WebSite"].push("potentialAction"); // 站内搜索框通常未配置

  // LocalBusiness
  ensure("LocalBusiness");
  if (shopName) present["LocalBusiness"].add("name"); else missing["LocalBusiness"].push("name");
  missing["LocalBusiness"].push("address");
  missing["LocalBusiness"].push("telephone");

  return [{ id: 0, title: `站点级 (${shopName})`, url, missingByType: missing, presentByType: present }];
}

/** 运行全站 Schema 审计，返回每种类型的结果 */
export function runSchemaAudit(input: AuditInput): SchemaAuditResult[] {
  const productPages = evaluateProductPages(input.products, input.domain);
  const contentPages = [
    ...evaluateContentPages(input.pages, input.domain, "pages"),
    ...evaluateContentPages(input.articles, input.domain, "blogs"),
  ];
  const sitePages = evaluateSiteLevel(input.shopName, input.domain);

  const pagesByType: Record<string, PageEval[]> = {
    Product: productPages,
    Review: productPages,
    AggregateRating: productPages,
    Offer: productPages,
    BreadcrumbList: [...productPages, ...contentPages],
    VideoObject: [...productPages, ...contentPages],
    Article: contentPages,
    FAQPage: contentPages,
    HowTo: contentPages,
    Organization: sitePages,
    WebSite: sitePages,
    LocalBusiness: sitePages,
  };

  const results: SchemaAuditResult[] = SCHEMA_TYPES.map((type) => {
    const pages = pagesByType[type.type] || [];
    const totalPages = pages.length;
    const requiredFields = type.fields.filter((f) => f.required);
    const reqWeight = requiredFields.reduce((s, f) => s + f.weight, 0) || 1;

    let coveredPages = 0;
    let weightedSum = 0;
    const missingFields: MissingFieldEntry[] = [];

    for (const page of pages) {
      const pageMissing = page.missingByType[type.type] || [];
      const missingFieldDefs = type.fields.filter((f) => pageMissing.includes(f.path));
      const missingWeight = missingFieldDefs.filter((f) => f.required).reduce((s, f) => s + f.weight, 0);
      const pageScore = 1 - missingWeight / reqWeight; // 0~1
      weightedSum += pageScore;
      if (pageScore >= 0.999) coveredPages++;

      if (pageMissing.length > 0) {
        const affected = Array.from(new Set(missingFieldDefs.map((f) => f.affectedAIScenario)));
        missingFields.push({
          pageId: page.id,
          pageTitle: page.title,
          pageUrl: page.url,
          missingFieldNames: pageMissing.slice(),
          affectedScenarios: affected,
        });
      }
    }

    const coverageRate = totalPages > 0 ? weightedSum / totalPages : 0;
    return {
      schemaType: type.type,
      title: type.title,
      totalPages,
      coveredPages,
      coverageRate,
      missingFields,
      healthScore: coverageRate,
    };
  });

  return results;
}

/** 计算全站加权健康分（0~100） */
export function computeSiteHealth(results: SchemaAuditResult[]): number {
  const typeMap = new Map(SCHEMA_TYPES.map((t) => [t.type, t.weight]));
  let score = 0;
  for (const r of results) {
    const w = typeMap.get(r.schemaType) || 0;
    score += w * r.coverageRate;
  }
  return Math.round(score * 1000) / 10; // 一位小数
}

/* ─── JSON-LD 生成器（用于预览 / 注入 / 复制） ──────────────── */

export function generateProductJsonLd(p: NormalizedProduct, domain: string): Record<string, unknown> {
  const base = `https://${domain}/products/${p.handle}`;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: stripHtml(p.descriptionHtml).slice(0, 5000),
    sku: p.sku || undefined,
    url: base,
  };
  if (p.image) node.image = p.image;
  if (p.brand) node.brand = { "@type": "Brand", name: p.brand };
  if (p.gtin) node.gtin13 = p.gtin;
  if (p.mpn) node.mpn = p.mpn;
  if (p.ratingValue !== null && p.reviewCount !== null) {
    node.aggregateRating = { "@type": "AggregateRating", ratingValue: p.ratingValue, reviewCount: p.reviewCount };
  }
  const availability = p.availability || availabilityFromStatus(p.status, true);
  node.offers = {
    "@type": "Offer",
    price: p.price,
    priceCurrency: p.currency || "USD",
    availability,
    url: base,
  };
  return node;
}

export function generateBreadcrumbJsonLd(p: NormalizedProduct, domain: string): Record<string, unknown> {
  const crumbs: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "首页", item: `https://${domain}` },
  ];
  if (p.vendor) crumbs.push({ "@type": "ListItem", position: 2, name: p.vendor, item: `https://${domain}/collections/vendors?q=${encodeURIComponent(p.vendor)}` });
  if (p.productType) crumbs.push({ "@type": "ListItem", position: crumbs.length + 1, name: p.productType, item: `https://${domain}/collections/${encodeURIComponent(p.productType)}` });
  crumbs.push({ "@type": "ListItem", position: crumbs.length + 1, name: p.title, item: `https://${domain}/products/${p.handle}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  };
}

export function generateOrgJsonLd(shopName: string, domain: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: shopName,
    url: `https://${domain}`,
    logo: `https://${domain}/cdn/shop/logo.png`,
  };
}

export function generateWebsiteJsonLd(shopName: string, domain: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: shopName,
    url: `https://${domain}`,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `https://${domain}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateArticleJsonLd(c: NormalizedContent, domain: string, base: string): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    articleBody: stripHtml(c.bodyHtml).slice(0, 5000),
    url: `https://${domain}/${base}/${c.handle}`,
  };
  if (c.author) node.author = { "@type": "Person", name: c.author };
  if (c.publishedAt) { node.datePublished = c.publishedAt; node.dateModified = c.publishedAt; }
  return node;
}

export function generateFaqJsonLd(c: NormalizedContent): Record<string, unknown> {
  // 基于内容中的问答标题粗略生成 FAQ 项
  const headings = c.bodyHtml.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
  const mainEntity = headings
    .filter((h) => { const t = stripHtml(h); return t.includes("?") || t.includes("？"); })
    .map((h) => {
      const q = stripHtml(h);
      return { "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: "（请在此填写答案内容）" } };
    });
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

/* ─── CSV 报告 ──────────────────────────────────────────── */

export function buildCsvReport(results: SchemaAuditResult[], shopName: string): string {
  const header = ["Schema类型", "页面标题", "页面URL", "缺失字段", "影响AI场景"];
  const rows: string[][] = [];
  for (const r of results) {
    for (const m of r.missingFields) {
      rows.push([
        r.title,
        m.pageTitle,
        m.pageUrl,
        m.missingFieldNames.join(" | "),
        m.affectedScenarios.join(" | "),
      ]);
    }
  }
  const csv = [header, ...rows]
    .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(","))
    .join("\n");
  return "﻿" + csv;
}

/* ─── 归一化映射（由面板调用） ──────────────────────────────── */

export function normalizeProductFromDashboard(p: {
  id: number; title: string; handle: string; descriptionHtml: string; image: string | null;
  productType: string; vendor: string; status: string;
  variants?: Array<{ sku?: string | null; price?: string | number | null; inventory?: number }>;
  brand?: string | null; ratingValue?: number | null; reviewCount?: number | null;
  hasReviews?: boolean; gtin?: string | null; mpn?: string | null;
}): NormalizedProduct {
  const firstVariant = p.variants && p.variants[0];
  const priceRaw = firstVariant?.price;
  const price = priceRaw === null || priceRaw === undefined || priceRaw === ""
    ? null
    : typeof priceRaw === "number" ? priceRaw : parseFloat(String(priceRaw));
  const sku = firstVariant?.sku ?? null;
  const inv = firstVariant?.inventory ?? 0;
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.descriptionHtml || "",
    image: p.image,
    productType: p.productType || "",
    vendor: p.vendor || "",
    status: p.status,
    sku,
    price,
    currency: "USD",
    availability: availabilityFromStatus(p.status, (inv || 0) > 0),
    brand: p.brand ?? (p.vendor || null),
    ratingValue: p.ratingValue ?? null,
    reviewCount: p.reviewCount ?? null,
    hasReviews: p.hasReviews ?? false,
    url: null,
    gtin: p.gtin ?? null,
    mpn: p.mpn ?? null,
  };
}

export function normalizeContentFromDashboard(c: {
  id: number; title: string; handle: string; bodyHtml: string;
  publishedAt?: string | null; author?: string | null;
}): NormalizedContent {
  return {
    id: c.id,
    title: c.title,
    handle: c.handle,
    bodyHtml: c.bodyHtml || "",
    publishedAt: c.publishedAt ?? null,
    author: c.author ?? null,
  };
}
