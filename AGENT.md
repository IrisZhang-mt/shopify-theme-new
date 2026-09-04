# moodytiger Theme（new / 重建版）Agent 指南

## 一、仓库定位

这个目录是为 moodytiger 从零重建的 Shopify Online Store 2.0 主题
（`config/settings_schema.json` → `theme_version: 0.1.0`，文档地址
`git.w3r.dev/dev/moodytiger`）。

它目前刻意精简——这是一次干净的重建，不是线上店铺。线上/旧版主题在
同级目录 `d:\work\old`（体量大、命名不统一、按活动复制模板），可以
作为迁移已验证 UX 的参考，但它的体量和杂乱正是这次重建要避免的。

在这个仓库中工作的 agent，应优先遵循以下原则：

- 改动尽量小、易审查、易回滚
- 新增内容前先确认命名和结构与现有约定一致
- 不要把 `old` 里已经证明有问题的模式（按活动复制模板、随意前缀
  命名）带进这里
- 保护品牌语气一致性（见第十节）

## 二、项目结构模型

这不是 monorepo，是单一主题的标准 Shopify 目录结构：

- `layout/` —— 页面外壳（`theme.liquid`、`password.liquid`）
- `sections/` —— 页面模块，按功能前缀分组
- `snippets/` —— 可复用的局部模板
- `templates/` —— 每种页面类型的 JSON 模板（每种类型只有一份，没有
  按活动复制的变体）
- `config/` —— 主题设置定义与商家配置数据
- `locales/` —— 目前只有 `en.default.json`
- `assets/` —— CSS、JS、字体等静态资源，与 section/snippet 一一对应

当前状态（体量参考）：

- 37 个 section、11 个 snippet
- 只有 1 个语言文件（`en.default.json`），暂无多语言
- `config/settings_schema.json` 目前只有 Theme Info、Logo、Product
  尺码表链接三组设置，预计会持续增加

## 三、最核心的工作原则

在动手修改前，先判断这个改动应该落在哪一层：

- **改通用 section/snippet**：适用于所有页面都应生效的能力
- **新增 section**：仅在确认没有可复用的现有 section 时才新建，并
  遵循第五节的命名对称约定
- **不要为营销活动新建专属模板**：优先用带可配置 block/设置（或
  metafield）的通用 section 承载活动内容，而不是复制一份模板

## 四、项目概览

- 平台：Shopify Theme（Online Store 2.0）
- 技术栈：Liquid、JSON templates、CSS、JavaScript
- 根目录没有 `package.json`、构建工具，也没有 Shopify CLI 配置文件
  （`shopify.theme.toml`）——这是一个纯粹的主题文件目录
- 假定 `shopify theme dev` / `shopify theme push` 是在这个目录下
  针对某个已配置的店铺运行的；如果用户的 Shopify CLI 配置了
  theme-check，那就是这里应使用的 linter

## 五、目录说明与命名约定

- `layout/theme.liquid`（页面骨架：meta/OG 标签、字体预加载、
  `{{ content_for_header }}` / `{{ content_for_layout }}`）、
  `layout/password.liquid`
- `templates/`：Online Store 2.0 JSON 模板（`index.json`、
  `product.json`、`collection.json` 等），外加少数遗留 `.liquid`
  模板（`404.liquid`、`gift_card.liquid`）
- `sections/`：37 个，kebab-case 命名，按功能前缀分组：`about-*`
  （关于页）、`home-*`（首页模块）、`main-*`（每个模板对应的页面
  入口 section）、`product-*` 相关（PDP 模块）、`cart-*`。
  `header.liquid` / `footer.liquid` 由 `header-group.json` /
  `footer-group.json` 这两个 section group 驱动（OS 2.0 模式）
- `snippets/`：11 个小型、单一职责的局部模板（`product-card.liquid`、
  `quick-shop-modal.liquid`、`structured-data.liquid` 等）
- `assets/`：每个 section/功能对应一组 CSS + JS 文件，命名与
  section/snippet 的 handle 保持一致（例如 `home-hero.liquid` ↔
  `home-hero.css` + `home-hero.js`；`cart-drawer.liquid` ↔
  `cart.css`/`cart.js`）。字体为自托管 woff2（`fk-display-regular`、
  `fk-grotesk-regular`、`geist-mono-regular`）

**命名对称是这个仓库最重要的约定**：新增 section → 对应的
kebab-case 资源文件对。不要把不相关的样式/脚本塞进同一个共享文件；
这种一一对应的关系是主题保持清晰可读的关键，也正是 `old` 随时间
流失掉的东西。

## 六、高风险区域

体量还小，高风险区域相对有限，但以下文件改动前需要格外谨慎：

- `layout/theme.liquid`（全站页面骨架）
- `sections/header.liquid`、`sections/header-group.json`
- `sections/footer.liquid`、`sections/footer-group.json`
- `config/settings_schema.json`（改动会影响商家在主题编辑器中看到
  的设置面板）
- `locales/en.default.json`（目前是唯一的文案来源，key 的增删要
  确认没有遗漏引用点）

## 七、模板与 Section 规则

- 每种页面类型保持一份模板，不要为营销活动复制 `product.*.json` /
  `collection.*.json` / `page.*.json` 变体——这是 `old` 已经证明会
  失控的模式
- 新增 section 前，先在 `sections/` 里搜索是否已有可以通过设置/
  block 扩展来复用的现有 section
- 修改 JSON 模板时，除非任务明确要求做结构调整，否则不要随意改动
  section id、block id 或 section 排序结构

## 八、配置文件规则

- `config/settings_data.json` 视为商家维护的生产状态，除非任务明确
  要求修改配置状态，否则不要编辑
- 配置项的定义改 `config/settings_schema.json`；目前设置项还不多，
  新增时顺手保持分组清晰（Theme Info / Logo / Product ... ），避免
  重蹈 `old` 里设置面混乱的覆辙

## 九、构建与校验流程

这个仓库没有构建脚本，改动即所见即所得：

1. 确认改动是通用能力还是单页需求
2. 修改对应的 section / snippet / template / asset，保持命名对称
3. 用 `shopify theme dev` 本地预览
4. 需要时用 `shopify theme push` 推送（明确是预览环境还是正式环境）

## 十、品牌语气（适用于任何面向客户的文案）

moodytiger 的标语是 "Stay in the play."。基调：温和从容而非生硬，
强调"活动"而非"性能炫耀"，鼓励而非施压，乐观而非煽情。说服顺序是
情感 → 功能 → 证明——绝不以面料化学成分或安全声明开头。对标品牌是
Patagonia / Veja / Lululemon，而不是 Nike 那种张扬风格。占位文案、
空状态、错误提示、营销 section 都同样适用这一标准。

## 十一、拿不准时的默认策略

- 优先选择影响范围更小、命名最贴合现有约定的方案
- 不确定某个能力是否会被多处复用时，先做成通用 section 的可配置
  block/设置，而不是硬编码成单页专属
- 本地没有发现 git 仓库元数据（此路径不是一个 git 工作树），尽管
  `settings_schema.json` 指向了一个 `git.w3r.dev` 仓库——把这个目录
  当作一份工作副本，在假设 git 历史或分支状态之前先与用户确认
- 没有构建流水线（打包器、PostCSS、TS）——CSS/JS 都是手写后直接上线
  的，引入任何工具链之前请先确认
