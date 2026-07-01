"use client";

import { Brain, Sparkles, Bot, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────

interface DiagnosisReport {
  overview: string;
  conversionAnalysis: string;
  inventoryAlerts: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
}

interface AiDiagnosePanelProps {
  shopName: string;
  isDemo: boolean;
  handleStartDiagnosis: () => void;
  diagnosing: boolean;
  diagnosis: DiagnosisReport | null;
  typewriterText: string;
}

// ─── Panel ─────────────────────────────────────────────

export default function AiDiagnosePanel({
  shopName,
  isDemo,
  handleStartDiagnosis,
  diagnosing,
  diagnosis,
  typewriterText,
}: AiDiagnosePanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Brain className="h-6 w-6 text-amber-400" />
            AI 智能诊断
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            基于 {shopName} 今日运营数据的智能深度分析
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleStartDiagnosis}
          disabled={diagnosing}
          className="gap-2 bg-amber-600 text-white hover:bg-amber-500"
        >
          <Sparkles className="h-4 w-4" />
          {diagnosing ? "诊断中..." : diagnosis ? "重新诊断" : "开始诊断"}
        </Button>
      </div>

      {/* Loading */}
      {diagnosing && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="flex flex-col items-center gap-5 py-16">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-500 border-r-amber-500/30" />
              <Bot className="relative h-7 w-7 text-amber-400" />
            </div>
            <p className="text-sm font-medium text-foreground">{typewriterText}</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No diagnosis */}
      {!diagnosing && !diagnosis && (
        <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <Brain className="h-10 w-10 text-amber-400" />
            </div>
            <p className="text-lg font-medium text-foreground">尚未生成诊断报告</p>
            <p className="text-sm text-muted-foreground">点击上方「开始诊断」按钮获取 AI 运营建议</p>
            {!isDemo && (
              <div className="mt-2 w-full max-w-md rounded-lg border border-border/30 bg-muted/30 p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">💡 想要真正的 AI 实时诊断？</p>
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/70">
                  {`// .env.local\nDEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx\n// POST /api/ai/diagnose`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Result */}
      {!diagnosing && diagnosis && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">风险等级：</span>
            <Badge
              variant={diagnosis.riskLevel === "high" ? "destructive" : diagnosis.riskLevel === "medium" ? "default" : "outline"}
              className={
                diagnosis.riskLevel === "high" ? "bg-red-500/20 text-red-400"
                : diagnosis.riskLevel === "medium" ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
              }
            >
              {diagnosis.riskLevel === "high" ? "高风险" : diagnosis.riskLevel === "medium" ? "中等风险" : "低风险"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
              <CardContent className="p-5">
                {diagnosis.overview.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h3 key={i} className="mb-2 text-sm font-semibold text-foreground">{line.replace("## ", "")}</h3>;
                  return <p key={i} className="my-1 text-sm leading-relaxed text-muted-foreground">{line}</p>;
                })}
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
              <CardContent className="p-5">
                {diagnosis.conversionAnalysis.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h3 key={i} className="mb-2 text-sm font-semibold text-foreground">{line.replace("## ", "")}</h3>;
                  return <p key={i} className="my-1 text-sm leading-relaxed text-muted-foreground">{line}</p>;
                })}
              </CardContent>
            </Card>
          </div>

          {diagnosis.inventoryAlerts.map((alert, i) => (
            <Card
              key={i}
              className={`border-border/40 shadow-lg backdrop-blur-lg ${
                alert.startsWith("## 🔴") ? "border-red-500/20 bg-red-500/5"
                : alert.startsWith("## 🟡") ? "border-amber-500/20 bg-amber-500/5"
                : "border-emerald-500/20 bg-emerald-500/5"
              }`}
            >
              <CardContent className="p-5">
                {alert.split("\n").map((line, j) => {
                  if (line.startsWith("## ")) return <h3 key={j} className="mb-2 text-sm font-semibold text-foreground">{line.replace(/^##\s*/, "")}</h3>;
                  if (line.startsWith("> ")) return <p key={j} className="my-1 border-l-2 border-border/30 pl-3 text-sm italic text-muted-foreground">{line.replace("> ", "")}</p>;
                  return line ? <p key={j} className="my-1 text-sm leading-relaxed text-muted-foreground">{line}</p> : null;
                })}
              </CardContent>
            </Card>
          ))}

          <Card className="border-amber-500/20 bg-amber-500/5 shadow-lg backdrop-blur-lg">
            <CardContent className="p-5">
              {diagnosis.recommendations.map((rec, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  {rec.split("\n").map((line, j) => {
                    if (line.startsWith("## ")) return <h3 key={j} className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Lightbulb className="h-4 w-4 text-amber-400" />{line.replace(/^##\s*/, "")}</h3>;
                    if (line.startsWith("### ")) return <h4 key={j} className="mb-1 mt-2 text-sm font-medium text-amber-300">{line.replace("### ", "")}</h4>;
                    if (line.startsWith("> ")) return <p key={j} className="my-1 border-l-2 border-amber-500/20 pl-3 text-sm italic text-muted-foreground">{line.replace("> ", "")}</p>;
                    return <p key={j} className="my-1 text-sm leading-relaxed text-muted-foreground">{line}</p>;
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
