import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["build/index.js"],
});

const client = new Client({ name: "verify-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("注册的工具:", tools.tools.map((t) => t.name).join(", "));

async function call(command, confirmed = false) {
  const res = await client.callTool({
    name: "execute_curl",
    arguments: { command, ...(confirmed ? { confirmed: true } : {}) },
  });
  return res.content[0].text;
}

console.log("\n=== 1. 二级域名 → 应 allow（会真的执行 curl）===");
console.log(await call("curl -s https://a.example.com"));

console.log("\n=== 2. 一级域名 → 应 ask（不执行）===");
console.log(await call("curl https://example.com"));

console.log("\n=== 3. 一级域名 + confirmed=true → 应 allow（执行）===");
console.log(await call("curl -s -I https://example.com", true));

console.log("\n=== 4. 一级域名 evil.com（2 段）→ 应 ask ===");
console.log(await call("curl https://evil.com"));

console.log("\n=== 5. IP → 应 deny（不执行）===");
console.log(await call("curl https://1.2.3.4"));

console.log("\n=== 6. 单段 localhost → 应 deny（不执行）===");
console.log(await call("curl http://localhost"));

await client.close();
