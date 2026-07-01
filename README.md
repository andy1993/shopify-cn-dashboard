# 🚀 Shopify CN Pro

<div align="center">

**专为国内独立站卖家打造的全球化、多市场自适应数据大屏看板**

拒绝冷冰冰的数字，不仅帮你看账，更帮你用全球视野守城与操盘。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![Shopify API](https://img.shields.io/badge/Shopify_API-2026--04-96BF48)](https://shopify.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8)](https://tailwindcss.com/)

</div>

---

## 🎯 项目简介

**Shopify CN Pro** 是一款面向跨境电商独立站卖家的开源全栈数据看板。基于 2026 年最新技术栈和 Shopify `2026-04` Stable API 构建，100% 暗黑系高级 SaaS UI 设计，专为中国卖家的业务直觉、对账习惯和全球化运营需求深度定制。

> 适用于：Shopify 独立站操盘手、多店铺卖家、跨境电商运营团队、零成本体验 Shopify 数据分析的开发者。

---

## ✨ 六大核心硬核特性

### 🖥️ 现代化全宽大屏与常驻侧边栏

对标商业级高级 SaaS UI 质感。100% 宽屏平铺，左侧常驻 `w-64` 侧边导航栏，右侧全宽自适应内容区。彻底告别旧版窄屏鼠标滚动的臃肿体验——图表、卡片、表格在宽屏下一行完美并排。

```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │  全宽内容区                                │
│          │  ┌─────────┬─────────┬─────────┬───────┐ │
│ 📊 看板  │  │ GMV     │ 订单数   │ 纯利润   │ 毛利率 │ │
│ 🧠 AI   │  └─────────┴─────────┴─────────┴───────┘ │
│ 💰 对账  │  ┌──────────────────┬──────────────────┐ │
│ 🛡️ 风控  │  │ 24h 走势 (2 cols) │ 利润饼图 (1 col) │ │
│          │  └──────────────────┴──────────────────┘ │
│ ⚙ 重绑   │  ┌──────────────────────────────────────┐ │
│          │  │ 热销商品 Top 5                        │ │
│          │  └──────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

### ⚡ 极速多店铺中心

一套配置，无缝秒级管理和切换多家独立站站点资产。Shopify 域名 + Admin API Token 即配即用。通过 `shadcn/ui Select` 组件实现店铺下拉切换，数据即时刷新，零等待。

### 📊 中国看账习惯

- 实时汇率（可配置 `USD_CNY_RATE` 环境变量）将美金 GMV 一键折算为人民币展示
- `Intl.NumberFormat('zh-CN')` 千分位逗号分隔，`￥12,345.67` 格式
- 今日 GMV / 订单数 / 预计纯利润 / 毛利率 四维 KPI 卡片

### 🌍 全域多市场节日感知

- 自动提取订单 `shipping_address.country_code`，统计 Top 3 消费目的国
- 接入免费开源 [Nager.Date](https://date.nager.at) 全球节日 API
- 前端 `Tabs` 组件展示多国商机倒计时（🇺🇸 Labor Day · 🇬🇧 Bank Holiday · 🇩🇪 Tag der Deutschen Einheit）
- 实时天/时/分/秒跳动，秒级刷新

### 💰 供应链 / 物流利润漏斗

- 内置成本滑块配置器：采购成本% · 物流运费% · 广告成本%
- 实时联动计算今日纯利润（CNY），盈利绿色 ↑ / 亏损红色 ↓
- Recharts `PieChart` 四色环形饼图：🔴 采购成本 · 🟡 物流运费 · 🔵 广告投放 · 🟢 纯利润

### 🛡️ 退款账户风控雷达

- 遍历订单 `financial_status`，实时计算退款率
- 三段色标警报条：
  - 🟢 `< 1%` → 「健康度优秀」
  - 🟡 `1%–1.5%` → 「接近 Stripe/PayPal 风险红线」
  - 🔴 `> 1.5%` → 「极高风险！暂停广告 / 自查刷单」（呼吸灯动画）
- 热销商品表新增「风控评级」列：低风险 / 需关注 / 高危欺诈

### 🔒 0 门槛开源沙盒

内置「✨ 一键导入演示数据」功能：

- 2 家高保真虚拟店铺（TechGear Pro 科技配饰 · MinimalHome 极简家居）
- 24 小时真实分布订单 · Unsplash 精美商品图 · 完整数据联动
- 无需 Shopify Token 即可 1 秒完整体验全部功能

---

## 🧠 AI 跨境操盘手智能诊断

点击看板右上角暗金 `AI 智能诊断` 按钮，右侧滑出诊断面板：

- **Demo 模式**：高保真预设报告——转化率分析、补货预警、3 条保姆级行动建议
- **真实店铺**：基于当前 GMV / 订单数 / 商品数据动态生成诊断
- **DeepSeek API 接入骨架**：配置文件 `DEEPSEEK_API_KEY` 即可激活实时 AI 诊断

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

## 📦 技术栈

| 层级 | 技术选型 |
|---|---|
| 全栈框架 | Next.js 16 (App Router + Turbopack) |
| UI 框架 | React 19 |
| 语言 | TypeScript (strict) |
| 样式方案 | Tailwind CSS 4 + shadcn/ui (@base-ui/react) |
| 数据可视化 | Recharts |
| 图标库 | Lucide React |
| Shopify API | Admin REST API `2026-04` |
| 全球节日 | Nager.Date (免费开源) |
| 数据持久化 | 浏览器 LocalStorage |

---

## 📁 项目架构

```
shopify-cn-dashboard/
├── app/
│   ├── page.tsx                          # 根路由 → 重定向 /config
│   ├── layout.tsx                        # 全局根布局
│   ├── globals.css                       # 暗黑主题 + 自定义动画
│   ├── config/
│   │   └── page.tsx                      # 店铺配置页（含演示入口）
│   ├── dashboard/
│   │   ├── layout.tsx                    # 宽屏侧边栏布局
│   │   └── page.tsx                      # 主看板页（全功能）
│   └── api/
│       └── shopify/
│           └── dashboard/
│               └── route.ts              # Shopify 后端代理 + 节日聚合
├── components/
│   └── ui/                               # shadcn/ui 组件库
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── sheet.tsx
│       ├── table.tsx
│       └── tabs.tsx
├── lib/
│   ├── utils.ts                          # cn() 工具函数
│   └── demo-data.ts                      # 演示数据引擎
├── .env.example                          # 环境变量模板
├── .gitignore
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

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`（可选）：

```bash
# 美元兑人民币汇率（默认 7.25）
USD_CNY_RATE=7.25

# DeepSeek API Key（可选，用于激活 AI 实时诊断）
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
| 🎭 **演示模式** | 点击「✨ 一键导入演示数据试用」，1 秒体验完整大屏 |
| 🔗 **真实店铺** | 输入 `your-store.myshopify.com` + Admin API Token |

### 6. 生产构建

```bash
npm run build
npm start
```

---

## 📊 CSV 一键导出

点击「导出报表」按钮，下载 `Shopify_今日财务报表_{店铺名}_2026-07-02.csv`：

| 列 | 内容 | 示例 |
|---|---|---|
| 订单ID | Shopify Order ID | `10042` |
| 下单时间（北京时间） | UTC+8 转换 | `2026-07-02 14:30` |
| 美元金额 (USD) | 原始金额 | `89.99` |
| 人民币金额 (CNY) | USD × 汇率 | `652.43` |
| 付款状态 | 中文映射 (已支付/待处理/已退款) | `已支付` |

> 文件带 BOM 头，Excel 直接打开中文不乱码。

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
