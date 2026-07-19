# 备份与回滚方案

## 安全边界

所有脚本只操作 `/opt/huicien-v2`、`/var/www/huicien-v2`、`/var/log/huicien-v2`、`/var/backups/huicien-v2` 和 PM2 进程 `huicien-api-v2-test`，不操作旧系统目录或其他 PM2 进程。

当前代码快照：

```text
基线提交：ef5dfd8 feat: complete new multi-end system
基线标签：v1.0.0-pre-deployment
```

## 部署前备份

`deploy/scripts/deploy-test.sh` 会先创建时间戳目录，再备份数据库、后端、机构端和总管理端，随后才同步新版本。

手工备份：

```bash
sudo bash deploy/scripts/backup-test.sh
```

产物：

```text
huicien-v2-test.sqlite
backend-files.tgz
uploads.tgz
org-files.tgz
admin-files.tgz
huicien-v2-test.conf
pm2-jlist.json
```

服务器 `.env*` 不进入发布归档或备份归档，回滚时保留服务器密钥配置。SQLite 必须使用 `.backup`，不能在服务写入时直接复制活动数据库文件。备份目录默认保留 14 天；正式上线前应再接入异机或对象存储，并开启加密与访问审计。

## 回滚

选择明确的备份目录：

```bash
sudo bash deploy/scripts/rollback-test.sh \
  /var/backups/huicien-v2/YYYYmmdd-HHMMSS
```

顺序：

1. 仅停止 `huicien-api-v2-test`；
2. 恢复后端和两个门户；
3. 恢复 SQLite 备份；
4. 可用时恢复上传文件；
5. 重新加载指定 PM2 应用；
6. 执行 Nginx 配置检查并重载；
7. 请求测试 API 健康检查。

## 数据库迁移回滚原则

当前迁移 `001_prelaunch_schema.sql` 只创建新表和索引，采用幂等迁移记录。生产迁移前必须先完成数据库备份。涉及删除列、改类型或数据重写的后续迁移不得自动回滚，应提供独立的前向修复迁移和经过验证的数据恢复脚本。

## 恢复演练验收

- PM2 只存在并启动 `huicien-api-v2-test`；
- `/api/health` 返回 `code: 0`；
- 机构账号可登录且只看到本机构订单；
- 平台账号可看到各机构订单；
- 上传文件元数据与文件实体一致；
- 操作日志、订单状态日志和结算数据完整；
- 回滚前后的数据库行数与抽样订单一致。

当前未取得测试服务器权限，以上远程恢复演练尚未执行。
