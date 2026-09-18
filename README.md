# 服装网店退换货处理系统

模拟服装网店售后部门：消费者提交退货/换货申请，售后客服审核，仓库收货验货，客服给出最终结论，全过程记录时间线。
系统按**可上线标准**交付：安全加固（登录限流、会话有效期、安全响应头）、健康检查、滚动日志、优雅停机、
Docker 一键部署（应用 + MySQL）。

## 快速上线（Docker Compose）

```bash
cp .env.example .env      # 修改其中的数据库密码
docker compose up -d --build
curl http://127.0.0.1:3000/api/health   # {"status":"UP","db":"mysql"}
```

详见 **[docs/DEPLOY.md](docs/DEPLOY.md)**（含裸机部署、Nginx TLS、备份恢复、回滚、上线检查表）。

## 本地开发运行

**主后端为 `backend-java/`（Java 17 语法，Spring Boot 3.5 + Spring Data JPA）**，
本地默认 H2 文件数据库（零安装）；`src/`（Node/Express 版）保留为参照实现，接口契约一致。

```bash
npm run build:java                 # 构建（自动定位 Maven，必要时自动下载）
java -jar backend-java/target/returns-backend-1.0.0.jar   # http://localhost:3000
npm run reset:java                 # 重置 Java 版（H2）演示数据
```

接入其他设备的 MySQL：`java -jar ... --spring.profiles.active=mysql`（`DB_HOST` 等环境变量），
详见 `docs/DESIGN.md`「数据库切换」。

## 冒烟测试（两种后端通用，34 条断言）

```bash
SMOKE_BASE_URL=http://127.0.0.1:3000 node test/smoke.js   # 测运行中的后端（如 Java 版）
npm run smoke                                              # 测 Node 参照实现（独立实例）
```

覆盖：正常换货/退货全流程、超量与重复申请、补充材料重审、仓库提前收货（409）、
验货异常后客服结论、消费者越权 403、健康检查、字符串数量拒绝、登录限流 429、登出失效等。

## 演示账号（密码均为 123456）

| 账号 | 角色 |
| --- | --- |
| xiaolin / xiaomei | 消费者 |
| kefu | 售后客服 |
| cangguan | 仓库人员 |

## 核心链路

消费者选商品提交售后申请 → 客服审核（同意退回 / 要求补充材料 / 拒绝）→ 消费者补充材料或寄回 → 仓库登记收货、验货 → 客服确认模拟退款或换货补发 → 售后单完成（终态）。

## 已实现的关键业务规则与安全机制

**业务规则**

- 只能对本人已完成订单申请售后（越权返回 403/400）；
- 申请数量不能超过该商品可售后数量，拒绝/完成的单据释放数量；并发安全由事务内 `SELECT ... FOR UPDATE`（JPA `@Lock(PESSIMISTIC_WRITE)`）保证；数量必须是 JSON 数字，字符串被拒绝；
- 客服同意退回后仓库才能登记收货（状态机校验，违反返回 409 状态冲突）；
- 验货不等于退款/换货完成，最终结论由客服给出；
- 拒绝、补充材料、验货异常必须填写原因；
- 每次状态变化记录操作岗位、时间和说明（aftersale_events 时间线）；
- 模拟退款金额/补发单号，不接真实资金；
- 密码 PBKDF2WithHmacSHA256 加盐哈希入库。

**安全与运维**

- 登录失败限流：同「账号+IP」10 分钟内失败 5 次临时锁定（429）；
- 会话有效期 7 天，过期自动清理（每小时调度）；
- 安全响应头（nosniff / DENY / no-referrer），API 响应禁缓存；
- CORS 默认关闭，分离部署时用 `CORS_ALLOWED_ORIGINS` 精确放开；
- `/api/health` 健康检查（含数据库探活）、滚动日志（10MB×14 天）、优雅停机。

## 工程结构

```
backend-java/                 ★ Java 后端（当前主后端）
  pom.xml                     Maven 配置（Spring Boot 3.5 / JPA / H2 / MySQL）
  src/main/resources/
    application.yml           默认 H2 配置 + mysql profile（换库只改配置）
    static/index.html         前端单页（三岗位工作台，与 public/ 同步）
  src/main/java/com/demo/returns/
    ReturnsApplication.java   Spring Boot 入口
    domain/                   Role / TicketType / AftersaleStatus（状态机）
    entity/                   7 张表的 JPA 实体（Java对象 ↔ 数据库字段对应）
    repository/               Spring Data JPA 仓储接口
    service/                  AftersaleService（业务规则）/ AuthService / SeedRunner
    controller/               Auth / Consumer / Staff 三组 REST 接口
    common/                   认证拦截器、@RequireRole、统一异常、口令散列
public/index.html             前端源文件（构建时复制到 backend-java static）
src/                          Node/Express 参照后端（接口契约与 Java 版一致）
test/smoke.js                 通用冒烟测试
docs/API.md                   接口清单
docs/DESIGN.md                设计说明（状态机 / 表结构 / 数据库切换）
docs/USER-GUIDE.md            用户操作手册（三岗位）
docs/DEVELOPER.md             开发者文档（环境 / 结构 / 常见任务 / 调试）
```


## 已知限制（Demo 范围）

- 图片凭证以文件名模拟，不真实上传文件；
- 模拟退款/补发单号，不接真实资金、物流与电商平台；
- 不含商品浏览、下单与支付，订单为预置模拟数据。
