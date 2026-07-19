# 汇慈恩陪诊统一订单后端

这是“汇慈恩陪诊”当前预上线阶段的统一订单服务，同时为合作机构端和平台总管理端提供接口。当前实现采用 Node.js 24 自带的 `node:http` 与 `node:sqlite`，不依赖外部 Web 框架。

## 当前边界

- 已接入真实密码登录、Bearer Session、RBAC、机构数据隔离和操作审计。
- 已接入机构订单创建、修改、发布、支付确认、派单/改派、取消和履约记录查询。
- 已接入平台管理员账号、机构管理、全机构订单查看、服务/陪诊师价格、审核、结算和审计查询。
- 微信登录、微信支付、小程序远程 API 和订阅消息发送均由功能开关控制，测试环境默认关闭。
- C 端和陪诊师端仍以本地 Mock/Storage 为主，不能把当前测试环境视为生产可用。

## 本地运行

要求 Node.js 24 或更高版本。

```powershell
npm run db:migrate:test
npm run server:test
```

本地地址：

```text
合作机构端：http://127.0.0.1:8797/
平台总管理端：http://127.0.0.1:8797/admin/
健康检查：http://127.0.0.1:8797/api/health
```

测试账号只来自 `.env.test`，不得复制到生产：

```text
机构：kangyi_admin / HuicienTestOrg@2026
平台：huicien_admin / HuicienTestAdmin@2026
```

正式环境首次启动时，如果数据库尚无平台管理员，会读取下列变量创建首个账号：

```text
BOOTSTRAP_ADMIN_LOGIN_NAME
BOOTSTRAP_ADMIN_DISPLAY_NAME
BOOTSTRAP_ADMIN_PASSWORD
```

不得在生产环境使用测试密码。数据库已经存在管理员后，重启服务不会覆盖原账号或密码；登录后可在总管理端“账号管理”中新增管理员、启停账号和重置密码。

## 鉴权与权限

登录成功后服务端返回随机 Session Token；数据库只保存 SHA-256 Token 摘要，前端使用：

```http
Authorization: Bearer <token>
```

生产和测试默认都关闭 `ALLOW_DEMO_AUTH`。旧的 `x-demo-role`、`x-institution-id`、`x-institution-account-id` 请求头不能获得权限。

登录保护包括：

- scrypt 密码摘要；
- 连续失败 5 次锁定账号 15 分钟；
- 登录尝试记录；
- Session 过期与主动注销；
- Nginx 登录限流配置；
- API CORS 白名单、CSP 与安全响应头。

机构端权限：

```text
VIEW_DASHBOARD
PUBLISH_ORDER
MANAGE_ORDERS
```

平台权限：

```text
PLATFORM_DASHBOARD
VIEW_ALL_ORDERS
MANAGE_INSTITUTIONS
MANAGE_ACCOUNTS
MANAGE_PRICING
ADJUST_ORDERS
REVIEW_COMPANIONS
REVIEW_EXCEPTIONS
REVIEW_EXPENSES
MANAGE_PERMISSIONS
VIEW_OPERATION_LOGS
```

## 金额与历史价格

数据库内金额统一使用整数“分”。订单保存服务价格和陪诊师价格快照，后续修改价格不会反向改变历史订单。

```text
订单合计 = 服务价格快照 + 陪诊师价格快照
```

陪诊师价格优先取“陪诊师 + 服务”的覆盖价，否则取服务默认陪诊师价。

## 数据库

迁移文件：

```text
server/migrations/001_prelaunch_schema.sql
```

执行：

```powershell
npm run db:migrate:test
```

迁移由 `schema_migrations` 和 `PRAGMA user_version` 记录，当前版本为 1。测试库为 `server/.data/huicien-v2-test.sqlite`。

## 门户构建

```powershell
npm run build:portals:test
```

输出：

```text
dist/institution
dist/admin
```

构建时通过 `ORG_API_BASE_URL` 和 `ADMIN_API_BASE_URL` 注入 API 地址。

## 验证

```powershell
npm run test:server
npm run test:prelaunch
npm run check
```

`test:prelaunch` 会验证真实密码登录、Demo 请求头失效、机构隔离、平台跨机构可见性、订单完整履约链、审核结算、上传限制、审计脱敏和注销失效。

部署、备份和接口接入状态见：

- `docs/DEPLOYMENT_INVENTORY.md`
- `docs/BACKUP_AND_ROLLBACK.md`
- `docs/BACKEND_ORG_PRELAUNCH_CHECKLIST.md`
- `docs/API_INTEGRATION_STATUS.md`
- `docs/DATABASE_SCHEMA_V1.md`
