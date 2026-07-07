// ─────────────────────────────────────────────────────────────────────────────
// lib/ai-indexability-checker.ts
// AI 可索引性（AI Indexability）检测引擎
// 检查 AI 搜索引擎抓取、理解、引用店铺内容的完整链路：
//   1) AI Crawler 访问权限（robots.txt / sitemap）
//   2) 内容质量
//   3) 实体关联度
//   4) 新鲜度信号
//   5) 技术性检查
// 纯客户端逻辑；涉及跨域抓取的部分由面板通过服务端代理路由获取后传入。
// ─────────────────────────────────────────────────────────────────────────────

/* ─── 核心类型 ──────────────────────────────────────────── */

export type Severity = "critical" | "warning" | "pass";

export interface IndexabilityAffectedItem {
  id: number;
  title: string;
  detail: string;
}

export interface IndexabilityCheck {
  checkName: string;
  passed: boolean;
  severity: Severity;
  affectedCount: number;
  affectedItems: IndexabilityAffectedItem[];
  suggestion: string;
}

export interface IndexabilityResult {
  dimensionKey: DimensionKey;
  dimensionName: string;
  dimensionWeight: number;
  checks: IndexabilityCheck[];
}

export type DimensionKey = "crawler" | "content" | "entity" | "freshness" | "technical";

/** checkTechnicalHealth 的入参（技术维度需要跨域抓取的数据，无法仅凭 shopUrl 同步完成） */
export interface TechnicalHealthInput {
  shopUrl: string;
  https: boolean;
  robotsTxtContent: string;
  homepageHtml: string;
  pageSpeedMs: number | null;
  schemaParseOk: boolean;
}

/* ─── 维度定义（权重合计 100%） ───────────────────────────── */

export const DIMENSIONS: Array<{ key: DimensionKey; name: string; weight: number }> = [
  { key: "crawler", name: "AI Crawler 访问权限", weight: 0.30 },
  { key: "content", name: "内容质量评估", weight: 0.25 },
  { key: "entity", name: "实体关联度", weight: 0.20 },
  { key: "freshness", name: "新鲜度信号", weight: 0.15 },
  { key: "technical", name: "技术性检查", weight: 0.10 },
];

/** 需要重点保障的 AI 爬虫 */
export const AI_BOTS = ["GPTBot", "PerplexityBot", "Google-Extended", "CCBot"] as const;

/** 场景词典（用于检测描述中的适用场景实体） */
export const SCENE_KEYWORDS: Record<string, string[]> = {
  运动: ["运动", "健身", "跑步", "训练", "户外", "登山", "骑行", "游泳", "瑜伽"],
  家居: ["家居", "客厅", "卧室", "厨房", "浴室", "办公桌"],
  送礼: ["送礼", "礼物", "生日", "节日", "纪念日", "情人节", "圣诞节"],
  旅行: ["旅行", "出差", "便携", "随身", "轻便"],
  商务: ["商务", "办公", "会议", "专业", "正装"],
};

/** 属性实体词典（材质/尺寸/颜色/重量等） */
const ATTRIBUTE_KEYWORDS: string[] = [
  "材质", "纯棉", "亚麻", "不锈钢", "铝合金", "碳纤维", "硅胶", "皮革", "实木", "TPE",
  "尺寸", "长宽", "直径", "高度", "重量", "克", "千克", "kg", "cm", "mm",
  "颜色", "颜色", "红色", "黑色", "白色", "蓝色", "绿色", "灰色",
  "容量", "升", "ml", "L", "功率", "瓦", "W",
];

/** 常见占位/无意义默认文本 */
const PLACEHOLDER_STRINGS = ["暂无", "tbd", "lorem ipsum", "coming soon", "待补充", "无描述", "默认描述"];

/* ─── 工具函数 ──────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function textLen(html: string): number {
  return stripHtml(html).length;
}

function hasInternalLink(html: string): boolean {
  if (!html) return false;
  return /<a[^>]+href=["']\/products\//i.test(html) ||
    /<a[^>]+href=["']\/collections\//i.test(html) ||
    /<a[^>]+href=["']\/pages\//i.test(html) ||
    /href=["']\/(products|collections|pages)\//i.test(html);
}

function hasTag(html: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s>]`, "i").test(html || "");
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** Jaccard 文本相似度（基于字符 bigram，对中文更稳健） */
function bigrams(text: string): Set<string> {
  const s = text.replace(/\s+/g, "");
  const set = new Set<string>();
  if (s.length < 2) { if (s) set.add(s); return set; }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function jaccard(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

interface RobotsParse {
  bots: Record<string, { blocked: boolean; disallowLines: string[] }>;
  genericSiteBlocked: boolean;
  productPathsBlocked: boolean;
}

/** 逐行解析 robots.txt（不引入第三方库） */
export function parseRobotsTxt(content: string): RobotsParse {
  const bots: Record<string, { blocked: boolean; disallowLines: string[] }> = {};
  for (const b of AI_BOTS) bots[b] = { blocked: false, disallowLines: [] };
  let genericSiteBlocked = false;
  let productPathsBlocked = false;

  const lines = (content || "").split(/\r?\n/);
  let currentAgents: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^user-agent:\s*(.+)$/i);
    if (m) {
      currentAgents = m[1].split(/,/).map((s) => s.trim());
      continue;
    }
    const dis = line.match(/^disallow:\s*(.*)$/i);
    if (dis) {
      const path = dis[1].trim();
      const appliesToAll = currentAgents.includes("*");
      if (appliesToAll && (path === "/" || path === "")) genericSiteBlocked = true;
      if (path.startsWith("/products") || path.startsWith("/collections")) productPathsBlocked = true;
      for (const agent of currentAgents) {
        if (agent === "*") {
          // 通配规则对未单独声明的 bot 生效
          for (const b of AI_BOTS) {
            if (!bots[b].disallowLines.length) {
              bots[b].disallowLines.push(path || "/");
              bots[b].blocked = bots[b].blocked || path === "/" || path === "";
            }
          }
        } else if ((AI_BOTS as ReadonlyArray<string>).includes(agent)) {
          bots[agent].disallowLines.push(path || "/");
          bots[agent].blocked = bots[agent].blocked || path === "/" || path === "";
        }
      }
      continue;
    }
    const allow = line.match(/^allow:\s*(.*)$/i);
    if (allow) {
      const path = allow[1].trim();
      for (const agent of currentAgents) {
        if ((AI_BOTS as ReadonlyArray<string>).includes(agent)) {
          // Allow 覆盖同作用域的 Disallow
          if (bots[agent].disallowLines.includes(path || "/")) {
            bots[agent].disallowLines = bots[agent].disallowLines.filter((p) => p !== (path || "/"));
            bots[agent].blocked = bots[agent].disallowLines.length > 0;
          }
        }
      }
    }
  }
  return { bots, genericSiteBlocked, productPathsBlocked };
}

/** 检测首页源码中是否存在合法 JSON-LD（结构化数据正确性） */
export function checkHomepageSchema(homepageHtml: string): boolean {
  if (!homepageHtml) return false;
  const re = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = re.exec(homepageHtml)) !== null) {
    try {
      JSON.parse(m[1]);
      found = true;
    } catch {
      return false; // 存在但解析失败 → 语法错误
    }
  }
  return found;
}

/* ─── 维度 1：AI Crawler 访问权限 ─────────────────────────── */

export function checkCrawlerAccess(robotsTxtContent: string, sitemapStatus?: number): IndexabilityResult {
  const parsed = parseRobotsTxt(robotsTxtContent);
  const checks: IndexabilityCheck[] = [];

  for (const bot of AI_BOTS) {
    const blocked = parsed.bots[bot]?.blocked;
    checks.push({
      checkName: `${bot} 未被屏蔽`,
      passed: !blocked,
      severity: blocked ? "critical" : "pass",
      affectedCount: blocked ? 1 : 0,
      affectedItems: blocked
        ? [{ id: 0, title: "全站", detail: `robots.txt 包含对 ${bot} 的 Disallow 规则` }]
        : [],
      suggestion: blocked
        ? `在 robots.txt 中为 ${bot} 添加 Allow: / 或移除对应 Disallow 规则，否则该 AI 引擎无法抓取商品。`
        : `${bot} 可正常抓取，无需处理。`,
    });
  }

  checks.push({
    checkName: "通用爬虫未被全站屏蔽",
    passed: !parsed.genericSiteBlocked,
    severity: parsed.genericSiteBlocked ? "critical" : "pass",
    affectedCount: parsed.genericSiteBlocked ? 1 : 0,
    affectedItems: parsed.genericSiteBlocked
      ? [{ id: 0, title: "全站", detail: "robots.txt 的 * 规则包含 Disallow: /（全站屏蔽）" }]
      : [],
    suggestion: parsed.genericSiteBlocked
      ? "移除 User-agent: * 下的 Disallow: /，改为仅屏蔽 /admin、/checkout 等敏感路径。"
      : "通用爬虫未被全站屏蔽。",
  });

  checks.push({
    checkName: "重要页面未被单独屏蔽",
    passed: !parsed.productPathsBlocked,
    severity: parsed.productPathsBlocked ? "critical" : "pass",
    affectedCount: parsed.productPathsBlocked ? 1 : 0,
    affectedItems: parsed.productPathsBlocked
      ? [{ id: 0, title: "/products/ 或 /collections/", detail: "robots.txt 屏蔽了商品/集合路径" }]
      : [],
    suggestion: parsed.productPathsBlocked
      ? "移除对 /products/ 与 /collections/ 的 Disallow，确保商品可被 AI 抓取。"
      : "商品与集合路径未被屏蔽。",
  });

  const sitemapOk = sitemapStatus === 200;
  checks.push({
    checkName: "sitemap.xml 存在且可访问",
    passed: sitemapOk,
    severity: sitemapStatus === undefined ? "warning" : sitemapOk ? "pass" : "warning",
    affectedCount: sitemapOk ? 0 : 1,
    affectedItems: sitemapOk ? [] : [{ id: 0, title: "sitemap.xml", detail: sitemapStatus === undefined ? "未检测" : `HTTP ${sitemapStatus}` }],
    suggestion: sitemapOk
      ? "sitemap.xml 可访问，AI 可通过 sitemap 发现全部页面。"
      : "确认 https://{shop}/sitemap.xml 可访问，并在 robots.txt 中以 Sitemap: 指令声明，帮助 AI 发现内容。",
  });

  return { dimensionKey: "crawler", dimensionName: "AI Crawler 访问权限", dimensionWeight: 0.30, checks };
}

/* ─── 维度 2：内容质量评估 ───────────────────────────────── */

interface QInputProduct {
  id: number; title: string; descriptionHtml?: string; images?: Array<{ src?: string }> | null; image?: string | null;
  metafields?: Array<{ namespace: string; key: string; value: string }> | null;
}
interface QInputContent { id: number; title: string; bodyHtml?: string; }

export function checkContentQuality(
  products: QInputProduct[],
  pages: QInputContent[],
  blogs: QInputContent[],
): IndexabilityResult {
  const checks: IndexabilityCheck[] = [];

  // 描述过短
  const shortItems = products
    .filter((p) => textLen(p.descriptionHtml || "") < 100)
    .map((p) => ({ id: p.id, title: p.title, detail: `描述纯文本 ${textLen(p.descriptionHtml || "")} 字（<100）` }));
  checks.push({
    checkName: "描述过短（<100 字）",
    passed: shortItems.length === 0,
    severity: shortItems.length > 0 ? "warning" : "pass",
    affectedCount: shortItems.length,
    affectedItems: shortItems,
    suggestion: "为描述过短的商品补充材质、尺寸、场景、卖点等实体信息，让 AI 有足够语料生成推荐。",
  });

  // 重复内容
  const descs = products.map((p) => stripHtml(p.descriptionHtml || ""));
  const dupFlags = new Set<number>();
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      if (descs[i].length > 10 && descs[j].length > 10 && jaccard(descs[i], descs[j]) > 0.8) {
        dupFlags.add(products[i].id); dupFlags.add(products[j].id);
      }
    }
  }
  const dupItems = products.filter((p) => dupFlags.has(p.id)).map((p) => ({ id: p.id, title: p.title, detail: "与其他商品描述高度相似（>80%）" }));
  checks.push({
    checkName: "重复内容占比",
    passed: dupItems.length === 0,
    severity: dupItems.length > 0 ? "warning" : "pass",
    affectedCount: dupItems.length,
    affectedItems: dupItems,
    suggestion: "为相似商品撰写差异化描述，避免 AI 因重复内容降低引用优先级。",
  });

  // 图片数量不足
  const fewImg = products
    .filter((p) => {
      const n = (p.images && p.images.length) || (p.image ? 1 : 0);
      return n < 3;
    })
    .map((p) => ({ id: p.id, title: p.title, detail: `图片数 ${(p.images && p.images.length) || (p.image ? 1 : 0)}（<3）` }));
  checks.push({
    checkName: "图片数量不足（<3）",
    passed: fewImg.length === 0,
    severity: fewImg.length > 0 ? "warning" : "pass",
    affectedCount: fewImg.length,
    affectedItems: fewImg,
    suggestion: "补充多角度、场景化图片；富媒体内容能显著提升 AI 引用与图片搜索曝光。",
  });

  // 缺少多媒体
  const noMedia = products
    .filter((p) => !hasTag(p.descriptionHtml || "", "img") && !hasTag(p.descriptionHtml || "", "video"))
    .map((p) => ({ id: p.id, title: p.title, detail: "描述中无 <img>/<video>" }));
  checks.push({
    checkName: "缺少多媒体内容",
    passed: noMedia.length === 0,
    severity: noMedia.length > 0 ? "warning" : "pass",
    affectedCount: noMedia.length,
    affectedItems: noMedia,
    suggestion: "在商品描述中嵌入图片或视频，增强多模态可被索引性。",
  });

  // 关键实体（品牌/材质/尺寸/场景）
  const noEntity = products
    .filter((p) => {
      const t = stripHtml(p.descriptionHtml || "");
      const hit = ATTRIBUTE_KEYWORDS.some((k) => t.includes(k)) || Object.values(SCENE_KEYWORDS).some((arr) => arr.some((k) => t.includes(k)));
      return !hit;
    })
    .map((p) => ({ id: p.id, title: p.title, detail: "描述未出现材质/尺寸/场景等实体词" }));
  checks.push({
    checkName: "商品描述含关键实体",
    passed: noEntity.length === 0,
    severity: noEntity.length > 0 ? "warning" : "pass",
    affectedCount: noEntity.length,
    affectedItems: noEntity,
    suggestion: "在描述中明确品牌、材质、尺寸、适用场景，帮助 AI 建立实体关联。",
  });

  // 页面/博客内容过少
  const thinContent = [...pages, ...blogs]
    .filter((c) => textLen(c.bodyHtml || "") < 50)
    .map((c) => ({ id: c.id, title: c.title, detail: `正文 ${textLen(c.bodyHtml || "")} 字（<50）` }));
  checks.push({
    checkName: "页面内容过少（<50 字）",
    passed: thinContent.length === 0,
    severity: thinContent.length > 0 ? "warning" : "pass",
    affectedCount: thinContent.length,
    affectedItems: thinContent,
    suggestion: "补充关于页/联系页/博客正文，AI 更倾向引用内容充实的页面。",
  });

  // 占位符
  const phItems = [...products, ...pages, ...blogs]
    .filter((c) => {
      const t = (stripHtml((c as QInputProduct).descriptionHtml || (c as QInputContent).bodyHtml || "")).toLowerCase();
      return PLACEHOLDER_STRINGS.some((s) => t.includes(s));
    })
    .map((c) => ({ id: c.id, title: c.title, detail: "检测到占位/默认文本" }));
  checks.push({
    checkName: "存在「暂无内容」占位",
    passed: phItems.length === 0,
    severity: phItems.length > 0 ? "warning" : "pass",
    affectedCount: phItems.length,
    affectedItems: phItems,
    suggestion: "替换占位文本为真实描述，空白内容会被 AI 视为低质量。",
  });

  return { dimensionKey: "content", dimensionName: "内容质量评估", dimensionWeight: 0.25, checks };
}

/* ─── 维度 3：实体关联度 ─────────────────────────────────── */

interface EInputProduct {
  id: number; title: string; descriptionHtml?: string; vendor?: string; productType?: string;
}
interface EInputContent { id: number; title: string; bodyHtml?: string; }

export function checkEntityAssociation(products: EInputProduct[], pages: EInputContent[]): IndexabilityResult {
  const checks: IndexabilityCheck[] = [];

  const noBrand = products
    .filter((p) => p.vendor && !(stripHtml(p.descriptionHtml || "")).includes(p.vendor))
    .map((p) => ({ id: p.id, title: p.title, detail: `描述未提及品牌「${p.vendor}」` }));
  checks.push({
    checkName: "品牌实体",
    passed: noBrand.length === 0,
    severity: noBrand.length > 0 ? "warning" : "pass",
    affectedCount: noBrand.length,
    affectedItems: noBrand,
    suggestion: "在描述中自然提及品牌名，帮助 AI 识别品牌实体（如：建议在描述中提及品牌 " + (noBrand[0]?.detail.replace("描述未提及品牌「", "").replace("」", "") || "") + "）。",
  });

  const noType = products
    .filter((p) => p.productType && !(stripHtml(p.descriptionHtml || "")).includes(p.productType))
    .map((p) => ({ id: p.id, title: p.title, detail: `描述未提及品类「${p.productType}」` }));
  checks.push({
    checkName: "品类实体",
    passed: noType.length === 0,
    severity: noType.length > 0 ? "warning" : "pass",
    affectedCount: noType.length,
    affectedItems: noType,
    suggestion: "在描述中包含品类词（如「智能手表」「机械键盘」），增强品类关联。",
  });

  const noAttr = products
    .filter((p) => {
      const t = stripHtml(p.descriptionHtml || "");
      return !ATTRIBUTE_KEYWORDS.some((k) => t.includes(k));
    })
    .map((p) => ({ id: p.id, title: p.title, detail: "描述缺少材质/尺寸/颜色等属性实体" }));
  checks.push({
    checkName: "属性实体",
    passed: noAttr.length === 0,
    severity: noAttr.length > 0 ? "warning" : "pass",
    affectedCount: noAttr.length,
    affectedItems: noAttr,
    suggestion: "补充材质、尺寸、颜色、重量等属性词，丰富实体维度。",
  });

  const noScene = products
    .filter((p) => {
      const t = stripHtml(p.descriptionHtml || "");
      return !Object.values(SCENE_KEYWORDS).some((arr) => arr.some((k) => t.includes(k)));
    })
    .map((p) => ({ id: p.id, title: p.title, detail: "描述未出现任何适用场景词" }));
  checks.push({
    checkName: "适用场景实体",
    passed: noScene.length === 0,
    severity: noScene.length > 0 ? "warning" : "pass",
    affectedCount: noScene.length,
    affectedItems: noScene,
    suggestion: "加入「运动/家居/送礼/旅行/商务」等场景词，匹配用户意图与 AI 检索。",
  });

  const noLink = products
    .filter((p) => !hasInternalLink(p.descriptionHtml || ""))
    .map((p) => ({ id: p.id, title: p.title, detail: "描述中无站内链接" }));
  checks.push({
    checkName: "站内实体关联",
    passed: noLink.length === 0,
    severity: noLink.length > 0 ? "warning" : "pass",
    affectedCount: noLink.length,
    affectedItems: noLink,
    suggestion: "在描述中链接到相关商品/集合/页面，建立站内实体图谱，利于 AI 理解关联关系。",
  });

  return { dimensionKey: "entity", dimensionName: "实体关联度", dimensionWeight: 0.20, checks };
}

/* ─── 维度 4：新鲜度信号 ─────────────────────────────────── */

interface FInputProduct {
  id: number; title: string; updated_at?: string; updatedAt?: string;
  metafields?: Array<{ namespace: string; key: string; value: string }> | null;
  variants?: Array<{ compareAtPrice?: string | null }> | null;
}
interface FInputBlog { id: number; title: string; articles?: Array<{ id: number; title: string; createdAt?: string }> | null; createdAt?: string };

export function checkFreshnessSignals(products: FInputProduct[], blogs: FInputBlog[], variantSales?: Record<number, number> | null): IndexabilityResult {
  const checks: IndexabilityCheck[] = [];
  const now = Date.now();

  // 最近更新时间（超过 6 个月）
  const stale = products
    .filter((p) => {
      const d = daysSince(p.updated_at || p.updatedAt);
      return d !== null && d > 182;
    })
    .map((p) => ({ id: p.id, title: p.title, detail: `更新于 ${daysSince(p.updated_at || p.updatedAt)} 天前` }));
  checks.push({
    checkName: "最近更新时间（<6 个月）",
    passed: stale.length === 0,
    severity: stale.length > 0 ? "warning" : "pass",
    affectedCount: stale.length,
    affectedItems: stale,
    suggestion: "定期更新商品信息（价格/库存/描述），新鲜内容更易被 AI 引用。",
  });

  // 最近评价
  const noReview = products
    .filter((p) => {
      const mf = p.metafields || [];
      return !mf.some((m) => (m.namespace === "judgeme" || m.namespace === "loox" || m.namespace === "yotpo") && m.key === "reviews");
    })
    .map((p) => ({ id: p.id, title: p.title, detail: "未检测到评价数据（Judge.me/Loox/Yotpo）" }));
  checks.push({
    checkName: "是否有最近评价",
    passed: noReview.length === 0,
    severity: noReview.length > 0 ? "warning" : "pass",
    affectedCount: noReview.length,
    affectedItems: noReview,
    suggestion: "接入评价 App 并积累近期评价，AI 概览常引用带评分的内容。",
  });

  // 库存波动（variantSales 存在即视为有销售/波动信号）
  const hasSales = variantSales && Object.keys(variantSales).length > 0;
  checks.push({
    checkName: "是否有库存波动",
    passed: !!hasSales,
    severity: hasSales ? "pass" : "warning",
    affectedCount: hasSales ? 0 : 1,
    affectedItems: hasSales ? [] : [{ id: 0, title: "全站", detail: "无 variantSales 数据，无法确认近期库存波动" }],
    suggestion: hasSales ? "检测到近期销售/库存变动信号。" : "保持库存与销售活跃，变动信号有助于新鲜度评分。",
  });

  // 博客更新
  const recentBlogs: Array<{ id: number; title: string; detail: string }> = [];
  for (const b of blogs) {
    const arts = (b.articles || []).filter((a) => {
      const d = daysSince(a.createdAt || b.createdAt);
      return d !== null && d <= 30;
    });
    for (const a of arts) recentBlogs.push({ id: a.id || b.id, title: (a as { title?: string }).title || b.title, detail: "近 30 天发布" });
  }
  const blogStale = recentBlogs.length === 0;
  checks.push({
    checkName: "是否有博客更新（近 30 天）",
    passed: !blogStale,
    severity: blogStale ? "warning" : "pass",
    affectedCount: blogStale ? 1 : 0,
    affectedItems: blogStale ? [{ id: 0, title: "博客", detail: "近 30 天无新文章" }] : [],
    suggestion: blogStale ? "定期发布行业/使用指南类博客，持续供给新鲜内容。" : "近 30 天有博客更新。",
  });

  // 价格更新（存在 compareAtPrice 视为近期调价）
  const repriced = products.filter((p) => (p.variants || []).some((v) => v.compareAtPrice));
  checks.push({
    checkName: "价格是否更新过",
    passed: repriced.length > 0,
    severity: repriced.length > 0 ? "pass" : "warning",
    affectedCount: repriced.length === 0 ? 1 : 0,
    affectedItems: repriced.length > 0 ? [] : [{ id: 0, title: "全站", detail: "无商品设置 compareAtPrice（无法确认近期调价）" }],
    suggestion: repriced.length > 0 ? "检测到近期调价信号。" : "通过促销/调价产生价格变动信号，提升活跃度。",
  });

  return { dimensionKey: "freshness", dimensionName: "新鲜度信号", dimensionWeight: 0.15, checks };
}

/* ─── 维度 5：技术性检查 ─────────────────────────────────── */

export function checkTechnicalHealth(input: TechnicalHealthInput): IndexabilityResult {
  const { shopUrl, https, homepageHtml, pageSpeedMs, schemaParseOk } = input;
  const checks: IndexabilityCheck[] = [];

  // 页面加载速度
  let speedSeverity: Severity = "pass";
  let speedDetail = "加载正常";
  if (pageSpeedMs === null) {
    speedSeverity = "warning"; speedDetail = "无法测量（未抓取首页）";
  } else if (pageSpeedMs > 5000) {
    speedSeverity = "critical"; speedDetail = `首页响应 ${pageSpeedMs}ms（>5s）`;
  } else if (pageSpeedMs > 3000) {
    speedSeverity = "warning"; speedDetail = `首页响应 ${pageSpeedMs}ms（3-5s）`;
  } else {
    speedDetail = `首页响应 ${pageSpeedMs}ms`;
  }
  checks.push({
    checkName: "页面加载速度",
    passed: speedSeverity !== "critical",
    severity: speedSeverity,
    affectedCount: speedSeverity === "pass" ? 0 : 1,
    affectedItems: speedSeverity === "pass" ? [] : [{ id: 0, title: "首页", detail: speedDetail }],
    suggestion: speedSeverity === "pass" ? "加载速度良好。" : "优化主题与图片，降低首页响应时间（目标 <3s）。",
  });

  // 移动端适配（viewport meta）
  const hasViewport = /name=["']viewport["']/i.test(homepageHtml || "");
  checks.push({
    checkName: "移动端适配",
    passed: hasViewport,
    severity: hasViewport ? "pass" : "warning",
    affectedCount: hasViewport ? 0 : 1,
    affectedItems: hasViewport ? [] : [{ id: 0, title: "首页", detail: "未检测到 viewport meta 标签" }],
    suggestion: hasViewport ? "已配置 viewport，移动端适配正常。" : "确保主题包含 <meta name=\"viewport\"> 以支持移动端渲染。",
  });

  // HTTPS
  checks.push({
    checkName: "HTTPS",
    passed: https,
    severity: https ? "pass" : "critical",
    affectedCount: https ? 0 : 1,
    affectedItems: https ? [] : [{ id: 0, title: shopUrl, detail: "店铺域名非 HTTPS" }],
    suggestion: https ? "已启用 HTTPS。" : "必须为店铺启用 SSL（HTTPS），否则 AI 与用户均无法安全访问。",
  });

  // Canonical URL
  const hasCanonical = /rel=["']canonical["']/i.test(homepageHtml || "");
  checks.push({
    checkName: "Canonical URL",
    passed: hasCanonical,
    severity: hasCanonical ? "pass" : "warning",
    affectedCount: hasCanonical ? 0 : 1,
    affectedItems: hasCanonical ? [] : [{ id: 0, title: "首页", detail: "未检测到 canonical 标签" }],
    suggestion: hasCanonical ? "已配置 canonical，避免重复内容。" : "添加 <link rel=\"canonical\"> 以明确规范网址。",
  });

  // 结构化数据正确性
  checks.push({
    checkName: "结构化数据正确性",
    passed: schemaParseOk,
    severity: schemaParseOk ? "pass" : "critical",
    affectedCount: schemaParseOk ? 0 : 1,
    affectedItems: schemaParseOk ? [] : [{ id: 0, title: "首页", detail: schemaParseOk ? "" : "首页未检测到合法 JSON-LD" }],
    suggestion: schemaParseOk ? "首页 JSON-LD 语法正确。" : "为页面注入语法正确的 JSON-LD（见 Schema 审计面板）。",
  });

  return { dimensionKey: "technical", dimensionName: "技术性检查", dimensionWeight: 0.10, checks };
}

/* ─── 评分与报告 ─────────────────────────────────────────── */

/** 计算单维度得分（每个检查 critical=0 / warning=0.5 / pass=1，取均值 0~1） */
export function dimensionScore(r: IndexabilityResult): number {
  if (r.checks.length === 0) return 1;
  const sum = r.checks.reduce((acc, c) => acc + (c.passed ? (c.severity === "warning" ? 0.5 : 1) : 0), 0);
  return sum / r.checks.length;
}

/** 计算全站可索引性评分（0~100，按维度权重加权） */
export function computeIndexabilityScore(results: IndexabilityResult[]): number {
  if (results.length === 0) return 0;
  const wmap = new Map(DIMENSIONS.map((d) => [d.key, d.weight]));
  let total = 0;
  let wsum = 0;
  for (const r of results) {
    const w = wmap.get(r.dimensionKey) ?? r.dimensionWeight;
    total += dimensionScore(r) * w;
    wsum += w;
  }
  return Math.round((total / (wsum || 1)) * 100);
}

/** 全局问题列表（所有未通过的检查，按严重度排序） */
export function collectIssues(results: IndexabilityResult[]): Array<IndexabilityResult["checks"][number] & { dimensionKey: DimensionKey; dimensionName: string }> {
  const order: Record<Severity, number> = { critical: 0, warning: 1, pass: 2 };
  const out: Array<IndexabilityResult["checks"][number] & { dimensionKey: DimensionKey; dimensionName: string }> = [];
  for (const r of results) {
    for (const c of r.checks) {
      if (c.severity !== "pass") out.push({ ...c, dimensionKey: r.dimensionKey, dimensionName: r.dimensionName });
    }
  }
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return out;
}

/** 生成可下载的文本报告 */
export function buildReportText(results: IndexabilityResult[], shopName: string): string {
  const score = computeIndexabilityScore(results);
  const lines: string[] = [];
  lines.push(`AI 可索引性报告 — ${shopName}`);
  lines.push(`生成时间：${new Date().toLocaleString()}`);
  lines.push(`全站可索引性评分：${score}/100`);
  lines.push("=".repeat(48));
  for (const r of results) {
    const ds = Math.round(dimensionScore(r) * 100);
    lines.push(`\n【${r.dimensionName}】权重 ${Math.round(r.dimensionWeight * 100)}% · 维度得分 ${ds}`);
    for (const c of r.checks) {
      const mark = c.severity === "pass" ? "通过" : c.severity === "critical" ? "阻塞" : "待优化";
      lines.push(`  - [${mark}] ${c.checkName}（影响 ${c.affectedCount} 项）`);
      if (c.affectedCount > 0 && c.affectedItems.length > 0) {
        for (const it of c.affectedItems.slice(0, 8)) lines.push(`      · ${it.title}：${it.detail}`);
      }
      lines.push(`      → ${c.suggestion}`);
    }
  }
  return lines.join("\n");
}
