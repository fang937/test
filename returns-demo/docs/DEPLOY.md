# 上线部署指南

本文档说明如何把本系统部署为一套对外可访问的服务（Docker 方式为主，裸机方式为辅），
以及上线前检查、日常运维和回滚方法。

## 1. 部署架构

```text
                 ┌──────────── docker compose ────────────┐
用户浏览器 ──▶ :3000 │  app (Spring Boot jar, JRE 17)      │
                 │    │  · SPRING_PROFILES_ACTIVE=mysql    │
                 │    │  · 健康检查 /api/health             │
                 │    └──▶ mysql:8.4（数据卷 mysql-data）    │
                 └────────────────────────────────────────┘
生产建议在最前方加 Nginx / 云负载均衡做 TLS 终结（见第 6 节）
```

## 2. 快速上线（Docker Compose，推荐）

前置条件：目标机器已安装 Docker 24+ 与 Docker Compose v2，3000 端口可用（可用 `APP_PORT` 改）。

```bash
# 1) 获取代码
git clone <仓库地址> && cd returns-demo
# （或直接上传整个项目目录）

# 2) 准备环境变量
cp .env.example .env
vi .env        # 必改：MYSQL_ROOT_PASSWORD / DB_PASSWORD（两者保持一致）

# 3) 构建并启动（首次构建约 3-10 分钟，自动下载依赖镜像）
docker compose up -d --build

# 4) 验证
curl http://127.0.0.1:3000/api/health      # {"status":"UP","db":"mysql"}
docker compose ps                          # mysql 与 app 均为 healthy/running
```

浏览器访问 `http://<服务器IP>:3000`，用演示账号登录（见 `docs/USER-GUIDE.md`）。

> 演示账号密码固定为 `123456`（SeedRunner 写入）。**上线前必须修改**（见第 5 节检查表）。

## 3. 数据与日志

| 内容 | 位置（容器内） | 载 / 说明 |
| --- | --- | --- |
| MySQL 数据 | 数据卷 `mysql-data` | 持久化，`docker compose down` 不丢数据 |
| 应用日志 | `/app/logs` → 数据卷 `app-logs` | Spring Boot 滚动日志，单文件 10MB、保留 14 天 |

常用运维命令：

```bash
docker compose logs -f app        # 跟看应用日志
docker compose restart app        # 重启应用
docker compose down               # 停止（保留数据）
docker compose down -v            # 停止并删除全部数据（危险）
```

**数据库备份 / 恢复：**

```bash
docker compose exec mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" returns_demo > backup.sql
docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" returns_demo < backup.sql
```

## 4. 升级与回滚

```bash
# 升级：拉取新代码后重新构建启动（数据保留在卷中，表结构由 ddl-auto 兼容性变更）
git pull
docker compose up -d --build

# 回滚：切回上一个发布标签重新构建
git checkout <上一个版本标签>
docker compose up -d --build
```

应用启用优雅停机（最长 20 秒），`docker compose restart` / 升级时正在处理的请求不会被粗暴切断。

## 5. 上线前检查表

- [ ] 修改 `.env` 中 `MYSQL_ROOT_PASSWORD` / `DB_PASSWORD` 为强密码；
- [ ] 修改演示账号密码：当前为教学演示固定 `123456`，上线前修改 `SeedRunner.java` 中的口令后重建（或自行执行 SQL 更新 users 表 `password_hash`/`salt`）；
- [ ] 前后端分离部署时设置 `CORS_ALLOWED_ORIGINS=https://你的前端域名`（同源部署留空）；
- [ ] 配置 HTTPS：由前置 Nginx/负载均衡做 TLS 终结（应用本身只出 HTTP，见第 6 节）；
- [ ] 确认 `/api/health` 通过负载均衡健康检查；
- [ ] 演示数据评估：首次启动会写入演示账号与订单，生产可登录后清理或重建业务数据。

## 6. 非 Docker 部署（裸机 jar + 外部 MySQL）

```bash
# 构建（或在本机构建后上传 jar）
bash scripts/build-java.sh

# 运行（JDK ≥ 17）
java -jar backend-java/target/returns-backend-1.0.0.jar \
     --spring.profiles.active=mysql \
     --server.port=3000
# 连接信息用环境变量：DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
```

systemd 托管示例（`/etc/systemd/system/returns.service`）：

```ini
[Unit]
Description=Returns After-Sale Service
After=network.target mysql.service

[Service]
User=app
WorkingDirectory=/opt/returns
Environment=DB_HOST=127.0.0.1 DB_USER=returns DB_PASSWORD=*** DB_NAME=returns_demo
Environment=SPRING_PROFILES_ACTIVE=mysql
ExecStart=/usr/bin/java -jar backend/target/returns-backend-1.0.0.jar
SuccessExitStatus=143
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

前置 Nginx TLS 示例：

```nginx
server {
    listen 443 ssl;
    server_name after.example.com;
    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

应用读取 `X-Forwarded-For` 用于登录限流的来源标识。

## 7. 已知差距（与真正生产系统的距离）

1. **HTTPS** 需前置反代完成，应用未内嵌证书配置；
2. 登录限流为单实例内存实现，多实例部署需换 Redis 等共享存储；
3. 会话固定 7 天有效期、无「强制下线」管理功能；
4. 图片凭证仍是文件名模拟，未实现对象存储上传；
5. 退款/补发单号为模拟数据，未接真实资金与物流；
6. `ddl-auto: update` 不做破坏性迁移，重大表结构变更需 DBA 手工处理（建议引入 Flyway）；
7. 无监控指标导出（可按需接入 Spring Boot Actuator + Prometheus）。
