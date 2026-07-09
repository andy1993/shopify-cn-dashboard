// ─────────────────────────────────────────────────────────────────────────────
// lib/seo-scanner.ts
// SEO 基础健康扫描引擎（纯前端，不额外调用 Shopify API）。
// 复用已有数据源：fullProducts / pages / blogs / collections，
// 以及 SchemaAuditPanel 写入 geo_wizard_step2 的缓存结果。
//
// 检查分为 3 组，按严重度加权：
//   critical   严重   权重 50%   （直接影响排名）
//   warning    警告   权重 30%   （影响排名但不阻塞）
//   suggestion 建议   权重 20%   （可优化项）
// 健康分 = Σ( 组内得分比 × 组权重 ) × 100
// ─────────────────────────────────────────────────────────────────────────────

export type SEOCheckCategory = "critical" | "warning" | "suggestion";

export interface SEOIssue {
  key: string;
  checkName: string;
  category: SEOCheckCategory;
  targetId: number;
  targetTitle: string;
  targetType: "product" | "collection" | "page" | "blog" | "homepage";
  currentValue: string;
  suggestedValue: string;
  detail: string;
  /** 聚合型问题（重复标题、内链缺失等）展开时显示的商品/页面清单 */
  groupItems?: Array<{ id: number; title: string; handle?: string }>;
  /** 关联的编辑动作提示，供面板跳转 ProductControlPanel 时使用 */
  editTab?: "basic" | "seo" | "images";
}

export interface SEOCheckResult {
  checkName: string;
  checkCategory: SEOCheckCategory;
  maxPoints: number;
  passedCount: number;
  totalCount: number;
  issues: SEOIssue[];
  suggestion: string;
  /** 未检测到数据源时的说明（如结构化数据缓存缺失），不计入扣分 */
  note?: string;
}

/* ─── 组权重元数据 ─────────────────────────────────────── */

export const SEO_CATEGORY_WEIGHT: Record<SEOCheckCategory, number> = {
  critical: 0.5,
  warning: 0.3,
  suggestion: 0.2,
};

export const SEO_CATEGORY_META: Record<
  SEOCheckCategory,
  { label: string; emoji: string; tone: string; short: string }
> = {
  critical: { label: "严重（阻塞排名）", emoji: "🔴", tone: "text-red-400", short: "严重" },
  warning: { label: "警告（影响排名）", emoji: "🟡", tone: "text-amber-400", short: "警告" },
  suggestion: { label: "建议（可优化）", emoji: "🔵", tone: "text-sky-400", short: "建议" },
};

/* ─── 工具函数 ─────────────────────────────────────────── */

function cleanText(s: unknown): string {
  return typeof s === "string" ? s : "";
}

function getImages(p: any): Array<{ id: any; src: string; alt: string }> {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  return imgs.map((img: any) => ({
    id: img?.id ?? 0,
    src: cleanText(img?.src),
    alt: cleanText(img?.alt),
  }));
}

function getHtml(p: any): string {
  return cleanText(p?.descriptionHtml) || cleanText(p?.bodyHtml) || "";
}

function extractTitleTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function hasTag(html: string, tag: string): boolean {
  // tag 不含属性，例如 "h1"
  const re = new RegExp(`<${tag}[\\s/>]`, "i");
  return re.test(html);
}

function hasMetaViewport(html: string): boolean {
  return /<meta[^>]+name=["']viewport["']/i.test(html);
}

function hasCanonical(html: string): boolean {
  return /<link[^>]+rel=["']canonical["']/i.test(html);
}

function hasInternalLink(html: string): boolean {
  return (
    /<a[^>]+href=["']\/products\//i.test(html) ||
    /<a[^>]+href=["']\/collections\//i.test(html)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDefaultHandle(handle: string): boolean {
  const h = cleanText(handle).trim();
  if (!h) return false;
  return /^\d+$/.test(h) || UUID_RE.test(h);
}

function checkBrandInTitle(product: any): boolean {
  const vendor = cleanText(product?.vendor).trim().toLowerCase();
  if (!vendor) return true; // 没有 vendor 则不检测
  return cleanText(product?.title).toLowerCase().includes(vendor);
}

function makeResult(
  checkName: string,
  checkCategory: SEOCheckCategory,
  maxPoints: number,
  passedCount: number,
  totalCount: number,
  issues: SEOIssue[],
  suggestion: string,
  note?: string,
): SEOCheckResult {
  return { checkName, checkCategory, maxPoints, passedCount, totalCount, issues, suggestion, note };
}

/* ─── 严重组（权重 50%） ───────────────────────────────── */

export function scanSEODuplicateTitles(products: any[]): SEOCheckResult {
  const map = new Map<string, number[]>();
  for (const p of products) {
    const key = cleanText(p?.title).trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p?.id ?? 0);
  }
  const dupGroups = Array.from(map.entries()).filter(([, ids]) => ids.length > 1);
  const issues: SEOIssue[] = dupGroups.map(([title, ids]) => {
    const members = ids
      .map((id) => products.find((p) => p?.id === id))
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, title: cleanText(p.title), handle: cleanText(p.handle) }));
    const firstId = members[0]?.id ?? 0;
    return {
      key: `dup-title::${title}`,
      checkName: "重复标题",
      category: "critical",
      targetId: firstId,
      targetTitle: title,
      targetType: "product",
      currentValue: title,
      suggestedValue: "差异化标题（品牌+型号+特性）",
      detail: `共有 ${members.length} 件商品使用完全相同的标题「${title}」，搜索引擎无法区分，导致内耗与排名稀释。`,
      groupItems: members,
      editTab: "basic",
    };
  });
  const affected = new Set(dupGroups.flatMap(([, ids]) => ids));
  return makeResult(
    "重复标题",
    "critical",
    20,
    products.length - affected.size,
    products.length,
    issues,
    "为每件商品编写唯一标题，包含品牌名、型号与关键卖点，避免与其他商品或变体完全重复。",
  );
}

export function scanSEODuplicateDescriptions(products: any[]): SEOCheckResult {
  const map = new Map<string, number[]>();
  for (const p of products) {
    const raw = cleanText(p?.seoDescription).trim();
    if (!raw) continue; // 空描述由 scanSEOMissingDescriptions 负责
    const key = raw;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p?.id ?? 0);
  }
  const dupGroups = Array.from(map.entries()).filter(([, ids]) => ids.length > 1);
  const issues: SEOIssue[] = dupGroups.map(([desc, ids]) => {
    const members = ids
      .map((id) => products.find((p) => p?.id === id))
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, title: cleanText(p.title), handle: cleanText(p.handle) }));
    const firstId = members[0]?.id ?? 0;
    const preview = desc.length > 40 ? desc.slice(0, 40) + "…" : desc;
    return {
      key: `dup-desc::${desc.slice(0, 40)}`,
      checkName: "重复 Meta Description",
      category: "critical",
      targetId: firstId,
      targetTitle: members[0]?.title ?? "商品组",
      targetType: "product",
      currentValue: preview,
      suggestedValue: "每件商品独立撰写 50-160 字描述",
      detail: `共有 ${members.length} 件商品使用完全相同的 Meta Description，搜索结果摘要雷同，点击率受损。`,
      groupItems: members,
      editTab: "seo",
    };
  });
  const affected = new Set(dupGroups.flatMap(([, ids]) => ids));
  return makeResult(
    "重复 Meta Description",
    "critical",
    15,
    products.length - affected.size,
    products.length,
    issues,
    "为每件商品撰写独立的 Meta Description，突出该商品的差异化卖点与适用场景。",
  );
}

export function scanSEOMissingDescriptions(products: any[], pages: any[] = []): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const desc = cleanText(p?.seoDescription).trim();
    if (!desc) {
      issues.push({
        key: `miss-desc::product::${p?.id}`,
        checkName: "Meta Description 完全缺失",
        category: "critical",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title) || "未命名商品",
        targetType: "product",
        currentValue: "(空)",
        suggestedValue: "撰写 50-160 字描述",
        detail: "该商品缺少 Meta Description，搜索引擎将自动抓取正文片段，摘要质量不可控。",
        editTab: "seo",
      });
    }
  }
  for (const pg of pages || []) {
    const desc = cleanText(pg?.seoDescription).trim();
    if (!desc) {
      issues.push({
        key: `miss-desc::page::${pg?.id}`,
        checkName: "Meta Description 完全缺失",
        category: "critical",
        targetId: pg?.id ?? 0,
        targetTitle: cleanText(pg?.title) || "未命名页面",
        targetType: "page",
        currentValue: "(空)",
        suggestedValue: "撰写 50-160 字描述",
        detail: "该页面缺少 Meta Description，搜索摘要将不可控。",
        editTab: "seo",
      });
    }
  }
  const total = products.length + (pages?.length ?? 0);
  return makeResult(
    "Meta Description 完全缺失",
    "critical",
    10,
    total - issues.length,
    total,
    issues,
    "为所有商品与页面补充 Meta Description，控制在 50-160 字符，包含核心关键词与行动号召。",
  );
}

export function scanSEODefaultHomepageTitle(homepageHtml: string): SEOCheckResult {
  const title = extractTitleTag(homepageHtml || "");
  const defaultTitles = ["", "home", "homepage", "untitled", "shop", "store", "home page", "welcome"];
  const isDefault = defaultTitles.includes(title.toLowerCase().trim());
  const issues: SEOIssue[] =
    isDefault || !title
      ? [
          {
            key: "home-title::homepage",
            checkName: "首页/核心页面标题缺失",
            category: "critical",
            targetId: 0,
            targetTitle: "首页",
            targetType: "homepage",
            currentValue: title || "(空)",
            suggestedValue: "包含品牌名 + 核心品类，如「TechGear 官方商城 | 智能穿戴」",
            detail: "首页 <title> 为空或使用了默认值，无法向搜索引擎传达站点主题，首页排名严重受损。",
          },
        ]
      : [];
  return makeResult(
    "首页/核心页面标题缺失",
    "critical",
    5,
    issues.length === 0 ? 1 : 0,
    1,
    issues,
    "为首页设置唯一且含品牌词的 <title>，避免 Home / 未命名 等默认值。",
  );
}

/* ─── 警告组（权重 30%） ───────────────────────────────── */

export function scanSEOTitleLength(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const t = cleanText(p?.title);
    if (t.length < 30 || t.length > 70) {
      issues.push({
        key: `title-len::${p?.id}`,
        checkName: "商品标题长度不合规",
        category: "warning",
        targetId: p?.id ?? 0,
        targetTitle: t,
        targetType: "product",
        currentValue: `长度 ${t.length} 字`,
        suggestedValue: "30-70 字",
        detail: `标题长度为 ${t.length} 字，过短无法承载关键词，过长会在搜索结果中被截断（建议 30-70 字）。`,
        editTab: "basic",
      });
    }
  }
  return makeResult(
    "商品标题长度不合规",
    "warning",
    10,
    products.length - issues.length,
    products.length,
    issues,
    "将商品标题控制在 30-70 字符，前半段放置核心关键词与品牌，后半段补充型号/场景。",
  );
}

export function scanSEODescriptionLength(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const d = cleanText(p?.seoDescription);
    if (d.length < 50 || d.length > 160) {
      issues.push({
        key: `desc-len::${p?.id}`,
        checkName: "Meta Description 长度不合规",
        category: "warning",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title),
        targetType: "product",
        currentValue: `长度 ${d.length} 字`,
        suggestedValue: "50-160 字",
        detail: `Meta Description 长度为 ${d.length} 字，过短信息不足、过长被截断（建议 50-160 字）。`,
        editTab: "seo",
      });
    }
  }
  return makeResult(
    "Meta Description 长度不合规",
    "warning",
    10,
    products.length - issues.length,
    products.length,
    issues,
    "将 Meta Description 控制在 50-160 字符，前置核心卖点与关键词，结尾加行动号召。",
  );
}

export function scanSEOAltText(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const imgs = getImages(p);
    if (imgs.length === 0) continue;
    const missing = imgs.filter((img) => !img.alt.trim());
    if (missing.length > 0) {
      issues.push({
        key: `alt::${p?.id}`,
        checkName: "图片 Alt 文本缺失",
        category: "warning",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title),
        targetType: "product",
        currentValue: `缺 ${missing.length}/${imgs.length} 张`,
        suggestedValue: "为每张图填写描述性 Alt",
        detail: `该商品有 ${imgs.length} 张图片，其中 ${missing.length} 张缺少 Alt 文本，影响图片搜索收录与无障碍。`,
        editTab: "images",
      });
    }
  }
  return makeResult(
    "图片 Alt 文本缺失",
    "warning",
    5,
    products.length - issues.length,
    products.length,
    issues,
    "为每张商品图片填写描述性 Alt 文本，包含商品名与关键特征，利于图片搜索与无障碍访问。",
  );
}

export function scanSEOHandleFormat(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const handle = cleanText(p?.handle);
    if (isDefaultHandle(handle)) {
      issues.push({
        key: `handle::${p?.id}`,
        checkName: "URL Handle 为默认值",
        category: "warning",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title),
        targetType: "product",
        currentValue: handle,
        suggestedValue: "语义化英文短链，如 smart-watch-chrono-x",
        detail: `URL Handle「${handle}」为纯数字或 UUID，无关键词价值，不利于搜索与用户记忆。`,
        editTab: "basic",
      });
    }
  }
  return makeResult(
    "URL Handle 为默认值",
    "warning",
    5,
    products.length - issues.length,
    products.length,
    issues,
    "将 URL Handle 改为语义化英文短链（小写、连字符分隔、含关键词），提升 URL 可读性。",
  );
}

/* ─── 建议组（权重 20%） ───────────────────────────────── */

export function scanSEOInternalLinks(products: any[], pages: any[] = []): SEOCheckResult {
  const missing: Array<{ id: number; title: string; handle?: string }> = [];
  for (const p of products) {
    if (!hasInternalLink(getHtml(p))) {
      missing.push({ id: p?.id ?? 0, title: cleanText(p?.title), handle: cleanText(p?.handle) });
    }
  }
  for (const pg of pages || []) {
    if (!hasInternalLink(cleanText(pg?.bodyHtml))) {
      missing.push({ id: pg?.id ?? 0, title: cleanText(pg?.title), handle: cleanText(pg?.handle) });
    }
  }
  const issues: SEOIssue[] =
    missing.length > 0
      ? [
          {
            key: "internal-links::site",
            checkName: "内链缺失",
            category: "suggestion",
            targetId: 0,
            targetTitle: "全站",
            targetType: "homepage",
            currentValue: `0 链接（${missing.length} 件内容缺失内链）`,
            suggestedValue: "≥1 条 /products/ 或 /collections/ 内链",
            detail: `站内共 ${missing.length} 件商品或页面未在正文中放置指向 /products/ 或 /collections/ 的内链，不利于权重传递与收录。`,
            groupItems: missing,
          },
        ]
      : [];
  const total = products.length + (pages?.length ?? 0);
  return makeResult(
    "内链缺失",
    "suggestion",
    5,
    total - missing.length,
    total,
    issues,
    "在商品描述与页面正文中添加指向相关商品（/products/）与集合（/collections/）的内链，提升爬虫抓取深度与权重分发。",
  );
}

export function scanSEOH1Tags(pages: any[] = []): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const pg of pages || []) {
    const html = cleanText(pg?.bodyHtml);
    if (!hasTag(html, "h1")) {
      issues.push({
        key: `h1::page::${pg?.id}`,
        checkName: "H1 标签缺失",
        category: "suggestion",
        targetId: pg?.id ?? 0,
        targetTitle: cleanText(pg?.title) || "未命名页面",
        targetType: "page",
        currentValue: "(无 H1)",
        suggestedValue: "页面正文包含一个 <h1>",
        detail: "该页面正文未包含 <h1> 标签，缺少明确的语义层级主题，影响关键词相关性。",
        editTab: "basic",
      });
    }
  }
  const total = pages?.length ?? 0;
  return makeResult(
    "H1 标签缺失",
    "suggestion",
    5,
    total - issues.length,
    total,
    issues,
    "为每个页面添加唯一且含核心关键词的 <h1> 标题，建立清晰的页面语义结构。",
  );
}

export function scanSEOImageCount(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    const imgs = getImages(p);
    if (imgs.length < 3) {
      issues.push({
        key: `img-count::${p?.id}`,
        checkName: "图片数量不足",
        category: "suggestion",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title),
        targetType: "product",
        currentValue: `${imgs.length} 张`,
        suggestedValue: "≥3 张",
        detail: `该商品仅有 ${imgs.length} 张图片，Google 倾向于在购物结果中展示多图商品，图片不足会降低曝光。`,
        editTab: "images",
      });
    }
  }
  return makeResult(
    "图片数量不足",
    "suggestion",
    5,
    products.length - issues.length,
    products.length,
    issues,
    "为商品补充至至少 3 张高质量图片（主图、细节图、场景图、尺寸图），提升搜索与购物结果曝光。",
  );
}

export function scanSEOBrandInTitle(products: any[]): SEOCheckResult {
  const issues: SEOIssue[] = [];
  for (const p of products) {
    if (!checkBrandInTitle(p)) {
      issues.push({
        key: `brand::${p?.id}`,
        checkName: "标题未含品牌词",
        category: "suggestion",
        targetId: p?.id ?? 0,
        targetTitle: cleanText(p?.title),
        targetType: "product",
        currentValue: cleanText(p?.title),
        suggestedValue: `含品牌「${cleanText(p?.vendor)}」`,
        detail: `商品标题未包含品牌词「${cleanText(p?.vendor)}」，不利于品牌搜索命中与复购。`,
        editTab: "basic",
      });
    }
  }
  return makeResult(
    "标题未含品牌词",
    "suggestion",
    5,
    products.length - issues.length,
    products.length,
    issues,
    "在商品标题中前置或嵌入品牌词，强化品牌搜索可见度与信任感。",
  );
}

export function scanSEOCanonical(homepageHtml: string): SEOCheckResult {
  const ok = hasCanonical(homepageHtml || "");
  const issues: SEOIssue[] = ok
    ? []
    : [
        {
          key: "canonical::homepage",
          checkName: "Canonical URL 缺失",
          category: "suggestion",
          targetId: 0,
          targetTitle: "首页",
          targetType: "homepage",
          currentValue: "(无 canonical)",
          suggestedValue: "首页与商品页均设置 <link rel='canonical'>",
          detail: "首页未检测到 canonical 标签，容易出现重复内容竞争，分散页面权重。",
        },
      ];
  return makeResult(
    "Canonical URL",
    "suggestion",
    5,
    ok ? 1 : 0,
    1,
    issues,
    "为所有页面设置正确的 canonical URL，集中权重、避免重复内容惩罚。",
  );
}

export function scanSEOStructuredData(schemaCache: any | null): SEOCheckResult {
  if (!schemaCache || !schemaCache.results || !Array.isArray(schemaCache.results)) {
    return makeResult(
      "结构化数据存在性",
      "suggestion",
      5,
      1,
      1,
      [],
      "请先运行「Schema 检测」面板，本检查将复用其结果评估 Product Schema 覆盖。",
      "结构化数据缓存未检测到（未运行 Schema 检测或已过期），本项暂不计入扣分。",
    );
  }
  const product = schemaCache.results.find((r: any) => r.schemaType === "Product");
  if (!product) {
    return makeResult(
      "结构化数据存在性",
      "suggestion",
      5,
      0,
      1,
      [
        {
          key: "schema::product",
          checkName: "结构化数据存在性",
          category: "suggestion",
          targetId: 0,
          targetTitle: "全站商品",
          targetType: "product",
          currentValue: "无 Product Schema",
          suggestedValue: "为商品注入 Product 结构化数据",
          detail: "未检测到 Product Schema 类型，搜索富媒体结果（评分、价格、库存）将无法展示。",
        },
      ],
      "为所有商品注入 Product 结构化数据（含 name、image、offers、aggregateRating 等），争取搜索富结果。",
    );
  }
  const total = product.totalPages ?? 0;
  const covered = product.coveredPages ?? 0;
  const issues: SEOIssue[] =
    covered < total
      ? [
          {
            key: "schema::product",
            checkName: "结构化数据存在性",
            category: "suggestion",
            targetId: 0,
            targetTitle: "全站商品",
            targetType: "product",
            currentValue: `Product Schema 覆盖 ${covered}/${total}`,
            suggestedValue: "全覆盖",
            detail: `Product Schema 仅覆盖 ${covered}/${total} 件商品，未覆盖商品无法获得搜索富结果。`,
          },
        ]
      : [];
  return makeResult(
    "结构化数据存在性",
    "suggestion",
    5,
    covered,
    total,
    issues,
    "使用「Schema 自动生成」面板为缺失商品补齐 Product 结构化数据，提升搜索富结果展示率。",
  );
}

export function scanSEOSitemap(sitemapStatus: number | undefined): SEOCheckResult {
  const ok = sitemapStatus === 200;
  const issues: SEOIssue[] = ok
    ? []
    : [
        {
          key: "sitemap::site",
          checkName: "Sitemap 可访问性",
          category: "suggestion",
          targetId: 0,
          targetTitle: "全站",
          targetType: "homepage",
          currentValue: sitemapStatus === undefined ? "未检测" : `HTTP ${sitemapStatus}`,
          suggestedValue: "HTTP 200",
          detail:
            sitemapStatus === undefined
              ? "未能检测 sitemap.xml（可能处于演示模式且未执行首页抓取）。"
              : `sitemap.xml 返回 HTTP ${sitemapStatus}，爬虫无法正常读取站点地图。`,
        },
      ];
  return makeResult(
    "Sitemap 可访问性",
    "suggestion",
    5,
    ok ? 1 : 0,
    1,
    issues,
    "确保 /sitemap.xml 可公开访问（HTTP 200），并在 robots.txt 中声明 sitemap 指令，加速收录。",
  );
}

export function scanSEOMobileFriendly(homepageHtml: string): SEOCheckResult {
  const ok = hasMetaViewport(homepageHtml || "");
  const issues: SEOIssue[] = ok
    ? []
    : [
        {
          key: "mobile::homepage",
          checkName: "移动端友好性",
          category: "suggestion",
          targetId: 0,
          targetTitle: "首页",
          targetType: "homepage",
          currentValue: "(无 viewport meta)",
          suggestedValue: "包含 <meta name='viewport'>",
          detail: "首页未检测到 viewport meta 标签，移动端渲染异常，影响移动优先索引排名。",
        },
      ];
  return makeResult(
    "移动端友好性",
    "suggestion",
    5,
    ok ? 1 : 0,
    1,
    issues,
    "在 <head> 中添加 <meta name='viewport' content='width=device-width, initial-scale=1'>，确保移动端自适应。",
  );
}

export function scanSEOFAQSchema(products: any[]): SEOCheckResult {
  // 启发式：从商品正文判断是否包含 FAQ 结构（问答），有则视为具备 FAQ 潜力。
  // 真正的 FAQ Schema 注入由 Schema 自动生成面板负责；此处仅做存在性预警。
  const withFaq = products.filter((p) => {
    const html = getHtml(p);
    const qCount = (html.match(/<(h2|h3|strong|p)[^>]*>\s*(问|Q|FAQ|常见问题)/gi) || []).length;
    return qCount >= 1;
  });
  const missing = products.length - withFaq.length;
  const issues: SEOIssue[] =
    missing > 0
      ? [
          {
            key: "faq::site",
            checkName: "FAQ 结构化数据潜力",
            category: "suggestion",
            targetId: 0,
            targetTitle: "全站商品",
            targetType: "product",
            currentValue: `${missing} 件未含问答内容`,
            suggestedValue: "为含问答的商品注入 FAQPage Schema",
            detail: `有 ${missing} 件商品正文未包含问答/FAQ 内容，难以获得 FAQ 富结果。可在商品描述补充常见问题并生成 FAQPage Schema。`,
          },
        ]
      : [];
  return makeResult(
    "FAQ 结构化数据潜力",
    "suggestion",
    5,
    withFaq.length,
    products.length,
    issues,
    "为含问答内容的商品补充 FAQPage 结构化数据，争取搜索结果中的 FAQ 富片段展示。",
  );
}

/* ─── 健康分计算 ───────────────────────────────────────── */

export function computeSEOHealthScore(results: SEOCheckResult[]): number {
  const groups: Record<SEOCheckCategory, { max: number; earned: number }> = {
    critical: { max: 0, earned: 0 },
    warning: { max: 0, earned: 0 },
    suggestion: { max: 0, earned: 0 },
  };
  for (const r of results) {
    const passRatio = r.totalCount > 0 ? r.passedCount / r.totalCount : 1;
    const earned = r.maxPoints * passRatio;
    groups[r.checkCategory].max += r.maxPoints;
    groups[r.checkCategory].earned += earned;
  }
  let score = 0;
  (Object.keys(groups) as SEOCheckCategory[]).forEach((cat) => {
    const g = groups[cat];
    const ratio = g.max > 0 ? g.earned / g.max : 1;
    score += ratio * SEO_CATEGORY_WEIGHT[cat];
  });
  return Math.round(score * 100);
}

/* ─── 报告导出 ─────────────────────────────────────────── */

export interface SEOKpi {
  score: number;
  totalIssues: number;
  fixedCount: number;
  unfixedCount: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
}

export function buildSeoReportMarkdown(
  results: SEOCheckResult[],
  kpi: SEOKpi,
  shopName: string,
  scanTime: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${shopName || "未命名店铺"} SEO 健康报告`);
  lines.push(`生成时间：${scanTime}`);
  lines.push("");
  lines.push(`## 📊 总体评分`);
  lines.push(`健康分：${kpi.score}/100`);
  lines.push(
    `检测问题：${kpi.totalIssues} 项（阻塞 ${kpi.criticalCount} · 警告 ${kpi.warningCount} · 建议 ${kpi.suggestionCount}）`,
  );
  lines.push(`已修复：${kpi.fixedCount} 项 · 未修复：${kpi.unfixedCount} 项`);
  lines.push("");

  const cats: SEOCheckCategory[] = ["critical", "warning", "suggestion"];
  cats.forEach((cat) => {
    const meta = SEO_CATEGORY_META[cat];
    lines.push(`## ${meta.emoji} ${meta.label}`);
    const checks = results.filter((r) => r.checkCategory === cat);
    let maxSum = 0;
    let earnedSum = 0;
    checks.forEach((r) => {
      const passRatio = r.totalCount > 0 ? r.passedCount / r.totalCount : 1;
      maxSum += r.maxPoints;
      earnedSum += r.maxPoints * passRatio;
      const status = r.issues.length === 0 ? "✅" : "⚠️";
      lines.push(
        `- ${status} ${r.checkName}（${Math.round((r.maxPoints * passRatio) * 10) / 10}/${r.maxPoints} 分）— ${r.issues.length} 项问题`,
      );
    });
    const grpScore = maxSum > 0 ? Math.round((earnedSum / maxSum) * 100) : 100;
    lines.push(`组得分：${grpScore}/100`);
    lines.push("");
  });

  lines.push(`## 💡 问题清单`);
  results.forEach((r) => {
    if (r.issues.length === 0) return;
    lines.push(`### ${r.checkName}`);
    r.issues.forEach((it) => {
      const prio =
        it.category === "critical" ? "🔴" : it.category === "warning" ? "🟡" : "🔵";
      lines.push(
        `- ${prio} [${it.targetTitle}] 当前：${it.currentValue} → 建议：${it.suggestedValue}`,
      );
    });
    lines.push("");
  });

  return lines.join("\n");
}

export function buildSeoCsv(issues: SEOIssue[]): string {
  const header = ["优先级", "商品/对象", "问题", "检查项", "当前值", "建议值", "详情"];
  const rows = issues.map((it) => {
    const prio =
      it.category === "critical" ? "阻塞" : it.category === "warning" ? "警告" : "建议";
    const cells = [
      prio,
      it.targetTitle,
      it.checkName,
      it.targetType,
      it.currentValue,
      it.suggestedValue,
      it.detail,
    ];
    return cells
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",");
  });
  return "﻿" + [header.map((h) => `"${h}"`).join(","), ...rows].join("\n");
}

export function downloadText(filename: string, content: string, mime: string): void {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}
