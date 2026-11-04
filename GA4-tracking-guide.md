# GA4 埋点开发指南（新组件接入用）

这份文档是给**后续新开上下文窗口、给新组件加 GA4 埋点**用的。一期
（TRUEMETRICS sheet3「代码部署详情」No.1-69）已经在 2026-11-04 全部
做完并通过验收，逐条的详细记录（改了哪个文件、为什么这么改、怎么
验证的）在仓库根目录的 `GA4-verification-checklist.md`，这份文档
不重复那些细节，只总结"做新埋点时该遵循的规律"，避免每次都从头
摸索一遍。

## 一、先找文档，再动手

TRUEMETRICS 的埋点规范是一份 xlsx，每次更新会重新导出一份、文件名
也会变（历史上出现过 `v1.1`、`New`、`v1.3` 等），Iris 一般放在
`D:\work\` 根目录（不在这个仓库里）。**每次都要重新确认最新版本**，
不要直接复用旧对话里记的路径——用 `ls D:\work\*.xlsx` 或类似方式先看
一眼。

写之前先确认没有 Excel 锁文件（`D:\work\` 下有没有 `~$开头` 的临时
文件），有锁文件说明文件被打开着，不要写。

**怎么读**：这台机器上没有能用的 python/pandas（`python`/`python3`
解析到的是没法用的 Windows Store 占位程序）。用 `xlsx` 这个 npm 包装
到 session 的 scratchpad 目录里读：

```bash
cd <scratchpad目录> && npm install xlsx --no-save --silent
```

```js
const XLSX = require('<scratchpad>/node_modules/xlsx');
const wb = XLSX.readFile('D:/work/<文件名>.xlsx');
const ws = wb.Sheets[wb.SheetNames[2]]; // 按下标取，别按名字——中文
                                          // sheet 名直接拿来当文件名
                                          // 会被字符过滤坏掉
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
```

用 bash 传环境变量给 `node -e` 时记得 `export`（或者写成
`VAR=x node -e ...`），不然子进程里 `process.env.VAR` 是
`undefined`——这个坑每次都会踩一次。

**sheet 结构**（共 8 个 sheet，真正要对照实现的是 sheet3）：

1. 代码部署文档概览 —— 概览，不用看
2. GTM部署方法说明 —— GTM 部署方法，不用看
3. **代码部署详情** —— 事件目录本体。真正的表头在 Excel 第 4 行
   （`header:1` 读出来的下标 4），不是第 0 行。"监测页面"/"监测模块"
   这两列是**合并单元格**，跨好几行事件共用一个值——直接按行读会
   导致同组后面几行的页面/模块显示空白，必须解析 `ws['!merges']`
   （遍历合并区间，取左上角单元格的值）才能拿到正确的值。状态/备注
   列（表格里常说的"O 列"）**不同版本文档里含义会变**（有的版本是
   "新增"标记，有的版本是开发进度状态），不要凭记忆假设，拿到新文件
   先看那一列的表头
4. 全局变量说明 —— 每个页面加载时写一次的全局维度
   （c_id/u_id/login_status/content_group/GTM_version），已经在
   No.1「全站访问」里做完了，新组件不用管这个
5. **变量说明** —— 全部 37 个 `$变量` 的权威定义（类型/来源/期望值/
   说明），sheet3 某一行里出现一个没见过的 `$变量`，先来这里查，
   别凭上下文猜
6. 自定义维度说明 —— 哪些事件参数同时也注册成了 GA4 自定义维度，
   这是 GTM 容器后台配置的事，不是主题代码要做的事
7. **页面分组规则** —— `$contentGroup` 的判定规则，按页面路径用
   正则匹配（比如 `^/collections(?:/|$)` → Product List Page，
   `^/products(?:/|$)` → Product Detail Page，没匹配上的页面默认归为
   "Support & Info Page"）
8. 代码部署规则说明 —— 部署流程说明，不用看

## 二、代码层面的既定规律

### 1. 每个事件的推送格式（固定写法，不要变）

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event_parameters: null }); // 先清空，必须有
window.dataLayer.push({
  event: 'ga4Event',
  event_name: '<对应 xlsx 里的代码事件名>',
  event_parameters: { /* ... */ },
});
```

### 2. `items[]` 的标准结构

```js
{
  item_id: <变体 SKU，不是 Shopify 的数字 id>,
  item_name: <商品标题>,
  discount: <见下面"折扣公式">,
  index: <在列表里的 1-based 位置>,
  item_list_id: <见下面"item_list_id/name 取值规律">,
  item_list_name: <同上>,
  ...(item_category ? { item_category } : {}),   // 没有就整个 key 都不传，不要传空字符串
  ...(item_variant ? { item_variant } : {}),
  item_brand: <product.vendor>,
  price: <单价，单位是元不是分>,
  quantity: <见下面>,
}
```

**`item_category`/`item_category2`——跟 xlsx 不一致的已确认决策
（2026-09-20）**：文档里 sheet3/sheet5 还是写着这两个字段都要传，但
Shopify 的 Storefront/Liquid 对象已经不再提供文档当初依据的那套
`category`/`category2` 分类字段了，所以：`item_category` 实际取
`product.type`（比如 "Jackets & Coats"）；**`item_category2` 彻底
不传**。全仓库所有 `items[]` 都是这个口径，新组件不要因为 xlsx 那
一行写了 `item_category2` 就重新加回来。

**`item_variant`**：统一走共享 snippet `snippets/item-variant-ga4.liquid`
渲染，格式是 `颜色_尺码`（比如 `Mocha_20 (175)`），取
`product.variants | where: 'available', true | first`（没有可售变体
就退回 `.first`）。新组件直接复用这个 snippet，不要自己重新拼。

**折扣公式**——两套，看场景：
- 商品卡片场景（PLP/PDP/推荐模块/Quick Shop，商品还没进购物车）：
  `compare_at_price_min - price_min`，没有划线价就是 0
- 购物车行场景（`add_to_cart`/`remove_from_cart` 从购物车抽屉/页面
  触发，店铺有"多件多折"这类数量阶梯折扣）：
  `(行的 total_discount / 行的 quantity) * 本次变动的件数`——按比例
  折算，不是固定的单件折扣值，因为折扣是跨过数量门槛才会生效的。
  整行删除（不是点 -1）用整行的 `total_discount`，不折算
- **`add_to_cart` 的时机**：必须用**加购成功后**服务器返回的真实
  价格/折扣，不能用点击那一刻页面上显示的旧值——因为多件多折要等
  Shopify 真正算完新的行数量才知道单价。购物车抽屉 `+`/推荐卡片
  加购/PDP 主体加购/"Pairs well with"加购/Quick Shop 弹窗加购，
  全部是等 `/cart/add.js`（或 `/cart/change.js`）的响应或刷新后的
  DOM 再推送，不是点击瞬间同步推送。`remove_from_cart` 反过来，就是
  要用点击那一刻的旧值（移除前的档位），因为被移除的那一件本来就
  属于移除前的折扣档位。共享工具函数：`window.mtAddToCart()`
  （返回 `/cart/add.js` 的响应）和 `window.mtPricedAddItem(item,
  added, qty)`（两个都在 `assets/quick-shop.js` 里，全站都能用）——
  新的加购入口直接复用这两个，不要重新写一遍折算逻辑

**`quantity`**：永远是"这次点击影响到的件数"（+/- 是 1，PDP 加购是
选的数量，整行删除是整行数量），不是购物车行变化后的新总数量。

### 3. `item_list_id`/`item_list_name` 取值规律

- 真实分类页（PLP）：`collection.handle` / `collection.title`
- `featured-collection.liquid`（通用可复用 section，营销轮播/blog
  底部"What's new"等都是用的这个）：`featured.handle` /
  `section.settings.heading`（没填退回 `featured.title`）。这个
  section 本来就是设计成通用的，**不要为某个活动单独复制一份**，
  新建一个实例、改 heading/collection 设置就行（仓库里"不要为营销
  活动新建专属模板"的原则）
- 带 Tab 的模块（比如 Best Sellers 的 Girls/Boys 切换）：id 用
  `<标题> | handleize | replace: '-', '_'`（切 tab 不变），name 用
  `<标题>_<tab 标签>`（切 tab 会变）——这种场景 `view_item_list` 去重
  要用复合 key `${itemId}|${itemListName}`，不能只用 itemId，因为
  同一个商品换个 tab 需要重新报一次曝光
- 购物车场景：固定字面量，抽屉是 `side_cart`/`Side Cart`，购物车页
  是 `cart_page`/`Cart Page`

### 4. `view_item_list`（曝光类事件）——按可视区域分批上报，绝不是渲染就报

所有产品列表模块（You May Also Like、搜索结果、Best Sellers、PLP、
购物车推荐、featured-collection）用的都是同一套模式：用
`IntersectionObserver`（`threshold: 0.5`）观察每张卡片，第一次进入
可视区域就取消观察、塞进这个 section 的待上报队列，最后一张卡片进入
视口大约 300ms 后统一 flush 成**一条** `view_item_list`（防抖，避免
快速滑动时一张卡片触发一条事件）。**绝对不要**在渲染/加载完成那一刻
就推送全部商品——只报真正滑出来看到的，新滑出来的分批再报一次。
去重用 `WeakMap<section, Set<id>>`，滑过去又滑回来的卡片不会重复
触发。

分页/无限滚动的坑：Liquid 的 `forloop.index` 每一页/每次 AJAX 加载
都会从 1 重新开始，不能直接拿来当 `index`——如果模块支持翻页/加载
更多，每次观察新卡片时要按当前 DOM 真实顺序重新标记
`data-item-index`（参考 `assets/plp.js` 的 `observeGrid()`）。

### 5. `select_item`（点击商品卡片进详情页）

`button_name: 'Product Card'` 是全站统一约定，不管在哪个模块。注意
点击卡片上的 Quick Shop 按钮是**另一个**点击目标
（`[data-qs-open]`），必须从 select_item 的点击处理里排除掉
（`if (event.target.closest('[data-qs-open]')) return;`），不然
打开 Quick Shop 会被误判成一次"进商详页"点击。

### 6. 非电商类自定义事件

结构更简单，就是 `event_name` + 扁平的 `event_parameters`（没有
`items[]`）。纯文字按钮/链接的 `button_name` 取可见文案
`textContent.trim()`；纯图片、没有文字的点击（比如
`full-image.liquid` 的链接，用来做 `community_entry`），按文档规则
"图片点击传字面字符串 `"image"`"。`community_entry` 最终确定的字段名
是 **`link_url`**（不是 `button_link`——早期实现过一版用
`button_link`，后来文档正式定下 `$LinkUrl`/`link_url`，如果看到哪里
还是 `button_link` 说明是没更新的旧代码，改成 `link_url`）。

### 7. 通用 section 加埋点，默认不要加开关

第一反应是给 `full-image.liquid` 这种被 6+ 个模板复用的通用 section
加一个商家可勾选的"是否追踪"开关，**被用户明确否决过**——"只要配置了
link 就应该埋点，不需要开关"。不要预先加这种设置项当保险，不确定
某个通用 section 的埋点要不要加条件判断，先问，不要默认加勾选项。

### 8. 点击后跳转的时序坑

普通 `<a href>` 点击后浏览器立刻开始跳转，而 GTM 监听
`dataLayer.push` 之后是**异步**才真正触发标签发请求的，如果点击的是
会让当前页面跳走的链接，页面可能在 GTM 真正把请求发出去之前就卸载
了。处理方式：`event.preventDefault()`，推完 dataLayer 后
`setTimeout(() => (window.location.href = link.href), 250)` 再跳转；
按住 Ctrl/Cmd/Shift/Alt 或非左键点击（新开标签页场景）不用这么处理，
照常走浏览器默认行为，因为不会卸载当前页面。参考实现见
`assets/full-image.js`。

## 三、验证方法（每次改动都要做）

- `node --check <file>.js` 查语法，`shopify theme check` 跑全量
  （正常情况下应该只有一条跟这次改动无关的历史遗留警告——
  `product-card-list.liquid` 的 `OrphanedSnippet`，多出别的新警告/
  报错就是这次改动引入的问题）
- Liquid 改动用**临时的 alternate template**验证渲染结果（比如建一个
  `templates/collection.ga4check.json` 指向要改的 section/设置），
  在本地 `shopify theme dev` 上用 `?view=ga4check` 访问一个真实的
  collection/product 页面，grep 响应里有没有预期的 `data-*` 属性，
  **验证完立刻删掉这个临时模板文件**，不要留下来
- 涉及购物车折扣逻辑的，不要凭猜测写折算公式——直接用 `curl` 调真实
  的 `/cart/add.js`/`/cart/change.js` 接口（多次调用要带上 cookie
  jar 保持同一个购物车会话，不然每次 curl 都是全新会话），看接口
  真实返回的 `final_price`/`total_discount`/`quantity`，照着这个写
  代码
- 点击触发的运行时行为（事件到底有没有真的推送到 dataLayer）没法用
  curl 验证，要跟用户说清楚"这部分需要你在浏览器里实测"，给一个清楚
  的验证步骤清单，不要自己编一个"已验证"的结果
- 每次改动都在仓库根目录的 `GA4-verification-checklist.md` 里补一个
  `## 验证清单：<模块名>（No.X）`小节，用已有的格式（checkbox 列表、
  带日期的更新说明、简短的"代码改动"段落）——这份文件才是逐条的、
  精确到文件行号的权威记录，这份指南只总结规律，不重复细节

## 四、流程上的规矩

- 遇到 xlsx 某一行对应不上代码库里任何现有 UI 元素时，不要硬猜——
  直接问用户具体是哪个页面/哪个位置（一期里"Join our Skate
  Community"那一行就是典型例子，以为是个按钮，翻遍仓库都找不到，
  问了才知道其实是 `full-image.liquid` 的 link 设置，怎么猜都猜
  不对）
- xlsx 里的状态/进度列（不同版本文档里位置和含义都可能不一样）
  有时候是用户自己手动做的进度标记，不确认清楚含义之前不要覆盖写入
  非空的状态格子，写之前先确认没有 Excel 锁文件
- 回复统一用中文，关于这个主题前台行为的任何结论都要从代码/本地
  dev server 实测得出，不要凭猜测下结论

---

一期（sheet3 No.1-69）截至 2026-11-04 全部完成并通过验收，逐条细节
见 `GA4-verification-checklist.md`。后续新组件的埋点工作，新开一个
对话窗口直接说"帮 XX 组件加 GA4 埋点"即可，不需要重新粘贴这份文档——
如果在同一个项目目录（`d:\work\shopify-theme-new`）里开新会话，这份
文档总结的内容已经作为记忆自动加载；如果不确定记忆有没有生效，也可以
直接把这个文件路径（`GA4-tracking-guide.md`）发给我，我会重新读一遍。
