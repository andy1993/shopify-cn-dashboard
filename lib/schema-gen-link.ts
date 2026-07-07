// ─────────────────────────────────────────────────────────────────────────────
// lib/schema-gen-link.ts
// SchemaAuditPanel「批量修复」→ SchemaGeneratorPanel 的一次性参数传递
// 通过模块级单例在 SPA 内跨面板传递，避免 URL 复杂度。
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaGenLinkParams {
  /** 来源类型：缺失字段修复 */
  scope: "missing_field";
  /** 缺失的字段名（如 brand / offers.priceCurrency / image） */
  fieldName: string;
  /** 对应的 Schema 类型 */
  schemaType: string;
  /** 由审计面板预筛出的待修复商品 ID（可选） */
  productIds?: number[];
}

let pending: SchemaGenLinkParams | null = null;

export function setSchemaGenLink(params: SchemaGenLinkParams | null): void {
  pending = params;
}

export function consumeSchemaGenLink(): SchemaGenLinkParams | null {
  const p = pending;
  pending = null;
  return p;
}
