# 服装网店退换货处理系统（Demo）

模拟服装网店售后部门，处理消费者从申请退货/换货到仓库验收、售后结束的完整流程。
消费者、售后客服与仓库人员各自在工作台操作，所有状态变化记录在售后单时间线上。

## 当前后端：Java（Spring Boot）

**主后端为 `backend-java/`（Java 17 语法，Spring Boot 3.5 + Spring Data JPA）**，
本地默认使用 H2 文件数据库（零安装），通过 `mysql` profile 接入其他设备的 MySQL。
`src/`（Node/Express 版）保留为参照实现，两者接口契约完全一致，共用同一前端和冒烟测试。

### 构建与运行（Java 版）

```bash
cd backend-java
mvn -DskipTests package           # 构建 target/returns-backend-1.0.0.jar（首次构建由 Maven 自动下载依赖）
java -jar target/returns-backend-1.0.0.jar   # 启动，浏览器访问 http://localhost:3000
```

- 本机未装 Maven 时可使用项目自带的（`tools/apache-maven-*/bin/mvn`，见文末）；
- 首次启动自动建表并写入演示账号与订单；数据文件在 `backend-java/data/`（H2）；
- **接入其他设备上的 MySQL**：

  ```bash
  java -jar target/returns-backend-1.0.0.jar --spring.profiles.active=mysql
  # 连接信息用环境变量覆盖：DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
  # Windows (PowerShell): $env:DB_HOST='192.168.1.20'; $env:DB_PASSWORD='***'; java -jar ...
  ```

  连接串带 `createDatabaseIfNotExist=true`，账号有建库权限时自动建库；
  表结构由 JPA `ddl-auto: update` 自动创建。

### 冒烟测试（两种后端通用）

```bash
# 测当前运行的 Java 后端
SMOKE_BASE_URL=http://127.0.0.1:3000 node test/smoke.js

# 测 Node 参照实现（会启动独立测试实例，不影响演示数据）
npm run smoke
```

30 条断言覆盖需求文档全部核心验收场景（正常换货/退货全流程、超量与重复申请、
补充材料重审、仓库提前收货被拒、验货异常后客服结论、消费者越权 403、登出失效等）。

## 演示账号（密码均为 123456）

| 账号 | 角色 |
| --- | --- |
| xiaolin / xiaomei | 消费者 |
| kefu | 售后客服 |
| cangguan | 仓库人员 |

## 核心链路

消费者选商品提交售后申请 → 客服审核（同意退回 / 要求补充材料 / 拒绝）→ 消费者补充材料或寄回 → 仓库登记收货、验货 → 客服确认模拟退款或换货补发 → 售后单完成（终态）。

## 已实现的关键业务规则

- 只能对本人已完成订单申请售后（越权返回 403/400）；
- 申请数量不能超过该商品可售后数量，拒绝/完成的单据释放数量；并发安全由事务内 `SELECT ... FOR UPDATE`（JPA `@Lock(PESSIMISTIC_WRITE)`）保证；
- 客服同意退回后仓库才能登记收货（状态机校验）；
- 验货不等于退款/换货完成，最终结论由客服给出；
- 拒绝、补充材料、验货异常必须填写原因；
- 每次状态变化记录操作岗位、时间和说明（aftersale_events 时间线）；
- 模拟退款金额/补发单号，不接真实资金；
- 密码 PBKDF2WithHmacSHA256 加盐哈希入库；会话持久化到数据库，重启服务不掉登录。

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

## 本机 Maven（可选）

本机未安装 Maven 时，项目根目录 `tools/apache-maven-*/bin/mvn` 可直接使用：

```bash
export JAVA_HOME='D:\vscode\java\JDK'
'D:\大学\大作业\tools\apache-maven-3.9.9\bin\mvn' -DskipTests package
```

## 已知限制（Demo 范围）

- 图片凭证以文件名模拟，不真实上传文件；
- 模拟退款/补发单号，不接真实资金、物流与电商平台；
- 不含商品浏览、下单与支付，订单为预置模拟数据。
