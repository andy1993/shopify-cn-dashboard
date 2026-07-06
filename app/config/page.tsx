"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Store,
  Key,
  ArrowRight,
  ShoppingBag,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DEMO_STORES } from "@/lib/demo-data";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function ConfigPage() {
  var router = useRouter();
  var [domain, setDomain] = useState("");
  var [token, setToken] = useState("");
  var [loading, setLoading] = useState(false);
  var [demoLoading, setDemoLoading] = useState(false);

  // ── Connect real store ──
  var handleConnect = function () {
    setLoading(true);

    var newStore = {
      id: crypto.randomUUID(),
      shopUrl: domain.trim(),
      accessToken: token.trim(),
      shopName: domain.trim().replace(".myshopify.com", ""),
    };

    var raw = localStorage.getItem("shopify_stores");
    var stores: any[] = [];
    try { stores = raw ? JSON.parse(raw) : []; } catch { stores = []; }
    stores.push(newStore);
    localStorage.setItem("shopify_stores", JSON.stringify(stores));
    localStorage.setItem("shopify_current_store_id", newStore.id);

    setTimeout(function () { router.push("/dashboard"); }, 1000);
  };

  // ── Load demo stores ──
  var handleLoadDemo = function () {
    setDemoLoading(true);
    setTimeout(function () {
      var demoStores = DEMO_STORES.map(function (store, i) {
        return {
          id: "demo-" + i,
          shopUrl: store.domain,
          accessToken: "demo-mode",
          shopName: store.shopName,
          isDemo: true,
        };
      });

      localStorage.setItem("shopify_stores", JSON.stringify(demoStores));
      localStorage.setItem("shopify_current_store_id", "demo-0");
      router.push("/dashboard");
    }, 800);
  };

  var isValid = domain.trim().length > 0 && token.trim().length > 0;

  // ── Render ──
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sky-500/5 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/3 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <ShoppingBag className="h-7 w-7 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shopify 店铺配置
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          连接你的 Shopify 店铺，开始数据洞察之旅
        </p>
      </div>

      {/* Form Card */}
      <Card className="relative w-full max-w-md border-border/40 bg-card/80 shadow-2xl shadow-black/5 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-lg">店铺连接</CardTitle>
          <CardDescription>
            输入你的 Shopify 店铺凭据以建立连接
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Domain */}
          <div className="space-y-2">
            <label
              htmlFor="domain"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <Store className="h-4 w-4 text-muted-foreground" />
              Shopify 域名
            </label>
            <Input
              id="domain"
              type="text"
              placeholder="your-store.myshopify.com"
              value={domain}
              onChange={function (e) { setDomain(e.target.value); }}
              className="h-10"
            />
          </div>

          {/* API Token */}
          <div className="space-y-2">
            <label
              htmlFor="token"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <Key className="h-4 w-4 text-muted-foreground" />
              Admin API Token
            </label>
            <Input
              id="token"
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={function (e) { setToken(e.target.value); }}
              className="h-10 font-mono tracking-wide"
            />
            <p className="text-xs text-muted-foreground">
              可在 Shopify Admin &rarr; 设置 &rarr; 应用和销售渠道 中获取
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            size="lg"
            className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700"
            disabled={!isValid || loading}
            onClick={handleConnect}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在连接...
              </>
            ) : (
              <>
                连接店铺
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* ── Divider + Demo Button ── */}
      <div className="relative my-6 flex w-full max-w-md items-center gap-4">
        <div className="h-px flex-1 bg-border/50" />
        <span className="shrink-0 text-xs text-muted-foreground">或</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full max-w-md gap-2 border-dashed border-amber-500/40 bg-amber-500/5 text-amber-400 transition-all hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300"
        disabled={demoLoading}
        onClick={handleLoadDemo}
      >
        {demoLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            正在准备演示数据...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            一键导入演示数据试用
          </>
        )}
      </Button>

      {/* Security Notice */}
      <Card className="relative mt-6 w-full max-w-md border-emerald-500/20 bg-emerald-500/5 ring-1 ring-emerald-500/10 backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-400">
                  安全声明
                </span>
                <Badge
                  variant="default"
                  className="bg-emerald-500/20 px-1.5 py-0 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20"
                >
                  隐私优先
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                本系统为纯前端 / 无服务器架构（Serverless），您的 Admin API
                Token 仅保存在本地浏览器的 LocalStorage 中。所有的 API
                请求均通过您本地运行的 Next.js 后端路由直接安全转发至
                Shopify 官方服务器，绝不经过任何第三方，100% 保证数据隐私。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
