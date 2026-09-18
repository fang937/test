# 开发者文档

面向后续接手本项目的开发者：环境搭建、代码结构、核心机制、常见开发任务、测试与调试。
（接口字段明细见 `docs/API.md`，架构与状态机图见 `docs/DESIGN.md`，面向使用者的说明见 `docs/USER-GUIDE.md`。）

## 1. 项目概览

服装网店退换货处理系统（课程 Demo）：消费者提交退货/换货申请，售后客服审核，仓库收货验货，客服给出最终结论，全过程记录时间线。

- **主后端**：`backend-java/`，Java（Spring Boot 3.5 + Spring Data JPA），本地默认 H2 文件库；
- **前端**：单文件 `public/index.html`（原生 HTML/CSS/JS，无构建步骤），构建时复制到 Java 后端的 `static/`；
- **参照实现**：`src/`，Node/Express 版后端，与 Java 版接口契约完全一致，用于对照与备选；
- **测试**：`test/smoke.js`，30 条断言的 HTTP 冒烟测试，Java/Node 后端通用；
- 数据全部模拟：不接真实资金、物流、电商平台；图片凭证只记录文件名。

## 2. 开发环境要求

| 工具 | 版本要求 | 说明 |
| --- | --- | --- |
| JDK | ≥ 17（本机为 25，`pom.xml` 按 17 语法编译） | `D:\vscode\java\JDK` |
| Maven | ≥ 3.6 | 本机未装全局 Maven，用项目根 `tools/apache-maven-3.9.9/bin/mvn` |
| Node.js | ≥ 22.5（可选） | 仅运行冒烟测试或 Node 参照后端时需要 |

无需安装数据库：默认 H2 文件库；要连 MySQL 时才需要目标设备上有 MySQL 5.7+/8.x。

## 3. 目录结构

```text
returns-demo/
├── backend-java/                    ★ Java 主后端（Spring Boot）
│   ├── pom.xml                      依赖：web / data-jpa / h2(runtime) / mysql(runtime)
│   ├── data/                        H2 数据文件（运行时生成，已 gitignore）
│   └── src/main/
│       ├── java/com/demo/returns/
│       │   ├── ReturnsApplication.java    Spring Boot 入口
│       │   ├── common/                    认证拦截器 / 注解 / 异常 / 口令散列 / 安全
│       │   │   ├── AuthInterceptor.java   Bearer token（含 7 天有效期校验）→ req attr "user"
│       │   │   ├── RequireRole.java       方法/类级岗位注解
│       │   │   ├── WebConfig.java         拦截器注册（排除 login/meta/health）
│       │   │   ├── LoginRateLimiter.java  登录失败限流（429）
│       │   │   ├── SecurityHeadersFilter.java  安全响应头 + API 禁缓存
│       │   │   ├── CorsConfig.java        CORS（默认关闭，CORS_ALLOWED_ORIGINS 放开）
│       │   │   ├── JacksonConfig.java     整数字段拒绝字符串（qty="1" → 400）
│       │   │   ├── ApiException.java      业务异常（status 即 HTTP 码）
│       │   │   ├── GlobalExceptionHandler.java  统一 {"error": "..."} 响应
│       │   │   └── PasswordUtil.java      PBKDF2WithHmacSHA256 + 随机盐
│       │   ├── domain/                    Role / TicketType / AftersaleStatus（状态机在此）
│       │   ├── entity/                    7 张表的 JPA 实体
│       │   ├── repository/                Spring Data JPA 接口（无手写 SQL）
│       │   ├── service/
│       │   │   ├── AftersaleService.java  ★ 全部业务规则（核心文件）
│       │   │   ├── AuthService.java       登录/登出/会话
│       │   │   └── SeedRunner.java        空库时写入演示账号与订单
│       │   └── controller/                Auth / Consumer / Staff 三组 REST 接口
│       └── resources/
│           ├── application.yml            默认 H2 + mysql profile + 日志/优雅停机
│           └── static/                    （构建时由 pom 从 ../public 自动复制，源码中不存在）
├── public/index.html                前端源文件（改这里）
├── src/                             Node/Express 参照后端（分层同构）
│   ├── app.js / config.js / state-machine.js
│   ├── routes/ services/ middleware/ utils/
│   └── store/                       仓储契约 contract.js + sqlite/mysql 适配器
├── test/smoke.js                    通用冒烟测试
├── scripts/reset.js                 Node 版数据重置
├── Dockerfile                       多阶段构建（Maven 构建 → JRE 17 运行）
├── docker-compose.yml               app + MySQL 8.4 一键部署（数据持久化卷）
├── .env.example                     部署环境变量模板（复制为 .env）
├── scripts/build-java.sh            构建 Java 后端（自动定位/下载 Maven）
├── scripts/reset-java.js            重置 Java 版（H2）演示数据
├── docs/                            API / DESIGN / USER-GUIDE / DEVELOPER / DEPLOY
├── tools/apache-maven-3.9.9/        本地 Maven（已 gitignore）
└── package.json                     Node 侧脚本（start/reset/smoke）
```

## 4. 本地运行

### 4.1 Java 后端（主）

```bash
# Git Bash（本仓库默认 shell）
export JAVA_HOME='D:\vscode\java\JDK'
cd backend-java
'D:\大学\大作业\tools\apache-maven-3.9.9\bin\mvn' -DskipTests package
java -jar target/returns-backend-1.0.0.jar          # http://localhost:3000

# 开发期免打包热改代码用：
# mvn spring-boot:run
```

- 首次启动 SeedRunner 检测空库后写入演示数据（4 账号 + 2 订单），已有数据不重复写；
- H2 文件落在 `backend-java/data/`；**重置数据 = 停服务后删除 `backend-java/data/` 再启动**；
- 改端口：`server.port`（application.yml）或启动参数 `--server.port=8080`。

### 4.2 冒烟测试（两种后端通用）

```bash
SMOKE_BASE_URL=http://127.0.0.1:3000 node test/smoke.js   # 测运行中的后端（如 Java 版）
npm run smoke                                              # 起 Node 测试实例自测（独立 smoke.db）
```

### 4.3 Node 参照后端（备选）

```bash
npm install && npm start          # 端口同样 3000，与 Java 版二选一运行
npm run reset                     # 重置 Node 版演示数据
```

## 5. 配置与环境变量

`backend-java/src/main/resources/application.yml`，两个 profile：

| 配置 | 默认 profile（H2） | mysql profile |
| --- | --- | --- |
| 数据源 | `jdbc:h2:file:${H2_FILE:./data/aftersale}` | `jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?createDatabaseIfNotExist=true...` |
| 建表 | `ddl-auto: update` | `ddl-auto: update` |
| 切换方式 | 默认 | 启动参数 `--spring.profiles.active=mysql` + 环境变量 |

环境变量清单：`H2_FILE`、`DB_HOST`(127.0.0.1)、`DB_PORT`(3306)、`DB_USER`(root)、`DB_PASSWORD`(空)、`DB_NAME`(returns_demo)、`server.port`(3000)。

Node 版对应配置在 `src/config.js`（`DB_DRIVER=sqlite|mysql` 等，见 `docs/DESIGN.md` 7.2）。

## 6. 核心机制速览

### 6.1 认证与岗位权限

1. `POST /api/login` 校验账号密码（PBKDF2 验证），生成随机 token 存 `sessions` 表（重启不掉登录）；
2. 后续请求带 `Authorization: Bearer <token>`；`AuthInterceptor` 查 `sessions` 把 `UserEntity` 放入 request attribute `"user"`；
3. 接口用 `@RequireRole("consumer")` / `@RequireRole({"service","warehouse"})` 声明岗位，不匹配抛 403；
4. 无注解的接口（如 `GET /api/tickets/{id}`）登录即可访问，数据归属校验在 Service 层（消费者只能看本人单据）。

> 加新接口时：只写 Controller + 注解即可获得权限控制，不要在 Controller 里手写角色 if。

### 6.2 状态机（`domain/AftersaleStatus.java`）

```
SUBMITTED ─┬─> MATERIAL_REQUESTED ─> SUBMITTED（补充材料后回审）
           ├─> RETURN_APPROVED ─> RECEIVED ─> INSPECTED ─┬─> COMPLETED（终态）
           └─> REJECTED（终态）                           └─> REJECTED（终态）
```

- 每个枚举值声明自己的合法后继（`canTransitTo`），非法流转在 `AftersaleService.transit()` 统一拦截；
- **改流程先改这里**：新增状态或调整流转只动 `AftersaleStatus`，Service 的 `transit()` 自动生效；前端 `STATUS` 字典（index.html）与 `/api/meta` 同步返回标签文案。

### 6.3 业务规则与代码位置对照

| 规则（需求文档） | 实现位置 |
| --- | --- |
| 只能对本人已完成订单申请售后 | `AftersaleService.createTicket()`：比对 `item.order.user.id` 与订单状态 |
| 申请数量 ≤ 剩余可售后数量 | `createTicket()`：`@Lock(PESSIMISTIC_WRITE)` 锁商品行 + `sumInFlightQty()` 统计进行中占用 |
| 客服同意退回后仓库才能收货 | `receive()`：状态前置校验（状态机兜底） |
| 验货 ≠ 退款/换货完成 | `review()` 的 `FINAL_APPROVE` 分支要求 `status == INSPECTED` |
| 拒绝/补充材料/验货异常必填原因 | `requireNote()`、`inspect()` 的 `require(...)` |
| 每次状态变化留痕 | `transit()` / `review()` 统一写 `aftersale_events`（岗位+时间+说明） |
| 售后单号与可售后数量释放 | `createTicket()` 的 `AS%04d` 序号；`sumInFlightQty` 只排除 REJECTED，终态不占数量 |

### 6.4 数据模型（7 张表）

```
users ──< sessions                     （会话，token 为主键）
users ──< orders ──< order_items       （orders.user_id / order_items.order_id 外键）
users ──< aftersale_tickets ──┬─< aftersale_images
                              └─< aftersale_events
aftersale_tickets.item_fk → order_items.id
```

实体类 ↔ 表 ↔ API 字段的完整对应表见 `docs/DESIGN.md` 第 3、4 节。要点：

- 对外编号（`orderNo`/`itemId`/`ticketNo`）与数据库代理主键（自增 `id`）分离，接口只暴露前者；
- 金额用 `int`（元），避免浮点误差——Demo 范围内够用；
- 时间入库 `LocalDateTime`，出参统一 `yyyy/M/d HH:mm:ss` 格式化（`AftersaleService.FMT`）。

### 6.5 安全与运维机制

| 机制 | 实现位置 | 说明 |
| --- | --- | --- |
| 登录限流 | `common/LoginRateLimiter.java`（Node: `utils/rate-limiter.js`） | 同「账号+IP」10 分钟失败 5 次 → 429；多实例部署需换 Redis |
| 会话有效期 | `SessionRepository.SESSION_TTL`（7 天）+ `AuthService.cleanExpiredSessions()` 每小时清理 | 拦截器只认有效期内会话 |
| 安全响应头 | `SecurityHeadersFilter`（Node: `app.js` 内中间件） | nosniff / DENY / no-referrer；`/api/*` 禁缓存 |
| CORS | `CorsConfig` + `CORS_ALLOWED_ORIGINS` | 默认同源（不放开任何来源） |
| 严格类型 | `JacksonConfig` | Integer 字段拒绝 JSON 字符串（前端已改为发送数字） |
| 409 状态冲突 | `AftersaleService.transit()/receive()/review(FINAL_APPROVE)` | 与 400 业务规则错误区分 |
| 健康检查 | `GET /api/health`（双后端） | 含数据库探活，503 = DOWN |
| 滚动日志 | `application.yml` logging 段 | logs/app.log，10MB × 14 天 |
| 优雅停机 | `server.shutdown: graceful` | SIGTERM 后最多 20s 处理存量请求 |

## 7. 常见开发任务

### 7.1 新增一个接口（示例：客服备注）

1. `dto/` 新增 `record StaffNoteRequest(String note) {}`；
2. `StaffController` 加方法：`@PostMapping("/tickets/{id}/note")` + `@RequireRole("service")`，从 request attribute 取当前用户，调 Service；
3. `AftersaleService` 加业务方法（校验 + 写库 + `toView()` 返回）；
4. 前端 `public/index.html` 加按钮与 `fetch` 调用；
5. 同步前端副本（第 9 节）、`test/smoke.js` 补断言、`docs/API.md` 补条目。

### 7.2 新增/修改表字段

1. 改对应 `entity/` 类（加字段+getter，构造函数按需）；
2. H2：删 `backend-java/data/` 重启重建；MySQL：`ddl-auto: update` 只加列不删列、不改类型，结构变更大时建议先备份再重建库；
3. 涉及 API 输出时同步改 `toView()`/DTO 与前端展示。

### 7.3 新增演示账号或模拟订单

改 `service/SeedRunner.java` 的 users/orders 列表 → 删 H2 数据目录重启。注意：只对**空库**生效。

### 7.4 调整状态或流程

改 `AftersaleStatus`（标签+流转）→ Service 相应分支 → 前端 `STATUS` 字典与操作按钮渲染条件（`ticketActionsHtml()`）。

## 8. 测试

`test/smoke.js` 为纯 HTTP 断言式冒烟测试（无测试框架依赖）：

- 覆盖需求文档 6 条核心验收场景 + 登出失效、筛选、退款金额等，共 30 条断言；
- 加用例：照现有 `call(method, path, {token, body})` + `ok(cond, '名称')` 风格追加即可；
- 断言输出 `✓/✗` 与最终统计，失败退出码 1，可直接接 CI。

## 9. 前端开发说明

- 单文件 `public/index.html`：DJI 风格 UI，无框架无构建；逻辑全在底部 `<script>`（登录态存 sessionStorage）；
- **同步已自动化**：`pom.xml` 配置了 maven-resources-plugin（copy-frontend），`mvn package` 时自动把 `public/` 复制进 jar 的 `static/`，无需手工拷贝；Docker 构建同样自动带入；
- 角色工作台渲染入口：`boot()` 按 `me.role` 显隐区块；售后单卡片渲染：`ticketCard()` / `ticketActionsHtml()`；
- API 调用统一走 `api(path, method, body)`（自动带 Bearer token，非 2xx 抛中文错误信息）；数量等字段必须按 JSON 数字发送（服务端拒绝字符串）。

## 10. 数据库切换与扩展

- **H2 → 其他设备的 MySQL**：`--spring.profiles.active=mysql` + `DB_HOST` 等环境变量；自动建库建表写种子数据；并发安全由事务内 `SELECT ... FOR UPDATE` 保证（`OrderItemRepository.lockByOrderNoAndItemId`）；
- **再换 PostgreSQL 等**：`pom.xml` 加 JDBC 驱动 + 复制一段 profile 配置，业务代码零改动；冒烟测试当验收用例；
- Node 版换库走 `src/store/` 仓储适配器（`docs/DESIGN.md` 7.2）。

## 11. 调试技巧

- 看实时日志：Java 后台启动时控制台输出 SQL 需在 `application.yml` 加 `spring.jpa.show-sql: true`（建议临时开启）；
- H2 网页控制台（可选）：加 `spring.h2.console.enabled: true` 后访问 `/h2-console`，JDBC URL 填 `jdbc:h2:file:./data/aftersale`；
- 接口自测：`curl -s -X POST localhost:3000/api/login -H 'Content-Type: application/json' -d '{"username":"kefu","password":"123456"}'` 拿 token 后带 `Authorization` 头调试；
- 时间线/状态异常时优先查 `aftersale_events` 表（每次流转都有留痕，能定位到具体操作）。

## 12. 已知技术债与注意事项

1. 登录限流为单实例内存实现，多实例部署需换 Redis 等共享存储（`docs/DEPLOY.md` 第 7 节）；
2. `createTicket()` 的 `synchronized` 只是进程内去抖，真正的并发安全依赖事务内行锁；多实例部署时以数据库锁为准；
3. `ddl-auto: update` 适合 Demo/小规模生产，破坏性变更需手工迁移（建议引入 Flyway/Liquibase）；
4. 会话 TTL 固定 7 天，无「强制下线」管理功能；
5. 时间以字符串格式返回前端（与 Node 版契约对齐）；如改 ISO 格式需同时改两处前端渲染；
6. 演示账号密码固定 `123456`（SeedRunner 硬编码），上线前必须修改（`docs/DEPLOY.md` 检查表）。
