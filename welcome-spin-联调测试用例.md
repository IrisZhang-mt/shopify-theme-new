# 新客邮箱转盘（Welcome Spin）联调测试用例（给浏览器操作 Agent 执行）

> 读者：能操作用户 Chrome 浏览器的 Claude Agent。请**按顺序**执行，每个用例按"操作 → 检查 → 记录"走完再进下一个。
> 遇到本文没写到的情况、标了 ⚠️ 的步骤、或标了 🛑【需后端】的步骤，**停下来问用户**，不要自行决定。
> 更新：2026-11-16

---

## 0. 规则（必须遵守）

1. **只在 dev 店测试**：域名必须是 `moodytiger-us-dev.myshopify.com`。地址栏是 `moodytiger.com` 或别的域名时立即停止。
2. **店铺密码 / 登录**：页面跳到 `/password`（店铺密码页）或登录页时，**停下来请用户自己输入**。不要猜密码，也不要读取或记录密码。
3. **每次成功抽奖都会产生真实数据**：后端会用这个邮箱建 Shopify 客户、订阅营销邮件、写入 Omnisend、发中奖邮件，**同一个邮箱只能成功抽一次**。所以：
   - ⚠️ 每次点 **Spin the wheel** 前，先告诉用户"第 N 次抽奖，用邮箱 X，预期抽中 Y"，用户确认后再点。
   - 只用用户在 0.5 节给的测试邮箱，不要自己编邮箱。
4. **不要在控制台调用 POST 抽奖接口**（`.../draws`），只能通过页面按钮触发，否则测不到前端。控制台只允许运行本文给出的 GET 请求和检查脚本。
5. **不下单、不付款**：最多进到结账页看折扣有没有生效，不要填地址、不要点支付。
6. **隐私**：报告里的邮箱一律打码（用第 2 节的 `mask` 函数）。
7. 不修改店铺后台和主题设置，也不改代码。

---

## 0.5 测试前准备（Agent 开始前先向用户确认）

1. **当前是测试模式**：主题里临时打开了"每次打开网站都弹"的开关（正式规则是进入页面 8 秒后弹、同一浏览器 3 天内只弹一次）。所以本轮**每次刷新页面都会立刻弹出**，这是预期行为，不是 bug。8 秒和 3 天的规则放到 T9，等开关关闭后再测。
2. **必须是未登录状态**：已登录的客户不会弹窗。建议用无痕窗口（需要再输一次店铺密码）。
3. **测试邮箱**：请用户提供一批**从没在 dev 店订阅过**的邮箱，每次成功抽奖用一个，用户要能收到邮件以便检查中奖邮件（比如用 `名字+ws01@公司域名` 这种 + 号别名）。另外再要 **1 个已经订阅过营销邮件的邮箱**，用来测"已是会员"。
4. **奖品要后端配合**：抽中哪个奖由后端按概率决定，前端控制不了。要测特定奖品（尤其是礼品和大奖），用户需要先请后端临时调概率。Agent 按下表逐次问用户：

| 第几次 | 用例 | 预期抽中 | 是否需要后端调概率 |
|---|---|---|---|
| 1 | T3 折扣类 | 8% / 10% / $5 任一 | 否（默认概率大概率出折扣） |
| 2 | T3 免运费 | Free shipping | 🛑 建议调 |
| 3 | T4 礼品 | Free gift | 🛑 需要 |
| 4 | T5 大奖 | Grand prize | 🛑 需要 |
| 5+ | T6 错误码 | — | 🛑 部分需要 |

顺序可以按用户和后端的约定调整；实际结果和预期不一致时记为"失败"，附上 `mask(__wsLog)`。

---

## 1. 测试地址

| 页面 | 地址 |
|---|---|
| 首页（任意页面都会弹） | `https://moodytiger-us-dev.myshopify.com/?preview_theme_id=167699677270` |
| 商品列表页（换个页面再测一次） | `https://moodytiger-us-dev.myshopify.com/collections/all?preview_theme_id=167699677270` |

主题未发布，**必须带 `preview_theme_id=167699677270`**，否则看到的是店铺当前发布的主题。跳转到别的页面后，如果地址里没有这个参数，手动加回去。

---

## 2. 控制台工具脚本（每次刷新页面后重新粘贴一次）

按 F12 → Console，粘贴运行：

```js
// ---- welcome spin 联调工具 ----
window.wsRoot = () => document.querySelector('[data-ws]');
window.wsApi = (p) => fetch(wsRoot().dataset.prefix + p, { headers: { Accept: 'application/json' } }).then((r) => r.json());
window.mask = (o) =>
  JSON.parse(
    JSON.stringify(o, (k, v) => (typeof v === 'string' && /^email$/i.test(k) && v.length > 4 ? v.slice(0, 3) + '***' + v.slice(v.indexOf('@')) : v)),
  );
// 记录之后页面发出的接口请求和购物车请求（刷新后失效）
window.__wsLog = [];
if (!window.__wsFetchWrapped) {
  window.__wsFetchWrapped = true;
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const res = await orig(...args);
    const url = String(args[0] instanceof Request ? args[0].url : args[0]);
    const watch = url.includes('/welcome-spin/') || /\/cart\/(add|update)\.js|\/cart\.js/.test(url) || /\/products\/[^/]+\.js/.test(url);
    if (watch) {
      const entry = { url: url.replace(location.origin, ''), method: args[1]?.method || 'GET', body: args[1]?.body ? JSON.parse(args[1].body) : null, status: res.status };
      res.clone().json().then((j) => { entry.code = j.code; entry.data = j.data ?? (j.items ? { items: j.items.length, discount_codes: j.discount_codes } : j); window.__wsLog.push(entry); }).catch(() => { entry.error = 'not json'; window.__wsLog.push(entry); });
    }
    return res;
  };
}
// 弹窗当前状态
window.wsState = () => {
  const r = wsRoot();
  if (!r) return { rendered: false };
  const q = (s) => r.querySelector(s);
  const vis = (s) => { const el = q(s); return el && !el.hidden && el.offsetParent !== null ? el.textContent.trim() : null; };
  return {
    rendered: true,
    open: !r.hidden && r.classList.contains('mt-ws--open'),
    state: r.dataset.wsState, // form | result | member
    prize: r.dataset.wsPrize || null, // coupon | gift | grand
    busy: r.hasAttribute('data-ws-busy'),
    prefix: r.dataset.prefix,
    activity: r.dataset.activity,
    rotor: q('.mt-ws__rotor')?.style.transform,
    eyebrow: q('[data-ws-eyebrow]')?.textContent.trim(),
    title: [...(q('[data-ws-title]')?.children || [])].map((s) => `${s.className.replace('mt-ws__title-', '')}: ${s.textContent}`),
    text: q('[data-ws-text]')?.textContent.trim(),
    emailError: vis('[data-ws-email-error]'),
    consentError: vis('[data-ws-consent-error]'),
    submit: q('[data-ws-submit]')?.textContent.trim(),
    hub: vis('.mt-ws__hub-won') ? q('.mt-ws__hub-won').innerText.replace(/\n+/g, ' / ') : vis('.mt-ws__hub-idle'),
    code: vis('[data-ws-code]'),
    shopHref: q('[data-ws-shop]')?.hidden ? null : q('[data-ws-shop]')?.getAttribute('href'),
    addBtn: vis('[data-ws-add]'),
    giftName: vis('[data-ws-gift-name]'),
    giftNote: vis('[data-ws-gift-note]'),
    fine: vis('[data-ws-fine]'),
  };
};
// 指针现在指着哪一格（按活动接口的格子和面积计算，和前端算法一致）
window.wsPointerSlot = async () => {
  const m = (wsRoot().querySelector('.mt-ws__rotor')?.style.transform || '').match(/-?[\d.]+/);
  const deg = m ? Number(m[0]) : 0;
  const { data } = await wsApi('/activities/' + encodeURIComponent(wsRoot().dataset.activity));
  const s = [...data.prizes].sort((a, b) => a.slot - b.slot);
  const w = s.map((x) => Number(x.sectorWeight ?? x.extra?.sectorWeight));
  const ok = w.every((v) => v > 0);
  const tot = ok ? w.reduce((a, b) => a + b, 0) : s.length;
  let a = -((ok ? w[0] : 1) / tot) * 180;
  const at = (((-deg) % 360) + 360) % 360;
  for (let i = 0; i < s.length; i++) {
    const span = ((ok ? w[i] : 1) / tot) * 360;
    if (((((at - a) % 360) + 360) % 360) < span) return { slot: s[i].slot, title: s[i].title, rotation: deg };
    a += span;
  }
};
// GA4 事件
window.wsGa = () => (window.dataLayer || []).filter((e) => e.event === 'ga4Event' && /^welcome_spin_/.test(e.event_name)).map((e) => [e.event_name, JSON.stringify(e.event_parameters)]);
'welcome spin tools ready';
```

常用命令：
- `wsState()`：弹窗当前处于哪个状态、显示了什么
- `mask(await wsApi('/activities/' + wsRoot().dataset.activity))`：查看活动接口返回
- `mask(__wsLog)`：查看粘贴脚本之后页面发出的请求和返回
- `await wsPointerSlot()`：查看指针停在哪一格
- `wsGa()`：查看 GA4 事件

> 注意：测试模式下弹窗在页面加载时就弹出了，粘贴脚本**之前**发出的活动接口请求不会记进 `__wsLog`。抽奖请求是点按钮才发的，会被记录。

---

## 3. 用例

记录格式（每个用例一行，最后汇总成表格交给用户）：

`用例编号 | 结果（通过 / 失败 / 跳过 / 阻塞） | 实际看到的 | 相关请求的 code | 截图文件名`

### T0 环境检查

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T0.1 | 打开首页测试地址 | 域名是 `moodytiger-us-dev.myshopify.com`，不是密码页 |
| T0.2 | 粘贴第 2 节脚本，运行 `wsState()` | `rendered: true`。如果是 `false`，说明当前已登录（已登录不渲染弹窗）或主题不对，停下来告诉用户 |
| T0.3 | 看 `wsState()` 里的 `prefix`、`activity` | 记录下来。当前联调应为 `prefix: '/apps/station-dev/station/welcome-spin'`、`activity: 'welcome-spin-bf2026'` |
| T0.4 | 运行 `mask(await wsApi('/activities/' + wsRoot().dataset.activity))` | `code: 0`，`data.status: 'ONLINE'`，`data.prizes` 有 6 条。记录每条的 `slot / prizeCode / prizeType / title / sectorWeight` |
| T0.5 | 看控制台有没有红色报错 | 记录所有含 `welcome` 或 `ws` 的报错，没有就写"无"（Omnisend 等第三方的报错不用记） |

### T1 弹窗与转盘显示（A1）

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T1.1 | 刷新首页，运行 `wsState()` | 页面一加载就弹出（测试模式）：`open: true, state: 'form'`。窗口宽度 ≥1024 时是居中的 1000×600 弹窗，左边转盘、右边表单 |
| T1.2 | 看右侧文案 | 眉题 "BLACK FRIDAY"（橙色）；标题两行 "Spin for your"（小）/ "welcome gift"（大）；说明 "Every spin wins something for your first order, plus first looks at new drops."；输入框占位 "Enter your email"；勾选框 "I agree to receiving marketing emails and special deals"；按钮 "Spin the wheel"；底部 "One spin per new subscriber. Odds vary. See Terms and Privacy Policy." |
| T1.3 | 看转盘格子 | 6 格，从 12 点（指针下方）开始**顺时针**依次是 slot 0→5，格子文字是接口 `title` 的大写。slot 0 的格子中心正对指针 |
| T1.4 | 看格子大小 | 每格角度 ∝ `sectorWeight`（如 30/5/15/5/40/5 → 108°/18°/54°/18°/144°/18°）。不应该是 6 等分 |
| T1.5 | 看格子颜色（按 slot 顺序） | 0 浅米 / 1 橙 / 2 米色 / 3 墨绿 / 4 白 / 5 黑；橙、墨绿、黑底上是白字，其余是黑字 |
| T1.6 | 看格子文字样式 | 占比 ≥15% 的格子（如 FREE GIFT、10% OFF、GRAND PRIZE）显示两行：第一个词大字，其余小字。小格子是一行小字，沿半径方向排；"FREE SHIPPING" 这种长的折成两行。文字不能倒着读，也不能溢出格子 |
| T1.7 | 看中心圆 | 橙色渐变圆，白字 "BLACK / FRIDAY" 两行 |
| T1.8 | 点底部 Terms、Privacy Policy（新标签打开或点完返回） | 分别跳到 `/pages/terms-of-service`、`/pages/privacy-policy02`。dev 店如果没有这两个页面会 404，记录下来（不算前端失败） |
| T1.9 | 截图 | `T1-A1.png` |

### T2 表单校验与关闭（A2，不消耗邮箱）

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T2.1 | 刷新并粘贴脚本。邮箱留空、不勾选，点 Spin the wheel | 邮箱框下红字 "Please enter a valid email address."，输入框边框变红；勾选框下红字 "Please tick the box to spin."，勾选框边框变红；`mask(__wsLog)` 里**没有**抽奖请求 |
| T2.2 | 输入 `hello@moodytiger`（不完整），点按钮 | 只剩邮箱错误提示（勾选错误照旧），仍然没有抽奖请求 |
| T2.3 | 在邮箱框里打字 | 邮箱红字马上消失 |
| T2.4 | 勾选同意框 | 勾选红字消失，勾选框变黑底白勾 |
| T2.5 | 点右上角 × | 弹窗淡出关闭，页面可以正常滚动 |
| T2.6 | 刷新，点弹窗外的灰色遮罩 | 弹窗关闭 |
| T2.7 | 刷新，按 Esc | 弹窗关闭 |
| T2.8 | 刷新，连续按 Tab | 焦点只在弹窗内循环（× → 邮箱 → 勾选 → 按钮 → Terms → Privacy → 回到 ×），不会跑到弹窗后面的页面 |
| T2.9 | 截图 T2.1 的状态 | `T2-A2.png` |
| T2.10 | 运行 `wsGa()` | 有 `welcome_spin_view`（参数为空）、`welcome_spin_error`（`error_type: 'invalid_email'` 或 `'no_consent'`）、`welcome_spin_close`（`module_name: 'form'`） |

### T3 折扣类奖品（A3 转动中 → A4 结果，⚠️ 消耗邮箱）

前提：按 0.5 节的表问过用户，拿到本次要用的邮箱。

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T3.1 | 刷新并粘贴脚本，填测试邮箱、勾选 | — |
| T3.2 | ⚠️ 用户确认后点 Spin the wheel | 按钮立刻变成 "Spinning…" 且半透明、不可再点；邮箱框只读；约 1 秒内转盘开始顺时针转动，转动时格子文字有运动模糊，约 4.5 秒后停下 |
| T3.3 | 停下后运行 `mask(__wsLog)` | 有一条 `POST .../activities/welcome-spin-bf2026/draws`，`body` 里有 `email`（已打码）、`consent: true`、`requestId`（UUID 格式），**没有** `honeypot` 字段；`code: 0`。记录 `data.prizes[0]` 的 `slot / prizeCode / prizeType / title / contentValue / expireText` |
| T3.4 | 运行 `await wsPointerSlot()` | 返回的 `slot` = 抽奖返回的 `prizes[0].slot` |
| T3.5 | 约 0.4 秒后出结果，运行 `wsState()` | `state: 'result', prize: 'coupon'` |
| T3.6 | 看左侧转盘 | 中奖格变成橙色、向外凸出并带阴影，格子文字变白；其余格子变淡；指针上移；中心圆显示 "YOU WON" + 转盘格子上的奖品名大写（"10% OFF" 一行；"FREE SHIPPING" 两行），**不带 "IS YOURS"** |
| T3.7 | 看右侧文案 | 眉题 "You won"；标题拆成两行：接口 `title`（如 "10% off is yours"）去掉末尾 "is yours" 的部分是第一行大字（"10% off"），"is yours" 是第二行小字，**不能重复出现两次 "is yours"**；说明 = 接口 `description`；码框里是接口 `contentValue`（如 `WELCOME10`）和 "Copy"；按钮 "Shop Black Friday"；底部 = 接口 `expireText` |
| T3.8 | 点 Copy | 变成 "Copied"，约 1.5 秒后恢复。（可选）运行 `navigator.clipboard.readText()` 确认剪贴板里是这个码 |
| T3.9 | 看 `wsState().shopHref` | 是 `/discount/<码>?redirect=%2Fpages%2Fblack-friday2026` |
| T3.10 | 点 Shop Black Friday | 约 0.25 秒后跳转，最终到 `/pages/black-friday2026`（这一步跳转后地址里不再有 `preview_theme_id`，属于正常现象） |
| T3.11 | 在新页面控制台运行 `fetch('/cart.js').then(r=>r.json()).then(c=>c.discount_codes)` | 包含这个码（`applicable` 在空购物车时可能是 false，属正常）。如果返回 `undefined`（接口没有这个字段），改为加一件商品进购物车后看结账页。可选：随便加一件商品进购物车再进结账页，看折扣码是否已带上并生效（⚠️ 不要付款） |
| T3.12 | ⚠️ 免运费（按表第 2 次，需后端配合时先问用户）重复 T3.1–T3.9 | 标题第一行 "Free shipping"；中心圆 "FREE / SHIPPING" 两行；码 = `WELCOMESHIP`（以接口为准） |
| T3.13 | 截图 | `T3-A3.png`（转动中，能截到的话）、`T3-A4.png`、`T3-ship.png` |

### T4 品牌礼品（A5，🛑【需后端】调概率，⚠️ 消耗邮箱）

开始前问用户："请确认后端已把概率调成必中 Free gift，礼品商品（variantId）是否已经建好？"

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T4.1 | 同 T3.1–T3.4 抽奖 | `prizes[0].prizeType: 'GIFT'`；指针停在 FREE GIFT 格；记录 `extra.variantId`、`extra.productHandle` |
| T4.2 | 运行 `wsState()` | `state: 'result', prize: 'gift'` |
| T4.3 | 看右侧 | 眉题 "You won"；标题 "A free moodytiger"（小）/ "gift is yours"（大）（接口 `title` 以 "A free moodytiger" 开头时按它拆分，否则用这句固定文案；记录接口实际返回的 `title`）；说明 = 接口 `description`（"Add it to your cart and it's free on orders of $79 or more."）；礼品行：左边方图，右边商品名 + "Free with orders of $79+"；码框 `WELCOMEGIFT` + Copy；按钮 "Add gift to cart"；底部 = 接口 `expireText` |
| T4.4 | 礼品行的图和名称 | `productHandle` 对应的商品存在：显示商品主图和商品标题（`__wsLog` 里有 `GET /products/<handle>.js` 且 status 200）。不存在：显示老虎 logo 占位和 "moodytiger Gift"（这是兜底，记录下来） |
| T4.5 | 点 Add gift to cart | **商品已建好**：按钮变 "Adding…"，然后弹窗关闭、购物车抽屉自动打开，礼品在购物车里，数量 1。`__wsLog` 依次有 `GET /cart.js`、`POST /cart/add.js`（status 200）、`POST /cart/update.js`（body `{discount: 'WELCOMEGIFT'}`）。**商品还没建 / variantId 是占位**：按钮显示 "Couldn’t add it just now. Try again"，约 2.5 秒后恢复，弹窗不关（记为"阻塞：礼品商品未建"） |
| T4.6 | 运行 `fetch('/cart.js').then(r=>r.json()).then(c=>({items:c.items.map(i=>[i.variant_id,i.quantity,i.final_line_price]),codes:c.discount_codes}))` | 礼品 variant 在购物车，`discount_codes` 里有 `WELCOMEGIFT` |
| T4.7 | 满 $79 规则 | 购物车其他商品不足 $79 时礼品不免费；再加商品使合计 ≥$79 后，礼品行价格变 0（或结账页显示免费）。⚠️ 不要付款 |
| T4.8 | （可选）不刷新页面，再打开购物车确认礼品没有重复添加 | 数量仍是 1 |
| T4.9 | 截图 | `T4-A5.png`、`T4-cart.png` |

### T5 大奖（A6，🛑【需后端】调概率，⚠️ 消耗邮箱）

开始前问用户："请确认后端已把概率调成必中 Grand prize（注意大奖只送 1 份，抽中后后端可能需要重置库存），大奖商品是否已建好？"

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T5.1 | 同 T3.1–T3.4 抽奖 | `prizeType: 'GRAND'`；指针停在 GRAND PRIZE 格 |
| T5.2 | `wsState()` | `state: 'result', prize: 'grand'` |
| T5.3 | 看右侧 | 眉题 "GRAND PRIZE"；标题 "You won the"（小）/ "grand prize"（大）（接口 `title` 以 "You won the" 开头时按它拆分，否则用这句固定文案；记录接口实际返回的 `title`）；说明 "A moodytiger gift bundle, shipped free with your first order."；礼品行商品名（兜底 "moodytiger Gift Bundle"）+ "Ships with your first order"；码 `WELCOMEGRAND`；按钮 "Add gift to cart"；底部 "Applies to your first order · valid for 30 days"（以接口为准） |
| T5.4 | 中心圆 | "YOU WON" + "GRAND / PRIZE" 两行 |
| T5.5 | 点 Add gift to cart | 同 T4.5–T4.6，码换成 `WELCOMEGRAND` |
| T5.6 | 截图 | `T5-A6.png` |

### T6 已是会员与错误码

| 编号 | 场景 | 操作 | 通过标准 |
|---|---|---|---|
| T6.1 | 已订阅的邮箱（40003） | 用 0.5 节那个**已订阅**邮箱抽奖 | `__wsLog` 里抽奖返回 `code: 40003`；**不转盘**，直接整屏换成 A7：眉题 "WELCOME BACK"、标题 "You’re already"（小）/ "on the list"（大）、说明 "The welcome spin is for new subscribers. Your member perks are waiting in your account."、橙色按钮 "Keep shopping"、白底按钮 "Back to wheel"、下划线链接 "Sign in"；没有底部条款小字；转盘整体变淡 |
| T6.2 | A7 → Back to wheel | 点 Back to wheel | 回到 A1，邮箱框被清空且获得焦点，勾选状态保留 |
| T6.3 | A7 → Sign in | 再触发一次 A7（同 T6.1），点 Sign in | 跳到 `/customer_authentication/login?return_to=<当前页面路径>`（到登录页就停，不要登录） |
| T6.4 | A7 → Keep shopping | 再触发一次 A7，点 Keep shopping | 弹窗关闭 |
| T6.5 | 刚抽过的邮箱再抽 | 用 T3 已成功抽过的邮箱再抽一次 | 记录返回的 code：`40003` → 显示 A7（后端已把它订阅了，合理）；`40004` → 邮箱框下红字 "This email has already had its welcome spin. Your code is waiting in your inbox."，输入框边框变红。两种都算通过，记录是哪一种 |
| T6.6 | （已取消，2026-11-16：前端不再传 honeypot 字段，跳过此用例） | — | — |
| T6.7 | 🛑【需后端】限流 40005 | 后端设置好后点按钮 | 红字 "Lots of spins at once. Take a breather and try again in a minute."，边框不变红 |
| T6.8 | 🛑【需后端】抽奖时活动结束 40002 | 后端设置抽奖接口返回 40002 | 红字 "The welcome spin is taking a break right now. Please check back soon." |
| T6.9 | 🛑【需后端】活动下线（活动接口失败 / 40002） | 后端把活动下线后刷新页面 | **完全不弹窗**（`wsState().open: false`）；控制台运行 `localStorage.getItem('mt-welcome-spin-shown')`，时间戳没有因为这次访问而更新 |
| T6.10 | 🛑【需后端】处理中 40900 | 后端让抽奖接口先返回 40900 一两次，再返回成功 | 页面自动重试（间隔约 1.5 秒，最多重试 3 次），`__wsLog` 里几次 draws 的 `requestId` **完全相同**；最后成功时正常转盘出结果。如果 3 次都返回 40900，显示 "Something went wrong on our side. Please try again." |
| T6.11 | 🛑【需后端】系统繁忙 50300 | 后端设置返回 50300，点按钮；然后让后端恢复，再点一次 | 第一次红字 "Something went wrong on our side. Please try again."；第二次请求的 `requestId` 和第一次**不同** |
| T6.12 | （可选，需用户手动）断网 | 用户在 DevTools → Network 选 Offline 后点按钮，再切回 Online 点一次 | 第一次红字 "Something went wrong on our side. Please try again."；第二次请求的 `requestId` 和第一次**相同**（防止重复抽奖） |
| T6.13 | 转动中关闭 | ⚠️ 用新邮箱抽奖，转盘转动时立刻点 × | 弹窗关闭，不报错；刷新后弹窗重新出现（测试模式），回到 A1 状态。请用户确认这个邮箱仍然收到了中奖邮件（奖品在服务端已生成） |

### T7 手机宽度（<1024px）

把浏览器窗口调到约 390px 宽（或请用户打开 DevTools 设备模式选 iPhone 12/13），刷新：

| 步骤 | 通过标准 |
|---|---|
| T7.1 | 弹窗变成贴在屏幕底部的底部弹层，上面是转盘区（米色背景），下面是文案和表单；没有左边的"票根"礼盒图标和虚线 |
| T7.2 | 底部小字分两行："One spin per new subscriber. Odds vary." / "See Terms and Privacy Policy." |
| T7.3 | 标题两行字号相同（不是 PC 那样一大一小） |
| T7.4 | 文字不溢出，按钮完整；内容超过一屏时弹层内部可以滚动到底 |
| T7.5 | 768px 左右的平板宽度：底部弹层最宽 560px、水平居中 |
| T7.6 | 能复用已有结果的话（不再消耗邮箱），在 A4 / A5 / A7 状态下切换到手机宽度检查显示。截图加 `-m` 后缀 |

### T8 GA4 埋点（和 T1–T7 同时做，不额外消耗邮箱）

每做完一步运行 `wsGa()` 看新增的事件：

| 时机 | 应出现的事件（参数要点） |
|---|---|
| 弹窗弹出 | `welcome_spin_view`（无参数） |
| 校验失败 | `welcome_spin_error`（`error_type`: `invalid_email` / `no_consent`） |
| 通过校验点按钮 | `welcome_spin_submit`（无参数） |
| 抽中 | `welcome_spin_win`（`prize_type`: `coupon` / `gift` / `grand`，`prize_name` = 接口 `title`） |
| 接口报错 | `welcome_spin_error`（`error_type`: `already_member`(40003) / `already_spun`(40004) / `rate_limited`(40005) / `ended`(40002) / `invalid_request`(40001) / `failed_<code>` / `network`） |
| 点 Copy / Shop Black Friday / Add gift to cart / Back to wheel / Keep shopping / Sign in | `welcome_spin_click`（`button_name` = 按钮文字，`module_name` = `result` 或 `member`，结果页另有 `prize_type`） |
| 点 × / 遮罩 / Esc 关闭 | `welcome_spin_close`（`module_name` = 当时的状态 `form` / `result` / `member`） |

另外检查：
- 每条 `ga4Event` 前面都有一条 `{ event_parameters: null }`（运行 `dataLayer.slice(-6)` 看）
- **任何参数里都不能出现邮箱**，出现即为失败

### T9 正式弹出规则（本轮跳过，等测试开关关闭后再测）

用户告知"测试开关已关闭"后再执行：

| 步骤 | 操作 | 通过标准 |
|---|---|---|
| T9.1 | 控制台运行 `localStorage.removeItem('mt-welcome-spin-shown')`，刷新 | 约 8 秒后弹出；`localStorage.getItem('mt-welcome-spin-shown')` 是刚才的时间戳 |
| T9.2 | 再刷新、换页面 | 不再弹出 |
| T9.3 | 运行 `localStorage.setItem('mt-welcome-spin-shown', String(Date.now() - 3*864e5 - 60000))`，刷新 | 约 8 秒后弹出，时间戳更新为现在 |
| T9.4 | 刷新后 8 秒内打开购物车抽屉，并保持打开 | 8 秒到了不会盖在购物车上面；关掉购物车约 1 秒内弹出 |
| T9.5 | 用户登录客户账号后刷新 | 不弹出；`wsState().rendered: false` |

---

## 4. 交付给用户的报告

1. 汇总表：`用例编号 | 结果 | 实际看到的 | code | 截图`
2. 失败 / 阻塞用例：附上对应的 `mask(__wsLog)` 输出（只贴相关的几条）和截图
3. 本次用掉的测试邮箱（打码）及各自抽中的奖品
4. 需要后端处理的事项（例如礼品商品未建、Terms 页面 404、接口字段缺失）
5. 控制台里含 `welcome` / `ws` 的报错
6. T8 每一步 `wsGa()` 的输出
