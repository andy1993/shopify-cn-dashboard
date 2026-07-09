"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  TrendingUp, Activity, Settings2, RefreshCw, Download, CheckCircle2, XCircle,
  AlertTriangle, Calendar, ChevronDown, ExternalLink, KeyRound, Link2, BarChart4,
  PieChart as PieChartIcon, Users, MonitorSmartphone, FileText, Globe, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { useToast } from "../hooks/useToast";
import { cn } from "@/lib/utils";
import {
  parseTrafficTrend, parseTrafficSources, parseUserBehavior, parsePageAnalytics,
  assignFallbackColors, type GA4Report, type SourceSlice, type BehaviorMetric, type PageRow,
  type ShopifyEntities,
} from "@/lib/ga4-utils";

/* ─── Props ──────────────────────────────────────────── */

interface AnalyticsPanelProps {
  isDemo: boolean;
  shopUrl: string;
  shopName: string;
  fullProducts?: any[];
  collections?: any;
  pages?: any[];
  blogs?: any[];
}

/* ─── 类型 ──────────────────────────────────────────── */

interface GA4Credentials { client_email: string; private_key: string; }

type RangeType = "7" | "30" | "90" | "custom";
type ConfigStatus = "unset" | "ok" | "fail";

interface ParsedBundle {
  traffic: ReturnType<typeof parseTrafficTrend>;
  sources: SourceSlice[];
  device: BehaviorMetric[];
  newReturning: BehaviorMetric[];
  pages: PageRow[];
}

/* ─── 常量 ──────────────────────────────────────────── */

const GA4_CRED_KEY = "ga4_credentials";
const GA4_CACHE_KEY = "ga4_last_result";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时

const PIE_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#38bdf8"];

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
} as const;

/* ─── 凭证存储（base64 简单混淆，非强加密）────────────── */

function saveGA4Credentials(jsonContent: string, propertyId: string): void {
  const encoded = btoa(JSON.stringify({ json: jsonContent, propertyId, savedAt: Date.now() }));
  localStorage.setItem(GA4_CRED_KEY, encoded);
}

function loadGA4Credentials(): { json: string; propertyId: string } | null {
  const encoded = localStorage.getItem(GA4_CRED_KEY);
  if (!encoded) return null;
  try {
    const decoded = JSON.parse(atob(encoded));
    return { json: decoded.json, propertyId: decoded.propertyId };
  } catch {
    return null;
  }
}

/* ─── 工具函数 ──────────────────────────────────────── */

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}分${r}秒` : `${r}秒`;
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function buildCsvPages(rows: PageRow[]): string {
  const header = "页面路径,页面标题,匹配实体,浏览量,会话数,互动率,平均互动时长,转化数\n";
  const lines = rows
    .map((r) =>
      [
        `"${r.path.replace(/"/g, '""')}"`,
        `"${(r.title || "").replace(/"/g, '""')}"`,
        `"${(r.matched?.label || "未知").replace(/"/g, '""')}"`,
        r.pageviews,
        r.sessions,
        fmtPct(r.engagementRate),
        Math.round(r.avgEngagementTime),
        r.conversions,
      ].join(",")
    )
    .join("\n");
  return "﻿" + header + lines;
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

/* ─── Demo 数据 ─────────────────────────────────────── */

function buildDemoBundle(days: number, shopName: string): ParsedBundle {
  const trafficRows: GA4Report["rows"] = [];
  const today = new Date();
  let totalSessions = 0;
  let totalUsers = 0;
  let totalPv = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const ds = fmtDate(d);
    const dow = d.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.25 : 1;
    const wave = 1 + 0.3 * Math.sin(i / 5);
    const sessions = Math.round(420 * weekendBoost * wave + Math.random() * 120);
    const users = Math.round(sessions * (0.78 + Math.random() * 0.08));
    const pv = Math.round(sessions * (3.1 + Math.random() * 0.8));
    totalSessions += sessions;
    totalUsers += users;
    totalPv += pv;
    trafficRows.push({
      dimensions: [ds],
      metrics: [
        String(sessions),
        String(users),
        String(pv),
        (0.55 + Math.random() * 0.15).toFixed(3),
        (90 + Math.random() * 60).toFixed(1),
      ],
    });
  }

  const trafficReport: GA4Report = {
    dimensionHeaders: ["date"],
    metricHeaders: ["sessions", "activeUsers", "screenPageViews", "engagementRate", "averageSessionDuration"],
    rows: trafficRows,
    rowCount: trafficRows.length,
    totals: null,
  };

  const sourceDefs = [
    { ch: "Organic Search", sessions: 9200 },
    { ch: "Paid Search", sessions: 5400 },
    { ch: "Direct", sessions: 4100 },
    { ch: "Organic Social", sessions: 3300 },
    { ch: "Referral", sessions: 2100 },
    { ch: "Email", sessions: 1800 },
    { ch: "Paid Social", sessions: 1500 },
    { ch: "Display", sessions: 700 },
  ];
  const sourcesReport: GA4Report = {
    dimensionHeaders: ["sessionDefaultChannelGroup"],
    metricHeaders: ["sessions"],
    rows: sourceDefs.map((s) => ({ dimensions: [s.ch], metrics: [String(Math.round(s.sessions * (days / 30)))] })),
    rowCount: sourceDefs.length,
    totals: null,
  };

  const deviceReport: GA4Report = {
    dimensionHeaders: ["deviceCategory"],
    metricHeaders: ["sessions", "activeUsers", "engagementRate", "averageSessionDuration"],
    rows: [
      { dimensions: ["desktop"], metrics: ["6800", "5400", "0.62", "142.5"] },
      { dimensions: ["mobile"], metrics: ["15200", "12100", "0.58", "98.3"] },
      { dimensions: ["tablet"], metrics: ["2400", "1900", "0.61", "120.1"] },
    ],
    rowCount: 3,
    totals: null,
  };

  const newR = Math.round(totalSessions * 0.63);
  const retR = totalSessions - newR;
  const newReturningReport: GA4Report = {
    dimensionHeaders: ["newVsReturning"],
    metricHeaders: ["sessions", "activeUsers", "engagementRate", "averageSessionDuration"],
    rows: [
      { dimensions: ["new"], metrics: [String(newR), String(Math.round(newR * 0.9)), "0.54", "88.2"] },
      { dimensions: ["returning"], metrics: [String(retR), String(Math.round(retR * 1.05)), "0.71", "165.4"] },
    ],
    rowCount: 2,
    totals: null,
  };

  const pageDefs = [
    { path: "/", title: shopName + " - 官网首页", pv: 18200, type: "home" as const, label: "店铺首页" },
    { path: "/collections/all", title: "全部商品", pv: 12400, type: "collection" as const, label: "全部商品" },
    { path: "/products/wireless-earbuds-pro", title: "无线降噪耳机 Pro", pv: 9800, type: "product" as const, label: "无线降噪耳机 Pro" },
    { path: "/products/smart-watch-x2", title: "智能手表 X2", pv: 7600, type: "product" as const, label: "智能手表 X2" },
    { path: "/products/bluetooth-speaker-mini", title: "便携蓝牙音箱 Mini", pv: 6100, type: "product" as const, label: "便携蓝牙音箱 Mini" },
    { path: "/collections/electronics", title: "电子数码", pv: 5400, type: "collection" as const, label: "电子数码" },
    { path: "/blogs/news/2026-gift-guide", title: "2026 跨境选品礼物指南", pv: 4300, type: "blog" as const, label: "2026 跨境选品礼物指南" },
    { path: "/products/thermal-mug-500", title: "保温杯 500ml", pv: 3900, type: "product" as const, label: "保温杯 500ml" },
    { path: "/products/mechanical-keyboard-tkl", title: "机械键盘 TKL", pv: 3200, type: "product" as const, label: "机械键盘 TKL" },
    { path: "/pages/about", title: "关于我们", pv: 2800, type: "page" as const, label: "关于我们" },
    { path: "/products/action-camera-4k", title: "4K 运动相机", pv: 2500, type: "product" as const, label: "4K 运动相机" },
    { path: "/collections/home-living", title: "家居生活", pv: 2100, type: "collection" as const, label: "家居生活" },
    { path: "/products/robot-vacuum-s7", title: "扫地机器人 S7", pv: 1800, type: "product" as const, label: "扫地机器人 S7" },
    { path: "/pages/shipping-returns", title: "配送与退换", pv: 1500, type: "page" as const, label: "配送与退换" },
    { path: "/blogs/news/top-10-earbuds", title: "Top 10 降噪耳机横评", pv: 1200, type: "blog" as const, label: "Top 10 降噪耳机横评" },
  ];
  const pagesReport: GA4Report = {
    dimensionHeaders: ["pagePath", "pageTitle"],
    metricHeaders: ["screenPageViews", "sessions", "engagementRate", "averageEngagementTime", "conversions"],
    rows: pageDefs.map((p, idx) => ({
      dimensions: [p.path, p.title],
      metrics: [
        String(p.pv),
        String(Math.round(p.pv * (0.7 + Math.random() * 0.15))),
        (0.45 + Math.random() * 0.25).toFixed(3),
        (40 + Math.random() * 120).toFixed(1),
        String(idx < 5 ? Math.round(p.pv * 0.012) : Math.round(p.pv * 0.004)),
      ],
    })),
    rowCount: pageDefs.length,
    totals: null,
  };

  const entities: ShopifyEntities = {
    products: (pageDefs.filter((p) => p.type === "product").map((p) => ({ title: p.label, handle: p.path.split("/")[2] }))),
    collections: {
      smart: pageDefs.filter((p) => p.type === "collection").map((p) => ({ title: p.label, handle: p.path.split("/")[2] })),
      custom: [],
    },
    pages: pageDefs.filter((p) => p.type === "page").map((p) => ({ title: p.label, handle: p.path.split("/")[2] })),
    blogs: [{ title: "博客", handle: "news", articles: pageDefs.filter((p) => p.type === "blog").map((p) => ({ title: p.label, handle: p.path.split("/")[3] || "post" })) }],
  };

  return {
    traffic: parseTrafficTrend(trafficReport),
    sources: assignFallbackColors(parseTrafficSources(sourcesReport)),
    device: parseUserBehavior(deviceReport, "设备"),
    newReturning: parseUserBehavior(newReturningReport, "用户类型"),
    pages: parsePageAnalytics(pagesReport, entities),
  };
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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

/* ─── GA4 API 代理调用 ──────────────────────────────── */

async function callGA4(payload: any): Promise<any> {
  const res = await fetch("/api/google/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "GA4 请求失败");
  return json.reports;
}

/* ─── 面板主组件 ────────────────────────────────────── */

export default function AnalyticsPanel({
  isDemo,
  shopUrl,
  shopName,
  fullProducts,
  collections,
  pages,
  blogs,
}: AnalyticsPanelProps) {
  const { showToast } = useToast();

  const [credJson, setCredJson] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatus>("unset");
  const [verifying, setVerifying] = useState(false);

  const [rangeType, setRangeType] = useState<RangeType>("30");
  const [customStart, setCustomStart] = useState<string>(fmtDate(new Date(Date.now() - 29 * 86400000)));
  const [customEnd, setCustomEnd] = useState<string>(fmtDate(new Date()));

  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  const entities: ShopifyEntities = useMemo(
    () => ({
      products: fullProducts?.map((p: any) => ({ title: p.title, handle: p.handle })),
      collections: collections,
      pages: pages?.map((p: any) => ({ title: p.title, handle: p.handle })),
      blogs: blogs?.map((b: any) => ({ title: b.title, handle: b.handle, articles: b.articles })),
    }),
    [fullProducts, collections, pages, blogs]
  );

  /* 初始化凭证 */
  useEffect(() => {
    const saved = loadGA4Credentials();
    if (saved) {
      setCredJson(saved.json);
      setPropertyId(saved.propertyId);
      setConfigStatus("ok");
    }
    if (isDemo) {
      setBundle(buildDemoBundle(30, shopName));
      setCachedAt(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 计算日期范围 */
  const getRange = useCallback(() => {
    const today = new Date();
    let days = 30;
    if (rangeType === "7") days = 7;
    else if (rangeType === "30") days = 30;
    else if (rangeType === "90") days = 90;
    else {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
    }
    const end = rangeType === "custom" ? new Date(customEnd) : today;
    const start = rangeType === "custom" ? new Date(customStart) : new Date(today.getTime() - (days - 1) * 86400000);
    const startDate = fmtDate(start);
    const endDate = fmtDate(end);
    return { startDate, endDate, days, key: `${startDate}_${endDate}` };
  }, [rangeType, customStart, customEnd]);

  const parseReports = useCallback((reports: Record<string, GA4Report>): ParsedBundle => {
    return {
      traffic: parseTrafficTrend(reports.traffic),
      sources: assignFallbackColors(parseTrafficSources(reports.sources)),
      device: parseUserBehavior(reports.device, "设备"),
      newReturning: parseUserBehavior(reports.newReturning, "用户类型"),
      pages: parsePageAnalytics(reports.pages, entities),
    };
  }, [entities]);

  /* 加载数据 */
  const loadData = useCallback(async () => {
    const range = getRange();
    const cacheKey = "v1:" + (propertyId || "?") + ":" + range.key;

    if (!forceRefresh && !isDemo) {
      try {
        const raw = localStorage.getItem(GA4_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { key: string; timestamp: number; bundle: ParsedBundle };
          if (cached.key === cacheKey && Date.now() - cached.timestamp < CACHE_TTL) {
            setBundle(cached.bundle);
            setCachedAt(cached.timestamp);
            setFromCache(true);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    if (isDemo) {
      setBundle(buildDemoBundle(range.days, shopName));
      setCachedAt(Date.now());
      setFromCache(false);
      return;
    }

    const saved = loadGA4Credentials();
    if (!saved) {
      setConfigStatus("unset");
      showToast("尚未配置 GA4 凭证，请先填写服务账号 JSON 与媒体资源 ID");
      setConfigOpen(true);
      return;
    }

    let creds: GA4Credentials;
    try {
      creds = JSON.parse(saved.json);
    } catch {
      setConfigStatus("fail");
      showToast("GA4 凭证 JSON 解析失败，请检查格式");
      return;
    }
    if (!creds.client_email || !creds.private_key) {
      setConfigStatus("fail");
      showToast("GA4 凭证缺少 client_email 或 private_key");
      return;
    }

    setLoading(true);
    try {
      const reports = await callGA4({
        action: "runReport",
        credentials: creds,
        propertyId: saved.propertyId,
        reports: [
          {
            id: "traffic",
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "sessions" },
              { name: "activeUsers" },
              { name: "screenPageViews" },
              { name: "engagementRate" },
              { name: "averageSessionDuration" },
            ],
            orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" } }],
            limit: 10000,
          },
          {
            id: "sources",
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }],
            orderBys: [{ metric: { metricName: "sessions", orderType: "DESCENDING" } }],
            limit: 20,
          },
          {
            id: "device",
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: "deviceCategory" }],
            metrics: [
              { name: "sessions" },
              { name: "activeUsers" },
              { name: "engagementRate" },
              { name: "averageSessionDuration" },
            ],
            orderBys: [{ metric: { metricName: "sessions", orderType: "DESCENDING" } }],
            limit: 10,
          },
          {
            id: "newReturning",
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: "newVsReturning" }],
            metrics: [
              { name: "sessions" },
              { name: "activeUsers" },
              { name: "engagementRate" },
              { name: "averageSessionDuration" },
            ],
            limit: 10,
          },
          {
            id: "pages",
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
            metrics: [
              { name: "screenPageViews" },
              { name: "sessions" },
              { name: "engagementRate" },
              { name: "averageEngagementTime" },
              { name: "conversions" },
            ],
            orderBys: [{ metric: { metricName: "screenPageViews", orderType: "DESCENDING" } }],
            limit: 50,
          },
        ],
      });

      const parsed = parseReports(reports);
      setBundle(parsed);
      setFromCache(false);
      setCachedAt(Date.now());
      try {
        localStorage.setItem(GA4_CACHE_KEY, JSON.stringify({ key: cacheKey, timestamp: Date.now(), bundle: parsed }));
      } catch { /* ignore */ }
    } catch (e: any) {
      setConfigStatus("fail");
      showToast("GA4 加载失败：" + (e?.message || "未知错误"));
    } finally {
      setLoading(false);
      setForceRefresh(false);
    }
  }, [forceRefresh, isDemo, propertyId, shopName, getRange, parseReports, showToast]);

  useEffect(() => {
    if (isDemo) return; // demo 已在初始化时填充
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeType, customStart, customEnd, forceRefresh, isDemo]);

  /* 配置保存 + 校验 */
  const handleSaveConfig = useCallback(async () => {
    let parsed: GA4Credentials;
    try {
      parsed = JSON.parse(credJson);
    } catch {
      setConfigStatus("fail");
      showToast("JSON 解析失败：请粘贴完整的服务账号 JSON");
      return;
    }
    if (!parsed.client_email || !parsed.private_key) {
      setConfigStatus("fail");
      showToast("JSON 缺少 client_email 或 private_key 字段");
      return;
    }
    if (!propertyId.trim()) {
      setConfigStatus("fail");
      showToast("请填写 GA4 媒体资源 ID（数字）");
      return;
    }

    setVerifying(true);
    try {
      // 用一次最小化报表请求校验凭证 + propertyId 权限
      await callGA4({
        action: "runReport",
        credentials: parsed,
        propertyId: propertyId.trim(),
        reports: [
          {
            id: "probe",
            dateRanges: [{ startDate: fmtDate(new Date(Date.now() - 6 * 86400000)), endDate: fmtDate(new Date()) }],
            dimensions: [{ name: "date" }],
            metrics: [{ name: "sessions" }],
            limit: 1,
          },
        ],
      });
      saveGA4Credentials(credJson, propertyId.trim());
      setConfigStatus("ok");
      setConfigOpen(false);
      showToast("GA4 凭证校验通过，已保存");
      setForceRefresh(true);
    } catch (e: any) {
      setConfigStatus("fail");
      showToast("GA4 校验失败：" + (e?.message || "未知错误"));
    } finally {
      setVerifying(false);
    }
  }, [credJson, propertyId, showToast]);

  /* 派生展示数据 */
  const trafficSeries = bundle?.traffic.series ?? [];
  const trendSummary = bundle?.traffic.summary;
  const newR = bundle?.newReturning.find((b) => b.name.includes("new"));
  const retR = bundle?.newReturning.find((b) => b.name.includes("returning"));
  const newPct = newR && retR && newR.sessions + retR.sessions > 0
    ? (newR.sessions / (newR.sessions + retR.sessions)) * 100
    : 0;

  const exportPages = () => {
    if (!bundle) return;
    downloadText(`ga4_pages_${shopName || "store"}.csv`, buildCsvPages(bundle.pages), "text/csv;charset=utf-8");
  };

  /* ── 渲染 ── */
  return (
    <div className="w-full space-y-5">
      {/* 顶部栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <Activity className="h-5 w-5 text-emerald-400" />
            GA4 流量分析
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            基于 Google Analytics 4 Data API · 全店流量全景视角
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 配置状态 */}
          <button
            onClick={() => setConfigOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              configStatus === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : configStatus === "fail"
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {configStatus === "ok" ? <CheckCircle2 className="h-4 w-4" /> : configStatus === "fail" ? <XCircle className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {configStatus === "ok" ? "GA4 已连接" : configStatus === "fail" ? "凭证异常" : "配置 GA4"}
          </button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setForceRefresh(true)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {/* 日期范围 + 缓存提示 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-500" />
          {(["7", "30", "90"] as RangeType[]).map((r) => (
            <button
              key={r}
              onClick={() => setRangeType(r)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                rangeType === r ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
              )}
            >
              {r} 天
            </button>
          ))}
          <button
            onClick={() => setRangeType("custom")}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              rangeType === "custom" ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
            )}
          >
            自定义
          </button>
          {rangeType === "custom" && (
            <div className="ml-1 flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
              />
              <span className="text-zinc-600">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {fromCache && cachedAt && (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              缓存于 {new Date(cachedAt).toLocaleTimeString("zh-CN")}
            </span>
          )}
          {isDemo && <Badge variant="outline" className="border-amber-500/30 text-amber-400">Demo 演示数据</Badge>}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-zinc-800" />
        </div>
      )}

      {!loading && bundle && (
        <Tabs defaultValue="traffic" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-lg bg-zinc-800/60 p-1">
            <TabsTrigger value="traffic" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />流量趋势
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-1.5">
              <PieChartIcon className="h-4 w-4" />流量来源
            </TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1.5">
              <MonitorSmartphone className="h-4 w-4" />用户行为
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5">
              <FileText className="h-4 w-4" />页面分析
            </TabsTrigger>
          </TabsList>

          {/* ── 流量趋势 ── */}
          <TabsContent value="traffic" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="总会话数" value={trendSummary ? trendSummary.totalSessions.toLocaleString() : "0"} icon={<Users className="h-4 w-4" />} />
              <StatCard label="活跃用户" value={trendSummary ? trendSummary.totalUsers.toLocaleString() : "0"} icon={<Activity className="h-4 w-4" />} />
              <StatCard label="页面浏览量" value={trendSummary ? trendSummary.totalPageviews.toLocaleString() : "0"} icon={<FileText className="h-4 w-4" />} />
              <StatCard label="平均互动率" value={trendSummary ? fmtPct(trendSummary.avgEngagementRate) : "0%"} icon={<Sparkles className="h-4 w-4" />} />
            </div>
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-300">每日流量趋势（会话 / 活跃用户）</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trafficSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} interval="preserveStartEnd" stroke="#3f3f46" />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                      <Area type="monotone" dataKey="sessions" name="会话数" stroke="#34d399" strokeWidth={2} fill="url(#sessFill)" />
                      <Line type="monotone" dataKey="users" name="活跃用户" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 流量来源 ── */}
          <TabsContent value="sources" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-300">来源渠道占比（会话）</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={bundle.sources}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={2}
                          label={(e: any) => `${e.name} ${((e.value / (bundle.sources.reduce((s, x) => s + x.value, 0) || 1)) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {bundle.sources.map((s, i) => (
                            <Cell key={i} fill={s.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-300">各渠道会话量</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bundle.sources} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={80} stroke="#3f3f46" />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} />
                        <Bar dataKey="value" name="会话" radius={[0, 4, 4, 0]}>
                          {bundle.sources.map((s, i) => (
                            <Cell key={i} fill={s.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── 用户行为 ── */}
          <TabsContent value="behavior" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard label="新用户占比" value={newPct.toFixed(1) + "%"} icon={<Users className="h-4 w-4" />} />
              <StatCard label="回访用户占比" value={(100 - newPct).toFixed(1) + "%"} icon={<Activity className="h-4 w-4" />} />
              <StatCard
                label="移动端会话"
                value={(bundle.device.find((d) => d.name.includes("mobile"))?.sessions ?? 0).toLocaleString()}
                icon={<MonitorSmartphone className="h-4 w-4" />}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-300">设备分布（会话）</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bundle.device} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                        <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} />
                        <Bar dataKey="sessions" name="会话" radius={[4, 4, 0, 0]} fill="#60a5fa" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-300">新老用户互动对比</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bundle.newReturning} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                        <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} />
                        <Bar dataKey="engagementRate" name="互动率" radius={[4, 4, 0, 0]} fill="#34d399" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">用户分群</TableHead>
                      <TableHead className="text-right text-zinc-400">会话数</TableHead>
                      <TableHead className="text-right text-zinc-400">互动率</TableHead>
                      <TableHead className="text-right text-zinc-400">平均时长</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.newReturning.map((b, i) => (
                      <TableRow key={i} className="border-zinc-800">
                        <TableCell className="font-medium text-zinc-200">{b.name}</TableCell>
                        <TableCell className="text-right text-zinc-300">{b.sessions.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(b.engagementRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtDuration(b.avgDuration)}</TableCell>
                      </TableRow>
                    ))}
                    {bundle.device.map((b, i) => (
                      <TableRow key={"d" + i} className="border-zinc-800">
                        <TableCell className="font-medium text-zinc-200">{b.name}</TableCell>
                        <TableCell className="text-right text-zinc-300">{b.sessions.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtPct(b.engagementRate)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtDuration(b.avgDuration)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 页面分析 ── */}
          <TabsContent value="pages" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300">热门页面（与 Shopify 实体关联）</h3>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPages}>
                <Download className="h-4 w-4" />导出 CSV
              </Button>
            </div>
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">页面</TableHead>
                      <TableHead className="text-zinc-400">匹配实体</TableHead>
                      <TableHead className="text-right text-zinc-400">浏览量</TableHead>
                      <TableHead className="text-right text-zinc-400">会话</TableHead>
                      <TableHead className="text-right text-zinc-400">互动率</TableHead>
                      <TableHead className="text-right text-zinc-400">平均时长</TableHead>
                      <TableHead className="text-right text-zinc-400">转化</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.pages.map((p, i) => (
                      <TableRow key={i} className="border-zinc-800">
                        <TableCell>
                          <div className="max-w-[260px]">
                            <div className="truncate font-medium text-zinc-200" title={p.path}>{p.path}</div>
                            {p.title && <div className="truncate text-xs text-zinc-500" title={p.title}>{p.title}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.matched ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                              p.matched.type === "product" && "bg-emerald-500/10 text-emerald-400",
                              p.matched.type === "collection" && "bg-blue-500/10 text-blue-400",
                              p.matched.type === "page" && "bg-amber-500/10 text-amber-400",
                              p.matched.type === "blog" && "bg-purple-500/10 text-purple-400",
                              p.matched.type === "home" && "bg-zinc-500/10 text-zinc-300",
                              p.matched.type === "system" && "bg-zinc-700/30 text-zinc-400",
                              p.matched.type === "unknown" && "bg-zinc-700/20 text-zinc-500",
                            )}>
                              <Link2 className="h-3 w-3" />
                              {p.matched.label}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-zinc-300">{p.pageviews.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-300">{p.sessions.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right", p.engagementRate >= 0.6 ? "text-emerald-400" : p.engagementRate >= 0.4 ? "text-amber-400" : "text-red-400")}>
                          {fmtPct(p.engagementRate)}
                        </TableCell>
                        <TableCell className="text-right text-zinc-300">{fmtDuration(p.avgEngagementTime)}</TableCell>
                        <TableCell className="text-right text-zinc-300">{p.conversions.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {bundle.pages.length === 0 && (
                      <TableRow className="border-zinc-800">
                        <TableCell colSpan={7} className="py-8 text-center text-zinc-500">暂无页面数据</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 配置弹窗 */}
      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="配置 Google Analytics 4">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-400">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-zinc-300">
              <KeyRound className="h-3.5 w-3.5" />凭证说明
            </p>
            <p>1. 在 Google Cloud 创建<strong className="text-zinc-200">服务账号</strong>，生成 JSON 密钥。</p>
            <p>2. 在 GA4 媒体资源「账号访问管理」中，将该服务账号邮箱添加为<strong className="text-zinc-200">查看者</strong>角色。</p>
            <p>3. 粘贴完整 JSON 并填写「媒体资源 ID」（属性设置中的数字 ID）。</p>
            <p className="mt-1 text-zinc-500">凭证仅经 base64 混淆后保存在本地浏览器，不会上传服务器。</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">媒体资源 ID（propertyId）</label>
            <Input
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="例如 123456789"
              className="border-zinc-700 bg-zinc-800 text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">服务账号 JSON 密钥</label>
            <textarea
              value={credJson}
              onChange={(e) => setCredJson(e.target.value)}
              placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"...@....iam.gserviceaccount.com",...}'
              className="h-40 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 p-3 font-mono text-xs text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfigOpen(false)}>取消</Button>
            <Button onClick={handleSaveConfig} disabled={verifying} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
              {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {verifying ? "校验中..." : "保存并校验"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── 统计卡片 ──────────────────────────────────────── */

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          {icon}
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-lg font-semibold text-zinc-100">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
