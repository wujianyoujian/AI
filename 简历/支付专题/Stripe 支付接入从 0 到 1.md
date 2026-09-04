# Stripe 支付接入从 0 到 1（Vue 3）

> 一份从「完全不懂」到「能讲清完整链路」的 Stripe 前端接入指南。技术栈 Vue 3 + TypeScript，全程用 test mode 测试卡测试。
> 与 [[PayPal 支付接入从 0 到 1]] 对照看：PayPal 是「跳转」，Stripe 是「内嵌」。这两条线合起来就是海外收银台的两大架构。

---

## 一、概念篇：先搞懂支付和 Stripe

### 三个角色

- **商户**（卖东西、收钱的人，就是「你」）
- **买家**（买东西、付钱的人）
- **支付网关**（中间收钱、结算给商户的机构）

钱不会从买家银行卡直接飞进商户账户，中间必须经过支付网关。**Stripe 就是一个支付网关**，但和 PayPal 不同：

> **PayPal 有「自己的账户体系」，用户要登录 PayPal 账户付钱；Stripe 没有账户体系，它直接处理「银行卡 + 40 多种本地支付方式」。**

### Stripe 最核心的特点：内嵌收卡

> 用户付钱时，**卡号是填在 Stripe 的 iframe 里，而不是填在你的网站上**。用户全程不离开你的收银台。

所以商户永远接触不到用户的卡号 / CVV / 有效期，只做一件事：**在后端创建一笔 PaymentIntent，把 `clientSecret` 交给前端，前端用 Stripe 的收卡组件让用户填卡并确认付款。**

**铁律**：前端负责「引导用户填卡 + 确认付款 + 接收结果」，真正的卡信息和扣款全程在 Stripe 手里，卡号连你的 JS 都读不到（iframe 隔离）。

**为什么内嵌（而不是像 PayPal 那样跳转）**：因为卡号是你「必须收但又不能碰」的东西，Stripe 用 iframe 隔离解决——卡信息只进 Stripe 的 iframe，你的服务器和 JS 都不碰，所以你的站点不用过 PCI DSS 认证（降到 SAQ-A 等级），同时用户不离开收银台、转化率高。

---

## 二、完整支付流程（Payment Element 版）

```
① 用户点「付款」
② 前端 → 后端：帮我创建一笔 PaymentIntent
③ 后端 → Stripe：创建 PaymentIntent（用 sk_secret，金额后端算）
④ Stripe 返回 clientSecret → 后端 → 前端
⑤ 前端拿 clientSecret 初始化 Elements，挂载 Payment Element（Stripe 的 iframe）
⑥ 用户在 iframe 里填卡号（卡号不进你的 JS/服务器）
⑦ 前端调 stripe.confirmPayment()，把填好的卡 + clientSecret 交回 Stripe
⑧ 可能触发 3DS 挑战（高风险卡），内嵌弹窗验证（OTP / 生物识别）
⑨ confirmPayment 返回结果 → 前端先给初步反馈
⑩ Stripe 异步发 webhook 给后端 → 后端验签 + 落库
⑪ 前端轮询 / SSE 拿后端最终状态 → 显示「支付成功」
```

两个关键点：
1. **为什么前端不直接调 Stripe 创建订单**：因为 `sk_secret`（绝密）只能放后端，前端只有公开的 `pk_test_`
2. **为什么 confirmPayment 后还要 webhook**：`confirmPayment` 的返回只是「同步结果」，网络抖动、用户关页面都可能丢，真正以 webhook 异步通知为准

**铁律**：前端拿到的「成功」永远只是初步信号，最终以后端 webhook 查单为准。

---

## 三、三把钥匙 + 沙箱

| 钥匙 | 作用 | 位置 |
|---|---|---|
| `pk_test_` / `pk_live_` | 表明「我是哪个商户」，公开发布 | 前端可用 |
| `sk_test_` / `sk_live_` | 商户密码，能扣款/退款 | **只能放后端**（泄露 = 被冒充扣款） |
| `whsec_...` | webhook 验签密钥 | **只能放后端**（验签用） |

**沙箱 = test mode**：Stripe 的假环境，假卡号、假扣款。注册 [dashboard.stripe.com](https://dashboard.stripe.com) → 右上角切到 **Test mode** → 拿 `pk_test_` / `sk_test_`，就能用测试卡走完整链路，不收真钱。

---

## 四、SDK 加载与环境

### 加载方式

```ts
// @stripe/stripe-js 官方加载库（框架无关，Vue 里直接 import）
import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK)
  }
  return stripePromise
}
```

**`loadStripe` 是全局单例，自带缓存**：相同 key 重复调用返回同一个 Promise。所以 Vue 里要封装成 composable 只加载一次（上面这层包裹主要是为了统一出口，方便 mock 和切环境）。

### 环境要「成对」配置

| | Test（测试） | Live（正式） |
|---|---|---|
| publishable key | `pk_test_...` | `pk_live_...` |
| secret key | `sk_test_...` | `sk_live_...` |
| 收的是 | 测试卡（假钱） | 真钱 |

**规则**：`pk_test_` 只能配 test mode，`pk_live_` 只能配 live mode，不能混。用 Vite 环境变量区分：

```bash
# .env.development
VITE_STRIPE_PK=pk_test_51...   # 测试

# .env.production
VITE_STRIPE_PK=pk_live_51...   # 正式
```

---

## 五、挂载 Payment Element + Vue 生命周期

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <div ref="paymentElement"></div>
    <button type="submit">Pay $10.00</button>
  </form>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getStripe } from '@/utils/stripe'
import { Stripe, StripeElements } from '@stripe/stripe-js'

const paymentElement = ref<HTMLDivElement | null>(null)
let stripe: Stripe | null = null
let elements: StripeElements | null = null
let element: any = null

onMounted(async () => {
  stripe = await getStripe()
  if (!stripe) return

  // ① clientSecret 来自后端创建的 PaymentIntent
  const { clientSecret } = await fetch('/api/create-payment-intent', {
    method: 'POST',
    body: JSON.stringify({ cartId: 'xxx' }),
  }).then(r => r.json())

  // ② 用 clientSecret 初始化 Elements
  elements = stripe.elements({ clientSecret })

  // ③ 创建 Payment Element（内嵌收卡 iframe），挂载到 div
  element = elements.create('payment')
  element.mount(paymentElement.value!)
})

onUnmounted(() => {
  element?.unmount()   // 注意：Stripe 是 unmount，不是 PayPal 的 close
  element?.destroy()
})
</script>
```

**三个关键**：
1. `onMounted` 挂载：要等 DOM 挂载好 + `loadStripe` 异步加载完 + 后端返回 `clientSecret`
2. `ref` 拿容器：Stripe 的收卡 iframe 画进这个 div
3. `onUnmounted` unmount + destroy：**必做**，否则组件反复创建时 iframe 残留、重复叠加

> 对比 PayPal：PayPal 按钮是 `buttons.close()`，Stripe 是 `element.unmount()`。面试里能说出这个细节，说明真的两个都跑过。

---

## 六、确认付款 + 回调

```js
async function handleSubmit() {
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,                 // 用上面创建的 elements（含 clientSecret）
    confirmParams: {
      return_url: `${location.origin}/payment-result`,  // 3DS 跳转后回跳地址
    },
    redirect: 'if_required',  // 3DS 尽量用 iframe 内嵌，不整页跳
  })

  if (error) {
    // error.type: card_error / validation_error 等，error.message 可直接展示给用户
    showError(error.message)
    return
  }

  // paymentIntent.status：
  //  'succeeded'        → 直接成功
  //  'requires_action'  → 3DS 还在进行（异步，等回跳/轮询）
  //  'processing'       → 银行处理中（等 webhook）
}
```

**核心动词**：`confirmPayment`（把卡 + clientSecret 交回 Stripe 完成确认扣款），和 PayPal 的 `capture` 对应，都是「真正划钱」这一步。

**两个回调状态要分清**：
- `error`（卡被拒、信息错）不是 bug，`error.type === 'card_error'` 时把 `error.message` 给用户看
- `paymentIntent.status` 不是二元的成功/失败，而是一台**状态机**（见第九节）

---

## 七、订单创建：前端 vs 后端（安全分界）

### 前端直接创建（❌ 只能 demo）

```js
// 前端不可能创建 PaymentIntent——创建要用 sk_secret，前端拿不到
// 前端只能拿到后端下发的 clientSecret，金额从头到尾不归前端管
```

### 后端创建（✅ 生产正确做法）

```js
// 后端：金额从数据库算，不接收前端金额
app.post('/api/create-payment-intent', async (req, res) => {
  const amount = await getCartTotal(req.body.cartId)   // 金额后端算
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),   // 单位是「分」，10 美元 = 1000
    currency: 'usd',
    automatic_payment_methods: { enabled: true },  // 自动开启卡 + 本地方式
  })
  res.json({ clientSecret: paymentIntent.client_secret })  // 只下发 clientSecret
})
```

**铁律**：金额由后端定，前端只「向后端要 clientSecret + 引导填卡 + confirmPayment」，从头到尾不碰价格、不碰 secret。

> Stripe 金额单位是**最小货币单位（分）**，不是元。PayPal 是「元（字符串）」传 `10.00`，Stripe 传 `1000`——又是一个面试能拉开差距的细节。

---

## 八、完整前后端链路（生产版）

### 前端

```js
// 1. 挂载 Payment Element（见第五节）
// 2. 提交时确认付款
async function handleSubmit() {
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: `${location.origin}/payment-result` },
    redirect: 'if_required',
  })
  if (error) return showError(error.message)
  if (paymentIntent.status === 'succeeded') showSuccess()
  else pollFinalStatus(paymentIntent.id)   // 轮询后端最终状态
}
```

### 后端（伪代码）

```js
// 创建 PaymentIntent
app.post('/api/create-payment-intent', async (req, res) => {
  const amount = await getCartTotal(req.body.cartId)
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  })
  res.json({ clientSecret: pi.client_secret })
})

// 前端轮询的最终状态接口
app.get('/api/order/:orderId/status', async (req, res) => {
  const order = await db.getOrder(req.params.orderId)
  res.json({ status: order.status })   // 数据库里由 webhook 更新的最终状态
})
```

---

## 九、PaymentIntent 状态机（必考）

Stripe 的 PaymentIntent 不是「成功/失败」二元，而是一台有明确转移关系的状态机，这是 Stripe 比 PayPal 更深的地方。

```
requires_payment_method ──填卡──▶ requires_confirmation ──confirm──▶ requires_action
                                                                        │ (3DS 通过)
                                                                        ▼
    succeeded ◀──扣款成功── processing ◀──扣款中──┘
       ▲
       └── 可退款 → charge.refunded（webhook 通知）
```

| 状态 | 含义 | 前端做什么 |
|---|---|---|
| `requires_payment_method` | 还没填卡 | 挂 Payment Element 等用户填 |
| `requires_confirmation` | 已填卡，待确认 | 调 `confirmPayment` |
| `requires_action` | 触发 3DS 挑战 | 内嵌 iframe 完成验证 |
| `processing` | 银行处理中 | 轮询等 webhook |
| `succeeded` | 成功 | 展示成功 |
| `canceled` | 已取消 | 展示取消 |

**为什么是状态机不是 if/else**：状态转移是「有限、明确、单向可预测」的，用状态机（转移表 + onEnter/onExit）驱动 UI，能避免散落一地的 `if (status === 'xx')` 判断。这一条直接对应 [[海外支付收银台学习路径]] 里阶段 4 要自己实现的 `PayStateMachine`。

---

## 十、3DS 2.0：frictionless vs challenge（必考）

3DS 是银行/发卡行要求「持卡人本人确认」的风控机制。2.0 版本有两种结果：

| 结果 | 含义 | 用户体验 |
|---|---|---|
| **frictionless** | 风控判定低风险，直接放行 | 用户无感，直接成功 |
| **challenge** | 高风险，要求验证 | 弹 OTP / 生物识别验证 |

前端两种形态：

```js
// redirect: 'always' → 整页跳转到发卡行 3DS 页面（老式）
// redirect: 'if_required' → 能内嵌就内嵌 iframe，不行才跳转（推荐）
stripe.confirmPayment({
  elements,
  confirmParams: { return_url: `${location.origin}/payment-result` },
  redirect: 'if_required',
})
```

- **iframe 内嵌**：用户不离开收银台，Stripe 用 `postMessage` 通知父页面 3DS 完成，前端要「监听完成 + 超时兜底」
- **redirect 跳转**：用户被带走到发卡行，完成后回跳 `return_url`，回跳后**不能只看 URL 参数就认为成功，必须再查单**

**测试卡**（跑一次就懂）：

| 卡号 | 效果 |
|---|---|
| `4242 4242 4242 4242` | 成功，无 3DS |
| `4000 0000 0000 3220` | 总是触发 3DS challenge |
| `4000 0000 0000 3055` | 3DS 认证成功 |
| `4000 0000 0000 0446` | 3DS2 frictionless |
| `4000 0000 0000 0002` | 卡被拒（declined） |

---

## 十一、webhook 异步通知（必考）

`confirmPayment` 同步返回成功还不够，还需要 webhook 做异步最终确认。

```
支付结果变化（扣款成功/失败/退款）→ Stripe 主动 POST 到你的 webhook URL → 后端验签 → 幂等处理 → 返回 200
```

```js
// 关键：Stripe 验签需要「原始请求体」，所以要用 express.raw
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  // ① 验签：用 whsec_ 密钥对原始 body 做 HMAC，确认真是 Stripe 发的
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // ② 幂等：同一事件可能重发多次，用 event.id 去重
  if (await db.eventExists(event.id)) return res.json({ received: true })

  // ③ 按类型处理
  switch (event.type) {
    case 'payment_intent.succeeded': await db.updateOrderStatus(event.data.object.id, 'PAID'); break
    case 'payment_intent.payment_failed': await db.updateOrderStatus(event.data.object.id, 'FAILED'); break
    case 'charge.refunded': await db.updateOrderStatus(event.data.object.payment_intent, 'REFUNDED'); break
  }

  await db.saveEvent(event.id)
  res.json({ received: true })   // ④ 尽快返回 200，防止 Stripe 重试
})
```

**三要素**：验签防伪造、幂等防重复、快速 200 防重试。

> Stripe 验签和 PayPal 的差别：Stripe 用 `whsec_` 对**原始 body** 做 HMAC（所以必须 `express.raw` 拿原始字节，不能用 `express.json` 解析过的）；PayPal 是调用它的 verify 接口。细节不同，但「验签 + 幂等 + 快速 200」三要素完全一致。

---

## 十二、推送方案选型：轮询 / SSE / WebSocket

前端拿最终状态，不能直接收 Stripe 的 webhook（那是服务器到服务器），要靠后端推前端。

| | 轮询 | SSE | WebSocket |
|---|---|---|---|
| 方向 | 前端反复问 | 后端单向推 | 双向 |
| 成本 | 浪费请求 | 轻量 | 重（心跳、断线） |

**支付通知是「一次性、单向、低频」事件**，所以轮询或 SSE 合适，WebSocket 过重。选型依据是场景特征，不是技术新旧。

> 这一条和 PayPal 完全一致——「为什么后端有 webhook 了前端还要轮询」是通用考点。

---

## 十三、全景图

```
前端 Vue 组件                        你的后端                        Stripe
  ① getStripe() 加载 SDK（单例）
  ② 后端创建 PaymentIntent ◀──────────┐
  ③ 拿到 clientSecret ◀───────────────┘
  ④ stripe.elements({ clientSecret }) + create('payment').mount()
  ⑤ 用户在 Stripe iframe 填卡（卡号不进你的 JS/服务器）
  ⑥ confirmPayment(elements) ──▶ 直接调 Stripe（不经过你后端）
  ⑦ Stripe 可能内嵌 3DS 挑战（iframe，postMessage 感知）
  ⑧ 返回 paymentIntent.status（同步初步结果）
  ⑨ 前端轮询/SSE ◀── 后端状态接口 ◀── ⑩ webhook：验签+幂等+落库 ◀── succeeded
  ⑪ onUnmounted unmount + destroy
```

**一个关键区别**：第 ⑥ 步 `confirmPayment` 是前端**直接**调 Stripe（`@stripe/stripe-js` 直连 Stripe，不经过你的后端），因为填卡后的卡 token 化发生在 Stripe 的 iframe 里。这和 PayPal 的 `onApprove → 调后端 capture` 不同——PayPal 的前端永远只跟自己的后端说话，Stripe 的前端会直接跟 Stripe 说话。

---

## 十四、面试串讲稿（可直接背）

> **我理解 Stripe 支付接入，核心是三个认知：**
>
> **第一，Stripe 是「内嵌收卡」，不是「跳转」。** 卡号填在 Stripe 的 iframe 里，我的 JS 和服务器永远读不到卡号，所以 PCI 等级降到 SAQ-A；用户不离开收银台，转化率高。这是它和 PayPal 最本质的区别——PayPal 把用户引到它那，Stripe 把卡收在我这。
>
> **第二，完整链路是：后端创建 PaymentIntent → 下发 clientSecret → 前端挂 Payment Element → confirmPayment → 3DS 挑战 → webhook 异步确认。** 金额后端从数据库算（单位是分），前端只拿 clientSecret 和引导填卡；confirmPayment 返回的只是同步结果，最终以 webhook（验签 + 幂等 + 快速 200）为准，前端轮询/SSE 拿后端落库状态。
>
> **第三，深度在状态机和 3DS。** PaymentIntent 是一台状态机（requires_* → processing → succeeded），我理解它而不是散落的 if/else；3DS 2.0 分 frictionless（无感放行）和 challenge（OTP/生物识别），前端用 `redirect: 'if_required'` 尽量内嵌 iframe、postMessage 感知完成、超时兜底。
>
> **深入可展开：** webhook 三要素（验签用 whsec 对原始 body 做 HMAC / 幂等 / 快速 200）；为什么用轮询/SSE 而非 WebSocket（低频、单向、一次性）；Stripe 金额单位是分、confirmPayment 前端直连 Stripe、element.unmount 不是 close。
