"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bug, Home } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(function () {
    console.error("[app] Global Error Boundary caught:", error);
  }, [error]);

  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
              <Bug className="h-10 w-10 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mb-3">系统遇到了意外错误</h1>
            <p className="text-sm text-zinc-400 mb-1">{error.message || "应用运行时错误"}</p>
            {error.digest && (
              <p className="text-xs text-zinc-600 font-mono mb-6">ID: {error.digest}</p>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={reset}
                className="h-10 bg-emerald-600 text-white text-sm hover:bg-emerald-500 gap-2"
              >
                <Bug className="h-4 w-4" /> 重试
              </Button>
              <Button
                onClick={function () { window.location.href = "/config"; }}
                variant="outline"
                className="h-10 text-sm gap-2"
              >
                <Home className="h-4 w-4" /> 返回首页
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
