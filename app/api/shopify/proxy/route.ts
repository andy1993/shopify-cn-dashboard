// ─────────────────────────────────────────────────────────────────────────────
// app/api/shopify/proxy/route.ts
// 服务端代理路由：替浏览器抓取店铺域名下的公开资源（robots.txt / sitemap.xml / 首页 / 竞品页面）
// 原因：这些资源位于 Shopify 店铺域名下，与本项目不同源，浏览器直连会被 CORS 拦截。
// 服务端 fetch 不受同源限制，且可记录首页响应耗时用于速度评估。
// 竞品对比场景：卖家输入竞品域名，由服务端抓取对方公开页面与 robots.txt（无需任何 API 权限）。
// ─────────────────────────────────────────────────────────────────────────────

const JSON_LD_REGEX = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

interface ParsedJsonLd {
  "@type"?: string | string[];
  [key: string]: unknown;
}

function extractJsonLdBlocksServer(html: string): ParsedJsonLd[] {
  const blocks: ParsedJsonLd[] = [];
  if (!html) return blocks;
  let m: RegExpExecArray | null;
  JSON_LD_REGEX.lastIndex = 0;
  while ((m = JSON_LD_REGEX.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) for (const item of parsed) blocks.push(item as ParsedJsonLd);
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).graph)) {
        for (const item of (parsed as any).graph) blocks.push(item as ParsedJsonLd);
      } else if (parsed && typeof parsed === "object") blocks.push(parsed as ParsedJsonLd);
    } catch {
      // 忽略坏块
    }
  }
  return blocks;
}

function hasType(blocks: ParsedJsonLd[], type: string): boolean {
  const lower = type.toLowerCase();
  return blocks.some((b) => {
    const t = b["@type"];
    if (typeof t === "string") return t.toLowerCase() === lower;
    if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === lower);
    return false;
  });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanShopUrl(shopUrl: string): string {
  return String(shopUrl).replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\s+/g, "");
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid json" }, { status: 400 });
  }

  const action = body?.action;
  const shopUrl = body?.shopUrl;
  if (!action || !shopUrl) {
    return NextResponse.json({ success: false, error: "missing action or shopUrl" }, { status: 400 });
  }

  const base = `https://${cleanShopUrl(shopUrl)}`;
  const UA = "Mozilla/5.0 (compatible; ShopifyCNProBot/1.0; +https://github.com/shopify-cn-dashboard)";

  try {
    if (action === "fetchRobotsTxt") {
      const res = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } });
      const content = res.ok ? await res.text() : "";
      return NextResponse.json({ success: true, content, status: res.status });
    }

    if (action === "fetchSitemap") {
      const res = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } });
      const content = res.ok ? await res.text() : "";
      return NextResponse.json({ success: true, content, status: res.status });
    }

    if (action === "fetchHomepage") {
      const t0 = Date.now();
      const res = await fetch(base, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": UA, "Accept": "text/html" } });
      const html = res.ok ? await res.text() : "";
      const ms = Date.now() - t0;
      return NextResponse.json({ success: true, html, status: res.status, ms });
    }

    /* 竞品页面抓取：competitorUrl 为竞品域名，path 可选（默认首页） */
    if (action === "fetchCompetitorPage") {
      const competitorUrl = body?.competitorUrl;
      if (!competitorUrl) {
        return NextResponse.json({ success: false, error: "missing competitorUrl" }, { status: 400 });
      }
      const cleanComp = String(competitorUrl).replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\s+/g, "");
      const path = body?.path ? String(body.path).replace(/^\/+/, "") : "";
      const url = `https://${cleanComp}${path ? "/" + path : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": UA, "Accept": "text/html" } });
      const html = res.ok ? await res.text() : "";
      const blocks = extractJsonLdBlocksServer(html);
      const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleM ? titleM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      const descM = html.match(/<meta[^>]+name\s*=\s*["']?description["']?[^>]*content\s*=\s*["']([^"']*)["']/i)
        || html.match(/<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']?description["']?/i);
      const metaDescription = descM ? descM[1] : "";
      const canonM = html.match(/<link[^>]+rel\s*=\s*["']?canonical["']?[^>]*href\s*=\s*["']([^"']*)["']/i)
        || html.match(/<link[^>]+href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["']?canonical["']?/i);
      const canonical = canonM ? canonM[1] : null;
      const imgTags = html.match(/<img\b[^>]*>/gi) || [];
      let imgAltCount = 0;
      for (const tag of imgTags) {
        const altM = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
        if (altM && altM[1].trim().length > 0) imgAltCount++;
      }
      return NextResponse.json({
        success: true,
        url,
        title,
        metaDescription,
        canonical,
        schemas: blocks,
        imgAltCount,
        hasProductSchema: hasType(blocks, "Product"),
        hasReviewSchema: hasType(blocks, "Review"),
        hasFAQSchema: hasType(blocks, "FAQPage"),
        hasBreadcrumbSchema: hasType(blocks, "BreadcrumbList"),
        hasOrganizationSchema: hasType(blocks, "Organization"),
        status: res.status,
      });
    }

    /* 竞品 robots.txt 抓取 */
    if (action === "fetchCompetitorRobots") {
      const competitorUrl = body?.competitorUrl;
      if (!competitorUrl) {
        return NextResponse.json({ success: false, error: "missing competitorUrl" }, { status: 400 });
      }
      const cleanComp = String(competitorUrl).replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/\s+/g, "");
      const res = await fetch(`https://${cleanComp}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } });
      const content = res.ok ? await res.text() : "";
      return NextResponse.json({ success: true, content, status: res.status });
    }

    return NextResponse.json({ success: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
