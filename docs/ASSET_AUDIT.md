# 图片与静态资源审计

审计日期：2026-07-13。文件系统层面主包源码估算为 **371,652 bytes（约 362.9 KiB）**；微信最终上传包会受开发者工具编译、压缩和 Source Map 设置影响。

| 文件 | 大小 | 实际使用位置 | 重复 | 压缩 / WebP | 主包策略 | 结论 |
| --- | ---: | --- | --- | --- | --- | --- |
| `assets/icons/blue/*.png` | 22 files / 32,956 B | 首页、Tab 选中、收藏、消息、设置、订单快捷入口 | 与灰色为必要状态变体 | 已为 72×72 透明 PNG | 保留主包 | 正式运行资源 |
| `assets/icons/gray/*.png` | 22 files / 38,605 B | Tab 未选中、未收藏、返回 | 与蓝色为必要状态变体 | 已为 72×72 透明 PNG | 保留主包 | 正式运行资源 |
| `design-assets/icons/*.svg` | 22 files / 6,853 B | 图标可编辑原稿 | 否 | SVG 原稿，不转 WebP | 小程序目录外 | 不进入微信主包 |
| `assets/images/shanghai-hospital-hero.svg` | 1,052 B | 首页 Banner | 否 | SVG 已很小，无需 WebP | 保留主包 | 已优化 |
| `assets/images/companion-wang-meilin.svg` | 388 B | 陪诊员 Mock、列表与详情 | 否 | 无需转换 | 保留主包 | 已优化 |
| `assets/images/companion-lin-xiaowen.svg` | 370 B | 陪诊员、订单、收藏 | 否 | 无需转换 | 保留主包 | 已优化 |
| `assets/images/companion-chen-jianguo.svg` | 351 B | 陪诊员 Mock、列表与详情 | 否 | 无需转换 | 保留主包 | 已优化 |
| `assets/images/huicien-logo.svg` | 301 B | 登录弹层、关于我们 | 否 | 无需转换 | 保留主包 | 已优化 |
| `assets/images/avatar-default.svg` | 234 B | 游客头像、用户头像兜底 | 否 | 无需转换 | 保留主包 | 已优化 |

## 结论

- 小程序运行资源共 50 个：44 个 PNG 图标和 6 个 SVG 图片，合计 74,257 B；另有 22 个 SVG 图标原稿存放于 `design-assets/icons`，不进入微信主包。无 JPG/JPEG/WebP、Base64、临时 Figma URL或网络图片。
- 图标只复制实际使用的蓝/灰 PNG 和对应 SVG 原稿，没有把黑/白及预览文件打入主包；最大单文件约 2.6 KiB。
- 陪诊员列表图片已启用 `lazy-load`；首页关键 Banner 不懒加载，避免首屏闪烁。
- 当前资源规模不适合为了分包单独搬迁；移动这些公共小资源会增加重复打包风险。
- 正式头像、医院封面或用户上传图片接入后，应补充加载失败兜底、CDN 尺寸参数和 WebP/AVIF 能力检测。
