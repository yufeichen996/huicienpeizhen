# 图标统一与后续替换清单

当前已建立 `components/app-icon`，接入 Huicien Care Icons v1.0 的 24×24、1.9px 统一线性图形。主包仅保留实际使用的蓝/灰 72×72 PNG 和对应 SVG 原稿。正式页面不再渲染 Emoji 功能图标，也未引入字体或大型 UI 图标库。

| 场景 | 当前方案 | 后续正式资源要求 |
| --- | --- | --- |
| 首页四入口 | `appointment / companion / medicine / report` SVG + PNG | 真机确认 46rpx 内部尺寸与彩色柔和容器的对比度 |
| 底部 Tab | `home / appointment / orders / profile` 蓝/灰 PNG | 真机确认选中态和 Home Indicator 区域 |
| 收藏 | `favorite` 蓝/灰 PNG | 后续可补充实心收藏状态，当前保持统一线性风格 |
| 消息 | `message` PNG | 补充真实消息中心后再设计空态和未读状态 |
| 个人中心 | patient、coupon、address、service、feedback、agreement、privacy、security、about | 真机小尺寸清晰度和中老年识别性测试 |
| 订单快捷入口 | payment、service、clock、rating | 真机确认 24px 视觉重量一致 |

剩余黑/白状态和未使用图标没有复制进主包。若品牌视觉继续调整，应从 `design-assets/icons` 修改源稿并重新导出对应 72×72 PNG，避免直接拉伸现有位图。
