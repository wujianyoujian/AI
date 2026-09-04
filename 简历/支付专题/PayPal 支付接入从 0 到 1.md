# PayPal 支付接入从 0 到 1（Vue 3）

> 一份从「完全不懂」到「能讲清完整链路」的 PayPal 前端接入指南。技术栈 Vue 3 + TypeScript，全程使用自己创建的沙箱 app 测试。

---

## 一、概念篇：先搞懂支付和 PayPal

### 三个角色

- **商户**（卖东西、收钱的人，就是「你」）
- **买家**（买东西、付钱的人）
- **支付网关**（中间收钱、结算给商户的机构）

钱不会从买家银行卡直接飞进商户账户，中间必须经过支付网关。**PayPal 就是一个支付网关**，和 Visa/Mastercard 不同，它有**自己的账户体系**。

### PayPal 最核心的特点

> 用户付钱时，登录的是**他自己的 PayPal 账户**，而不是把卡号填在你的网站上。

所以商户永远接触不到用户的卡号/密码/余额，只做一件事：**发起收款请求，让用户去 PayPal 完成付款，再接收付款结果。**

**铁律**：前端负责「引导用户付款 + 接收结果」，真正的钱和账户信息全程在 PayPal 手里。

---

## 二、完整支付流程（10 步）

```
① 用户点「PayPal 付款」
② 前端 → 后端：帮我建一笔订单
③ 后端 → PayPal：创建订单（用 client_secret）
④ PayPal 返回 orderId → 后端 → 前端
⑤ 前端拿 orderId 唤起支付弹窗
⑥ 用户跳转 PayPal，登录、确认付款
⑦ PayPal 回调 onApprove 通知前端「授权成功」
⑧ 前端 → 后端：用户说付好了，帮我确认
⑨ 后端 → PayPal：查单/验签，确认钱到账
⑩ 后端落库 → 前端显示「支付成功」
```

两个关键点：
1. **为什么前端不直接调 PayPal**：因为 `client_secret`（绝密）只能放后端
2. **为什么 onApprove 后还要再确认**：onApprove 只是「用户点了同意」，真正扣钱（capture）是另一件事

**铁律**：前端拿到的「成功」永远只是初步信号，最终以后端查单为准。

---

## 三、两把钥匙 + 沙箱 app

| 钥匙 | 作用 | 位置 |
|---|---|---|
| `client_id` | 表明「我是哪个商户」 | 前端可用（公开） |
| `client_secret` | 商户密码 | **只能放后端**（泄露 = 被冒充） |

**沙箱（Sandbox）**：PayPal 提供的假环境，假钱、假账户，测试专用。注册 developer.paypal.com → Dashboard → 切到 Sandbox → Create App → 得到 client_id / client_secret + 沙箱买家/商家账户。

---

## 四、SDK 加载与环境

### 两种加载方式

```js
// 方式一：官方加载库（推荐，Vue 里好用）
import { loadScript } from '@paypal/paypal-js'
const paypal = await loadScript({ clientId, sdkBaseUrl, currency })

// 方式二：直接 script 标签
// <script src="https://www.sandbox.paypal.com/sdk/js?client-id=xxx&currency=USD"></script>
// 加载后 window.paypal 可用
```

**`loadScript` 是全局单例，自带缓存**：相同参数重复调用不会重复加载。所以 Vue 里要封装成 composable 只加载一次。

### 环境要「成对」配置

| | Sandbox（测试） | Live（正式） |
|---|---|---|
| SDK 域名 | `www.sandbox.paypal.com` | `www.paypal.com` |
| client_id | 沙箱 app 的（常以 `AZ` 开头） | 正式 app 的（常以 `AQ` 开头） |

**规则**：client_id 和域名必须配对，不能混。用 Vite 环境变量区分：

```bash
# .env.development
VITE_PAYPAL_CLIENT_ID=AZ开头的沙箱id
VITE_PAYPAL_ENV=sandbox

# .env.production
VITE_PAYPAL_CLIENT_ID=AQ开头的正式id
VITE_PAYPAL_ENV=live
```

```ts
// src/utils/usePaypal.ts
import { loadScript } from '@paypal/paypal-js'

let paypalPromise: ReturnType<typeof loadScript> | null = null

export function usePaypal(): ReturnType<typeof loadScript> {
  if (!paypalPromise) {
    paypalPromise = loadScript({
      clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
      sdkBaseUrl: import.meta.env.VITE_PAYPAL_ENV === 'sandbox'
        ? 'https://www.sandbox.paypal.com/sdk/js'
        : 'https://www.paypal.com/sdk/js',
      currency: 'USD',
    })
  }
  return paypalPromise
}
```

---

## 五、渲染按钮 + Vue 生命周期

```vue
<template>
  <div ref="paypalContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePaypal } from '@/utils/usePaypal'

const paypalContainer = ref<HTMLDivElement | null>(null)
let buttons: any = null

onMounted(async () => {
  const paypal = await usePaypal()
  buttons = paypal.Buttons({
    createOrder(data, actions) { /* ... */ },
    onApprove(data, actions) { /* ... */ },
    onCancel(data) { /* ... */ },
    onError(err) { /* ... */ },
  })
  await buttons.render(paypalContainer.value!)
})

onUnmounted(() => buttons?.close())  // 必须：防内存泄漏/按钮叠加
</script>
```

**三个关键**：
1. `onMounted` 渲染：要等 DOM 挂载好 + SDK 异步加载完
2. `ref` 拿容器：PayPal 按钮画进这个 div
3. `onUnmounted` close：**必做**，否则按钮残留、重复叠加、内存泄漏

---

## 六、回调全景

```js
paypal.Buttons({
  createOrder(data, actions) { /* 下单，返回 orderId */ },
  onApprove(data, actions) { /* 用户同意付款 */ },
  onCancel(data) { /* 用户主动取消/返回 */ },
  onError(err) { /* 系统错误 */ },
  onClick(data, actions) { /* 点按钮、弹窗前，可用 actions.reject() 阻止 */ },
})
```

- `onCancel`（用户主动取消）和 `onError`（系统错误）要区分，前者不是 bug
- `create`（创建订单，挂起）和 `capture`（扣款，真正划走）是两个核心动词

---

## 七、订单创建：前端 vs 后端（安全分界）

### 前端直接创建（❌ 只能 demo）

```js
createOrder(data, actions) {
  return actions.order.create({
    purchase_units: [{ amount: { value: '10.00' } }],  // 金额写死在前端，可被篡改
  })
}
```

### 后端创建（✅ 生产正确做法）

```js
createOrder(data, actions) {
  return fetch('/api/create-order', { method: 'POST' })
    .then(res => res.json())
    .then(order => order.id)   // 只返回 orderId，金额前端不管
}
```

**铁律**：金额由后端定，前端只「向后端要 orderId + 引导付款」，从头到尾不碰价格、不碰 secret。

---

## 八、完整前后端链路（生产版）

### 前端

```js
createOrder(data, actions) {
  return fetch('/api/create-order', { method: 'POST', body: JSON.stringify({ cartId }) })
    .then(r => r.json()).then(o => o.id)
},
onApprove(data, actions) {
  return fetch('/api/capture-order', { method: 'POST', body: JSON.stringify({ orderId: data.orderID }) })
    .then(r => r.json()).then(result => { /* 后端确认后显示成功 */ })
}
```

### 后端（伪代码）

```js
// 创建订单：金额从数据库算，不接收前端金额
app.post('/api/create-order', async (req, res) => {
  const amount = await getCartTotal(req.body.cartId)
  const order = await paypalClient.createOrder({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: amount } }] })
  res.json({ id: order.id })
})

// capture + 验证：后端扣款 + 确认
app.post('/api/capture-order', async (req, res) => {
  const capture = await paypalClient.captureOrder(req.body.orderId)
  if (capture.status === 'COMPLETED') {
    await db.updateOrderStatus(req.body.orderId, 'PAID')
    res.json({ success: true })
  } else {
    res.json({ success: false })
  }
})
```

---

## 九、webhook 异步通知（必考）

capture 同步成功还不够，还需要 webhook 做异步最终确认。

```
订单状态变化（扣款/退款/争议）→ PayPal 主动 POST 到你的 webhook URL → 后端验签 → 幂等处理 → 返回 200
```

```js
app.post('/api/paypal-webhook', async (req, res) => {
  // ① 验签：确认真是 PayPal 发的
  if (!verifyWebhookSignature(req.headers, req.body)) return res.status(400).send('bad signature')

  // ② 幂等：同一事件可能重发多次
  const eventId = req.body.id
  if (await db.eventExists(eventId)) return res.status(200).send('already processed')

  // ③ 按类型处理
  switch (req.body.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': await db.updateOrderStatus(orderId, 'PAID'); break
    case 'PAYMENT.CAPTURE.REFUNDED': await db.updateOrderStatus(orderId, 'REFUNDED'); break
    case 'PAYMENT.CAPTURE.DENIED': await db.updateOrderStatus(orderId, 'FAILED'); break
  }

  await db.saveEvent(eventId)
  res.status(200).send('ok')  // ④ 尽快返回 200
})
```

**三要素**：验签防伪造、幂等防重复、快速 200 防重试。

---

## 十、推送方案选型：轮询 / SSE / WebSocket

前端拿最终状态，不能直接收 PayPal 的 webhook（那是服务器到服务器），要靠后端推前端。

| | 轮询 | SSE | WebSocket |
|---|---|---|---|
| 方向 | 前端反复问 | 后端单向推 | 双向 |
| 成本 | 浪费请求 | 轻量 | 重（心跳、断线） |

**支付通知是「一次性、单向、低频」事件**，所以轮询或 SSE 合适，WebSocket 过重。选型依据是场景特征，不是技术新旧。

---

## 十一、全景图

```
前端 Vue 组件                      你的后端                    PayPal
  ① usePaypal() 加载 SDK（单例）
  ② paypal.Buttons().render()
  ③ createOrder ──▶ /api/create-order ──▶ ④ 后端调 PayPal 创建订单
  ⑤ 用户跳 PayPal 付款 ◀──────────── orderId ◀──────┘
  ⑥ onApprove ──▶ /api/capture-order ──▶ ⑦ 后端调 capture 扣款
  ⑨ 前端轮询/SSE ◀── ⑧ webhook：验签+幂等+落库 ◀── COMPLETED
  ⑩ onUnmounted close()
```

---

## 十二、面试串讲稿（可直接背）

> **我理解 PayPal 支付接入，核心是三个认知：**
>
> **第一，前端永远不碰钱、不碰 `client_secret`。** 前端只有公开的 `client_id`，金额由后端从数据库算、扣款由后端做。
>
> **第二，完整链路四步：后端创建订单 → 用户授权 → 后端扣款 → 异步确认。** 前端 createOrder 问后端要 orderId；用户跳 PayPal 付款；onApprove 里把 orderId 交回后端调 capture；PayPal 再异步发 webhook，后端验签+幂等+落库，前端轮询/SSE 拿最终状态。
>
> **第三，前端的坑在生命周期和加载机制：** SDK 全局单例要封装 composable 只加载一次；按钮 onUnmounted 要 close；沙箱/正式环境要「域名 + client_id 配对」用环境变量切换。
>
> **深入可展开：** webhook 三要素（验签/幂等/快速 200）；为什么用轮询/SSE 而非 WebSocket（低频、单向、一次性）。
