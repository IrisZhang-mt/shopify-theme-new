# 黑五 Spin & Win 联调测试用例（给浏览器操作 Agent 执行）

> 读者：能操作用户浏览器的 Claude Agent。请**按顺序**执行，每个用例按"操作 → 检查 → 记录"走完再进下一个。
> 遇到本文没写到的情况、或任何"⚠️ 先问用户"的步骤，**停下来问用户**，不要自行决定。

---

## 0. 规则（必须遵守）

1. **只在 dev 店测试**：域名必须是 `moodytiger-us-dev.myshopify.com`。如果地址栏是 `moodytiger.com` 或别的域名，立即停止。
2. **店铺密码 / 登录**：如果页面跳到 `/password`（店铺密码页）或客户登录页，**停下来请用户自己输入**，不要猜密码、不要读取或记录密码。
3. **会产生真实数据的操作，执行前必须先问用户**（标了 ⚠️ 的步骤）：
   - 点 SPIN NOW / TRY AGAIN（每次消耗 1 次抽奖机会，奖品真实生成）
   - 点 CONFIRM MY 2 GIFTS / CONFIRM MY JACKET（真实创建赠品订单，提交后不能改）
4. **不要在控制台调用 POST 接口**（`/draw`、`/gift-selection`）。这两个只能通过页面按钮触发，否则测不到前端。控制台只允许本文给出的 GET 请求和检查脚本。
5. **隐私**：报告里的券码、礼品卡号、邮箱一律打码（用第 2 节的 `mask` 函数输出），不要截图完整卡号 / 券码发出去。
6. 不修改店铺后台、主题设置，不下单、不付款。

---

## 0.5 测试前准备（用户完成，Agent 开始前先向用户确认）

1. 用户已在测试账号下单拿到抽奖机会（每满 $150 得 1 次，单笔最多 5 次）。
2. **3 小时规则**：订单付款 3 小时内抽才可能抽中全部奖品，超过 3 小时只会出折扣码。要测 FREE OUTFIT / SHERPA JACKET / 礼品卡，必须在下单后 3 小时内完成，或请 Lily 在 dev 环境临时放宽。
3. 用户和 Lily 约定好每一次抽奖的结果，填在下表。**Agent 每次点 SPIN NOW 前，对照下表告诉用户"这是第 N 次，预期抽中 X"，得到确认再点**；实际结果和预期不一致时记为"失败"并附 `mask(__spinLog)`。

| 第几次 | 预期抽中（slot） | 对应用例 |
|---|---|---|
| 1 | 10% OFF（0）或 15% OFF（1） | T3 折扣券 |
| 2 | $25（2）或 $50（3）GIFT CARD | T3 礼品卡 |
| 3 | FREE OUTFIT（4） | T4 选款 03（会真实建赠品单） |
| 4 | SHERPA JACKET（5） | T4 选款 04b（会真实建赠品单） |
| 5+ | 留给 T5 错误码（需 Lily 配合） | T5 |

至少需要 4 次机会（不含 T5）。顺序可以按用户和 Lily 的约定调整。

---

## 1. 测试地址

| 页面 | 地址 |
|---|---|
| 黑五落地页（转盘弹窗在这里） | `https://moodytiger-us-dev.myshopify.com/pages/black-friday2026?preview_theme_id=167518339158` |
| 活动中转页 | `https://moodytiger-us-dev.myshopify.com/pages/spin-and-win?preview_theme_id=167518339158` |

（主题未发布，**必须带 `preview_theme_id=167518339158`**，否则看到的是店铺当前发布的主题。跳转到别的页面后如果地址里没有这个参数，手动加回去。）

---

## 2. 控制台工具脚本（每次刷新页面后重新粘贴一次）

在黑五落地页按 F12 → Console，粘贴运行：

```js
// ---- spin 联调工具 ----
window.spinApi = (p) => fetch('/apps/bf/spin' + p, { headers: { Accept: 'application/json' } }).then((r) => r.json());
window.mask = (o) =>
  JSON.parse(
    JSON.stringify(o, (k, v) =>
      typeof v === 'string' && /^(code|sentTo|email|last4)$/i.test(k) && v.length > 4 ? v.slice(0, 3) + '***' + v.slice(-2) : v,
    ),
  );
// 记录之后页面发出的所有 /apps/bf/spin 请求（刷新后失效）
window.__spinLog = [];
if (!window.__spinFetchWrapped) {
  window.__spinFetchWrapped = true;
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const res = await orig(...args);
    const url = String(args[0]);
    if (url.includes('/apps/bf/spin')) {
      res.clone().json().then((j) => window.__spinLog.push({ url: url.replace(location.origin, ''), method: args[1]?.method || 'GET', body: args[1]?.body ? JSON.parse(args[1].body) : null, code: j.code, data: j.data })).catch(() => window.__spinLog.push({ url, error: 'not json' }));
    }
    return res;
  };
}
// 弹窗当前状态
window.spinState = () => {
  const r = document.querySelector('[data-spin]');
  const q = (s) => document.querySelector(s);
  return {
    open: r?.classList.contains('mt-spin--open'),
    view: r?.dataset.spinCurrent, // wheel | prizes
    state: r?.dataset.spinState, // guest | player | result | gift | error
    result: r?.dataset.spinResult, // coupon | card
    gift: r?.dataset.spinGift, // outfit | jacket
    busy: r?.hasAttribute('data-spin-busy'),
    rotor: q('[data-spin-rotor]')?.style.transform,
    drawBtn: q('[data-spin-draw]')?.textContent.trim(),
    drawError: q('[data-spin-draw-error]')?.hidden ? null : q('[data-spin-draw-error]')?.textContent,
    giftMsg: q('[data-gift-msg]')?.hidden ? null : q('[data-gift-msg]')?.textContent,
    confirmDisabled: q('[data-gift-confirm]')?.disabled,
  };
};
'spin tools ready';
```

常用：
- `spinState()` —— 看弹窗处于哪个状态
- `mask(await spinApi('/status'))` —— 看接口返回（已打码）
- `mask(__spinLog)` —— 看粘贴脚本之后页面发出的请求和返回

---

## 3. 用例

记录格式（每个用例一行，最后汇总成表格交给用户）：

`用例编号 | 结果（通过 / 失败 / 跳过） | 实际看到的 | 相关请求的 code | 截图文件名`

### T0 环境检查

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T0.1 | 打开黑五落地页 | 域名是 `moodytiger-us-dev.myshopify.com`，页面正常显示（不是密码页） |
| T0.2 | 控制台运行 `!!document.querySelector('[data-spin][data-logged-in]')` | `true`（已登录）。是 `false` → 停下请用户登录 |
| T0.3 | 运行 `!!document.querySelector('[data-spin-state="gift"]')` | `true`（说明主题是含选款功能的最新代码）。`false` → 停下告诉用户"dev 主题不是最新代码" |
| T0.4 | 粘贴第 2 节脚本，运行 `mask(await spinApi('/status'))` | 返回 `code: 0`。记录 `data.activity.status`、`data.spinsLeft`、`data.spinThreshold`、`data.spinGroups.length`、`data.slots` |
| T0.5 | 运行 `mask(await spinApi('/prizes?tab=unused'))` 和 `mask(await spinApi('/prizes?tab=used'))` | 都返回 `code: 0`，记录两边 `items.length` |
| T0.6 | 看控制台有没有红色报错 | 记录所有含 `spin` 的报错（没有就写"无"） |

> 如果 `activity.status` 不是 `ONGOING`，后面抽奖会失败（40900 未开始 / 40901 已结束）。告诉用户，问是否继续。

### T1 02 已登录转盘弹窗（自动弹出）

前提：T0.4 里 `spinsLeft > 0`。如果是 0，跳到 T2。

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T1.1 | 刷新落地页，等 3 秒，运行 `spinState()` | `open: true, view: 'wheel', state: 'player'` |
| T1.2 | 看弹窗 | 显示 "You have N spin(s) left"，N = `status.spinsLeft`；按钮文字 "SPIN NOW (N LEFT) →" |
| T1.3 | 看订单列表 | 行数 = `status.spinGroups.length`；每行 "Order #xxx · $金额" 与接口 `orderName` / `orderAmount` 一致；付款 3 小时内且还有次数的订单显示 "Use within hh:mm:ss" 倒计时并每秒变化 |
| T1.4 | 看底部 | "Each spin expires 3 hours after it is added." 换行 "Spend $X on one order to earn a spin."，$X = `spinThreshold` |
| T1.5 | 看转盘 | 6 格，顺时针从 12 点开始：10% OFF → 15% OFF → FREE OUTFIT → $25 GIFT CARD → $50 GIFT CARD → SHERPA JACKET；指针在底部 |
| T1.6 | 截图（PC 宽度） | 存为 `T1-02.png` |

### T2 06 My prizes 自动弹出（只在没有抽奖机会时）

前提：`spinsLeft = 0` 且 unused `items.length > 0`。不满足就跳过。

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T2.1 | 新开一个标签页打开落地页（同一会话只自动弹一次） | 自动弹出 "My prizes"，`spinState().view === 'prizes'` |
| T2.2 | 看两个 tab | "Unused · N" / "Used · M"，N、M 与 T0.5 一致；点 Used 只切换按钮颜色，标题不跳动 |
| T2.3 | 看 Unused 卡片 | 卡片数 = unused `items.length`，顺序同接口；每张：日期 · 订单号（`wonAt` 美东日期 + `orderName`）、标题（折扣 "10% OFF"、礼品卡 "$25 GIFT CARD"、赠品用接口 `name`）；折扣码："Code xxx" + "Use within 1 month · until Mon DD"；礼品卡："Code xxx" + "No expiry date · Balance $xx.xx"（`balance` 为空时没有 Balance）；待选赠品：橙色标题 + CHOOSE（`status: SELECTING` 时按钮置灰） |
| T2.4 | 点折扣码 / 礼品卡的 COPY | 变 COPIED 约 2 秒 |
| T2.5 | 切到 Used | 卡片数 = used `items.length`；已选赠品显示 "名称 · Redeemed" + 每件 "款名 / 颜色 · Size x / Ships with your order #orderName"；已用折扣码右侧 "Used"，有使用日期时显示 "Code xxx · Used Mon DD"。**记录 used 折扣码在接口里的使用日期字段名**（前端读的是 `coupon.usedAt`，不一样要告诉用户） |
| T2.6 | 某个 tab 没有奖品 | 显示 "No prizes waiting right now." / "Nothing used yet." |

### T3 抽奖（⚠️ 每次都先问用户）

前提：`spinsLeft > 0`。**执行前对照 0.5 节的表问用户："现在有 N 次机会，这是第 X 次，预期抽中 Y，可以点吗？"**

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T3.1 | 粘贴第 2 节脚本（重置记录），弹窗停在 02 | — |
| T3.2 | ⚠️ 用户同意后点 SPIN NOW | 按钮立即不可再点；转盘顺时针转约 4 秒，至少 5 圈 |
| T3.3 | 停下后运行 `mask(__spinLog)` | 有一条 `POST /apps/bf/spin/draw`，`body.requestId` 是 UUID 格式，`code: 0`；记录 `data.slot`、`data.prize.type`、`data.prize.name`、`data.spinsLeft` |
| T3.4 | 看指针（底部三角）指着的格子 | 和 `data.slot` 对应的格子一致：slot 0=10%、1=15%、2=$25、3=$50、4=FREE OUTFIT、5=SHERPA JACKET |
| T3.5 | 停下约 0.6 秒后出结果，运行 `spinState()` | COUPON → `state: 'result', result: 'coupon'`；GIFT_CARD → `result: 'card'`；GIFT → `state: 'gift', gift: 'outfit'`；GRAND → `state: 'gift', gift: 'jacket'`（后两种接 T4） |
| T3.6 | 折扣券结果（04） | 标题 "10% OFF" / "15% OFF"；券码 = `prize.coupon.code`；"One-time use · Use within 1 month (by Mon DD)"，日期 = `coupon.expiresAt` 换算成美东时间的月/日；底部条款里的日期一致 |
| T3.7 | 礼品卡结果（05） | 标题 "A $25 gift card"；卡面金额白色、完整卡号 = `prize.giftCard.code`；有 `sentTo` 时显示 "Sent to …"，没有就不显示；条款里订单号 = `prize.orderName` |
| T3.8 | 点 COPY CODE | 按钮变 "COPIED" 约 2 秒后恢复；（可选）运行 `navigator.clipboard.readText().then(t=>t.slice(0,3)+'***')` 确认已复制 |
| T3.9 | 看 "N spin(s) left · SPIN AGAIN →" | N = `data.spinsLeft`；`spinsLeft = 0` 时这一行不显示 |
| T3.10 | 点 "My prizes ›" | 进 06；Unused 数量比 T0.5 多 1 |
| T3.11 | 关掉弹窗再从 06 点 "Spin again →"（如有次数） | 回到 02，转盘回正，次数已减 1 |
| T3.12 | 截图 | `T3-result.png`（券码 / 卡号打码或裁掉） |

### T4 选款 03 / 04b（⚠️ 提交前必须问用户）

前提：T3 抽中 FREE OUTFIT 或 SHERPA JACKET（通常需要 Lily 在后端指定）。如果中途关掉了选款界面，奖品会留在 My prizes 的 Unused 里，点它的 CHOOSE 可以回到选款（顺便验证 06 → CHOOSE 入口：PC 04b 左侧转盘是正的）。

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T4.1 | 进入选款后运行 `mask(__spinLog)` | 有 `GET /apps/bf/spin/prizes/{prizeId}/gift-options`，`code: 0`；`{prizeId}` = draw 返回的 `prize.prizeId` |
| T4.2 | 03 首屏 | "YOU WON / FREE OUTFIT"；"Pick 2 of N · ships with your BF order #xxx"，N = `styles.length`，订单号 = `prize.orderName`；两张 GIFT 1 / GIFT 2 问号礼盒卡 |
| T4.3 | 04b 首屏 | "YOU WON / SHERPA JACKET"；"Free · ships with your BF order #xxx"；YOUR PRIZE 卡片有夹克图；PC 宽度下右栏底部浮着 "Scroll to choose color & size"，滚动一下就消失 |
| T4.4 | 默认选中 | 03：两件都已选中第一个有货的款式 + 第一个有货的颜色，尺码都没选；04b：颜色选中第一个有货的，尺码没选 |
| T4.5 | 按钮状态 | CONFIRM 灰色不可点；下方提示 03 "Choose a size for both gifts to continue" / 04b "Choose a size to continue" |
| T4.6 | 款式条（03） | 款式数量 = `styles.length`；每个缩略图下方文字 = `category`；**所有颜色所有尺码 `available` 都是 false 的款式**显示 SOLD OUT 蒙层且点不动；点 "N styles · swipe ›" 款式条向右翻页，到底后回到开头 |
| T4.7 | 颜色 | 圆点颜色看起来是真实颜色。**记录所有显示成米白色 / 空白的颜色名**（说明主题设置 Custom colors 或 Files 里缺这个颜色的色卡，要交给运营补） |
| T4.8 | 尺码 | `available: false` 的尺码灰色带斜线、点不动；某个颜色所有尺码都 false 时，该颜色圆点照常可点，尺码全灰 |
| T4.9 | 换款式（03） | 先给 Gift 1 选一个尺码，再换另一个款式：颜色自动跳到新款式第一个有货的颜色；如果新款式这个颜色下这个尺码有货，尺码保持选中，否则清空 |
| T4.10 | Size guide › | 打开尺码表弹窗，盖在转盘弹窗上面；按 Esc 只关尺码表，转盘弹窗还在；`sizeChart` 为 `legging` 时是打底裤尺码表，其余是服装尺码表 |
| T4.11 | 提示随选择变化 | 03 只给 Gift 1 选尺码 → 提示 "Choose a size for Gift 2 to continue"；两件都选完 → 提示消失，按钮变黑 |
| T4.12 | 选完后 | 03：每件选完尺码后，顶部对应的礼盒换成该款主图；底部出现 "If you return that order, please return the gift set too, or its value ($X) may be deducted from your refund."，$X = 两款 `value` 相加（04b 是夹克 `value`）；没选完时这句不显示 |
| T4.13 | Choose / Scroll to choose（03） | 平滑滚到选择区（手机两个 Choose 分别到 Gift 1 / Gift 2） |
| T4.14 | 截图 | `T4-first.png`（首屏）、`T4-picked.png`（选完的状态） |
| T4.15 | ⚠️ 问用户："赠品选的是 A（款/色/码）和 B（款/色/码），确认提交吗？提交后不能改。" 用户同意后点 CONFIRM | 按钮点一次后不可重复点；`mask(__spinLog)` 里有 `POST /prizes/{prizeId}/gift-selection`，`body.skus` 是所选尺码的 `sku`（03 两个、04b 一个），`body.requestId` 是 UUID，`code: 0` |
| T4.16 | 提交成功后 | 自动进入 06；运行 `mask(await spinApi('/prizes?tab=used'))`，能看到这个奖品 `status: 'SELECTED'`，有 `giftOrderName` |
| T4.17 | 请用户告诉 Lily `giftOrderName`，确认后台赠品单的 SKU 与所选一致 | 用户确认即通过 |

### T5 错误码（需要 Lily 配合，逐条问用户是否已准备好）

这些情况无法从页面正常制造，需要 Lily 在后端临时让接口返回指定错误码。每条先问用户"Lily 是否已设置好返回 XXXXX？"。

| 编号 | 场景 | 操作 | 通过标准 |
|---|---|---|---|
| T5.1 | 抽奖 50300 / 42900 / 断网 | 点 SPIN NOW | 按钮下出现 "That spin didn’t go through. Please try again."，按钮变 TRY AGAIN；再点时 `__spinLog` 里两次 draw 的 `requestId` **相同** |
| T5.2 | 抽奖 40902 | 点 SPIN NOW | 提示 "Spend $X on one order to earn a spin."，次数刷新 |
| T5.3 | 抽奖 40901 | 点 SPIN NOW | 提示 "Spin & Win has ended. Thanks for playing with us." |
| T5.4 | 抽奖 40900 | 点 SPIN NOW | 提示 "Spin & Win opens Mon DD. See you then." |
| T5.5 | 选款 40910 | 点 CONFIRM | 重新请求 gift-options；被抢走的尺码变灰并清空；提示 "That size was just claimed. Please pick another."；页面滚到那一件的尺码 |
| T5.6 | 选款 40911 | 点 CONFIRM | 直接进 06，不提示 |
| T5.7 | 选款 40912 | 点 CONFIRM | 提示 "The time to choose has passed. We’re happy to help — contact us at order@moodytiger.com."，邮箱是可点的 mailto 链接 |
| T5.8 | 选款 40913 | 点 CONFIRM | 提示 "Something didn’t line up. Please check your picks and try again." |
| T5.9 | 选款 50300 / 断网 | 点 CONFIRM | 提示 "That didn’t go through. Please try again."；再点时两次 gift-selection 的 `requestId` **相同** |

### T6 活动中转页

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T6.1 | 已登录状态打开中转页 | 直接跳到黑五落地页 |
| T6.2 | （可选，需用户在无痕窗口操作）未登录打开中转页 | 跳到登录页；登录后回到黑五落地页 |

### T7 手机宽度（可选）

如果能把浏览器窗口调到约 390px 宽（或用 DevTools 设备模式 iPhone 12/13）：重复 T1.1–T1.5、T3.5–T3.7、T4.2–T4.12 的**显示检查**（不要再消耗抽奖次数，可以停在已有的结果 / 选款界面上切换宽度），每个截图加 `-m` 后缀。重点看：文字有没有溢出、按钮是否完整、弹窗内能否滚动到底。

### T8 GA4 埋点（和 T1–T6 同时做，不额外消耗抽奖次数）

页面刷新后先在控制台运行一次下面的脚本，之后每做完一步运行 `spinGa()` 看新增的事件：

```js
window.spinGa = () => (window.dataLayer || []).filter((e) => e.event === 'ga4Event' && /^spin_/.test(e.event_name)).map((e) => [e.event_name, JSON.stringify(e.event_parameters)]);
```

| 时机 | 应出现的事件（参数要点） |
|---|---|
| 进落地页自动弹出 | `spin_popup_view`（popup_name `spin` 或 `my_prizes`，trigger `auto`，login_status `logged_in`） |
| 点 SPIN NOW | `spin_click`（button_name = 按钮文字，spins_left = 点击前次数）→ `spin_result`（prize_type / prize_name 与结果页一致，spins_left 减 1） |
| 04 / 05 点 COPY CODE / SHOP NOW | `spin_copy_code`（module_name `result`）/ `spin_shop_now`；**参数里不能出现券码或卡号** |
| 点 SPIN AGAIN | `spin_again`（结果页 `result` / 选款页 `gift` / 06 `my_prizes`）+ `spin_popup_view`（trigger `in_popup`） |
| 06 点 Unused / Used、COPY、CHOOSE | `spin_prizes_tab`（button_name 不含数量）、`spin_copy_code`（`my_prizes`）、`spin_gift_choose` |
| 选款提交成功 | `spin_gift_confirm`（items 里每件的 item_id = 所选 SKU、item_variant = 颜色_尺码）+ `spin_popup_view`（`my_prizes`） |
| 任意失败（T5） | `spin_error`（action `draw` / `gift_confirm`，error_code = 接口错误码） |

另外检查：`dataLayer` 里每条 `ga4Event` 前面都有一条 `{ event_parameters: null }`。

---

## 4. 交付给用户的报告

1. 汇总表：`用例编号 | 结果 | 实际看到的 | code | 截图`
2. 失败用例：附上对应的 `mask(__spinLog)` 输出（只贴相关的那几条）和截图
3. T4.7 显示成米白的颜色名清单
4. 本次消耗的抽奖次数、提交的赠品（款/色/码）、`giftOrderName`
5. 控制台里含 `spin` 的报错
6. T8 每一步 `spinGa()` 的输出（券码 / 卡号如出现在参数里，立即标为失败）
