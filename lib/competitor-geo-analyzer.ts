// ─────────────────────────────────────────────────────────────────────────────
// lib/competitor-geo-analyzer.ts
// GEO 竞品对比分析引擎（纯客户端、零服务端依赖）
// 作用：将「本店」与「竞品」的公开页面信息归一化为统一的 CompetitorGeoResult 画像，
//       再从 Schema 覆盖 / SEO / robots.txt AI 友好度三个维度逐项对比，输出差值、
//       优先级待办清单，供 CompetitorGeoPanel 渲染。
// 竞品页面由服务端代理路由抓取（避免浏览器跨域），本模块只做解析与对比。
// ─────────────────────────────────────────────────────────────────────────────

import {
  SCHEMA_TYPES,
  extractJsonLdBlocks,
  type SchemaAuditResult,
  type SchemaType,
} from "./schema-detector";

/* ─── 核心类型 ──────────────────────────────────────────── */

export interface SeoMetrics {
  /** <title> 字符数 */
  titleLength: number;
  /** meta description 字符数 */
  descriptionLength: number;
  /** 是否包含 <link rel="canonical"> */
  hasCanonical: boolean;
  /** 带有效 alt 属性的图片数量 */
  imgAltCount: number;
}

export interface RobotsStatus {
  gptBotBlocked: boolean;
  perplexityBotBlocked: boolean;
  googleExtendedBlocked: boolean;
  ccBotBlocked: boolean;
}

/** 归一化后的单店 GEO 画像（本店与竞品共用此结构，便于直接对比） */
export interface CompetitorGeoResult {
  storeName: string;
  domain: string;
  /** 各 Schema 类型是否存在（基于页面 JSON-LD / HTML 启发式） */
  schemaCoverage: Record<string, boolean>;
  /** 各 Schema 类型 → 各字段路径 → 是否存在 */
  fieldComparison: Record<string, Record<string, boolean>>;
  seoMetrics: SeoMetrics;
  robotsTxtStatus: RobotsStatus;
}

export type GapKind = "leading" | "tied" | "behind" | "unknown";

/** Schema 覆盖行（布尔对比） */
export interface ComparisonRow {
  /** Schema 类型中文标题 */
  label: string;
  /** 权重（用于排序 / 优先级判断） */
  weight: number;
  own: boolean;
  competitor: boolean | null;
  gap: GapKind;
}

export type MetricBetter = "own" | "competitor" | "tie" | "unknown";

/** 概览指标（数值对比） */
export interface OverviewMetric {
  key: string;
  label: string;
  unit: string;
  /** 数值越大越好（用于排序 better） */
  higherBetter: boolean;
  own: number;
  competitor: number | null;
  better: MetricBetter;
}

export type TodoPriority = "high" | "medium" | "low";
export type TodoCategory = "schema" | "seo" | "robots";

export interface TodoItem {
  priority: TodoPriority;
  category: TodoCategory;
  title: string;
  detail: string;
  /** 点击后跳转的菜单（在 GEO 优化分类下） */
  jumpMenu?: string;
}

/** 单个竞品与本店的对比结果 */
export interface CompetitorComparison {
  competitor: CompetitorGeoResult;
  rows: ComparisonRow[];
  metrics: OverviewMetric[];
  todos: TodoItem[];
}

/** 完整对比结果（本店 + N 个竞品） */
export interface ComparisonResult {
  own: CompetitorGeoResult;
  comparisons: CompetitorComparison[];
}

/* ─── 小工具函数 ──────────────────────────────────────────── */

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasVideo(html: string): boolean {
  if (!html) return false;
  return /<video[\s>]|youtube\.com|youtu\.be|vimeo\.com|<iframe/gi.test(html);
}

function hasFaqStructure(html: string): boolean {
  if (!html) return false;
  const headings = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || [];
  let q = 0;
  for (const h of headings) {
    const t = stripHtml(h);
    if (t.includes("?") || t.includes("？")) q++;
    if (q >= 2) return true;
  }
  return false;
}

/** 按点路径取值，支持 "a|b" 表示任一存在即可 */
function getPath(obj: unknown, path: string): unknown {
  if (path.indexOf("|") !== -1) {
    return path.split("|").some((sub) => getPath(obj, sub) !== undefined) ? true : undefined;
  }
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isEmptyVal(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function findBlocksByType(blocks: Array<Record<string, unknown>>, type: string): Array<Record<string, unknown>> {
  const lower = type.toLowerCase();
  const out: Array<Record<string, unknown>> = [];
  for (const b of blocks) {
    const t = b["@type"];
    if (typeof t === "string") {
      if (t.toLowerCase() === lower) out.push(b);
    } else if (Array.isArray(t)) {
      if (t.some((x) => typeof x === "string" && x.toLowerCase() === lower)) out.push(b);
    }
  }
  return out;
}

function botKey(bot: string): keyof RobotsStatus {
  switch (bot) {
    case "GPTBot": return "gptBotBlocked";
    case "PerplexityBot": return "perplexityBotBlocked";
    case "Google-Extended": return "googleExtendedBlocked";
    case "CCBot": return "ccBotBlocked";
    default: return "gptBotBlocked";
  }
}

const AI_BOTS = ["GPTBot", "PerplexityBot", "Google-Extended", "CCBot"];

/* ─── robots.txt 解析（针对 4 个 AI 爬虫） ─────────────────── */

export function analyzeRobotsForBots(content: string | null | undefined): RobotsStatus {
  const result: RobotsStatus = {
    gptBotBlocked: false,
    perplexityBotBlocked: false,
    googleExtendedBlocked: false,
    ccBotBlocked: false,
  };
  if (!content) return result; // 无 robots.txt → 默认不屏蔽
  const lines = content.split(/\r?\n/);
  const rules: Record<string, { disallows: string[]; allows: string[] }> = {};
  let curAgents: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const am = line.match(/^user-agent:\s*(.+)$/i);
    if (am) { curAgents = am[1].split(",").map((s) => s.trim()); continue; }
    const dm = line.match(/^disallow:\s*(.*)$/i);
    if (dm) { for (const a of curAgents) { (rules[a] ||= { disallows: [], allows: [] }).disallows.push(dm[1].trim()); } continue; }
    const alm = line.match(/^allow:\s*(.*)$/i);
    if (alm) { for (const a of curAgents) { (rules[a] ||= { disallows: [], allows: [] }).allows.push(alm[1].trim()); } continue; }
  }
  const evaluate = (agent: string): boolean => {
    const r = rules[agent];
    const w = rules["*"];
    let blocked = false;
    const check = (ru: { disallows: string[]; allows: string[] } | undefined) => {
      if (!ru) return;
      const allowRoot = ru.allows.some((a) => a === "/" || a === "");
      for (const d of ru.disallows) {
        if (d === "/" || d === "" || d === "*") { if (!allowRoot) blocked = true; }
        else if (d) { if (!allowRoot) blocked = true; }
      }
    };
    if (r) check(r);
    else if (w) check(w);
    return blocked;
  };
  for (const bot of AI_BOTS) {
    (result as any)[botKey(bot)] = evaluate(bot);
  }
  return result;
}

/* ─── SEO 指标提取 ─────────────────────────────────────────── */

export function extractSeoFromHtml(html: string): SeoMetrics {
  const metric: SeoMetrics = { titleLength: 0, descriptionLength: 0, hasCanonical: false, imgAltCount: 0 };
  if (!html) return metric;
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) metric.titleLength = stripHtml(titleM[1]).length;
  const descM = html.match(/<meta[^>]+name\s*=\s*["']?description["']?[^>]*content\s*=\s*["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']?description["']?/i);
  if (descM) metric.descriptionLength = descM[1].length;
  if (/<link[^>]+rel\s*=\s*["']?canonical["']?/i.test(html)) metric.hasCanonical = true;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags) {
    const altM = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    if (altM && altM[1].trim().length > 0) metric.imgAltCount++;
  }
  return metric;
}

/* ─── Schema 覆盖 / 字段检测 ───────────────────────────────── */

function inferTypesFromHtml(html: string): Set<string> {
  const s = new Set<string>();
  if (hasFaqStructure(html)) s.add("FAQPage");
  if (hasVideo(html)) s.add("VideoObject");
  if (/breadcrumb/i.test(html)) s.add("BreadcrumbList");
  return s;
}

function computeSchemaCoverage(blocks: Array<Record<string, unknown>>, html: string): Record<string, boolean> {
  const jsonLdTypes = new Set<string>();
  for (const b of blocks) {
    const t = b["@type"];
    if (typeof t === "string") jsonLdTypes.add(t.toLowerCase());
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") jsonLdTypes.add(x.toLowerCase());
  }
  const htmlInfered = inferTypesFromHtml(html);
  const out: Record<string, boolean> = {};
  for (const t of SCHEMA_TYPES) {
    out[t.type] = jsonLdTypes.has(t.type.toLowerCase()) || htmlInfered.has(t.type);
  }
  return out;
}

function fieldPresent(block: Record<string, unknown>, path: string): boolean {
  const v = getPath(block, path);
  if (v !== undefined && !isEmptyVal(v)) return true;
  if (path.endsWith(".name")) {
    const parent = path.slice(0, -".name".length);
    const pv = getPath(block, parent);
    if (typeof pv === "string" && pv.length > 0) return true;
  }
  return false;
}

function detectSchemaFields(blocks: Array<Record<string, unknown>>): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const t of SCHEMA_TYPES) {
    const matched = findBlocksByType(blocks, t.type);
    const fm: Record<string, boolean> = {};
    for (const f of t.fields) {
      let present = false;
      for (const b of matched) {
        if (fieldPresent(b, f.path)) { present = true; break; }
      }
      fm[f.path] = present;
    }
    out[t.type] = fm;
  }
  return out;
}

/* ─── 由竞品页面 HTML 构建画像 ─────────────────────────────── */

/**
 * 从竞品单个公开页（通常为首页）的 HTML 解析出 CompetitorGeoResult。
 * robotsTxtContent 可选——若提供则一并解析 AI 爬虫放行情况。
 */
export function parseCompetitorPageHtml(
  html: string,
  robotsTxtContent?: string | null,
  storeName?: string,
  domain?: string,
): CompetitorGeoResult {
  const blocks = extractJsonLdBlocks(html);
  const seo = extractSeoFromHtml(html);
  const robots = analyzeRobotsForBots(robotsTxtContent || "");
  const coverage = computeSchemaCoverage(blocks, html);
  const fields = detectSchemaFields(blocks);
  return {
    storeName: storeName || "",
    domain: domain || "",
    schemaCoverage: coverage,
    fieldComparison: fields,
    seoMetrics: seo,
    robotsTxtStatus: robots,
  };
}

/**
 * 由服务端代理返回的结构化页面数据构建竞品画像。
 * pageData 对应 proxy action=fetchCompetitorPage 的返回结构。
 */
export function buildCompetitorGeoResultFromFetch(
  pageData: {
    title?: string;
    metaDescription?: string;
    canonical?: string | null;
    schemas?: Array<Record<string, unknown>>;
    imgAltCount?: number;
    hasFAQSchema?: boolean;
    hasProductSchema?: boolean;
    hasReviewSchema?: boolean;
    hasBreadcrumbSchema?: boolean;
    hasOrganizationSchema?: boolean;
  },
  robotsTxtContent: string | null | undefined,
  storeName: string,
  domain: string,
): CompetitorGeoResult {
  const blocks = pageData.schemas || [];
  const seo: SeoMetrics = {
    titleLength: (pageData.title || "").length,
    descriptionLength: (pageData.metaDescription || "").length,
    hasCanonical: !!pageData.canonical,
    imgAltCount: pageData.imgAltCount || 0,
  };
  const coverage = computeSchemaCoverage(blocks, "");
  // 用代理明确返回的布尔值兜底（更准确）
  if (pageData.hasProductSchema) coverage["Product"] = true;
  if (pageData.hasReviewSchema) coverage["Review"] = true;
  if (pageData.hasFAQSchema) coverage["FAQPage"] = true;
  if (pageData.hasBreadcrumbSchema) coverage["BreadcrumbList"] = true;
  if (pageData.hasOrganizationSchema) coverage["Organization"] = true;
  const fields = detectSchemaFields(blocks);
  const robots = analyzeRobotsForBots(robotsTxtContent || "");
  return {
    storeName,
    domain,
    schemaCoverage: coverage,
    fieldComparison: fields,
    seoMetrics: seo,
    robotsTxtStatus: robots,
  };
}

/* ─── 由本店 Schema 审计结果构建画像 ───────────────────────── */

/**
 * 将本店 runSchemaAudit 的 11 类结果 + 本店 SEO / robots 归一化为 CompetitorGeoResult，
 * 以便与竞品直接逐项对比。
 */
export function buildOwnGeoResult(
  auditResults: SchemaAuditResult[] | null,
  seoMetrics: SeoMetrics,
  robotsTxtStatus: RobotsStatus,
  storeName: string,
  domain: string,
): CompetitorGeoResult {
  const coverage: Record<string, boolean> = {};
  const fieldComparison: Record<string, Record<string, boolean>> = {};
  for (const t of SCHEMA_TYPES) {
    const ar = auditResults ? auditResults.find((r) => r.schemaType === t.type) : undefined;
    if (!ar || ar.totalPages === 0) {
      coverage[t.type] = false;
      const fm: Record<string, boolean> = {};
      for (const f of t.fields) fm[f.path] = false;
      fieldComparison[t.type] = fm;
      continue;
    }
    coverage[t.type] = ar.coverageRate > 0;
    const missingNames = new Set<string>();
    for (const m of ar.missingFields) for (const n of m.missingFieldNames) missingNames.add(n);
    const fm: Record<string, boolean> = {};
    for (const f of t.fields) fm[f.path] = !missingNames.has(f.name);
    fieldComparison[t.type] = fm;
  }
  return {
    storeName,
    domain,
    schemaCoverage: coverage,
    fieldComparison,
    seoMetrics: seoMetrics,
    robotsTxtStatus: robotsTxtStatus,
  };
}

/* ─── GEO 健康分（0~100） ──────────────────────────────────── */

export function computeGeoHealth(result: CompetitorGeoResult): number {
  const typesPresent = SCHEMA_TYPES.filter((t) => result.schemaCoverage[t.type]).length;
  const schemaScore = (typesPresent / SCHEMA_TYPES.length) * 60;
  const robotsAllowed = [result.robotsTxtStatus.gptBotBlocked, result.robotsTxtStatus.perplexityBotBlocked, result.robotsTxtStatus.googleExtendedBlocked, result.robotsTxtStatus.ccBotBlocked].filter((b) => !b).length;
  const robotsScore = (robotsAllowed / 4) * 20;
  let seoScore = 0;
  if (result.seoMetrics.hasCanonical) seoScore += 6;
  if (result.seoMetrics.descriptionLength >= 50 && result.seoMetrics.descriptionLength <= 200) seoScore += 8;
  else if (result.seoMetrics.descriptionLength > 0) seoScore += 4;
  if (result.seoMetrics.imgAltCount > 0) seoScore += 6;
  seoScore = Math.min(seoScore, 20);
  return Math.round(schemaScore + robotsScore + seoScore);
}

/* ─── 差值 / 颜色规则 ──────────────────────────────────────── */

export type CellTone = "green" | "gray" | "yellow" | "red";

/** 布尔型对比：own 领先→绿，落后→红，其余→灰 */
export function boolGapTone(own: boolean, competitor: boolean | null): CellTone {
  if (competitor === null) return "gray";
  if (own && !competitor) return "green";
  if (!own && competitor) return "red";
  return "gray";
}

/**
 * 数值型对比（百分比 / 计数）。
 * 差值 ≤10% → 灰（持平）；>10% 且 ≤30% → 黄；>30% → 绿（领先）/ 红（落后）。
 */
export function numericGapTone(own: number, competitor: number | null, higherBetter: boolean): CellTone {
  if (competitor === null) return "gray";
  if (own === competitor) return "gray";
  const base = own === 0 ? 1 : Math.abs(own);
  const diffPct = (Math.abs(competitor - own) / base) * 100;
  let ownAhead: boolean;
  if (higherBetter) ownAhead = own > competitor;
  else ownAhead = own < competitor;
  if (diffPct <= 10) return "gray";
  if (diffPct <= 30) return "yellow";
  return ownAhead ? "green" : "red";
}

const TONE_CLS: Record<CellTone, string> = {
  green: "text-emerald-400",
  gray: "text-zinc-400",
  yellow: "text-amber-400",
  red: "text-red-400",
};

export function toneClass(tone: CellTone): string {
  return TONE_CLS[tone];
}

/* ─── 单竞品对比 ───────────────────────────────────────────── */

export function compareGeoProfiles(own: CompetitorGeoResult, competitor: CompetitorGeoResult): CompetitorComparison {
  // Schema 覆盖行
  const rows: ComparisonRow[] = SCHEMA_TYPES.map((t: SchemaType) => {
    const o = !!own.schemaCoverage[t.type];
    const c = competitor.schemaCoverage[t.type] === undefined ? null : !!competitor.schemaCoverage[t.type];
    const gap: GapKind = c === null ? "unknown" : o === c ? "tied" : o ? "leading" : "behind";
    return { label: t.title, weight: t.weight, own: o, competitor: c, gap };
  });

  // 概览指标
  const ownHealth = computeGeoHealth(own);
  const compHealth = computeGeoHealth(competitor);
  const ownCov = pct(SCHEMA_TYPES.filter((t) => own.schemaCoverage[t.type]).length, SCHEMA_TYPES.length);
  const compCov = pct(SCHEMA_TYPES.filter((t) => competitor.schemaCoverage[t.type]).length, SCHEMA_TYPES.length);
  const ownRobots = pct([own.robotsTxtStatus.gptBotBlocked, own.robotsTxtStatus.perplexityBotBlocked, own.robotsTxtStatus.googleExtendedBlocked, own.robotsTxtStatus.ccBotBlocked].filter((b) => !b).length, 4);
  const compRobots = pct([competitor.robotsTxtStatus.gptBotBlocked, competitor.robotsTxtStatus.perplexityBotBlocked, competitor.robotsTxtStatus.googleExtendedBlocked, competitor.robotsTxtStatus.ccBotBlocked].filter((b) => !b).length, 4);

  const metric = (
    key: string, label: string, unit: string, higherBetter: boolean,
    o: number, c: number | null,
  ): OverviewMetric => {
    let better: MetricBetter = "unknown";
    if (c !== null) {
      if (o === c) better = "tie";
      else {
        const oAhead = higherBetter ? o > c : o < c;
        better = oAhead ? "own" : "competitor";
      }
    }
    return { key, label, unit, higherBetter, own: o, competitor: c, better };
  };

  const metrics: OverviewMetric[] = [
    metric("health", "GEO 健康分", "/100", true, ownHealth, compHealth),
    metric("coverage", "Schema 覆盖率", "%", true, ownCov, compCov),
    metric("product", "Product Schema", "%", true, own.schemaCoverage["Product"] ? 100 : 0, competitor.schemaCoverage["Product"] ? 100 : 0),
    metric("faq", "FAQPage Schema", "%", true, own.schemaCoverage["FAQPage"] ? 100 : 0, competitor.schemaCoverage["FAQPage"] ? 100 : 0),
    metric("review", "Review Schema", "%", true, own.schemaCoverage["Review"] ? 100 : 0, competitor.schemaCoverage["Review"] ? 100 : 0),
    metric("robots", "robots AI 友好度", "%", true, ownRobots, compRobots),
    metric("desc", "描述长度", "字", true, own.seoMetrics.descriptionLength, competitor.seoMetrics.descriptionLength),
    metric("imgalt", "图片 Alt 数", "张", true, own.seoMetrics.imgAltCount, competitor.seoMetrics.imgAltCount),
  ];

  const todos = buildTodoFromComparison(own, competitor);
  return { competitor, rows, metrics, todos };
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function countBlocked(r: RobotsStatus): number {
  return [r.gptBotBlocked, r.perplexityBotBlocked, r.googleExtendedBlocked, r.ccBotBlocked].filter((b) => b).length;
}

const PRIO_RANK: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

function buildTodoFromComparison(own: CompetitorGeoResult, comp: CompetitorGeoResult): TodoItem[] {
  const todos: TodoItem[] = [];
  for (const t of SCHEMA_TYPES) {
    const o = !!own.schemaCoverage[t.type];
    const c = !!comp.schemaCoverage[t.type];
    if (!o && c) {
      const priority: TodoPriority = t.weight >= 0.2 ? "high" : t.weight >= 0.1 ? "medium" : "low";
      todos.push({
        priority,
        category: "schema",
        title: `补齐 ${t.title} 结构化数据`,
        detail: `竞品「${comp.storeName}」已部署 ${t.title}，你的店铺尚未覆盖。建议在对应页面注入 JSON-LD，以争夺 AI 摘要中的同款场景曝光。`,
        jumpMenu: "schema-generator",
      });
    }
  }
  const ownBlocked = countBlocked(own.robotsTxtStatus);
  const compBlocked = countBlocked(comp.robotsTxtStatus);
  if (ownBlocked > compBlocked) {
    todos.push({
      priority: "high",
      category: "robots",
      title: "放开 AI 爬虫抓取限制",
      detail: `你的 robots.txt 屏蔽了 ${ownBlocked} 个 AI 爬虫，竞品仅屏蔽 ${compBlocked} 个。建议为 GPTBot / PerplexityBot / Google-Extended / CCBot 设置 Allow: /，否则 AI 搜索引擎无法索引你的内容。`,
      jumpMenu: "ai-indexability",
    });
  }
  if (!own.seoMetrics.hasCanonical && comp.seoMetrics.hasCanonical) {
    todos.push({
      priority: "medium",
      category: "seo",
      title: "添加规范链接 canonical",
      detail: `竞品已设置 canonical，你的首页缺少。缺失 canonical 可能导致 AI 将内容归因到错误副本，影响品牌实体一致性。`,
      jumpMenu: "ai-indexability",
    });
  }
  if (own.seoMetrics.descriptionLength < 50 && comp.seoMetrics.descriptionLength >= 50) {
    todos.push({
      priority: "medium",
      category: "seo",
      title: "完善首页 meta description",
      detail: `竞品描述长度 ${comp.seoMetrics.descriptionLength} 字，你仅 ${own.seoMetrics.descriptionLength} 字。建议补充 50–160 字描述，提升 AI 摘要对店铺定位的命中率。`,
      jumpMenu: "ai-indexability",
    });
  }
  if (own.seoMetrics.imgAltCount === 0 && comp.seoMetrics.imgAltCount > 0) {
    todos.push({
      priority: "low",
      category: "seo",
      title: "为图片补充 alt 描述",
      detail: `竞品首页有 ${comp.seoMetrics.imgAltCount} 张图片带 alt，你的为 0。alt 文本是 AI 理解视觉内容、进入视觉搜索结果的关键。`,
      jumpMenu: "ai-indexability",
    });
  }
  todos.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  return todos;
}

/* ─── 整批对比 ─────────────────────────────────────────────── */

export function buildComparisonResult(own: CompetitorGeoResult, competitors: CompetitorGeoResult[]): ComparisonResult {
  return {
    own,
    comparisons: competitors.map((c) => compareGeoProfiles(own, c)),
  };
}

/* ─── 文本报告（导出用） ───────────────────────────────────── */

export function buildComparisonReportText(result: ComparisonResult, storeName: string): string {
  const lines: string[] = [];
  lines.push("GEO 竞品对比报告");
  lines.push(`店铺：${storeName}`);
  lines.push(`生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("=".repeat(40));
  for (const comp of result.comparisons) {
    lines.push("");
    lines.push(`竞品：${comp.competitor.storeName}（${comp.competitor.domain}）`);
    lines.push("-".repeat(40));
    lines.push("【概览指标】");
    for (const m of comp.metrics) {
      const c = m.competitor === null ? "—" : `${m.competitor}${m.unit}`;
      lines.push(`  ${m.label}：本店 ${m.own}${m.unit} | 竞品 ${c} | ${m.better === "own" ? "领先" : m.better === "competitor" ? "落后" : m.better === "tie" ? "持平" : "未知"}`);
    }
    lines.push("【Schema 覆盖】");
    for (const r of comp.rows) {
      const c = r.competitor === null ? "—" : r.competitor ? "有" : "无";
      lines.push(`  ${r.label}：本店 ${r.own ? "有" : "无"} | 竞品 ${c} | ${r.gap === "leading" ? "领先" : r.gap === "behind" ? "落后" : r.gap === "tied" ? "持平" : "未知"}`);
    }
    lines.push("【待办建议】");
    if (comp.todos.length === 0) lines.push("  无显著差距，保持领先。");
    for (const t of comp.todos) {
      lines.push(`  [${t.priority.toUpperCase()}] ${t.title} — ${t.detail}`);
    }
  }
  return lines.join("\n");
}
