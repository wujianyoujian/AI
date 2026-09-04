# qiankun + React 微前端示例

1 个主应用 + 2 个 React 子应用，通过**路由前缀**区分并激活子应用：

| 应用 | 路由前缀 | 端口 | 技术栈 |
|---|---|---|---|
| main（主应用） | `/` | 7100 | React + react-router + qiankun |
| system（系统管理） | `/system` | 7101 | React + react-router + vite-plugin-qiankun |
| operation（运营管理） | `/operation` | 7102 | React + react-router + vite-plugin-qiankun |

## 启动

需要 Node.js >= 18。

```bash
# 1. 根目录安装所有依赖（workspaces 一次装完）
npm install

# 2. 一条命令同时起三个 dev server
npm run dev
```

然后浏览器打开 **http://localhost:7100**，点击顶部「系统管理」「运营管理」切换子应用。

也可以分别单独启动：

```bash
npm run dev --workspace main
npm run dev --workspace system
npm run dev --workspace operation
```

## 路由说明

- `/` → 主应用首页
- `/system`、`/system/user` → 系统管理子应用（内部路由 `user`）
- `/operation`、`/operation/content` → 运营管理子应用（内部路由 `content`）

## 核心机制（对应代码位置）

1. **注册子应用**：`main/src/main.jsx` 里 `registerMicroApps`，`activeRule` 分别是 `/system`、`/operation`，`name` 必须与子应用 `vite.config.js` 里 `qiankun('system')` 的应用名一致。
2. **子应用生命周期**：`system/src/main.jsx` 用 `renderWithQiankun` 暴露 `bootstrap/mount/unmount`，并在 `unmount` 里卸载 React root。
3. **路由 basename**：子应用运行时用 `qiankunWindow.__POWERED_BY_QIANKUN__` 判断，被 qiankun 加载时设置 `basename='/system'`（或 `/operation`），这样 `/system/user` 才能正确命中子应用内部的 `/user` 路由。
4. **跨域**：子应用 `vite.config.js` 里 `server.headers` 加了 `Access-Control-Allow-Origin: *`，qiankun 跨端口加载资源需要。
