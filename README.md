# 🚀 Shopify CN Pro

<div align="center">

**专为国内独立站卖家打造的全球化、多市场自适应智能座舱看板**

拒绝冷冰冰的死板数字。不仅帮你看账，更帮你在多店铺、全球大促、财务对账、风险防范中进行全链路智能化操盘。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release v0.2.0-beta](https://img.shields.io/badge/Release-v0.2.0--beta-10b981)](https://github.com/your-username/shopify-cn-dashboard/releases)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![Shopify 2026-04](https://img.shields.io/badge/Shopify_API-2026--04-96BF48)](https://shopify.dev/)
[![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38BDF8)](https://tailwindcss.com/)

</div>

---

## 🎯 项目简介

**Shopify CN Pro** 是一款面向跨境电商独立站卖家的开源全栈数据大屏。基于 2026 年最新技术栈和 Shopify 2026-04 Stable API 构建。100% 暗黑系高级 SaaS UI 设计，专为中国卖家的业务直觉、对账习惯和全球化运营需求深度定制。

> 适用人群：Shopify 独立站操盘手 · 多店铺卖家 · 跨境电商运营团队 · 零成本体验 Shopify 数据分析的开发者。

---

## ✨ 四大核心硬核统计面板

### 📊 实时核心看板 (OverviewPanel)

- **30s 心跳爆单流**：短轮询引擎每 30 秒有 50% 概率生成虚拟新订单，模拟真实站点的疯狂进单节奏
- **当天实时销量走势**：折线图引入「当前小时硬件锁」机制，严格截断未来时段并留白，末端跟随心跳原地动态拔高
- **全球多市场节日感知**：自动嗅探订单 Top 3 目的国，实时接入免费 [Nager.Date](https://date.nager.at) 全球节日 API，生成多国商机倒计时 Tabs（🇺🇸 Labour Day · 🇬🇧 Bank Holiday · 🇩🇪 Tag der Deutschen Einheit）
- **实时商品排行榜**：销量实时反哺，库存动态扣减，排行榜 `sort()` 丝滑上浮排序；库存跌破 10 件时红色 Badge 警报自动亮起
- **利润构成饼图**：可调成本滑块（采购 % · 物流 % · 广告 %）实时联动四色 Donut PieChart
- **风控雷达**：退款率三段色标警报（绿 < 1% · 黄 1%-1.5% · 红 > 1.5% + 呼吸灯动画）

### 🧠 AI 跨境智囊诊断 (AiDiagnosePanel)

- 独立全宽智能诊断卡片
- 基于 GMV / 订单数 / 商品数据的实时诊断引擎
- 生成大白话报告 + 转化率分析 + 库存预警 + 3 条保姆级行动建议
- 预留 DeepSeek API 接入骨架，配 `.env.local` 即可激活

### 💰 网关渠道精细对账 (GatewayFinancePanel)

- 自动识别订单支付网关（Stripe / Shopify Payments / PayPal），大小写不敏感匹配
- 自定义扣点费率（百分比 + 固定费用），实时计算网关总手续费与预计净结汇金额
- Recharts Donut 环形图展示渠道占比 + 网关明细流水 Table（含费率公式列 + 合计行）

### 🎯 转化漏斗与复购留存 (FunnelRetentionPanel)

- 横向营销流失漏斗：`商品访客 → 加入购物车 → 发起结账 → 最终成交`，4 阶段渐变色 BarChart
- 自动诊断流失最严重环节：加购到结账转化率 < 40% 时触发红色 AI 建议弹条
- 新老客营收贡献饼图 + 双卡片进度条
- 用户黏性健康度评级（优秀 / 良好 / 一般 / 偏低）自动计算

---

## 🧩 全功能矩阵（8 大面板）

```
┌──────────────────────┬──────────────────────────────────────┐
│  Sidebar (w-64)       │  Content Area                        │
├──────────────────────┼──────────────────────────────────────┤
│ 🚀 Shopify CN Pro     │                                      │
│ ─────────────────    │  ┌─────────────────────────────────┐ │
│                      │  │ Switching via React Context      │ │
│ 📊 核心实时看板       │  │ activeMenu → Conditional Render  │ │
│ 🧠 AI 智能诊断        │  └─────────────────────────────────┘ │
│ 💰 供应链对账         │                                      │
│ 🛡️ 风控雷达          │  Configurable cost sliders,          │
│ 📈 趋势同比           │  holiday countdown Tabs,            │
│ 🌐 全店聚合           │  heartbeat Live indicator,          │
│ 🏦 网关对账           │  currentHour hardware lock...       │
│ 🧠 漏斗转化           │                                      │
│                      │                                      │
│ ⚙ 重新绑定店铺       │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

| # | 面板 | 图标 | 核心能力 |
|---|---|---|---|
| 1 | 核心实时看板 | LayoutDashboard | 心跳轮询 · 实时折线图 · 多国节日 · 商品排行榜 · 利润饼图 · 风控雷达 |
| 2 | AI 智能诊断 | Brain | 一屏全宽诊断报告 · 库存预警 · 行动建议 · DeepSeek 接入 |
| 3 | 供应链对账 | Coins | 3 滑块成本配置 · 大号 Donut 利润饼图 · GMV + 毛利率卡片 |
| 4 | 风控雷达 | Shield | 放大呼吸灯警报 · 退款率三格统计 · 商品风控评级 Table |
| 5 | 趋势同比 | BarChart3 | 14 天数据回顾 · 环比增长率 · Recharts 双线 LineChart |
| 6 | 全店聚合 | Layers | localStorage 多店铺 · 堆叠 BarChart · 🥇🥈🥉 贡献率排行 |
| 7 | 网关对账 | Landmark | Stripe / PayPal 费率 · 网关手续费 · Donut + 明细 Table |
| 8 | 漏斗转化 | Brain | 营销漏斗 BarChart · 复购留存 · 新老客营收 · AI 流失诊断 |

---

## 🔒 隐私安全至上

```
┌──────────┐      ┌──────────────────┐      ┌─────────────┐
│ 浏览器     │ ───→ │ Next.js API Route │ ───→ │ Shopify API │
│ (用户)    │ ←─── │ (后端代理)         │ ←─── │ (官方)      │
└──────────┘      └──────────────────┘      └─────────────┘
     ↑                                         绝不经过
  Token 仅存于                                 任何第三方
  LocalStorage
```

- ✅ **免登录** · **无数据库** · **无服务器**
- ✅ API Token 仅保存在浏览器 `LocalStorage` 中，不上传至任何第三方
- ✅ 所有 API 请求经 Next.js 后端路由直接转发至 Shopify 官方
- ✅ 100% 开源可审计，任何开发者均可审查数据流向

---

## 🎭 0 门槛沙盒体验

内置「✨ 一键导入演示数据」功能：

- 2 家高保真虚拟店铺（**TechGear Pro** 科技配饰 · **MinimalHome** 极简家居）
- 跨越 **14 天**的历史订单流，本周 vs 上周 ~15% 自然增长
- 30 秒心跳爆单引擎实时生效，完整模拟真实站点心跳泵感
- 无需 Shopify Token 即可 1 秒完整体验全部 8 个面板

---

## 📦 技术栈

| 层级 | 技术选型 |
|---|---|
| 全栈框架 | Next.js 16 (App Router + Turbopack) |
| UI 框架 | React 19 |
| 语言 | TypeScript (strict) |
| 样式方案 | Tailwind CSS 4 + shadcn/ui |
| 数据可视化 | Recharts (AreaChart · LineChart · PieChart · BarChart · Donut) |
| 图标库 | Lucide React |
| Shopify API | Admin REST API 2026-04 |
| 全球节日 | Nager.Date (免费开源) |
| 数据持久化 | 浏览器 LocalStorage |

---

## 📁 项目架构

```
shopify-cn-dashboard/
├── app/
│   ├── page.tsx                         # 根路由 → 重定向 /config
│   ├── layout.tsx                       # 全局根布局
│   ├── globals.css                      # 暗黑主题 + 自定义动画
│   ├── config/
│   │   └── page.tsx                     # 店铺配置页（含演示入口）
│   ├── dashboard/
│   │   ├── layout.tsx                   # 宽屏侧边栏 + Context Provider
│   │   ├── page.tsx                     # 状态中心 + 条件渲染分发
│   │   ├── config.ts                    # 全局常量（汇率/费率/阈值）
│   │   ├── helpers.ts                   # 共享工具函数
│   │   └── components/
│   │       ├── OverviewPanel.tsx         # 核心实时看板
│   │       ├── AiDiagnosePanel.tsx       # AI 智能诊断
│   │       ├── FinancePanel.tsx          # 供应链对账
│   │       ├── RiskRadarPanel.tsx        # 风控预警中心
│   │       ├── TrendAnalysisPanel.tsx    # 趋势同比环比
│   │       ├── MultiStoreAggregator.tsx  # 全店聚合大盘
│   │       ├── GatewayFinancePanel.tsx   # 网关对账
│   │       └── FunnelRetentionPanel.tsx  # 漏斗转化复购
│   └── api/
│       └── shopify/
│           └── dashboard/
│               └── route.ts             # 后端代理 + 节日聚合
├── components/
│   └── ui/                              # shadcn/ui 组件库
├── lib/
│   ├── utils.ts                         # cn() 工具函数
│   └── demo-data.ts                     # 演示数据引擎
├── .env.example
├── README.md
├── package.json
└── tsconfig.json
```

---

## 🚀 快速开始

### 前置条件

- **Node.js** >= 18
- **npm** >= 9

### 1. 克隆项目

```bash
git clone https://github.com/your-username/shopify-cn-dashboard.git
cd shopify-cn-dashboard
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量（可选）

```bash
cp .env.example .env.local
```

```bash
# 美元兑人民币汇率（默认 7.25）
NEXT_PUBLIC_EXCHANGE_RATE=7.25

# DeepSeek API Key（可选，激活 AI 实时诊断）
# DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 5. 选择体验方式

| 方式 | 操作 |
|---|---|
| 🎭 **演示模式** | 点击「✨ 一键导入演示数据」，1 秒体验完整 8 面板大屏 |
| 🔗 **真实店铺** | 输入 `your-store.myshopify.com` + Admin API Token |

> 真实模式下系统 100% 读取 Shopify 2026-04 Stable API，绝不混入任何模拟逻辑。

### 6. 生产构建

```bash
npm run build
npm start
```

---

## 📊 CSV 一键导出

点击「导出报表」按钮，下载 `Shopify_今日财务报表_{店铺名}_{日期}.csv`，带 BOM 头，Excel 直接打开中文不乱码：

| 列 | 内容 |
|---|---|
| 订单ID | Shopify Order ID |
| 下单时间（北京时间） | UTC+8 转换 |
| 美元金额 (USD) | 原始金额 |
| 人民币金额 (CNY) | USD × 汇率 |
| 付款状态 | 中文映射 (已支付/待处理/已退款) |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

- 🐛 Bug 报告：请附带复现步骤与截图
- 💡 功能建议：欢迎在 Issue 中讨论
- 🔧 代码贡献：`Fork → Feature Branch → PR`

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由用于个人项目与商业用途。

---

<div align="center">

Made with 💚 for Shopify sellers worldwide.

</div>
