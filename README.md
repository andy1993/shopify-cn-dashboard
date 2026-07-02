# 🚀 Shopify CN Pro

<div align="center">

**专为国内独立站卖家打造的全球化、多市场自适应智能座舱看板**

拒绝冷冰冰的死板数字。不仅帮你看账，更帮你在多店铺、全球多市场大促、网关扣费精细对账、风险防范中进行真实全链路的智能化操盘。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release v0.2.0.1-beta](https://img.shields.io/badge/Release-v0.2.0.1--beta-10b981)](https://github.com/andy1993/shopify-cn-dashboard/releases)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![Shopify 2026-04](https://img.shields.io/badge/Shopify_API-2026--04-96BF48)](https://shopify.dev/)
[![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38BDF8)](https://tailwindcss.com/)

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

## 🖥️ 平台级 SaaS 混合导航矩阵

```
┌────────────────────────────┐
│ 🚀 Shopify CN Pro           │
│ v0.2.0.1-beta · MIT 开源   │
├────────────────────────────┤
│                            │
│ 📊 核心实时看板  ← 顶级常驻  │
│ ────────────────────────── │
│                            │
│ 📦 数据纵深中心 [可折叠]     │
│   ├ 🌐 全店聚合大盘        │
│   ├ 📆 趋势同比分析         │
│   └ 🎯 漏斗转化复购         │
│                            │
│ 💰 财务与流量对账 [可折叠]   │
│   ├ 🟩 广告成效与 MER       │
│   ├ 💳 网关渠道对账          │
│   └ 💵 供应链对账            │
│                            │
│ 🛡️ 风控预警中心 [可折叠]    │
│   ├ 🧠 AI 智能诊断           │
│   └ 🚨 账户风控雷达          │
│                            │
├────────────────────────────┤
│ ⚙ 重新绑定店铺              │
└────────────────────────────┘
```

| 大类 | 面板 | 版本 | 核心能力 |
|---|---|---|---|
| 📊 顶级常驻 | 核心实时看板 | v1.0 | 30s 心跳爆单 · 硬件锁折线图 · GraphQL Markets · Intl 原生汉化 Select |
| 📦 数据纵深 | 全店聚合大盘 | v1.7 | Promise.all 多店真实 API · 堆叠 BarChart · 贡献率排行榜 |
| 📦 数据纵深 | 趋势同比分析 | v1.8 | 14 天双线对比 · 环比增长率 · 本周/上周切换 |
| 📦 数据纵深 | 漏斗转化复购 | v2.0 | 4 阶段横向漏斗 · 复购率分析 · 新老客营收饼图 |
| 💰 财务对账 | 广告成效与 MER | v2.1 | Meta/Google 实时消耗 · ROAS · MER% · 双轴复合图 |
| 💰 财务对账 | 网关渠道对账 | v1.95 | 多币种 GroupBy · 官方费率一键预设 · Stripe/PayPal 明细 |
| 💰 财务对账 | 供应链对账 | v1.3 | 采购/物流/广告滑块 · Donut 利润饼图 · GMV/毛利卡片 |
| 🛡️ 风控预警 | AI 智能诊断 | v1.25 | DeepSeek-v4-pro · 17 维指标打包 · 三段式实战报告 |
| 🛡️ 风控预警 | 账户风控雷达 | v1.4 | 退款率三色警报 · 呼吸灯动画 · 商品风控评级 Table |

---

## ✨ 五大硬核升级亮点

### 📊 当天实时核心看板 (OverviewPanel)

- **30s 心跳爆单流**：短轮询引擎每 30 秒触发，Demo 模式 50% 概率生成虚拟新订单，模拟真实站点的疯狂进单节奏
- **当前小时硬件锁**：24 小时折线图引入严格截断机制，未来时段数据强制 `null`，末端跟随心跳原地动态拔高，绝无未来数据泄漏
- **Shopify GraphQL Markets**：彻底淘汰靠订单猜国家的过时做法。后端直连 `query { markets { nodes { enabled regions { nodes { code } } } } }` 抓取卖家后台真实配置的激活售卖市场
- **Intl 原生汉化 Select**：`Intl.DisplayNames(["zh-CN"], { type: "region" })` + Unicode 国旗算法，零代码膨胀覆盖全球 249 个国家和地区的中文名称
- **多国节日倒计时**：Promise.all 并发 Nager.Date，搭配 Select 下拉不限数量国家，切换瞬间节日重算、钟表实时跳动

### 🧠 AI 跨境智囊诊断 (AiDiagnosePanel)

全面升级——将全站 **17 个核心维度**（今日总 GMV、转化率、采购/物流/广告成本滑块、Stripe/PayPal 手续费扣费总额、转化漏斗各层流失率、老客复购率%、风控退款率%）统一打包成一个大 JSON 上下文，后端真实调用 **DeepSeek-v4-pro 旗舰接口**。

System Prompt 注入骨灰级操盘手人格：精通 Shopify Markets 多市场运营、Stripe/PayPal 网关拒付对账、流量 MER 边际效益、供应链周转。禁止说"要优化网站"等业余空话。每条建议结尾标注预期 ROI 方向（↑/↓/→）。

Diagnosis 输出强制三段式结构：
- 📊 今日营收与流失大盘点
- 💳 网关与供应链暗坑诊断
- 🚀 今日高回报行动指南

### 💳 网关多币种傻瓜式对账 (GatewayFinancePanel)

针对小白极致优化：
- **官方标准费率一键填入**：Stripe 3.4% + $0.30 | PayPal 4.4% + $0.30，按钮即点即用
- **多币种双重 GroupBy**：彻底废弃一刀切的单美金换算，严格读取每笔订单的真实 `currency` 字段（USD/EUR/CAD/GBP）
- **2026 最新汇率字典**：🇺🇸 7.25 · 🇪🇺 7.85 · 🇨🇦 5.30 · 🇬🇧 9.15
- **Demo 心跳联动**：30s 间隔，40% 概率爆 EUR/Stripe 欧元单，明细表格新行 amber 高亮闪烁

### 🎯 转化漏斗与复购留存 (FunnelRetentionPanel)

- 独立站经典的横向营销流失漏斗图：`商品访客 → 加入购物车 → 发起结账 → 最终成交`，4 阶段渐变色 BarChart
- **分母为 0 边界安全保护**：`purchaseCount === 0 → return []`，所有比率公式含 `> 0` 三元守卫，杜绝 NaN% / Infinity% 白屏崩溃
- 加购到结账转化率 < 40% 时触发红色 AI 建议弹条
- 深度客户复购留存 (Cohort Analysis)：动态计算新老客营收贡献比 + 用户黏性健康度评级

### 💾 全维度财务报表一键扩展导出

- 纯前端一键导出包含 **11 列** 的综合经营对账单 CSV
- 涵盖：订单编号 · 下单时间（北京时间）· 目的国 · 支付网关 · 总额 USD/CNY · 网关手续费 CNY · 商品成本 · 物流运费 · 广告成本 · 净纯利润
- 带 `\uFEFF` BOM 头，Windows Excel 直接双击打开中文不乱码
- 文件名自动生成：`Shopify_全维度财务对账单_{店铺名}_20260702.csv`

---

## 🔒 隐私安全至上

```
┌──────────┐      ┌──────────────────┐      ┌────────────────┐
│ 浏览器     │ ───→ │ Next.js API Route │ ───→ │ Shopify API    │
│ (用户)    │ ←─── │ (后端安全代理)     │ ←─── │ (REST+GraphQL) │
└──────────┘      └──────────────────┘      └────────────────┘
     ↑                   ↑                         ↑
  Token 仅存于          免数据库                   永不经过
  LocalStorage          免登录                     任何第三方
```

- ✅ **免登录** · **无数据库** · **无服务器** · **100% 开源可审计**
- ✅ API Token 仅保存在浏览器 `LocalStorage` 中，不上传至任何第三方
- ✅ 所有 API 请求经 Next.js 后端路由直接代理转发至 Shopify 官方
- ✅ GraphQL Markets + REST Orders/Products — 双轨并行，按需取用
- ✅ DeepSeek API Key 仅在服务器端 `.env.local` 中存储，前端无感知

---

## 🎭 0 门槛沙盒体验

内置「✨ 一键导入演示数据」功能：

- 2 家高保真虚拟店铺 (**TechGear Pro** 科技配饰 · **MinimalHome** 极简家居)
- 跨越 **14 天** 的历史订单流，本周 vs 上周 ~15% 自然增长
- 30 秒心跳爆单引擎实时生效，40% 概率生成 EUR/Stripe 欧元虚拟订单
- Demo 模式下所有面板数据源自 seed PRNG 确定性引擎，切换店铺一键重置
- 无需 Shopify Token 即可 1 秒完整体验全部 9 个面板

---

## 📦 技术栈

| 层级 | 技术选型 |
|---|---|
| 全栈框架 | Next.js 16 (App Router + Turbopack) |
| UI 框架 | React 19 |
| 语言 | TypeScript (strict) |
| 样式方案 | Tailwind CSS 4 + shadcn/ui |
| 数据可视化 | Recharts (AreaChart · LineChart · PieChart · BarChart · Donut · ComposedChart) |
| 图标库 | Lucide React (18+ 图标) |
| Shopify API | Admin REST API 2026-04 + GraphQL Admin API |
| 全球节日 | Nager.Date (免费开源, 100+ 国家) |
| AI 大模型 | DeepSeek-v4-pro (deepseek-chat) |
| 国际化 | Intl.DisplayNames (原生 API, 零第三方依赖, 249 国家) |
| 数据持久化 | 浏览器 LocalStorage |

---

## 📁 项目架构

```
shopify-cn-dashboard/
├── app/
│   ├── page.tsx                         # 根路由 → 重定向 /config
│   ├── layout.tsx                       # 全局根布局 (暗黑主题)
│   ├── globals.css                      # 自定义动画 (gmv-flash, ai-pulse, fadeIn)
│   ├── config/
│   │   └── page.tsx                     # 店铺配置页 (含一键导入演示入口)
│   ├── dashboard/
│   │   ├── layout.tsx                   # SaaS 混合导航矩阵 (顶级常驻 + 3 大类手风琴)
│   │   ├── page.tsx                     # 状态中心 + 9 面板条件渲染分发
│   │   ├── config.ts                    # 全局常量 (汇率/费率/阈值/14天)
│   │   ├── helpers.ts                   # 共享工具函数 (formatCny, findNearestHoliday, getCountdown)
│   │   └── components/
│   │       ├── OverviewPanel.tsx         # 核心实时看板 (心跳/GraphQL/Intl/节日)
│   │       ├── AiDiagnosePanel.tsx       # AI 诊断 (17维→DeepSeek-v4-pro)
│   │       ├── FinancePanel.tsx          # 供应链对账 (成本滑块/利润饼图)
│   │       ├── RiskRadarPanel.tsx        # 账户风控雷达 (退款率三色警报)
│   │       ├── TrendAnalysisPanel.tsx    # 趋势同比 (14天双线对比)
│   │       ├── MultiStoreAggregator.tsx  # 全店聚合 (Promise.all多店API)
│   │       ├── GatewayFinancePanel.tsx   # 网关对账 (多币种/一键预设)
│   │       ├── FunnelRetentionPanel.tsx  # 漏斗转化复购 (Cohort Analysis)
│   │       └── AdPerformancePanel.tsx    # 广告成效与MER (双轴复合图)
│   └── api/
│       └── shopify/
│           └── dashboard/
│               └── route.ts             # 后端代理 (GET: REST+GraphQL+Nager) (POST: DeepSeek AI)
├── components/
│   └── ui/                              # shadcn/ui 组件库
├── lib/
│   ├── utils.ts                         # cn() 工具函数
│   └── demo-data.ts                     # 演示数据引擎 (seed PRNG 14天)
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
git clone https://github.com/andy1993/shopify-cn-dashboard.git
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

打开 [http://localhost:3000/config](http://localhost:3000/config)。

### 5. 选择体验方式

| 方式 | 操作 |
|---|---|
| 🎭 **演示模式** | 点击「✨ 一键导入演示数据」，1 秒体验完整 9 面板大屏 |
| 🔗 **真实店铺** | 输入 `your-store.myshopify.com` + Admin API Token |

> Token 需要 `read_orders`、`read_products`、`read_markets` 三个权限。真实模式下系统 100% 读取 Shopify 2026-04 Stable API + GraphQL Markets API，绝不混入任何模拟逻辑。

### 6. 生产构建

```bash
npm run build
npm start
```

---

## 🏗 架构亮点

- **双轨共存 (Dual-Track)**：Demo 沙盒与真实生产环境 100% 动态分流，所有 9 个面板通过 `isDemo` 守卫 + Props 数据注入实现零混淆
- **GraphQL Markets**：全球可售卖市场从 Shopify 后台真实配置直接抓取，不依赖订单流
- **Intl 原生汉化**：`Intl.DisplayNames(["zh-CN"], { type: "region" })` 零代码膨胀覆盖全球 249 个国家和地区的中文名称
- **多币种双重 GroupBy**：网关对账按 `gateway x currency` 聚合，USD/EUR/CAD/GBP 独立计费、独立汇率
- **DeepSeek-v4-pro 17 维诊断**：全站核心指标打包为一个 JSON，后端注入骨灰级操盘手 System Prompt
- **当前小时硬件锁**：3 层防护（初始化 filter + 心跳 rebuild + sync effect），未来数据永不泄漏
- **14 天高保真 Demo 数据流**：seed PRNG 确定性生成，本周 15% 增长，包含 EUR/Stripe 心跳爆单
- **SaaS 混合导航矩阵**：顶级常驻 + 3 大手风琴分类，ChevronDown 旋转动画，激活状态绿点高亮

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
