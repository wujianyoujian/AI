import { NextRequest } from "next/server";
import http from "http";

function fetchViaProxy(
  proxyUrl: string,
  targetUrl: string,
  body: string
): Promise<{ ok: boolean; status: number; buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyUrl);
    const target = new URL(targetUrl);
    const data = Buffer.from(body, "utf-8");

    const options: http.RequestOptions = {
      hostname: proxy.hostname,
      port: parseInt(proxy.port) || 80,
      path: targetUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "Host": target.host,
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          buffer: Buffer.concat(chunks),
          contentType: (res.headers["content-type"] as string) || "audio/mpeg",
        });
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return new Response("No text", { status: 400 });

  const proxyUrl = process.env.http_proxy || process.env.HTTP_PROXY || "http://127.0.0.1:7897";

  try {
    const res = await fetchViaProxy(
      proxyUrl,
      "http://192.168.3.187:9880/speak",
      JSON.stringify({ text, text_lang: "en" })
    );

    if (!res.ok) {
      return new Response(`TTS service error: ${res.status}`, { status: 502 });
    }

    const uint8 = new Uint8Array(res.buffer);
    return new Response(uint8, {
      headers: {
        "Content-Type": res.contentType,
        "Content-Length": uint8.length.toString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TTS]", msg);
    return new Response(`TTS error: ${msg}`, { status: 500 });
  }
}
