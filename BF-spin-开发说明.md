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
  - **2026-11-10 已开发**：`sections/perks-tabs.liquid`（+ `assets/perks-tabs.css/.js`），黑五模板 `perks_tabs_bf`（倒计时之后）。勾选 "Opens Spin & Win" 的 tab 带 `data-spin-open`；GA4 在线表 No.84 `select_content_category` / No.85 `spin_entry`。插画由运营上传（151:96，建议 604×384）。
- 手动打开：未登录 → **01**（SIGN IN → 登录后回黑五页）；已登录有次数 → 02；已登录 0 次 → 02 的 0 次态（可经 My prizes 进 06）。01 纳入阶段 2。
- newsletter 互斥**不做**：主题 newsletter-popup 在 footer-group 里是 disabled，线上弹出的 newsletter 不是主题代码（第三方），自动弹出场景不冲突；`newsletter-popup.js` 不改。

### 2.8 还原规则（2026-11-10 用户要求）

- **100% 还原设计稿**，PC / 移动端不按固定比例互推；同一端两张图同类元素对不上 = 设计稿问题，先报给用户。
- **弹窗固定高度**：移动端 80dvh；PC min(560px, 80dvh)。06/07 只有列表区滚动，切 tab 不跳。**例外：01 未登录在移动端高度随内容**（设计 860 高，max 100dvh − 上下边距，超出才滚动；JS 在 root 上写 `data-spin-state`），PC 的 01 仍是 560。
- **滚动条常显**（用户 11-10 要求）：弹窗面板本身不滚动，可滚动区域标 `data-spin-scroll`（移动端：转盘视图整体、奖品列表；PC：右侧内容、奖品列表）。有 hover 的浏览器用 `::-webkit-scrollbar` 样式（不会自动隐藏，6px，滑块 #a8a7a2）；触屏设备隐藏系统滚动条，由 JS 画 4px 轨道 + 滑块（`.mt-spin__bar`，ResizeObserver + scroll 更新）。阶段 3–5 新增可滚动区域时加上 `data-spin-scroll` 即可。
- **手动换行必须照稿**（设计稿文本里的 `\n`），不能靠自动换行。只在移动端有的换行用 `<br class="mt-spin__br">`（≥990 隐藏），两端都有的用 `\n` + `white-space: pre-line` 或普通 `<br>`。已处理：01 sign_in_text / email_hint（仅移动）、02 Spin terms（两端）、06 Tap “Used” note（仅移动）、08 标题 "Spin & Win / has ended"（仅移动，`.mt-gate__br`）、08 message（两端）。
- **后续阶段待照稿换行**（脚本从 page.json 提取，`scratchpad/figma/nl.js`）：移动端 Email confirmation "We also emailed it to you.⏎Saved in My prizes."；Choose later note（第一句后换行，两端）；Redemption terms / Card terms（移动端多处换行，PC 的 Terms 每句一行）；PC 04 Terms 三行。做到对应阶段时重新跑脚本核对。
- **移动端换算（用户 11-10 选 B：严格按稿）**：移动端画板手机屏 560 宽，CSS 里所有移动端数值写成 `calc(设计稿px * var(--u))`，`--u = min(100vw, 560px) / 560`（390 宽 ≈ ÷1.44）。字号、间距、圆角、按钮高度都按此换算；PC（≥990）直接用 1440 稿 px，且必须覆盖每个继承来的 --u 值。08 结束页保持 ÷1.5 不改（用户同意）。
- 转盘 SVG viewBox = 移动端 01 的 "Prize wheel" 框 334×391（11-10 设计稿更新后），圆心 (167,200)，rim r166，扇区 r160，指针尖 y345、底 y382；CSS `.mt-spin__rotor` 的 transform-origin 必须同步。PC 转盘宽 287px，顶部 97px。
- 设计稿不一致（已报用户，暂各按各稿）：02 的指针比 01 低 7px（按 01）；关闭按钮 01/02 是 44 框 / 16 图标 / 2.5 线 / moss 色，06/07 是 22 框 / 13.2 图标 / 1.5 线 / 灰色（按视图切换，root `data-spin-current`）。
- 本地截图核对：`scratchpad/harness/build.js` 把 section 渲成静态页，无头 Chrome 截图（Windows 窗口最小约 500 宽，移动端要用 390 宽 iframe 套一层）。

### 2.9 阶段 3 确认（2026-11-10）

- 设计稿：移动端 04 `665:13926`（10%，**为准**）/ `651:12031`（15%，条款字号换行不一致，忽略）、05 `651:12107`；PC 04 `736:38330`、05 `736:38611`（11-10 14:58 版）。
- 移动端：抽中后整个转盘视图换成结果；PC：左侧转盘保留（停在中奖格），右栏换成结果。
- 折扣条款（用户给定，两种折扣共用）："Enter the code at checkout. Stacking with⏎multi-buy deals. One-time use by {date}. If your order is cancelled or refunded, this code may be voided."（移动端在 "Stacking with" 后换行；PC 按设计每句一行）。`{date}` 与券面 "(by Dec 31)" 都由 `coupon.expiresAt` 按美东时间算。
- 动画：4 秒、至少 5 圈、停在格子正中（不加随机偏移），停后 0.6 秒出结果；减少动态效果时 1 秒。
- SHOP NOW：关闭弹窗，留在黑五页。COPY CODE：复制后显示 COPIED 2 秒。
- SPIN AGAIN：回 02 并重新拉 status；`spinsLeft = 0` 时不显示 SPIN AGAIN。
- 抽中 GIFT / GRAND：**临时**进 06 My prizes，阶段 4 换成 03 / 04b。
- 抽奖错误：网络/超时/42900/50300 → "That spin didn’t go through. Please try again." + 按钮 TRY AGAIN，**重试复用 requestId**；40902 → spend 规则文案并刷新 02；40901 → ended 文案；40900 → "Spin & Win opens {date}."；40101 → 切 01。
- 转动中可以关闭弹窗（奖品已在服务端生成，关掉后 My prizes 可见），关闭会丢弃未完成的动画/结果。
- PC 与移动端样式各按各稿：PC 券面 1px 边框无缺口、品牌字用正文字体；按钮文案统一用移动端大写（COPY CODE / SHOP NOW）。礼品卡显示完整卡号；`sentTo` 为空不显示 "Sent to"。
- 05 设计稿 11-10 16:11 修正（用户发现内容不一致）：卡面金额两端都是白色；两端都删掉 "No expiry date. Use it like cash at checkout."；两端都有 "We also emailed it to you. Saved in My prizes."（PC 05 在 "Sent to" 下、按钮上；PC 04 和移动端在按钮下）——位置差异用户确认**保留**（11-10）。
- **PC / 移动端内容不一致（某端多一行文案、同一数据颜色/数值不同、文案不同）必须写代码前单独问用户**；设计师可以调 CSS 比例，但无权改内容，多半是失误。
- Lily 已确认抽中后会发邮件，"We also emailed it to you." 保留。
- SPIN AGAIN（以及任何回到 02 的情况）转盘回正（rotation 归 0）。

### 2.10 阶段 4 确认（2026-11-10）

- 设计稿：移动端 03 `713:14513`、04b `810:42356`；PC 03 `745:39450`（首屏）/ `745:39766`（全貌）、04b `880:43647` / `880:43471`；置灰按钮 `651:12818`（灰底 #E6E6E6 + 灰字 #A8A7A2，下方 12px 提示文案 #6F6E69，示例 "Choose a size for both gifts to continue"）。
- **PC / 移动端内容不一致（03 首屏链接、底部说明、($140) 金额、04b 副标题与说明、按钮大小写）：用户已让设计师改稿**。**阶段 4 暂不开发**：等设计师改完、PC / 移动端前后不一致处由用户逐条确认后再动代码（11-10 用户要求）。
- 款式行 = 18 款横滑缩略图（`styles`），下方小字 `category`，**不做 category 筛选**（取代 2.4 的"显示筛选"）。
- 默认：款式不选；选了款式自动选第一个颜色；尺码不预选。04b 颜色默认第一个、尺码不选。没选款式时颜色 / 尺码两步显示灰色提示态。
- 顶部 GIFT 1 / GIFT 2 占位卡：选好款式后问号礼盒换成该款图片，**不显示款名**。
- Choose 按钮 / "Scroll to choose" 平滑滚到选择区（移动端两个按钮各滚到 GIFT 1 / GIFT 2）。
- CONFIRM 按钮**未选完时置灰不可点**（设计稿 `651:12818`），按钮下方显示还差什么的提示文案（取代原"点了再滚动提示"的默认方案）。
- 提交成功 → 进入 06 My prizes。
- 提交失败：40910 重新拉选项 + 提示换尺码；40911 进 My prizes；40912 提示联系客服；40913 提示重新选；网络错误可重试、复用 requestId。
- Size guide：按 `sizeChart` 打开现有尺码表弹窗（`null` → cloth），叠在转盘弹窗上。
- 色卡：18 款是正在售卖的商品，取值逻辑与 quick shop 一致（`snippets/color-swatch.liquid`：主题设置 Custom colors 映射 → Files 里 `<颜色 handle>.png`，404 时米白）。
- Lily 确认选完赠品会发邮件。
- 抽中 GIFT / GRAND 直接进 03 / 04b（替换阶段 3 的临时跳 06）；06 的 CHOOSE（阶段 5）打开同一组件。
- **11-11 设计稿第二轮裁定**（11-11 10:55 版对比后，用户逐条定）：
  - 移动端 03 的 "1 spin left · SPIN AGAIN →" 放进画板（在 CONFIRM 下方，设计师补）。
  - "还剩几次 + 再抽"统一为 **"1 spin left · SPIN AGAIN →"**（两端、所有弹窗）；"My prizes" 箭头统一 **"›"**；按钮统一大写 **"CONFIRM MY 2 GIFTS"**。
  - ($140) **写死在文案里**，不计算，PC / 移动端一致。04b 条款保留 "gift set"。
  - 07 底部说明 "Prizes you've redeemed…" **两端都不要**（删 PC）。
  - 07 移动端：同一张卡片两件商品，第二件位置以第一件为准；PC 07 设计师在改。
  - 06 / 07 移动端标题、tab 位置**以 06 为准**，切 tab 只换按钮颜色、不跳。
  - 06 SHERPA JACKET 待选款卡片 = FREE GIFT 卡片样式，标题换成 SHERPA JACKET；07 已兑换大奖同理。07 礼品卡：内容同 06 礼品卡，样式同 07 其他卡片，按钮位置显示 "Used"。tab 为 0 时显示一句品牌语气的空状态文案。
  - 03 / 04b：没选款式时色卡、尺码都是未选中样式；选好款式后顶部礼物卡换成商品主图；**切换款式时清空已选颜色和尺码**；PC 置灰按钮沿用移动端规则；某颜色全部售罄时圆点不变、尺码全部置灰；04b 补 "Sold-out sizes are greyed out."。
- **11-11 第三轮裁定**：
  - 选款：选了款式后自动选中**第一个有货的颜色**；切换款式时，如果之前选的尺码在新款式的这个颜色下有货就保留，否则清空。某款所有颜色的所有尺码 `available` 都为 false → 缩略图加 SOLD OUT 蒙层，不能选（Lily 不会过滤掉零库存的款）。
  - "Pick 2 of {n}" / "{n} styles · swipe ›"：2 写死，n = 接口 `styles.length`。
  - 退货条款 "If you return that order, please return the gift set too, or its value ($X) may be deducted from your refund."：**只有 CONFIRM 可以提交时才显示**（03 选了 0 或 1 件不显示），$X = 所选款式的 `value`（接口款式级吊牌价）相加（用户 11-11 定，不用变体价）。
  - 提交失败的提示放在 CONFIRM 按钮下方，和置灰提示共用一个位置、样式相同；各错误码的处理、置灰提示文案、空状态文案按 11-11 清单（用户已 OK）。40912 联系邮箱 `order@moodytiger.com`（mailto 链接）。
  - 礼品卡余额用完 → 进 Used，不显示余额。
  - 06 SHERPA 卡副标题用 "Just pick your fit"；06 顶部 "You have 1 spin left / Spin again →" 不纳入统一。
  - PC 07 新稿 `988:44073`（一张卡片两件并排，删掉底部说明）。移动端 03 的 SPIN AGAIN、移动端 07 第二件商品对齐、07 标题和 tab 对齐 06：设计师不再改，由开发自己处理。
  - PC 04 / 05 的 "Spin again → (1 spin left)" 改成统一写法 "1 spin left · SPIN AGAIN →"（阶段 3 的代码要跟着改）。
- **11-11 第四轮（看过实现后）**：
  - 03 进来时**每件默认选中第一个有货的款式 + 第一个有货的颜色，只有尺码不选**（取代"款式不选、没选款式时颜色尺码空着"）。所以置灰提示一开始就是 "Choose a size for both gifts to continue"（和设计稿示例一致）。
  - 因为款式总是有默认值，顶部 GIFT 1 / GIFT 2 礼盒**在这一件尺码也选好（这件选完）后**才换成商品主图。
  - 关闭按钮固定在弹窗右上角（PC 03 下滑时压在内容上也保持不动）。
  - 售罄尺码文字统一 #6F6E69（PC 03 稿是 #A8A7A2，用户 OK）。
  - "18 styles · swipe ›" 可点击：往右翻约一屏，到底后回到开头（PC 鼠标用户没法滑）。

### 2.11 阶段 5 确认（2026-11-11）

- 设计稿：移动端 06 `729:15963`、07 `729:16012`；PC 06 `729:16060`、07 `988:44073`（11-11 15:45 版）。06 顶部条 "Spin again →" 在稿里设置了全大写，显示 "SPIN AGAIN →"，与现有代码一致。
- **两个 tab 的内容完全按各自接口返回**（`/prizes?tab=unused` / `?tab=used`），前端不判断哪个奖品属于哪个 tab（礼品卡余额用完是否进 Used 由后端决定）。
- 07 赠品每件下方 "Ships with your order #xxx" 用 `orderName`（抽中奖品的订单），不用 `giftOrderName`。
- 07 折扣码 "Used Nov 23"：用户说使用日期在 coupon 对象里返回，前端先读 `coupon.usedAt`（字段名待用户用掉折扣码后核对）；没有就只显示 "Code XXX"。
- 07 礼品卡：内容同 06 礼品卡但不显示余额（"Code XXX · No expiry date"），右侧 "Used"，样式同 07 其他卡片。
- 其余按默认（用户消息未写完 B 类，先按默认）：标题用接口奖品名；待选款赠品标题橙色，FREE OUTFIT 副标题 "Choose style, color & size"、SHERPA "Just pick your fit"；CHOOSE 打开 03 / 04b（转盘回正），`SELECTING` 时按钮置灰；不判断选款期限；COPY 同 04/05；日期行用 `wonAt` 美东时间；礼品卡 `balance` 为空不显示余额；顺序按接口；空状态 "No prizes waiting right now." / "Nothing used yet."；07 无底部说明但保留同高的空白底栏（列表区不跳）；加载失败显示错误 + TRY AGAIN。
- PC 06 底栏内边距按稿改为 12 / 40 / 16（原 16 / 40 / 24）。

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
- [x] Lily：抽中折扣码 / 礼品卡后会发邮件（11-10 确认），"We also emailed it to you." 保留。
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
| 3 抽奖 + 04/05 | 🟡 代码完成，本地截图 + 流程脚本验证通过，待 dev 店预览 | spin-wheel 三件套 + mock `/draw` + locales 新增 25 条 |
| 4 选款 03/04b | 🟡 代码完成，本地截图（390 / 1440）+ 流程脚本验证通过，待 dev 店用真实接口预览 | spin-wheel 三件套 + mock gift-options / gift-selection + locales 新增 39 条；size-chart 三个页面在 section 里渲染 |
| 5 My prizes | 🟡 代码完成，本地截图（390 / 1440）+ CHOOSE 流程验证通过，待 dev 店真实接口预览 | spin-wheel 三件套 + mock 06/07 数据 + locales 新增 15 条、删 `used_note` |
| 6 埋点 + 验收 | ⬜ | |

---

## 8. 会话交接记录

（每个会话结束前追加：日期、完成了什么、未完成/坑、下一步。）

- **2026-11-09**：完成需求确认、接口对齐、dev 店迁移。新设计稿和最新接口文档**尚未重新读取**——下一个会话先读这两个来源，与本文对比，有变化先报告给用户确认，再开始阶段 1。
- **2026-11-09（会话 2）**：重新读取设计稿（17:07 版）与接口文档，冲突已由用户裁定（见 2.6）。阶段 1 代码完成：`sections/campaign-gate.liquid`、`assets/campaign-gate.css/.js`、`templates/page.campaign-gate.json`，`settings_schema.json` 新增 "Spin & Win" 组（`spin_proxy_prefix`）。mock：`?spin_mock=ended` 显示 08，其他值按 ONGOING 跳登录（仅非线上主题）。**未完成**：`theme dev -e dev` 需要 dev 店店铺密码（非交互环境无法输入）→ 由用户在终端运行或确认推送到 dev 主题；dev 店已创建 `spin-and-win` 页面（`gid://shopify/Page/264698888278`，模板 campaign-gate，已发布）；用户已自行启动 `theme dev -e dev`；真机验证 return_to（含 Gmail 内置浏览器）。
  - 补充：中转页逻辑更正为先查 status，ENDED 无论是否登录都显示 08。`theme dev` 在 Windows 上会漏同步编辑过的文件，改完不生效时先查页面 HTML，再重启 theme dev。邮件链接 `/pages/spin-and-win` 可提供给 Lily（线上需建同 handle 页面 + 主题代码上线）。
- **2026-11-10**：阶段 2 代码完成（未预览）。`sections/spin-wheel.liquid`（01/02 转盘视图 + 06/07 奖品视图框架）、`assets/spin-wheel.css/.js`、`assets/spin-wheel-mock.js`、`locales/en.default.json` 新增 `spin.*`、`templates/page.black_friday.json` 末尾加 `spin_wheel`。打开接口：`[data-spin-open]`（值 `prizes` 打开 06）或 `window.mtSpin.open('wheel'|'prizes')`。mock：`?spin_mock=spins|nospin|none|error`（需已登录才会自动弹）。06 每会话一次用 sessionStorage `mt-spin-prizes-shown`。转盘为 SVG（viewBox 340×364，rotor `[data-spin-rotor]` 供阶段 3 旋转，指针在底部）。SPIN NOW 按钮（`[data-spin-draw]`）未接抽奖。06 卡片列表留给阶段 5。移动端字号按 PC 同级（设计稿移动端画板有的放大约 1.4 倍，06 尤其明显）。文案 "3 hour" 改为 "3 hours"（语法）。
- **2026-11-10（会话 2）**：按用户验证反馈返工阶段 2，**上一条里"移动端字号按 PC 同级"、"viewBox 340×364"已作废**，以 2.8 为准：移动端整体按 `--u` 严格照稿重写（01/02/06），弹窗固定高度（01 移动端例外，随内容），手动换行照稿（含 08 标题），转盘按 11-10 更新后的设计稿（334×391）。新增第 9 节测试方式。待用户在 dev 店预览确认。
- **2026-11-10（会话 2，续）**：阶段 3 代码完成：抽奖（`POST /draw`，requestId 重试复用）、转盘旋转停格（`spinTo`，按 `POSITION_SLOTS` 映射，`state.rotation` 累计，重渲染保持角度）、04/05 结果（`data-spin-state="result"`，`data-spin-result="coupon|card"`）、复制、错误处理；mock 新增 `spin_draw` 参数（见 9.4）。本地截图（390 / 1440）与流程脚本（重试、SPIN AGAIN、各错误码、GIFT→06）通过。转盘停下后格子文字随转盘一起旋转（正常转盘行为，设计稿是静态未转图）。**待**：dev 店预览、真机；Lily 确认是否发邮件。下一步阶段 4（03 / 04b 选款），先出问题清单。
- **2026-11-11**：设计稿两轮核对 + 用户逐条裁定（见 2.10）。阶段 4 代码完成：选款是转盘视图里的 `data-spin-state="gift"`，root `data-spin-gift="outfit|jacket"`；移动端占满整个视图，PC 03 整个 880 弹窗滚动（无转盘）、PC 04b 保留左侧转盘右栏滚动。`GET /prizes/{id}/gift-options` → 每件按 styleNo / 颜色名 / 尺码记录选择 → `POST /prizes/{id}/gift-selection`（requestId 重试复用），成功进 06。色卡：section 把主题设置 Custom colors 原样交给 JS，按 color-swatch.liquid 同样的优先级解析。尺码表：section 渲染 `size-chart-clothing / breezy-leggings / shoes` 三个页面的弹窗（id `spin-chart-*`），按 `sizeChart` 打开。阶段 3 的 PC "Spin again → (1 spin left)" 已改成统一的 "1 spin left · SPIN AGAIN →"（locale `again_link_*` 取代 `again_mobile_* / again_desktop / again_count_*`）。mock 新增 `spin_gift` 参数（见 9.5）。**待**：dev 店真实接口预览（Lily 说接口可调）。同日按用户反馈：03 默认选中第一个有货款式 + 颜色、礼盒在这件选完后换图、swipe 可点击（见 2.10 第四轮）。代码已提交（060277d），进入联调（测试用例见仓库根目录 `BF-spin-联调测试用例.md`）。
- **2026-11-11（续）**：阶段 5 代码完成（见 2.11）：06 / 07 卡片按两个接口分别渲染；06 CHOOSE 直接打开选款（`chooseGift`），提交成功回 06；COPY 复用 `copyCode(button, code)`。mock 补齐 06 / 07 各类卡片（9.6）。**待**：dev 店真实接口预览；`coupon.usedAt` 字段名核对。

---

## 9. 测试方式（速查）

> **在 VS Code 里按 `Ctrl+Shift+V` 打开预览**，表格才会正常显示，链接可以直接点（按住 Ctrl 点击可在浏览器打开）。下面的链接都已带上预览主题 `preview_theme_id=167518339158`。

### 9.1 通用前提

- 先运行 `shopify theme dev -e dev`；改完代码不生效时，先查页面 HTML 是否是新代码，不是就重启 theme dev（Windows 会漏同步）。
- **不要用 `http://127.0.0.1:9292` 测登录和接口**：本地登录新客户账户返回 401，App Proxy 返回 404。
- 用真实域名 + 预览主题打开：`https://moodytiger-us-dev.myshopify.com/pages/<handle>?preview_theme_id=167518339158`，或在后台「在线商店 → 主题 → BF Spin 开发 → 预览」后改地址栏路径。
- 网址里已经有 `?` 时，后面的参数用 `&` 连接，例如 `...?preview_theme_id=167518339158&spin_mock=spins`。
- `spin_mock` **只在非线上主题生效**（线上主题即使带参数也走真实接口）。
- 测"未登录"用无痕窗口；测"已登录"先在 dev 店登录一个客户账户。
- 截图对稿：手机用真机，或 Chrome 开发者工具切 390×844（iPhone 12–15）、375×667（iPhone SE）；PC 用 1440×900。

### 9.2 阶段 1：活动中转页 `/pages/spin-and-win`

| 场景 | 方法 | 预期 |
|---|---|---|
| 活动已结束 · 未登录 | 无痕窗口打开 [spin-and-win · ended](https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158&spin_mock=ended) | 显示 08 结束页，不跳转 |
| 活动已结束 · 已登录 | 登录后打开 [spin-and-win · ended](https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158&spin_mock=ended) | 同样显示 08，不跳转 |
| 进行中 · 未登录 | 无痕窗口打开 [spin-and-win · 进行中](https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158&spin_mock=1) | 跳到登录页；登录完成后回到黑五页 `/pages/black-friday2026` |
| 进行中 · 已登录 | 登录后打开 [spin-and-win · 进行中](https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158&spin_mock=1) | 直接跳到黑五页 |
| 真实接口 | 打开 [spin-and-win · 真实接口](https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158) | 按接口返回的活动状态走上面的逻辑；接口失败或 5 秒超时按"进行中"处理 |
| 08 文案 | 主题编辑器打开 spin-and-win 页面 | 编辑器里直接显示 08，可改文案、按钮文字和链接；标题换行只在手机端生效 |

### 9.3 阶段 2：黑五页转盘弹窗 `/pages/black-friday2026`

自动弹出（需已登录）：

| 场景 | 方法 | 预期 |
|---|---|---|
| 有次数 | 已登录 + [spins](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins) | 自动弹 02：3 个订单，第一单显示倒计时和 "1 spin · used / 2 spins"，按钮 SPIN NOW (2 LEFT) → |
| 0 次但有奖品 | 已登录 + [nospin](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=nospin) | 自动弹 06，tab 显示 Unused · 3 / Used · 1；刷新后不再弹，开新标签页会再弹 |
| 什么都没有 | 已登录 + [none](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=none) | 不自动弹 |
| 接口失败 | 已登录 + [error](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=error) | 不自动弹 |
| 未登录 | 无痕窗口打开 [黑五页](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158) | 不自动弹 |

手动打开（先点上表对应的链接打开页面，再在浏览器控制台 F12 → Console 输入命令）：

| 想看的弹窗 | 方法 | 预期 |
|---|---|---|
| 01 未登录 | 无痕窗口 + 控制台 `mtSpin.open()` | 显示 01；点 SIGN IN 跳登录，登录后回到黑五页；手机端弹窗高度随内容、不滚动 |
| 02 有次数 | 已登录 + `spin_mock=spins` + `mtSpin.open()` | 02 有次数状态 |
| 02 · 0 次 | 已登录 + `spin_mock=nospin` 或 `none` + `mtSpin.open()` | 02 灰按钮 NO SPINS LEFT；`nospin` 订单行显示 "N spins · used" |
| 02 加载失败 | 已登录 + `spin_mock=error` + `mtSpin.open()` | 显示 "We couldn’t load your spins…" |
| 06 My prizes | 已登录 + `spin_mock=nospin` + `mtSpin.open('prizes')` | 06（卡片列表阶段 5 才有，现在只有标题、tab 和底部说明） |
| 06 带 "spin left" 横幅 | 已登录 + `spin_mock=spins` + `mtSpin.open('prizes')` | 06 顶部出现 "You have 2 spins left · SPIN AGAIN →"，点击回到 02 |
| 视图切换 | 02 点 "My prizes ›"；06 点 "SPIN AGAIN →" | 两边来回切，弹窗高度不变 |
| 关闭 | ×、点遮罩、按 Esc；或控制台 `mtSpin.close()` | 弹窗关闭 |

其他：
- 想让 06 再自动弹一次：开新标签页，或在开发者工具 Application → Session Storage 删除 `mt-spin-prizes-shown`。
- 页面上任何带 `data-spin-open` 属性的元素点击后也会打开（值为 `prizes` 时打开 06），入口 section 做完后用它测。

### 9.4 阶段 3：抽奖与中奖弹窗 04 / 05

都需要**已登录**。在黑五页地址后加 `spin_mock=spins&spin_draw=…`，02 自动弹出后点 SPIN NOW（mock 有 2 次机会，抽完第 2 次后 SPIN AGAIN 不再显示）。

| 想看的 | 链接 | 预期 |
|---|---|---|
| 04 · 10% OFF | [coupon10](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=coupon10) | 转 4 秒停在 10% 格（指针在底部），0.6 秒后出 04；券面 "by Dec 31" |
| 04 · 15% OFF | [coupon15](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=coupon15) | 停在 15% 格，出 04 |
| 05 · $25 礼品卡 | [giftcard25](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=giftcard25) | 停在 $25 格，出 05，卡面完整卡号，"Sent to e***@gmail.com" |
| 05 · $50 礼品卡 | [giftcard50](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=giftcard50) | 停在 $50 格，出 05 |
| 抽中 FREE OUTFIT | [gift](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift) | 停在 FREE OUTFIT 格，0.6 秒后进 03（见 9.5） |
| 抽中 SHERPA JACKET | [grand](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=grand) | 停在 SHERPA JACKET 格，0.6 秒后进 04b（见 9.5） |
| 系统繁忙后重试 | [busy](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=busy) | 第一次：按钮下出现错误提示，按钮变 TRY AGAIN；再点：正常抽中 10% |
| 没有可用次数 | [nospins](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=nospins) | 提示 "Spend $150 on one order to earn a spin." |
| 活动已结束 | [ended](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=ended) | 提示 "Spin & Win has ended. Thanks for playing with us." |
| 登录失效 | [login](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=login) | 切到 01 SIGN IN |

结果页上要点的：

| 操作 | 预期 |
|---|---|
| COPY CODE | 按钮变 COPIED 2 秒，剪贴板里是券码 / 完整卡号 |
| SHOP NOW | 弹窗关闭，留在黑五页 |
| 1 spin left · SPIN AGAIN →（手机、PC 统一，11-11） | 回到 02，次数减 1；次数为 0 时不显示这个链接 |
| My prizes › | 进 06 |
| 转动中点 × 关闭 | 弹窗关闭；再打开显示 02（次数已减 1） |

### 9.5 阶段 4：选款 03 FREE OUTFIT / 04b SHERPA JACKET

都需要**已登录**。地址后加 `spin_mock=spins&spin_draw=gift`（03）或 `spin_draw=grand`（04b），点 SPIN NOW 抽中后自动进入选款。mock 有 18 款：第 5 款（Shorts）全部售罄（缩略图 SOLD OUT 蒙层）；第 2 款（Jacket）的 Leopard Pink 整个颜色售罄（圆点不变、尺码全灰）；尺码 7、12 一般是售罄。夹克价值 mock 为 $89。

| 想看的 | 链接 | 预期 |
|---|---|---|
| 03 正常提交 | [gift](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift) | 首屏两张问号礼盒卡；两件默认选中第一款 + 第一个颜色，尺码不选；某件选好尺码后它的礼盒换成商品图；两件都选完按钮变黑、出现退货条款（金额 = 两款 value 相加）；CONFIRM 后进 06 |
| 04b 正常提交 | [grand](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=grand) | 颜色默认第一个有货的、尺码不选；PC 右栏底部浮着 "Scroll to choose color & size"，一滚动就消失；选尺码后出现退货条款（$89）；CONFIRM 后进 06 |
| 尺码刚被选走 | [taken](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=taken) | 选完两件点 CONFIRM：选项刷新，最后一件的尺码变灰并清空，按钮下提示 "That size was just claimed…"，页面滚到那一件的尺码 |
| 已经选过 | [selected](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=selected) | CONFIRM 后直接进 06，不提示 |
| 超过选款期限 | [deadline](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=deadline) | 按钮下提示联系 order@moodytiger.com（可点的邮件链接） |
| 件数不对 | [invalid](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=invalid) | 按钮下提示 "Something didn’t line up…" |
| 网络繁忙后重试 | [busy](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=busy) | 第一次 CONFIRM 提示 "That didn’t go through…"；再点 CONFIRM 成功进 06 |
| 选项加载失败 | [loadfail](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=spins&spin_draw=gift&spin_gift=loadfail) | 选择区显示 "We couldn’t load the styles…" + TRY AGAIN；点了正常加载 |

页面上要点的：

| 操作 | 预期 |
|---|---|
| Choose（手机每张卡一个 / PC 一个）、Scroll to choose | 平滑滚到对应礼物的选择区 |
| 18 styles · swipe › | 款式条往右翻约一屏，到底后回到开头 |
| 置灰按钮下的提示 | 只提示第一个没完成的步骤；两件卡在同一步时合并成一句（如 "Choose a size for both gifts to continue"） |
| 换款式 | 自动选第一个有货的颜色；已选尺码在新款式这个颜色下有货就保留，否则清空 |
| 换颜色 | 该颜色下没有已选尺码的货就清空尺码 |
| Size guide › | 打开对应尺码表（legging → 打底裤表，其余/缺省 → 服装表），叠在转盘弹窗上；Esc 只关尺码表 |
| 1 spin left · SPIN AGAIN → | 回到 02 |
| My prizes › | 进 06（奖品仍是待选状态） |

### 9.6 阶段 5：My prizes 06 / 07

都需要**已登录**。mock：[nospin](https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158&spin_mock=nospin)（0 次机会，同一会话自动弹 06 一次；再看要新开会话或手动打开 `data-spin-open="prizes"`）。mock 的 Unused 有 15% 折扣码、FREE OUTFIT 待选、SHERPA JACKET 待选、$25 礼品卡；Used 有已兑换的 FREE OUTFIT（2 件）、已用 10% 折扣码（带使用日期）、已用 $50 礼品卡。

| 操作 | 预期 |
|---|---|
| 06 卡片 | 左侧橙色竖条；日期 · 订单号 / 标题 / 说明；折扣码、礼品卡右侧 COPY，赠品右侧橙色 CHOOSE |
| COPY | 变 COPIED 2 秒，复制完整券码 / 卡号 |
| CHOOSE（FREE OUTFIT / SHERPA） | 进 03 / 04b 选款（PC 04b 左侧转盘是正的）；提交后回到 06，列表刷新 |
| 切到 Used | 只换按钮颜色，标题不跳；07 卡片左侧米色竖条、标题灰绿；赠品 "· Redeemed" + 每件一行；折扣码 / 礼品卡右侧 "Used" |
| 某个 tab 为空 | "No prizes waiting right now." / "Nothing used yet." |
| 接口失败 | "We couldn’t load your spins…" + TRY AGAIN |

真实接口：Unused / Used 的数量和卡片内容应与 `/prizes?tab=unused|used` 返回一一对应。

### 9.7 后续阶段

阶段 6（埋点）完成后在这里追加测试表。
