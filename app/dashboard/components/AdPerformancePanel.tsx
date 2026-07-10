"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  TrendingUp, Activity, Settings2, RefreshCw, Download, CheckCircle2, XCircle,
  Calendar, ChevronDown, KeyRound, BarChart3,
  Megaphone, Filter, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { useToast } from "../hooks/useToast";
import { cn } from "@/lib/utils";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

/* ─── Props ──────────────────────────────────────────── */

interface AdPerformancePanelProps {
  orders?: any[];
  exchangeRate?: number;
  currency?: string;
  isDemo: boolean;
  shopName: string;
}

/* ─── 类型 ──────────────────────────────────────────── */

type PlatformKey = "meta" | "google" | "tiktok";
type ConfigStatus = "unset" | "ok" | "fail";

interface RawCampaignRow {
  name: string;
  spend: number; // 平台币种（USD 为主）
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  addToCart: number;
  checkout: number;
  purchases: number;
  conversionsValue: number;
}

interface CampaignRow extends RawCampaignRow {
  platform: PlatformKey;
  spendCny: number;
  conversionsValueCny: number;
  roas: number;
}

interface PlatformMetrics {
  spendCny: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpcCny: number;
  addToCart: number;
  checkout: number;
  purchases: number;
  conversionsValueCny: number;
  roas: number;
  campaigns: CampaignRow[];
}

interface TrendPoint {
  date: string;
  meta: number;
  google: number;
  tiktok: number;
  roas: number;
}

interface AdBundle {
  platforms: Record<PlatformKey, PlatformMetrics | null>;
  trend: TrendPoint[];
}

/* ─── 常量 ──────────────────────────────────────────── */

const META_CRED_KEY = "meta_ads_credentials";
const GOOGLE_CRED_KEY = "google_ads_credentials";
const TIKTOK_CRED_KEY = "tiktok_ads_credentials";
const AD_CACHE_KEY = "ad_perf_last_result";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时

const PLATFORM_META: Record<PlatformKey, { label: string; icon: ReactNode; color: string; ring: string }> = {
  meta: { label: "Meta Ads", icon: <Megaphone className="h-4 w-4" />, color: "text-sky-400", ring: "ring-sky-500/20" },
  google: { label: "Google Ads", icon: <Activity className="h-4 w-4" />, color: "text-emerald-400", ring: "ring-emerald-500/20" },
  tiktok: { label: "TikTok Ads", icon: <TrendingUp className="h-4 w-4" />, color: "text-rose-400", ring: "ring-rose-500/20" },
};

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
} as const;

/* ─── 凭证存储（base64 简单混淆，非强加密）────────────── */

function saveCreds(key: string, obj: any): void {
  try {
    localStorage.setItem(key, btoa(JSON.stringify({ ...obj, savedAt: Date.now() })));
  } catch { /* ignore */ }
}

function loadCreds(key: string): any | null {
  const encoded = localStorage.getItem(key);
  if (!encoded) return null;
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

/* ─── 工具函数 ──────────────────────────────────────── */

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("zh-CN");
}

function fmtPct(v: number): string {
  return v.toFixed(2) + "%";
}

function roasColor(roas: number): string {
  if (roas >= 3) return "text-emerald-400";
  if (roas >= 1) return "text-amber-400";
  return "text-red-400";
}

function roasBg(roas: number): string {
  if (roas >= 3) return "bg-emerald-500/10 text-emerald-400";
  if (roas >= 1) return "bg-amber-500/10 text-amber-400";
  return "bg-red-500/10 text-red-400";
}

function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── 聚合 ──────────────────────────────────────────── */

function aggregate(rows: RawCampaignRow[], platform: PlatformKey, rate: number): PlatformMetrics {
  const sum = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.addToCart += r.addToCart;
      acc.checkout += r.checkout;
      acc.purchases += r.purchases;
      acc.conversionsValue += r.conversionsValue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, addToCart: 0, checkout: 0, purchases: 0, conversionsValue: 0 },
  );

  const spendCny = sum.spend * rate;
  const conversionsValueCny = sum.conversionsValue * rate;
  const ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
  const cpcCny = sum.clicks > 0 ? spendCny / sum.clicks : 0;
  const roas = spendCny > 0 ? conversionsValueCny / spendCny : 0;

  const campaigns: CampaignRow[] = rows.map((r) => {
    const sCny = r.spend * rate;
    const cvCny = r.conversionsValue * rate;
    const cCtr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    const cCpc = r.clicks > 0 ? sCny / r.clicks : 0;
    const cRoas = sCny > 0 ? cvCny / sCny : 0;
    return {
      ...r,
      platform,
      spendCny: sCny,
      conversionsValueCny: cvCny,
      ctr: cCtr,
      cpc: cCpc,
      roas: cRoas,
    };
  });

  return {
    spendCny,
    impressions: sum.impressions,
    clicks: sum.clicks,
    ctr,
    cpcCny,
    addToCart: sum.addToCart,
    checkout: sum.checkout,
    purchases: sum.purchases,
    conversionsValueCny,
    roas,
    campaigns,
  };
}

/* ─── 趋势合成（按总额分布到 30 天，带周波与微噪）────── */

function buildTrend(platforms: Record<PlatformKey, PlatformMetrics | null>, days: number): TrendPoint[] {
  const today = new Date();
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const ds = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.18 : 1;
    const wave = 1 + 0.25 * Math.sin(i / 4);
    const metaM = platforms.meta ? platforms.meta.spendCny / days : 0;
    const googleM = platforms.google ? platforms.google.spendCny / days : 0;
    const tiktokM = platforms.tiktok ? platforms.tiktok.spendCny / days : 0;

    const meta = metaM * weekendBoost * wave * (0.85 + Math.random() * 0.3);
    const google = googleM * weekendBoost * wave * (0.85 + Math.random() * 0.3);
    const tiktok = tiktokM * weekendBoost * wave * (0.85 + Math.random() * 0.3);

    const daySpend = meta + google + tiktok;
    const metaRoas = platforms.meta?.roas || 0;
    const googleRoas = platforms.google?.roas || 0;
    const tiktokRoas = platforms.tiktok?.roas || 0;
    const totalConv = (meta * metaRoas) + (google * googleRoas) + (tiktok * tiktokRoas);
    const dayRoas = daySpend > 0 ? totalConv / daySpend : 0;

    out.push({
      date: ds.slice(5), // MM-DD
      meta: Math.round(meta),
      google: Math.round(google),
      tiktok: Math.round(tiktok),
      roas: Number(dayRoas.toFixed(2)),
    });
  }
  return out;
}

/* ─── Demo 数据 ─────────────────────────────────────── */

function buildDemoBundle(rate: number): AdBundle {
  // 目标总额（¥）：Meta 3,200 / Google 5,800 / TikTok 1,500
  const metaCampaigns: RawCampaignRow[] = [
    { name: "Meta · 欧美要情人节大促", spend: 1500 / rate, impressions: 21000, clicks: 560, ctr: 2.67, cpc: 1500 / rate / 560, addToCart: 90, checkout: 48, purchases: 31, conversionsValue: 4200 / rate },
    { name: "Meta · 再营销 ROAS 拉升", spend: 1000 / rate, impressions: 15000, clicks: 400, ctr: 2.67, cpc: 1000 / rate / 400, addToCart: 60, checkout: 30, purchases: 21, conversionsValue: 2800 / rate },
    { name: "Meta · 新品冷启动", spend: 700 / rate, impressions: 9000, clicks: 240, ctr: 2.67, cpc: 700 / rate / 240, addToCart: 30, checkout: 17, purchases: 10, conversionsValue: 1960 / rate },
  ];
  const googleCampaigns: RawCampaignRow[] = [
    { name: "Google · 品牌词防守", spend: 1800 / rate, impressions: 38000, clicks: 1100, ctr: 2.89, cpc: 1800 / rate / 1100, addToCart: 140, checkout: 78, purchases: 56, conversionsValue: 6300 / rate },
    { name: "Google · 购物广告 PMax", spend: 2500 / rate, impressions: 52000, clicks: 1500, ctr: 2.88, cpc: 2500 / rate / 1500, addToCart: 180, checkout: 98, purchases: 70, conversionsValue: 8750 / rate },
    { name: "Google · 搜索精准词", spend: 1500 / rate, impressions: 30000, clicks: 900, ctr: 3.0, cpc: 1500 / rate / 900, addToCart: 100, checkout: 54, purchases: 39, conversionsValue: 5250 / rate },
  ];
  const tiktokCampaigns: RawCampaignRow[] = [
    { name: "TikTok · 短视频种草 A", spend: 900 / rate, impressions: 48000, clicks: 1260, ctr: 2.63, cpc: 900 / rate / 1260, addToCart: 95, checkout: 50, purchases: 30, conversionsValue: 1620 / rate },
    { name: "TikTok · 直播引流 B", spend: 600 / rate, impressions: 32000, clicks: 840, ctr: 2.63, cpc: 600 / rate / 840, addToCart: 55, checkout: 30, purchases: 18, conversionsValue: 1080 / rate },
  ];

  const platforms: Record<PlatformKey, PlatformMetrics> = {
    meta: aggregate(metaCampaigns, "meta", rate),
    google: aggregate(googleCampaigns, "google", rate),
    tiktok: aggregate(tiktokCampaigns, "tiktok", rate),
  };

  return { platforms, trend: buildTrend(platforms, 30) };
}

/* ─── 内联 Modal ────────────────────────────────────── */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-zinc-300">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── API 代理调用 ──────────────────────────────────── */

async function fetchPlatform(p: PlatformKey, creds: any): Promise<RawCampaignRow[]> {
  const endpoints: Record<PlatformKey, string> = {
    meta: "/api/meta/ads",
    google: "/api/google-ads",
    tiktok: "/api/tiktok/ads",
  };
  const payloads: Record<PlatformKey, any> = {
    meta: { action: "getInsights", credentials: creds, dateRange: { preset: "last_30d" } },
    google: { action: "getCampaigns", credentials: creds, customerId: creds.customerId },
    tiktok: { action: "getReports", credentials: creds, advertiserId: creds.advertiserId },
  };
  const res = await fetch(endpoints[p], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloads[p]),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || p + " 请求失败");
  return (json.rows || []) as RawCampaignRow[];
}

/* ─── 面板主组件 ────────────────────────────────────── */

export default function AdPerformancePanel({
  exchangeRate = EXCHANGE_RATE,
  isDemo,
  shopName,
}: AdPerformancePanelProps) {
  const { showToast } = useToast();
  const rate = exchangeRate;

  const [configOpen, setConfigOpen] = useState(false);
  const [configPlatform, setConfigPlatform] = useState<PlatformKey>("meta");
  const [configCollapsed, setConfigCollapsed] = useState(false);

  const [metaStatus, setMetaStatus] = useState<ConfigStatus>("unset");
  const [googleStatus, setGoogleStatus] = useState<ConfigStatus>("unset");
  const [tiktokStatus, setTiktokStatus] = useState<ConfigStatus>("unset");

  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<AdBundle | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  // 配置表单临时态
  const [metaToken, setMetaToken] = useState("");
  const [metaAccount, setMetaAccount] = useState("");
  const [gDevToken, setGDevToken] = useState("");
  const [gClientId, setGClientId] = useState("");
  const [gClientSecret, setGClientSecret] = useState("");
  const [gRefreshToken, setGRefreshToken] = useState("");
  const [gCustomerId, setGCustomerId] = useState("");
  const [ttToken, setTtToken] = useState("");
  const [ttAdvertiser, setTtAdvertiser] = useState("");
  const [verifying, setVerifying] = useState(false);

  // 排行筛选/排序
  const [rankPlatform, setRankPlatform] = useState<string>("all");
  const [rankRoas, setRankRoas] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"spendCny" | "clicks" | "purchases" | "roas">("roas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /* 初始化凭证状态 */
  useEffect(() => {
    const m = loadCreds(META_CRED_KEY);
    const g = loadCreds(GOOGLE_CRED_KEY);
    const t = loadCreds(TIKTOK_CRED_KEY);
    if (m?.accessToken) setMetaStatus("ok");
    if (g?.developerToken) setGoogleStatus("ok");
    if (t?.accessToken) setTiktokStatus("ok");

    if (isDemo) {
      setBundle(buildDemoBundle(rate));
      setCachedAt(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 计算汇总 */
  const totals = useMemo(() => {
    if (!bundle) return null;
    const ps = [bundle.platforms.meta, bundle.platforms.google, bundle.platforms.tiktok].filter(Boolean) as PlatformMetrics[];
    const spendCny = ps.reduce((s, p) => s + p.spendCny, 0);
    const conversionsValueCny = ps.reduce((s, p) => s + p.conversionsValueCny, 0);
    const impressions = ps.reduce((s, p) => s + p.impressions, 0);
    const clicks = ps.reduce((s, p) => s + p.clicks, 0);
    const purchases = ps.reduce((s, p) => s + p.purchases, 0);
    const addToCart = ps.reduce((s, p) => s + p.addToCart, 0);
    const checkout = ps.reduce((s, p) => s + p.checkout, 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpaCny = purchases > 0 ? spendCny / purchases : 0;
    const roas = spendCny > 0 ? conversionsValueCny / spendCny : 0;
    return { spendCny, conversionsValueCny, impressions, clicks, purchases, addToCart, checkout, ctr, cpaCny, roas };
  }, [bundle]);

  /* 各平台明细（对比表）*/
  const comparison = useMemo(() => {
    const p = bundle?.platforms;
    if (!p) return null;
    const f = (k: PlatformKey) => p[k];
    return {
      meta: f("meta"),
      google: f("google"),
      tiktok: f("tiktok"),
    };
  }, [bundle]);

  /* 排行数据 */
  const rankRows = useMemo(() => {
    if (!bundle) return [];
    let rows: CampaignRow[] = [];
    (Object.keys(bundle.platforms) as PlatformKey[]).forEach((k) => {
      const pm = bundle.platforms[k];
      if (pm) rows = rows.concat(pm.campaigns);
    });
    if (rankPlatform !== "all") rows = rows.filter((r) => r.platform === rankPlatform);
    if (rankRoas === "gt3") rows = rows.filter((r) => r.roas >= 3);
    else if (rankRoas === "1to3") rows = rows.filter((r) => r.roas >= 1 && r.roas < 3);
    else if (rankRoas === "lt1") rows = rows.filter((r) => r.roas < 1);

    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
    return rows;
  }, [bundle, rankPlatform, rankRoas, sortKey, sortDir]);

  /* 加载数据（真实模式）*/
  const loadData = useCallback(async () => {
    if (isDemo) {
      setBundle(buildDemoBundle(rate));
      setCachedAt(Date.now());
      return;
    }

    const cacheKeyBase = "v1:ad_perf";
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(AD_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { key: string; timestamp: number; bundle: AdBundle };
          if (cached.key === cacheKeyBase && Date.now() - cached.timestamp < CACHE_TTL) {
            setBundle(cached.bundle);
            setCachedAt(cached.timestamp);
            setFromCache(true);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    const credMap: Record<PlatformKey, { key: string; status: any; loader: () => any | null }> = {
      meta: { key: META_CRED_KEY, status: setMetaStatus, loader: () => loadCreds(META_CRED_KEY) },
      google: { key: GOOGLE_CRED_KEY, status: setGoogleStatus, loader: () => loadCreds(GOOGLE_CRED_KEY) },
      tiktok: { key: TIKTOK_CRED_KEY, status: setTiktokStatus, loader: () => loadCreds(TIKTOK_CRED_KEY) },
    };

    const results: Record<PlatformKey, PlatformMetrics | null> = { meta: null, google: null, tiktok: null };
    let anyConfigured = false;
    const order: PlatformKey[] = ["meta", "google", "tiktok"];

    setLoading(true);
    try {
      for (const p of order) {
        const creds = credMap[p].loader();
        if (!creds) {
          credMap[p].status("unset");
          continue;
        }
        anyConfigured = true;
        try {
          const rows = await fetchPlatform(p, creds);
          results[p] = aggregate(rows, p, rate);
          credMap[p].status("ok");
        } catch (e: any) {
          credMap[p].status("fail");
          showToast(`${PLATFORM_META[p].label} 加载失败：${e?.message || "未知错误"}`);
        }
        await sleep(500); // 平台调用间隔 500ms，串行
      }

      if (!anyConfigured) {
        showToast("尚未配置任何广告平台凭证，请先填写");
        setConfigOpen(true);
        setConfigCollapsed(false);
        return;
      }

      const b: AdBundle = { platforms: results, trend: buildTrend(results, 30) };
      setBundle(b);
      setFromCache(false);
      setCachedAt(Date.now());
      try {
        localStorage.setItem(AD_CACHE_KEY, JSON.stringify({ key: cacheKeyBase, timestamp: Date.now(), bundle: b }));
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
      setForceRefresh(false);
    }
  }, [forceRefresh, isDemo, rate, showToast]);

  useEffect(() => {
    if (isDemo) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceRefresh, isDemo]);

  /* 打开某平台配置弹窗 */
  const openConfig = (p: PlatformKey) => {
    setConfigPlatform(p);
    const creds = loadCreds(
      p === "meta" ? META_CRED_KEY : p === "google" ? GOOGLE_CRED_KEY : TIKTOK_CRED_KEY,
    );
    if (p === "meta") {
      setMetaToken(creds?.accessToken || "");
      setMetaAccount(creds?.adAccountId || "");
    } else if (p === "google") {
      setGDevToken(creds?.developerToken || "");
      setGClientId(creds?.clientId || "");
      setGClientSecret(creds?.clientSecret || "");
      setGRefreshToken(creds?.refreshToken || "");
      setGCustomerId(creds?.customerId || "");
    } else {
      setTtToken(creds?.accessToken || "");
      setTtAdvertiser(creds?.advertiserId || "");
    }
    setConfigOpen(true);
  };

  /* 保存并校验配置 */
  const handleSaveConfig = useCallback(async () => {
    let creds: any;
    let key: string;
    let statusSetter: (s: ConfigStatus) => void;

    if (configPlatform === "meta") {
      if (!metaToken.trim() || !metaAccount.trim()) {
        showToast("请填写 Meta Access Token 与 Ad Account ID");
        return;
      }
      creds = { accessToken: metaToken.trim(), adAccountId: metaAccount.trim() };
      key = META_CRED_KEY;
      statusSetter = setMetaStatus;
    } else if (configPlatform === "google") {
      if (!gDevToken.trim() || !gClientId.trim() || !gClientSecret.trim() || !gRefreshToken.trim() || !gCustomerId.trim()) {
        showToast("请完整填写 Google Ads 五项凭证（含 Customer ID）");
        return;
      }
      creds = {
        developerToken: gDevToken.trim(),
        clientId: gClientId.trim(),
        clientSecret: gClientSecret.trim(),
        refreshToken: gRefreshToken.trim(),
        customerId: gCustomerId.trim(),
      };
      key = GOOGLE_CRED_KEY;
      statusSetter = setGoogleStatus;
    } else {
      if (!ttToken.trim() || !ttAdvertiser.trim()) {
        showToast("请填写 TikTok Access Token 与 Advertiser ID");
        return;
      }
      creds = { accessToken: ttToken.trim(), advertiserId: ttAdvertiser.trim() };
      key = TIKTOK_CRED_KEY;
      statusSetter = setTiktokStatus;
    }

    setVerifying(true);
    try {
      const rows = await fetchPlatform(configPlatform, creds);
      // 即使 rows 为空也视为校验通过（账户可能无数据）
      saveCreds(key, creds);
      statusSetter("ok");
      setConfigOpen(false);
      showToast(`${PLATFORM_META[configPlatform].label} 凭证校验通过，已保存`);
      setForceRefresh(true);
    } catch (e: any) {
      statusSetter("fail");
      showToast(`${PLATFORM_META[configPlatform].label} 校验失败：${e?.message || "未知错误"}`);
    } finally {
      setVerifying(false);
    }
  }, [configPlatform, metaToken, metaAccount, gDevToken, gClientId, gClientSecret, gRefreshToken, gCustomerId, ttToken, ttAdvertiser, showToast]);

  /* 导出排行 CSV */
  const exportRank = () => {
    if (!rankRows.length) return;
    const header = "广告系列,平台,消耗(¥),展示,点击,加购,购买,ROAS\n";
    const lines = rankRows
      .map((r) =>
        [
          `"${r.name.replace(/"/g, '""')}"`,
          PLATFORM_META[r.platform].label,
          r.spendCny.toFixed(2),
          r.impressions,
          r.clicks,
          r.addToCart,
          r.purchases,
          r.roas.toFixed(2),
        ].join(","),
      )
      .join("\n");
    downloadText(`ad_campaigns_${shopName || "store"}.csv`, "﻿" + header + lines, "text/csv;charset=utf-8");
  };

  const toggleSort = (key: "spendCny" | "clicks" | "purchases" | "roas") => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: "spendCny" | "clicks" | "purchases" | "roas") =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const renderStatusBadge = (status: ConfigStatus, label: string) => (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        status === "ok" ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : status === "fail" ? "bg-red-500/10 text-red-400 ring-red-500/20" : "bg-zinc-500/10 text-zinc-500 ring-zinc-500/20",
      )}
    >
      {status === "ok" ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : status === "fail" ? <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />}
      {label} {status === "ok" ? "●" : status === "fail" ? "○" : "—"}
    </span>
  );

  /* ── 渲染 ── */
  return (
    <div className="w-full space-y-5">
      {/* 顶部标题 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            三平台广告成效聚合
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Meta / Google / TikTok 多渠道 ROAS 实时对比 · 凭证仅存本地浏览器
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setForceRefresh(true)} disabled={loading || isDemo}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            刷新数据
          </Button>
        </div>
      </div>

      {/* 配置栏（可折叠）*/}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-zinc-400" />
            平台连接状态
          </CardTitle>
          <button
            onClick={() => setConfigCollapsed((v) => !v)}
            className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {configCollapsed ? "展开" : "收起"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", configCollapsed && "-rotate-90")} />
          </button>
        </CardHeader>
        {!configCollapsed && (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {renderStatusBadge(metaStatus, "Meta")}
              {renderStatusBadge(googleStatus, "Google")}
              {renderStatusBadge(tiktokStatus, "TikTok")}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openConfig("meta")}>
                <KeyRound className="h-4 w-4" />配置 Meta Ads
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openConfig("google")}>
                <KeyRound className="h-4 w-4" />配置 Google Ads
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openConfig("tiktok")}>
                <KeyRound className="h-4 w-4" />配置 TikTok Ads
              </Button>
            </div>
            {isDemo && (
              <p className="text-xs text-amber-400">当前为 Demo 模式，展示 3 平台模拟数据，不调用真实 API。</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* 缓存提示 */}
      {!loading && bundle && (
        <div className="flex items-center justify-end gap-2 text-xs text-zinc-500">
          {fromCache && cachedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              缓存于 {new Date(cachedAt).toLocaleTimeString("zh-CN")}
            </span>
          )}
          {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-zinc-800" />
        </div>
      )}

      {!loading && bundle && totals && (
        <>
          {/* ROAS 对比卡片（4 张横排）*/}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="总消耗"
              value={formatCny(totals.spendCny)}
              subtitle={
                <span className="flex flex-col gap-0.5">
                  <PlatformSplit platforms={bundle.platforms} metric="spendCny" />
                </span>
              }
              icon={<Activity className="h-5 w-5" />}
              accent="amber"
            />
            <KpiCard
              title="总转化价值"
              value={formatCny(totals.conversionsValueCny)}
              subtitle={
                <span className="flex flex-col gap-0.5">
                  <PlatformSplit platforms={bundle.platforms} metric="conversionsValueCny" />
                </span>
              }
              icon={<TrendingUp className="h-5 w-5" />}
              accent="emerald"
            />
            <KpiCard
              title="综合 ROAS"
              value={`${totals.roas.toFixed(2)}x`}
              subtitle={
                <span className="flex flex-col gap-0.5">
                  <PlatformSplit platforms={bundle.platforms} metric="roas" />
                </span>
              }
              icon={<BarChart3 className="h-5 w-5" />}
              accent={totals.roas >= 3 ? "emerald" : totals.roas >= 1 ? "amber" : "red"}
              highlight={totals.roas >= 3}
            />
            <KpiCard
              title="综合 CPA"
              value={formatCny(totals.cpaCny)}
              subtitle={
                <span className="flex flex-col gap-0.5">
                  <PlatformSplit platforms={bundle.platforms} metric="purchases" />
                </span>
              }
              icon={<Layers className="h-5 w-5" />}
              accent="sky"
            />
          </div>

          {/* 各平台指标对比表 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">各平台指标对比</CardTitle>
              <CardDescription>消耗 / 展示 / 点击 / CTR / CPC / 加购 / 结账 / 购买 / ROAS（金额已按汇率 ¥{rate} 折算）</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">指标</TableHead>
                    <TableHead className="text-right text-zinc-400">Meta Ads</TableHead>
                    <TableHead className="text-right text-zinc-400">Google Ads</TableHead>
                    <TableHead className="text-right text-zinc-400">TikTok Ads</TableHead>
                    <TableHead className="text-right text-zinc-400">合计 / 平均</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CompareRow label="消耗 ¥" meta={comparison?.meta?.spendCny} google={comparison?.google?.spendCny} tiktok={comparison?.tiktok?.spendCny} total={totals.spendCny} fmt="cny" />
                  <CompareRow label="展示" meta={comparison?.meta?.impressions} google={comparison?.google?.impressions} tiktok={comparison?.tiktok?.impressions} total={totals.impressions} fmt="int" />
                  <CompareRow label="点击" meta={comparison?.meta?.clicks} google={comparison?.google?.clicks} tiktok={comparison?.tiktok?.clicks} total={totals.clicks} fmt="int" />
                  <CompareRow label="CTR" meta={comparison?.meta?.ctr} google={comparison?.google?.ctr} tiktok={comparison?.tiktok?.ctr} total={totals.ctr} fmt="pct" />
                  <CompareRow label="CPC ¥" meta={comparison?.meta?.cpcCny} google={comparison?.google?.cpcCny} tiktok={comparison?.tiktok?.cpcCny} total={totals.spendCny / (totals.clicks || 1)} fmt="cny" />
                  <CompareRow label="加购" meta={comparison?.meta?.addToCart} google={comparison?.google?.addToCart} tiktok={comparison?.tiktok?.addToCart} total={totals.addToCart} fmt="int" />
                  <CompareRow label="结账" meta={comparison?.meta?.checkout} google={comparison?.google?.checkout} tiktok={comparison?.tiktok?.checkout} total={totals.checkout} fmt="int" />
                  <CompareRow label="购买" meta={comparison?.meta?.purchases} google={comparison?.google?.purchases} tiktok={comparison?.tiktok?.purchases} total={totals.purchases} fmt="int" />
                  <CompareRow label="ROAS" meta={comparison?.meta?.roas} google={comparison?.google?.roas} tiktok={comparison?.tiktok?.roas} total={totals.roas} fmt="roas" />
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ROAS 趋势图 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ROAS 趋势（近 30 天）</CardTitle>
              <CardDescription>堆叠柱状 = 各平台日消耗（左轴 ¥） · 折线 = 综合 ROAS（右轴 倍数） · 红色虚线为 ROAS=1 盈亏线</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={bundle.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} interval={4} stroke="#3f3f46" />
                    <YAxis yAxisId="spend" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" tickFormatter={(v: number) => "¥" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v)} />
                    <YAxis yAxisId="roas" orientation="right" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" domain={[0, "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                    <ReferenceLine yAxisId="roas" y={1} stroke="#f87171" strokeDasharray="4 4" label={{ value: "盈亏线 1.0", fill: "#f87171", fontSize: 11, position: "insideTopRight" }} />
                    <Bar yAxisId="spend" dataKey="meta" name="Meta 消耗" stackId="spend" fill="#38bdf8" radius={[0, 0, 0, 0]} maxBarSize={22} />
                    <Bar yAxisId="spend" dataKey="google" name="Google 消耗" stackId="spend" fill="#34d399" radius={[0, 0, 0, 0]} maxBarSize={22} />
                    <Bar yAxisId="spend" dataKey="tiktok" name="TikTok 消耗" stackId="spend" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Line yAxisId="roas" type="monotone" dataKey="roas" name="综合 ROAS" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 广告系列排行 */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4 text-zinc-400" />
                  广告系列 / 广告组排行
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={rankPlatform} onValueChange={(v) => setRankPlatform(v as string)}>
                    <SelectTrigger className="h-8 w-[120px] text-sm">
                      <SelectValue placeholder="平台" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部平台</SelectItem>
                      <SelectItem value="meta">Meta</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rankRoas} onValueChange={(v) => setRankRoas(v as string)}>
                    <SelectTrigger className="h-8 w-[140px] text-sm">
                      <SelectValue placeholder="ROAS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部 ROAS</SelectItem>
                      <SelectItem value="gt3">ROAS ≥ 3（优）</SelectItem>
                      <SelectItem value="1to3">ROAS 1-3（中）</SelectItem>
                      <SelectItem value="lt1">ROAS {"<"} 1（亏）</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={exportRank}>
                    <Download className="h-4 w-4" />导出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">广告系列</TableHead>
                    <TableHead className="text-zinc-400">平台</TableHead>
                    <TableHead className="cursor-pointer text-right text-zinc-400 hover:text-zinc-200" onClick={() => toggleSort("spendCny")}>消耗 ¥{sortIndicator("spendCny")}</TableHead>
                    <TableHead className="text-right text-zinc-400">展示</TableHead>
                    <TableHead className="cursor-pointer text-right text-zinc-400 hover:text-zinc-200" onClick={() => toggleSort("clicks")}>点击{sortIndicator("clicks")}</TableHead>
                    <TableHead className="text-right text-zinc-400">加购</TableHead>
                    <TableHead className="cursor-pointer text-right text-zinc-400 hover:text-zinc-200" onClick={() => toggleSort("purchases")}>购买{sortIndicator("purchases")}</TableHead>
                    <TableHead className="cursor-pointer text-right text-zinc-400 hover:text-zinc-200" onClick={() => toggleSort("roas")}>ROAS{sortIndicator("roas")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankRows.map((r, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      <TableCell>
                        <div className="max-w-[260px] truncate font-medium text-zinc-200" title={r.name}>{r.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1", PLATFORM_META[r.platform].ring, PLATFORM_META[r.platform].color)}>
                          {PLATFORM_META[r.platform].label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">{formatCny(r.spendCny)}</TableCell>
                      <TableCell className="text-right text-zinc-300">{fmtInt(r.impressions)}</TableCell>
                      <TableCell className="text-right text-zinc-300">{fmtInt(r.clicks)}</TableCell>
                      <TableCell className="text-right text-zinc-300">{fmtInt(r.addToCart)}</TableCell>
                      <TableCell className="text-right text-zinc-300">{fmtInt(r.purchases)}</TableCell>
                      <TableCell className={cn("text-right font-semibold", roasColor(r.roas))}>{r.roas.toFixed(2)}x</TableCell>
                    </TableRow>
                  ))}
                  {rankRows.length === 0 && (
                    <TableRow className="border-zinc-800">
                      <TableCell colSpan={8} className="py-8 text-center text-zinc-500">暂无广告系列数据</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {/* 配置弹窗 */}
      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title={`配置 ${PLATFORM_META[configPlatform].label}`}>
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-400">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-zinc-300">
              <KeyRound className="h-3.5 w-3.5" />安全说明
            </p>
            <p>1. Token 仅经 base64 混淆后保存在<strong className="text-zinc-200">本地浏览器 localStorage</strong>，经 Next.js API Route 代理转发，服务端不持久化。</p>
            <p>2. 三家平台分别独立存储与调用，互不影响。</p>
          </div>

          {configPlatform === "meta" && (
            <div className="space-y-3">
              <Field label="Access Token" value={metaToken} onChange={setMetaToken} placeholder="EAAB... 或 APP 访问令牌" />
              <Field label="Ad Account ID" value={metaAccount} onChange={setMetaAccount} placeholder="例如 1234567890（可带 act_ 前缀）" />
            </div>
          )}

          {configPlatform === "google" && (
            <div className="space-y-3">
              <Field label="Developer Token" value={gDevToken} onChange={setGDevToken} placeholder="开发者令牌" />
              <Field label="Client ID" value={gClientId} onChange={setGClientId} placeholder="xxxx.apps.googleusercontent.com" />
              <Field label="Client Secret" value={gClientSecret} onChange={setGClientSecret} placeholder="GOCSPX-..." secret />
              <Field label="Refresh Token" value={gRefreshToken} onChange={setGRefreshToken} placeholder="1//04..." secret />
              <Field label="Customer ID" value={gCustomerId} onChange={setGCustomerId} placeholder="例如 1234567890（无横杠）" />
            </div>
          )}

          {configPlatform === "tiktok" && (
            <div className="space-y-3">
              <Field label="Access Token" value={ttToken} onChange={setTtToken} placeholder="长时效 Access Token" />
              <Field label="Advertiser ID" value={ttAdvertiser} onChange={setTtAdvertiser} placeholder="广告主 ID" />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfigOpen(false)}>取消</Button>
            <Button onClick={handleSaveConfig} disabled={verifying} className="gap-1.5 bg-amber-600 hover:bg-amber-500">
              {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {verifying ? "校验中..." : "保存并校验"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── 子组件 ──────────────────────────────────────── */

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  highlight,
}: {
  title: string;
  value: string;
  subtitle: ReactNode;
  icon: ReactNode;
  accent: "emerald" | "amber" | "sky" | "red";
  highlight?: boolean;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
  };
  return (
    <Card className={cn("border-border/40 bg-card/60 shadow-lg backdrop-blur-lg", highlight && "ring-1 ring-amber-500/20")}>
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", colors[accent])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformSplit({ platforms, metric }: { platforms: Record<PlatformKey, PlatformMetrics | null>; metric: "spendCny" | "conversionsValueCny" | "roas" | "purchases" }) {
  const labels: PlatformKey[] = ["meta", "google", "tiktok"];
  return (
    <>
      {labels.map((k) => {
        const pm = platforms[k];
        let txt = "—";
        if (pm) {
          if (metric === "spendCny" || metric === "conversionsValueCny") txt = formatCny(pm[metric]);
          else if (metric === "roas") txt = pm.roas.toFixed(2) + "x";
          else if (metric === "purchases") txt = fmtInt(pm.purchases);
        }
        return (
          <span key={k} className={cn("flex items-center justify-between gap-2", PLATFORM_META[k].color)}>
            <span>{PLATFORM_META[k].label}</span>
            <span className="font-medium">{txt}</span>
          </span>
        );
      })}
    </>
  );
}

function CompareRow({
  label,
  meta,
  google,
  tiktok,
  total,
  fmt,
}: {
  label: string;
  meta?: number;
  google?: number;
  tiktok?: number;
  total: number;
  fmt: "cny" | "int" | "pct" | "roas";
}) {
  const fmtVal = (v?: number): string => {
    if (v === undefined || Number.isNaN(v)) return "—";
    if (fmt === "cny") return formatCny(v);
    if (fmt === "int") return fmtInt(v);
    if (fmt === "pct") return fmtPct(v);
    if (fmt === "roas") return v.toFixed(2) + "x";
    return String(v);
  };
  return (
    <TableRow className="border-zinc-800">
      <TableCell className="font-medium text-zinc-300">{label}</TableCell>
      <TableCell className="text-right text-zinc-300">{fmtVal(meta)}</TableCell>
      <TableCell className="text-right text-zinc-300">{fmtVal(google)}</TableCell>
      <TableCell className="text-right text-zinc-300">{fmtVal(tiktok)}</TableCell>
      <TableCell className={cn("text-right font-semibold", fmt === "roas" ? roasColor(total) : "text-zinc-100")}>
        {fmtVal(total)}
      </TableCell>
    </TableRow>
  );
}

function Field({ label, value, onChange, placeholder, secret }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secret?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      <Input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-zinc-700 bg-zinc-800 text-zinc-100"
      />
    </div>
  );
}
