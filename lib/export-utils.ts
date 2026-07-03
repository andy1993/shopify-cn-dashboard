// ─── Generic CSV Export Utilities ────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Generate CSV string from headers and rows.
 * Returns the raw string (no BOM applied here — caller applies it).
 */
function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsv).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsv).join(","));
  return [headerLine, ...dataLines].join("\n");
}

/**
 * Trigger a browser file download from a Blob.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generic CSV export.
 *
 * @param filename  — downloaded filename (without path)
 * @param headers   — column header strings (will be escaped)
 * @param rows      — data rows, each row is an array of string cells
 * @param watermark — if provided, appended as a final row (for demo mode)
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: string[][],
  watermark?: string,
): void {
  let csv = "\uFEFF" + buildCsv(headers, rows);

  if (watermark) {
    csv += "\n" + escapeCsv(watermark);
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

// ─── Domain-specific exports ──────────────────────────

interface CustomerExport {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  orders_count: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  tags: string;
  accepts_marketing: boolean;
  default_address?: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  } | null;
}

export function exportCustomers(
  customers: CustomerExport[],
  exchangeRate: number,
  shopName: string,
  isDemo?: boolean,
): void {
  const headers = [
    "姓名", "邮箱", "手机号", "国家",
    "总消费金额(¥)", "订单数", "平均客单价(¥)",
    "最近购买时间", "标签", "营销订阅",
    "注册日期", "默认地址",
  ];

  const rows = customers.map((c) => {
    const name = (c.first_name + " " + c.last_name).trim();
    const addr = c.default_address
      ? [c.default_address.address1, c.default_address.city, c.default_address.province, c.default_address.zip].filter(Boolean).join(", ")
      : "";
    const avgOrder = c.orders_count > 0 ? (c.total_spent / c.orders_count).toFixed(2) : "0.00";
    const recentDate = c.updated_at ? new Date(c.updated_at).toLocaleString("zh-CN") : "";
    const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString("zh-CN") : "";

    return [
      name,
      c.email,
      c.phone || "",
      c.default_address?.country || "",
      (c.total_spent * exchangeRate).toFixed(2),
      String(c.orders_count),
      (parseFloat(avgOrder) * exchangeRate).toFixed(2),
      recentDate,
      c.tags,
      c.accepts_marketing ? "是" : "否",
      createdDate,
      addr,
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = shopName + "_客户列表_" + dateStr + ".csv";
  const watermark = isDemo ? "注意：此数据为演示模式模拟数据，非真实店铺数据" : undefined;

  exportToCSV(filename, headers, rows, watermark);
}

interface CompactOrder {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  gateway?: string;
  customer_orders_count?: number;
  shipping_country?: string;
}

export function exportOrders(
  orders: CompactOrder[],
  exchangeRate: number,
  shopName: string,
  extraColumns?: { label: string; getValue: (o: CompactOrder) => string }[],
  isDemo?: boolean,
): void {
  const headers = [
    "订单编号", "下单时间(北京时间)", "目的国", "支付网关",
    "总额 USD", "总额 CNY",
    ...(extraColumns ?? []).map((c) => c.label),
  ];

  const rows = orders.map((o) => {
    const base = [
      String(o.id),
      new Date(o.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      o.shipping_country || "",
      o.gateway || "",
      String(o.total_price),
      (parseFloat(o.total_price) * exchangeRate).toFixed(2),
    ];
    const extras = (extraColumns ?? []).map((c) => c.getValue(o));
    return [...base, ...extras];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = "Shopify_全维度财务对账单_" + shopName + "_" + dateStr + ".csv";
  const watermark = isDemo ? "注意：此数据为演示模式模拟数据，非真实店铺数据" : undefined;

  exportToCSV(filename, headers, rows, watermark);
}
