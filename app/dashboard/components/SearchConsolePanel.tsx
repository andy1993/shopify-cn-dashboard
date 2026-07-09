"use client";

import { Fragment, useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  Search, BarChart4, RefreshCw, Download, Settings2, CheckCircle2, XCircle,
  AlertTriangle, Calendar, ChevronDown, ExternalLink, KeyRound, Link2, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useToast } from "../hooks/useToast";
import { cn } from "@/lib/utils";

/* ─── Props ──────────────────────────────────────────── */

interface SearchConsolePanelProps {
  isDemo: boolean;
  shopUrl: string;
  accessToken?: string;
  shopName: string;
  domain?: string;
  orders?: any[];
}

/* ─── 类型 ──────────────────────────────────────────── */

interface QueryRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  position: number;
  positionDelta: number; // 当前 - 上一周期；正数=排名变差
}

interface DetailData {
  daily: Array<{ date: string; impressions: number; clicks: number }>;
  landing: Array<{ url: string; impressions: number; clicks: number; ctr: number }>;
  device: Array<{ name: string; value: number }>;
  country: Array<{ name: string; value: number }>;
}

interface GSCredentials { client_email: string; private_key: string; }

type SortKey = "query" | "impressions" | "clicks" | "ctr" | "position" | "positionDelta";
type RangeType = "7" | "30" | "90" | "custom";
type OppTab = "all" | "lowctr" | "lowrank" | "brand";
type ConfigStatus = "unset" | "ok" | "fail";

/* ─── 常量 ──────────────────────────────────────────── */

const GSC_CRED_KEY = "gsc_credentials";
const GSC_CACHE_KEY = "gsc_last_result";
const GSC_DETAIL_KEY = "gsc_detail_cache";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时

const PIE_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171"];

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
} as const;

/* ─── 凭证存储（base64 简单混淆，非强加密）────────────── */

function saveGSCredentials(jsonContent: string, siteUrl: string): void {
  const encoded = btoa(JSON.stringify({ json: jsonContent, siteUrl, savedAt: Date.now() }));
  localStorage.setItem(GSC_CRED_KEY, encoded);
}

function loadGSCredentials(): { json: string; siteUrl: string } | null {
  const encoded = localStorage.getItem(GSC_CRED_KEY);
  if (!encoded) return null;
  try {
    const decoded = JSON.parse(atob(encoded));
    return { json: decoded.json, siteUrl: decoded.siteUrl };
  } catch {
    return null;
  }
}

/* ─── 工具函数 ──────────────────────────────────────── */

function brandTokensOf(shop: string): string[] {
  return shop.toLowerCase().split(/[^a-z0-9一-龥]+/).filter((t) => t.length >= 2);
}

function isBrandQuery(q: string, shop: string): boolean {
  const lower = q.toLowerCase();
  return brandTokensOf(shop).some((t) => lower.includes(t));
}

function ctrToneClass(ctr: number): string {
  const pct = ctr * 100;
  if (pct > 5) return "text-emerald-400";
  if (pct >= 2) return "text-amber-400";
  return "text-red-400";
}

function slug(s: string): string {
  return s.replace(/\s+/g, "-").toLowerCase().slice(0, 24);
}

function displayDomain(siteUrl: string, shopUrl: string): string {
  const raw = siteUrl || shopUrl || "example.com";
  return raw.replace(/^https?:\/\//, "").replace(/^sc-domain:/, "");
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildCsv(rows: QueryRow[]): string {
  const header = "关键词,曝光次数,点击次数,CTR(%),平均排名,排名变化\n";
  const lines = rows
    .map((r) =>
      [
        `"${r.query.replace(/"/g, '""')}"`,
        r.impressions,
        r.clicks,
        (r.ctr * 100).toFixed(2),
        r.position.toFixed(1),
        r.positionDelta.toFixed(1),
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

interface DemoQuery {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  positionDelta: number;
  isBrand?: boolean;
}

const DEMO_QUERIES: DemoQuery[] = [
  { query: "降噪耳机", impressions: 12500, clicks: 680, position: 8.2, positionDelta: -1.2 },
  { query: "无线耳机", impressions: 9800, clicks: 540, position: 9.1, positionDelta: 0.8 },
  { query: "智能手表", impressions: 8200, clicks: 320, position: 12.5, positionDelta: 6.1 },
  { query: "蓝牙音箱", impressions: 7600, clicks: 410, position: 7.3, positionDelta: -0.5 },
  { query: "保温杯", impressions: 6900, clicks: 290, position: 10.4, positionDelta: -1.8 },
  { query: "无线充电器", impressions: 5400, clicks: 230, position: 11.2, positionDelta: 1.1 },
  { query: "机械键盘", impressions: 5100, clicks: 180, position: 13.6, positionDelta: 3.2 },
  { query: "运动相机", impressions: 4800, clicks: 210, position: 9.8, positionDelta: -0.9 },
  { query: "投影仪", impressions: 4500, clicks: 60, position: 14.2, positionDelta: 0.4 },
  { query: "电动牙刷", impressions: 4200, clicks: 190, position: 8.7, positionDelta: -2.3 },
  { query: "扫地机器人", impressions: 3900, clicks: 50, position: 15.1, positionDelta: 1.9 },
  { query: "空气炸锅", impressions: 3700, clicks: 170, position: 10.9, positionDelta: -1.1 },
  { query: "颈椎按摩仪", impressions: 3500, clicks: 120, position: 16.3, positionDelta: 0.6 },
  { query: "便携榨汁机", impressions: 3200, clicks: 95, position: 12.8, positionDelta: 2.7 },
  { query: "车载支架", impressions: 3000, clicks: 110, position: 11.5, positionDelta: -0.3 },
  { query: "无线鼠标", impressions: 2800, clicks: 130, position: 9.4, positionDelta: 1.5 },
  { query: "游戏耳机", impressions: 2600, clicks: 90, position: 13.1, positionDelta: 4.1 },
  { query: "智能台灯", impressions: 2400, clicks: 85, position: 10.2, positionDelta: -1.4 },
  { query: "加湿器", impressions: 2200, clicks: 30, position: 14.8, positionDelta: 0.9 },
  { query: "电热水壶", impressions: 2000, clicks: 60, position: 12.6, positionDelta: -0.7 },
  { query: "瑜伽垫", impressions: 1800, clicks: 50, position: 15.5, positionDelta: 1.2 },
  { query: "筋膜枪", impressions: 1700, clicks: 45, position: 16.9, positionDelta: 0.3 },
  { query: "蓝牙耳机 推荐", impressions: 1600, clicks: 40, position: 11.3, positionDelta: 5.6 },
  { query: "demo 耳机", impressions: 1500, clicks: 38, position: 6.1, positionDelta: -0.2, isBrand: true },
  { query: "demo store 官网", impressions: 1400, clicks: 42, position: 4.8, positionDelta: -0.1, isBrand: true },
  { query: "充电宝", impressions: 1300, clicks: 35, position: 13.7, positionDelta: 2.2 },
  { query: "桌面风扇", impressions: 1200, clicks: 30, position: 12.1, positionDelta: -1.0 },
  { query: "智能门锁", impressions: 1100, clicks: 15, position: 17.2, positionDelta: 0.5 },
  { query: "降噪耳塞", impressions: 1000, clicks: 25, position: 14.5, positionDelta: 1.0 },
  { query: "demo 旗舰店 优惠券", impressions: 900, clicks: 20, position: 5.5, positionDelta: -0.3, isBrand: true },
];

function buildDemoRows(days: number, shop: string): QueryRow[] {
  const factor = Math.max(1, days / 7);
  return DEMO_QUERIES.map((q) => {
    const imp = Math.round(q.impressions * factor);
    const clk = Math.round(q.clicks * factor);
    return {
      query: q.query,
      impressions: imp,
      clicks: clk,
      ctr: imp ? clk / imp : 0,
      position: q.position,
      positionDelta: q.positionDelta,
    };
  });
}

function buildDemoDetail(query: string, row: QueryRow | undefined, days: number, domain: string): DetailData {
  const daily: DetailData["daily"] = [];
  const baseImp = (row?.impressions || 1000) / days;
  const baseClk = (row?.clicks || 50) / days;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const noise = 0.7 + Math.random() * 0.6;
    daily.push({
      date: d.toISOString().slice(5, 10),
      impressions: Math.round(baseImp * noise),
      clicks: Math.round(baseClk * noise),
    });
  }
  const total = row?.impressions || 1000;
  const totalClk = row?.clicks || 50;
  const landingPaths = [
    `/products/${slug(query)}`,
    "/collections/all",
    "/",
    "/pages/about",
    `/blogs/news/${slug(query)}`,
  ];
  const landing = landingPaths.map((u, i) => {
    const w = 0.4 - i * 0.07;
    const imp = Math.round(total * w);
    const clk = Math.round(totalClk * w);
    return {
      url: "https://" + domain + u,
      impressions: imp,
      clicks: clk,
      ctr: imp ? clk / imp : 0,
    };
  });
  const device = [
    { name: "Desktop", value: Math.round(total * 0.55) },
    { name: "Mobile", value: Math.round(total * 0.38) },
    { name: "Tablet", value: Math.round(total * 0.07) },
  ];
  const country = [
    { name: "US", value: Math.round(total * 0.35) },
    { name: "GB", value: Math.round(total * 0.2) },
    { name: "CA", value: Math.round(total * 0.15) },
    { name: "DE", value: Math.round(total * 0.12) },
    { name: "FR", value: Math.round(total * 0.1) },
  ];
  return { daily, landing, device, country };
}

/* ─── 缓存（查询）──────────────────────────────────── */

function loadCache(): { key: string; timestamp: number; rows: QueryRow[] } | null {
  try {
    const raw = localStorage.getItem(GSC_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(key: string, rows: QueryRow[]): void {
  try {
    localStorage.setItem(GSC_CACHE_KEY, JSON.stringify({ key, timestamp: Date.now(), rows }));
  } catch {
    /* ignore */
  }
}

/* ─── 缓存（详情）──────────────────────────────────── */

function loadDetailCache(key: string): DetailData | null {
  try {
    const raw = localStorage.getItem(GSC_DETAIL_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, { ts: number; data: DetailData }>;
    const e = obj[key];
    if (e && Date.now() - e.ts < CACHE_TTL) return e.data;
    return null;
  } catch {
    return null;
  }
}

function saveDetailCache(key: string, data: DetailData): void {
  try {
    const raw = localStorage.getItem(GSC_DETAIL_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, { ts: number; data: DetailData }>) : {};
    obj[key] = { ts: Date.now(), data };
    localStorage.setItem(GSC_DETAIL_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

/* ─── GSC API 代理调用 ──────────────────────────────── */

async function callGSC(payload: any): Promise<any> {
  const res = await fetch("/api/google/searchconsole", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "GSC 请求失败");
  return json.data;
}

function queryFilter(query: string) {
  const raw = query.replace(/^"|"$/g, "");
  return {
    dimensionFilterGroups: [
      {
        groupType: "and",
        filters: [{ dimension: "query", operator: "equals", expression: raw }],
      },
    ],
  };
}

function mapDevice(d: string): string {
  if (d === "DESKTOP") return "Desktop";
  if (d === "MOBILE") return "Mobile";
  if (d === "TABLET") return "Tablet";
  return d;
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

/* ─── 面板主组件 ────────────────────────────────────── */

export default function SearchConsolePanel({
  isDemo,
  shopUrl,
  shopName,
  orders,
}: SearchConsolePanelProps) {
  const { showToast } = useToast();

  const [credJson, setCredJson] = useState<string>("");
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatus>("unset");
  const [verifying, setVerifying] = useState(false);

  const [rangeType, setRangeType] = useState<RangeType>("30");
  const [customStart, setCustomStart] = useState<string>(fmtDate(new Date(Date.now() - 29 * 86400000)));
  const [customEnd, setCustomEnd] = useState<string>(fmtDate(new Date()));

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [oppTab, setOppTab] = useState<OppTab>("all");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [forceRefresh, setForceRefresh] = useState(false);
  const [orderView, setOrderView] = useState<{ query: string; matched: any[] | null } | null>(null);

  /* 初始化凭证 */
  useEffect(() => {
    const saved = loadGSCredentials();
    if (saved) {
      setCredJson(saved.json);
      setSiteUrl(saved.siteUrl);
      setConfigStatus("ok");
    }
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
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
    const startDate = fmtDate(start);
    const endDate = fmtDate(end);
    return {
      startDate,
      endDate,
      prevStart: fmtDate(prevStart),
      prevEnd: fmtDate(prevEnd),
      days,
      key: `${startDate}_${endDate}`,
    };
  }, [rangeType, customStart, customEnd]);

  /* 加载主数据 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const range = getRange();
        const cacheKey = "v1:" + (siteUrl || "?") + ":" + range.key;

        if (!forceRefresh && !isDemo) {
          const cached = loadCache();
          if (cached && cached.key === cacheKey && Date.now() - cached.timestamp < CACHE_TTL) {
            if (!cancelled) {
              setRows(cached.rows);
              setCachedAt(cached.timestamp);
              setFromCache(true);
            }
            return;
          }
        }

        if (isDemo) {
          if (!cancelled) {
            setRows(buildDemoRows(range.days, shopName));
            setCachedAt(Date.now());
            setFromCache(false);
          }
          return;
        }

        const creds = parseCreds();
        if (!creds) throw new Error("未配置 GSC 凭证");

        const [current, previous] = await Promise.all([
          callGSC({
            action: "searchAnalytics",
            credentials: creds,
            siteUrl,
            startDate: range.startDate,
            endDate: range.endDate,
            dimensions: ["query"],
            rowLimit: 100,
          }),
          callGSC({
            action: "searchAnalytics",
            credentials: creds,
            siteUrl,
            startDate: range.prevStart,
            endDate: range.prevEnd,
            dimensions: ["query"],
            rowLimit: 100,
          }),
        ]);

        const prevMap: Record<string, number> = {};
        (previous.rows || []).forEach((r: any) => {
          prevMap[r.keys[0]] = r.position;
        });

        const built: QueryRow[] = (current.rows || []).map((r: any) => {
          const q = r.keys[0];
          const prevPos = prevMap[q];
          const delta = typeof prevPos === "number" ? r.position - prevPos : 0;
          return {
            query: q,
            impressions: r.impressions,
            clicks: r.clicks,
            ctr: r.ctr,
            position: r.position,
            positionDelta: delta,
          };
        });

        if (!cancelled) {
          setRows(built);
          saveCache(cacheKey, built);
          setCachedAt(Date.now());
          setFromCache(false);
        }
      } catch (e: any) {
        if (!cancelled) showToast("加载失败：" + (e?.message || "未知错误"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeType, customStart, customEnd, isDemo, siteUrl, forceRefresh]);

  function parseCreds(): GSCredentials | null {
    if (!credJson) return null;
    try {
      const p = JSON.parse(credJson);
      if (p.client_email && p.private_key) {
        return { client_email: p.client_email, private_key: p.private_key };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /* 排序 */
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: number | string = a[sortKey];
      let bv: number | string = b[sortKey];
      if (sortKey === "query") {
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      av = av as number;
      bv = bv as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  /* 机会筛选 */
  const oppRows = useMemo(() => {
    if (oppTab === "lowctr") return sortedRows.filter((r) => r.ctr * 100 < 2 && r.impressions > 1000);
    if (oppTab === "lowrank") return sortedRows.filter((r) => r.position > 10 && r.clicks > 50);
    if (oppTab === "brand") return sortedRows.filter((r) => isBrandQuery(r.query, shopName));
    return sortedRows;
  }, [sortedRows, oppTab, shopName]);

  /* 排名告警：点击 TOP10 且排名下降 > 5 位 */
  const alertRows = useMemo(() => {
    const top10 = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
    return top10.filter((r) => r.positionDelta > 5);
  }, [rows]);

  const dDomain = useMemo(() => displayDomain(siteUrl, shopUrl), [siteUrl, shopUrl]);

  /* 排序切换 */
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "query" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey): ReactNode {
    if (sortKey !== key) return <span className="text-zinc-600">↕</span>;
    return <span className="text-emerald-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  /* 保存配置 */
  function handleSaveConfig() {
    if (!credJson.trim() || !siteUrl.trim()) {
      showToast("请填写 JSON 密钥与站点 URL");
      return;
    }
    try {
      const p = JSON.parse(credJson);
      if (!p.client_email || !p.private_key) {
        showToast("JSON 缺少 client_email 或 private_key");
        return;
      }
    } catch {
      showToast("JSON 格式不正确");
      return;
    }
    saveGSCredentials(credJson, siteUrl);
    setConfigStatus("ok");
    setConfigOpen(false);
    showToast("GSC 配置已保存");
    setForceRefresh(true);
  }

  /* 验证连接 */
  async function handleVerify() {
    const creds = parseCreds();
    if (!creds || !siteUrl) {
      showToast("请先填写完整凭证");
      return;
    }
    setVerifying(true);
    try {
      await callGSC({
        action: "searchAnalytics",
        credentials: creds,
        siteUrl,
        startDate: fmtDate(new Date(Date.now() - 6 * 86400000)),
        endDate: fmtDate(new Date()),
        dimensions: ["query"],
        rowLimit: 1,
      });
      setConfigStatus("ok");
      showToast("✅ GSC 连接正常");
    } catch (e: any) {
      setConfigStatus("fail");
      showToast("❌ 验证失败：" + (e?.message || "未知错误"));
    } finally {
      setVerifying(false);
    }
  }

  /* 刷新 */
  function handleRefresh() {
    setExpanded(null);
    setDetail(null);
    setOrderView(null);
    setForceRefresh(true);
  }

  /* 加载详情 */
  async function loadDetail(query: string) {
    setDetailLoading(true);
    setDetail(null);
    setOrderView(null);
    try {
      const range = getRange();
      const current = rows.find((r) => r.query === query);
      if (isDemo) {
        setDetail(buildDemoDetail(query, current, range.days, dDomain));
        return;
      }
      const creds = parseCreds();
      if (!creds) throw new Error("未配置 GSC 凭证");
      const detailKey = "d:" + (siteUrl || "?") + ":" + range.key + ":" + query;
      const cached = loadDetailCache(detailKey);
      if (cached) {
        setDetail(cached);
        return;
      }
      const [landing, device, country, daily] = await Promise.all([
        callGSC({
          action: "searchAnalytics", credentials: creds, siteUrl,
          startDate: range.startDate, endDate: range.endDate,
          dimensions: ["query", "page"], rowLimit: 5, ...queryFilter(query),
        }),
        callGSC({
          action: "searchAnalytics", credentials: creds, siteUrl,
          startDate: range.startDate, endDate: range.endDate,
          dimensions: ["query", "device"], rowLimit: 10, ...queryFilter(query),
        }),
        callGSC({
          action: "searchAnalytics", credentials: creds, siteUrl,
          startDate: range.startDate, endDate: range.endDate,
          dimensions: ["query", "country"], rowLimit: 5, ...queryFilter(query),
        }),
        callGSC({
          action: "searchAnalytics", credentials: creds, siteUrl,
          startDate: range.startDate, endDate: range.endDate,
          dimensions: ["query", "date"], rowLimit: 1000, ...queryFilter(query),
        }),
      ]);

      const landingRows = (landing.rows || []).map((r: any) => ({
        url: r.keys[1],
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
      }));
      const deviceRows = (device.rows || []).map((r: any) => ({
        name: mapDevice(r.keys[1]),
        value: r.impressions,
      }));
      const countryRows = (country.rows || [])
        .map((r: any) => ({ name: r.keys[1], value: r.impressions }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5);
      const dailyRows = (daily.rows || [])
        .map((r: any) => ({ date: r.keys[1], impressions: r.impressions, clicks: r.clicks }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const data: DetailData = {
        daily: dailyRows,
        landing: landingRows,
        device: deviceRows,
        country: countryRows,
      };
      saveDetailCache(detailKey, data);
      setDetail(data);
    } catch (e: any) {
      showToast("详情加载失败：" + (e?.message || "未知错误"));
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleDetail(query: string) {
    if (expanded === query) {
      setExpanded(null);
      setDetail(null);
      setOrderView(null);
      return;
    }
    setExpanded(query);
    loadDetail(query);
  }

  /* 关联订单 */
  function checkOrders(query: string) {
    const list = (orders || []).filter((o: any) => {
      const ls = o.landing_site;
      if (!ls) return false;
      return String(ls).toLowerCase().includes(query.toLowerCase());
    });
    setOrderView({ query, matched: list.length ? list : null });
  }

  /* 导出 CSV */
  function handleExport() {
    if (!oppRows.length) {
      showToast("当前无数据可导出");
      return;
    }
    const csv = buildCsv(oppRows);
    downloadText(`gsc-report-${dDomain}-${getRange().key}.csv`, csv, "text/csv;charset=utf-8");
    showToast("已导出 GSC 报告 CSV");
  }

  const statusBadge = (
    <Badge
      className={cn(
        "gap-1",
        configStatus === "ok"
          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
          : configStatus === "fail"
            ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/20"
            : "bg-zinc-700/30 text-zinc-400 ring-1 ring-zinc-600/30"
      )}
    >
      {configStatus === "ok" ? "🟢 已配置" : configStatus === "fail" ? "🔴 验证失败" : "⚪ 未配置"}
    </Badge>
  );

  return (
    <div className="space-y-5">
      {/* ── 顶部配置区 ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <BarChart4 className="h-5 w-5 text-emerald-400" />
            Google Search Console 搜索分析
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            本地代理调用 Google 官方 API · 密钥仅存于浏览器，服务端不持久化
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <KeyRound className="h-4 w-4" />
            配置 GSC 密钥
          </Button>
          {statusBadge}
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={verifying || !credJson}
          >
            {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            验证连接
          </Button>
        </div>
      </div>

      {/* 站点 + 日期范围 + 刷新 + 导出 */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs text-zinc-500">站点 URL</p>
              <p className="max-w-xs truncate text-sm font-medium text-zinc-200" title={siteUrl || "未配置"}>
                {siteUrl || "未配置"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">日期范围</p>
              <Select value={rangeType} onValueChange={(v) => setRangeType(v as RangeType)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="选择范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">近 7 天</SelectItem>
                  <SelectItem value="30">近 30 天</SelectItem>
                  <SelectItem value="90">近 90 天</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rangeType === "custom" && (
              <div className="flex items-end gap-2">
                <div>
                  <p className="mb-1 text-xs text-zinc-500">开始</p>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-9 w-40"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">结束</p>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-9 w-40"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cachedAt && (
              <span className="text-xs text-zinc-600">
                {fromCache ? "缓存于" : "更新于"} {new Date(cachedAt).toLocaleString("zh-CN")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              刷新数据
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 排名告警横幅 */}
      {alertRows.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" />
            排名告警：{alertRows.length} 个核心关键词排名显著下滑（下降 &gt; 5 位）
          </div>
          <div className="flex flex-wrap gap-2">
            {alertRows.map((r) => (
              <Badge
                key={r.query}
                className="bg-red-500/15 text-red-300 ring-1 ring-red-500/20"
              >
                <span className="truncate max-w-[200px] inline-block" title={r.query}>
                  {r.query}
                </span> ↓{r.positionDelta.toFixed(1)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 机会发现 Tabs + 表格 */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4">
          <Tabs value={oppTab} onValueChange={(v) => setOppTab(v as OppTab)}>
            <div className="mb-3 flex items-center justify-between">
              <TabsList className="bg-zinc-800/60">
                <TabsTrigger value="all">全部（{sortedRows.length}）</TabsTrigger>
                <TabsTrigger value="lowctr">高曝光低点击</TabsTrigger>
                <TabsTrigger value="lowrank">高点击低排名</TabsTrigger>
                <TabsTrigger value="brand">品牌词</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" />
            <TabsContent value="lowctr" />
            <TabsContent value="lowrank" />
            <TabsContent value="brand" />

            {/* 主表格（所有 Tab 共用，按 oppTab 过滤） */}
            {/* 注：Tabs 仅用作过滤器切换，表格在 Tab 面板之外统一渲染 */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer select-none text-zinc-400"
                      onClick={() => toggleSort("query")}
                    >
                      关键词 {sortIndicator("query")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-zinc-400"
                      onClick={() => toggleSort("impressions")}
                    >
                      曝光次数 {sortIndicator("impressions")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-zinc-400"
                      onClick={() => toggleSort("clicks")}
                    >
                      点击次数 {sortIndicator("clicks")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-zinc-400"
                      onClick={() => toggleSort("ctr")}
                    >
                      CTR {sortIndicator("ctr")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-zinc-400"
                      onClick={() => toggleSort("position")}
                    >
                      平均排名 {sortIndicator("position")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-zinc-400"
                      onClick={() => toggleSort("positionDelta")}
                    >
                      趋势 {sortIndicator("positionDelta")}
                    </TableHead>
                    <TableHead className="text-right text-zinc-400">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                        <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        正在加载 Search Console 数据…
                      </TableCell>
                    </TableRow>
                  ) : oppRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    oppRows.map((r) => (
                      <Fragment key={r.query}>
                        <TableRow className="border-zinc-800 hover:bg-zinc-800/40">
                          <TableCell className="font-medium text-zinc-100">
                            <div className="max-w-[220px] truncate" title={r.query}>
                              {r.query}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">
                            {r.impressions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">
                            {r.clicks.toLocaleString()}
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", ctrToneClass(r.ctr))}>
                            {(r.ctr * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">
                            {r.position.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.positionDelta === 0 ? (
                              <span className="text-zinc-500">—</span>
                            ) : r.positionDelta < 0 ? (
                              <span className="font-medium text-emerald-400">
                                ↑{Math.abs(r.positionDelta).toFixed(1)}
                              </span>
                            ) : (
                              <span className="font-medium text-red-400">
                                ↓{r.positionDelta.toFixed(1)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDetail(r.query)}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              {expanded === r.query ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              详情
                            </Button>
                          </TableCell>
                        </TableRow>

                        {expanded === r.query && (
                          <TableRow className="border-zinc-800 bg-zinc-950/40">
                            <TableCell colSpan={7} className="p-4">
                              {detailLoading ? (
                                <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  加载详情…
                                </div>
                              ) : detail ? (
                                <DetailView
                                  detail={detail}
                                  query={r.query}
                                  onCheckOrders={() => checkOrders(r.query)}
                                  orderView={orderView}
                                  shopName={shopName}
                                />
                              ) : (
                                <div className="py-8 text-center text-sm text-zinc-500">
                                  无详情数据
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* 配置 Modal */}
      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="配置 Google Search Console 密钥">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Service Account JSON（完整内容）</label>
            <textarea
              value={credJson}
              onChange={(e) => setCredJson(e.target.value)}
              placeholder='粘贴 { "type": "service_account", "project_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\n...", "client_email": "..." }'
              className="h-44 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">站点 URL</label>
            <Input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="sc-domain:your-store.com 或 https://your-store.com"
              className="h-9"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSaveConfig}>
              <Settings2 className="h-4 w-4" />
              保存配置
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            密钥仅以 base64 混淆形式保存在本机浏览器 localStorage，通过 Next.js API Route 代理转发至 Google，
            服务端不持久化。建议为 Service Account 仅授予 Search Console 只读权限。
          </p>
        </div>
      </Modal>
    </div>
  );
}

/* ─── 详情视图 ──────────────────────────────────────── */

function DetailView({
  detail,
  query,
  onCheckOrders,
  orderView,
  shopName,
}: {
  detail: DetailData;
  query: string;
  onCheckOrders: () => void;
  orderView: { query: string; matched: any[] | null } | null;
  shopName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-200">「{query}」详情分析</p>
        <Button variant="outline" size="sm" onClick={onCheckOrders}>
          <Link2 className="h-4 w-4" />
          查看关联订单
        </Button>
      </div>

      {/* 逐日趋势（双轴） */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">逐日趋势（曝光量 / 点击量）</p>
        <div className="h-56 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={detail.daily} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="impressions"
                name="曝光"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="clicks"
                name="点击"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 落地页 + 设备分布 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-1 text-xs text-zinc-400">带来流量的落地页 TOP 5</p>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">URL</TableHead>
                  <TableHead className="text-right text-zinc-400">曝光</TableHead>
                  <TableHead className="text-right text-zinc-400">点击</TableHead>
                  <TableHead className="text-right text-zinc-400">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.landing.map((l, i) => (
                  <TableRow key={i} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell className="max-w-[260px] truncate text-xs text-zinc-300" title={l.url}>
                      {l.url}
                    </TableCell>
                    <TableCell className="text-right text-zinc-300">{l.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-zinc-300">{l.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-zinc-300">{(l.ctr * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-zinc-400">设备分布</p>
          <div className="h-44 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={detail.device}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={30}
                  paddingAngle={2}
                >
                  {detail.device.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 国家分布 */}
      <div>
        <p className="mb-1 text-xs text-zinc-400">国家/地区分布 TOP 5</p>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">国家/地区</TableHead>
                <TableHead className="text-right text-zinc-400">曝光</TableHead>
                <TableHead className="text-right text-zinc-400">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.country.map((c, i) => {
                const total = detail.country.reduce((s, x) => s + x.value, 0) || 1;
                return (
                  <TableRow key={i} className="border-zinc-800 hover:bg-zinc-800/40">
                    <TableCell className="text-zinc-300">{c.name}</TableCell>
                    <TableCell className="text-right text-zinc-300">{c.value.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-zinc-300">
                      {((c.value / total) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 关联订单结果 */}
      {orderView && orderView.query === query && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="mb-2 text-xs font-medium text-zinc-300">
            关联订单（匹配 landing_site 包含「{query}」）
          </p>
          {orderView.matched === null ? (
            <p className="text-xs text-zinc-500">
              暂无订单关联数据（订单中无 landing_site 字段，或未匹配到该搜索词）
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">订单号</TableHead>
                    <TableHead className="text-right text-zinc-400">金额</TableHead>
                    <TableHead className="text-zinc-400">创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderView.matched.slice(0, 10).map((o: any, i: number) => (
                    <TableRow key={i} className="border-zinc-800 hover:bg-zinc-800/40">
                      <TableCell className="text-zinc-300">
                        #{o.order_number || o.id}
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">
                        {o.total_price || "-"}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {o.created_at || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
