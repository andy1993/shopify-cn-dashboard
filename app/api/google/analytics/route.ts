import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken, type GoogleServiceAccount } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GACredentials = GoogleServiceAccount;

interface ReportRequest {
  id: string;
  dateRanges?: Array<{ startDate: string; endDate: string }>;
  dimensions?: Array<{ name: string }>;
  metrics?: Array<{ name: string }>;
  orderBys?: Array<{
    dimension?: { orderType?: string; dimensionName: string };
    metric?: { orderType?: string; metricName: string };
    desc?: boolean;
  }>;
  limit?: number;
  offset?: number;
  dimensionFilter?: any;
  metricFilter?: any;
  keepEmptyRows?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, propertyId, reports } = body as any;

    if (action !== "runReport") {
      return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
    }

    if (!credentials || !credentials.client_email || !credentials.private_key) {
      return NextResponse.json({ success: false, error: "缺少 GA4 服务账号凭证" }, { status: 400 });
    }

    if (!propertyId) {
      return NextResponse.json({ success: false, error: "缺少 GA4 媒体资源 ID（propertyId）" }, { status: 400 });
    }

    const list: ReportRequest[] = Array.isArray(reports) ? reports : [reports];
    if (list.length === 0) {
      return NextResponse.json({ success: false, error: "未提供任何报表请求" }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken(credentials as GACredentials, "analytics");

    const results: Record<string, any> = {};

    for (const req of list) {
      const reportBody: any = {
        dateRanges: req.dateRanges || [{ startDate: "2026-06-01", endDate: "2026-07-01" }],
        dimensions: req.dimensions || [],
        metrics: req.metrics || [],
        keepEmptyRows: req.keepEmptyRows ?? false,
      };
      if (req.orderBys) reportBody.orderBys = req.orderBys;
      if (typeof req.limit === "number") reportBody.limit = req.limit;
      if (typeof req.offset === "number") reportBody.offset = req.offset;
      if (req.dimensionFilter) reportBody.dimensionFilter = req.dimensionFilter;
      if (req.metricFilter) reportBody.metricFilter = req.metricFilter;

      const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(String(propertyId))}:runReport`;

      const gaRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportBody),
        signal: AbortSignal.timeout(20000),
      });

      if (!gaRes.ok) {
        const errText = await gaRes.text().catch(() => "");
        return NextResponse.json({
          success: false,
          error: "GA4 API 调用失败 HTTP " + gaRes.status + " — " + errText.slice(0, 300),
        }, { status: 502 });
      }

      const reportData = await gaRes.json();
      results[req.id] = {
        dimensionHeaders: (reportData.dimensionHeaders || []).map((h: any) => h.name),
        metricHeaders: (reportData.metricHeaders || []).map((h: any) => h.name),
        rows: (reportData.rows || []).map((r: any) => ({
          dimensions: (r.dimensionValues || []).map((d: any) => d.value),
          metrics: (r.metricValues || []).map((m: any) => m.value),
        })),
        rowCount: reportData.rowCount ?? (reportData.rows || []).length,
        totals: reportData.totals || null,
      };
    }

    return NextResponse.json({ success: true, reports: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[google/analytics] error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
