# JSBridge 面试专题

> 对应简历：「制定 JSBridge 通信协议规范（支持同步/异步调用，Promise 化封装，版本兼容与降级策略），设计 WebView 白屏/渲染异常兜底方案」

---

## 目录

1. [JSBridge 原理](#一jsbridge-原理)
2. [三种注入方式](#二三种注入方式)
3. [完整调用流程](#三完整调用流程)
4. [同步调用与异步调用](#四同步调用与异步调用)
5. [Promise 化与回调队列](#五promise-化与回调队列)
6. [版本兼容与降级策略](#六版本兼容与降级策略)
7. [反向通信（Native 调 H5）](#七反向通信native-调-h5)
8. [完整代码实现](#八完整代码实现)
9. [使用示例](#九使用示例)
10. [Native 侧配合](#十native-侧配合)
11. [记忆锚点与高频追问](#十一记忆锚点与高频追问)

---

## 一、JSBridge 原理

**一句话：JSBridge 是打通 WebView 里 JS 和原生（Native）两套环境之间的通信桥梁。**

为什么需要它：JS 运行在 WebView 沙箱里，**没有权限直接调用**原生能力（定位、相机、NFC、支付、相册等），而 Native 能调这些能力。所以需要一个"桥"，让 JS 能调 Native、Native 也能回调 JS。

本质：JS 和 Native 是两套完全隔离的运行环境，只能通过**约定好的通道 + 消息格式**来传话。

```
WebView 内 JS  ⇄  JSBridge  ⇄  Native
（没权限）       （通道）      （有系统能力）
```

---

## 二、三种注入方式

### 1. URL Scheme 拦截

**原理**：JS 发起一个约定好的特殊 URL 请求，Native 拦截这个请求，解析出要调的方法和参数。

```js
// JS 侧：拼一个约定好的 scheme
const url = 'jsbridge://getLocation?callbackId=1';
// 用一个隐藏 iframe 触发，而不是直接 location.href
const iframe = document.createElement('iframe');
iframe.src = url;
document.body.appendChild(iframe);
```

Native 侧拦截 WebView 的 URL 加载，识别 `jsbridge://` 前缀，解析方法名和参数。

**缺点**：URL 长度有限制、传不了大参数、需要建隐藏 iframe、性能一般、较古老。

**关键追问**：为什么用隐藏 iframe 而不是 `location.href`？
—— 因为**连续调用 `location.href` 只生效最后一次**（页面 URL 被覆盖），而每次新建 iframe 是独立请求，互不干扰，且不刷新当前页面。

### 2. 注入全局对象（目前最主流）

**原理**：Native 在 WebView 加载时，往 JS 的 `window` 上注入一个对象，JS 直接像调普通函数一样调它。

```js
window.NativeBridge.getLocation(data, callback);
```

- **Android**：`addJavascriptInterface(javaObject, "NativeBridge")` 注入 Java 对象
- **iOS（WKWebView）**：`WKScriptMessageHandler`，JS 通过 `window.webkit.messageHandlers.NativeBridge.postMessage(...)` 调用

**优点**：调用直观、性能好、能传较复杂数据（JSON 序列化）、现代主流方案。

### 3. prompt / alert / confirm 拦截

**原理**：利用 WebView 拦截 `alert`、`prompt`、`confirm` 的能力，把调用信息塞进去。

```js
prompt('jsbridge://getLocation', JSON.stringify(data));
```

Native 在 `onJsPrompt`（Android）里拦截解析。

**关键追问**：为什么用 prompt 不用 alert？
—— 因为 **prompt 能拿到返回值**，alert 拿不到；且 prompt 能传两个参数（消息 + 默认值）。

**缺点**：比较 hack、语义化差，但早期兼容性好，常作兜底方案。

---

## 三、完整调用流程

以「注入全局对象 + callbackId」为例：

```
① JS 调 window.NativeBridge.getLocation(data, callback)
   │
② JSBridge 层生成唯一 callbackId，把 callback 存进「回调队列」
   │
③ Native 收到消息，执行定位（耗时操作）
   │
④ Native 拿到结果，回调 JS 的全局函数：
   window.__nativeCallback(callbackId, result)
   │
⑤ JS 根据 callbackId 从队列里取出对应 callback，执行
```

**为什么要 callbackId？**—— 因为 Native 调用是**异步**的（定位、网络都要时间），JS 发起多个请求后，回调回来时得知道"这个结果对应哪次请求"，用 callbackId 做标识。

---

## 四、同步调用与异步调用

### 同步调用如何实现

同步 = JS 发起后**当场拿到返回值**，主要靠「注入对象直接返回」：

- **Android**：`addJavascriptInterface` 注入的 Java 对象，方法有返回值时 `@JavascriptInterface` 方法可以**直接 return**，JS 侧同步拿到。
- **iOS**：WKWebView 的 `WKScriptMessageHandler` 是**异步**的，`postMessage` 拿不到同步返回值（旧 UIWebView 的 JSContext 能同步，已废弃）。

### 异步调用如何实现

异步 = 发起后通过 **callbackId + 回调队列**返回（见第五节）。

### 为什么大部分只能是异步

1. **Native 能力都是耗时操作**：定位、网络、相机、NFC 都要时间，同步返回会卡住 JS 线程。
2. **会阻塞渲染**：WebView 里 JS 和页面渲染可能共享线程，同步等一个 2 秒的定位，页面就白屏卡死 2 秒，Android 可能 ANR、iOS 可能 watchdog。
3. **通信机制本身异步**：iOS WKWebView 的 `postMessage` 设计上就是异步的，跨进程/跨线程传递消息需要时间。

> 结论：同步只适合「读即时值」（拿 token、读环境信息）这类极轻量场景，重型操作必须异步。

---

## 五、Promise 化与回调队列

```js
function invoke(method, params = {}, options = {}) {
  return new Promise((resolve, reject) => {
    // ① 生成唯一 callbackId
    const callbackId = genCallbackId(); // 'cb_169..._1'

    // ② 设超时，防止 Native 不回调导致 Promise 永远 pending
    const timer = setTimeout(() => {
      callbackQueue.delete(callbackId);
      reject(new Error(`method "${method}" timeout`));
    }, options.timeout || 10000);

    // ③ 把 resolve/reject 存进回调队列
    callbackQueue.set(callbackId, { resolve, reject, timer });

    // ④ 发起调用
    invokeByInject(method, params, callbackId);
  });
}

// ⑤ Native 异步完成后回调入口
window.__nativeCallback = function (callbackId, result) {
  const item = callbackQueue.get(callbackId);
  if (!item) return;
  clearTimeout(item.timer);
  callbackQueue.delete(callbackId);
  if (result && result.code === 0) {
    item.resolve(result.data);
  } else {
    item.reject(new Error((result && result.msg) || 'unknown error'));
  }
};
```

**为什么用 callbackId + 队列，而不是简单全局回调：**

1. **并发对应**：可能同时发起多个请求，每个有自己的 callbackId，回调时精确对上号，不串。
2. **Map 而不是对象**：key 可任意字符串、增删快、无原型链污染。
3. **超时 + 清理防泄漏**：Native 没回调时 setTimeout 兜底 reject 并删队列项，否则闭包和定时器一直留着就是内存泄漏。

---

## 六、版本兼容与降级策略

分**三层**：

### 第一层：能力检测（Native 注入能力清单）

```js
const supportedApis = nativeBridge.supportedApis || []; // ['getLocation', 'openNFC', ...]
function isSupported(method) {
  if (supportedApis.length && !supportedApis.includes(method)) return false;
  return true;
}
```

### 第二层：版本号约束（minVersion）

```js
function isSupported(method, minVersion) {
  if (minVersion && compareVersion(nativeVersion, minVersion) < 0) return false;
  return true;
}
```

### 第三层：通道降级（注入对象 → URL Scheme）

```js
if (useInject) {
  invokeByInject(method, params, callbackId);   // 现代 WebView
} else {
  invokeByUrlScheme(method, params, callbackId); // 老 WebView 降级
}
```

### 兜底策略（上层 catch 处理）

```js
JSBridge.invoke('openNFC', {}, { minVersion: '2.0.0' })
  .catch(err => {
    const msg = err.message;
    if (msg.includes('not supported')) {
      showUpgradeDialog();   // ① 老版本没这能力 → 引导升级 App
    } else if (msg.includes('timeout')) {
      showRetry();           // ② 超时 → 重试
    } else {
      fallbackToH5();        // ③ 其他 → H5 降级实现 / 功能隐藏
    }
  });
```

**核心思路**：不支持不是报错就完事，而是**让上层能感知、能决策**——升级引导 / 降级页 / H5 模拟 / 功能隐藏，四种兜底按业务选。

---

## 七、反向通信（Native 调 H5）

### 方式一：evaluateJavaScript 直接执行 JS

```js
// H5 侧：暴露全局方法
window.jsHandler = {
  onLocationChanged(data) { /* ... */ },
  onNetworkChange(status) { /* ... */ },
};
```

```java
// Android
webView.evaluateJavascript("window.jsHandler.onNetworkChange('offline')", null);
```

```swift
// iOS
webView.evaluateJavaScript("window.jsHandler.onNetworkChange('offline')")
```

### 方式二：事件推送（约定事件名，H5 订阅）

```js
// H5 侧订阅
JSBridge.on('nfcPairResult', data => { /* 处理 */ });

// Native 侧触发
window.__nativeEvent('nfcPairResult', { paired: true, awardId: 'xxx' });
```

### 选型

| 方式 | 特点 | 适用 |
|------|------|------|
| evaluateJavaScript 调全局函数 | 直接、一次性、有明确返回 | 单次调用、要拿 H5 返回值 |
| 事件推送 | 解耦、一对多、随时订阅/取消 | 状态变化、持续推送 |

---

## 八、完整代码实现

> 文件：`jsbridge实现.js`

```js
/**
 * JSBridge 前端统一封装
 * 协议规范：
 *  1. JS -> Native: { method, params, callbackId }
 *  2. Native -> JS 回调: window.__nativeCallback(callbackId, result)
 *  3. Native -> JS 事件: window.__nativeEvent(eventName, data)
 *  4. result 协议: { code, data, msg }，code === 0 成功
 */
(function (global) {
  const callbackQueue = new Map();
  const eventListeners = new Map();
  let callbackIdSeed = 0;
  const DEFAULT_TIMEOUT = 10000;

  const nativeBridge = global.NativeBridge || {};
  const nativeVersion = nativeBridge.version || '0.0.0';
  const supportedApis = nativeBridge.supportedApis || [];
  const useInject = !!(nativeBridge.invoke || nativeBridge.postMessage || global.webkit);

  function genCallbackId() {
    return 'cb_' + Date.now() + '_' + (++callbackIdSeed);
  }

  function compareVersion(v1, v2) {
    const a = String(v1).split('.').map(Number);
    const b = String(v2).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  function isSupported(method, minVersion) {
    if (supportedApis.length && !supportedApis.includes(method)) return false;
    if (minVersion && compareVersion(nativeVersion, minVersion) < 0) return false;
    return true;
  }

  function invokeByUrlScheme(method, params, callbackId) {
    const query = 'params=' + encodeURIComponent(JSON.stringify(params)) +
      '&callbackId=' + encodeURIComponent(callbackId);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'jsbridge://' + method + '?' + query;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 100);
  }

  function invokeByInject(method, params, callbackId) {
    const payload = JSON.stringify(params);
    if (global.webkit?.messageHandlers?.NativeBridge) {
      global.webkit.messageHandlers.NativeBridge.postMessage({ method, params, callbackId });
      return;
    }
    if (nativeBridge.invoke) {
      nativeBridge.invoke(method, payload, callbackId);
      return;
    }
    if (nativeBridge[method]) {
      nativeBridge[method](payload, callbackId);
      return;
    }
    throw new Error('[JSBridge] no transport for "' + method + '"');
  }

  function invoke(method, params = {}, options = {}) {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    return new Promise((resolve, reject) => {
      if (!isSupported(method, options.minVersion)) {
        return reject(new Error('[JSBridge] method "' + method + '" is not supported'));
      }
      const callbackId = genCallbackId();
      const timer = setTimeout(() => {
        callbackQueue.delete(callbackId);
        reject(new Error('[JSBridge] method "' + method + '" timeout'));
      }, timeout);
      callbackQueue.set(callbackId, { resolve, reject, timer });
      try {
        if (useInject) invokeByInject(method, params, callbackId);
        else invokeByUrlScheme(method, params, callbackId);
      } catch (err) {
        clearTimeout(timer);
        callbackQueue.delete(callbackId);
        reject(err);
      }
    });
  }

  function invokeSync(method, params = {}) {
    if (!isSupported(method)) throw new Error('not supported');
    const payload = JSON.stringify(params);
    if (nativeBridge[method + 'Sync']) return nativeBridge[method + 'Sync'](payload);
    if (nativeBridge[method]) return nativeBridge[method](payload);
    throw new Error('does not support sync call');
  }

  function on(eventName, handler) {
    if (!eventListeners.has(eventName)) eventListeners.set(eventName, new Set());
    eventListeners.get(eventName).add(handler);
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    eventListeners.get(eventName)?.delete(handler);
  }

  function emit(eventName, data) {
    eventListeners.get(eventName)?.forEach(fn => fn(data));
  }

  global.__nativeCallback = function (callbackId, result) {
    const item = callbackQueue.get(callbackId);
    if (!item) return;
    clearTimeout(item.timer);
    callbackQueue.delete(callbackId);
    if (result && result.code === 0) item.resolve(result.data);
    else item.reject(new Error((result && result.msg) || 'unknown error'));
  };

  global.__nativeEvent = function (eventName, data) {
    emit(eventName, data);
  };

  global.JSBridge = {
    invoke, invokeSync, on, off, isSupported, version: nativeVersion,
  };
})(window);
```

---

## 九、使用示例

### 基础调用（async/await）

```js
async function getLocation() {
  try {
    const data = await JSBridge.invoke('getLocation', { type: 'wgs84' });
    console.log('经纬度', data.lng, data.lat);
  } catch (err) {
    console.error('定位失败', err.message);
  }
}
```

### 错误分类处理

```js
JSBridge.invoke('openNFC', {}, { timeout: 5000, minVersion: '2.0.0' })
  .then(data => { /* 进入碰一碰 */ })
  .catch(err => {
    const msg = err.message;
    if (msg.includes('not supported')) showUpgradeDialog();
    else if (msg.includes('timeout')) showRetry();
    else toast(msg);
  });
```

### 同步调用（读 token）

```js
function initPage() {
  try {
    const token = JSBridge.invokeSync('getToken');
    const env = JSBridge.invokeSync('getEnv', { key: 'channel' });
  } catch (err) {
    // 失败走降级：从 cookie / localStorage 读
  }
}
```

### 事件订阅（Native 推送，如 NFC 配对结果）

```js
function useNfcPair() {
  return JSBridge.on('nfcPairResult', data => {
    if (data.paired) handlePairSuccess(data);
  });
}

// React 组件里
useEffect(() => {
  const off = useNfcPair();
  return off; // 卸载取消订阅，防内存泄漏
}, []);
```

### 并发调用

```js
async function initActivityPage() {
  const [device, location, user] = await Promise.all([
    JSBridge.invoke('getDeviceInfo'),
    JSBridge.invoke('getLocation'),
    JSBridge.invoke('getUserInfo'),
  ]);
  return { device, location, user };
}
```

### 二次封装成业务 API 层（工程化推荐）

```js
const api = {
  getLocation: params => JSBridge.invoke('getLocation', params),
  openNFC: () => JSBridge.invoke('openNFC', {}, { timeout: 5000, minVersion: '2.0.0' }),
  getToken: () => JSBridge.invokeSync('getToken'),
  onNfcPair: handler => JSBridge.on('nfcPairResult', handler),
};
```

### 竞态保护（结合状态机防重入）

```js
let nfcStarting = false;
async function startGame() {
  if (nfcStarting) return;
  nfcStarting = true;
  try {
    await JSBridge.invoke('startNfcGame', {}, { timeout: 8000 });
  } finally {
    nfcStarting = false;
  }
}
```

---

## 十、Native 侧配合

**Android：**

```java
webView.addJavascriptInterface(new NativeBridge(), "NativeBridge");

public class NativeBridge {
  @JavascriptInterface
  public void invoke(String method, String params, String callbackId) {
    // 异步执行后回调 JS
    webView.evaluateJavascript(
      "window.__nativeCallback('" + callbackId + "', " + resultJson + ")", null);
  }
}
```

**iOS（WKWebView）：**

```swift
webView.configuration.userContentController.add(self, name: "NativeBridge")

func userContentController(_ controller: WKUserContentController,
                           didReceive message: WKScriptMessage) {
  // 解析 method/params/callbackId，执行后回调
  webView.evaluateJavaScript("window.__nativeCallback('\(callbackId)', \(resultJson))")
}
```

---

## 十一、记忆锚点与高频追问

### 记忆锚点

| 主题 | 一句话 |
|------|--------|
| 原理 | JS 和 Native 隔离，靠约定通道通信 |
| 三种注入 | URL Scheme 拦截 / 注入全局对象 / prompt 拦截 |
| 调用流程 | Promise 化 + callbackId 队列 + 超时 |
| 同步异步 | 同步靠注入对象直接返回，多数只能异步 |
| 版本降级 | 能力检测 + 版本约束 + 通道降级 |
| 反向通信 | evaluateJavaScript + 事件推送 |

### 高频追问清单

1. **iframe vs location.href**：连续 href 只生效最后一次，iframe 独立且不刷新页面。
2. **为什么用 prompt 不用 alert**：prompt 能拿返回值，能传两个参数。
3. **callbackId 的作用**：异步回调对上号，支持并发。
4. **为什么回调函数挂 window**：Native 跨越 JS 上下文边界注入执行，只能走全局函数。
5. **为什么大部分只能异步**：耗时操作、阻塞渲染（ANR/watchdog）、通信机制限制。
6. **超时 + 队列清理防泄漏**：Native 不回调时闭包和定时器要清掉。
7. **同步调用阻塞 JS 线程**：只用于读即时值，重型操作必须异步。

---

### 完整话术链（面试串讲）

> 原理是 JS 和 Native 隔离，靠约定通道通信。三种注入方式：URL Scheme 拦截、注入全局对象、prompt 拦截。
> 调用流程是 Promise 化 + callbackId 队列 + 超时。同步靠注入对象直接返回，但多数只能异步，因为耗时、阻塞渲染、机制限制。
> 版本降级做三层：能力检测 + 版本约束 + 通道降级，上层 catch 兜底。
> 反向通信用 evaluateJavaScript 调全局函数 + 事件推送。
