import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MetaCredentials {
  accessToken: string;
  adAccountId: string;
}

interface MetaRow {
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

function actionValue(actions: Array<{ action_type: string; value: string | number }> | undefined, type: string): number {
  const a = (actions || []).find((x) => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function normalizeCampaign(r: any): MetaRow {
  const spend = Number(r.spend) || 0;
  const impressions = Number(r.impressions) || 0;
  const clicks = Number(r.clicks) || 0;
  const purchases = actionValue(r.actions, "purchase");
  const convValEntry = (r.action_values || []).find((x: any) => x.action_type === "purchase");
  const conversionsValue = convValEntry ? Number(convValEntry.value) || 0 : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(r.ctr) || 0;
  const cpc = clicks > 0 ? spend / clicks : Number(r.cpc) || 0;
  return {
    name: r.campaign_name || r.adset_name || "未命名广告系列",
    spend,
    impressions,
    clicks,
    ctr,
    cpc,
    addToCart: actionValue(r.actions, "add_to_cart"),
    checkout: actionValue(r.actions, "initiate_checkout"),
    purchases,
    conversionsValue,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, dateRange } = body as any;

    if (action !== "getInsights") {
      return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
    }
    if (!credentials?.accessToken || !credentials?.adAccountId) {
      return NextResponse.json({ success: false, error: "缺少 Meta accessToken 或 adAccountId" }, { status: 400 });
    }

    const act = String(credentials.adAccountId).replace(/^act_/, "");
    const fields = "campaign_name,spend,impressions,clicks,ctr,cpc,actions,action_values";
    const params = new URLSearchParams({
      level: "campaign",
      fields,
      access_token: credentials.accessToken,
    });
    if (dateRange?.since && dateRange?.until) {
      params.set("time_range", JSON.stringify({ since: dateRange.since, until: dateRange.until }));
    } else {
      params.set("date_preset", dateRange?.preset || "last_30d");
    }

    const url = `https://graph.facebook.com/v22.0/act_${encodeURIComponent(act)}/insights?${params.toString()}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20000) });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: "Meta API 调用失败 HTTP " + res.status + " — " + t.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json(
        { success: false, error: "Meta API 错误: " + (data.error.message || JSON.stringify(data.error)) },
        { status: 502 },
      );
    }

    const rows: MetaRow[] = (data.data || []).map(normalizeCampaign);
    return NextResponse.json({ success: true, platform: "meta", currency: "USD", rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[meta/ads] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
