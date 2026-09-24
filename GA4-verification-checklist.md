# GA4 埋点验证清单

按 sheet3「代码部署详情」文档顺序记录，每个模块一节，方便定位问题。
完成浏览器验证后，请告知对应模块，我会同步把 xlsx 里的开发进度列
（U 列）从"代码已完成，待验证"改成"已完成"。

> **全局规则更新（2026-09-20）**：经查，Shopify 接口已经不返回
> `category`（标准商品分类）这个字段了，所以 `item_category` 改成用
> 商品自带的 `product.type` 来传（跟之前 `item_category2` 一度尝试过
> 的做法一样，但这次是正式定为 `item_category`）。`item_category2`
> 确认**删除**，不传。这个改动覆盖了下面几乎每一个带 `items[]` 的
> 事件——We think you'll love / Best Sellers / 分类页商品列表 / 搜索
> 结果页 / PDP（view_item、Pairs well with）/ You May Also Like /
> Quick Shop / 购物车（view_cart、加购/移除）/ Checkout Custom Pixel，
> 全部一次性加上了 `item_category`，没有数据（`product.type` 为空）
> 的商品就不传这个字段。下文各模块里原来写"没有 `item_category`/
> `item_category2`"的地方，现在应该理解为"带 `item_category`（值是
> product type，如 Jackets & Coats/Leggings/Pants），没有
> `item_category2`"，不再逐条改写。

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
- [Quick Shop 弹窗内 See Details / Add to Cart（No.40/41）](#验证清单quick-shop-弹窗内-see-details--add-to-cartno4041)
- [PDP 页面浏览（No.42）](#验证清单pdp-页面浏览no42)
- [PDP 主体 Add to Cart（No.43）](#验证清单pdp-主体-add-to-cartno43)
- [PDP Details 手风琴（No.44）](#验证清单pdp-details-手风琴no44)
- [Pairs well with 模块（No.45/46）](#验证清单pairs-well-with-模块no4546)
- [Reviews 模块（No.47/48）](#验证清单reviews-模块no4748)
- [FAQ 模块（No.49）](#验证清单faq-模块no49)
- [You May Also Like 模块（No.50/51）](#验证清单you-may-also-like-模块no5051)
- [搜索结果页（No.52-57）](#验证清单搜索结果页no52-57)
- [结账/配送/支付/支付成功（No.58-61，Custom Pixel）](#验证清单结账配送支付支付成功no58-61custom-pixel)
- [搜索框商品列表 Bug 修复（No.12/13）](#验证清单搜索框商品列表-bug-修复no1213)

到这里 sheet3「代码部署详情」全部做完了。

## 验证清单：We think you'll love 模块（No.23/24）

- [ ] 在首页/任意页加购一件商品，打开侧边购物车（Side Cart）
- [ ] 等 "We think you'll love" 推荐商品列表加载出来后，控制台查看 `dataLayer`，应出现一条 `view_item_list`：
  - `module_name: "Side Cart"`
  - `item_list_id: "cart_recommendations"`
  - `item_list_name: "We think you'll love"`
  - `currency` 正确
  - `items[]` 里每个商品带 `item_id`（sku）、`item_name`、`item_brand`、`item_variant`（颜色\_尺码）、`price`、`index`、`discount`（无折扣则为 0）
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

`item_category2`（二级分类）无可靠数据源，不传。`item_category`（一级分类）
原本也无数据源，2026-09-20 起改用 `product.type` 传值（见文件最开头的
"全局规则更新"）。

> **补充（2026-09-17）**：原文档漏了推荐商品卡片"+"加购按钮的埋点，
> 已按反馈补上 `add_to_cart`（见上面验证点），仍算在 No.23/24 里，
> xlsx 没有插入新行/新编号，只在 U 列备注里加了说明。

> **去重范围说明（2026-09-17，讨论后维持现状不改）**：
>
> - `view_item_list` 的去重标记挂在购物车抽屉的 DOM 节点上，只在"单纯开关抽屉、购物车内容没变"时生效；一旦购物车内容变化（加购/改数量/移除），抽屉会整体刷新 DOM，标记跟着丢失，`view_item_list` 会重新触发——这是预期行为，因为推荐商品列表本身可能因为购物车变化而变了。
> - `view_cart` 事件目前**没有做任何去重**：每次打开侧边购物车（哪怕只是关了又开，内容完全没变）都会重新触发一次。这个和 Top Banner 的"同一张 slide 不重复曝光"不是一回事——xlsx 里只有 Top Banner（第32行 E32）明确写了"重复曝光只触发一次"，其他 view_item_list/view_cart 的去重都是我自己按 GA4 惯例加的，不是文档硬性要求。
>   这两点目前按你的决定保持现状，没有改代码。

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
  - `item_list_id`：当前模块 heading 设置的 handle 化结果，比如主题
    编辑器里把标题改成了 "Most Loved"，这里就应该是 `"most_loved"`
    （不是写死的 `"best_sellers"`）
  - `item_list_name`：`当前 heading + "_" + 当前激活 tab 的标签`，比如
    heading 是 "Most Loved"、Girls tab 激活时是 `"Most Loved_Girls"`
  - **确认没有** `item_list_label` 字段了（已删除，信息现在并入 `item_list_name`）
  - `currency` 正确
  - `items[]` 字段同 We think you'll love 模块（`item_id`/`item_name`/`item_brand`/`item_variant`/`price`/`index`/`discount`，没有 `item_category`/`item_category2`），每个商品的 `item_list_name` 也是 `"Most Loved_Girls"` 这种格式
- [ ] 点击顶部 Girls/Boys（或其他）筛选按钮切换商品列表，应该**再触发一次** `view_item_list`，`items[]` 变成新 tab 的商品，`item_list_name` 也应该跟着变成 `"Most Loved_Boys"`
- [ ] 切换回之前看过的同一个 tab，**不应该**重复触发（按商品 id 集合去重）
- [ ] 点击某个商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`，`item_list_id`/`item_list_name` 同样跟着当前 heading + tab 走
- [ ] 点击卡片上的 Quick Shop 按钮**不应该**触发 `select_item`
- [ ] 去主题编辑器把这个模块的 Heading 改成别的文案（比如改回 "Best Sellers"），刷新页面重新验证一遍，`item_list_id`/`item_list_name` 应该跟着新标题变，不需要改代码

> **更新（2026-09-20）**：按反馈把 `item_list_label` 字段整个删掉了，
> 原来单独传的 tab 标签信息现在直接拼进 `item_list_name` 里，
> `view_item_list`/`select_item` 里所有出现 `item_list_name` 的地方
> （事件顶层 + `items[]` 里每一项）都是这个拼接后的值。
>
> **更新（2026-09-24）**：反馈 `item_list_id`/`item_list_name` 的前缀
> 是写死的 `best_sellers`/`Best Sellers`，商家把模块标题改成 "Most
> Loved" 之后没有跟着变。已改成动态取 `section.settings.heading`：
> `item_list_id` = heading 转成的 handle（空格转下划线的小写形式，如
> "Most Loved" → `most_loved`），`item_list_name` = heading 原文 + "_" +
> tab 标签（如 `Most Loved_Girls`，保留原文大小写）。heading 为空时
> 兜底成 `best_sellers`/`Best Sellers`（跟 schema 默认值一致）。

代码改动：`sections/home-best-sellers.liquid` 顶部新增
`bs_heading = section.settings.heading | default: 'Best Sellers'`，
`item_list_id` 改成 `bs_heading | handleize | replace: '-', '_'`，
每个 tab 的 `item_list_name` 改成 `bs_heading | append: '_' | append:
block.settings.label`（Liquid 的 `render` 标签不支持在参数里直接用
过滤器，所以都先 `assign` 算好再传）。撤销了 `item_list_label` 相关的
改动——`snippets/product-card-list.liquid`、
`snippets/product-card.liquid`、`assets/home-best-sellers.js` 里新增的
`item_list_label` 透传/属性/字段全部删除，恢复成只有
`item_list_id`/`item_list_name` 两个可选参数。未新建文件。

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
- [ ] 勾选左侧筛选条件后页面刷新出新的商品列表，应该**再触发一条** `view_item_list`（整批新商品），**并且 `items[]` 里每个商品的 `item_id` 都不应该是空字符串**（见下方 Bug 修复说明）
- [ ] 点击任意商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`
- [ ] 点击卡片上的 Quick Shop 按钮**不应该**触发 `select_item`

> **Bug 修复（2026-09-18）**：按 Size/Color 等变体选项筛选分类页后，
> 部分商品的 `item_id` 会变成空字符串 `""`。根因：`product-card.liquid`
> 原来用 `product.selected_or_first_available_variant` 取变体，这个属性
> 会自动跟着当前分类页的筛选条件去匹配对应变体，筛选状态下取到的匹配
> 结果不稳定，导致部分商品的 SKU 取不到。
>
> 修复：改成不受筛选影响、自己手动取"第一个有库存的变体，没有就取
> 第一个变体"：`product.variants | where: 'available', true | first`，
> 取不到再 `default` 到 `product.variants.first`。这个函数在
> `snippets/product-card.liquid` 里，是 We think you'll love / Best
> Sellers / 分类页商品列表 / Quick Shop 共用的，这几个模块的 `item_id`/
> `item_variant` 已经一起修复，不需要分别改。
>
> 已用 `curl` 模拟 `Size=4 (110)` 筛选实测：修复前 24 个商品卡片里有多个
> `item_id` 是空的，修复后 24 个全部有正确的值。
>
> **已知限制（讨论后维持现状，不算 bug）**：这个修复让 `item_id` 稳定
> 不为空，但代价是 `item_variant` 不保证跟当前筛选条件一致——比如筛选
> `Size=22 (180)` 之后，`items[]` 里可能出现 `item_variant: "Birch_4
(110)"` 这种跟筛选尺码不一样的值，因为它现在只看"这个商品第一个有
> 库存的变体是什么"，不看当前筛选条件。要让 `item_variant` 跟筛选联动
> 需要额外按 `collection.filters` 里勾选的值去匹配对应变体，讨论后决定
> 不做这个（收益不确定，会增加复杂度），保持现状。

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

---

## 验证清单：Quick Shop 弹窗内 See Details / Add to Cart（No.40/41）

- [ ] 打开 Quick Shop 弹窗后，点弹窗右下角的 "See Details" 链接，跳转前控制台应出现：
  - `event_name: select_item`
  - `button_name: "See Details"`
  - `items[]` 里该商品字段齐全，`item_id`/`item_variant` 是弹窗里**当前选中**的那个变体（不是打开弹窗那一刻的默认变体）
- [ ] 在弹窗里切换颜色/尺码之后再点 "See Details"，`item_id`/`item_variant`/`price` 应该跟着变成你刚选的那个变体
- [ ] 点弹窗里的 "Add to Cart" 按钮，应该出现一条 `add_to_cart`：
  - `button_name: "Add to Cart"`
  - `value` 等于当前选中变体的单价
  - `items[]` 同样反映当前选中的变体

代码改动：`sections/quick-shop.liquid` 里输出变体列表的那段 JSON
（`data-qs-variants`）新增了 `sku`/`priceValue`/`discountValue`/`itemVariant`
四个字段（原来只有给页面展示用的格式化价格字符串，没有 GA4 需要的原始
数值和 SKU，复用了 `item-variant-ga4` 拼接逻辑）；`assets/quick-shop.js`
新增 `qsCurrentItem()`，从"当前选中的变体 + 打开弹窗时记下来的商品卡片"
拼出 GA4 的 item 对象，`.mt-qs__details` 和 `.mt-qs__add` 点击时分别
触发 `select_item`/`add_to_cart`。未新建文件。

---

## 验证清单：PDP 页面浏览（No.42）

- [ ] 打开任意商品详情页（PDP），控制台应出现一条 `view_item`：
  - `currency`、`value` 正确（`value` = 当前变体单价，默认数量 1）
  - `items[]` 里该商品字段齐全（`item_id`/`item_name`/`item_brand`/`item_variant`/`price`/`discount`）
  - 确认**没有** `item_list_id`/`item_list_name`/`index`（直接进 PDP 没有列表来源，不传）、也没有 `item_category`/`item_category2`
- [ ] 如果 URL 带 `?variant=xxx` 打开（比如从 Quick Shop 的 See Details 链接跳转过来），`items[]` 里的字段应该反映 URL 指定的那个变体，不是默认变体

代码改动：`sections/main-product.liquid` 顶部加了一段内联执行的
`<script>`，页面首次渲染时直接触发 `view_item`，取值用页面已有的
`product.selected_or_first_available_variant`。未新建文件。

---

## 验证清单：PDP 主体 Add to Cart（No.43）

- [ ] PDP 页面价格旁边的 Add to Cart 按钮，点击后应出现一条 `add_to_cart`：
  - `button_name: "Add to Cart"`
  - `value` = 当前选中变体单价 × 当前数量（用 +/- 调整过数量的话要跟着变）
  - `items[]` 里 `item_id`/`item_variant`/`price` 是**当前选中**的变体（切换颜色/尺码后点加购要跟着变）
  - 确认没有 `item_list_id`/`item_list_name`（无来源，不传）

代码改动：`sections/main-product.liquid` 的 `data-pdp-variants` JSON 新增
`priceValue`/`discountValue`/`itemVariant` 字段（跟 Quick Shop 那次修复
同一个思路，原来只有展示用的格式化价格字符串）；`assets/pdp.js` 的
`[data-pdp-add]` 点击处理里，用 `matchVariant()` 找到当前选中的变体后
触发 `add_to_cart`。未新建文件。

---

## 验证清单：PDP Details 手风琴（No.44）

- [ ] PDP 下方的手风琴条目（如 "Product Description"/"Material & Care"/"Sustainability"，具体标题看主题编辑器怎么配置），点击**展开**时应出现：
  - `event_name: select_content`
  - `module_name: "Product Details"`
  - `content_name` 等于该条目的标题
  - **确认没有 `button_name` 这个字段**（这里没有独立于展开条目本身的按钮，没有值就不传，不是传空字符串）
- [ ] 点击收起（再点一次已展开的条目）**不应该**触发这条事件

> **更新（2026-09-24）**：反馈 `button_name` 没有值的时候应该整个不传
> 这个参数，不是传空字符串 `""`。已把 `button_name: ''` 这一行删掉。

代码改动：`sections/main-product.liquid` 给手风琴标题按钮加了
`data-content-name`；`assets/pdp.js` 的 `[data-pdp-toggle]` 点击处理里，
只在展开（`open === true`）时触发 `select_content`，`event_parameters`
里不再带 `button_name`。未新建文件。

---

## 验证清单：Pairs well with 模块（No.45/46）

- [ ] PDP 下方 "Pairs well with"（搭配推荐）模块，点击某个搭配商品的 Add to Cart 按钮，应出现一条 `add_to_cart`：
  - `item_list_id: "pdp_pairs"`
  - `item_list_name`：主题编辑器里配置的 Pairs 标题（默认 "Pairs well with"）
  - `items[]` 里的变体是**当前选中**的（如果搭配卡片自己也能选颜色/尺码）
- [ ] 点击该搭配商品的 "See Details" 链接，跳转前应出现一条 `select_item`：
  - `button_name: "See Details"`
  - `item_list_id`/`item_list_name` 同上
- [ ] 这两条事件都应该只对"你点的那个搭配商品"生效，不要跟当前 PDP 主商品的数据混在一起

代码改动：`snippets/pdp-pair.liquid` 的 `.mt-pair` 卡片加了跟
`product-card.liquid` 一样的 GA4 data 属性，`data-pair-variants` JSON
补了 `sku`/`priceValue`/`discountValue`/`itemVariant`；
`sections/main-product.liquid`、`sections/product-pairs.liquid`（异步
fetch 用的那个 section）渲染 `pdp-pair` 时都传了
`item_list_id`/`item_list_name`/`index`；`assets/pdp.js` 的 `initPair()`
新增 `pairGa4Item()`，`.mt-pair__add`/`.mt-pair__details` 点击时分别
触发 `add_to_cart`/`select_item`。未新建文件。

---

## 验证清单：Reviews 模块（No.47/48）

- [ ] PDP 下方 Reviews 区域 ，点击 "Write a review" 按钮，控制台应出现：
  - `event_name: write_review`（没有 `event_parameters`，这条本来就该是空的）
- [ ] 在弹出的表单里填好信息并提交成功后（弹窗提示感谢/评论已保存），应该出现：
  - `event_name: submit_review`（同样没有 `event_parameters`）
- [ ] 如果提交失败（比如必填项没填、网络报错），**不应该**触发 `submit_review`

代码改动：`assets/review-form.js` 里，点击 `[data-rf-open]` 打开表单时
触发 `write_review`；Judge.me 提交接口调用成功后触发 `submit_review`。
未新建文件。

---

## 验证清单：FAQ 模块（No.49）

- [ ] PDP 下方 FAQ 区域，点击某个问题标题展开时，应出现：
  - `event_name: select_content`
  - `content_type: "FAQ"`
  - `content_name` 等于该问题的文案
  - **确认没有 `button_name` 这个字段**（没有值就不传，不是传空字符串）
- [ ] 点击收起**不应该**触发这条事件

> **更新（2026-09-24）**：反馈 `button_name` 没有值的时候应该整个不传
> 这个参数，不是传空字符串 `""`。已把 `button_name: ''` 这一行删掉。

代码改动：`sections/product-faq.liquid` 给问题标题按钮加了
`data-content-name`；`assets/product-faq.js` 的点击处理里，只在展开时
触发 `select_content`，`event_parameters` 里不再带 `button_name`。
未新建文件。

---

## 验证清单：You May Also Like 模块（No.50/51）

- [ ] PDP 下方 "You May Also Like" 模块加载后，控制台应出现一条 `view_item_list`：
  - `item_list_id: "you_may_also_like"`
  - `item_list_name`：主题编辑器里配置的标题（默认 "You May Also Like"）
  - `items[]` 字段跟前面几个商品列表模块一致
- [ ] 点击某个商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`
- [ ] 点击卡片上的 Quick Shop 按钮**不应该**触发 `select_item`

代码改动：`sections/product-related.liquid`（含首次渲染的兜底池分支和
异步 fetch 用的 `recommendations.performed` 分支）都给 `product-card`
渲染传了 `item_list_id: 'you_may_also_like'`；`assets/product-related.js`
新增 `view_item_list`（推荐商品渲染完成后触发一次）和 `select_item`
（点击卡片，排除 Quick Shop 按钮）逻辑。未新建文件。

---

## 验证清单：搜索结果页（No.52-57）

- [ ] 搜索出有结果的商品（如访问 `/search?q=jacket&type=product`），页面加载后控制台应出现一条 `view_item_list`：
  - `item_list_id: "search_results"`
  - `item_list_name: "Search Results"`（固定文案，不含搜索词）
  - `items[]` 字段跟前面几个商品列表模块一致
- [ ] 点击某个商品卡片跳转 PDP，跳转前应出现 `select_item`，`button_name: "Product Card"`
- [ ] 点击卡片上的 Quick Shop 按钮，应该正常触发 `select_item`（`button_name: "QUICK SHOP"`）——这个是直接复用 Quick Shop 已有逻辑，不是本次新写的
- [ ] Quick Shop 弹窗展示后应出现 `view_item`，点弹窗里的 "See Details"/"Add to Cart" 也应该分别触发 `select_item`/`add_to_cart`——这三个也是复用逻辑
- [ ] 翻页（如果搜索结果超过 24 个）到第 2 页，应该**再触发一条** `view_item_list`（翻页是整页刷新，不是无限滚动，跟分类页的"加载更多"不一样，不需要担心 index 累加的问题）

代码改动：`sections/main-search.liquid` 给商品网格加了内联执行的
`<script>` 触发 `view_item_list`（因为搜索结果页是纯服务端渲染、没有
异步 fetch，直接在渲染时算好 `items[]` 输出），商品卡片渲染时传了
`item_list_id: 'search_results'`；新建 `assets/search-results.js`
处理点击卡片触发 `select_item`（排除 Quick Shop 按钮）——这是这个
section 第一次有独立 JS 文件，遵循命名对称约定新建。Quick Shop 相关的
三条（No.54/55/56/57，QUICK SHOP点击/预览/See Details/Add to Cart）
完全复用 `assets/quick-shop.js` 里 No.38-41 时已经写好的逻辑，没有新增
任何代码——只要商品卡片带了 `item_list_id`，Quick Shop 就自动能用。

---

## 验证清单：结账/配送/支付/支付成功（No.58-61，Custom Pixel）

**这四条不是主题代码，是 Shopify 后台的 Custom Pixel**——checkout/
thank-you/orders 页面不跟主题共享 dataLayer/GTM 实例，sheet2 文档
第81-83行（"九、如何在shopify web-pixel中部署GTM"）给的方案就是让
pixel 自己加载一份独立的 GTM + 同步 Shopify 的隐私同意状态到 Google
Consent Mode v2。代码在仓库根目录 `checkout-custom-pixel.js`（新建
文件，不属于主题，theme push 不会带上它）。

### 部署步骤

1. Shopify 后台 → Settings → Customer events → Add custom pixel
2. 起个名字（如 "GA4 Checkout Events"），把 `checkout-custom-pixel.js`
   整个文件内容粘进代码框
3. 保存后需要给这个 pixel 授权对应的隐私分类（一般选 Analytics），
   否则在有隐私同意管理的地区可能不生效
4. **这一步不需要发布新主题**——checkout 是店铺级别的共享流程，不挂在
   某个具体主题下，Customer events 里配置的 pixel 对所有主题的结账流程
   都生效，包括你现在用来开发的这个还没上线的主题

### 怎么触发这四个事件来测试

- `checkout_started`（No.58 begin_checkout）：购物车页点 Checkout 进入结账页就会触发
- `checkout_shipping_info_submitted`（No.59 add_shipping_info）：结账页填完地址、选好配送方式点"继续"触发
- `payment_info_submitted`（No.60 add_payment_info）：**需要走到填写付款信息这一步**——如果用 100% 折扣码把订单金额变成 $0，Shopfy 结账通常会跳过付款步骤，这个事件就不会触发，测不出真实的 `payment_type`。建议：
  - 如果店铺已经能用 Shopify Payments 的测试模式（Bogus Gateway），用测试卡号走一遍完整流程
  - 或者在 Settings → Payments 里加一个 "Bogus Gateway"（测试网关）专门用于测试下单
- `checkout_completed`（No.61 purchase）：完成下单、进入 Thank you 页触发

### 怎么验证（这个场景用 GTM Preview，不是浏览器 console）

因为这个 pixel 是在 Shopify 的沙盒环境里运行的（有自己独立的
`window`/`dataLayer`，不是当前页面主 window 那个），直接在浏览器
DevTools 里对着 checkout 页面敲 `dataLayer` 大概率看不到东西，或者看到
的是另一份不相关的数据。正确的验证方式：

- [ ] 打开 GTM 工作区，进入 Preview 模式，**在开始结账流程之前**就把
      Tag Assistant 连接到店铺域名（连接后走完整个"加购 → 结账 → 填地址
      → 填支付 → 提交订单"流程，中途不要断开）
- [ ] Tag Assistant 的时间线里应该依次出现四次 `ga4Event` 记录，
      `event_name` 分别是 `begin_checkout`/`add_shipping_info`/
      `add_payment_info`/`purchase`
- [ ] 逐条检查 `event_parameters`：
  - `begin_checkout`/`add_shipping_info`/`add_payment_info` 应该有
    `currency`/`value`/`items[]`，**没有** `item_list_id`/`item_list_name`
    （结账页没有列表来源，不传）
  - `add_shipping_info` 多一个 `shipping_tier`（配送方式名称，比如
    "Standard"）
  - `add_payment_info`/`purchase` 多一个 `payment_type`
  - `purchase` 额外有 `transaction_id`（订单 ID）、`shipping`、`tax`，
    **没有** `order_type`（无数据源不传）
- [ ] 也可以在 GA4 后台的 DebugView 里对照看这四个事件有没有正确进来

### 有几点提前告诉你，免得测的时候以为是 bug

1. `item_variant` 取的是 Shopify 结账对象里 `variant.title`（格式一般是
   "颜色 / 尺码"，我把中间的 " / " 换成了 "_" 来对齐其他埋点的格式），
   不是走 `item-variant-ga4.liquid` 那套逻辑——因为 pixel 沙盒里拿到的
   是 Shopify 的 checkout 数据对象，不是 Liquid 对象，没法复用那个
   snippet
2. `discount` 是把这个商品所有折扣分摊（`discountAllocations`）加起来，
   没有折扣就是 0
3. 因为 pixel 里默认把欧盟/英国/瑞士地区的 `analytics_storage` 设成
   "denied"（Google Consent Mode v2 默认值），如果你是从这些地区测试、
   又没有触发"同意"流程，GA4 标签可能不会正常触发或者只发 cookieless
   ping——如果你在国内/美国测试一般不受影响，只是提前说明一下这个机制，
   免得测出"没反应"时以为是代码问题

代码新建：仓库根目录 `checkout-custom-pixel.js`（不是主题 asset，需要
手动粘贴到 Shopify 后台）。字段来源已对照 Shopify Web Pixels API 官方
文档核实（`checkout.currencyCode`/`totalPrice`/`totalTax`/`lineItems`/
`transactions`/`delivery.selectedDeliveryOptions`/`order` 等），不是
凭印象猜的。

---

## 验证清单：搜索框商品列表 Bug 修复（No.12/13）

**反馈问题**：搜索框边输入边实时触发 `view_item_list`，输入过程中频繁
上报（每次搜索建议结果一变就报一次），不是"用户看到结果后"才报。

- [ ] 打开搜索框，连续快速输入一个词（如 "sleeve"），**只在停止打字后**
      才应该出现 `view_item_list`，输入过程中间不应该逐字触发
- [ ] 输入几个字符后停顿一下（比如打完"sl"就停），等一会儿应该能看到
      `view_item_list` 用当前"sl"这个词的搜索结果触发；如果这时候又
      接着打完整个词，之前"sl"那次不应该是唯一触发的一次——以**最终
      停下来那个词**的结果为准触发，中间没停稳的状态不应该触发
- [ ] 清空搜索框（比如全选删除），不应该在清空后又冒出一条空结果的
      `view_item_list`
- [ ] 点击搜索建议词（chip）后自动填入并搜索，这个照常应该只在结果
      稳定后触发一次，不受这次改动影响
- [ ] 关掉搜索框再重新打开，之前的计时器不应该遗留下来在背后触发

代码改动：`assets/header.js` 的 `searchRender()` 里，原来是每次渲染
新的搜索结果就直接判断"跟上次的商品 id 集合不一样"就立刻触发
`view_item_list`——问题是搜索输入本身已经有 250ms 的防抖去发请求，
但请求一返回就立刻上报，用户只要打字间隔略大于 250ms 就会在打字过程中
反复触发。现在改成：每次渲染新结果时，先取消上一次排好的上报计时器，
再重新排一个 600ms 后的计时器；只有真正等到用户停手不再触发新的搜索
结果（没有新的 `searchRender` 调用进来清掉这个计时器）时，600ms 后
才会真正执行上报判断和 `dataLayer.push`。相当于把"搜索建议展示"（快，
保持 250ms 防抖不变，输入体验不受影响）和"埋点上报"（慢，等到用户
停顿）两件事解耦开。同时在 `searchReset()`（关闭搜索框时调用）里也把
这个新计时器一起清掉，避免关闭搜索框后计时器还在背景里跑、之后莫名
其妙触发一次。未新建文件。
