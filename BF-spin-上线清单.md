# 黑五 Spin & Win 上线清单（dev 店 → 线上店）

> 开发在 dev 店 `moodytiger-us-dev` 完成，线上店 `moody-tiger-athletics`（moodytiger.com）上线前逐项打勾。
> 每个开发阶段新增了需要迁移的内容，就追加到这里（谁新增谁写）。上线 2026-11-21 00:00 ET，建议 11-20 前完成并验证。

---

## A. 主题代码（走 `push-theme.ps1`）

先确认目标主题（运营审核用的草稿主题 / 正式在线主题），再推。

| 文件 | 阶段 | 状态 |
|---|---|---|
| `sections/campaign-gate.liquid` | 1 中转页 | ⬜ |
| `assets/campaign-gate.css` | 1 | ⬜ |
| `assets/campaign-gate.js` | 1 | ⬜ |
| `config/settings_schema.json`（新增 "Spin & Win" 组 `spin_proxy_prefix`） | 1 | ⬜ |
| `sections/spin-wheel.liquid` + `assets/spin-wheel.css/.js` | 2–5 | ⬜（阶段 2 已有，后续阶段继续改） |
| `assets/spin-wheel-mock.js`（只在非线上主题加载，推上去也无影响） | 2 | ⬜（开发中） |
| `locales/en.default.json`（`spin.*` 文案） | 2–5 | ⬜（开发中） |

## B. 模板（`push-theme.ps1` **不推** `templates/*.json`，要单独处理）

| 项 | 做法 | 状态 |
|---|---|---|
| `templates/page.campaign-gate.json` | 线上没有这个模板，单独推：`shopify theme push --theme <id> --only templates/page.campaign-gate.json` | ⬜ |
| `templates/page.black_friday.json` 加 spin-wheel section | **不要整份覆盖**（线上由运营维护；dev 店版本只在末尾加了 `spin_wheel`）。在主题编辑器里给黑五页面手动添加 "Spin wheel" section（位置不影响，页面上不占位），或拉下线上版本合并后再推 | ⬜ |
| Spin wheel section 设置 → Terms link | 未登录弹窗底部 "See Terms" 链接，留空不显示；**需要运营提供条款页地址** | ⬜ |

## C. 线上店后台配置

| 项 | 说明 | 状态 |
|---|---|---|
| 新建页面 handle **`spin-and-win`** | 标题随意（dev 店用 "Spin & Win"），模板选 `page.campaign-gate`，发布 | ⬜ |
| 确认落地页 handle | 中转页默认跳 `/pages/black-friday2026`。**核对线上黑五页面的 handle 是否就是 `black-friday2026`**；不是的话改中转页 section 设置 "Campaign page path" | ⬜ |
| 主题设置 → Spin & Win → App Proxy prefix | 与 Lily 在线上 App Proxy 配置的前缀一致（默认 `/apps/bf/spin`） | ⬜ |
| 线上已启用**新客户账户** | 登录跳转用 `/customer_authentication/login`，依赖新客户账户 | ⬜ |
| 尺码表页面 | `size-chart-clothing`、`size-chart-breezy-leggings`、`size-chart-shoes` 线上存在且已发布（选款弹窗的 Size guide 也用这三个页面，缺了就不显示 Size guide） | ⬜ |
| 赠品色卡 | 18 款赠品 + 夹克的颜色在主题设置 Custom colors 或 Files `<颜色>.png` 里都有（和 quick shop 同一套；缺的颜色会显示米白） | ⬜ |
| 08 结束页文案、按钮链接 | 中转页 section 设置，默认值来自设计稿，按钮默认回首页 | ⬜ |

## D. 需要 Lily / 其他人

| 项 | 状态 |
|---|---|
| Lily：线上店装好 App，App Proxy 指向正式后端 | ⬜ |
| Lily / EDM：邮件链接用 `https://moodytiger.com/pages/spin-and-win`（不带 `?spin=1`） | ⬜ 已可告知 |
| GA4：新增事件在飞书 GA4 表 sheet3 末尾加行（阶段 6） | ✅ No.86-96 已登记（11-11）；上线前确认 GTM 里已为这 11 个 `spin_*` 事件配好转发（TRUEMETRICS） |

## E. 上线后验证（线上不能用 `spin_mock`）

| 项 | 状态 |
|---|---|
| 无痕窗口打开 `/pages/spin-and-win` → 跳登录 → 登录后回到黑五页 | ⬜ |
| 已登录打开 `/pages/spin-and-win` → 直接到黑五页 | ⬜ |
| 手机 Safari / Chrome、Gmail 内置浏览器各走一遍上面两条 | ⬜ |
| 线上加 `?spin_mock=ended` **不生效**（mock 只在非线上主题） | ⬜ |
| 黑五页：有次数账号自动弹 02；0 次有奖品弹 06；都没有不弹 | ⬜ |
| 活动结束后（12/2 美东）打开中转页显示 08 | ⬜ |

## F. 只属于 dev 店、**不迁移**的东西

- `shopify.theme.toml` 的 `[environments.dev]`（dev 店 / 主题 `167518339158`）
- dev 店页面 `spin-and-win`（`gid://shopify/Page/264698888278`）、`black-friday2026` 及其上的测试配置
- dev 店的测试订单、测试账号、Admin API 应用
