import http from "node:http";
import type { ApiCtx } from "./router";
import { handleApi } from "./router";

export function createServer(ctx: ApiCtx): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const result = await handleApi(ctx, {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.writeHead(result.status, {
        "content-type":
          result.contentType ?? "application/json; charset=utf-8",
        ...result.extraHeaders,
      });
      res.end(result.body);
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "internal";
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: message }));
    });
  });
}
