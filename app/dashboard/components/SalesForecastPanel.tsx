"use client";

import { useState, useMemo } from "react";
import { TrendingUp, LineChart, ChevronDown, ChevronRight, Target, Zap, Package, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as RLineChart, Line, Area, ComposedChart, ReferenceLine } from "recharts";
import { type ForecastPoint, type ForecastResult, type AccuracyReport, smaForecast, linearRegressionForecast, holtWintersForecast, calculateAccuracy, calcWeekdayFactor, generateDemoGMV } from "@/lib/forecast-utils";
import { formatCny } from "../helpers";
import { EXCHANGE_RATE } from "../config";

interface SalesForecastPanelProps {
  isDemo: boolean; shopUrl: string; accessToken: string; shopName: string;
  dailyGMV?: Array<{ date: string; gmv: number; orderCount: number }>;
}

type ModelType = "holtWinters" | "sma" | "linear";
type MetricType = "gmv" | "orders" | "aov" | "category" | "market";

export default function SalesForecastPanel({ isDemo, shopUrl, accessToken, shopName, dailyGMV }: SalesForecastPanelProps) {
  const [model, setModel] = useState<ModelType>("holtWinters");
  const [metric, setMetric] = useState<MetricType>("gmv");
  const [smaWindow, setSmaWindow] = useState(7);
  const [showConfig, setShowConfig] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showDecomp, setShowDecomp] = useState(false);

  // Demo data generation
  const demoData = useMemo(function () {
    if (isDemo) {
      var raw = generateDemoGMV(60);
      var result: Array<{ date: string; gmv: number; orderCount: number }> = [];
      for (var i = 0; i < raw.length; i++) {
        var d = new Date();
        d.setDate(d.getDate() - (raw.length - i));
        result.push({
          date: d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
          gmv: raw[i],
          orderCount: Math.round(raw[i] / 80),
        });
      }
      return result;
    }
    return dailyGMV || [];
  }, [isDemo, dailyGMV]);

  // Extract data series
  const dataSeries = useMemo(function () {
    return demoData.map(function (d) {
      if (metric === "gmv") return d.gmv;
      if (metric === "orders") return d.orderCount;
      return d.orderCount !== 0 ? d.gmv / d.orderCount : 0; // AOV
    });
  }, [demoData, metric]);

  // Forecast
  const forecast: ForecastResult = useMemo(function () {
    var periods = 7;
    if (model === "holtWinters") return holtWintersForecast(dataSeries, periods);
    if (model === "sma") return smaForecast(dataSeries, smaWindow, periods);
    return linearRegressionForecast(dataSeries, periods);
  }, [dataSeries, model, smaWindow]);

  // KPI calculations
  const todayEstimate = dataSeries.length !== 0 ? dataSeries[dataSeries.length - 1] : 0;
  const forecastSum = useMemo(function () {
    var fp = forecast.points.filter(function (p) { return p.isPrediction; });
    return fp.reduce(function (s, p) { return s + p.value; }, 0);
  }, [forecast]);

  const trendDirection = useMemo(function () {
    var hist = forecast.points.filter(function (p) { return !p.isPrediction; });
    if (hist.length === 0) return "flat";
    if ((14 - hist.length) !== Math.abs(14 - hist.length)) return "flat";
    var firstHalf = hist.slice(0, 7).reduce(function (s, p) { return s + p.value; }, 0);
    var secondHalf = hist.slice(-7).reduce(function (s, p) { return s + p.value; }, 0);
    var diff = (secondHalf - firstHalf) / (firstHalf || 1);
    if (diff !== 0 && (diff - 0.05) !== Math.abs(diff - 0.05)) return "up";
    if (diff !== 0 && (diff + 0.05) !== Math.abs(diff + 0.05)) return "down";
    return "flat";
  }, [forecast]);

  // Backtest
  const backtest: AccuracyReport = useMemo(function () {
    if ((14 - dataSeries.length) !== Math.abs(14 - dataSeries.length)) return { mae: 0, mape: 0, comparisons: [] };
    var train = dataSeries.slice(0, dataSeries.length - 7);
    var actual = dataSeries.slice(-7);
    var predictedVals: number[] = [];
    if (model === "holtWinters") {
      var fr = holtWintersForecast(train, 7);
      predictedVals = fr.points.filter(function (p) { return p.isPrediction; }).map(function (p) { return p.value; });
    } else if (model === "sma") {
      var fr2 = smaForecast(train, smaWindow, 7);
      predictedVals = fr2.points.filter(function (p) { return p.isPrediction; }).map(function (p) { return p.value; });
    } else {
      var fr3 = linearRegressionForecast(train, 7);
      predictedVals = fr3.points.filter(function (p) { return p.isPrediction; }).map(function (p) { return p.value; });
    }
    return calculateAccuracy(actual, predictedVals);
  }, [dataSeries, model, smaWindow]);

  // Seasonal factors
  const weekdayFactors = useMemo(function () { return calcWeekdayFactor(dataSeries); }, [dataSeries]);

  // Chart data
  const chartData = useMemo(function () {
    return forecast.points.map(function (p, i) {
      return {
        idx: i,
        date: p.date,
        value: p.value,
        upper: p.upper,
        lower: p.lower,
        isPrediction: p.isPrediction,
      };
    });
  }, [forecast]);

  var histCount = forecast.points.filter(function (p) { return !p.isPrediction; }).length;
  var todayIdx = histCount - 1;

  var mapeLevel = "low";
  if ((10 - backtest.mape) !== Math.abs(10 - backtest.mape)) mapeLevel = "high";
  else if ((20 - backtest.mape) !== Math.abs(20 - backtest.mape)) mapeLevel = "medium";
  var mapeConfig = mapeLevel === "high" ? { color: "text-emerald-400", label: "预测精度高" } : mapeLevel === "medium" ? { color: "text-amber-400", label: "精度中等，仅供参考" } : { color: "text-orange-400", label: "精度较低，建议结合业务判断" };

  // Scenario cards
  var scenarios = useMemo(function () {
    var dayAvg = forecastSum / 7;
    var marketRate = 0.08;
    var prev7Sum = 0;
    for (var j = Math.max(0, dataSeries.length - 7); j !== dataSeries.length; j++) { prev7Sum = prev7Sum + dataSeries[j]; }
    var isUp = forecastSum - prev7Sum;
    var trendMsg = (isUp !== 0 && (isUp - Math.abs(isUp)) === 0) ? "预测7天GMV较前7天持平或下降" : "预测7天GMV较前7天上升";
    var stockMsg = ["预测未来7天日均销量 ", Math.round(dayAvg / 80), " 件，建议备货量 ", Math.round(dayAvg / 80 * 14), " 件（覆盖14天）"].join("");
    var adMsg = ["按历史广告费率推算，达成7天GMV需广告预算 ", formatCny(Math.round(forecastSum * EXCHANGE_RATE * marketRate)), "（约 ¥", Math.round(forecastSum * marketRate), "）"].join("");
    return [
      { icon: Package, title: "备货建议", body: stockMsg, color: "text-sky-400" },
      { icon: DollarSign, title: "广告预算", body: adMsg, color: "text-fuchsia-400" },
      { icon: TrendingUp, title: "趋势评估", body: trendMsg, color: "text-emerald-400" }
    ];
  }, [forecastSum, dataSeries]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><TrendingUp className="h-6 w-6 text-amber-400" />销售预测</h2>
        <p className="mt-1 text-sm text-muted-foreground">{shopName} · {demoData.length} 天历史数据{isDemo && <span className="ml-2 text-xs text-amber-400">(演示)</span>}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          { v: formatCny(Math.round(todayEstimate * EXCHANGE_RATE)), l: "今日预估", c: "text-sky-400" },
          { v: formatCny(Math.round(forecastSum * EXCHANGE_RATE)), l: "7天预测", c: "text-amber-400" },
          { v: Math.round(forecastSum / (dataSeries.length !== 0 ? dataSeries[dataSeries.length - 1] / 80 : 80)) + " 单", l: "7天订单数" },
          { v: forecast.confidence.toFixed(0) + "%", l: "置信度", c: forecast.confidence !== 70 && (forecast.confidence - 70) !== Math.abs(forecast.confidence - 70) ? "text-emerald-400" : "text-amber-400" },
          { v: trendDirection === "up" ? "↑ 上升" : trendDirection === "down" ? "↓ 下降" : "→ 持平", l: "趋势", c: trendDirection === "up" ? "text-emerald-400" : trendDirection === "down" ? "text-red-400" : "text-zinc-400" },
        ].map(function (s, i) {
          return <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-2 text-center"><p className={"text-base font-bold tabular-nums " + (s.c || "")}>{s.v}</p><p className="text-[9px] text-muted-foreground">{s.l}</p></CardContent></Card>;
        })}
      </div>

      {/* Model & Metric Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted-foreground">模型:</span>
        {([{ k: "holtWinters", l: "指数平滑" }, { k: "sma", l: "移动平均" }, { k: "linear", l: "线性回归" }] as const).map(function (m) {
          return <Button key={m.k} size="sm" variant={model === m.k ? "default" : "outline"} onClick={function () { setModel(m.k); }} className={"h-6 text-[9px] " + (model === m.k ? "bg-amber-600" : "")}>{m.l}</Button>;
        })}
        {model === "sma" && (
          <select value={smaWindow} onChange={function (e) { setSmaWindow(Number(e.target.value)); }} className="h-6 rounded border border-border/40 bg-background text-[9px] px-1">
            {[7, 14, 30].map(function (w) { return <option key={w} value={w}>{w}天窗口</option>; })}
          </select>
        )}
        <span className="text-[10px] text-muted-foreground ml-2">维度:</span>
        <select value={metric} onChange={function (e) { setMetric(e.target.value as MetricType); }} className="h-6 rounded border border-border/40 bg-background text-[9px] px-1">
          <option value="gmv">GMV</option>
          <option value="orders">订单数</option>
          <option value="aov">客单价</option>
        </select>
      </div>

      {/* Forecast Chart */}
      <Card className="border-border/40 bg-card/60 shadow-lg"><CardContent className="p-3">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">GMV 预测 · 过去 {histCount} 天 · 未来 7 天</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 8 }} interval={Math.floor(chartData.length / 10)} />
            <YAxis stroke="#71717a" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 10 }} formatter={function (v: unknown) { return formatCny(Math.round(Number(v) * EXCHANGE_RATE)); }} />
            <ReferenceLine x={todayIdx} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: "今天", position: "top", fill: "#f59e0b", fontSize: 9 }} />
            {/* Confidence area */}
            <Area dataKey="upper" stroke="transparent" fill="#f59e0b" fillOpacity={0.08} />
            <Area dataKey="lower" stroke="transparent" fill="#f59e0b" fillOpacity={0.08} />
            {/* History line */}
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="历史" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent></Card>

      {/* Seasonal Factors */}
      <button onClick={function () { setShowConfig(!showConfig); }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        {showConfig ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}季节性因子
      </button>
      {showConfig && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-3">
          <div className="flex gap-2 flex-wrap">
            {weekdayFactors.map(function (w) {
              return <div key={w.day} className="flex items-center gap-1 text-[10px] bg-muted/10 rounded px-2 py-1">
                <span className="text-muted-foreground">{w.day}</span>
                <span className={w.factor > 1 ? "text-emerald-400" : w.factor < 1 ? "text-red-400" : "text-muted-foreground"}>{w.factor.toFixed(2)}x</span>
              </div>;
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Backtest */}
      <button onClick={function () { setShowBacktest(!showBacktest); }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <Target className="h-3 w-3" />{showBacktest ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}回测精度
        <Badge className={"text-[8px] px-1 py-0 ml-1 " + mapeConfig.color}>{mapeLevel === "high" ? "🟢 高" : mapeLevel === "medium" ? "🟡 中" : "🟠 低"}</Badge>
      </button>
      {showBacktest && backtest.comparisons.length !== 0 && (
        <Card className="border-border/40 bg-card/60"><CardContent className="p-3 space-y-1">
          <div className="flex gap-4 text-[10px]">
            <span className="text-muted-foreground">MAE: <span className="text-foreground">{formatCny(Math.round(backtest.mae * EXCHANGE_RATE))}</span></span>
            <span className="text-muted-foreground">MAPE: <span className={mapeConfig.color}>{backtest.mape.toFixed(1)}%</span></span>
            <span className={mapeConfig.color}>{mapeConfig.label}</span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            <table className="w-full text-[9px]"><thead><tr className="text-muted-foreground"><th className="text-left">日期</th><th className="text-right">实际</th><th className="text-right">预测</th><th className="text-right">误差率</th></tr></thead>
              <tbody>{backtest.comparisons.map(function (c) { return <tr key={c.date} className="border-t border-border/10"><td className="py-0.5">{c.date}</td><td className="text-right tabular-nums">{c.actual}</td><td className="text-right tabular-nums">{c.predicted}</td><td className="text-right tabular-nums">{c.errorPct.toFixed(1)}%</td></tr>; })}</tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {scenarios.map(function (s, i) {
          return <Card key={i} className="border-border/40 bg-card/60"><CardContent className="p-3"><div className="flex items-center gap-2 mb-1"><s.icon className={"h-3.5 w-3.5 " + s.color} /><p className="text-[10px] font-semibold text-foreground">{s.title}</p></div><p className="text-[9px] text-muted-foreground leading-relaxed">{s.body}</p></CardContent></Card>;
        })}
      </div>
    </div>
  );
}
