import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GoogleAdsCredentials {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId?: string;
}

interface GoogleRow {
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

async function getAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Google OAuth 失败 HTTP " + res.status);
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error("Google OAuth 未返回 access_token: " + (data.error_description || "未知"));
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, customerId } = body as any;

    if (action !== "getCampaigns") {
      return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
    }
    if (!credentials?.developerToken || !credentials?.clientId || !credentials?.clientSecret || !credentials?.refreshToken) {
      return NextResponse.json({ success: false, error: "缺少 Google Ads 凭证（developerToken / clientId / clientSecret / refreshToken）" }, { status: 400 });
    }
    const cid = customerId || credentials.customerId;
    if (!cid) {
      return NextResponse.json({ success: false, error: "缺少 customerId（客户 ID）" }, { status: 400 });
    }

    const accessToken = await getAccessToken(credentials as GoogleAdsCredentials);

    const query = `SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS`;

    const url = `https://googleads.googleapis.com/v18/customers/${encodeURIComponent(String(cid))}/googleAds:search`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
        "developer-token": credentials.developerToken,
      },
      body: JSON.stringify({ query, pageSize: 10000 }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: "Google Ads API 调用失败 HTTP " + res.status + " — " + t.slice(0, 400) },
        { status: 502 },
      );
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json(
        { success: false, error: "Google Ads API 错误: " + (data.error.message || JSON.stringify(data.error)) },
        { status: 502 },
      );
    }

    const rows: GoogleRow[] = (data.results || []).map((r: any) => {
      const costMicros = Number(r.metrics?.costMicros) || 0;
      const spend = costMicros / 1_000_000; // micros → 账户币种单位
      const impressions = Number(r.metrics?.impressions) || 0;
      const clicks = Number(r.metrics?.clicks) || 0;
      const conversions = Number(r.metrics?.conversions) || 0;
      const conversionsValue = Number(r.metrics?.conversionsValue) || 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(r.metrics?.ctr) || 0;
      const cpc = clicks > 0 ? spend / clicks : Number(r.metrics?.averageCpc || 0) / 1_000_000;
      return {
        name: r.campaign?.name || "未命名广告系列",
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        // Google Ads GAQL 默认未拉取加购/结账细分；如需要可在 query 中追加
        // metrics.add_to_cart（需开启转化细分），此处留 0 由面板提示
        addToCart: 0,
        checkout: 0,
        purchases: conversions,
        conversionsValue,
      };
    });

    return NextResponse.json({ success: true, platform: "google", currency: "USD", rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[google-ads] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
