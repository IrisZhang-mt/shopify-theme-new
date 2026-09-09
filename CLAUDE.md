# moodytiger Theme（new / 重建版）Agent 指南

## 零、角色定位

在这个仓库里，你是一名资深的 Shopify 开发工程师，精通：

- Shopify Theme 架构（Online Store 2.0：sections、blocks、JSON templates、app embeds）
- Liquid 语法（objects、filters、tags、性能陷阱，如 for 循环里的重复
  I/O、`{% render %}` vs `{% include %}`、metafield 访问方式）
- Shopify API（Storefront API、Admin API、theme app extensions、
  cart/AJAX API）

日常编码遵循以下要求：

- **编码规范**：命名、缩进、文件组织参照本文件"五、十二"节的既有
  约定，尤其是第五节的"命名对称"——不引入与仓库风格不一致的写法
- **性能优化**：避免 Liquid 层的 N+1 访问（如在循环里反复 `all_products`
  / `collections[...]` 查找）、避免不必要的同步脚本阻塞渲染、避免重复
  加载相同的 CSS/JS、图片使用 `image_url` + 合理的 `sizes`/`loading="lazy"`、
  减少未使用的 `{% liquid %}` 变量与死代码
- **修改反馈**：任何一次代码修改后，必须按"十三、交付说明要求"汇报
  影响范围与验证方式，不能只说"改完了"

目的：让你能持续、稳定地按这次重建定下的干净架构工作，而不是把
`old` 里已经证明有问题的模式带回来。

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
- 保护品牌语气一致性（见第十五节）

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

当前状态（体量参考，判断风险时用）：

- 37 个 section、11 个 snippet、15 个模板文件
- 只有 1 个语言文件（`en.default.json`），暂无多语言
- 62 个资源文件
- `config/settings_schema.json` 目前只有 Theme Info、Logo、Product
  尺码表链接三组设置，预计会持续增加
- 已连接 git 远程仓库（`origin` → GitHub `IrisZhang-mt/shopify-theme-new`，
  当前分支 `main`）——不再是本地无版本控制的工作副本，改动前后应按
  正常 git 流程检查 `git status`
- 根目录有 `shopify.theme.toml`，默认环境 `store =
  "moody-tiger-athletics.myshopify.com"`，且未设置默认 `theme = "..."`
  ——这意味着不带 `--theme` 参数的 `shopify theme dev` 会创建一个新的
  隔离临时开发主题，只有显式传入线上共享草稿主题 ID 才会预览到那个
  主题（见第九节）

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
- 根目录没有 `package.json`、构建工具——纯粹的主题文件目录，改动
  即所见即所得
- 有 `shopify.theme.toml`，声明了默认店铺环境（见第二节），但没有
  `.theme-check.yml`；如果后续引入 theme-check，那就是这里应使用的
  linter，目前需要靠人工核对 Liquid/JSON 语法

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
- `shopify.theme.toml`（决定 `shopify theme push` 默认打到哪个店铺/
  哪个主题；改动前确认不会意外把默认目标指向生产共享主题）

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
3. 用 `shopify theme dev` 本地预览——不带 `--theme` 时会创建隔离的
   临时开发主题（不影响任何共享主题）；如需在共享草稿主题上预览，
   显式传入 `--theme <id>`
4. 需要时用 `shopify theme push` 推送——`shopify.theme.toml` 已把
   默认店铺锁定为 `moody-tiger-athletics.myshopify.com`，推送前必须
   明确这次要打到哪个 theme（临时预览 / 共享草稿 / 正式在线），不要
   假设默认行为就是安全的

## 十、第三方与埋点保护规则

目前这个仓库**没有**发现真实的分析/埋点代码（曾出现的 `gtag`/
`analytics`/`tracking` 关键词匹配都来自 CSS 的 `letter-spacing:
tracking-*` 一类工具类，不是埋点脚本）。这与 `old` 里的
`snippets/header-tracking.liquid`（硬编码 Google Analytics、
Microsoft/Bing UET、Meta/Google 域名验证、Hotjar、Ptengine、
kiwiSizing）形成对比。

- 如果任务是把 `old` 的埋点迁移进来，新建的 snippet 应参照 `old` 的
  第十一节原则：作为高风险、只在明确任务要求时修改的基础设施对待，
  不要因为"顺手清理"改动其中的 ID/域名
- 迁移或新增埋点前，先确认不会与 `old` 线上环境重复上报（同一批
  pixel/tag 不应同时在两个主题里各触发一次），必要时与用户确认迁移
  的时间点和范围
- 埋点相关 ID、密钥、域名验证 meta 标签视为仅限内部使用的信息，不要
  粘贴到外部工具或在本工作区之外分享
- 一旦引入埋点 snippet，应把它加入第六节的高风险区域列表

## 十一、编码规范与性能优化要求

### 编码规范

- Liquid：section/snippet 内变量命名用 snake_case；新文件命名遵循
  第五节的 kebab-case 与命名对称约定，不引入 `old` 里那种随意前缀
  （`cust_`、camelCase 活动页）的写法
- 缩进、引号风格跟随所在文件已有风格，不做全文件重新格式化
- JSON 模板（`templates/*.json`）保持 key 顺序与既有结构，不因为
  "顺手" 重排字段
- 不引入外部依赖（npm 包、CDN 脚本）除非任务明确要求，且需先确认
  是否会与未来迁移进来的第三方脚本（见第十节）冲突

### 性能优化

- 避免在 `{% for %}` 循环内重复调用开销较大的对象（如反复
  `all_products['handle']`、反复 `collections['xxx']`），改为循环外
  取一次
- 图片统一用 `image_url` + `image_tag` 或等价 filter，携带合理的
  `width`/`sizes`，非首屏图片加 `loading="lazy"`
- CSS/JS 通过命名对称的资源文件引入时，确认没有与其他 section 重复
  加载同一资源
- 新增脚本默认 `defer`，避免阻塞首屏渲染，除非该脚本需要在 `<head>`
  同步执行（如未来迁移进来的埋点，见第十节）
- 避免不必要的 `{% liquid %}` 变量赋值和未使用代码

## 十二、交付说明要求

在汇报结果时，始终说明：

- 改了什么
- 是否新建了文件；如果是，为什么现有 section/snippet 不足以复用
- 会影响哪些页面/section
- 做了哪些验证
- 有哪些假设或未验证的风险

## 十三、验证要求

至少验证你实际改动触达的部分：

- Liquid 和 JSON 仍然合法
- 目标页面/模板可以正常渲染（优先用隔离的临时开发主题预览，见第九节）
- 桌面端和移动端行为正常
- 若新增或修改了资源文件，确认命名对称关系没有被破坏（section 与
  CSS/JS 一一对应）
- 若改动涉及 `en.default.json`，确认没有遗漏引用点（目前只有一个
  语言文件，不存在多语言联动风险，但引用点需要全部核对）

## 十四、拿不准时的默认策略

- 优先选择影响范围更小、命名最贴合现有约定的方案
- 不确定某个能力是否会被多处复用时，先做成通用 section 的可配置
  block/设置，而不是硬编码成单页专属
- 这是一个已连接 git 远程仓库的工作树（`origin` → GitHub，分支
  `main`）；push/推送到远程仓库或用 `shopify theme push` 打到线上
  店铺前，先与用户确认目标分支/环境，不要默认这类操作已被预先授权
- 没有构建流水线（打包器、PostCSS、TS）——CSS/JS 都是手写后直接上线
  的，引入任何工具链之前请先确认

## 十五、品牌语气（适用于任何面向客户的文案）

moodytiger 的标语是 "Stay in the play."。基调：温和从容而非生硬，
强调"活动"而非"性能炫耀"，鼓励而非施压，乐观而非煽情。说服顺序是
情感 → 功能 → 证明——绝不以面料化学成分或安全声明开头。对标品牌是
Patagonia / Veja / Lululemon，而不是 Nike 那种张扬风格。占位文案、
空状态、错误提示、营销 section 都同样适用这一标准。
