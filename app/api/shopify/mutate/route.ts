// ─────────────────────────────────────────────────────────────────────────────
// app/api/shopify/mutate/route.ts
// 服务端代理：对 Shopify Admin API 执行写操作（更新商品标题 / 变体价格）。
// 用途：A/B 测试「开始测试」写入变体 B、「应用胜出版本」写入最终版本。
// 鉴权沿用项目既有模式：X-Shopify-Access-Token + REST 2026-04。
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-04";

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

  const { action, shopUrl, accessToken } = body || {};
  if (!shopUrl || !accessToken) {
    return NextResponse.json({ success: false, error: "missing shopUrl or accessToken" }, { status: 400 });
  }

  const base = `https://${cleanShopUrl(shopUrl)}`;
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  };

  try {
    /* 更新商品标题 */
    if (action === "updateProductTitle") {
      const productId = body.productId;
      const title = body.title;
      if (!productId || typeof title !== "string") {
        return NextResponse.json({ success: false, error: "missing productId or title" }, { status: 400 });
      }
      const res = await fetch(`${base}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ product: { id: productId, title } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ success: true, product: data.product });
    }

    /* 更新变体价格 */
    if (action === "updateVariantPrice") {
      const variantId = body.variantId;
      const price = body.price;
      if (!variantId || price == null) {
        return NextResponse.json({ success: false, error: "missing variantId or price" }, { status: 400 });
      }
      const res = await fetch(`${base}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ variant: { id: variantId, price: String(price) } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ success: true, variant: data.variant });
    }

    return NextResponse.json({ success: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "mutate failed" },
      { status: 502 },
    );
  }
}
