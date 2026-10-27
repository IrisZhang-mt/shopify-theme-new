# PDP 详情模块配置 SOP（交给 Claude Code 执行）

## 给运营：怎么用

1. 设计师交稿后，在网页版 Figma 把 6 张画板导出为 SVG：
   - 导出设置里**取消勾选「Outline text」**，否则文字会变成路径，读不出来
   - 6 张画板是：PC 营销海报、PC 功能卖点、PC 细节卖点，以及这 3 张对应的移动端（APP）版本
   - 把 6 个 SVG 放进同一个文件夹
2. 打开 Claude Code，把**这份文件**和 **SVG 文件夹**一起拖进去，再补一句：
   > 按这份 SOP 生成配置文档。产品 ID：`9042781896950`，SVG 在 `D:\xxx\`
   - 产品 ID 就是商品后台网址里 `/products/` 后面那串数字
   - 如果手上有图标库已有的图标名单，也一并贴上
3. Claude Code 会输出一份《元对象配置文档》（Markdown）。先看文档开头的**「需要确认」**，确认后照着文档在后台逐项填写即可。

---

## 给 Claude Code：任务说明

你的任务是读取用户提供的设计稿 SVG，输出一份运营可以照着在 Shopify 后台逐项填写的**元对象配置文档**。

注意边界：
- 只读 SVG、只写一份 Markdown 文档
- 不修改任何主题代码，不调用 Shopify 后台或 API
- 拿不准的值不要猜，写进文档的「需要确认」里

### 1. 输入

| 输入 | 必需 | 说明 |
|---|---|---|
| 产品 ID | ✓ | 纯数字，用在所有 internal_name 里。没给就先问用户 |
| SVG 文件夹 | ✓ | 一般是 6 个 SVG |
| 图标库已有名单 | | 有名单时，只为名单里没有的图标生成 SVG 代码 |

### 2. 读取 SVG 的方法

**大文件处理：**
- SVG 里内嵌了 base64 图片，单个文件可能有几十 MB，不要整体读进上下文
- 先用脚本把 `base64,[A-Za-z0-9+/=]+` 替换为 `base64,...`，再读剩下的结构
- 不要假设机器上有 Python；Windows 上用 PowerShell 的 `[regex]::Replace` 即可

**要找的元素：**

| 元素 | 用途 |
|---|---|
| `<svg width height>` | 画板尺寸，宽 1440 是 PC，宽 390 是移动端 |
| `<text>` / `<tspan x y>` | 文字及其位置；`font-size`、`fill` 用来判断角色 |
| 圆形 `<path>`，`fill="white"` 且 `fill-opacity` 约为 0.38–0.4 | 热点圆点的外圈（直径：PC 约 22，移动端约 12.4）。路径包围盒的中心就是圆心 |
| 高度为 1 的白色矩形 `<path>` | 热点引线，例如 `M342 308.09H48V309.09H342V308.09Z` |
| `stroke="#363839"` 一类的线框路径 | 图标；外圈是一个圆，PC 直径约 42，移动端约 26 |
| `<rect fill="url(#pattern…)">` | 图片区域；判断背景图是否铺满画板 |

**识别 6 个文件：**
- PC 和移动端：看画板宽度
- 模块类型：**按以下顺序判断**，先命中的为准（「功能卖点海报」「细节展示海报」里也有「海报」二字，所以营销海报放在最后）：
  1. 有热点圆点，或文件名含 `功能卖点` → 功能卖点
  2. 有 3 个并列卡片 `rect`，或文件名含 `细节` → 细节卖点
  3. 剩下的 → 营销海报
- 文件名里的 8 位数字（如 `53510406`）是设计稿款号。如果某个文件的款号和其他文件不同：
  - 照常用它出数据
  - 在「需要确认」里写明，可能是设计师交错了稿

### 3. 文案规则（所有模块通用）

1. **以 PC 稿的文案为准。** 移动端文案和 PC 不一致时（措辞、拼写如 `C0`/`CO`、大小写、截断），一律采用 PC 版本，并把每一处差异列进「需要确认」。
2. **换行：**
   - 只有标题（heading）和正文（body）保留 PC 稿里的换行。分开的 `<text>` 元素，或以 `&#10;` 结尾的 `<tspan>`，都算一次换行
   - 删掉换行前的行尾空格
   - 移动端稿的换行一律忽略，因为组件在移动端会自然折行
3. **不保留换行的字段：** 卡片正文（`pdp_detail_card.body`）、热点副标题（`subtitle`）、热点标题（`title`）都写成一行。移动端被拆成两个 `<text>` 的副标题，要合并成一句。
4. **还原实体字符：** `&#x2014;` → `—`，`&#xb7;` → `·`，`&#10;` → 换行（按上一条处理）。其余字符原样保留，包括标点和大小写。
5. **样式不用配置。** 字体、字号、颜色、对齐方式都已经在组件里按设计稿写好，两端不同也不用列进「需要确认」。唯一例外是海报文字颜色，对应字段 `text_theme`。

### 4. 各模块的提取规则

#### 4.1 营销海报 → `pdp_poster`

| 字段 | 取值 |
|---|---|
| internal_name | `{产品ID}_poster` |
| heading | PC 稿里字号最大的 Display 字体文字（约 78px），按文案规则保留换行 |
| body | PC 稿里标题下方的 Grotesk 正文（约 17px） |
| text_theme | 看 PC 标题的 `fill`：白色（`white` / `#FFF…`）填 `light`，深色填 `dark`。移动端标题颜色和 PC 不同时，写进「需要确认」 |
| image_pc / image_mob | 不从 SVG 里取，见第 6 节「图片清单」 |

#### 4.2 功能卖点 → `pdp_callout` + `pdp_hotspot` + `pdp_icon`

**`pdp_callout`**

| 字段 | 取值 |
|---|---|
| internal_name | `{产品ID}_callout` |
| heading | PC 稿中约 78px 的 Display 文字 |
| body | PC 稿中标题下方约 17px 的文字 |
| icons | 按 PC 稿里从左到右的顺序，列出图标标签 |
| hotspots | 按 PC 稿 `pc_y` 从小到大（从上到下）列出各热点的 internal_name |

**热点 `pdp_hotspot`**：每个圆点一条。

1. **先找引线，再找文字。** 每个圆点连着一条引线，标签就压在引线外端的上方。

   - 先在 PC 稿里配出每个圆点和它的引线。引线一端的 x 等于圆心 x，引线的 y 约等于圆心 y
   - 再找这条引线上方的两段文字：

   | 字段 | 怎么认 | PC 特征 | 移动端特征 |
   |---|---|---|---|
   | subtitle | 基线比引线高一点 | 14px，`#8B8C8F`；基线在引线上方约 13.5 | 8.84px，`#919191`；基线在引线上方约 10.8 |
   | title | 在 subtitle 正上方 | 17px，`#1D1D1D`；基线在 subtitle 上方约 21 | 10.73px，`#404040`；基线在 subtitle 上方约 11.3 |

   - 不要只凭字号、颜色认 title：功能卖点的 body 也是 17px 深色字，但它不在任何引线上方
   - subtitle 被拆成多个 `<text>` 时，引线上方、title 下方的几段灰字都属于它，合并成一行

   | 字段 | 取值 |
   |---|---|
   | internal_name | `{产品ID}_{title}`，例如 `9042781896950_Stand collar` |

2. **坐标**：取外圈圆点包围盒的中心。

   | 字段 | 计算方式 |
   |---|---|
   | pc_x | 圆心 x ÷ 1440 × 100 |
   | pc_y | 圆心 y ÷ PC 画板高 × 100 |
   | mob_x | 圆心 x ÷ 390 × 100 |
   | mob_y | 圆心 y ÷ 移动端画板高 × 100 |

   - 都保留 1 位小数
   - 如果找不到圆点路径，用引线靠圆点那一端的 x、引线的 y 代替，并在文档里注明「用引线推算」

3. **方向 side**：看引线从圆心往哪边延伸。往左（引线另一端的 x 小于圆心 x）填 `left`，往右填 `right`。PC 和移动端分别判断。
4. **PC 和移动端配对**：在移动端稿里用同样的方法配出每个圆点、引线和文字，再按 title 和 PC 对应起来。移动端的 title 措辞不同时，按位置和顺序推断配对，并写进「需要确认」。

**图标 `pdp_icon`**：全店共享的图标库，不按商品建。

- **label**：用 PC 稿图标下方的大写标签（约 12px）
- **已在库里**：用户给的名单里已有这个 label 的，只在文档里写「从库里选」
- **不在库里，或用户没给名单**，生成 icon_svg 代码：
  - **只用 PC 稿**（描边色以 PC 为准，移动端颜色不同不用管）
  - **哪些路径属于这个图标**：
    - 先找外圈圆，即直径约 42 的描边圆路径
    - 再找起点在外圈圆包围盒以内的描边路径。起点就是 `d` 属性里 `M` 后面的第一对坐标
    - 不要拿路径里所有的数字逐对判断：`H`、`V` 命令只带一个数，会把 x、y 的奇偶位错开
  - **核对**：各图标的路径数加起来，要等于 PC 稿里图标描边色路径的总数
  - **viewBox**：外圈圆的包围盒向外扩 1px，保留原坐标，不用平移到 0,0
  - **代码要求**：
    - `<svg` 开头、`</svg>` 结尾
    - 带 `xmlns="http://www.w3.org/2000/svg"`、`viewBox` 和 `fill="none"`，不写 `width` / `height`
    - 保留原有的 `stroke`、`stroke-width`、`stroke-linecap`、`stroke-linejoin`
  - 在文档里注明「如果设计师另外提供了 Figma『复制为 SVG』的代码，以设计师版本为准」
- PC 和移动端的标签措辞不同时（如 `REPELS WATER` 和 `WATER-REPELLENT`），用 PC 的，并写进「需要确认」

#### 4.3 细节卖点 → `pdp_detail_grid` + `pdp_detail_card`

| 字段 | 取值 |
|---|---|
| grid.internal_name | `{产品ID}_detail_grid` |
| grid.heading | PC 稿顶部约 62px 的 Display 文字 |
| grid.cards | 按 PC 稿里从左到右的顺序，列出卡片的 internal_name |
| card.internal_name | `{产品ID}_card_{名字}`，例如 `9042781896950_card_Water rolls off`。名字取标题里 `·` 之前的部分；超过 4 个词时，缩成 2–4 个词的关键词（如 `A clean stand collar` → `Stand collar`） |
| card.title | PC 稿卡片图下方约 24px 的文字 |
| card.body | 标题下方约 15px 的文字，合并成一行 |

### 5. 模块顺序

`custom.detail_modules` 的顺序固定为：营销海报 → 功能卖点 → 细节卖点。

不要从文件名里的数字推顺序，文件名里有好几段数字，含义并不统一。运营需要别的顺序时，在后台直接拖动即可。

### 6. 图片清单

SVG 里内嵌的图片是 Figma 的图片填充，可能经过了裁切和缩放，**不能直接当成上传素材**。文档里只列出需要的图片，由设计师另外交付无文字的原图。

每张图的要求尺寸**按该文件自己的画板或 rect 计算**，宽、高都四舍五入成整数：

| 位置 | 要求尺寸 |
|---|---|
| 海报 / 卖点 image_pc | PC 画板宽 × 2，高 × 2（如 1440×600 → 2880×1200） |
| 海报 / 卖点 image_mob | 移动端画板宽 × 2，高 × 2（如 390×450 → 780×900；390×536 → 780×1072） |
| 卡片 image_pc | PC 卡片 rect 宽 × 2，高 × 2（如 453×340 → 906×680） |
| 卡片 image_mob | 移动端卡片 rect 宽 × 3，高 × 3（如 111.33×139.41 → 334×418） |

如果设计稿的图片上叠了渐变或遮罩（例如移动端海报顶部为白字加的渐变），在备注里写「渐变需要做进图片里」，组件不会单独渲染它。

如果背景图的 `<rect>` 没有铺满画板，必须写进「需要确认」：热点坐标是相对画板计算的，图片比例和画板不一致时，热点会对不准。

### 7. 输出文档模板

在 SVG 文件夹的同级目录，生成 `{产品ID}-元对象配置.md`，结构如下：

```markdown
# {产品ID} 详情模块配置

> 来源：{6 个 SVG 文件名} · 生成日期

## 0. 需要确认（配置前先处理）
- 每条写清楚：位置、PC 原文 vs 移动端原文、文档里采用了哪个

## 1. 配置步骤（按顺序做）
1. pdp_icon：列出 label。用户给了名单的，写「从库里选」或「新建」；没给名单的，一律写「新建（库里已有同名图标就直接选，不要重复建）」
2. pdp_hotspot × N
3. pdp_detail_card × N
4. pdp_poster、pdp_callout、pdp_detail_grid（在其中关联上面的条目）
5. 商品 → 详情模块（detail_modules）按顺序添加
6. 删除该商品旧的 product_img_pc / product_img_mob
7. 打开商品页，用 PC 和手机各看一遍

## 2. pdp_icon
| label | 处理方式 | icon_svg |
（icon_svg 一列只写「见 2.1」这类编号，代码放在表格下方，每个图标一个代码块）

## 3. pdp_hotspot
| internal_name | title | subtitle | pc_x | pc_y | pc_side | mob_x | mob_y | mob_side |

## 4. pdp_detail_card
| internal_name | title | body |

## 5. pdp_poster
| 字段 | 值 |
（heading / body 里的换行，用代码块原样给出，方便直接复制）

## 6. pdp_callout
| 字段 | 值 |

## 7. pdp_detail_grid
| 字段 | 值 |

## 8. 商品元字段 detail_modules（顺序）
1. … 2. … 3. …

## 9. 图片清单
| 条目 | 字段 | 要求尺寸 | 备注 |
```

**写作要求：**
- 字段值要能直接复制：不加多余的引号，不用 Markdown 格式包裹文案
- 带换行的值放进代码块；单行的值直接写在表格里
- 表格里的数值都保留 1 位小数

### 8. 交付前自检

- [ ] 每个热点 PC、移动端的坐标都在 0–100 之间，方向只有 `left` / `right`
- [ ] 用 PC 坐标反算像素（x × 1440 ÷ 100），确认和 SVG 里的圆心误差 < 1px
- [ ] 热点、卡片、图标的数量，和 PC 稿一致
- [ ] 所有 internal_name 都以产品 ID 开头，并且互不重复
- [ ] 每条 icon_svg 都以 `<svg` 开头、以 `</svg>` 结尾，并且带 `viewBox`
- [ ] 「需要确认」覆盖了所有 PC / 移动端的文案差异、款号不一致、图片没铺满画板的情况

### 附：后台字段速查（不要改这些 key）

| 定义 | 字段 |
|---|---|
| `pdp_poster` | internal_name, heading, body, image_pc, image_mob, text_theme（light / dark） |
| `pdp_callout` | internal_name, heading, body, image_pc, image_mob, icons（列表 → pdp_icon）, hotspots（列表 → pdp_hotspot） |
| `pdp_hotspot` | internal_name, title, subtitle, pc_x, pc_y, pc_side, mob_x, mob_y, mob_side |
| `pdp_icon` | label, icon_svg |
| `pdp_detail_grid` | internal_name, heading, cards（列表 → pdp_detail_card） |
| `pdp_detail_card` | internal_name, image_pc, image_mob, title, body |
| 商品元字段 | `custom.detail_modules`（列表，混合引用，允许上面 3 种模块） |
