# 新客邮箱转盘 Welcome Spin 上线清单（dev 店 → US 线上店）

> 联调在 dev 店 `moodytiger-us-dev`（主题 `167699677270`，`shopify theme dev -e welcome`）完成；
> 上线目标是 US 线上店 `moody-tiger-athletics`（moodytiger.com）。上线前逐项打勾。
> 分支 `dev/new_prize`。整理于 2026-11-17。

---

## 0. 上线前 dev 店还要完成的

| 项 | 状态 |
|---|---|
| 运营功能测试（转盘、各奖品结果、错误码、手机端） | ✅ 运营已测完（11-17） |
| 测试模式关闭：`assets/welcome-spin.js` 第 9 行 `TEST_ALWAYS_OPEN = false` | ✅ 已提交 `6fdf352` |
| mock 调试代码删除（`welcome-spin-mock.js`、`?ws_mock`） | ✅ 已提交 `6fdf352` |
| 弹出时机测试：8 秒、3 天、已登录不弹、等购物车抽屉关闭后再弹 | ⬜ 进行中 |
| 礼品 / 大奖用真实接口加购 → 打开购物车抽屉 → 折扣码自动带上 → 满 $79 免费 | ⬜ |
| 礼品行点击跳 PDP | ⬜ |
| 大奖结果文案确认：标题副文案和 "Free with orders of $79+" 是否一致（运营确认） | ⬜ |

## A. 主题代码（走 `push-theme.ps1`）

⚠️ 推送前先确认 `push-theme.ps1` 里的 `$ThemeId` 是这次要推的主题（运营审核草稿 / 正式在线），不要默认它是对的。

| 文件 | 说明 | 状态 |
|---|---|---|
| `sections/welcome-spin.liquid` | 弹窗本体，只对未登录访客渲染 | ⬜ |
| `assets/welcome-spin.css` / `assets/welcome-spin.js` | 样式和逻辑 | ⬜ |
| `assets/welcome-spin-hub.jpg` / `assets/welcome-spin-tiger.png` | 转盘中心图、虎头图 | ⬜ |
| `locales/en.default.json`（`welcome_spin.*`） | 所有文案前端写死在这里 | ⬜ |

⚠️ **分支依赖**：`dev/new_prize` 合并过黑五分支 `dev/prize`，所以合到 `main` 或推送时，**黑五 Spin & Win 的代码也会一起带上**（`spin-wheel.*`、`campaign-gate.*`、`perks-tabs.*`、`settings_schema.json` 的 Spin & Win 组、`locales` 的 `spin.*`）。上线顺序要和黑五对齐：黑五先上线，或者两个一起上线（见 `BF-spin-上线清单.md`）。

## B. footer-group（`push-theme.ps1` **不推** `sections/footer-group.json`，要单独处理）

| 项 | 做法 | 状态 |
|---|---|---|
| 线上主题加 section | 在线上主题编辑器 → Footer 区域 → 添加 section **"Welcome spin"**（页面上不占位置，放在哪里都行） | ⬜ |
| Proxy prefix | 用默认值 **`/apps/bf/station/welcome-spin`**（dev 店现在填的是 `/apps/station-dev/...`，**不能带过去**）。和后端确认线上 App Proxy 前缀就是这个 | ⬜ |
| Activity code | 默认 `welcome-spin-bf2026`，和后端确认线上活动编码一致 | ⬜ |
| 仓库里的 `sections/footer-group.json` | 当前是 dev 店的配置（前缀 `station-dev`）。合并到 `main` 前把 `proxy_prefix` 改回 `/apps/bf/station/welcome-spin`，或者不提交这个文件的改动，避免以后有人误推 | ✅ 已改回（11-17） |
| **不要**整份推 dev 店的 `footer-group.json` | 里面有 dev 店的菜单等配置，会覆盖线上 footer | — |

## C. 线上店 / 后端配置

| 项 | 说明 | 状态 |
|---|---|---|
| 后端：线上店装好 App，App Proxy 指向正式后端 | 前端请求 `/apps/bf/station/welcome-spin/activities/welcome-spin-bf2026`，在 moodytiger.com 打开要返回 200 | ⬜ |
| 后端：线上活动配置 | 状态 ONLINE；6 个格子的顺序、title、sectorWeight 和 dev 店一致；**中奖概率改回正式值**（测试时为了抽中礼品 / 大奖调过概率） | ⬜ |
| 线上折扣码 | 后端返回的共享码（如 WELCOME10 等）在线上店后台已经建好；有效期、使用次数、适用范围、满 $79 门槛都确认过 | ⬜ |
| 礼品 / 大奖商品 | 线上店已经建好并**发布到 Online Store 渠道**，有库存；后端返回的 `variantId` / `productHandle` 要换成**线上店的**（dev 店的 ID 在线上无效，会导致加购失败） | ⬜ |
| 礼品 / 大奖商品是否在系列页和搜索里隐藏 | 待运营决定 | ⬜ |
| 页面存在且已发布 | `/pages/black-friday2026`（Shop 按钮落地页）、`/pages/terms-of-service`、`/pages/privacy-policy02` | ⬜ |
| 新客户账户已启用 | A7 "Sign in" 跳 `/customer_authentication/login` | ⬜ |
| Omnisend 弹窗关闭 | 运营答应关；不关会和转盘同时弹两个弹窗 | ⬜ |

⚠️ **长期使用要注意**：Shop 按钮的落地页写死为 `/pages/black-friday2026`（前端写死，后端返回的 `ctaUrl` 不用）。黑五结束后这个链接要改代码（`sections/welcome-spin.liquid` 第 21 行）。

## D. GA4

| 项 | 状态 |
|---|---|
| 6 个事件登记到飞书 GA4 表 sheet3 末尾：`welcome_spin_view` / `welcome_spin_submit` / `welcome_spin_win` / `welcome_spin_error` / `welcome_spin_click` / `welcome_spin_close`（事件名待确认后再登记） | ⬜ |
| GTM 里为这 6 个事件配好转发 | ⬜ |

## E. 上线后在 moodytiger.com 验证

| 项 | 状态 |
|---|---|
| 无痕窗口打开首页，8 秒后弹出；Network 里 `/apps/bf/station/welcome-spin/...` 返回 200，没有 404 | ⬜ |
| 刷新或换页面，3 天内不再弹；已登录客户不弹 | ⬜ |
| 用真实邮箱抽一次：结果正常显示，COPY 能复制，Shop 按钮跳转后购物车里已带上折扣（**会消耗这个邮箱**） | ⬜ |
| 已订阅过的邮箱提交显示 A7 | ⬜ |
| 手机 Safari / Chrome 各走一遍（底部弹层，输入邮箱时页面不放大） | ⬜ |
| 和 Omnisend、购物车抽屉、quick shop 不会同时出现 | ⬜ |
| GA4 DebugView / dataLayer 能看到 `welcome_spin_*` 事件 | ⬜ |

## F. 只属于 dev 店、**不迁移**

- `shopify.theme.toml` 的 `[environments.welcome]`（dev 店 / 主题 `167699677270`）
- dev 店 footer-group 里的前缀 `/apps/station-dev/station/welcome-spin`
- dev 店的测试邮箱、测试概率、测试商品 ID
- `welcome-spin-联调测试用例.md`（测试文档，不影响主题，推送脚本不会推）
