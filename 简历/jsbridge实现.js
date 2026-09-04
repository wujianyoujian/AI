/**
 * JSBridge 前端统一封装
 *
 * 协议规范：
 *  1. JS -> Native 消息格式: { method: string, params: object, callbackId: string }
 *  2. Native -> JS 异步回调:  window.__nativeCallback(callbackId, result)
 *  3. Native -> JS 事件推送:  window.__nativeEvent(eventName, data)
 *  4. result 协议: { code, data, msg }，code === 0 表示成功
 *
 * 特性：
 *  - Promise 化调用
 *  - 同步 / 异步调用
 *  - callbackId 回调队列 + 超时控制
 *  - 版本兼容与降级策略（API 检测、URL Scheme 降级）
 *  - 事件订阅（Native 主动推送）
 */
(function (global) {
  // 回调队列：callbackId -> { resolve, reject, timer }
  const callbackQueue = new Map();

  // 事件订阅：eventName -> Set<handler>
  const eventListeners = new Map();

  let callbackIdSeed = 0;
  const DEFAULT_TIMEOUT = 10000;

  // Native 注入的能力信息（由 Native 在 window 上注入）
  const nativeBridge = global.NativeBridge || {};
  const nativeVersion = nativeBridge.version || '0.0.0';
  const supportedApis = nativeBridge.supportedApis || [];

  // 是否走注入对象方式（现代 WebView），否则降级到 URL Scheme
  const useInject = !!(nativeBridge.invoke || nativeBridge.postMessage || global.webkit);

  // ---------- 工具 ----------

  function genCallbackId() {
    return 'cb_' + Date.now() + '_' + (++callbackIdSeed);
  }

  // 版本号比较：v1 > v2 返回 1，相等返回 0，小于返回 -1
  function compareVersion(v1, v2) {
    const a = String(v1).split('.').map(Number);
    const b = String(v2).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  // 判断 Native 是否支持某个 API（可选最小版本约束）
  function isSupported(method, minVersion) {
    if (supportedApis.length && !supportedApis.includes(method)) return false;
    if (minVersion && compareVersion(nativeVersion, minVersion) < 0) return false;
    return true;
  }

  // ---------- 发起调用的底层通道 ----------

  // 降级方案：URL Scheme 拦截
  function invokeByUrlScheme(method, params, callbackId) {
    const query =
      'params=' + encodeURIComponent(JSON.stringify(params)) +
      '&callbackId=' + encodeURIComponent(callbackId);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'jsbridge://' + method + '?' + query;
    document.body.appendChild(iframe);
    // 用完移除，避免 iframe 堆积
    setTimeout(() => iframe.remove(), 100);
  }

  // 主方案：注入全局对象
  function invokeByInject(method, params, callbackId) {
    const payload = JSON.stringify(params);

    // iOS WKWebView：WKScriptMessageHandler
    if (global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.NativeBridge) {
      global.webkit.messageHandlers.NativeBridge.postMessage({ method, params, callbackId });
      return;
    }
    // 通用 invoke 入口（Android / 自定义注入）
    if (nativeBridge.invoke) {
      nativeBridge.invoke(method, payload, callbackId);
      return;
    }
    // Android addJavascriptInterface 直接暴露方法
    if (nativeBridge[method]) {
      nativeBridge[method](payload, callbackId);
      return;
    }
    throw new Error('[JSBridge] no available transport for method "' + method + '"');
  }

  // ---------- 核心 API ----------

  /**
   * 异步调用（Promise 化）
   * @param {string} method  方法名
   * @param {object} params  参数
   * @param {object} options { timeout, minVersion }
   * @returns {Promise<any>}
   */
  function invoke(method, params = {}, options = {}) {
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    return new Promise((resolve, reject) => {
      // 版本兼容判断：不支持直接 reject，上层可据此降级
      if (!isSupported(method, options.minVersion)) {
        return reject(
          new Error('[JSBridge] method "' + method + '" is not supported (native version: ' + nativeVersion + ')')
        );
      }

      const callbackId = genCallbackId();

      // 超时控制：避免 Native 没回调导致 Promise 永远 pending
      const timer = setTimeout(() => {
        callbackQueue.delete(callbackId);
        reject(new Error('[JSBridge] method "' + method + '" timeout after ' + timeout + 'ms'));
      }, timeout);

      callbackQueue.set(callbackId, { resolve, reject, timer });

      try {
        if (useInject) {
          invokeByInject(method, params, callbackId);
        } else {
          invokeByUrlScheme(method, params, callbackId);
        }
      } catch (err) {
        clearTimeout(timer);
        callbackQueue.delete(callbackId);
        reject(err);
      }
    });
  }

  /**
   * 同步调用（仅部分 Native 支持，会阻塞 JS 线程，慎用）
   * 适用：读取 Native 同步返回值，如 token、环境信息
   */
  function invokeSync(method, params = {}) {
    if (!isSupported(method)) {
      throw new Error('[JSBridge] method "' + method + '" is not supported');
    }
    const payload = JSON.stringify(params);

    // Native 显式暴露同步方法
    if (nativeBridge[method + 'Sync']) {
      return nativeBridge[method + 'Sync'](payload);
    }
    // Android addJavascriptInterface 部分场景可同步返回
    if (nativeBridge[method]) {
      return nativeBridge[method](payload);
    }
    throw new Error('[JSBridge] method "' + method + '" does not support sync call');
  }

  // ---------- 事件系统（Native 主动推送） ----------

  function on(eventName, handler) {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    eventListeners.get(eventName).add(handler);
    // 返回取消订阅函数
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    eventListeners.get(eventName)?.delete(handler);
  }

  function emit(eventName, data) {
    eventListeners.get(eventName)?.forEach((fn) => fn(data));
  }

  // ---------- Native 回调入口（必须挂到 window） ----------

  // Native 异步结果回调
  global.__nativeCallback = function (callbackId, result) {
    const item = callbackQueue.get(callbackId);
    if (!item) return;
    clearTimeout(item.timer);
    callbackQueue.delete(callbackId);

    if (result && result.code === 0) {
      item.resolve(result.data);
    } else {
      item.reject(new Error((result && result.msg) || 'JSBridge unknown error'));
    }
  };

  // Native 主动事件推送
  global.__nativeEvent = function (eventName, data) {
    emit(eventName, data);
  };

  // ---------- 导出 ----------
  global.JSBridge = {
    invoke,
    invokeSync,
    on,
    off,
    isSupported,
    version: nativeVersion,
  };
})(window);
