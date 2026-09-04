import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
const execAsync = promisify(exec);
// 判断是否为 IP 地址（IPv4 或 IPv6）
function isIP(hostname) {
    if (hostname.includes(":"))
        return true; // IPv6
    const parts = hostname.split(".");
    return parts.length === 4 && parts.every((p) => /^\d+$/.test(p)); // IPv4
}
// 按域名层级判定策略：
// 一级域名（恰好 2 段，如 example.com）→ 问询
// 二级及以上（≥3 段，如 xxx.example.com、a.b.example.com）→ 放行
// IP / 单段等其他 → 拒绝
function classifyHost(hostname) {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    if (isIP(host))
        return "deny";
    const labels = host.split(".").filter(Boolean);
    if (labels.length === 2)
        return "ask";
    if (labels.length >= 3)
        return "allow";
    return "deny";
}
// 从 curl 命令里解析出目标主机名（启发式，覆盖常见写法）
function extractHostname(command) {
    // 优先匹配带协议的完整 URL
    const urlMatch = command.match(/(https?:\/\/[^\s"'`\\]+)/);
    if (urlMatch) {
        try {
            return new URL(urlMatch[1]).hostname;
        }
        catch {
            // 解析失败则继续尝试裸域名
        }
    }
    // 回退：找第一个看起来像域名的裸参数
    for (const token of command.split(/\s+/)) {
        const t = token.replace(/^['"]|['"]$/g, "");
        if (t.startsWith("-"))
            continue; // 跳过选项参数
        if (/^[\w-]+(\.[\w-]+)+$/.test(t)) {
            return t.split(":")[0]; // 去掉端口
        }
    }
    return null;
}
async function runCurl(command) {
    try {
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30_000,
            maxBuffer: 10 * 1024 * 1024,
        });
        return stderr ? `${stdout}\n${stderr}` : stdout;
    }
    catch (err) {
        return `curl 执行失败: ${err.message}`;
    }
}
const server = new McpServer({
    name: "curl-policy-mcp",
    version: "1.0.0",
});
server.tool("execute_curl", "执行 curl 命令，并按域名层级放行 / 问询 / 拒绝。二级及以上子域名（如 xxx.example.com）直接执行；一级域名（如 example.com）需用户确认；IP 等其他情况一律拒绝。", {
    command: z.string().describe("要执行的 curl 命令"),
    confirmed: z
        .boolean()
        .optional()
        .default(false)
        .describe("仅当上一次返回 decision=ask 且用户已明确同意后，置为 true 以继续执行"),
}, async ({ command, confirmed }) => {
    const hostname = extractHostname(command);
    if (!hostname) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ decision: "deny", reason: "无法从命令中解析出 URL / 域名" }),
                },
            ],
        };
    }
    const decision = classifyHost(hostname);
    if (decision === "deny") {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        decision: "deny",
                        hostname,
                        message: "该域名不在允许范围内，已拒绝执行 curl",
                    }),
                },
            ],
        };
    }
    if (decision === "ask" && !confirmed) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        decision: "ask",
                        hostname,
                        message: "该域名属于需确认范围，请向用户问询是否继续执行",
                    }),
                },
            ],
        };
    }
    // allow，或 ask 且用户已确认
    const output = await runCurl(command);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ decision: "allow", hostname, output }),
            },
        ],
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MCP server 启动失败:", err);
    process.exit(1);
});
