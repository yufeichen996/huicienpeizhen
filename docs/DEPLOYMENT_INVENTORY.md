# 预上线部署清单

更新日期：2026-07-19

## 系统与构建产物

| 系统 | 源码 | 构建/运行方式 | 测试目标 |
| --- | --- | --- | --- |
| C 端微信小程序 | `miniprogram/` | 微信开发者工具 | AppID 与后端接入前保持 Mock |
| 陪诊师端微信小程序 | `companion-miniprogram/` | 微信开发者工具 | AppID 与后端接入前保持 Mock |
| 统一订单 API | `server/` | Node.js 24 + PM2 | `api-test.huicien.com` |
| 合作机构端 | `server/public/index.html`、`app.js` | `dist/institution/` | `org-test.huicien.com` |
| 平台总管理端 | `server/public/admin.html`、`admin.js` | `dist/admin/` | `admin-test.huicien.com` |

## 独立部署目录

预上线配置只使用新目录和新 PM2 进程，不覆盖其他系统：

```text
/opt/huicien-v2/backend
/var/www/huicien-v2/org
/var/www/huicien-v2/admin
/var/log/huicien-v2
/var/backups/huicien-v2
PM2: huicien-api-v2-test
```

## 环境与入口

- 本地测试配置：`.env.test`
- 配置模板：`.env.example`
- 生产模板：`.env.production.example`
- Nginx：`deploy/nginx/huicien-v2-test.conf`
- PM2：`deploy/pm2/ecosystem.config.cjs`
- 日志轮转：`deploy/logrotate/huicien-v2`
- 测试环境部署：`deploy/scripts/deploy-test.sh`

测试域名只是目标配置。当前没有远程服务器、DNS、SSH、证书或云控制台凭据，因此没有执行远程上传、PM2 启动、Nginx 重载、证书签发或公网 HTTPS 验证。

## 运行前依赖

- Linux 服务器与受限 SSH 部署账号；
- Node.js 24、npm、PM2；
- Nginx、sqlite3、rsync、tar、curl；
- 三个测试域名 DNS 解析；
- 三个测试域名有效证书；
- 在服务器 `/opt/huicien-v2/backend/.env.test` 注入真实随机密钥和测试环境密码；发布同步会排除 `.env*`，不得直接使用仓库样例值；
- 可写的数据、上传、日志、备份目录；
- 防火墙只开放 80/443，8797 仅监听 `127.0.0.1`。

## 本地已验证

- 数据库迁移和 30 张表创建；
- API 真实密码登录与 Session；
- 合作机构端、总管理端本地页面登录和 Session 恢复；
- 两套门户测试环境构建；
- 机构隔离、平台跨机构查看、审计与文件上传限制；
- 从客户订单到履约、异常、费用、审核、结算的数据库业务链。

## 尚未远程验证

- DNS 生效；
- HTTPS 证书链与自动续期；
- Nginx `nginx -t`；
- PM2 重启拉起与开机自启；
- Linux 目录权限；
- 公网 CORS；
- 远程备份恢复演练；
- 真实微信登录、支付与订阅消息。
