# 黑五 Spin & Win 开发说明（交接文档）

> 分支 `dev/prize` · 前端 Iris · 后端 Lily · 上线 2026-11-21 00:00 ET
> 本文是需求结论 + 开发计划 + 进度记录。**每个开发会话开始先读本文，结束前更新第 7、8 节。**
> 只记结论，不记讨论过程。与本文冲突时：用户最新口头确认 > 本文 > 接口文档 > 设计稿。

---

## 1. 资料来源

| 资料 | 位置 | 备注 |
|---|---|---|
| **上线清单** | 仓库根目录 `BF-spin-上线清单.md` | dev 店 → 线上的迁移项；每阶段新增迁移内容时追加 |
| 接口文档（以此为准） | `C:\Users\IRIS.ZHANG\Downloads\前端接口文档.md` | Lily 维护，会更新；文件名可能带 `(1)` 等后缀，取最新 |
| 设计稿 | Figma `OxEca5VxqgMelafMk20ywl`，页面「26.11.03黑五转盘弹窗」`631:3046` | 旧文件 `2POPspl39IFn1qPW4OiFhB` 已作废 |
| Figma 读取方式 | REST API，环境变量 `FIGMA_TOKEN`（不要打印） | 先拉一次存本地缓存；图片一次批量导出 |
| 旧版后端方案 | `D:\购物车设计稿\prize\后端接口方案.md` | **已过时**，仅作背景 |
| 飞书原始需求（Allen） | https://moodytiger.feishu.cn/docx/UYEtdyEPhoGss3xMrplcvjYun9b | **已过时**（token 链接/不登录方案已废弃） |

### 设计稿节点索引（2026-11-09 17:07 版已核对）

移动端（Section `681:14015`，画板 600 宽）：

| 编号 | 节点 | 名称 |
|---|---|---|
| 01 | `651:12512` | 转盘弹窗 · 未登录 |
| 02 | `862:42836` | 转盘弹窗 · 已登录（旧 `651:12629` 已删） |
| 02b | `862:43047` | 转盘弹窗 · 已登录 · 0 次（灰按钮 NO SPINS LEFT） |
| 03 | `713:14513` | 中奖·礼物 v2（首屏强调 + 下滑选礼物） |
| 04 | `665:13926` / `651:12031` | 中奖·10% OFF / 15% OFF |
| 04b | `810:42356` | 中奖·sherpa jacket（选颜色 + 尺码，CONFIRM MY JACKET） |
| 05 | `651:12107` | 中奖·Gift card |
| 06 | `729:15963` | 抽奖记录·未使用 |
| 07 | `729:16012` | 抽奖记录·已使用 |
| 08 | `810:42459` | 活动已结束 · 页面 |
| — | `651:12818` / `651:12820` / `651:12821` | 不可点按钮 / 提示文案示例 / 标注 |

电脑端（Section `681:14016`，1440 宽，弹窗 880×560 左转盘右内容）：

| 编号 | 节点 |
|---|---|
| 01 | `663:12915` |
| 02 | `736:38182`；0 次 `862:43154`（按钮以移动端灰色 NO SPINS LEFT 为准） |
| 03 | `745:39450`（首屏）、`745:39766`（展开示意） |
| 04 | `736:38330`、`736:38471` |
| 04b | `880:43647`（第一屏）、`880:43471`（全貌）；旧 `738:38750` 已删 |
| 05 | `736:38611` |
| 06 / 07 | `729:16060` / `729:16193` |
| 08 | `810:42499` |

---

## 2. 需求结论

### 2.1 入口与登录

- **邮件链接 → 活动中转页**（新建通用 section，见第 4 节），由前端控制，**不用**接口文档 1 节里的 `?spin=1` 方案。
- 中转页逻辑：
  1. 不论是否登录，先调 `status`（5 秒超时）。
  2. `ENDED` → **无论是否登录**都显示 08 活动已结束（文案可在 section 设置里配置）。（2026-11-09 用户更正）
  3. `ONGOING` / `NOT_STARTED` / 接口失败或超时：
     - 已登录（`customer`）→ 跳落地页 `/pages/black-friday2026`。
     - 未登录 → 跳 `/customer_authentication/login?return_to=/pages/black-friday2026`（新客户账户；PC 浏览器已实测 return_to 生效，**手机和 Gmail 内置浏览器待测**）。
- 落地页 URL `black-friday2026` 由中转页跳转，我们控制。

### 2.2 落地页自动弹窗（`page.black_friday.json`）

- 未登录：什么都不弹。
- 已登录：调 `status`
  1. `spinsLeft > 0` → 弹 **02 转盘**（每次进页都弹，不再查奖品）。
  2. 否则调 `prizes?tab=unused`，`items.length > 0` → 弹 **06 My prizes**（**同一 session 只弹一次**，`sessionStorage`；读写异常时视为已弹过）。
  3. 都没有 → 不弹。
- **不用** `pendingGifts` 做自动弹选款。
- 关掉后重新打开的入口组件**以后再做**，本期不做。01（未登录态）设计稿属于这个入口的场景。
- 与 newsletter 弹窗互斥：转盘打开时给 `<html>` 加 `mt-spin-lock`，并让 `newsletter-popup.js` 的 `otherOverlayOpen` 识别它。

### 2.3 转盘与奖品展示

- 6 格，按 `draw` 返回的 `slot` 停到对应格子，前端**不做随机**。格子文案来自 `status.slots[]`。
- 奖品名只返回大标题，前端按 `type` 拼接（固定文案放 `locales/en.default.json`）：

| type | name 示例 | 前端显示 |
|---|---|---|
| COUPON | `10%` | 10% **OFF** |
| GIFT_CARD | `25` | **$**25 **GIFT CARD** |
| GIFT | `FREE OUTFIT` | 大标题 + 固定小标题（取设计稿） |
| GRAND | `SHERPA JACKET` | 只有大标题，**无小标题** |

- **所有弹窗文案前端写死**（locales），不由运营配置，**不用 metaobject**。设计稿前后矛盾处问用户（例如门槛以 **$150** 为准）。
- 门槛金额文案用 `spinThreshold` 拼，不写死数字。
- 02 订单列表：`spinGroups` 全部展示（含已抽完 `spins = 0`，可显示 "All spins used"；`spinsUsed`/`spinsTotal` 可用）。
- **倒计时纯展示**：用 `allPrizesUntil - serverTime`，仅在未过期时显示，美东时间。3 小时规则是后端逻辑，前端**不解释、不限制**抽奖。
- 礼品卡：显示**完整卡号** `giftCard.code` + COPY CODE。
- 折扣码：目前一直在"未使用"，后端补 `USED` 后自动移到"已使用"，前端不用改。

### 2.4 选款（03 FREE OUTFIT / 04b SHERPA JACKET 共用一个组件）

- 都走 `gift-options` + `gift-selection`，按 `pickCount` 区分：
  - `2`（GIFT）：显示 `category` 筛选，选 2 件。
  - `1`（GRAND）：不显示筛选，只选颜色 + 尺码，按钮 CONFIRM MY JACKET。
- 尺码**默认不选中**；`available: false` 置灰不可选。
- **不处理选款期限**：不判断 `selectDeadline`、不显示过期态；提交报错按错误码提示即可（`40912` 提示联系客服）。
- 尺码表：每款的 `sizeChart` 字段（`cloth` / `shoe` / `legging`，**Lily 待补**），缺失或未知值时**默认 `cloth`**。复用现有 `snippets/size-chart-modal.liquid` 与页面：
  - `cloth` → `pages['size-chart-clothing']`
  - `legging` → `pages['size-chart-breezy-leggings']`
  - `shoe` → `pages['size-chart-shoes']`
- 中奖弹窗副标题里的订单号用 `prize.orderName`。

### 2.5 接口使用约定（细节见接口文档）

- 请求前缀 `/apps/bf/spin/...` 从**主题设置**读取，不写死（需要改 `config/settings_schema.json`，高风险，改前列出给用户确认）。
- 不依赖 Cookie；`requestId` 用 UUID，同一操作重试复用，新操作新生成。
- 时间按美东显示（`Intl`, `America/New_York`）。
- 错误码处理照接口文档第 5 节。
- GA4：草案事件 `spin_popup_view`、`spin_click`、`spin_result`、`spin_copy_code`、`spin_shop_now`、`spin_gift_confirm`、`spin_prizes_view`；**券码/卡号不进 dataLayer**。遵守记忆里的 GA4 约定，新增事件要在飞书 GA4 表 sheet3 末尾加行。


### 2.6 设计稿冲突的裁定（2026-11-09 用户确认）

- 02 底部文案以移动端为准："Each spin expires 3 hour after it is added. / Spend $X on one order to earn a spin."；订单行 "Use within hh:mm:ss" 倒计时按 `allPrizesUntil - serverTime`，过期后**只是不显示倒计时**，仍可抽（运营用倒计时催促尽快抽）。
- 门槛金额一律用 `spinThreshold` 拼（设计稿里 $200 / $150 不一致）。
- PC 与移动端不一致时**以移动端为准**（如 0 次按钮 NO SPINS LEFT）。
- PC 03 的 "Pre-selected size…"、"Find their fit with Kiwi" **不做**。
- 转盘格子文案来自 `status.slots`（PC 稿残留的 ANNUAL SURPRISE BAG 忽略）；GIFT 小标题固定 **"PICK 2 OF 18"**。
- 礼品卡显示完整卡号 + COPY CODE（PC 05 打码稿忽略）。
- 06/07 奖品名用接口大标题（设计稿 "FREE GIFT" 忽略）。
- 04b 文案以移动端为准，不写金额。
- 折扣码有效期按设计稿 "Use within 1 month · until Dec 31"；**不处理 `coupon.startsAt`**。
- 礼品卡 `balance` 为 `null` 时 06 不显示余额这一段。
- 转盘画面顺时针为 10% → 15% → FREE OUTFIT → $25 → $50 → SHERPA，与 slot 0–5 顺序不同，停格需按画面位置映射。
- 中转页：页面 handle `spin-and-win`；08 有 footer（稿里没画）；08 文案与按钮链接在 section 设置里，按钮默认首页。


### 2.7 阶段 2 确认（2026-11-10）

- 问候语：有名字 "Hi, {first_name}"，没有名字只显示 "Hi"。
- 订单行：剩余 > 0 显示橙色 "N spins"；已用 > 0 显示灰色 "N spin(s) · used"；部分用掉两者都显示（如 "1 spin · used" + "2 spins"）。
- 转盘位置：12 点顺时针放 slot `0,1,4,2,3,5`，颜色按位置（白/橙/米/白/橙/米）。
- 倒计时每秒刷新，用 serverTime 校正，归零隐藏该行；订单多时弹窗内滚动；金额 "150.00" 显示 "$150"。
- 06 打开时并行请求 unused/used 拿两个计数；"spin left" 横幅仅 spinsLeft > 0，点击回 02。
- 关闭：×/遮罩/Esc；02 不做记忆。接口失败落地页不弹。
- mock：`?spin_mock=spins|nospin|none`，数据放 `assets/spin-wheel-mock.js` 按需加载，仅非线上主题。
- 文案放 `locales/en.default.json` 的 `spin.*`。
- 黑五页会新增一个**手动触发入口 section**（点击模块打开转盘）。设计稿：Figma `2POPspl39IFn1qPW4OiFhB` Page 1（node `0:1`，旧文件里的入口部分仍有效）。阶段 2 完成后再按问题清单流程做；转盘暴露 `[data-spin-open]` 点击 + JS 打开接口。
- 手动打开：未登录 → **01**（SIGN IN → 登录后回黑五页）；已登录有次数 → 02；已登录 0 次 → 02 的 0 次态（可经 My prizes 进 06）。01 纳入阶段 2。
- newsletter 互斥**不做**：主题 newsletter-popup 在 footer-group 里是 disabled，线上弹出的 newsletter 不是主题代码（第三方），自动弹出场景不冲突；`newsletter-popup.js` 不改。

---

## 3. 环境

| 项 | 值 |
|---|---|
| 开发店铺 | `moodytiger-us-dev.myshopify.com`（Plus 合作伙伴开发店，可下测试单） |
| 开发主题 | `BF Spin 开发` `167518339158`，`shopify.theme.toml` 的 `[environments.dev]` |
| 本地预览 | `shopify theme dev -e dev` |
| 推送 | `shopify theme push -e dev --only <文件>`（推送前确认范围） |
| 线上 | `moody-tiger-athletics`，**不在线上联调**；上线走 `push-theme.ps1`（不推 `templates/*.json` / `settings_data.json`） |
| 模拟数据 | `?spin_mock=1`，**只在非线上主题生效** |
| dev 店已准备 | 图片、5 个元字段定义、落地页 `black-friday2026`（模板 `black_friday`）、3 个尺码表页、header/footer 菜单、新客户账户、测试支付、Lily 的 App Proxy |
| Admin API 脚本 | scratchpad `shopify/gql.sh`（客户端凭证换短期 token，拒绝连线上店） |

注意：
- `head-tracking.liquid` 的 Hotjar 在 dev 店也会上报到线上 Hotjar（未处理，待用户决定）。
- dev 店主题推送时，模板引用不存在的元字段/视频会**整个文件被拒**，且每次只报一个错。
- 不用 `sed -i` 改主题文件；改完检查有无 `*.tmp.*` 残留。

---

## 4. 文件规划（命名对称）

| 新建 | 用途 |
|---|---|
| `sections/campaign-gate.liquid` + `assets/campaign-gate.css` + `assets/campaign-gate.js` | 通用活动中转页（结束文案、目标页、登录跳转可配置） |
| `templates/page.campaign-gate.json` | 中转页模板（dev 店再新建一个页面套用） |
| `sections/spin-wheel.liquid` + `assets/spin-wheel.css` + `assets/spin-wheel.js` | 转盘弹窗全部状态（02–07），加到 `page.black_friday.json` |
| 可能拆出的 snippet | 选款组件等，按需拆，保持单一职责 |

| 修改 | 风险 |
|---|---|
| `config/settings_schema.json`：新增 App Proxy 前缀设置 | **高风险**，改前给用户看 |
| `locales/en.default.json`：转盘相关文案 | 核对所有引用点 |
| `assets/newsletter-popup.js`：识别 `mt-spin-lock` | 小改 |
| `templates/page.black_friday.json`：加入 spin-wheel section | 不动已有 section id/顺序 |

新增组件前先看设计稿 + 出问题清单，确认后再写代码。

---

## 5. 开发阶段

| # | 内容 | 依赖 | 验收 |
|---|---|---|---|
| 1 | 活动中转页 | `status` | 已登录直跳；ENDED 显示 08；其他跳登录且能回到落地页（真机） |
| 2 | 转盘弹窗骨架 + 自动弹出逻辑（02/06 判断、sessionStorage、互斥） | `status`、`prizes` | 四种账号状态弹窗正确；PC/移动端布局对稿 |
| 3 | 抽奖动画 + 中奖弹窗 04 / 05 | `draw` | 停格与 slot 一致；COPY CODE；错误码 |
| 4 | 选款组件 03 / 04b + 尺码表 | `gift-options`、`gift-selection` | pickCount 1/2 两种；售罄置灰；提交成功/失败 |
| 5 | My prizes 06 / 07 | `prizes` | 两个 tab、各类型状态展示 |
| 6 | GA4 埋点 + 全量验收 | — | 事件按约定上报；PC/移动端/Gmail 内置浏览器 |

---

## 6. 待定 / 待他人

- [x] Lily：`gift-options` 已补 `sizeChart`（目前 `cloth`/`legging`，`null` 时前端缺省 `cloth`）。
- [ ] 中转页开发完成后，把邮件链接 `/pages/spin-and-win` 提供给 Lily，替换接口文档第 1 节的 `?spin=1`。
- [ ] Lily：mock / 联调接口地址。
- [x] 设计：PC 04b 已更新；GIFT 小标题 PICK 2 OF 18；02 文案以移动端为准（见 2.6）。
- [ ] 用户：dev 店 Hotjar 是否屏蔽。中转页 handle 已定 `spin-and-win`。

---

## 7. 进度

| 阶段 | 状态 | 备注 |
|---|---|---|
| 需求确认 | ✅ 2026-11-09 | |
| dev 环境 | ✅ 2026-11-09 | |
| 1 中转页 | 🟡 PC 已验证（已登录/未登录 × ENDED/进行中，登录后回落地页）；待：手机 + Gmail 内置浏览器、PC/移动端对稿 | campaign-gate 三件套 + page.campaign-gate.json + 主题设置 spin_proxy_prefix |
| 2 弹窗骨架 | 🟡 代码完成，待 dev 店预览 | spin-wheel 三件套 + spin-wheel-mock.js + locales `spin.*` + page.black_friday.json 末尾加 section |
| 3 抽奖 + 04/05 | ⬜ | |
| 4 选款 03/04b | ⬜ | |
| 5 My prizes | ⬜ | |
| 6 埋点 + 验收 | ⬜ | |

---

## 8. 会话交接记录

（每个会话结束前追加：日期、完成了什么、未完成/坑、下一步。）

- **2026-11-09**：完成需求确认、接口对齐、dev 店迁移。新设计稿和最新接口文档**尚未重新读取**——下一个会话先读这两个来源，与本文对比，有变化先报告给用户确认，再开始阶段 1。
- **2026-11-09（会话 2）**：重新读取设计稿（17:07 版）与接口文档，冲突已由用户裁定（见 2.6）。阶段 1 代码完成：`sections/campaign-gate.liquid`、`assets/campaign-gate.css/.js`、`templates/page.campaign-gate.json`，`settings_schema.json` 新增 "Spin & Win" 组（`spin_proxy_prefix`）。mock：`?spin_mock=ended` 显示 08，其他值按 ONGOING 跳登录（仅非线上主题）。**未完成**：`theme dev -e dev` 需要 dev 店店铺密码（非交互环境无法输入）→ 由用户在终端运行或确认推送到 dev 主题；dev 店已创建 `spin-and-win` 页面（`gid://shopify/Page/264698888278`，模板 campaign-gate，已发布）；用户已自行启动 `theme dev -e dev`；真机验证 return_to（含 Gmail 内置浏览器）。
  - 补充：中转页逻辑更正为先查 status，ENDED 无论是否登录都显示 08。`theme dev` 在 Windows 上会漏同步编辑过的文件，改完不生效时先查页面 HTML，再重启 theme dev。邮件链接 `/pages/spin-and-win` 可提供给 Lily（线上需建同 handle 页面 + 主题代码上线）。
- **2026-11-10**：阶段 2 代码完成（未预览）。`sections/spin-wheel.liquid`（01/02 转盘视图 + 06/07 奖品视图框架）、`assets/spin-wheel.css/.js`、`assets/spin-wheel-mock.js`、`locales/en.default.json` 新增 `spin.*`、`templates/page.black_friday.json` 末尾加 `spin_wheel`。打开接口：`[data-spin-open]`（值 `prizes` 打开 06）或 `window.mtSpin.open('wheel'|'prizes')`。mock：`?spin_mock=spins|nospin|none|error`（需已登录才会自动弹）。06 每会话一次用 sessionStorage `mt-spin-prizes-shown`。转盘为 SVG（viewBox 340×364，rotor `[data-spin-rotor]` 供阶段 3 旋转，指针在底部）。SPIN NOW 按钮（`[data-spin-draw]`）未接抽奖。06 卡片列表留给阶段 5。移动端字号按 PC 同级（设计稿移动端画板有的放大约 1.4 倍，06 尤其明显）。文案 "3 hour" 改为 "3 hours"（语法）。
