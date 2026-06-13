/* 临时本地静态服务器（验收用）：node scripts/_serve.js [port]
 * 浏览器 MCP 禁止 file://，故起一个 http 服务把仓库根目录端出去。 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const port = parseInt(process.argv[2] || "8011", 10);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(root, p);
  if (!fp.startsWith(root)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(buf);
  });
}).listen(port, "127.0.0.1", () => console.log("serve on http://127.0.0.1:" + port));
