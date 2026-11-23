import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleContext, handleExplain } from "./line-reader-api.mjs";

const root = fileURLToPath(new URL("../docs", import.meta.url));
const port = Number(process.argv[2] ?? 8766);
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const api = "/projects/code-reading-with-deepseek/demo/api/";
const handlers = new Map([[api + "context", handleContext], [api + "explain", handleExplain]]);
const types = new Map([
  [".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".webp", "image/webp"], [".png", "image/png"], [".svg", "image/svg+xml"],
  [".md", "text/plain; charset=utf-8"], [".cube", "text/plain; charset=utf-8"],
  [".apk", "application/vnd.android.package-archive"],
]);

function reject(response, code, message) {
  response.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ error: message }));
}

const server = createServer(async (request, response) => {
  try {
    if (!hosts.has(request.headers.host)) return reject(response, 403, "此预览服务仅限本机访问。");
    const origin = "http://" + request.headers.host;
    const url = new URL(request.url, origin);
    const handler = handlers.get(url.pathname);
    if (request.method === "HEAD" && handler) {
      response.writeHead(204, { "X-Portfolio-Line-Reader": "local", "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (request.method === "POST") {
      if (!handler) return reject(response, 404, "没有此接口。");
      if (request.headers.origin !== origin || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) {
        return reject(response, 403, "仅接受本地页面发起的 JSON 请求。");
      }
      await handler(request, response);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) return reject(response, 405, "不支持的请求方法。");

    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) return reject(response, 404, "没有此文件。");
    let target = file;
    let info = await stat(file);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(308, { Location: url.pathname + "/" + url.search });
        response.end();
        return;
      }
      target = join(file, "index.html");
      info = await stat(target);
    }
    if (!info.isFile()) return reject(response, 404, "没有此文件。");
    response.writeHead(200, {
      "Content-Type": types.get(extname(target)) ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else {
      const stream = createReadStream(target);
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    }
  } catch (error) {
    if (response.headersSent) return response.destroy();
    reject(response, error.code === "ENOENT" ? 404 : 400, "无法读取该请求。");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/`));
