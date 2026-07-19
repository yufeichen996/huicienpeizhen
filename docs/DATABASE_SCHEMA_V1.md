# 数据库结构冻结：V1

冻结日期：2026-07-19

迁移版本：1

权威定义：`server/migrations/001_prelaunch_schema.sql`

## 表清单

| 领域 | 表 |
| --- | --- |
| 迁移 | `schema_migrations` |
| 机构与权限 | `institutions`、`roles`、`permissions`、`role_permissions`、`platform_accounts`、`institution_accounts`、`auth_sessions`、`login_attempts` |
| 用户与资源 | `users`、`patients`、`hospitals`、`services`、`companions`、`companion_reviews`、`companion_prices` |
| 统一订单 | `orders`、`order_assignments`、`order_status_logs`、`companion_tasks` |
| 履约 | `service_execution_nodes`、`service_execution_records`、`service_exceptions`、`order_expenses`、`uploaded_files` |
| 财务与审计 | `settlements`、`operation_logs` |
| 微信预留 | `external_identities`、`payment_transactions`、`subscription_consents` |

共 30 张表、13 个业务索引。迁移脚本使用 `CREATE ... IF NOT EXISTS` 并由 `schema_migrations` 记录校验和。

## 核心约束

- 金额字段使用整数分，不保存浮点元；
- 订单保存 `service_price_snapshot`、`companion_price_snapshot` 和 `total_amount`；
- 订单保留 `source`、`institution_id`、`user_id` 与就诊人快照；
- 就诊人姓名、手机号、证件号以及订单就诊人快照中的姓名和手机号由应用层 AES-256-GCM 加密后落库；
- 机构查询必须同时匹配 `orders.institution_id`；
- 履约记录同时绑定 `order_id`、`node_id` 和 `companion_id`；
- 异常可绑定具体 `node_id`，凭证保存为文件引用数组；
- 订单分配和状态变化分别写入不可替代的历史表；
- 操作日志记录操作者、资源、时间、请求 ID 和脱敏元数据；
- Session 表只保存 Token 哈希，不保存明文 Token；
- 微信身份、支付交易和订阅授权只冻结结构，功能开关默认关闭。

## 迁移规则

1. 已发布迁移不得原地修改；
2. 后续变更新增递增编号 SQL；
3. 迁移前必须执行 SQLite `.backup`；
4. 禁止在应用启动时静默删除列或重写金额；
5. 高风险结构变更使用“新增字段/表—双写—校验—切换—清理”的前向迁移；
6. 生产多实例或高并发前需评估迁移到 PostgreSQL，金额和审计语义保持不变。
