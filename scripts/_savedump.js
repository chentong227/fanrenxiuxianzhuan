/* playtest 存档导出接收器：node scripts/_savedump.js [port]
 * 配合 playtest/_dump.html —— 浏览器把 localStorage 存档 POST 过来，写入 playtest/。
 * 仅本地调试用，不参与游戏运行。 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const port = parseInt(process.argv[2] || "8098", 10);
const outDir = path.join(__dirname, "..", "playtest");
http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Save-Name");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") { res.writeHead(405); res.end("POST only"); return; }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const name = (req.headers["x-save-name"] || "save-dump").replace(/[^\w\-]/g, "");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const fp = path.join(outDir, name + ".json");
      // 校验是合法 JSON 再落盘
      JSON.parse(body);
      fs.writeFileSync(fp, body, "utf8");
      console.log("saved", fp, body.length, "bytes");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, file: fp, bytes: body.length }));
    } catch (e) {
      console.error("dump failed:", e.message);
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}).listen(port, "127.0.0.1", () => console.log("savedump on http://127.0.0.1:" + port));
