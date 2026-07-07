"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(function () {
    console.error("[dashboard] Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md px-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <AlertTriangle className="h-9 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">面板出了点问题</h2>
        <p className="text-base text-zinc-400 mb-2">{error.message || "未知运行时错误"}</p>
        {error.digest && (
          <p className="text-sm text-zinc-600 font-mono mb-4">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="h-9 bg-emerald-600 text-white text-base hover:bg-emerald-500"
          >
            重试
          </Button>
          <Button
            onClick={function () { window.location.href = "/config"; }}
            variant="outline"
            className="h-9 text-base"
          >
            返回配置页
          </Button>
        </div>
      </div>
    </div>
  );
}
