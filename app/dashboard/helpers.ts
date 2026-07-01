// ─── Shared Dashboard Helpers ──────────────────────────

const cnyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCny(value: number): string {
  return cnyFormatter.format(value);
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

export function getInventoryBadge(
  inventory: number,
): { label: string; variant: "destructive" | "outline" | "default" } | null {
  if (inventory <= 0) return { label: "缺货", variant: "destructive" };
  if (inventory < 10) return { label: "库存紧张", variant: "destructive" };
  if (inventory < 30) return { label: "库存偏低", variant: "outline" };
  return null;
}

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
}

export function findNearestHoliday(holidays: Holiday[]): Holiday | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = holidays
    .filter((h) => new Date(h.date + "T00:00:00") >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] ?? null;
}

export function getCountdown(targetDate: string) {
  const now = Date.now();
  const target = new Date(targetDate + "T00:00:00").getTime();
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}
