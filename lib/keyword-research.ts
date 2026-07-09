// lib/keyword-research.ts
// 关键词机会发现与缺口分析 —— 纯前端计算引擎（不依赖任何外部 API）
//
// 数据源：
//  - GSC 数据：来自 SearchConsolePanel 写入 localStorage 的 `gsc_last_result`（{ key, timestamp, rows }），
//    rows 形如 QueryRow { query, impressions, clicks, ctr(0..1), position, positionDelta }；
//    也兼容 GSC 原始响应行 { keys:[...], clicks, impressions, ctr, position }。
//  - 商品数据：fullProducts（含 title / productType / handle）
//  - 集合数据：collections（含 title / handle）

export interface KeywordOpportunity {
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  position: number;
  landingPage: string;
  suggestion: string;
  matchedProductIds: number[];
}

export interface KeywordCoverage {
  keyword: string;
  hasGSCData: boolean;
  gscImpressions: number;
  matchedInTitles: boolean;
  matchedProducts: Array<{ id: number; title: string }>;
  status: "covered" | "no_title_match" | "no_search_data" | "uncovered";
  suggestion: string;
}

export interface KeywordProductMatch {
  landingPage: string;
  impressions: number;
  ctr: number;
  matchedProduct: any | null;
  matchStrength: "strong" | "weak" | "none";
}

export interface CompetitionEstimate {
  keyword: string;
  searchVolume: number; // 0-100 归一化
  competition: number; // 0-100
  competitionLabel: string; // 低 / 中 / 高
  opportunityScore: number; // 0-100
  priority: "P0" | "P1" | "P2";
}

interface GSCRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  position: number;
  positionDelta?: number;
}

/** 规范化 GSC 行：兼容 { query, ... } 与 { keys:[...], ctr, ... } 两种形态 */
export function normalizeGSCRows(raw: any[]): GSCRow[] {
  if (!Array.isArray(raw)) return [];
  const out: GSCRow[] = [];
  for (const r of raw) {
    if (!r) continue;
    const query =
      typeof r.query === "string"
        ? r.query
        : Array.isArray(r.keys)
          ? String(r.keys[0] ?? "")
          : "";
    if (!query) continue;
    const impressions = Number(r.impressions) || 0;
    const clicks = Number(r.clicks) || 0;
    const ctr =
      typeof r.ctr === "number"
        ? r.ctr
        : impressions > 0
          ? clicks / impressions
          : 0;
    const position = Number(r.position) || 0;
    const positionDelta =
      typeof r.positionDelta === "number" ? r.positionDelta : undefined;
    out.push({ query, impressions, clicks, ctr, position, positionDelta });
  }
  return out;
}

/** 在商品中按关键词匹配（标题或 handle 包含，或所有分词均出现） */
function matchProductsByKeyword(keyword: string, products: any[]): any[] {
  const k = keyword.trim().toLowerCase();
  if (!k || !Array.isArray(products)) return [];
  const words = k.split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const title = (p?.title || "").toLowerCase();
    const handle = (p?.handle || "").toLowerCase();
    if (title.includes(k) || handle.includes(k)) return true;
    return words.every((w) => title.includes(w) || handle.includes(w));
  });
}

/** 由关键词推导落地页 URL（slug 化） */
function deriveLandingPage(keyword: string): string {
  const slug = keyword
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `/products/${slug}` : "/products/untitled";
}

/** 由标题推导 handle（集合兜底用） */
function deriveHandleFromTitle(title: string): string {
  const slug = (title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "collection";
}

/**
 * 标题覆盖检查（任务给定逻辑）：
 * 全词匹配（关键词作为独立词组出现在标题中）或 所有分词均出现在标题中。
 */
export function checkKeywordInTitles(
  keyword: string,
  products: any[],
): Array<{ id: number; title: string }> {
  const kw = keyword.trim().toLowerCase();
  return (products || [])
    .filter((p) => {
      const title = (p?.title || "").toLowerCase();
      return (
        title.includes(kw) ||
        kw.split(/\s+/).every((w) => title.includes(w))
      );
    })
    .map((p) => ({ id: p.id, title: p.title }));
}

function buildOpportunitySuggestion(
  r: GSCRow,
  matched: any[],
  landingPage: string,
): string {
  const kw = r.query;
  if (matched.length > 0) {
    const p = matched[0];
    return `优化商品「${p.title}」的 Title 与 Meta Description，融入「${kw}」（当前排名 ${r.position.toFixed(1)}）`;
  }
  return `优化落地页 ${landingPage} 的 Title/Description，加入「${kw}」以提升 CTR（当前排名 ${r.position.toFixed(
    1,
  )}，CTR ${(r.ctr * 100).toFixed(1)}%）`;
}

function buildCoverageSuggestion(
  kw: string,
  status: KeywordCoverage["status"],
  matchedProducts: Array<{ id: number; title: string }>,
): string {
  switch (status) {
    case "covered":
      return "已同时获得搜索曝光与标题覆盖，保持监控排名。";
    case "no_title_match": {
      const hint =
        matchedProducts.length > 0 ? matchedProducts[0].title : "目标商品";
      return `「${kw}」有搜索曝光但商品标题未覆盖，建议在相关商品标题加入该词，如：「${hint} - ${kw}版」`;
    }
    case "no_search_data":
      return `标题已覆盖「${kw}」但暂无 GSC 搜索数据，可观察排名或拓展相关长尾词。`;
    default:
      return `完全未覆盖：建议在商品标题与内容中布局「${kw}」。`;
  }
}

/**
 * 机会关键词：高曝光 + 低 CTR + 排名在前两页（1-20）。
 */
export function findOpportunityKeywords(
  gscRows: any[],
  minImpressions?: number,
  maxCtr?: number,
  products?: any[],
): KeywordOpportunity[] {
  const rows = normalizeGSCRows(gscRows);
  const minImp = minImpressions ?? 500;
  const maxC = maxCtr ?? 0.03;
  const prods = products || [];
  return rows
    .filter(
      (r) =>
        r.impressions >= minImp &&
        r.ctr <= maxC &&
        r.position >= 1 &&
        r.position <= 20,
    )
    .map((r) => {
      const matched = matchProductsByKeyword(r.query, prods);
      const landingPage = deriveLandingPage(r.query);
      const suggestion = buildOpportunitySuggestion(r, matched, landingPage);
      return {
        keyword: r.query,
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
        landingPage,
        suggestion,
        matchedProductIds: matched.map((m) => m.id),
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * 关键词覆盖检查：对比 GSC 数据 / 商品标题覆盖 / 状态。
 */
export function checkKeywordCoverage(
  keywords: string[],
  products: any[],
  gscRows: any[],
): KeywordCoverage[] {
  const rows = normalizeGSCRows(gscRows);
  const gscMap = new Map<string, GSCRow>();
  for (const r of rows) gscMap.set(r.query.toLowerCase(), r);
  const out: KeywordCoverage[] = [];
  for (const kw of keywords || []) {
    const k = (kw || "").trim();
    if (!k) continue;
    const matchedProducts = checkKeywordInTitles(k, products);
    const gscRow = gscMap.get(k.toLowerCase());
    const hasGSCData = !!gscRow;
    const gscImpressions = gscRow ? gscRow.impressions : 0;
    const matchedInTitles = matchedProducts.length > 0;
    let status: KeywordCoverage["status"];
    if (hasGSCData && matchedInTitles) status = "covered";
    else if (hasGSCData && !matchedInTitles) status = "no_title_match";
    else if (!hasGSCData && matchedInTitles) status = "no_search_data";
    else status = "uncovered";
    const suggestion = buildCoverageSuggestion(k, status, matchedProducts);
    out.push({
      keyword: k,
      hasGSCData,
      gscImpressions,
      matchedInTitles,
      matchedProducts,
      status,
      suggestion,
    });
  }
  return out;
}

/**
 * 关键词 → 商品关联：基于 GSC 数据推导落地页，并匹配店铺商品/集合。
 * 注：GSC query 维度缓存不含页面维度，落地页由关键词推导（商品页 / 集合页）。
 */
export function matchKeywordToProducts(
  keyword: string,
  gscRows: any[],
  products: any[],
  collections?: any[],
): KeywordProductMatch[] {
  const rows = normalizeGSCRows(gscRows);
  const k = keyword.trim().toLowerCase();
  const gscRow =
    rows.find((r) => r.query.toLowerCase() === k) ||
    rows.find((r) => r.query.toLowerCase().includes(k)) ||
    null;
  const imp = gscRow?.impressions ?? 0;
  const ctr = gscRow?.ctr ?? 0;
  const matches: KeywordProductMatch[] = [];

  const prodMatches = matchProductsByKeyword(keyword, products);
  if (prodMatches.length > 0) {
    const p = prodMatches[0];
    matches.push({
      landingPage: p.handle ? `/products/${p.handle}` : deriveLandingPage(keyword),
      impressions: imp,
      ctr,
      matchedProduct: p,
      matchStrength: "strong",
    });
  }

  const collMatches = (collections || []).filter((c) => {
    const t = `${c?.title || ""} ${c?.handle || ""}`.toLowerCase();
    const kk = keyword.trim().toLowerCase();
    return t.includes(kk) || kk.split(/\s+/).every((w) => t.includes(w));
  });
  if (collMatches.length > 0) {
    const c = collMatches[0];
    matches.push({
      landingPage: `/collections/${c.handle || c.id || deriveHandleFromTitle(c.title)}`,
      impressions: Math.round(imp * 0.5),
      ctr: ctr * 0.8,
      matchedProduct: null,
      matchStrength: "weak",
    });
  }

  if (matches.length === 0) {
    matches.push({
      landingPage: deriveLandingPage(keyword),
      impressions: imp,
      ctr,
      matchedProduct: null,
      matchStrength: "none",
    });
  }
  return matches;
}

/**
 * 竞争度估算（基于 GSC 数据推断，非外部工具）：
 *  - 搜索量级 = 曝光量 / 平均排名（归一化到 0-100）
 *  - 竞争度 = 争夺该词的商品数代理（0/25/50/75/100），差值大 = 竞争激烈
 *  - 机会分数 = 搜索量级 / (竞争度占比 + 1)
 *  - 优先级 = 机会分数分档 P0/P1/P2
 */
export function estimateCompetition(
  keywords: string[],
  gscRows: any[],
  products?: any[],
): CompetitionEstimate[] {
  const rows = normalizeGSCRows(gscRows);
  const rowMap = new Map<string, GSCRow>();
  for (const r of rows) rowMap.set(r.query.toLowerCase(), r);
  const prods = products || [];

  const base = (keywords || [])
    .map((kw) => {
      const k = (kw || "").trim();
      if (!k) return null;
      const r = rowMap.get(k.toLowerCase());
      const impressions = r?.impressions ?? 0;
      const position = r?.position ?? 0;
      const rawVolume =
        impressions > 0 && position > 0 ? impressions / position : 0;
      const competingCount = matchProductsByKeyword(k, prods).length;
      const competition = Math.min(100, competingCount * 25);
      return { k, rawVolume, competition };
    })
    .filter((x): x is { k: string; rawVolume: number; competition: number } => x !== null);

  const maxRaw = Math.max(1, ...base.map((b) => b.rawVolume));

  const list = base
    .map((b) => {
      const searchVolume = Math.round((b.rawVolume / maxRaw) * 100);
      const compFrac = b.competition / 100;
      const opportunityScore = Math.round(searchVolume / (compFrac + 1));
      const competitionLabel =
        b.competition >= 70 ? "高" : b.competition >= 30 ? "中" : "低";
      const priority: "P0" | "P1" | "P2" =
        opportunityScore >= 70 ? "P0" : opportunityScore >= 40 ? "P1" : "P2";
      return {
        keyword: b.k,
        searchVolume,
        competition: b.competition,
        competitionLabel,
        opportunityScore,
        priority,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  return list;
}
