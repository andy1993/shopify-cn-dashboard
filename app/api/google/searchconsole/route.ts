import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, type GoogleServiceAccount } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GSCredentials = GoogleServiceAccount;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, siteUrl, startDate, endDate, dimensions, rowLimit } = body as any;

    if (action !== "searchAnalytics") {
      return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
    }

    if (!credentials || !credentials.client_email || !credentials.private_key) {
      return NextResponse.json({ success: false, error: "缺少 GSC 凭证" }, { status: 400 });
    }

    if (!siteUrl) {
      return NextResponse.json({ success: false, error: "缺少站点 URL" }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken(credentials as GSCredentials, "webmasters");

    const gscBody: any = {
      startDate: startDate || "2026-06-01",
      endDate: endDate || "2026-07-01",
      dimensions: dimensions || ["query"],
      rowLimit: Math.min(rowLimit || 100, 25000),
    };
    if (body.dimensionFilterGroups) gscBody.dimensionFilterGroups = body.dimensionFilterGroups;
    if (body.aggregationType) gscBody.aggregationType = body.aggregationType;

    const gscRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gscBody),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!gscRes.ok) {
      const errText = await gscRes.text().catch(() => "");
      return NextResponse.json({
        success: false,
        error: "GSC API 调用失败 HTTP " + gscRes.status + " — " + errText.slice(0, 200),
      }, { status: 502 });
    }

    const gscData = await gscRes.json();
    return NextResponse.json({ success: true, data: gscData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[google/searchconsole] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
