# 汇慈恩陪诊页面与调用清单

审计日期：2026-07-13
审计范围：`app.json`、32 个注册页面的 TS/WXML/JSON/WXSS、公共组件、Store、Service、Mock、工具和实际跳转调用。

| 页面 | 路径 | 模块 / Tab | 实际入口 → 主要出口 | Store / Service | 公共组件 | 状态 | 占位、无响应、重复或废弃 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 首页 | `pages/home/index` | 首页 / Tab | 启动、Tab → 搜索、预约、服务详情、陪诊员、医院 | Booking Store；本地统一 Mock | navbar、card、icon、companion-card、hospital-chip、sheet | 完成 | 无 |
| 预约入口 | `pages/book/index` | 预约 / Tab | Tab、各预选入口 → 当前预约步骤 | Booking Store | navbar、card、empty-state | 完成 | 无 |
| 选择服务 | `pages/booking-service/index` | 预约 | 预约入口、确认页修改 → 选择时间 | Booking Store；booking service | navbar、stepper、action-bar | 完成 | 无 |
| 选择时间 | `pages/booking-time/index` | 预约 | 服务步骤、确认页修改 → 选择陪诊员 | Booking Store；hospital service | navbar、stepper、action-bar | 完成 | 无定位距离 |
| 选择陪诊员 | `pages/booking-companion/index` | 预约 | 时间步骤、确认页修改 → 确认订单 | Booking Store；companion service | navbar、stepper、action-bar | 完成 | 排班为 Mock |
| 确认订单 | `pages/booking-confirm/index` | 预约 | 陪诊员步骤 → 登录、就诊人、成功页 | Booking/User Store；booking/patient/user service | navbar、stepper、action-bar | 完成 | 支付为模拟 |
| 预约成功 | `pages/booking-success/index` | 预约 | 确认订单 → 订单详情、首页、新预约 | Order Store；booking service | navbar | 完成 | 无 |
| 订单列表 | `pages/orders/index` | 订单 / Tab | Tab、个人中心、成功页 → 订单详情 | Order/User Store；order/user service | navbar、order-card、empty/login | 完成 | 无 |
| 订单详情 | `pages/order-detail/index` | 订单 | 订单列表、成功页 → 评价、再次预约、订单 Tab | Order/Booking Store；order service | navbar、status、timeline、actions、dialog | 完成 | 支付/联系为模拟 |
| 订单评价 | `pages/order-review/index` | 订单 | 订单详情 → 返回订单详情 | Order Store；order service | navbar | 完成 | 无图片上传 |
| 我的 | `pages/profile/index` | 我的 / Tab | Tab → 登录、订单、资料、设置页面 | User/Patient/Profile/Order Store | navbar、profile、order-shortcuts、settings、login | 完成 | 会员开通为说明性入口 |
| 登录 | `pages/login/index` | 账户 | 登录拦截 → 返回原页面 | User Store；user service | navbar、login-sheet | 完成 | 微信真实登录未接入 |
| 编辑资料 | `pages/profile-edit/index` | 账户 | 我的 → 返回我的 | User Store；user service | navbar | 完成 | 头像上传未接入 |
| 就诊人列表 | `pages/patients/index` | 就诊人 | 我的、预约确认 → 新增/编辑 | Patient/User Store；patient/user service | navbar、patient-card、empty | 完成 | 无 |
| 就诊人编辑 | `pages/patient-edit/index` | 就诊人 | 列表、预约确认 → 返回来源页 | Patient/Booking Store；patient service | navbar | 完成 | 无 |
| 我的收藏 | `pages/favorites/index` | 个人数据 | 我的 → 三类详情 | Profile/User Store | navbar、empty-state | 完成 | 不存在对象会安全忽略 |
| 优惠券 | `pages/coupons/index` | 个人数据 | 我的 → 预约 Tab | Profile/Booking/User Store | navbar、empty-state | 完成 | 仅本地 Mock 优惠券 |
| 常用地址 | `pages/addresses/index` | 个人数据 | 我的 → 页内编辑 | Profile Store | navbar、empty-state | 完成 | 暂未用于取送地址下单 |
| 客服 | `pages/customer-service/index` | 服务支持 | 详情、我的 → 电话/说明 | 无业务 Store | navbar | 原型完成 | 真实客服渠道未接入 |
| 意见反馈 | `pages/feedback/index` | 服务支持 | 我的 → 返回我的 | Storage | navbar | 原型完成 | 图片仅本地选择，不上传 |
| 服务协议 | `pages/agreement/index` | 内容 | 登录、我的 → 返回来源 | 无 | navbar | 完成 | 文本待法律审核 |
| 隐私政策 | `pages/privacy/index` | 内容 | 登录、我的 → 返回来源 | 无 | navbar | 完成 | 文本待法律审核 |
| 账号与安全 | `pages/account-security/index` | 设置 | 我的 → 返回我的 | User Store | navbar、settings | 原型完成 | 实名/注销为正式接入点 |
| 关于我们 | `pages/about/index` | 设置 | 我的 → 客服 | user mock | navbar | 完成 | 版本检查为本地提示 |
| 全局搜索 | `pages/search/index` | 搜索 | 首页 → 四类详情、全部结果 | Storage；search/service/hospital/companion service | navbar、search、history、empty | 完成 | 无网络搜索 |
| 搜索结果 | `pages/search-result/index` | 搜索 | 搜索页 → 对应详情 | search service | navbar、empty-state | 完成 | 无 |
| 服务列表 | `pages/services/index` | 服务目录 | 搜索/详情入口 → 服务详情、预约 | Booking/Profile Store；service/favorite service | navbar、service-card、login、empty | 完成 | 模拟分页 |
| 服务详情 | `pages/service-detail/index` | 服务目录 | 首页、搜索、收藏、列表 → 医院、客服、预约 | Booking/Profile Store；service/hospital/favorite service | navbar、favorite、faq、login | 完成 | 无 |
| 陪诊员列表 | `pages/companions/index` | 陪诊员 | 首页、搜索 → 详情、预约 | Booking/Profile Store；companion/favorite service | navbar、search、favorite、login、empty | 完成 | 模拟分页和 Mock 档期 |
| 陪诊员详情 | `pages/companion-detail/index` | 陪诊员 | 首页弹层、搜索、收藏、列表 → 服务、医院、客服、预约 | Booking/Profile Store；companion/favorite service | navbar、favorite、review、login | 完成 | 排班/客服为原型 |
| 医院列表 | `pages/hospitals/index` | 医院 | 搜索及浏览入口 → 医院详情 | Profile Store；hospital/favorite service | navbar、search、hospital-card、login、empty | 完成 | 不申请定位、不显示距离 |
| 医院详情 | `pages/hospital-detail/index` | 医院 | 首页、搜索、收藏、列表 → 服务、陪诊员、预约 | Booking/Profile Store；hospital/service/companion/favorite service | navbar、favorite、login | 完成 | 医院均为服务地点展示 |

## 清理结论

- 已删除未被任何入口引用的 `pages/placeholder/index`。
- 已删除零引用的 `components/feature-entry`。
- 已删除与正式 Booking Store 重复、仅由 App 全局对象持有但无页面使用的旧 `store/app-store.ts`。
- 当前没有重复注册页面；所有 32 个路由均有实际入口或属于四步流程的内部步骤。
- 说明性能力仍保留在现有页面中：真实微信登录、支付、客服、图片上传、会员、正式接口及法律审核，不伪装为已上线功能。
