/* ─── Sales Forecast Utilities ───────────────────────── */

export interface ForecastPoint {
  date: string; value: number; isPrediction: boolean;
  upper?: number; lower?: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  confidence: number; // 0-100
  mape?: number;
}

export interface AccuracyReport {
  mae: number; mape: number; comparisons: Array<{ date: string; actual: number; predicted: number; error: number; errorPct: number }>;
}

export interface Decomposition {
  trend: number[]; seasonal: number[]; residual: number[];
}

/** Simple Moving Average */
export function smaForecast(data: number[], window: number, periods: number): ForecastResult {
  const result: ForecastPoint[] = [];
  const history = data.map((v, i) => ({ date: "Day-" + (data.length - i), value: v, isPrediction: false }));
  result.push(...history);

  if (data.length < window) {
    return { points: result, confidence: 0 };
  }

  const lastWindow = data.slice(-window);
  const avg = lastWindow.reduce((s, v) => s + v, 0) / window;
  const variance = lastWindow.reduce((s, v) => s + (v - avg) ** 2, 0) / window;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, Math.min(100, 100 - (stdDev / (avg || 1)) * 100));

  for (let i = 0; i < periods; i++) {
    result.push({
      date: "F+" + (i + 1),
      value: Math.round(avg * 100) / 100,
      isPrediction: true,
      upper: Math.round((avg + 1.28 * stdDev) * 100) / 100,
      lower: Math.max(0, Math.round((avg - 1.28 * stdDev) * 100) / 100),
    });
  }
  return { points: result, confidence };
}

/** Linear Regression */
export function linearRegressionForecast(data: number[], periods: number): ForecastResult {
  const n = data.length;
  const result: ForecastPoint[] = data.map((v, i) => ({ date: "H-" + (n - i), value: v, isPrediction: false }));

  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += data[i]; sxy += i * data[i]; sx2 += i * i;
  }
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const intercept = (sy - slope * sx) / n;

  // Calculate residuals for confidence
  let sumSqResid = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    sumSqResid += (data[i] - pred) ** 2;
  }
  const stdErr = Math.sqrt(sumSqResid / (n - 2));

  const confidence = Math.max(0, Math.min(100, 100 - (stdErr / (Math.abs(slope) * 10 + 1)) * 100));

  for (let i = 0; i < periods; i++) {
    const pred = intercept + slope * (n + i);
    result.push({
      date: "F+" + (i + 1),
      value: Math.max(0, Math.round(pred * 100) / 100),
      isPrediction: true,
      upper: Math.max(0, Math.round((pred + 1.28 * stdErr) * 100) / 100),
      lower: Math.max(0, Math.round((pred - 1.28 * stdErr) * 100) / 100),
    });
  }
  return { points: result, confidence };
}

/** Holt-Winters Double Exponential Smoothing (trend only, no seasonality for simplicity) */
export function holtWintersForecast(data: number[], periods: number): ForecastResult {
  const n = data.length;
  const result: ForecastPoint[] = data.map((v, i) => ({ date: "H-" + (n - i), value: v, isPrediction: false }));

  const alpha = 0.3; const beta = 0.1;
  let level = data[0];
  let trend = data.length >= 2 ? data[1] - data[0] : 0;
  const smoothed: number[] = [];

  for (let i = 0; i < n; i++) {
    if (i === 0) { smoothed.push(level); continue; }
    const prevLevel = level;
    level = alpha * data[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    smoothed.push(level);
  }

  // Calculate error std dev
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) { sumSqErr += (data[i] - smoothed[i]) ** 2; }
  const stdErr = Math.sqrt(sumSqErr / n);
  const confidence = Math.max(0, Math.min(100, 100 - (stdErr / (level || 1)) * 100));

  for (let i = 1; i <= periods; i++) {
    const pred = level + trend * i;
    result.push({
      date: "F+" + i,
      value: Math.max(0, Math.round(pred * 100) / 100),
      isPrediction: true,
      upper: Math.max(0, Math.round((pred + 1.28 * stdErr * Math.sqrt(i)) * 100) / 100),
      lower: Math.max(0, Math.round((pred - 1.28 * stdErr * Math.sqrt(i)) * 100) / 100),
    });
  }
  return { points: result, confidence };
}

/** Backtest accuracy */
export function calculateAccuracy(actual: number[], predicted: number[]): AccuracyReport {
  const comparisons: AccuracyReport["comparisons"] = [];
  let sumAbsErr = 0;
  let sumAbsPct = 0;
  const len = Math.min(actual.length, predicted.length);

  for (let i = 0; i < len; i++) {
    const a = actual[i];
    const p = predicted[i];
    const err = Math.abs(a - p);
    const errPct = a !== 0 ? (err / Math.abs(a)) * 100 : 0;
    comparisons.push({ date: "Day " + (i + 1), actual: a, predicted: p, error: err, errorPct: errPct });
    sumAbsErr += err;
    sumAbsPct += errPct;
  }

  return {
    mae: len > 0 ? Math.round(sumAbsErr / len * 100) / 100 : 0,
    mape: len > 0 ? Math.round(sumAbsPct / len * 100) / 100 : 0,
    comparisons,
  };
}

/** Calculate seasonal factors by day-of-week */
export function calcWeekdayFactor(data: number[]): Array<{ day: string; factor: number }> {
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (let i = 0; i < data.length; i++) {
    const dow = i % 7;
    sums[dow] += data[i];
    counts[dow]++;
  }
  const avg = sums.reduce((s, v) => s + v, 0) / counts.reduce((s, v) => s + v, 0);
  return days.map((d, i) => ({ day: d, factor: counts[i] > 0 ? Math.round((sums[i] / counts[i] / avg) * 100) / 100 : 1 }));
}

/** Generate demo data with weekly seasonality */
export function generateDemoGMV(days: number): number[] {
  const rng = (s: number) => { let v = s; return () => { v = (v * 16807) % 2147483647; return (v - 1) / 2147483646; }; };
  const rand = rng(42);
  const base = 5000;
  const trend = 1 / 30; // slight upward
  const result: number[] = [];

  for (let i = 0; i < days; i++) {
    const dayOfWeek = i % 7;
    const seasonal = dayOfWeek === 5 ? 0.7 : dayOfWeek === 6 ? 0.5 : dayOfWeek === 0 ? 0.85 : dayOfWeek === 1 ? 0.95 : 1.1;
    const trendFactor = 1 + trend * i;
    const noise = 0.85 + rand() * 0.3;
    result.push(Math.round(base * seasonal * trendFactor * noise));
  }
  return result;
}
