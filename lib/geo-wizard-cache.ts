// ─────────────────────────────────────────────────────────────────────────────
// lib/geo-wizard-cache.ts
// GEO 优化向导的本地缓存与报告层。
// 各步骤结果通过 localStorage 共享，键名为 geo_wizard_step1..5。
// 同时兼容已有面板的遗留键（competitor_geo_result → step4），
// 这样即使尚未改造各面板写 geo_wizard_stepN，向导也能读到真实数据。
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEYS = [
  "geo_wizard_step1",
  "geo_wizard_step2",
  "geo_wizard_step3",
  "geo_wizard_step4",
  "geo_wizard_step5",
] as const;

/** 各面板遗留结果键（用于兼容读取） */
const LEGACY_KEYS: Record<number, string> = {
  4: "competitor_geo_result",
};

export const GEO_WIZARD_EVENT = "geo-wizard-refresh";
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export function readJson<T>(key: string): T | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐身模式 / 配额超限：静默忽略 */
  }
}

/** 单步缓存结构：result 为完整结果副本 + 写入时间戳 */
export interface GeoWizardStepCache<T = any> {
  result: T;
  timestamp: number;
}

export interface GeoWizardCache {
  step1: GeoWizardStepCache | null; // AI 可索引性
  step2: GeoWizardStepCache | null; // Schema 检测
  step3: GeoWizardStepCache | null; // Schema 生成
  step4: GeoWizardStepCache | null; // 竞品对标
  step5: GeoWizardStepCache | null; // AI 引用模拟
}

function emptyCache(): GeoWizardCache {
  return { step1: null, step2: null, step3: null, step4: null, step5: null };
}

export function loadGeoWizardCache(): GeoWizardCache {
  const cache = emptyCache();
  for (let i = 1; i <= 5; i++) {
    const primary = readJson<GeoWizardStepCache>(CACHE_KEYS[i - 1]);
    if (primary) {
      (cache as any)[`step${i}`] = primary;
      continue;
    }
    // 兼容遗留键
    const legacyKey = LEGACY_KEYS[i];
    if (legacyKey) {
      const legacy = readJson<any>(legacyKey);
      if (legacy) {
        (cache as any)[`step${i}`] = { result: legacy, timestamp: Date.now() };
      }
    }
  }
  return cache;
}

export function saveGeoWizardCache(step: number, result: any): void {
  if (step < 1 || step > 5) return;
  const value: GeoWizardStepCache = { result, timestamp: Date.now() };
  writeJson(CACHE_KEYS[step - 1], value);
}

/** 保存并广播刷新事件，供向导（或自身）实时更新 */
export function publishGeoWizardStep(step: number, result: any): void {
  saveGeoWizardCache(step, result);
  notifyGeoWizardRefresh();
}

export function notifyGeoWizardRefresh(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GEO_WIZARD_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export function clearGeoWizardCache(): void {
  try {
    if (typeof window !== "undefined") {
      CACHE_KEYS.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {
    /* ignore */
  }
}

export function isCacheExpired(timestamp: number, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAgeMs;
}

/** 单步结果是否过期（过期视为「待操作」） */
export function isStepExpired(cache: GeoWizardStepCache | null, maxAgeMs?: number): boolean {
  if (!cache) return true;
  return isCacheExpired(cache.timestamp, maxAgeMs);
}

// ─── 健康分计算 ──────────────────────────────────────────────────────────────
// 三维加权：AI 可索引性 40% + Schema 覆盖率 40% + 内容质量 20%
export function computeGeoHealthScore(cache: GeoWizardCache): number {
  const s1 = cache.step1?.result?.score ?? 0; // 0~100
  const s2 = cache.step2?.result?.siteHealth ?? 0; // 0~100

  // 内容质量代理：取内容型 Schema 类型的平均覆盖率（Article/FAQPage/HowTo/Blog）
  let content = 0;
  const r2 = cache.step2?.result;
  if (r2?.results && Array.isArray(r2.results)) {
    const contentTypes = ["Article", "FAQPage", "HowTo", "BlogPosting", "Blog"];
    const arr = r2.results.filter((x: any) => contentTypes.includes(x.schemaType));
    content = arr.length
      ? Math.round((arr.reduce((s: number, x: any) => s + (x.coverageRate || 0), 0) / arr.length) * 100)
      : s2;
  }

  return Math.round(0.4 * s1 + 0.4 * s2 + 0.2 * content);
}

export function geoHealthTone(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "优秀", color: "🟢" };
  if (score >= 60) return { label: "良好", color: "🟡" };
  if (score >= 40) return { label: "需改进", color: "🟠" };
  return { label: "较差", color: "🔴" };
}

// ─── 报告生成（Markdown） ─────────────────────────────────────────────────────
function fmtTime(ts?: number): string {
  if (!ts) return "未执行";
  try {
    return new Date(ts).toLocaleString("zh-CN");
  } catch {
    return "未执行";
  }
}

export function generateGeoReport(cache: GeoWizardCache, shopName: string): string {
  const score = computeGeoHealthScore(cache);
  const tone = geoHealthTone(score);
  const lines: string[] = [];

  lines.push(`# ${shopName || "未命名店铺"} GEO 健康报告`);
  lines.push(`生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("");
  lines.push(`## 📊 总体评分`);
  lines.push(`健康分：${score}/100 ${tone.color} ${tone.label}`);
  lines.push("");

  // Step 1
  lines.push(`## 🔍 Step 1: AI 可索引性`);
  const s1 = cache.step1?.result;
  if (s1) {
    lines.push(`评分：${s1.score}/100`);
    const bots = s1.bots || {};
    lines.push(
      `GPTBot: ${bots.gptBotBlocked ? "❌" : "✅"} | PerplexityBot: ${bots.perplexityBotBlocked ? "❌" : "✅"} | Google-Extended: ${bots.googleExtendedBlocked ? "❌" : "✅"} | CCBot: ${bots.ccBotBlocked ? "❌" : "✅"}`
    );
    if (s1.robotsContent) lines.push(`\n\`\`\`\n${s1.robotsContent}\n\`\`\``);
  } else {
    lines.push(`尚未扫描`);
  }
  lines.push("");

  // Step 2
  lines.push(`## 📋 Step 2: Schema 检测`);
  const s2 = cache.step2?.result;
  if (s2?.results && Array.isArray(s2.results)) {
    lines.push(`评分：${s2.siteHealth}/100`);
    s2.results.forEach((r: any) => {
      const covered = r.coveredPages ?? 0;
      const total = r.totalPages ?? 0;
      const pct = total ? Math.round((covered / total) * 100) : 0;
      const miss = total - covered;
      lines.push(`${r.title} (${r.schemaType}): ${covered}/${total} (${pct}%) — ${miss > 0 ? miss + " 件缺失" : "全覆盖"}`);
    });
  } else {
    lines.push(`尚未扫描`);
  }
  lines.push("");

  // Step 3
  lines.push(`## 🪄 Step 3: Schema 生成`);
  const s3 = cache.step3?.result;
  if (s3?.done) {
    const counts = s3.counts || {};
    const parts = Object.keys(counts).map((k) => `${k}(${counts[k]}件)`);
    lines.push(`已注入：${parts.join(" + ") || "无"}`);
    lines.push(`注入时间：${fmtTime(s3.injectedAt)}`);
  } else {
    lines.push(`待操作：根据 Step 2 检测结果生成可注入清单`);
  }
  lines.push("");

  // Step 4
  lines.push(`## ⚔️ Step 4: 竞品对标`);
  const s4 = cache.step4?.result;
  if (s4?.comparisons && Array.isArray(s4.comparisons)) {
    lines.push(`对比竞品：${s4.comparisons.length} 个`);
    const gaps: string[] = [];
    s4.comparisons.forEach((c: any) => {
      (c.todos || []).slice(0, 3).forEach((t: any) => gaps.push(`- [${t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟠" : "🟡"}] ${t.title}`));
    });
    if (gaps.length) {
      lines.push(`差距最大的项：`);
      lines.push(gaps.slice(0, 3).join("\n"));
    }
  } else {
    lines.push(`尚未对比`);
  }
  lines.push("");

  // Step 5
  lines.push(`## 🤖 Step 5: 引用概率`);
  const s5 = cache.step5?.result;
  if (s5?.top3 && Array.isArray(s5.top3)) {
    lines.push(`测试查询："${s5.query || ""}"`);
    lines.push(`TOP 3：`);
    s5.top3.forEach((r: any, i: number) => {
      lines.push(`${i + 1}. ${r.title} — ${r.score}% (${r.status})`);
    });
  } else {
    lines.push(`尚未测试`);
  }
  lines.push("");

  // 优先修复建议
  lines.push(`## 💡 优先修复建议`);
  const tips: string[] = [];
  if (s1?.bots) {
    const blocked = Object.entries(s1.bots).filter(([, v]) => v);
    if (blocked.length) tips.push(`1. 🔴 robots.txt 屏蔽了 ${blocked.map(([k]) => k).join("、")}，AI 无法抓取站点，请立即修复。`);
  }
  if (s2?.results && Array.isArray(s2.results)) {
    const product = s2.results.find((r: any) => r.schemaType === "Product");
    if (product && product.missingFields?.length) {
      const titles = Array.from(new Set(product.missingFields.map((m: any) => m.pageTitle))).slice(0, 3);
      tips.push(`2. 🟠 ${product.totalPages - product.coveredPages} 件商品缺少 Product Schema 关键字段（如 ${titles.join("、")}）。`);
    }
    const faq = s2.results.find((r: any) => r.schemaType === "FAQPage");
    if (faq && faq.coveredPages === 0) tips.push(`3. 🟡 全站缺失 FAQPage Schema，建议为含问答内容的商品补充。`);
  }
  if (!tips.length) tips.push(`当前未检测到高优先级问题，可继续完善内容与 Schema 覆盖。`);
  lines.push(tips.join("\n"));
  lines.push("");

  return lines.join("\n");
}

/** 触发浏览器下载报告（.md） */
export function downloadGeoReport(cache: GeoWizardCache, shopName: string): void {
  try {
    const md = generateGeoReport(cache, shopName);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GEO报告_${shopName || "shop"}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}
