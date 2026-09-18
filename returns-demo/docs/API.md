# 接口清单（API）

Base URL：`http://localhost:3000`，除登录外均需请求头 `Authorization: Bearer <token>`。

## 返回码约定

| 状态码 | 含义 | 示例 |
| --- | --- | --- |
| 200 | 成功 | — |
| 400 | 业务规则不满足 / 参数错误 | `{"error":"申请数量超过可售后数量（剩余可申请 0 件）"}` |
| 401 | 未登录或会话失效 | `{"error":"请先登录"}` |
| 403 | 岗位无权限或对象不属于本人 | `{"error":"无权查看他人售后单"}` |
| 404 | 资源不存在 | `{"error":"售后单不存在"}` |
| 409 | 状态机冲突（请求与单据当前状态不匹配） | `{"error":"客服尚未同意退回，不能提前登记收货"}` |
| 429 | 登录失败次数过多被限流 | `{"error":"失败次数过多，请约 10 分钟后再试"}` |
| 500 | 服务器内部错误 | `{"error":"服务器内部错误"}` |
| 503 | 健康检查失败（数据库不可用） | `{"status":"DOWN","error":"数据库不可用"}` |

注意：`POST /api/tickets` 的 `qty` 必须是 JSON 数字，字符串（如 `"1"`）会被拒绝（400）。

## 接口明细

### GET /api/health — 存活探针（公开）

负载均衡 / 容器健康检查使用。数据库正常返回
`{"status":"UP","db":"h2"}`（200）；数据库不可用返回 503。

### POST /api/login — 登录（公开）

```json
// 请求
{ "username": "xiaolin", "password": "123456" }
// 响应
{ "token": "a1b2c3...", "id": "u1", "name": "小林", "role": "consumer" }
```

### POST /api/logout — 登出（需登录，幂等）

销毁服务端会话，响应 `{"ok":true}`。

### GET /api/meta — 元信息（公开）

返回状态字典 `statuses` 与当前数据库驱动 `dbDriver`（sqlite / mysql）。

### GET /api/me/orders — 我的模拟订单（消费者）

返回本人已完成订单，每件商品附 `usedQty`（已被进行中售后占用的数量）与
`aftersalable`（可售后数量）。

```json
[{
  "id": "O2026091001", "status": "COMPLETED", "createdAt": "2026-09-10 10:00:00",
  "items": [{ "id": "i1", "name": "白色长袖衬衫（M码）", "price": 129,
              "qty": 1, "aftersalable": 1, "usedQty": 0 }]
}]
```

### POST /api/tickets — 提交售后申请（消费者）

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| orderId / itemId | 是 | 订单号与商品 id（只能本人已完成订单） |
| type | 是 | `RETURN` 退货 / `EXCHANGE` 换货 |
| qty | 是 | 1-99 整数，不能超过剩余可售后数量 |
| reason | 是 | ≤100 字 |
| description | 否 | ≤500 字 |
| images | 否 | 凭证文件名数组（≤9 个，模拟） |

响应：售后单视图（见下）。失败返回 400 与原因。

### GET /api/my/tickets — 我的售后单（消费者）

### GET /api/tickets — 工作台列表（客服 / 仓库）

支持 `?status=SUBMITTED` 与 `?type=RETURN` 筛选，按创建时间倒序。

### GET /api/tickets/:id — 售后单详情（所有登录角色）

消费者只能查看本人单据，查看他人返回 403。

**售后单视图结构**（以上接口通用）：

```json
{
  "id": "AS0001", "orderId": "O2026091001", "itemId": "i1",
  "itemName": "白色长袖衬衫（M码）", "price": 129,
  "userId": "u1", "userName": "小林",
  "type": "EXCHANGE", "reason": "尺码不合适", "qty": 1,
  "description": "M码偏小", "status": "SUBMITTED", "statusText": "待客服审核",
  "refundAmount": null, "reshipTrackingNo": null, "inspectResult": null,
  "createdAt": "2026/9/17 09:00:00",
  "images": ["凭证图1.jpg（模拟）"],
  "timeline": [
    { "time": "2026/9/17 09:00:00", "operator": "小林（消费者）",
      "role": "consumer", "action": "提交售后申请", "note": "换货 1 件，原因：尺码不合适。…" }
  ]
}
```

### POST /api/tickets/:id/supplement — 补充材料（消费者，仅本人）

仅当状态为 `MATERIAL_REQUESTED`；`description` 与 `images` 至少一项；补充后回到 `SUBMITTED`。

### POST /api/tickets/:id/review — 客服审核（售后客服）

| action | 前置状态 | 结果状态 | 说明 |
| --- | --- | --- | --- |
| `REQUEST_MATERIAL` | SUBMITTED | MATERIAL_REQUESTED | 要求补充材料 |
| `APPROVE_RETURN` | SUBMITTED | RETURN_APPROVED | 同意退回 |
| `REJECT` | SUBMITTED / INSPECTED | REJECTED | 拒绝 |
| `FINAL_APPROVE` | INSPECTED | COMPLETED | 退货→记录 `refundAmount`；换货→生成 `reshipTrackingNo` |

四种操作均必须携带非空 `note`（原因 / 说明）。

### POST /api/tickets/:id/warehouse — 仓库操作（仓库人员）

| action | 前置状态 | 结果状态 | 说明 |
| --- | --- | --- | --- |
| `RECEIVE` | RETURN_APPROVED | RECEIVED | 登记收货；客服未同意退回时 400 |
| `INSPECT` | RECEIVED | INSPECTED | `inspectResult`: `OK` / `PROBLEM`；`PROBLEM` 必填 `note` |
