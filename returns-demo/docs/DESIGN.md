# 系统设计说明

> 本文档描述的分层架构在两个后端实现中保持一致：
> **当前主后端 `backend-java/`（Java / Spring Boot 3.5 / Spring Data JPA）**，
> 以及保留作参照的 `src/`（Node / Express）。两者接口契约完全一致，前端与冒烟测试通用。
> 换数据库的方式：Java 版换 Spring profile + 数据源配置（见第 7 节）；Node 版换仓储适配器。

## 1. 架构

```text
浏览器（public/index.html，三岗位工作台）
        │  fetch + Bearer token
        ▼
┌─ Java 后端（backend-java，Spring Boot）───────────────────────────┐
│  controller/        REST 接口：参数解析、@RequireRole 岗位门禁     │
│  service/           业务规则与状态机校验（AftersaleService 等）    │
│  common/            AuthInterceptor（Bearer 认证）、统一异常      │
│  domain/            状态字典 + 合法流转表（AftersaleStatus 枚举）  │
└──────────────┬────────────────────────────────────────────────────┘
               │ Spring Data JPA（repository/ 接口，无手写 SQL）
               ▼
┌─ 数据源（application.yml 配置）───────────────────────────────────┐
│  默认 profile → H2 文件库（本地零安装）                            │
│  mysql profile → 其他设备上的 MySQL（DB_HOST 等环境变量）         │
└───────────────────────────────────────────────────────────────────┘
```

分层原则：**Controller 只做参数解析，Service 拥有全部业务规则，Repository 只做数据读写**。
业务代码不写 SQL（JPA 方法名/JPQL）；数据库实现不出现业务判断。

## 2. 售后单状态机

```text
                 ┌──────────────┐ 补充材料 ┌──────────────┐
   提交申请      │  SUBMITTED   │◄─────────│MATERIAL_     │
  ┌────────────►│  待客服审核   │          │REQUESTED     │
  │             └─┬─────────┬──┘ 要求补充 └──────▲───────┘
  │    同意退回    │         │ 拒绝               │
  │               ▼         ▼                    │
  │      RETURN_APPROVED   REJECTED(终态)        │
  │      已同意退回                               │
  │               ▼                              │
  │      RECEIVED 仓库已收货                      │
  │               ▼ 验货(通过/异常)               │
  │      INSPECTED 已验货待结论                   │
  │          ┌────┴─────┐                        │
  │  最终结论▼          ▼ 拒绝(终态)              │
  │   COMPLETED       REJECTED                   │
  │  售后完成(终态)                               │
  └── 拒绝/完成的单据不再占用可售后数量 ──
```

- 状态字典与合法后继：`src/state-machine.js`；每次流转都由 `canTransit` 校验。
- `COMPLETED` 与 `REJECTED` 为终态；只有这两个状态（及 CLOSED）会释放可售后数量。

## 3. 数据库表结构

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| users | id, username, password_hash, salt, name, role | role: consumer/service/warehouse；scrypt 加盐哈希 |
| sessions | token(PK), user_id, created_at | 会话持久化，重启服务不掉登录 |
| orders | id(PK), user_id, status, created_at | 模拟订单，仅 COMPLETED 可申请售后 |
| order_items | (order_id,id) 联合主键, name, price, qty, aftersalable_qty | aftersalable_qty 为可售后上限 |
| aftersale_tickets | id(AS0001), seq, order_id, item_id, user_id, type, reason, qty, description, status, refund_amount, reship_tracking_no, inspect_result, created_at/updated_at | 售后单主表 |
| aftersale_images | ticket_id, filename | 图片凭证（文件名模拟） |
| aftersale_events | ticket_id, operator_name, operator_role, action, note, created_at | 时间线：每次状态变化记录岗位+时间+说明 |

## 4. 页面 – 接口 – 数据字段对应

| 页面元素 | 接口 | 主要数据字段 |
| --- | --- | --- |
| 我的订单表 | GET /api/me/orders | orders.id / order_items.name,price,aftersalable_qty / SUM(tickets.qty) 为 usedQty |
| 申请表单 | POST /api/tickets | type,reason,qty,description,images → tickets 各列 |
| 售后单卡片 | GET /api/my/tickets、GET /api/tickets?status= | tickets 主表 + images + events |
| 时间线 | 同上（timeline） | aftersale_events：action/operator_role/note/created_at |
| 审核按钮组 | POST /api/tickets/:id/review | status 流转 + refund_amount / reship_tracking_no |
| 仓库收货/验货 | POST /api/tickets/:id/warehouse | status 流转 + inspect_result |

## 5. 权限矩阵（接口 × 角色）

| 接口 | 消费者 | 客服 | 仓库 |
| --- | :-: | :-: | :-: |
| POST /api/login、/api/meta | ✓ | ✓ | ✓ |
| GET /api/me/orders、/api/my/tickets | 本人 | ✗403 | ✗403 |
| POST /api/tickets、…/supplement | 本人单据 | ✗403 | ✗403 |
| GET /api/tickets（列表） | ✗403 | ✓ | ✓ |
| GET /api/tickets/:id | 仅本人（403） | ✓ | ✓ |
| POST …/review | ✗403 | ✓ | ✗403 |
| POST …/warehouse | ✗403 | ✗403 | ✓ |

## 6. 状态设计（正常 / 空数据 / 异常 / 无权限）

- 正常：上述链路全通；
- 空数据：工作台显示"暂无售后单。"，订单无可售后数量时下拉不出现该商品；
- 异常：所有 400 错误返回中文原因并直接展示（toast / 错误行），如超量、重复申请、验货异常未填原因；
- 无权限：401 未登录跳回登录，403 返回明确文案（越权查看、消费者调审核接口等）。

## 7. 数据库切换（接入其他设备的数据库）

### 7.1 Java 后端（当前主后端）：Spring profile + 数据源配置

JPA 屏蔽数据库差异，换库只改配置，业务代码零改动。

**接入其他设备上的 MySQL：**

```bash
cd backend-java
java -jar target/returns-backend-1.0.0.jar --spring.profiles.active=mysql
```

连接信息用环境变量覆盖（默认值见 `application.yml` 的 mysql profile）：

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| DB_HOST | 127.0.0.1 | 目标设备 IP |
| DB_PORT | 3306 | MySQL 端口 |
| DB_USER | root | 账号（建库需相应权限） |
| DB_PASSWORD | （空） | 密码 |
| DB_NAME | returns_demo | 库名（连接串含 createDatabaseIfNotExist=true） |

首次启动自动建库、由 `ddl-auto: update` 建表、由 SeedRunner 写入演示账号与订单。
申请数量校验在事务内用 `@Lock(PESSIMISTIC_WRITE)`（SELECT ... FOR UPDATE）锁商品行，防并发超量。
H2 数据文件位于 `backend-java/data/`（已 gitignore）。

**再换其他数据库（如 PostgreSQL / SQL Server）：** 在 `pom.xml` 加对应 JDBC 驱动依赖，
复制 `application.yml` 中 mysql profile 改一段连接配置即可；冒烟测试
（`SMOKE_BASE_URL=http://127.0.0.1:3000 node test/smoke.js`）可直接当验收用例。

### 7.2 Node 参照后端：仓储契约 + 适配器

业务代码只依赖 `src/store/contract.js` 的仓储契约，换库 = 换适配器。

- 默认 SQLite（`DB_DRIVER=sqlite`）；
- `DB_DRIVER=mysql DB_HOST=<设备IP> ... npm start` 接入其他设备 MySQL；
- 新增数据库：按契约实现新适配器并在 `src/store/index.js` 注册。
