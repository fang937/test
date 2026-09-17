# 退换货系统后端完善计划

## 目标
1. 把单文件 JSON 存储后端升级为**分层架构 + 真实数据库**的可维护工程；
2. 按你的要求：**数据访问留好接口**——业务代码只依赖统一仓储契约，换数据库 = 换适配器，未来可直接接入其他设备上的 MySQL（适配器已实现）。

## 已完成的部分（本次会话已写入磁盘）
- `src/store/contract.js`：**数据仓储契约**（约20个方法，全部 Promise），业务层只调用契约方法
- `src/store/index.js`：适配器工厂，按 `DB_DRIVER` 环境变量加载驱动，启动时校验适配器实现完整契约
- `src/store/sqlite.js`：默认驱动，用 Node 24 内置 `node:sqlite`（零依赖），含建表 DDL、种子数据、事务化的"数量校验+写入"
- `src/store/mysql.js`：**接入其他设备 MySQL 的适配器**（`npm i mysql2` 后配环境变量即可用，自动建库建表、`FOR UPDATE` 防并发超量申请）
- `src/store/seed-data.js`：两驱动共用的演示账号与订单
- `src/config.js`：环境变量配置（DB_DRIVER/DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_FILE/PORT）
- `src/state-machine.js`：7个状态 + 合法流转表（终态不可再流转）
- `src/services/aftersale.js`：全部业务规则集中于此（本人订单校验、数量上限、状态机校验、拒绝/补充/验货异常必填原因、模拟退款/补发）
- `src/middleware/auth.js`：Bearer token 认证 + `requireRole` 岗位权限
- `src/routes/`：auth（登录/登出/meta）、consumer（订单/申请/补充/我的售后单）、staff（列表筛选/审核/仓库操作）
- `src/app.js`、`server.js`：Express 装配与入口，统一错误处理
- API 对外契约与原前端完全兼容（camelCase 视图 + timeline + images）

## 剩余待执行工作

### 1. 测试与脚本
- `test/smoke.js`：冒烟测试（独立 data/smoke.db，不影响演示数据），覆盖需求文档全部6条核心验收场景：正常换货全流程、超量/重复申请被拒、补充材料重审、仓库提前收货被拒、验货异常后客服拒绝、越权查看他人售后单(403)；另覆盖登出失效、状态筛选、模拟退款金额
- `scripts/reset.js`：一键重置演示数据（跟随 DB_DRIVER）
- `package.json`：scripts 增加 `smoke`/`reset`；engines >=22.5；optionalDependencies 加 mysql2（纯 JS，不装也能跑 SQLite）
- `.gitignore`：node_modules/、data/、*.log

### 2. 前端小改（不改 API 契约）
- 客服/仓库工作台加"状态筛选"下拉（调 `GET /api/tickets?status=`）
- 退出登录时调 `POST /api/logout` 使服务端会话失效
- 售后单卡片显示申请时间

### 3. 文档（对应课程第三/四章交付物）
- `docs/API.md`：接口清单（方法/路径/岗位/输入输出示例/错误码）、认证方式
- `docs/DESIGN.md`：架构图、状态机图、5张表结构、页面-接口-数据字段对应表、权限矩阵、**「接入其他设备数据库」操作指南与新增适配器步骤**
- `README.md`：更新目录结构、运行方式（默认 SQLite；`DB_DRIVER=mysql DB_HOST=<设备IP> ... npm start` 切换）、测试说明

### 4. 验证
- 停掉旧的后台服务进程（释放 3000 端口）
- `npm run smoke` 全部断言通过
- 重启 `npm start`，浏览器实测：登录、状态筛选、客服审核流程不受影响

## 关键设计决策
- 默认 SQLite（本机零依赖、可离线演示）；MySQL 为对等适配器而非重写，业务代码零改动
- 密码 scrypt 加盐哈希入库，不再明文
- 会话持久化到数据库（重启服务不掉登录）
- 数量校验与写入在同一事务（SQLite BEGIN IMMEDIATE / MySQL FOR UPDATE）
