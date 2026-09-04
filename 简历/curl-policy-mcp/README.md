# curl-policy-mcp

按域名层级拦截 curl 命令的 MCP 工具：二级及以上子域名直接放行，一级域名需向用户问询，其余一律拒绝。

## 策略

| 域名层级 | 例子 | 处理 |
|---|---|---|
| 二级及以上子域名（≥3 段） | `a.example.com`、`xxx.example.com`、`a.b.example.com` | 直接放行，立即执行 |
| 一级域名（恰好 2 段） | `example.com`、`foo.com` | 返回 `ask`，由模型向用户问询 |
| 其他（IP / localhost 等） | `1.2.3.4`、`::1`、`localhost` | 拒绝执行 |

## 安装

```bash
cd curl-policy-mcp
npm install
npm run build
```

## 配置到 Claude Code

```bash
claude mcp add curl-policy -- node /path/to/curl-policy-mcp/build/index.js
```

## 使用

模型在用户要求执行 curl 时，应调用 `execute_curl` 工具而不是直接执行 bash：

- `decision=allow`：直接返回执行结果
- `decision=ask`：模型向用户问询；用户同意后，用 `confirmed=true` 再次调用
- `decision=deny`：拒绝，不执行

### 示例

```
用户：帮我 curl 一下 a.example.com
→ 工具返回 decision=allow + 输出

用户：帮我 curl 一下 example.com
→ 工具返回 decision=ask
→ 模型：这个域名需要你确认，是否继续？
→ 用户：好
→ 模型再次调用，confirmed=true，返回 allow + 输出

用户：帮我 curl 一下 1.2.3.4
→ 工具返回 decision=deny
```

## 注意

- 域名解析是启发式的，覆盖 `https://` 前缀和裸域名两种常见写法；复杂的 shell 拼接场景建议先规整命令。
- 该工具只按「目标域名」拦截，不限制 curl 的其余参数（如 `-o` 写文件）；如有需要可在此基础上扩展参数校验。
