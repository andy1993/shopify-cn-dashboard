/* ─── Operation Logger — localStorage-backed audit trail ─── */

const STORAGE_KEY = "operation_history";

export interface OperationDetail {
  targetType: "product" | "variant";
  targetId: number;
  targetName: string;
  field: "price" | "inventory" | "tags" | "status" | "title" | "description";
  oldValue: unknown;
  newValue: unknown;
  shopUrl: string;
  rolledBack: boolean;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  actionType: "batch_price" | "batch_inventory" | "batch_tags" | "batch_status" | "single_price" | "single_inventory" | "product_update";
  summary: string;
  details: OperationDetail[];
  status: "completed" | "failed" | "rolled_back";
  totalItems: number;
  successCount: number;
  failCount: number;
}

export function addOperationLog(log: OperationLog): void {
  const history = getOperationHistory();
  history.unshift(log);
  if (history.length > 100) history.length = 100;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* quota */ }
}

export function getOperationHistory(): OperationLog[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

export function markRolledBack(logId: string): void {
  const history = getOperationHistory();
  const entry = history.find((l) => l.id === logId);
  if (entry) {
    entry.status = "rolled_back";
    entry.details.forEach((d) => { d.rolledBack = true; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* quota */ }
  }
}

export function getRecentCount(hours = 24): number {
  const since = Date.now() - hours * 3600000;
  return getOperationHistory().filter((l) => new Date(l.timestamp).getTime() > since).length;
}
