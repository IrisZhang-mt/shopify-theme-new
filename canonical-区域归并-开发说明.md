# canonical 区域副本归并：开发说明

> 状态：**需求待 SEO 经理确认，尚未改任何代码**（2026-11-19）
> 换机继续开发时先读本文件，再读第五节"待确认"的回复结论。

## 一、需求来源

SEO 部门提出：区域副本（`/en-gb`、`/es-ca`、`/fr-ca`、`/ms-eu` 等）抢了主站权重。
例如跑鞋博客 `/blogs/journal/best-kids-running-shoes` 的区域副本在 W46（11/8–11/14）曝光 2,311 次，
超过了主站的 1,142 次；主站美国主词平均排名 12–15。

需求经过三轮讨论，**最终规则见第三节**（已经不是最初的"全部指回英文主站"）。

## 二、线上现状（2026-11-19 实测 moodytiger.com）

- canonical 由主题输出：`layout/theme.liquid:87` 写的是 `<link rel="canonical" href="{{ canonical_url }}">`；
  `og:url`（同文件约第 112 行）也用 `canonical_url`。Shopify 不会另外注入 canonical，所以主题可以完全控制它。
- 当前所有副本的 canonical 都**指向自身**，例如 `/en-gb/...` 的 canonical 就是 `/en-gb/...`。
- hreflang 由 Shopify Markets 通过 `content_for_header` 自动注入，主题无法修改（需求也要求不动）。
  每页约 1401 条，约 160KB。主站在 hreflang 里标注为 `en` + `x-default`，没有 `en-US`。
- 副本内容分两类：
  - `en-*` 副本的标题和正文与主站完全一致，属于重复内容。
  - `es` / `fr` / `ar` / `de` / `ms` / `zh` 是**已翻译**的版本，带地区后缀的副本（如 `/es-ca`）和对应的语言根页（`/es`）内容一致。
- hreflang 中出现的全部前缀（moodytiger.com 下）：
  - 语言根页：`/es` `/ar` `/de` `/fr` `/ms` `/zh`（都返回 200；`/en` 返回 404，这是正常的，en 就是主站）
  - 带后缀的副本：语言 ∈ {en, es, ar, de, fr, ms} × 后缀 ∈ {au, ca, eu, gb, intl, jp, kr, my, sg}
  - `zh` 没有带后缀的副本
- 香港站是独立子域名 `hk.moodytiger.com`，路径形如 `/zh-tw`、`/fr`，同样在 hreflang 组里（见第五节第 2 条）。
- 首页的 canonical 末尾没有斜杠：`/en-gb` 首页的 canonical 是 `https://moodytiger.com/en-gb`。

## 三、最终规则（用户 11-19 定稿，对应讨论中的"方案 B：按语言归并"）

| 当前 URL | canonical 指向 |
|---|---|
| `/en-{market}/路径` | `https://moodytiger.com/路径` |
| `/{lang}-{market}/路径`（如 `/es-ca`、`/ar-gb`） | `https://moodytiger.com/{lang}/路径` |
| 语言根页 `/es` `/fr` `/ar` … | 不变（指向自身） |
| 主站 `/路径` | 不变（指向自身） |
| hreflang | 不动 |

**验收标准**：在 GSC 网址检查中，"Google 选择的规范网址"等于对应的语言根页（`en-*` 对应主站）。

## 四、实现草案（未验证，开发时以实测为准）

思路：`routes.root_url` 在 `/es-ca` 页面上是 `/es-ca`，在主站上是 `/`。
在 `canonical_url` 里把这个前缀替换成语言根前缀即可，不需要正则。

```liquid
{%- liquid
  # canonical：/{lang}-{market} 区域副本归并到语言根页（en → 主站）
  # 规则见 canonical-区域归并-开发说明.md
  assign canonical_href = canonical_url
  assign merge_langs = 'en,es,ar,de,fr,ms' | split: ','
  if routes.root_url != '/' and routes.root_url contains '-'
    assign locale_prefix = routes.root_url | remove_first: '/'
    assign prefix_parts = locale_prefix | split: '-'
    assign prefix_lang = prefix_parts | first
    if prefix_parts.size == 2 and merge_langs contains prefix_lang
      if prefix_lang == 'en'
        assign canonical_href = canonical_url | remove_first: routes.root_url
      else
        assign lang_root = '/' | append: prefix_lang
        assign canonical_href = canonical_url | replace_first: routes.root_url, lang_root
      endif
      # 首页：https://moodytiger.com/en-gb → https://moodytiger.com 需要补 /
      if canonical_href contains '://'
        assign after_scheme = canonical_href | split: '://' | last
        unless after_scheme contains '/'
          assign canonical_href = canonical_href | append: '/'
        endunless
      endif
    endif
  endif
-%}
<link rel="canonical" href="{{ canonical_href }}">
```

开发时要注意的点：

- **数组的 `contains` 是精确匹配元素**，`merge_langs contains 'en'` 不会误匹配 `'en-gb'`。实现时实测确认一次。
- **白名单**只放 `en es ar de fr ms`，不在名单里的前缀（如 `zh-tw`）保持指向自身，避免 canonical 指到一个不存在的语言根页（404）。
  以后主市场新增语言时，要把它加进白名单。
- **首页补斜杠只针对 `en`**。`/es-ca` 首页应该输出 `https://moodytiger.com/es`，要和现有 `/es` 首页的 canonical 格式一致：
  先 curl `/es` 首页确认它到底带不带斜杠，再调整上面的补斜杠逻辑（目前写法对 es 不会补，因为 `moodytiger.com/es` 里已经有 `/`）。
- 本地 `theme dev`（127.0.0.1）下 `canonical_url` 的域名可能不是 moodytiger.com，**要用临时开发主题 + 真实域名 + `preview_theme_id` 验证**。
- `og:url` 是否同步改成 `canonical_href`：默认同步，等 SEO 确认（见第五节第 4 条）。
- 页面范围的判断条件（`request.page_type`）等第五节第 1 条确认后再加。
- `theme.liquid` 是高风险文件，只改 canonical 和 `og:url` 两处，不顺手改别的。

## 五、待 SEO 经理确认（11-20 回复）

1. **适用范围**：只做博客 + pages，还是包括产品页，或者全站所有页面类型？
   如果包括产品页：`/en-gb`、`/en-ca` 等英文产品页会指向主站的 USD 价格页面，如果接了 Merchant Center 多国家 feed，可能会出现链接与 canonical 不一致的警告。
2. **`hk.moodytiger.com`**：不是 `/{lang}-{market}` 格式，按规则会保持指向自身。这是否符合预期？香港站是否也在用这个主题？
3. **新增语言的处理**：默认用白名单，不在名单里的保持指向自身（见第四节）。
4. **`og:url`**：默认和 canonical 同步修改。

已经告知 SEO 的风险：hreflang 仍然会把 `/en-gb` 等副本标为对应地区的版本，和新的 canonical 存在信号冲突，这是这个方案本身带来的，不是实现 bug。
"美国主词进前 10"不作为验收标准。

**回复结论**（11-20，SEO 对五条都回复"ok"）：

1. 适用范围：**只做博客 + pages**（`request.page_type` ∈ article / blog / page，对应 `theme.liquid` 里的 `merge_page_types`）。
   产品页这期不做（11-19 17:19 定：`/en-gb` 产品页指主站会把 USD 价格页当规范页），products 模板和集合页保持自指。
2. `hk.moodytiger.com` 保持指向自身：同意。
3. 新增语言走白名单（en es ar de fr ms）：同意。
4. `og:url` 和 canonical 同步修改：同意。
5. 首页单独处理（`/en-gb` → `https://moodytiger.com/`，`/es-ca` → `https://moodytiger.com/es`）：同意。
   11-20 实测线上 `/es` 首页的 canonical 是 `https://moodytiger.com/es`（没有末尾斜杠），所以 es 等语言不补斜杠，只有 en 需要补。
   按第 1 条的暂定范围，首页（index）不在范围内，这段补斜杠逻辑要等范围扩大到全站才会用到。

## 六、验证清单

在临时开发主题上用真实域名加 `?preview_theme_id=<id>` 逐一 curl，提取 `<link rel="canonical">`：

- [ ] 主站：首页、博客文章、page、产品页（如在范围内）→ 指向自身
- [ ] `/en-gb`、`/en-intl`、`/en-eu` 的同一批页面 → 主站同路径；首页 → `https://moodytiger.com/`
- [ ] `/es-ca`、`/ar-gb`、`/fr-ca`、`/ms-eu` → `/{lang}/同路径`；首页 → 和 `/es` 首页的格式一致
- [ ] `/es`、`/fr`、`/zh` → 不变
- [ ] 博客列表 `?page=2` → 分页参数保留
- [ ] 不在范围内的页面类型 → 不变
- [ ] hreflang 输出和改动前一致（条数仍为 1401）
- [ ] `og:url` 与 canonical 一致（如已确认同步）
- [ ] 上线后：在 GSC 网址检查跑鞋博客和鞋子尺码页的区域副本（尺码页 handle 待 SEO 提供）
