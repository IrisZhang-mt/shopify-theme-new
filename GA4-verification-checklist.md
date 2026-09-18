# GA4 埋点验证清单

按 sheet3「代码部署详情」文档顺序记录，每个模块一节，方便定位问题。
完成浏览器验证后，请告知对应模块，我会同步把 xlsx 里的开发进度列
（U 列）从"代码已完成，待验证"改成"已完成"。

## 目录

- [We think you'll love 模块（No.23/24）](#验证清单we-think-youll-love-模块no2324)
- [购物车结账按钮（No.25/26）](#验证清单购物车结账按钮no2526)
- [Top Banner 模块（No.27/28）](#验证清单top-banner-模块no2728)
- [Best Sellers 产品列表（No.29/30）](#验证清单best-sellers-产品列表no2930)
- [Mid Banner 模块（No.31/32）](#验证清单mid-banner-模块no3132)
- [Shop by Activities 产品品类（No.33）](#验证清单shop-by-activities-产品品类no33)
- [产品列表页 - 品类模块（No.34）](#验证清单产品列表页---品类模块no34)
- [产品列表页 - 产品列表模块（No.35/36）](#验证清单产品列表页---产品列表模块no3536)
- [产品列表页 - 筛选按钮（No.37）](#验证清单产品列表页---筛选按钮no37)
- [QUICK SHOP 模块（No.38/39）](#验证清单quick-shop-模块no3839)

还没做的（sheet3 No.40 及以后）：产品详情页（PDP）相关埋点，等这批
验证完之后继续按文档顺序做。

## 验证清单：We think you'll love 模块（No.23/24）

- [ ] 在首页/任意页加购一件商品，打开侧边购物车（Side Cart）
- [ ] 等 "We think you'll love" 推荐商品列表加载出来后，控制台查看 `dataLayer`，应出现一条 `view_item_list`：
  - `module_name: "Side Cart"`
  - `item_list_id: "cart_recommendations"`
  - `item_list_name: "We think you'll love"`
  - `currency` 正确
  - `items[]` 里每个商品带 `item_id`（sku）、`item_name`、`item_brand`、`item_variant`（颜色_尺码）、`price`、`index`、`discount`（无折扣则为 0）
  - 确认 `items[]` 里没有 `item_category`、`item_category2`（按约定暂不传，见下方更正说明）
- [ ] 点击推荐商品列表里的某个商品卡片（点图片/标题区域，不要点右上角加号）跳转到 PDP，跳转前控制台应出现 `select_item`：
  - `button_name: "Product Card"`
  - `items[]` 里该商品字段与上面一致
- [ ] 点击推荐商品卡片右上角的"+"加购按钮：**不应该**触发 `select_item`（点+号不算"选择产品"），但应该触发一条 `add_to_cart`：
  - `module_name: "Side Cart"`
  - `button_name: "plus"`
  - `value` 等于该商品单价（quantity 固定是 1）
  - `items[]` 只有这一件被加购的商品，字段同上面 `view_item_list`
- [ ] 如果卡片上有 Quick Shop 按钮，点击 Quick Shop 也应该**不**触发 `select_item`（Quick Shop 属于后续单独一条埋点，这里先排除避免冲突）
- [ ] 关闭购物车再重新打开（购物车内容**没有变化**）：`view_item_list` 应该**不会**重复触发
- [ ] 如果中途点了购物车内的 +/-/移除按钮（购物车内容**变了**）：`view_item_list` 会**重新触发一次**，这是预期行为，不是 bug（详见下方去重范围说明）

代码改动：新建 `sections/cart-recs.liquid` 用到的 `snippets/cart-tile.liquid`、
`snippets/product-card.liquid` 加了 GA4 data 属性（复用 `item-variant-ga4`
变体拼接逻辑）；`assets/cart.js` 的 `initRecs()` 里触发 `view_item_list`，
新增点击监听触发 `select_item`（排除加购按钮和 Quick Shop 按钮）。

`item_category`（一级分类）、`item_category2`（二级分类）均无可靠数据源，不传。

> **补充（2026-09-17）**：原文档漏了推荐商品卡片"+"加购按钮的埋点，
> 已按反馈补上 `add_to_cart`（见上面验证点），仍算在 No.23/24 里，
> xlsx 没有插入新行/新编号，只在 U 列备注里加了说明。

> **去重范围说明（2026-09-17，讨论后维持现状不改）**：
> - `view_item_list` 的去重标记挂在购物车抽屉的 DOM 节点上，只在"单纯开关抽屉、购物车内容没变"时生效；一旦购物车内容变化（加购/改数量/移除），抽屉会整体刷新 DOM，标记跟着丢失，`view_item_list` 会重新触发——这是预期行为，因为推荐商品列表本身可能因为购物车变化而变了。
> - `view_cart` 事件目前**没有做任何去重**：每次打开侧边购物车（哪怕只是关了又开，内容完全没变）都会重新触发一次。这个和 Top Banner 的"同一张 slide 不重复曝光"不是一回事——xlsx 里只有 Top Banner（第32行 E32）明确写了"重复曝光只触发一次"，其他 view_item_list/view_cart 的去重都是我自己按 GA4 惯例加的，不是文档硬性要求。
> 这两点目前按你的决定保持现状，没有改代码。

> **更正（2026-09-17）**：`item_category2` 最初取的是 `product.type`，
> 已按反馈撤回——`item_category2` 应该取 `product.category`（Shopify
> 标准商品分类），但当前店铺数据没有配置这个分类，取不到值，所以本次
> 不传该字段。已把 `snippets/product-card.liquid`、`snippets/cart-tile.liquid`
> 的 `data-item-category2` 属性和所有读取它的 JS（`assets/cart.js`、
> `assets/home-best-sellers.js`、`assets/plp.js`、`assets/quick-shop.js`）
> 全部删除，下面几个模块的说明和验证点已同步更新。

---

## 验证清单：购物车结账按钮（No.25/26）

- [ ] 侧边购物车（Side Cart）里点击结账按钮（Checkout），控制台应在跳转前出现：
  - `event_name: click_checkout`
  - `event_parameters.module_name: "Side Cart"`
- [ ] 购物车整页（Cart Page，`/cart`）点击结账按钮，控制台应出现：
  - `event_name: click_checkout`
  - `event_parameters.module_name: "Cart Page"`

代码改动：`sections/cart-drawer.liquid`、`sections/main-cart.liquid` 的结账
`<a>` 标签加了 `data-checkout` + `data-module-name`；`assets/cart.js`
新增点击监听触发 `click_checkout`。未新建文件。

---

> 注意：下面 No.27～33 涉及的首页模块（Top Banner / Best Sellers /
> Mid Banner / Shop by Activities）在当前 `templates/index.json` 里
> 都是 `disabled: true`（我没有改动这个商家配置文件）。验证前需要先在
> 主题编辑器里把这几个 section 启用，不然首页看不到它们。

## 验证清单：Top Banner 模块（No.27/28）

- [ ] 首页 Hero/Top Banner 区域刚加载时，控制台 `dataLayer` 应出现一条 `view_banner`：
  - `module_name: "Top Banner"`
  - `banner_slot: "1"`
  - `banner_name` 等于当前显示的标题文案
- [ ] 如果 Hero 配置了多张 slide（轮播），等自动轮播切到下一张，或点击轮播下方的圆点切到下一张，应该再出现一条 `view_banner`，`banner_slot` 变成对应的序号（2/3/4...）
- [ ] 轮播回到之前看过的那一张 slide，**不应该**重复触发 `view_banner`（同一张只算一次曝光）
- [ ] 点击 Hero 的 CTA 按钮（如 "Shop New Arrivals"），跳转前应出现：
  - `event_name: click_banner`
  - `banner_slot`/`banner_name` 与当前 slide 一致
  - `button_name` 等于按钮文案（如 "Shop New Arrivals"）
- [ ] 如果某张 extra slide 整张图可点击跳转（配置了 Slide link），点击图片（非 CTA 按钮）应出现 `click_banner`，此时 `button_name` 应该等于 `banner_name`（同一个值）

代码改动：`sections/home-hero.liquid` 给主 slide 和每张 extra slide 加了
`data-banner-slot`/`data-banner-name`（以及 CTA、slide-link 上的
`data-button-name`）；`assets/home-hero.js` 在 `show()` 切换 slide 时
（含首次加载）触发 `view_banner`，新增点击监听触发 `click_banner`。
未新建文件。假设：Top Banner = 首页 Hero 轮播（`home-hero.liquid`），
若实际不是这个模块，请告诉我。

---

## 验证清单：Best Sellers 产品列表（No.29/30）

- [ ] 首页 Best Sellers 模块加载后，控制台应出现一条 `view_item_list`：
  - `item_list_id: "best_sellers"`
  - `item_list_name: "Best Sellers"`（或 section 设置里自定义的标题）
  - `item_list_label`：当前激活 tab 的标签文案（如 "Girls"，运营在主题编辑器的 Best Sellers 区块设置里自己配置的，不是写死的）
  - `currency` 正确
  - `items[]` 字段同 We think you'll love 模块（`item_id`/`item_name`/`item_brand`/`item_variant`/`price`/`index`/`discount`，没有 `item_category`/`item_category2`）
- [ ] 点击顶部 Girls/Boys（或其他）筛选按钮切换商品列表，应该**再触发一次** `view_item_list`，`items[]` 变成新 tab 的商品，`item_list_label` 也应该跟着变成新 tab 的标签（如切到 Boys 就是 "Boys"）
- [ ] 切换回之前看过的同一个 tab，**不应该**重复触发（按商品 id 集合去重）
- [ ] 点击某个商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`，`item_list_label` 同样要有值且跟当前 tab 一致
- [ ] 点击卡片上的 Quick Shop 按钮**不应该**触发 `select_item`

代码改动：`sections/home-best-sellers.liquid` 把每个 collection block 的
`settings.label`（运营在主题编辑器里配的 Girls/Boys 这种标签）透传为
`item_list_label`，经 `snippets/product-card-list.liquid` 传给
`snippets/product-card.liquid`（新增 `item_list_label` 可选参数，写成
`data-item-list-label`，跟 `item_list_id`/`item_list_name` 一样是可选属性，
没传就不渲染，不影响其他调用方）；`assets/home-best-sellers.js` 的
`view_item_list`/`select_item` 都带上这个字段（值不存在时不传）。
`item_list_label` 目前只有 Best Sellers 这个模块用，We think you'll love/
分类页商品列表暂时没有对应的"标签"配置，没加这个字段。未新建文件。

---

## 验证清单：Mid Banner 模块（No.31/32）

- [ ] 首页 Split（For Girls / For Boys 两格）加载后，控制台应出现**两条** `view_banner`（每个 tile 一条）：
  - `module_name: "Mid Banner"`
  - `banner_slot`: 1 和 2
  - `banner_name`: 对应格子的标题（如 "For Girls"/"For Boys"）
- [ ] 点击其中一个 tile 跳转，跳转前应出现 `click_banner`：
  - `banner_slot`/`banner_name` 对应被点击的格子
  - `button_name` 等于 `banner_name`（同一个值）

代码改动：`sections/home-split.liquid` 给每个 tile 加了
`data-banner-slot`/`data-banner-name`/`data-button-name`；新建
`assets/home-split.js`（之前这个 section 没有独立 JS 文件，遵循
"一个 section 对应一组资源文件"的命名对称约定新建）触发 `view_banner`
（脚本加载时，无曝光阈值判断）和 `click_banner`。假设：Mid Banner =
首页 Split 双格模块（`home-split.liquid`），若实际不是这个模块，请
告诉我。

---

## 验证清单：Shop by Activities 产品品类（No.33）

- [ ] 首页 "Shop by Activities" 模块里点击任意一行活动（如 Ice skating/Golf），控制台应出现：
  - `event_name: select_category`
  - `button_name` 等于该行文案（如 "Ice skating"）

代码改动：`sections/home-activities.liquid` 给每行活动链接加了
`data-category-name`；`assets/home-activities.js` 新增点击监听触发
`select_category`。未新建文件。

---

## 验证清单：产品列表页 - 品类模块（No.34）

- [ ] 打开任意分类页（如 `/collections/girls`），如果页面顶部有品类瓷砖（图片+标题的入口格子），点击其中一个，控制台应出现：
  - `event_name: select_category`
  - `button_name` 等于该瓷砖标题

> 注意：这个模块依赖 collection 的 `category_tiles` metafield 或者
> section 里配置的 "Category tile" block，我本地测试的 girls 分类目前
> 两者都没配置，没法直接在浏览器里看到瓷砖，需要挑一个配置了品类
> 瓷砖的分类页来验证。

代码改动：`sections/main-collection.liquid` 给两种品类瓷砖渲染分支都加了
`data-category-name`；`assets/plp.js` 新增点击监听触发 `select_category`。
未新建文件。

---

## 验证清单：产品列表页 - 产品列表模块（No.35/36）

- [ ] 打开任意分类页（如 `/collections/girls`），页面加载后控制台应出现一条 `view_item_list`：
  - `item_list_id` 等于分类的 handle（如 `girls`）
  - `item_list_name` 等于分类标题（如 "Girls"）
  - `currency` 正确
  - `items[]` 字段同前面几个模块（`item_id`/`item_name`/`item_brand`/`item_variant`/`price`/`index`/`discount`，没有 `item_category`/`item_category2`）
- [ ] 往下滚动触发"加载更多"（无限滚动），应该**再触发一条** `view_item_list`，这次 `items[]` 里**只包含新加载出来的商品**，`index` 从上一批的最后一个数字往后接着算（不是从 1 重新开始）
- [ ] 勾选左侧筛选条件后页面刷新出新的商品列表，应该**再触发一条** `view_item_list`（整批新商品）
- [ ] 点击任意商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`
- [ ] 点击卡片上的 Quick Shop 按钮**不应该**触发 `select_item`

代码改动：`sections/main-collection.liquid` 给商品网格的 `product-card`
渲染传入 `item_list_id`/`item_list_name`/`ga4_index`；`snippets/product-card.liquid`
新增 `ga4_index` 参数（跟原有用于交错动画的 `index` 参数分开，避免动画用的
0-3 循环序号污染 GA4 的商品位置字段）；`assets/plp.js` 新增
`view_item_list`（首次加载/加载更多/筛选刷新）和 `select_item`（点击卡片）
逻辑。未新建文件。

---

## 验证清单：产品列表页 - 筛选按钮（No.37）

- [ ] 分类页左侧筛选栏，勾选任意一个筛选项（如 Size 下的某个尺码），控制台应出现：
  - `event_name: select_filter`
  - `filter_type` 等于该筛选分组名称（如 "Size"）
  - `filter_content` 等于勾选的筛选值文案
- [ ] 取消勾选（unchecked）**不应该**触发 `select_filter`

代码改动：`sections/main-collection.liquid` 给筛选分组 `<details>` 加了
`data-filter-type`，给每个筛选 checkbox 加了 `data-filter-content`；
`assets/plp.js` 的 `change` 监听里，checkbox 勾选时触发 `select_filter`
（原有的桌面端"勾选即刷新列表"逻辑不变，只是多加了埋点）。未新建文件。

---

## 验证清单：QUICK SHOP 模块（No.38/39）

- [ ] 在任意已接入 GA4 的商品列表（We think you'll love / Best Sellers / 分类页商品网格）里，点击商品卡片上的 "Quick Shop" 按钮，**点击的瞬间**（弹窗内容还没加载出来之前）控制台应先出现：
  - `event_name: select_item`
  - `button_name: "QUICK SHOP"`
  - `items[]` 里该商品字段齐全
- [ ] Quick Shop 弹窗内容加载展示出来后，控制台应再出现一条：
  - `event_name: view_item`
  - `currency`、`value` 正确
  - `items[]` 里该商品字段齐全
- [ ] 确认这两条事件里的 `item_list_id`/`item_list_name` 跟商品原本所在的列表一致（例如从 Best Sellers 点开就是 `best_sellers`，从分类页点开就是分类的 handle）

代码改动：`assets/quick-shop.js` 的 `open()` 函数里，点击 Quick Shop 触发按钮
时先触发 `select_item`，fetch 成功展示弹窗内容后再触发 `view_item`；两个事件
都直接复用触发按钮所在商品卡片（`product-card.liquid`）上已有的 GA4 data
属性，未新增 Liquid 改动。`currency` 通过 `closest('[data-currency]')`
从最近的祖先节点读取。未新建文件。
