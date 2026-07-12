/* ============================================================
 * 国内镜像发布：node scripts/mirror.js
 * 2026-07-12 立（用户网络到 github.io 间歇被掐·TLS 直接重置）。
 * 镜像=Cloudflare Pages（本机实测 *.pages.dev 可达；Netlify 免费额装不下 566MB；
 * jsDelivr 不渲染 HTML；vercel.app 域被墙）。
 * 地址：https://fanren-ban.pages.dev/
 * 凭据：wrangler OAuth（C:\Users\Administrator\AppData\Roaming\xdg.config\.wrangler）——
 *      失效时重跑 npx wrangler login（用户点授权）。
 * 发版惯例：node scripts/bump.js <ver> → git push（GitHub Pages）→ node scripts/mirror.js（国内镜像）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "_mirror_dist");

// 1) 重建部署目录（只装游戏运行所需：入口+版本+PWA 件+三大资源目录）
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of ["index.html", "ver.txt", "sw.js", "manifest.json", "favicon.ico"]) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, f));
}
for (const d of ["js", "css", "assets"]) {
  fs.cpSync(path.join(root, d), path.join(dist, d), { recursive: true });
}
const count = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length;
console.log(`[mirror] dist 就绪：${count(dist)} 个文件`);

// 2) 推 Cloudflare Pages（已上传过的文件按哈希跳过——增量发布，日常只传改动件）
const r = spawnSync("npx", ["-y", "wrangler", "pages", "deploy", "_mirror_dist",
  "--project-name", "fanren", "--branch", "main", "--commit-dirty=true"],
  { cwd: root, stdio: "inherit", shell: true });
if (r.status !== 0) { console.error("[mirror] 部署失败——检查 wrangler 登录态（npx wrangler whoami）"); process.exit(1); }
console.log("[mirror] 完成。验证：curl https://fanren-ban.pages.dev/ver.txt");
