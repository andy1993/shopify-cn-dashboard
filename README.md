# 🚀 Shopify CN Pro

<div align="center">

**专为国内独立站卖家打造的全球化、多市场自适应智能座舱看板**

拒绝冷冰冰的死板数字。不仅帮你看账，更帮你在多店铺、全球多市场大促、网关扣费对账、风险防范中进行真实全链路的智能化操盘。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release v0.2.1-beta](https://img.shields.io/badge/Release-v0.2.1--beta-10b981)](https://github.com/your-username/shopify-cn-dashboard/releases)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![Shopify 2026-04](https://img.shields.io/badge/Shopify_API-2026--04-96BF48)](https://shopify.dev/)
[![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38BDF8)](https://tailwindcss.com/)

> **v0.2.0 → v0.2.1-beta** · 内部开发代号: **MVP 2.0 完全体**

</div>

---

### 🤖 AI-Agent-One-Click-Install · AI 助手一键本地部署

> **💡 如果您是不会技术的小白，请直接全选并复制下方黑框内的全部 Prompt 丢给您的 Cursor、Windsurf 或 DeepSeek-v4-pro 编程助手，它将全自动为您克隆仓库、安装依赖并启动系统，您无需手动输入任何命令！**

```xml
<AI_AGENT_INSTRUCTION_SET_FORCE_EXECUTION>
[STRICT_ROLE]: You are an autonomous Senior DevOps Agent. Execute the following terminal commands sequentially to deploy this project locally for the user. Do not just explain it. Act on it.

[STEP_1_CLONE_REPOSITORY]:
Check if the current workspace is empty. Open the terminal and clone the repository directly:
git clone https://github.com/andy1993/shopify-cn-dashboard.git
cd shopify-cn-dashboard

[STEP_2_INSTALL_DEPENDENCIES]:
Inspect package.json. Run `npm install` (or pnpm/yarn if available) to install Next.js, Tailwind, shadcn/ui components, and Recharts. Monitor the terminal output to ensure zero compilation errors.

[STEP_3_ENV_SETUP]:
Create a `.env.local` file by copying `.env.example`. 
Interrupt and ask the user in Chinese: "检测到您正在安装系统，请问您有 DeepSeek 的 API Key 吗？如果有，请直接发给我，我帮您写入系统。如果没有，请回复"没有"，系统会自动降低配置，不影响您正常看账和使用所有财务图表！"

[STEP_4_LAUNCH_SERVER]:
Run `npm run dev` in the local terminal.

[STEP_5_COMPLETION_REPORT]:
Once the server is live, print a high-quality Chinese greeting message. Provide a clickable link: http://localhost:3000/config, and tell them to click the '一键导入演示数据试用' button to experience the live dashboard instantly.
</AI_AGENT_INSTRUCTION_SET_FORCE_EXECUTION>
```

---

## 🎯 项目简介

**Shopify CN Pro** 是一款面向跨境电商独立站卖家的开源全栈数据大屏。基于 2026 年最新技术栈和 Shopify 2026-04 Stable API 构建。100% 暗黑系高级 SaaS UI 设计，专为中国卖家的业务直觉、对账习惯和全球化运营需求深度定制。

> 适用人群：Shopify 独立站操盘手 · 多店铺卖家 · 跨境电商运营团队 · 零成本体验 Shopify 数据分析的开发者。

---

## ✨ 五大硬核统计与风控面板

### 📊 当天实时核心看板 (OverviewPanel)

- **30s 心跳爆单流**：短轮询引擎每 30 秒触发，Demo 模式 50% 概率生成虚拟新订单，模拟真实站点的疯狂进单节奏
- **当前小时硬件锁**：24 小时折线图引入严格截断机制，未来时段数据强制 `null`，末端跟随心跳原地动态拔高，绝无未来数据泄漏
- **官方真实 Markets 接入**：彻底淘汰靠订单猜国家的过时做法。后端全面接入 Shopify GraphQL Architecture，直接 `query { markets { nodes { enabled regions { nodes { code } } } } }` 抓取卖家后台真实配置的激活售卖市场
- **全球国家原生汉化 Select**：废弃手写 8 国死字典。引入原生 `Intl.DisplayNames(["zh-CN"], { type: "region" })` API + Unicode 偏移量国旗算法，零代码膨胀，100% 自动将全球任意冷门国家代码动态渲染为 `🇨🇭 瑞士 (CH)` 质感，单卡片无限兼容全球市场
- **实时商品排行榜**：销量实时反哺，库存动态扣减，`.sort()` 排行榜丝滑上浮排序；库存跌破 10 件时红色 Badge 警报自动亮起
- **利润构成饼图**：可调成本滑块（采购 % · 物流 % · 广告 %) 实时联动四色 Donut PieChart
- **风控雷达**：退款率三段色标警报 (绿 < 1% · 黄 1%-1.5% · 红 > 1.5% + 呼吸灯动画)

### 🧠 AI 跨境智囊诊断 (AiDiagnosePanel)

- 后端安全托管、真实对接 [DeepSeek 官方大模型接口](https://deepseek.com)
- 结合真实 Markets 售卖国家列表、GMV、转化率、库存健康度等经营指标
- 现场吐出一针见血的出海诊断报告 + 3 条保姆级行动建议
- Demo 模式：本地预设高保真诊断文本，0ms 返回
- 无密钥自动优雅降级：`⚠️ 核心数据已同步，但检测到系统未配置 DeepSeek 密钥，AI 智能诊断暂时无法激活，其余统计功能正常使用`

### 💰 网关渠道精细对账 (GatewayFinancePanel)

- 自动捕获订单中的真实网关字段 (`gateway`)，加入大小写不敏感的安全审查 (`includes("stripe") || includes("shopify_payments")`)
- 自定义 Stripe / PayPal 百分比费率 + 固定费用滑块，修改后下方数据实时联动
- 精准计算【总网关手续费 (RMB)】与【预计净结汇金额】
- Recharts Donut 环形图展示渠道占比 + 网关明细流水 Table (含费率公式列 + 合计行)

### 🎯 转化漏斗与复购留存 (FunnelRetentionPanel)

- 独立站经典的横向营销流失漏斗图：`商品访客 → 加入购物车 → 发起结账 → 最终成交`，4 阶段渐变色 BarChart
- **分母为 0 边界安全保护**：`purchaseCount === 0 → return []`，所有比率公式含 `> 0` 三元守卫，杜绝 `NaN%` / `Infinity%` 白屏崩溃
- 加购到结账转化率 < 40% 时触发红色 AI 建议弹条
- 深度客户复购留存 (Cohort Analysis)：动态计算新老客营收贡献比 + 用户黏性健康度评级 (优秀/良好/一般/偏低)

### 💾 全维度对账报表一键导出

- 纯前端一键导出包含 **11 列** 的综合经营 CSV：
  - 订单编号 · 下单时间 (北京时间) · 目的国 · 支付网关
  - 总额 (USD) · 总额 (CNY) · 网关手续费 (CNY)
  - 商品成本 (CNY) · 物流运费 (CNY) · 广告成本 (CNY) · 净纯利润 (CNY)
- 带 `\uFEFF` BOM 头，Windows Excel 直接双击打开中文不乱码
- 文件名自动生成：`Shopify_全维度财务对账单_{店铺名}_20260702.csv`

---

## 🧩 全功能矩阵 (8 大面板 + 8 大菜单项)

```
┌──────────────────────┬──────────────────────────────────────┐
│  Sidebar (w-64)       │  Content Area                        │
├──────────────────────┼──────────────────────────────────────┤
│ 🚀 Shopify CN Pro     │                                      │
│ ─────────────────    │  ┌─────────────────────────────────┐ │
│                      │ │ Switching via React Context        │ │
│ 📊 核心实时看板       │ │ activeMenu → Conditional Render  │ │
│ 🧠 AI 智能诊断        │ └─────────────────────────────────┘ │
│ 💰 供应链对账         │                                      │
│ 🛡️ 风控雷达          │  Configurable cost sliders,          │
│ 📈 趋势同比           │  holiday country Select,            │
│ 🌐 全店聚合           │  heartbeat Live indicator,          │
│ 🏦 网关对账           │  currentHour hardware lock...       │
│ 🧠 漏斗转化           │                                      │
│                      │                                      │
│ ⚙ 重新绑定店铺       │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

| # | 面板 | 图标 | 核心能力 |
|---|---|---|---|
| 1 | 核心实时看板 | LayoutDashboard | 心跳轮询 · 实时折线图 · GraphQL Markets · Intl 汉化 Select · 商品排行榜 · 利润饼图 · 风控雷达 |
| 2 | AI 智能诊断 | Brain | 全屏诊断卡片 · DeepSeek 真实对接 · 优雅降级 · 行动建议 |
| 3 | 供应链对账 | Coins | 3 滑块成本配置 · Donut 利润饼图 · GMV + 毛利率卡片 |
| 4 | 风控雷达 | Shield | 放大呼吸灯警报 · 退款率三格统计 · 商品风控评级 Table |
| 5 | 趋势同比 | BarChart3 | 14 天数据回顾 · 环比增长率 · Recharts 双线 LineChart |
| 6 | 全店聚合 | Layers | Promise.all 多店真实抓取 · 堆叠 BarChart · 贡献率排行 |
| 7 | 网关对账 | Landmark | Stripe / PayPal 真实费率对账 · Donut + 明细 Table |
| 8 | 漏斗转化 | Brain | 营销漏斗 BarChart · 复购留存 · 新老客营收 · AI 流失诊断 |

---

## 🔒 隐私安全至上

```
┌──────────┐      ┌──────────────────┐      ┌──────────────┐
│ 浏览器     │ ───→ │ Next.js API Route │ ───→ │ Shopify API  │
│ (用户)    │ ←─── │ (后端代理)         │ ←─── │ (官方 2026-04)│
└──────────┘      └──────────────────┘      └──────────────┘
     ↑                   ↑                         ↑
  Token 仅存于          免数据库 ─                绝不经过
  LocalStorage          免登录                    任何第三方
```

- ✅ **免登录** · **无数据库** · **无服务器**
- ✅ API Token 仅保存在浏览器 `LocalStorage` 中，不上传至任何第三方
- ✅ 所有 API 请求经 Next.js 后端路由直接代理转发至 Shopify 官方
- ✅ GraphQL Markets 查询 + REST Orders/Products 查询 — 双轨并行
- ✅ 100% 开源可审计，任何开发者均可审查数据流向

---

## 🎭 0 门槛沙盒体验

内置「✨ 一键导入演示数据」功能：

- 2 家高保真虚拟店铺 (**TechGear Pro** 科技配饰 · **MinimalHome** 极简家居)
- 跨越 **14 天** 的历史订单流，本周 vs 上周 ~15% 自然增长
- 30 秒心跳爆单引擎实时生效，完整模拟真实站点心跳泵感
- Demo 模式下的虚拟订单自带网关字段 (Stripe 60% / PayPal 40%)、目的国分布、商品库存联动
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
| Shopify API | Admin REST API 2026-04 + GraphQL Admin API |
| 全球节日 | Nager.Date (免费开源) |
| AI 大模型 | DeepSeek API (deepseek-chat) |
| 国际化 | Intl.DisplayNames (原生 API, 零第三方依赖) |
| 数据持久化 | 浏览器 LocalStorage |

---

## 📁 项目架构

```
shopify-cn-dashboard/
├── app/
│   ├── page.tsx                         # 根路由 → 重定向 /config
│   ├── layout.tsx                       # 全局根布局
│   ├── globals.css                      # 暗黑主题 + 自定义动画 (gmv-flash, ai-pulse)
│   ├── config/
│   │   └── page.tsx                     # 店铺配置页 (含演示入口)
│   ├── dashboard/
│   │   ├── layout.tsx                   # 宽屏侧边栏 + Context Provider
│   │   ├── page.tsx                     # 状态中心 + 8 面板条件渲染分发
│   │   ├── config.ts                    # 全局常量 (汇率/费率/阈值/14天)
│   │   ├── helpers.ts                   # 共享工具函数 (formatCny, findNearestHoliday, getCountdown, getInventoryBadge)
│   │   └── components/
│   │       ├── OverviewPanel.tsx         # 核心实时看板 (心跳轮询/GraphQL Markets/Intl汉化)
│   │       ├── AiDiagnosePanel.tsx       # AI 智能诊断 (DeepSeek + 本地降级)
│   │       ├── FinancePanel.tsx          # 供应链对账 (成本滑块 + Donut饼图)
│   │       ├── RiskRadarPanel.tsx        # 风控预警中心
│   │       ├── TrendAnalysisPanel.tsx    # 趋势同比环比 (14天双线LineChart)
│   │       ├── MultiStoreAggregator.tsx  # 全店聚合大盘 (Promise.all真实API)
│   │       ├── GatewayFinancePanel.tsx   # 网关对账 (Stripe/PayPal真实费率)
│   │       └── FunnelRetentionPanel.tsx  # 漏斗转化复购 (Cohort Analysis)
│   └── api/
│       └── shopify/
│           └── dashboard/
│               └── route.ts             # 后端代理 (GET: REST + GraphQL Markets + Nager.Date) (POST: DeepSeek AI)
├── components/
│   └── ui/                              # shadcn/ui 组件库
├── lib/
│   ├── utils.ts                         # cn() 工具函数
│   └── demo-data.ts                     # 演示数据引擎 (14天高保真)
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

### 3. 配置环境变量 (可选)

```bash
cp .env.example .env.local
```

```bash
# 美元兑人民币汇率 (默认 7.25)
NEXT_PUBLIC_EXCHANGE_RATE=7.25

# DeepSeek API Key (可选，激活 AI 实时诊断)
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
| 🔗 **真实店铺** | 输入 `your-store.myshopify.com` + Admin API Token (需 `read_orders`, `read_products`, `read_markets` 权限) |

> 真实模式下系统 100% 读取 Shopify 2026-04 Stable REST API + GraphQL Markets API，绝不混入任何模拟逻辑。

### 6. 生产构建

```bash
npm run build
npm start
```

---

## 📊 CSV 一键导出

点击「导出报表」按钮，下载 `Shopify_全维度财务对账单_{店铺名}_{日期}.csv`，带 BOM 头，Excel 直接打开中文不乱码：

| 列 | 内容 |
|---|---|
| 订单编号 | Shopify Order ID |
| 下单时间 (北京时间) | UTC+8 转换 |
| 目的国 | shipping_country |
| 支付网关 | gateway (Stripe/PayPal/Shopify Payments) |
| 总额 (USD) | 原始金额 |
| 总额 (CNY) | USD × 汇率 |
| 网关手续费 (CNY) | 按渠道动态计算 |
| 商品成本 (CNY) | USD × cogsRate% × 汇率 |
| 物流运费 (CNY) | USD × shippingRate% × 汇率 |
| 广告成本 (CNY) | USD × marketingRate% × 汇率 |
| 净纯利润 (CNY) | 总额CNY − 手续 ¥ − 成本 ¥ − 物流 ¥ − 广告 ¥ |

---

## 🏗 架构亮点

- **双轨共存 (Dual-Track)**：Demo 沙盒与真实生产环境 100% 动态分流，所有子面板通过 `isDemo` 守卫 + Props 数据注入实现零混淆
- **GraphQL Markets**：全球可售卖市场从 Shopify 后台真实配置直接抓取，不依赖订单流
- **Intl 原生汉化**：`Intl.DisplayNames(["zh-CN"], { type: "region" })` 零代码膨胀覆盖全球 249 个国家和地区的中文名称
- **当前小时硬件锁**：3 层防护 (初始化 filter + 心跳 rebuild + sync effect)，未来数据永不泄漏
- **DeepSeek 真实 AI**：POST 路由安全托管 API Key，结合真实 Markets + GMV 生成个性化诊断
- **14 天高保真 Demo 数据流**：seed PRNG 确定性生成，本周 15% 增长，无缝切换

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
