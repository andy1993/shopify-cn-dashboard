# 👑 Shopify CN Pro (v0.2.3.0)

<div align="center">

**专为国内独立站卖家定制的全球化、多市场自适应高级暗黑系全宽数据智能座舱**

拒绝死板的冷冰冰数字。不仅帮你看账，更帮你跨店改价、全球多市场大促、网关扣费精细对账、库存反写控制、双层风控防御，一切尽在掌握。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release v0.2.3.0](https://img.shields.io/badge/Release-v0.2.3.0-10b981)](https://github.com/andy1993/shopify-cn-dashboard/releases)
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

## 📦 平台级 SaaS 混合导航矩阵

```
┌───────────────────────────────┐
│ 🚀 Shopify CN Pro  v0.2.4.0   │
│ 全球多市场自适应智能座舱       │
├───────────────────────────────┤
│                               │
│ 📊 顶级常驻                    │
│   ├ 核心实时看板               │
│ ─────────────────────────────  │
│                               │
│ 📊 数据中心 [可折叠]            │
│   ├ 🌐 全店聚合大盘            │
│   ├ 📆 趋势同比分析            │
│   └ 🎯 漏斗转化复购            │
│                               │
│ 🏪 订单与客户 [可折叠]          │
│   ├ 📋 订单管理中心             │
│   ├ 👥 客户管理中心             │
│   └ 🚚 履约看板                 │
│                               │
│ 📦 商品与内容 [可折叠]          │
│   ├ 🔧 跨店改价控制            │
│   ├ 📝 批量编辑面板             │
│   ├ 📁 集合管理                 │
│   ├ 🧭 导航菜单编辑             │
│   ├ 📄 页面与博客               │
│   └ 🗄️ Metafields 编辑器        │
│                               │
│ 💰 财务对账 [可折叠]            │
│   ├ 🟩 广告成效与 MER          │
│   ├ 💳 网关渠道对账            │
│   └ 💵 供应链对账              │
│                               │
│ 🛡️ 风控预警 [可折叠]          │
│   ├ 🧠 AI 智能诊断              │
│   └ 🚨 账户风控雷达             │
│                               │
├───────────────────────────────┤
│ ⚙ 重新绑定店铺                 │
└───────────────────────────────┘
```

| 分类 | 面板 | 核心能力 |
|---|---|---|
| 📊 顶级常驻 | 核心实时看板 | 30s 心跳爆单 · 硬件锁折线图 · GraphQL Markets · Intl 原生汉化 Select · 多国节日倒计时 |
| 📊 数据中心 | 全店聚合大盘 | Promise.all 多店真实 API · 堆叠 BarChart · 贡献率排行榜 · 单店直读降级 |
| 📊 数据中心 | 趋势同比分析 | 14 天双线对比 · 环比增长率 · 本周/上周切换 |
| 📊 数据中心 | 漏斗转化复购 | 4 阶段横向漏斗 · 复购率分析 · 新老客营收饼图 · 分母零保护 |
| 🏪 订单与客户 | 订单管理中心 | 多条件筛选 · 批量操作 · 订单详情抽屉 · 标签/备注 · CSV 导出 |
| 🏪 订单与客户 | 客户管理中心 | RFM 筛选 · 客户详情 Sheet · 地址簿 · 订单历史联动 · 分群 CSV 导出 |
| 🏪 订单与客户 | 履约看板 | 三泳道拖拽履约 · 物流单号确认 · 超时预警红色边框 · 履约统计 KPI |
| 📦 商品与内容 | 跨店改价控制 | 多店多规格商品库 · Accordion 子母表 · 4 Tab 编辑器 · 图片管理 · SEO · 双轨隔离 |
| 📦 商品与内容 | 批量编辑面板 | 分割面板批量操作 · 标题/描述/SEO/标签四模板 · 预览确认 · 增量进度条 |
| 📦 商品与内容 | 集合管理 | 智能条件编辑器 · AND/OR 切换 · 手动商品挑选器 · SEO 预览 · 双轨数据 |
| 📦 商品与内容 | 导航菜单编辑 | 树形层级编辑 · 拖拽排序 · 链接类型选择器 · 变更摘要 · 批量保存 |
| 📦 商品与内容 | 页面与博客 | Pages + Blog Posts 双 Tab · 预览/编辑双模式 · SEO 预览卡片 · 内联 CRUD |
| 📦 商品与内容 | Metafields 编辑器 | 11 种类型动态输入 · JSON 校验 · CSV 导入导出 · 按需 API 拉取 |
| 💰 财务对账 | 广告成效与 MER | Meta/Google 实时消耗 · ROAS · MER% · 双轴 ComposedChart |
| 💰 财务对账 | 网关渠道对账 | 多币种 gateway x currency 双重 GroupBy · 一键费率预设 · Donut + 明细 Table |
| 💰 财务对账 | 供应链对账 | 采购/物流/广告三滑块 · Donut 利润饼图 · GMV 与毛利实时计算 |
| 🛡️ 风控预警 | AI 智能诊断 | 全站 17 维指标打包 · DeepSeek-v4-pro 对接 · 三段式操盘手实战报告 |
| 🛡️ 风控预警 | 账户风控雷达 | 退款率三色警报 · 呼吸灯动画 · 商品风控评级 Table |

---

## 🚀 当前稳定版本核心特性：v0.2.4.0 (商品内容与店铺装修管理)

在 `v0.2.3.0` 订单与客户管理的基础上，本版补齐了 Shopify 原生后台的商品内容编辑和店铺装修能力，
让卖家在一个界面内完成商品全字段编辑、批量操作、集合管理、导航菜单、页面博客、元字段配置。

### 1. 商品编辑器全面升级 (ProductControlPanel)

- **详情编辑弹窗 4 Tab**：基本信息 / 图片管理 / SEO 元数据 / 变体编辑
- 补齐 `descriptionHtml` 字段同步（修复 `bodyHtml` 命名不匹配 bug）
- **图片管理 Tab**：真实渲染缩略图 + alt 文本编辑 + 拖拽排序
- **描述预览/编辑双模式切换**：富文本渲染 + HTML 源码编辑
- 供应商、品类、标签、SEO 标题/描述、URL 句柄全字段编辑

### 2. 批量商品编辑引擎 (BulkEditPanel)

- **左侧商品选择 + 右侧 4 Tab 操作区**：标题模板 / 描述替换 / SEO 批量 / 标签批量
- 标题模板支持追加前缀/后缀、查找替换、完全替换
- **实时预览修改前后对比**
- 提交前变更摘要 + 进度条 + 失败详情汇总
- **变量插入**：`{title}` `{price}` `{type}` 占位符

### 3. 集合管理面板 (CollectionManagerPanel)

- **双 Tab**：智能集合（条件规则编辑器 AND/OR）+ 手动集合（商品挑选器拖拽排序）
- **条件规则可视化**：字段下拉 × 比较符 × 值，动态增删行
- SEO 编辑 + Google 搜索结果预览卡片

### 4. 导航菜单编辑器 (NavigationEditorPanel)

- **树形菜单项编辑器**，支持三级嵌套
- HTML5 Drag & Drop 拖拽排序/升降级
- **添加菜单项弹窗**：链接类型选择器（首页/商品/集合/页面/博客/自定义）
- 批量提交 diff 变更摘要

### 5. 页面与博客管理 (ContentPagesPanel)

- **双 Tab**：页面 Pages / 博客文章 Blog Posts
- 博客选择器 + 文章列表 + 内联编辑
- 内容预览/编辑双模式 + SEO 预览卡片
- 修复 blog 数据 API 对接（GraphQL→REST 降级 + selectedBlogId 匹配）

### 6. Metafields 编辑器 (MetafieldsEditorPanel)

- 商品/变体/集合三类型切换
- **11 种类型动态输入控件**：文本/数字/布尔/JSON/颜色/URL/日期等
- JSON 格式校验 + 批量 CSV 导入导出
- 修复类型切换后数据丢失 bug（Record 多键状态保持）

### 7. 侧边栏分类重构

- 从 3 个臃肿大类重组为 **5 个按工作流划分的分类**：
  📊 数据中心 → 🏪 订单与客户 → 📦 商品与内容 → 💰 财务对账 → 🛡️ 风控预警

---

### v0.2.2.1 风控防御网合拢（历史）

### v0.2.2.0 真实商品改价底层重构

已打通多店铺、真实商品库的控制台无缝反向操控。系统深度重构，彻底剥离原本挂在交易订单（Orders）下的临时改价，升级为反向通过 API 实时、安全地改写后台真实商品数据。

### 1. 接口架构重构与生产环境填坑（100% 对齐 2026-04 官方最新规范）

- **变体精细化改价**：淘汰已在历史版本中被 Shopify 彻底移除的 `productVariantUpdate` 老旧突变。全面对齐官方高版本 GraphQL 规范，改用统一的批量变体更新突变 `productVariantsBulkUpdate`，完美支持多规格 SKU 级联多币种改价。

- **绝对值库存覆盖（降维绕过乐观锁）**：针对高版本 GraphQL 库存突变频繁更名且强行索要 `changeFromQuantity`（旧库存乐观锁校验）的痛点，库存修改全线降维改走最稳健的原生 REST Admin API 代理路由：`POST /admin/api/2026-04/inventory_levels/set.json`。前端无需进行繁琐的 delta（差值）计算，直接 HTTP POST 一键发送目标库存绝对值，粗暴覆盖、秒级同步。

- **双轨控制网关（Sandbox / Live 隔离）**：引入严格的运行轨道状态判断。在 Sandbox / Demo 轨下，点击触发前端沙盒 Mock 爆单减库存的演示联动；在真实生产轨下，自动绕过本地诊断和风控，干净利落地直连 Shopify 官方后台。改价走 `productVariantsBulkUpdate`，改库存走 REST `inventory_levels/set.json`。

- **双轨路由精准分流**：POST `/api/shopify/dashboard` 增加 `action` 字段路由 —— `action: "updateProductVariant"` 直接跳入 Shopify 专线写操作处理器，彻底杜绝与 AI 诊断模块的 metrics 校验逻辑冲突。

### 2. 前端交互漏洞修复与多边界场景自适应

- **多规格 / 单规格行级交互合并**：彻底修复原前端组件由于卡死 `variants.length > 1` 的折叠子母表判断，导致单规格商品（即仅包含一个默认 Default Title 变体的商品）完全无法展开、直接被吞掉修改入口的严重 bug。

- **动态行级暴露逻辑**：重构 ProductControlTable 渲染树。多规格商品保持原样，支持子母表手风琴级联折叠（Accordion Row），独立修改每一个 SKU；单规格商品在商品主行（Main Row）对应的价格和库存列，直接原地暴露出输入框与保存按钮，底层自动绑定 `variants[0]` 的数据，赋予单规格商品极致流畅的原生修改体验。

### 3. 真实商品库全链路数据下游

- **Shopify GraphQL products 节点全量拉取**：`query { products(first: 50) { nodes { id title status images variants { nodes { id title sku price inventoryQuantity product { id } inventoryItem { id } } } } } }`，注入 `shopName`、`productId`、`inventoryItemId`、`locationId`，经路由层 double-track 分流直达前端控制台。

- **骨架屏加载态**：真实店铺首次进入控制台时，通过脉冲动画骨架屏优雅传递 GraphQL 数据拉取进度，杜绝白屏。

---

## ✨ 核心功能亮点

### 📊 实时核心看板

- **30s 心跳爆单流**：短轮询引擎每 30 秒触发，Demo 模式下 50% 概率生成虚拟新订单，模拟真实站点疯狂进单节奏
- **当前小时硬件锁**：24 小时折线图严格截断未来时段，末端跟随心跳原地动态拔高，绝无未来数据泄漏
- **Shopify GraphQL Markets**：后端直连 `query { markets { nodes { enabled regions { nodes { code } } } } }` 抓取卖家后台真实激活的售卖市场
- **Intl 原生汉化 Select**：`Intl.DisplayNames(["zh-CN"], { type: "region" })` + Unicode 国旗算法，零代码膨胀覆盖全球 249 个国家中文名称
- **多国节日倒计时**：Promise.all 并发 Nager.Date，搭配 Select 下拉不限数量国家，切换瞬间秒级重算

### 🧠 AI 智能诊断 (DeepSeek-v4-pro)

- 全站 17 个核心维度（GMV · 转化漏斗 · 网关扣费 · 成本结构 · 风控退款 · 复购留存）统一打包为 JSON 上下文
- System Prompt 注入骨灰级操盘手人格：精通 Markets 多市场运营、Stripe/PayPal 网关对账、MER 边际效益、供应链周转
- 禁止空话，每条建议标注 ROI 方向 (↑/↓/→)
- 无密钥自动优雅降级，Demo 模式本地高保真预设

### 💳 网关多币种对账

- **多币种 gateway × currency 双重 GroupBy**：USD 7.25 · EUR 7.85 · CAD 5.30 · GBP 9.15
- **官方费率一键预设**：Stripe 3.4% + $0.30 / PayPal 4.4% + $0.30
- Demo 心跳 EUR 爆单：30s 间隔 40% 概率生成 EUR + Stripe 订单，明细 Table 该行 amber 高亮闪烁

### 🔧 跨店改价控制

- 多规格商品 Accordion 子母表折叠独立修改每一个 SKU
- 单规格商品主行直接暴露出价格/库存输入框与同步按钮
- 全局一键同步全部变体 + 重置按钮
- 降价绿色高亮 / 涨价琥珀高亮 / 库存不足红色预警

---

## 🔒 隐私安全

```
浏览器 (Token 仅存于 LocalStorage)
  └─→ Next.js API Route (后端安全代理 · 免登录 · 无数据库)
       ├─→ Shopify REST API 2026-04
       │   └─ inventory_levels/set.json (库存绝对覆盖)
       ├─→ Shopify GraphQL API 2026-04
       │   ├─ products query (商品/变体/库存项)
       │   ├─ markets query (激活售卖市场)
       │   └─ productVariantsBulkUpdate (变体改价)
       └─→ DeepSeek API (AI 诊断 · Key 仅存于服务端 .env.local)
```

- ✅ 免登录 · 无数据库 · 无服务器 · 100% 开源可审计
- ✅ API Token 仅保存在浏览器 LocalStorage，不上传至任何第三方
- ✅ DeepSeek API Key 仅在服务器端 `.env.local` 存储，前端零暴露

---

## 🎭 0 门槛沙盒体验

内置「✨ 一键导入演示数据」功能：

- 2 家高保真虚拟店铺 (TechGear Pro 科技配饰 · MinimalHome 极简家居)
- 跨越 14 天历史订单流 + 50+ 模拟客户 + 8 款多规格演示商品 · 18 个变体
- 30 秒心跳爆单引擎，40% 概率生成 EUR/Stripe 虚拟订单
- 无需 Shopify Token 即可 1 秒完整体验全部 18 个面板

---

## 📦 技术栈

| 层级 | 技术选型 |
|---|---|
| 全栈框架 | Next.js 16 (App Router + Turbopack) |
| UI 框架 | React 19 + TypeScript (strict) |
| 样式方案 | Tailwind CSS 4 + shadcn/ui |
| 数据可视化 | Recharts (BarChart · LineChart · PieChart · Donut · ComposedChart · AreaChart) |
| 图标库 | Lucide React |
| Shopify REST | Admin API 2026-04 (orders · products · inventory_levels) |
| Shopify GraphQL | Admin API 2026-04 (products · markets · productVariantsBulkUpdate) |
| 全球节日 | Nager.Date (免费开源) |
| AI 大模型 | DeepSeek-v4-pro (deepseek-chat) |
| 国际化 | Intl.DisplayNames (原生 API, 零依赖) |
| 数据持久化 | 浏览器 LocalStorage |

---

## 📁 项目架构

```
shopify-cn-dashboard/
├── app/
│   ├── page.tsx                         # 根路由 → 重定向 /config
│   ├── layout.tsx                       # 全局根布局 (暗黑主题)
│   ├── globals.css                      # 自定义动画 (gmv-flash, ai-pulse)
│   ├── config/
│   │   └── page.tsx                     # 店铺配置页 (含一键导入演示)
│   ├── dashboard/
│   │   ├── layout.tsx                   # SaaS 混合导航矩阵
│   │   ├── page.tsx                     # 状态中心 + 18 面板条件渲染
│   │   ├── config.ts                    # 全局常量
│   │   ├── helpers.ts                   # 工具函数
│   │   └── components/
│   │       ├── OverviewPanel.tsx         # 核心实时看板
│   │       ├── AiDiagnosePanel.tsx       # AI 智能诊断 (17维→DeepSeek)
│   │       ├── FinancePanel.tsx          # 供应链对账
│   │       ├── RiskRadarPanel.tsx        # 账户风控雷达
│   │       ├── TrendAnalysisPanel.tsx    # 趋势同比
│   │       ├── MultiStoreAggregator.tsx  # 全店聚合
│   │       ├── GatewayFinancePanel.tsx   # 网关多币种对账
│   │       ├── FunnelRetentionPanel.tsx  # 漏斗转化复购
│   │       ├── AdPerformancePanel.tsx    # 广告成效
│   │       ├── ProductControlPanel.tsx   # 跨店改价控制
│   │       ├── BulkEditPanel.tsx          # 批量商品编辑引擎 [2.4]
│   │       ├── CollectionManagerPanel.tsx # 集合管理 [2.4]
│   │       ├── NavigationEditorPanel.tsx  # 导航菜单编辑器 [2.4]
│   │       ├── ContentPagesPanel.tsx      # 页面与博客管理 [2.4]
│   │       ├── MetafieldsEditorPanel.tsx  # 元字段编辑器 [2.4]
│   │       ├── OrderCenterPanel.tsx      # 订单管理中心 [2.3]
│   │       ├── OrderTags.tsx             # 订单标签/备注 [2.3]
│   │       ├── CustomerCenterPanel.tsx   # 客户管理 [2.3]
│   │       └── FulfillmentBoardPanel.tsx # 履约看板 [2.3]
│   └── api/
│       └── shopify/
│           └── dashboard/
│               └── route.ts             # 后端双轨代理 (GET/POST)
├── components/ui/                       # shadcn/ui
├── lib/
│   ├── utils.ts
│   ├── demo-data.ts                     # 演示数据引擎
│   └── export-utils.ts                  # 通用 CSV 导出工具 [2.3]
└── README.md
```

---

## 🚀 快速开始

### 前置条件

- Node.js >= 18
- npm >= 9

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

### 4. 启动

```bash
npm run dev
```

打开 [http://localhost:3000/config](http://localhost:3000/config)。

### 5. 选择体验方式

| 方式 | 操作 |
|---|---|
| 🎭 演示模式 | 点击「✨ 一键导入演示数据」，1 秒体验完整大屏 |
| 🔗 真实店铺 | 输入 `your-store.myshopify.com` + Admin API Token |

> Token 需 `read_orders`、`read_products`、`write_products`、`read_customers`、`write_orders` 权限。如需使用博客/页面/集合/导航管理，额外需要 `read_content`、`write_content` 权限。真实模式下系统 100% 读取 Shopify 2026-04 Stable API + GraphQL，绝不混入模拟逻辑。

### 6. 生产构建

```bash
npm run build && npm start
```

---

## 🧾 CSV 一键导出

订单、客户双维度支持一键导出。点击「导出报表」按钮，下载 `Shopify_{类型}_{店铺名}_{日期}.csv`，带 UTF-8 BOM 头，Excel / WPS 直接双击打开中文不乱码。

**订单导出**：11 列——订单编号 · 下单时间 (北京时间) · 目的国 · 支付网关 · 总额 USD · 总额 CNY · 网关手续费 CNY · 商品成本 CNY · 物流运费 CNY · 广告成本 CNY · 净纯利润 CNY

**客户导出**：12 列——姓名 · 邮箱 · 手机号 · 国家 · 总消费金额(￥) · 订单数 · 平均客单价(￥) · 最近购买时间 · 标签 · 营销订阅 · 注册日期 · 默认地址

底层统一由 `lib/export-utils.ts` 驱动，Demo 模式导出末尾自动追加水印标识。

---

## 🏗 架构亮点

- **双轨共存 (Dual-Track)**：Demo 沙盒与真实生产环境 100% 动态分流，18 个面板通过 `isDemo` 守卫 + Props 数据注入实现零混淆
- **GraphQL + REST 双协议**：读走 GraphQL (products/markets/blogs/pages/collections)，改价走 GraphQL (productVariantsBulkUpdate)，改库存/履约/导航/metaobjects 走 REST，各取所长
- **全字段商品编辑器**：4 Tab 详情编辑弹窗，描述预览/源码双模式，图片缩略图+拖拽排序，SEO 元数据全字段
- **批量编辑引擎**：标题/描述/SEO/标签四模板批量操作，实时预览+变更摘要+进度条
- **Intl 原生汉化**：`Intl.DisplayNames(["zh-CN"], { type: "region" })` 零代码膨胀覆盖 249 个国家和地区
- **多币种双重 GroupBy**：网关对账按 gateway x currency 聚合，USD/EUR/CAD/GBP 独立计费汇率
- **DeepSeek-v4-pro 17 维诊断**：全站核心指标打包 JSON → 骨灰级操盘手 System Prompt → 三段式实战报告
- **当前小时硬件锁**：3 层防护 (init filter + heartbeat rebuild + sync effect)，未来数据永不泄漏

---

## 📄 开源协议

MIT License · 自由用于个人与商业用途。

---

<div align="center">

Made with 💚 for Shopify sellers worldwide.

</div>
