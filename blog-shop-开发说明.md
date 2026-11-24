# Blog 文章页「商品承接」开发说明（2026-11-23）

适用范围：`/blogs/journal/` 全部文章页（新主题）。功能按文章逐篇开启，**未配置的文章输出与改动前完全一致**（不加载任何新 CSS/JS）。

设计稿：Figma「moodytiger网站2026」→ 页面「2026.11.16 blog 设计」
- PC 商品轮播 1479:6798 ／ 移动端 1479:7959
- PC 文字链 hover 卡 1479:6931
- 配图热点卡 1479:6959（252 × 108）

## 一、三个功能

| 功能 | 怎么开启 | PC | 移动端 / 平板触屏 |
|---|---|---|---|
| SHOP THIS SECTION 商品轮播 | 文章元字段 `custom.shop_products` 选商品 + 正文里单独一行写 `[shop-this-section]` | 每页 3 个，左右箭头，「1 / 3」= 第几页 / 共几页 | 横滑，「2 / 7」= 第几个 / 共几个 |
| 文字链商品卡 | 正文商品链接末尾加 `#shop`，例：`https://moodytiger.com/products/kids-beanie#shop` | 鼠标悬停出卡（链接下方），Add to bag → Quick Shop | 不弹卡，点击直接跳商品页 |
| 配图热点 | 文章元字段 `custom.shop_hotspots` 引用「配图热点」条目 | 默认半透明；悬停出卡（点右侧），移开消失；点击固定 + 出现 ×；固定时悬停其它点只变实心 | 默认展开每张图第一个点（卡在点下方）；点其它点切换；× 关闭 |

共同规则：
- 已售罄商品自动不展示（轮播里跳过、链接不弹卡、热点的点隐藏）。
- 轮播最多展示 12 个商品（运营一般配 4–9 个）。
- 每张图最多 3 个热点（多配的忽略）。
- 隐藏轮播：在正文 HTML 里把占位行注释掉（`<!-- [shop-this-section] -->`）或删掉，商品配置保留；去掉注释即恢复。

## 二、上线前需要在后台创建（一次性）

**设置 → 自定义数据 → 博客文章（Blog posts）** 新建 2 个元字段定义：

| 名称（建议） | Namespace and key | 类型 |
|---|---|---|
| Shop this section 商品 | `custom.shop_products` | 商品 – 列表（Product, list） |
| 配图热点 | `custom.shop_hotspots` | 元对象 – 列表（Metaobject, list），引用下方的「配图热点」 |

**设置 → 自定义数据 → 元对象（Metaobjects）** 新建定义「配图热点」，类型（type）必须是 `blog_hotspot`，字段 key 必须一致：

| 字段名 | key | 类型 | 说明 |
|---|---|---|---|
| 第几张正文图 | `image_index` | 整数 | 按正文里图片出现的顺序，从 1 开始数 |
| 横向位置 % | `pos_x` | 小数（0–100） | 在**原图文件**上量：从左往右的百分比 |
| 纵向位置 % | `pos_y` | 小数（0–100） | 在**原图文件**上量：从上往下的百分比 |

> Shopify 要求字段 key 至少 2 个字符，所以不能用 `x` / `y`。
| 商品 | `product` | 商品引用 | |

> 坐标用原图百分比，主题会按页面上图片的实际裁切换算，所以 PC 和移动端裁切不同也能对准。

## 三、运营配置步骤（以一篇文章为例）

1. 文章编辑页 → 元字段 → `Shop this section 商品` 选 4–9 个商品（顺序即展示顺序）。
2. 正文中想放轮播的位置，**单独一行**输入 `[shop-this-section]`（不要和其它文字写在同一段）。
3. 想要悬停卡片的商品链接，在链接地址末尾加 `#shop`。
4. 配图热点：新建「配图热点」条目（图序号 / x / y / 商品），在文章元字段 `配图热点` 里引用。
5. 预览检查：移动端第一个点的卡片会盖住图上约三分之一的区域，点位尽量分散（见第五节）。

## 四、GA4 埋点（新增，待补进在线飞书表 sheet3）

| 场景 | 事件 | item_list_id | item_list_name |
|---|---|---|---|
| 轮播卡片曝光（进入视口 50%，300ms 合批） | `view_item_list` | `blog_shop_this_section` | `Shop This Section_<文章标题>` |
| 点轮播卡片进商品页 | `select_item`（button_name `Product Card`） | 同上 | 同上 |
| 文字链卡片出现 | `view_item_list` | `blog_product_link` | `Product Link_<文章标题>` |
| 点文字链卡片的图/名称 | `select_item`（`Product Card`） | 同上 | 同上 |
| 热点卡片打开且在视口内 | `view_item_list` | `blog_photo_hotspot` | `Photo Hotspot_<文章标题>` |
| 点热点卡片的图/名称 | `select_item`（`Product Card`） | 同上 | 同上 |
| 任一卡片的 QUICK SHOP / Add to bag | 由 quick-shop.js 上报 `select_item`（`QUICK SHOP`）→ `view_item` → `add_to_cart` | 同所属列表 | 同所属列表 |

同一商品在同一列表里，一次页面浏览只曝光一次。文字链本身的点击仍由 article.js 上报 `links_entry`（行为不变）。

## 五、已知限制 / 注意

- **移动端热点卡会遮挡**：卡片固定 252 × 108，图片宽约 345，卡片会占图片约三分之一。卡片会自动避开其它点（下方 → 上方 → 靠左/右），实在避不开时其它点会被盖住，用户需先点 × 再点。建议运营把点位分散、或用竖图。
- **带热点的整宽图不做视差滚动**：视差会让图片在框内移动、点位偏离商品，所以只对配了热点的图关闭视差，其它图不受影响。
- 文字链卡片按商品 handle 识别，每篇最多识别 10 个不同的 `#shop` 商品。
- 设计稿中的面包屑、目录、Quick summary、FAQ、正文链接整体变橙色等改版内容不在本期范围。

## 六、文件

- `snippets/article-shop.liquid`（content / tail / pop 三部分）
- `assets/article-shop.css`、`assets/article-shop.js`
- `sections/main-article.liquid`：正文输出改为 `render 'article-shop'`（+1 行 tail）
- `locales/en.default.json`：`article.shop_section`、`article.add_to_bag`
