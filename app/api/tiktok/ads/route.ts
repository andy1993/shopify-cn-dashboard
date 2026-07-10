import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TikTokCredentials {
  accessToken: string;
  advertiserId: string;
}

interface TikTokRow {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  addToCart: number;
  checkout: number;
  purchases: number;
  conversionsValue: number;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, advertiserId, dateRange } = body as any;

    if (action !== "getReports") {
      return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
    }
    if (!credentials?.accessToken || !credentials?.advertiserId) {
      return NextResponse.json({ success: false, error: "缺少 TikTok accessToken 或 advertiserId" }, { status: 400 });
    }

    const advId = String(credentials.advertiserId || advertiserId);
    const today = new Date();
    const since = dateRange?.since || fmtDate(new Date(today.getTime() - 29 * 86400000));
    const until = dateRange?.until || fmtDate(today);

    const params = new URLSearchParams({
      advertiser_id: advId,
      report_type: "AUDIENCE",
      data_level: "AUCTION_AD",
      dimensions: JSON.stringify(["ad_id"]),
      metrics: JSON.stringify([
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpm",
        "conversion",
        "add_to_cart",
        "checkout",
        "purchase",
        "conversion_value",
      ]),
      start_date: since,
      end_date: until,
    });

    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Access-Token": credentials.accessToken,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: "TikTok API 调用失败 HTTP " + res.status + " — " + t.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await res.json();
    if (data.code !== 0) {
      return NextResponse.json(
        { success: false, error: "TikTok API 错误 (" + data.code + "): " + (data.message || "未知") },
        { status: 502 },
      );
    }

    const list = data.data?.list || [];
    const rows: TikTokRow[] = list.map((r: any) => {
      const m = r.metrics || {};
      const spend = Number(m.spend) || 0;
      const impressions = Number(m.impressions) || 0;
      const clicks = Number(m.clicks) || 0;
      const purchases = Number(m.purchase) || 0;
      const conversionsValue = Number(m.conversion_value) || purchases * 180; // 无转化价值时按均价估算
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(m.ctr) || 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      return {
        name: r.dimensions?.ad_id ? "广告 " + r.dimensions.ad_id : "未命名广告",
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        addToCart: Number(m.add_to_cart) || 0,
        checkout: Number(m.checkout) || 0,
        purchases,
        conversionsValue,
      };
    });

    return NextResponse.json({ success: true, platform: "tiktok", currency: "USD", rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[tiktok/ads] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
